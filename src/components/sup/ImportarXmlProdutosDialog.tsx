import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Combobox } from "@/components/shared/combobox";
import {
  TABLE_FONT_STYLE, TABLE_WRAPPER_CLASS, TH_CLASS, TD_CLASS, BADGE_SM_CLASS,
} from "@/components/shared/table-styles";
import { aplicarPrecoTabela } from "@/components/sup/ProdutosTab";
import {
  fmtDataBR, fmtMoeda, n, variacaoPercentual,
  type SupDepartamento, type SupFornecedor, type SupFornecedorProduto,
  type SupProduto, type SupProdutoGrupo,
} from "@/lib/sup";
import {
  cfopEhCompra, mapearUnidadeNFe, normalizarNome, parseNFe, rotuloCfop, soDigitos,
  type NFeItem, type NFeNota, type NFeParsed,
} from "@/lib/nfe-xml";

type Props = {
  fornecedor: SupFornecedor | null;
  produtos: SupProduto[];
  vinculos: SupFornecedorProduto[];
  departamentos: SupDepartamento[];
  grupos: SupProdutoGrupo[];
  unidades: string[];
  onImportado: () => void;
  mostrarBotao?: boolean;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
};

type Linha = {
  key: string;
  cProd: string;
  xProd: string;
  cfop: string;
  uCom: string;
  qtd: number;
  linhasNota: number;
  marcado: boolean;
  nome: string;
  unidade: string;
  departamento: string;
  grupo_id: string;
  preco: string;
  status: "novo" | "existe";
  produto_id: string | null;
};

/** 1113.1 → "1.113,10" (formato brasileiro, 2 casas). */
function fmtBR2(v: number): string {
  return n(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "1.113,10" / "1113,10" / "1113.10" → número, coagido pelo n() de sup.ts. */
function precoNum(texto: string): number {
  const t = String(texto ?? "").trim().replace(/\s/g, "");
  const canonico = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return n(canonico);
}

export function ImportarXmlProdutosDialog({
  fornecedor, produtos, vinculos, departamentos, grupos, unidades, onImportado,
  mostrarBotao = true, open: openProp, onOpenChange: onOpenChangeProp,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const controlado = openProp !== undefined && !!onOpenChangeProp;
  const [openInterno, setOpenInterno] = useState(false);
  const open = controlado ? !!openProp : openInterno;
  const setOpen = (v: boolean) => (controlado ? onOpenChangeProp!(v) : setOpenInterno(v));
  const [nota, setNota] = useState<NFeNota | null>(null);
  const [emitenteNome, setEmitenteNome] = useState("");
  const [semCnpj, setSemCnpj] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [bloqueio, setBloqueio] = useState<{ emitente: string; forn: string } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [trocando, setTrocando] = useState<string | null>(null);
  const [massaUnidade, setMassaUnidade] = useState("");
  const [massaDep, setMassaDep] = useState("");
  const [massaGrupo, setMassaGrupo] = useState("");

  const produtosDoFornecedor = useMemo(
    () => (fornecedor ? produtos.filter((p) => p.fornecedor_id === fornecedor.id) : []),
    [produtos, fornecedor],
  );

  const vinculoDoProduto = (produto_id: string) =>
    vinculos.find((v) => v.produto_id === produto_id && v.fornecedor_id === fornecedor?.id) ?? null;

  function montarLinhas(p: NFeParsed): Linha[] {
    const mapa = new Map<string, { item: NFeItem; qtd: number; count: number }>();
    for (const it of p.itens) {
      const k = `${it.cProd}||${normalizarNome(it.xProd)}||${it.vUnCom}`;
      const atual = mapa.get(k);
      if (atual) {
        atual.qtd += n(it.qCom);
        atual.count += 1;
      } else {
        mapa.set(k, { item: it, qtd: n(it.qCom), count: 1 });
      }
    }
    return Array.from(mapa.entries()).map(([key, { item, qtd, count }]) => {
      const porCod = item.cProd
        ? vinculos.find((v) => v.fornecedor_id === fornecedor?.id && v.cod_fornecedor === item.cProd)
        : undefined;
      let produto_id: string | null = porCod?.produto_id ?? null;
      if (!produto_id) {
        const alvo = normalizarNome(item.xProd);
        produto_id = produtosDoFornecedor.find((pr) => normalizarNome(pr.nome) === alvo)?.id ?? null;
      }
      const prod = produto_id ? produtosDoFornecedor.find((pr) => pr.id === produto_id) ?? null : null;
      return {
        key,
        cProd: item.cProd,
        xProd: item.xProd,
        cfop: item.cfop,
        uCom: item.uCom,
        qtd,
        linhasNota: count,
        marcado: cfopEhCompra(item.cfop),
        nome: item.xProd,
        unidade: prod?.unidade || mapearUnidadeNFe(item.uCom, unidades),
        departamento: prod?.departamento ?? "",
        grupo_id: prod?.grupo_id ?? "",
        preco: fmtBR2(item.vUnCom),
        status: prod ? "existe" : "novo",
        produto_id: prod?.id ?? null,
      };
    });
  }

  async function aoEscolherArquivo(file: File): Promise<boolean> {
    if (!fornecedor) return false;
    let parsed: NFeParsed;
    try {
      parsed = parseNFe(await file.text());
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível ler o XML.");
      return false;
    }
    const docForn = soDigitos(fornecedor.documento);
    const cnpjEmit = parsed.emitente.cnpj;
    if (docForn && cnpjEmit && docForn !== cnpjEmit) {
      setBloqueio({
        emitente: parsed.emitente.razao_social,
        forn: fornecedor.nome_fantasia || fornecedor.razao_social,
      });
      return false;
    }
    setSemCnpj(!docForn);
    setEmitenteNome(parsed.emitente.razao_social);
    setNota(parsed.nota);
    setLinhas(montarLinhas(parsed));
    setOpen(true);
    return true;
  }

  const atualizar = (key: string, patch: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const marcados = linhas.filter((l) => l.marcado);
  const qtdNovos = marcados.filter((l) => l.status === "novo").length;
  const qtdExistentes = marcados.filter((l) => l.status === "existe").length;
  const foraCompra = linhas.filter((l) => !cfopEhCompra(l.cfop)).length;
  const semUnidade = marcados.filter((l) => !l.unidade).length;

  const produtoCadastradoDe = (l: Linha) =>
    l.produto_id ? produtosDoFornecedor.find((p) => p.id === l.produto_id) ?? null : null;

  /** A importação pode definir este campo? Preencher campo vago ≠ sobrescrever. */
  function podeDefinir(l: Linha, campo: "unidade" | "departamento" | "grupo_id"): boolean {
    if (campo === "unidade") return true;
    if (l.status === "novo") return true;
    const p = produtoCadastradoDe(l);
    return campo === "departamento" ? !p?.departamento : !p?.grupo_id;
  }

  const LABEL_CAMPO: Record<"unidade" | "departamento" | "grupo_id", string> = {
    unidade: "Unidade",
    departamento: "Departamento",
    grupo_id: "Grupo",
  };

  /** Aplica um campo nas linhas marcadas: todas, ou só as que estão vazias. Sempre dá feedback. */
  function aplicarEmMassa(campo: "unidade" | "departamento" | "grupo_id", valor: string, soVazias: boolean) {
    if (!valor) return;
    const marcadasAgora = linhas.filter((l) => l.marcado);
    const elegiveis = marcadasAgora.filter((l) => podeDefinir(l, campo));
    const bloqueadas = marcadasAgora.length - elegiveis.length;
    const alvos = soVazias ? elegiveis.filter((l) => !l[campo]) : elegiveis;
    const jaPreenchidas = elegiveis.length - alvos.length;
    const aplicadas = alvos.length;
    if (aplicadas > 0) {
      const chaves = new Set(alvos.map((l) => l.key));
      setLinhas((ls) => ls.map((l) => (chaves.has(l.key) ? { ...l, [campo]: valor } : l)));
    }
    if (aplicadas > 0) {
      const extra = bloqueadas > 0 ? ` ${bloqueadas} ignorada(s): já definido no cadastro.` : "";
      toast.success(`Preenchido em ${aplicadas} linha(s).${extra}`);
      return;
    }
    if (marcadasAgora.length === 0) {
      toast.warning("Nenhuma linha marcada.");
      return;
    }
    if (bloqueadas >= jaPreenchidas) {
      toast.warning(`As linhas marcadas já têm ${LABEL_CAMPO[campo]} definido no cadastro.`);
      return;
    }
    toast.warning("As linhas marcadas já estão preenchidas.");
  }

  function precoAtualDe(l: Linha): number | null {
    if (!l.produto_id) return null;
    const v = vinculoDoProduto(l.produto_id);
    const p = n(v?.preco_tabela);
    return p > 0 ? p : null;
  }

  async function importar() {
    if (!fornecedor || !nota) return;
    setSalvando(true);
    const motivo = `NF-e nº ${nota.numero ?? "—"} — ${fmtDataBR(nota.emissao)}`;
    const erros: string[] = [];
    let criados = 0;
    let precos = 0;
    try {
      const { data: u } = await supabase.auth.getUser();
      for (const l of marcados) {
        try {
          if (l.status === "novo") {
            if (!l.nome.trim()) throw new Error("nome vazio");
            if (!l.unidade) throw new Error("unidade não informada");
            const dup = produtosDoFornecedor.some(
              (p) => normalizarNome(p.nome) === normalizarNome(l.nome),
            );
            if (dup) throw new Error("já existe produto com este nome neste fornecedor");

            const { data: novo, error: e1 } = await (supabase as any)
              .from("sup_produtos")
              .insert({
                nome: l.nome.trim(),
                departamento: l.departamento || null,
                unidade: l.unidade,
                especificacao: null,
                preco_referencia: null,
                ativo: true,
                grupo_id: l.grupo_id || null,
                fornecedor_id: fornecedor.id,
                created_by: u.user?.id ?? null,
              })
              .select("id")
              .single();
            if (e1) throw e1;

            const { data: vinc, error: e2 } = await (supabase as any)
              .from("sup_fornecedor_produtos")
              .insert({
                fornecedor_id: fornecedor.id,
                produto_id: novo.id,
                cod_fornecedor: l.cProd || null,
              })
              .select("id")
              .single();
            if (e2) throw e2;
            criados += 1;

            const preco = precoNum(l.preco);
            if (preco > 0) {
              await aplicarPrecoTabela({
                fornecedor_produto_id: vinc.id,
                preco_anterior: null,
                preco_novo: preco,
                motivo,
              });
              precos += 1;
            }
          } else {
            const vinc = l.produto_id ? vinculoDoProduto(l.produto_id) : null;
            if (!vinc) throw new Error("vínculo do produto não encontrado");
            if (!vinc.cod_fornecedor && l.cProd) {
              const { error } = await (supabase as any)
                .from("sup_fornecedor_produtos")
                .update({ cod_fornecedor: l.cProd })
                .eq("id", vinc.id);
              if (error) throw error;
            }
            const atual = n(vinc.preco_tabela);
            const novoPreco = precoNum(l.preco);
            if (novoPreco > 0 && novoPreco !== atual) {
              await aplicarPrecoTabela({
                fornecedor_produto_id: vinc.id,
                preco_anterior: atual > 0 ? atual : null,
                preco_novo: novoPreco,
                motivo,
              });
              precos += 1;
            }
          }
        } catch (e: any) {
          erros.push(`${l.xProd}: ${e?.message || "erro ao importar"}`);
        }
      }
      toast.success(`${criados} produtos cadastrados · ${precos} preços atualizados`);
      if (erros.length) toast.error(`Falhas:\n${erros.join("\n")}`);
      onImportado();
      fechar();
    } finally {
      setSalvando(false);
      setConfirmar(false);
    }
  }

  function fechar() {
    setOpen(false);
    setLinhas([]);
    setNota(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  useEffect(() => {
    if (!controlado || !open) return;
    if (linhas.length > 0) return;
    inputRef.current?.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlado, open]);

  // Cancelar a seleção de arquivo não pode deixar dialog vazio na tela.
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !controlado) return;
    const aoCancelar = () => setOpen(false);
    el.addEventListener("cancel", aoCancelar);
    return () => el.removeEventListener("cancel", aoCancelar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlado]);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          const ok = f ? await aoEscolherArquivo(f) : false;
          if (inputRef.current) inputRef.current.value = "";
          if (!ok && controlado) setOpen(false);
        }}
      />
      {mostrarBotao && (
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={!fornecedor}
          onClick={() => inputRef.current?.click()}
        >
          <FileUp className="h-4 w-4 mr-1" />
          Importar XML
        </Button>
      )}

      <AlertDialog open={!!bloqueio} onOpenChange={(v) => !v && setBloqueio(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>XML de outro fornecedor</AlertDialogTitle>
            <AlertDialogDescription>
              Este XML é de {bloqueio?.emitente}, mas o fornecedor selecionado é {bloqueio?.forn}.
              Selecione o fornecedor correto antes de importar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setBloqueio(null)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open && linhas.length > 0} onOpenChange={(v) => (v ? setOpen(true) : fechar())}>
        <DialogContent className="max-w-[95vw] sm:max-w-[1200px]">
          <DialogHeader>
            <DialogTitle>Conferir itens da NF-e</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {semCnpj && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                Este fornecedor está sem CNPJ no cadastro. O XML é de {emitenteNome} — confira antes
                de importar.
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              NF-e nº {nota?.numero ?? "—"} — {emitenteNome} — emissão {fmtDataBR(nota?.emissao)} —{" "}
              {linhas.length} itens
            </div>
            <div className="text-xs tabular-nums">
              {qtdNovos} novos · {qtdExistentes} já cadastrados · {foraCompra} fora de compra
              (desmarcados)
            </div>
            {foraCompra > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                Itens de retorno, remessa ou industrialização vêm desmarcados. Marque manualmente se
                quiser cadastrá-los.
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => setLinhas((ls) => ls.map((l) => ({ ...l, marcado: true })))}
              >
                Marcar todos
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => setLinhas((ls) => ls.map((l) => ({ ...l, marcado: false })))}
              >
                Desmarcar todos
              </Button>
            </div>

            {semUnidade > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {semUnidade} linha(s) marcada(s) sem unidade. Preencha a unidade para continuar.
              </div>
            )}

            <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 space-y-1.5">
              <div className="text-[11px] text-muted-foreground">
                Preencher nas linhas marcadas:
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {[
                  {
                    campo: "unidade" as const,
                    rotulo: "Unidade",
                    valor: massaUnidade,
                    set: setMassaUnidade,
                    opcoes: unidades.map((u) => ({ v: u, label: u })),
                  },
                  {
                    campo: "departamento" as const,
                    rotulo: "Departamento",
                    valor: massaDep,
                    set: setMassaDep,
                    opcoes: departamentos.filter((d) => d.ativo).map((d) => ({ v: d.nome, label: d.nome })),
                  },
                  {
                    campo: "grupo_id" as const,
                    rotulo: "Grupo",
                    valor: massaGrupo,
                    set: setMassaGrupo,
                    opcoes: grupos.filter((g) => g.ativo).map((g) => ({ v: g.id, label: g.nome })),
                  },
                ].map((c) => (
                  <div key={c.campo} className="flex items-center gap-1.5">
                    <Select value={c.valor} onValueChange={c.set}>
                      <SelectTrigger className="h-7 w-[150px] text-[11px]">
                        <SelectValue placeholder={c.rotulo} />
                      </SelectTrigger>
                      <SelectContent>
                        {c.opcoes.map((o) => (
                          <SelectItem
                            key={o.v}
                            value={o.v}
                            onClick={() => aplicarEmMassa(c.campo, o.v, true)}
                          >
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10.5px]"
                      disabled={!c.valor}
                      title="Sobrescreve o valor em todas as linhas marcadas que a importação pode alterar."
                      onClick={() => aplicarEmMassa(c.campo, c.valor, false)}
                    >
                      Aplicar em todas
                    </Button>
                  </div>
                ))}
              </div>
            </div>



            <div className={`${TABLE_WRAPPER_CLASS} max-h-[55vh] overflow-y-auto`} style={TABLE_FONT_STYLE}>
              <table className="w-full">
                <thead className="bg-muted/40 sticky top-0 z-10">
                  <tr>
                    <th className={TH_CLASS} />
                    <th className={TH_CLASS}>Status</th>
                    <th className={`${TH_CLASS} text-left`}>Cód. NF</th>
                    <th className={`${TH_CLASS} text-left`}>Descrição na nota</th>
                    <th className={`${TH_CLASS} text-left`}>Produto</th>
                    <th className={TH_CLASS}>Unidade</th>
                    <th className={TH_CLASS}>Departamento</th>
                    <th className={TH_CLASS}>Grupo</th>
                    <th className={TH_CLASS}>Qtd</th>
                    <th className={TH_CLASS} title="Preço de uma unidade, conforme o valor unitário da nota">
                      Preço unit.
                    </th>
                    <th className={TH_CLASS}>Preço atual</th>
                    <th className={TH_CLASS}>CFOP</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const atual = precoAtualDe(l);
                    const novoPreco = precoNum(l.preco);
                    const varPct = atual != null ? variacaoPercentual(atual, novoPreco) : null;
                    const nomeCad = l.produto_id
                      ? produtosDoFornecedor.find((p) => p.id === l.produto_id)?.nome ?? ""
                      : "";
                    return (
                      <tr
                        key={l.key}
                        className={`border-t border-border/50 ${
                          l.marcado && !l.unidade ? "ring-1 ring-inset ring-amber-400 bg-amber-50/40 dark:bg-amber-950/10" : ""
                        }`}
                      >
                        <td className={TD_CLASS}>
                          <Checkbox
                            checked={l.marcado}
                            onCheckedChange={(v) => atualizar(l.key, { marcado: v === true })}
                          />
                        </td>
                        <td className={TD_CLASS}>
                          {l.status === "novo" ? (
                            <Badge className={`${BADGE_SM_CLASS} bg-sky-100 text-sky-900`}>Novo</Badge>
                          ) : (
                            <Badge
                              className={`${BADGE_SM_CLASS} bg-amber-100 text-amber-900 gap-1`}
                              title={nomeCad}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Já existe
                            </Badge>
                          )}
                        </td>
                        <td className={`${TD_CLASS} text-left text-muted-foreground`}>{l.cProd}</td>
                        <td className={`${TD_CLASS} text-left max-w-[220px] truncate`} title={l.xProd}>
                          {l.xProd}
                          {l.linhasNota > 1 && (
                            <span className="text-muted-foreground"> ({l.linhasNota} linhas da nota)</span>
                          )}
                        </td>
                        <td className={`${TD_CLASS} text-left min-w-[200px]`}>
                          {l.status === "novo" ? (
                            <Input
                              value={l.nome}
                              onChange={(e) => atualizar(l.key, { nome: e.target.value })}
                              className="h-7 text-[11px]"
                            />
                          ) : trocando === l.key ? (
                            <Combobox
                              value={l.produto_id}
                              onChange={(v) => {
                                const pr = produtosDoFornecedor.find((p) => p.id === v) ?? null;
                                atualizar(l.key, {
                                  produto_id: v,
                                  status: "existe",
                                  unidade: pr?.unidade || l.unidade,
                                });
                                setTrocando(null);
                              }}
                              options={produtosDoFornecedor.map((p) => ({ value: p.id, label: p.nome }))}
                              className="h-7"
                            />
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="truncate" title={nomeCad}>{nomeCad}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1 text-[10px]"
                                onClick={() => setTrocando(l.key)}
                              >
                                trocar
                              </Button>
                            </div>
                          )}
                        </td>
                        <td className={TD_CLASS}>
                          <div className="flex items-center gap-1">
                            <Select
                              value={l.unidade}
                              onValueChange={(v) => atualizar(l.key, { unidade: v })}
                            >
                              <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                {unidades.map((u) => (
                                  <SelectItem key={u} value={u}>{u}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!l.unidade && l.uCom && (
                              <Badge
                                variant="secondary"
                                className={BADGE_SM_CLASS}
                                title="Sigla da unidade conforme a nota"
                              >
                                {l.uCom}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className={TD_CLASS}>
                          <Select
                            value={l.departamento || "__none"}
                            onValueChange={(v) => atualizar(l.key, { departamento: v === "__none" ? "" : v })}
                            disabled={l.status === "existe"}
                          >
                            <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">—</SelectItem>
                              {departamentos.filter((d) => d.ativo).map((d) => (
                                <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className={TD_CLASS}>
                          <Select
                            value={l.grupo_id || "__none"}
                            onValueChange={(v) => atualizar(l.key, { grupo_id: v === "__none" ? "" : v })}
                            disabled={l.status === "existe"}
                          >
                            <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">—</SelectItem>
                              {grupos.filter((g) => g.ativo).map((g) => (
                                <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className={`${TD_CLASS} tabular-nums`}>
                          {l.qtd}
                          {l.qtd > 1 && (
                            <div className="text-[10px] text-muted-foreground">
                              {l.qtd} × {fmtBR2(novoPreco)} = {fmtBR2(l.qtd * novoPreco)}
                            </div>
                          )}
                        </td>
                        <td className={TD_CLASS}>
                          <Input
                            value={l.preco}
                            onChange={(e) => atualizar(l.key, { preco: e.target.value })}
                            onBlur={() => atualizar(l.key, { preco: fmtBR2(precoNum(l.preco)) })}
                            onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                            className="h-7 w-24 text-[11px] tabular-nums text-right"
                            inputMode="decimal"
                          />
                        </td>
                        <td className={`${TD_CLASS} tabular-nums`}>
                          {atual == null ? (
                            "—"
                          ) : (
                            <span>
                              {fmtMoeda(atual)}
                              {varPct != null && (
                                <span className={varPct < 0 ? "text-emerald-600 ml-1" : "text-rose-600 ml-1"}>
                                  {varPct > 0 ? "+" : ""}
                                  {varPct.toFixed(1)}%
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className={TD_CLASS}>
                          {l.cfop}
                          {!cfopEhCompra(l.cfop) && (
                            <Badge variant="secondary" className={`${BADGE_SM_CLASS} ml-1`}>
                              {rotuloCfop(l.cfop)}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={fechar}>Cancelar</Button>
            <Button
              disabled={marcados.length === 0 || semUnidade > 0 || salvando}
              title={semUnidade > 0 ? "Preencha a unidade das linhas marcadas" : undefined}
              onClick={() => setConfirmar(true)}
            >
              {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Importar selecionados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar importação</AlertDialogTitle>
            <AlertDialogDescription>
              Serão cadastrados {qtdNovos} produtos novos e atualizados até {qtdExistentes} preços.
              Confirma?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void importar()}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
