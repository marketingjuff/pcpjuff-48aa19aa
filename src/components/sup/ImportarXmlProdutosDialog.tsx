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
  agruparNotaIndustrializacao, cfopEhCompra, mapearUnidadeNFe, normalizarNome, notaEhIndustrializacao,
  numeroCorDeCodigo, parseNFe, rotuloCfop, soDigitos,
  type NFeItem, type NFeNota, type NFeParsed, type NotaIndustrializacao,
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

/** Uma linha da tabela do modo industrialização = um produto próprio do fornecedor. */
type IndProduto = {
  key: string;
  tipo: "tingimento" | "maoobra";
  numeroCor: string;
  corNome: string;
  nome: string;
  codFornecedor: string;
  qtd: number;
  marcado: boolean;
  unidade: string;
  departamento: string;
  grupo_id: string;
  preco: string;
};


/** 1113.1 → "1.113,10" (formato brasileiro, 2 casas). */
function fmtBR2(v: number): string {
  return n(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 4,4819 → "4,4819" (até 4 casas, formato brasileiro). */
function fmtBR4(v: number): string {
  return n(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
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
  const [ind, setInd] = useState<NotaIndustrializacao | null>(null);
  const [indProdutos, setIndProdutos] = useState<IndProduto[]>([]);
  const [falhas, setFalhas] = useState<{ produto: string; erro: string }[]>([]);
  const [nadaGravado, setNadaGravado] = useState(false);
  const [verRetorno, setVerRetorno] = useState(false);


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

  /** Duas linhas por cor: tingimento e mão de obra. Cada uma é um produto próprio. */
  function montarIndProdutos(g: NotaIndustrializacao): IndProduto[] {
    const out: IndProduto[] = [];
    for (const c of g.cores) {
      const uni = mapearUnidadeNFe(c.uCom, unidades);
      const base = {
        numeroCor: c.numero,
        corNome: c.nome,
        marcado: true,
        unidade: uni,
        departamento: "",
        grupo_id: "",
      };
      out.push({
        ...base,
        key: `ting-${c.numero}`,
        tipo: "tingimento",
        nome: `Tingimento ${c.nome} ${c.numero}`.trim(),
        codFornecedor: c.codTingimento || "",
        qtd: c.qtdTingimento,
        preco: fmtBR4(c.precoTingimento),
      });
      if (c.precoMaoObra != null) {
        out.push({
          ...base,
          key: `mo-${c.numero}`,
          tipo: "maoobra",
          nome: `Mão de obra ${c.nome} ${c.numero}`.trim(),
          codFornecedor: c.codMaoObra || "",
          qtd: c.qtdMaoObra,
          preco: fmtBR4(c.precoMaoObra),
        });
      }
    }
    return out.map((p) => {
      const prod = produtosDoFornecedor.find((x) => normalizarNome(x.nome) === normalizarNome(p.nome)) ?? null;
      return {
        ...p,
        unidade: prod?.unidade || p.unidade,
        departamento: prod?.departamento ?? "",
        grupo_id: prod?.grupo_id ?? "",
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
    if (notaEhIndustrializacao(parsed.itens)) {
      const g = agruparNotaIndustrializacao(parsed.itens);
      setInd(g);
      setIndProdutos(montarIndProdutos(g));
      setFalhas([]);
      setNadaGravado(false);
      setLinhas([]);
    } else {
      setInd(null);
      setIndProdutos([]);
      setLinhas(montarLinhas(parsed));
    }

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
            // Só preenche campo vago do cadastro — nunca sobrescreve.
            const patch: Record<string, string> = {};
            if (l.departamento && podeDefinir(l, "departamento")) patch.departamento = l.departamento;
            if (l.grupo_id && podeDefinir(l, "grupo_id")) patch.grupo_id = l.grupo_id;
            if (Object.keys(patch).length > 0 && l.produto_id) {
              const { error } = await (supabase as any)
                .from("sup_produtos")
                .update(patch)
                .eq("id", l.produto_id);
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

  // ── Modo industrialização ────────────────────────────────────────────────
  const indMarcados = indProdutos.filter((p) => p.marcado);
  const indSemUnidade = indMarcados.some((p) => !p.unidade);

  const atualizarInd = (key: string, patch: Partial<IndProduto>) =>
    setIndProdutos((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  /** Casa a linha proposta com o cadastro do fornecedor. */
  function indCasar(p: IndProduto): { produto: SupProduto | null; vinculo: SupFornecedorProduto | null } {
    let prod: SupProduto | null = null;
    if (p.tipo === "tingimento" && p.numeroCor) {
      const v = vinculos.find(
        (x) =>
          x.fornecedor_id === fornecedor?.id &&
          numeroCorDeCodigo(String(x.cod_fornecedor ?? "")) === p.numeroCor,
      );
      if (v) prod = produtosDoFornecedor.find((x) => x.id === v.produto_id) ?? null;
    }
    if (!prod) {
      const alvo = normalizarNome(p.nome);
      prod = produtosDoFornecedor.find((x) => normalizarNome(x.nome) === alvo) ?? null;
    }
    const vinc = prod ? vinculoDoProduto(prod.id) : null;
    return { produto: prod, vinculo: vinc };
  }

  /** Preencher campo vago ≠ sobrescrever. */
  function indPodeDefinir(p: IndProduto, campo: "unidade" | "departamento" | "grupo_id"): boolean {
    if (campo === "unidade") return true;
    const prod = indCasar(p).produto;
    if (!prod) return true;
    return campo === "departamento" ? !prod.departamento : !prod.grupo_id;
  }

  function aplicarEmMassaInd(campo: "unidade" | "departamento" | "grupo_id", valor: string, soVazias: boolean) {
    if (!valor) return;
    const marcadasAgora = indProdutos.filter((p) => p.marcado);
    const elegiveis = marcadasAgora.filter((p) => indPodeDefinir(p, campo));
    const bloqueadas = marcadasAgora.length - elegiveis.length;
    const alvos = soVazias ? elegiveis.filter((p) => !p[campo]) : elegiveis;
    if (alvos.length > 0) {
      const chaves = new Set(alvos.map((p) => p.key));
      setIndProdutos((ps) => ps.map((p) => (chaves.has(p.key) ? { ...p, [campo]: valor } : p)));
      const extra = bloqueadas > 0 ? ` ${bloqueadas} ignorada(s): já definido no cadastro.` : "";
      toast.success(`Preenchido em ${alvos.length} linha(s).${extra}`);
      return;
    }
    if (marcadasAgora.length === 0) toast.warning("Nenhuma linha marcada.");
    else toast.warning(`As linhas marcadas já têm ${LABEL_CAMPO[campo]} definido.`);
  }

  async function importarIndustrializacao() {
    if (!fornecedor || !nota || !ind) {
      setFalhas([{
        produto: "Importação",
        erro: !fornecedor ? "Selecione o fornecedor antes de importar." : "Nota inválida para importação.",
      }]);
      setNadaGravado(true);
      setConfirmar(false);
      return;
    }
    setSalvando(true);
    setFalhas([]);
    setNadaGravado(false);
    const motivo = `Importação XML NF-e nº ${nota.numero ?? "—"} (industrialização)`;
    const novasFalhas: { produto: string; erro: string }[] = [];
    let criados = 0;
    let precos = 0;
    try {
      const marcadas = indProdutos.filter((p) => p.marcado);
      if (marcadas.length === 0) {
        novasFalhas.push({ produto: "Importação", erro: "Nenhuma linha marcada." });
        return;
      }
      const { data: u } = await supabase.auth.getUser();
      for (const p of marcadas) {
        try {
          if (!p.nome.trim()) throw new Error("nome vazio");
          if (!p.unidade) throw new Error("unidade não informada");
          const preco = precoNum(p.preco);
          const { produto, vinculo } = indCasar(p);
          let produtoId = produto?.id ?? null;

          if (!produtoId) {
            const { data, error } = await (supabase as any)
              .from("sup_produtos")
              .insert({
                nome: p.nome.trim(),
                unidade: p.unidade,
                departamento: p.departamento || null,
                grupo_id: p.grupo_id || null,
                ativo: true,
                fornecedor_id: fornecedor.id,
                preco_por_variacao: false,
                variacao_1_id: null,
                created_by: u.user?.id ?? null,
              })
              .select("id")
              .single();
            if (error) throw error;
            produtoId = data.id as string;
            criados += 1;
          } else {
            const patch: Record<string, string> = {};
            if (!produto?.unidade && p.unidade) patch.unidade = p.unidade;
            if (p.departamento && !produto?.departamento) patch.departamento = p.departamento;
            if (p.grupo_id && !produto?.grupo_id) patch.grupo_id = p.grupo_id;
            if (Object.keys(patch).length > 0) {
              const { error } = await (supabase as any)
                .from("sup_produtos").update(patch).eq("id", produtoId);
              if (error) throw error;
            }
          }

          let vincId = vinculo?.id ?? null;
          let precoAtual = n(vinculo?.preco_tabela);
          if (!vincId) {
            const { data, error } = await (supabase as any)
              .from("sup_fornecedor_produtos")
              .insert({
                fornecedor_id: fornecedor.id,
                produto_id: produtoId,
                cod_fornecedor: p.codFornecedor || null,
              })
              .select("id")
              .single();
            if (error) throw error;
            vincId = data.id as string;
            precoAtual = 0;
          } else if (p.codFornecedor && vinculo?.cod_fornecedor !== p.codFornecedor) {
            const { error } = await (supabase as any)
              .from("sup_fornecedor_produtos")
              .update({ cod_fornecedor: p.codFornecedor })
              .eq("id", vincId);
            if (error) throw error;
          }

          if (preco > 0 && preco !== precoAtual) {
            await aplicarPrecoTabela({
              fornecedor_produto_id: vincId!,
              preco_anterior: precoAtual > 0 ? precoAtual : null,
              preco_novo: preco,
              motivo,
            });
            precos += 1;
          }
        } catch (e: any) {
          console.error("[XML industrialização]", p.nome, e);
          novasFalhas.push({ produto: p.nome, erro: e?.message || e?.details || "erro ao gravar" });
        }
      }
    } catch (e: any) {
      console.error("[XML industrialização] falha:", e);
      novasFalhas.push({ produto: "Importação", erro: e?.message || "erro inesperado" });
    } finally {
      setSalvando(false);
      setConfirmar(false);
      setFalhas(novasFalhas);
      setNadaGravado(criados === 0 && precos === 0);
      if (criados > 0 || precos > 0) {
        toast.success(`${criados} produtos cadastrados · ${precos} preços atualizados`);
        onImportado();
      }
      if (novasFalhas.length === 0 && (criados > 0 || precos > 0)) fechar();
    }
  }

  function fechar() {
    setOpen(false);
    setLinhas([]);
    setInd(null);
    setIndProdutos([]);
    setFalhas([]);
    setNadaGravado(false);
    setVerRetorno(false);
    setNota(null);
    if (inputRef.current) inputRef.current.value = "";
  }


  useEffect(() => {
    if (!controlado || !open) return;
    if (linhas.length > 0 || ind) return;
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
          type="button"
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

      <Dialog open={open && (linhas.length > 0 || !!ind)} onOpenChange={(v) => (v ? setOpen(true) : fechar())}>
        <DialogContent className="max-w-[95vw] sm:max-w-[1200px]">
          <DialogHeader>
            <DialogTitle>Conferir itens da NF-e</DialogTitle>
          </DialogHeader>

          {ind && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Nota de industrialização detectada. Cada cor gera dois produtos próprios
                  (tingimento e mão de obra). As linhas de retorno (CFOP 5925) são material do
                  cliente e não entram no cadastro.
                </span>
              </div>

              <div className="text-xs text-muted-foreground">
                NF-e nº {nota?.numero ?? "—"} — {emitenteNome} — emissão {fmtDataBR(nota?.emissao)} —{" "}
                {ind.cores.length} cor(es) · {indProdutos.length} produto(s)
              </div>

              {falhas.length > 0 && (
                <div className="rounded-md border border-rose-400 bg-rose-50 dark:bg-rose-950/20 px-3 py-2 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <strong>
                      {nadaGravado ? "Nenhum produto foi cadastrado." : "Algumas linhas falharam."}
                    </strong>
                    <button type="button" className="underline" onClick={() => setFalhas([])}>
                      fechar
                    </button>
                  </div>
                  {falhas.map((f, i) => (
                    <div key={`${f.produto}-${i}`}>
                      {f.produto}: {f.erro}
                    </div>
                  ))}
                </div>
              )}

              {ind.naoIdentificados.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                  {ind.naoIdentificados.length} linha(s) não foram associadas a uma cor e não serão
                  importadas: {ind.naoIdentificados.map((i) => i.xProd).join(", ")}
                </div>
              )}

              {indSemUnidade && (
                <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Há linha(s) marcada(s) sem unidade. Preencha a unidade para continuar.
                </div>
              )}

              <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 space-y-1.5">
                <div className="text-[11px] text-muted-foreground">Preencher nas linhas marcadas:</div>
                <div className="flex flex-wrap items-center gap-3">
                  {[
                    { campo: "unidade" as const, rotulo: "Unidade", valor: massaUnidade, set: setMassaUnidade, opcoes: unidades.map((u) => ({ v: u, label: u })) },
                    { campo: "departamento" as const, rotulo: "Departamento", valor: massaDep, set: setMassaDep, opcoes: departamentos.filter((d) => d.ativo).map((d) => ({ v: d.nome, label: d.nome })) },
                    { campo: "grupo_id" as const, rotulo: "Grupo", valor: massaGrupo, set: setMassaGrupo, opcoes: grupos.filter((g) => g.ativo).map((g) => ({ v: g.id, label: g.nome })) },
                  ].map((c) => (
                    <div key={c.campo} className="flex items-center gap-1.5">
                      <Select value={c.valor} onValueChange={(v) => { c.set(v); aplicarEmMassaInd(c.campo, v, true); }}>
                        <SelectTrigger className="h-7 w-[150px] text-[11px]">
                          <SelectValue placeholder={c.rotulo} />
                        </SelectTrigger>
                        <SelectContent>
                          {c.opcoes.map((o) => (
                            <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10.5px]"
                        disabled={!c.valor}
                        onClick={() => aplicarEmMassaInd(c.campo, c.valor, false)}
                      >
                        Aplicar em todas
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                <div className={TABLE_WRAPPER_CLASS} style={TABLE_FONT_STYLE}>
                  <table className="w-full">
                    <thead className="bg-muted/40 sticky top-0 z-10">
                      <tr>
                        <th className={TH_CLASS} />
                        <th className={TH_CLASS}>Status</th>
                        <th className={`${TH_CLASS} text-left`}>Produto</th>
                        <th className={`${TH_CLASS} text-left`}>Cód. fornecedor</th>
                        <th className={TH_CLASS}>Qtd</th>
                        <th className={TH_CLASS}>Unidade</th>
                        <th className={TH_CLASS}>Departamento</th>
                        <th className={TH_CLASS}>Grupo</th>
                        <th className={TH_CLASS}>Preço unit.</th>
                        <th className={TH_CLASS}>Preço atual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indProdutos.map((p) => {
                        const m = indCasar(p);
                        const atualNum = n(m.vinculo?.preco_tabela);
                        const atual = atualNum > 0 ? atualNum : null;
                        const varPct = atual != null ? variacaoPercentual(atual, precoNum(p.preco)) : null;
                        return (
                          <tr
                            key={p.key}
                            className={`border-t border-border/50 ${
                              p.marcado && !p.unidade ? "ring-1 ring-inset ring-amber-400 bg-amber-50/40 dark:bg-amber-950/10" : ""
                            }`}
                          >
                            <td className={TD_CLASS}>
                              <Checkbox
                                checked={p.marcado}
                                onCheckedChange={(v) => atualizarInd(p.key, { marcado: v === true })}
                              />
                            </td>
                            <td className={TD_CLASS}>
                              {m.produto ? (
                                <Badge className={`${BADGE_SM_CLASS} bg-amber-100 text-amber-900`}>Já existe</Badge>
                              ) : (
                                <Badge className={`${BADGE_SM_CLASS} bg-sky-100 text-sky-900`}>Novo</Badge>
                              )}
                            </td>
                            <td className={`${TD_CLASS} text-left min-w-[240px]`}>
                              <Input
                                value={p.nome}
                                onChange={(e) => atualizarInd(p.key, { nome: e.target.value })}
                                className="h-7 text-[11px]"
                              />
                            </td>
                            <td className={`${TD_CLASS} text-left text-muted-foreground`}>{p.codFornecedor || "—"}</td>
                            <td className={`${TD_CLASS} tabular-nums`}>{fmtBR2(p.qtd)}</td>
                            <td className={TD_CLASS}>
                              <Select value={p.unidade} onValueChange={(v) => atualizarInd(p.key, { unidade: v })}>
                                <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  {unidades.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td
                              className={TD_CLASS}
                              title={indPodeDefinir(p, "departamento") ? undefined : "Já definido no cadastro — a importação não altera."}
                            >
                              <Select
                                value={p.departamento || "__none"}
                                onValueChange={(v) => atualizarInd(p.key, { departamento: v === "__none" ? "" : v })}
                                disabled={!indPodeDefinir(p, "departamento")}
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
                            <td
                              className={TD_CLASS}
                              title={indPodeDefinir(p, "grupo_id") ? undefined : "Já definido no cadastro — a importação não altera."}
                            >
                              <Select
                                value={p.grupo_id || "__none"}
                                onValueChange={(v) => atualizarInd(p.key, { grupo_id: v === "__none" ? "" : v })}
                                disabled={!indPodeDefinir(p, "grupo_id")}
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
                            <td className={TD_CLASS}>
                              <Input
                                value={p.preco}
                                onChange={(e) => atualizarInd(p.key, { preco: e.target.value })}
                                onBlur={() => atualizarInd(p.key, { preco: fmtBR4(precoNum(p.preco)) })}
                                onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                                className="h-7 w-24 text-[11px] tabular-nums text-right"
                                inputMode="decimal"
                              />
                            </td>
                            <td className={`${TD_CLASS} tabular-nums`}>
                              {atual == null ? "—" : (
                                <span>
                                  {fmtMoeda(atual)}
                                  {varPct != null && (
                                    <span className={varPct < 0 ? "text-emerald-600 ml-1" : "text-rose-600 ml-1"}>
                                      {varPct > 0 ? "+" : ""}{varPct.toFixed(1)}%
                                    </span>
                                  )}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 space-y-1">
                  <div className="text-[10.5px] text-muted-foreground">Custo total por cor (só exibição)</div>
                  {ind.cores.map((c) => {
                    const ting = indProdutos.find((p) => p.tipo === "tingimento" && p.numeroCor === c.numero);
                    const mo = indProdutos.find((p) => p.tipo === "maoobra" && p.numeroCor === c.numero);
                    const uni = ting?.unidade || mo?.unidade || c.uCom;
                    const soma = precoNum(ting?.preco ?? "0") + precoNum(mo?.preco ?? "0");
                    return (
                      <div key={c.numero} className="text-[11px] tabular-nums">
                        {c.nome} — {fmtBR2(c.qtdTingimento)} {uni} —{" "}
                        {ting ? fmtBR4(precoNum(ting.preco)) : "—"}
                        {mo ? ` + ${fmtBR4(precoNum(mo.preco))}` : ""} = {fmtMoeda(soma)}/{uni}
                      </div>
                    );
                  })}
                </div>

                {ind.retorno.length > 0 && (
                  <div className="rounded-md border border-border/60 px-3 py-2 text-muted-foreground">
                    <button
                      type="button"
                      className="text-[11px] underline"
                      onClick={() => setVerRetorno((v) => !v)}
                    >
                      Retorno de industrialização (não entra no cadastro) — {ind.retorno.length} item(ns)
                    </button>
                    {verRetorno && (
                      <div className="mt-1 space-y-0.5">
                        {ind.retorno.map((i) => (
                          <div key={i.nItem} className="text-[11px] tabular-nums">
                            {i.cProd} — {i.xProd} — {fmtBR2(i.qCom)} {i.uCom} — CFOP {i.cfop}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}


          {!ind && (
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
                type="button"
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => setLinhas((ls) => ls.map((l) => ({ ...l, marcado: true })))}
              >
                Marcar todos
              </Button>
              <Button
                type="button"
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
                      type="button"
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
                                type="button"
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
                        <td
                          className={TD_CLASS}
                          title={podeDefinir(l, "departamento") ? undefined : "Já definido no cadastro — a importação não altera."}
                        >
                          <Select
                            value={l.departamento || "__none"}
                            onValueChange={(v) => atualizar(l.key, { departamento: v === "__none" ? "" : v })}
                            disabled={!podeDefinir(l, "departamento")}
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
                        <td
                          className={TD_CLASS}
                          title={podeDefinir(l, "grupo_id") ? undefined : "Já definido no cadastro — a importação não altera."}
                        >
                          <Select
                            value={l.grupo_id || "__none"}
                            onValueChange={(v) => atualizar(l.key, { grupo_id: v === "__none" ? "" : v })}
                            disabled={!podeDefinir(l, "grupo_id")}
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
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={fechar}>Cancelar</Button>
            <Button
              type="button"
              disabled={
                ind
                  ? indMarcados.length === 0 || indSemUnidade || salvando
                  : marcados.length === 0 || semUnidade > 0 || salvando
              }
              title={(ind ? indSemUnidade : semUnidade > 0) ? "Preencha a unidade das linhas marcadas" : undefined}
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
              {ind
                ? `Serão criados/atualizados ${indMarcados.length} produto(s) e seus preços por kg. Confirma?`
                : `Serão cadastrados ${qtdNovos} produtos novos e atualizados até ${qtdExistentes} preços. Confirma?`}

            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={(e) => {
                e.preventDefault();
                void (ind ? importarIndustrializacao() : importar());
              }}
            >
              Confirmar
            </AlertDialogAction>

          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
