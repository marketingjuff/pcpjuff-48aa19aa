import { useMemo, useRef, useState } from "react";
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

export function ImportarXmlProdutosDialog({
  fornecedor, produtos, vinculos, departamentos, grupos, unidades, onImportado,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [nota, setNota] = useState<NFeNota | null>(null);
  const [emitenteNome, setEmitenteNome] = useState("");
  const [semCnpj, setSemCnpj] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [bloqueio, setBloqueio] = useState<{ emitente: string; forn: string } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [trocando, setTrocando] = useState<string | null>(null);

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
        departamento: "",
        grupo_id: "",
        preco: String(item.vUnCom),
        status: prod ? "existe" : "novo",
        produto_id: prod?.id ?? null,
      };
    });
  }

  async function aoEscolherArquivo(file: File) {
    if (!fornecedor) return;
    let parsed: NFeParsed;
    try {
      parsed = parseNFe(await file.text());
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível ler o XML.");
      return;
    }
    const docForn = soDigitos(fornecedor.documento);
    const cnpjEmit = parsed.emitente.cnpj;
    if (docForn && cnpjEmit && docForn !== cnpjEmit) {
      setBloqueio({
        emitente: parsed.emitente.razao_social,
        forn: fornecedor.nome_fantasia || fornecedor.razao_social,
      });
      return;
    }
    setSemCnpj(!docForn);
    setEmitenteNome(parsed.emitente.razao_social);
    setNota(parsed.nota);
    setLinhas(montarLinhas(parsed));
    setOpen(true);
  }

  const atualizar = (key: string, patch: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const marcados = linhas.filter((l) => l.marcado);
  const qtdNovos = marcados.filter((l) => l.status === "novo").length;
  const qtdExistentes = marcados.filter((l) => l.status === "existe").length;
  const foraCompra = linhas.filter((l) => !cfopEhCompra(l.cfop)).length;

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

            const preco = n(l.preco.replace(",", "."));
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
            const novoPreco = n(l.preco.replace(",", "."));
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

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await aoEscolherArquivo(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
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

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : fechar())}>
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
                    <th className={TH_CLASS}>Preço NF</th>
                    <th className={TH_CLASS}>Preço atual</th>
                    <th className={TH_CLASS}>CFOP</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const atual = precoAtualDe(l);
                    const novoPreco = n(l.preco.replace(",", "."));
                    const varPct = atual != null ? variacaoPercentual(atual, novoPreco) : null;
                    const nomeCad = l.produto_id
                      ? produtosDoFornecedor.find((p) => p.id === l.produto_id)?.nome ?? ""
                      : "";
                    return (
                      <tr key={l.key} className="border-t border-border/50">
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
                        <td className={`${TD_CLASS} tabular-nums`}>{l.qtd}</td>
                        <td className={TD_CLASS}>
                          <Input
                            value={l.preco}
                            onChange={(e) => atualizar(l.key, { preco: e.target.value })}
                            className="h-7 w-20 text-[11px] tabular-nums"
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
            <Button disabled={marcados.length === 0 || salvando} onClick={() => setConfirmar(true)}>
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
