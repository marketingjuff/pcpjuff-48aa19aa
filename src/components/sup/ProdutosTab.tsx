import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Copy, CopyPlus, Trash2, TrendingDown, TrendingUp, FilterX } from "lucide-react";
import { SortTh, useTableSort } from "@/components/shared/sortable";
import { TABLE_FONT_STYLE, TABLE_WRAPPER_CLASS, TH_CLASS, TD_CLASS, BADGE_SM_CLASS } from "@/components/shared/table-styles";
import { Combobox } from "@/components/shared/combobox";
import { useSupFornecedores } from "@/components/sup/FornecedoresTab";
import { FornecedorDialog } from "@/components/sup/FornecedorDialog";
import { ImportarXmlFornecedorButton } from "@/components/sup/ImportarXmlFornecedorButton";
import { ImportarXmlProdutosDialog } from "@/components/sup/ImportarXmlProdutosDialog";
import { useSupDepartamentos } from "@/components/sup/DepartamentosTab";
import { useAppList } from "@/lib/app-lists";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSupVariacoes, useSupVariacaoValores } from "@/components/sup/VariacoesConfig";
import {
  SUP_UNIDADES, chaveVariacao, fmtMoeda, n, rotuloVariacao, variacaoPercentual, precoPorUnidadeRef, precoVigente,
  type SupFornecedor, type SupFornecedorProduto, type SupPrecoHistorico, type SupProduto, type SupProdutoGrupo,
  type SupProdutoVariacaoPreco,
} from "@/lib/sup";


export function useSupProdutos() {
  return useQuery({
    queryKey: ["sup-produtos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sup_produtos").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as SupProduto[];
    },
  });
}

export function useSupFornecedorProdutos() {
  return useQuery({
    queryKey: ["sup-fornecedor-produtos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sup_fornecedor_produtos").select("*");
      if (error) throw error;
      return (data ?? []) as SupFornecedorProduto[];
    },
  });
}

/** Aplica preço novo: grava histórico (imutável) e atualiza o cadastro. */
export async function aplicarPrecoTabela(args: {
  fornecedor_produto_id: string;
  preco_anterior: number | null;
  preco_novo: number;
  motivo?: string | null;
  anexo_url?: string | null;
}) {
  const { fornecedor_produto_id, preco_anterior, preco_novo } = args;
  const anterior = preco_anterior == null || n(preco_anterior) === 0 ? null : n(preco_anterior);
  const direcao: "alta" | "baixa" | "inicial" =
    anterior == null ? "inicial" : preco_novo > anterior ? "alta" : "baixa";
  const status_revisao = direcao === "alta" ? "pendente" : "revisada";
  const { data: u } = await supabase.auth.getUser();

  const { data: hist, error: e1 } = await (supabase as any)
    .from("sup_preco_historico")
    .insert({
      fornecedor_produto_id,
      preco_anterior: anterior,
      preco_novo,
      direcao,
      tipo: "tabela",
      motivo: args.motivo || null,
      anexo_url: args.anexo_url || null,
      status_revisao,
      alterado_por: u.user?.id ?? null,
    })
    .select("id")
    .single();
  if (e1) throw e1;

  const { error: e2 } = await (supabase as any)
    .from("sup_fornecedor_produtos")
    .update({ preco_tabela: preco_novo })
    .eq("id", fornecedor_produto_id);
  if (e2) throw e2;
  return hist?.id as string | undefined;
}

/** Grupos de itens equivalentes (comparação entre fornecedores). */
export function useSupProdutoGrupos() {
  return useQuery({
    queryKey: ["sup-produto-grupos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sup_produto_grupos").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as SupProdutoGrupo[];
    },
  });
}

/** Aplica preço negociado: grava histórico (tipo negociado) e atualiza o cadastro. */
export async function aplicarPrecoNegociado(args: {
  fornecedor_produto_id: string;
  preco_anterior: number | null;
  preco_novo: number;
  motivo?: string | null;
  anexo_url?: string | null;
}) {
  const { fornecedor_produto_id, preco_anterior, preco_novo } = args;
  const anterior = preco_anterior == null || n(preco_anterior) === 0 ? null : n(preco_anterior);
  const direcao: "alta" | "baixa" | "inicial" =
    anterior == null ? "inicial" : preco_novo > anterior ? "alta" : "baixa";
  const status_revisao = direcao === "alta" ? "pendente" : "revisada";
  const { data: u } = await supabase.auth.getUser();

  const { data: hist, error: e1 } = await (supabase as any)
    .from("sup_preco_historico")
    .insert({
      fornecedor_produto_id,
      preco_anterior: anterior,
      preco_novo,
      direcao,
      tipo: "negociado",
      motivo: args.motivo || null,
      anexo_url: args.anexo_url || null,
      status_revisao,
      alterado_por: u.user?.id ?? null,
    })
    .select("id")
    .single();
  if (e1) throw e1;

  const { error: e2 } = await (supabase as any)
    .from("sup_fornecedor_produtos")
    .update({ preco_negociado: preco_novo })
    .eq("id", fornecedor_produto_id);
  if (e2) throw e2;
  return hist?.id as string | undefined;
}

/** Preços por combinação de variação (por vínculo fornecedor-produto). */
export function useSupVariacaoPrecos() {
  return useQuery({
    queryKey: ["sup-variacao-precos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sup_produto_variacao_precos").select("*");
      if (error) throw error;
      return (data ?? []) as SupProdutoVariacaoPreco[];
    },
  });
}

/** Irmã de aplicarPrecoTabela: grava histórico e atualiza a linha da combinação. */
export async function aplicarPrecoVariacaoTabela(args: {
  fornecedor_produto_id: string;
  variacao_preco_id: string;
  preco_anterior: number | null;
  preco_novo: number;
  motivo?: string | null;
  anexo_url?: string | null;
}) {
  const { fornecedor_produto_id, variacao_preco_id, preco_anterior, preco_novo } = args;
  const anterior = preco_anterior == null || n(preco_anterior) === 0 ? null : n(preco_anterior);
  const direcao: "alta" | "baixa" | "inicial" =
    anterior == null ? "inicial" : preco_novo > anterior ? "alta" : "baixa";
  const status_revisao = direcao === "alta" ? "pendente" : "revisada";
  const { data: u } = await supabase.auth.getUser();

  const { data: hist, error: e1 } = await (supabase as any)
    .from("sup_preco_historico")
    .insert({
      fornecedor_produto_id,
      variacao_preco_id,
      preco_anterior: anterior,
      preco_novo,
      direcao,
      tipo: "tabela",
      motivo: args.motivo || null,
      anexo_url: args.anexo_url || null,
      status_revisao,
      alterado_por: u.user?.id ?? null,
    })
    .select("id")
    .single();
  if (e1) throw e1;

  const { error: e2 } = await (supabase as any)
    .from("sup_produto_variacao_precos")
    .update({ preco_tabela: preco_novo })
    .eq("id", variacao_preco_id);
  if (e2) throw e2;
  return hist?.id as string | undefined;
}

/** Irmã de aplicarPrecoNegociado: grava histórico e atualiza a linha da combinação. */
export async function aplicarPrecoVariacaoNegociado(args: {
  fornecedor_produto_id: string;
  variacao_preco_id: string;
  preco_anterior: number | null;
  preco_novo: number;
  motivo?: string | null;
  anexo_url?: string | null;
}) {
  const { fornecedor_produto_id, variacao_preco_id, preco_anterior, preco_novo } = args;
  const anterior = preco_anterior == null || n(preco_anterior) === 0 ? null : n(preco_anterior);
  const direcao: "alta" | "baixa" | "inicial" =
    anterior == null ? "inicial" : preco_novo > anterior ? "alta" : "baixa";
  const status_revisao = direcao === "alta" ? "pendente" : "revisada";
  const { data: u } = await supabase.auth.getUser();

  const { data: hist, error: e1 } = await (supabase as any)
    .from("sup_preco_historico")
    .insert({
      fornecedor_produto_id,
      variacao_preco_id,
      preco_anterior: anterior,
      preco_novo,
      direcao,
      tipo: "negociado",
      motivo: args.motivo || null,
      anexo_url: args.anexo_url || null,
      status_revisao,
      alterado_por: u.user?.id ?? null,
    })
    .select("id")
    .single();
  if (e1) throw e1;

  const { error: e2 } = await (supabase as any)
    .from("sup_produto_variacao_precos")
    .update({ preco_negociado: preco_novo })
    .eq("id", variacao_preco_id);
  if (e2) throw e2;
  return hist?.id as string | undefined;
}



type ProdForm = {
  id?: string;
  nome: string;
  departamento: string;
  unidade: string;
  especificacao: string;
  ativo: boolean;
  preco: string;
  preco_negociado: string;
  grupo_id: string;
  fator_conversao: string;
  qtd_min: string;
  prazo: string;
  motivo: string;
  arquivo: File | null;
  variacao_1_id: string;
  variacao_2_id: string;
  preco_por_variacao: boolean;
};

const formVazio = (): ProdForm => ({
  nome: "", departamento: "", unidade: "unidade", especificacao: "", ativo: true,
  preco: "", preco_negociado: "", grupo_id: "", fator_conversao: "",
  qtd_min: "", prazo: "", motivo: "", arquivo: null,
  variacao_1_id: "", variacao_2_id: "", preco_por_variacao: false,
});


const norm = (s: string) => s.trim().toLowerCase();
const toNum = (s: string) => {
  const t = String(s ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const v = Number(t);
  if (!Number.isFinite(v)) throw new Error("Informe um valor numérico válido.");
  return v;
};

export function ProdutosTab() {
  const qc = useQueryClient();
  const { data: produtos = [], isLoading } = useSupProdutos();
  const { data: departamentos = [] } = useSupDepartamentos();
  const { data: fornecedores = [] } = useSupFornecedores();
  const { data: vinculos = [] } = useSupFornecedorProdutos();
  const { data: grupos = [] } = useSupProdutoGrupos();
  const { names: unidadesLista } = useAppList("sup_unidade");
  const unidades = unidadesLista.length ? unidadesLista : ([...SUP_UNIDADES] as string[]);


  const [buscaForn, setBuscaForn] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [fornId, setFornId] = useState<string | null>(null);
  const [fornDialogOpen, setFornDialogOpen] = useState(false);
  const [fornEdit, setFornEdit] = useState<SupFornecedor | null>(null);

  const [busca, setBusca] = useState("");
  const [filtroDepto, setFiltroDepto] = useState("todos");
  const [filtroSituacao, setFiltroSituacao] = useState("todos");
  const [selId, setSelId] = useState<string | null>(null);

  const [prodOpen, setProdOpen] = useState(false);
  const [form, setForm] = useState<ProdForm>(formVazio());
  const [precoOriginal, setPrecoOriginal] = useState<number | null>(null);
  const [negociadoOriginal, setNegociadoOriginal] = useState<number | null>(null);
  const [histTipo, setHistTipo] = useState("todos");
  const [histAnulados, setHistAnulados] = useState(false);

  const [grupoOpen, setGrupoOpen] = useState(false);
  const [grupoForm, setGrupoForm] = useState({ nome: "", categoria: "", unidade_referencia: "unidade" });

  const [copiarOpen, setCopiarOpen] = useState(false);
  const [copiarAlvo, setCopiarAlvo] = useState<SupProduto | null>(null);
  const [copiarDestino, setCopiarDestino] = useState("");

  const [excluirProd, setExcluirProd] = useState<SupProduto | null>(null);
  const [excluirForn, setExcluirForn] = useState<SupFornecedor | null>(null);

  const { data: variacoes = [] } = useSupVariacoes();
  const { data: variacaoValores = [] } = useSupVariacaoValores();
  const { data: variacaoPrecos = [] } = useSupVariacaoPrecos();

  const [combNovo, setCombNovo] = useState({ v1: "", v2: "", tabela: "", negociado: "" });
  const [confirmFlagOff, setConfirmFlagOff] = useState(false);
  const [confirmTroca, setConfirmTroca] = useState<{ campo: "variacao_1_id" | "variacao_2_id"; valor: string } | null>(null);


  const vinculoDoProduto = (produto_id: string) =>
    vinculos.find((v) => v.produto_id === produto_id) ?? null;

  const nomeVariacao = (id: string) => variacoes.find((v) => v.id === id)?.nome ?? "";
  const valoresDeVariacao = (id: string) =>
    variacaoValores.filter((v) => v.variacao_id === id && v.ativo);

  const vinculoForm = form.id ? vinculoDoProduto(form.id) : null;
  const combinacoesForm = vinculoForm
    ? variacaoPrecos.filter((c) => c.fornecedor_produto_id === vinculoForm.id && c.ativo)
    : [];

  const salvarCombinacao = useMutation({
    mutationFn: async () => {
      if (!vinculoForm) throw new Error("Salve o produto antes de cadastrar preços por variação.");
      const v1 = combNovo.v1.trim();
      if (!v1) throw new Error("Escolha o valor da primeira variação.");
      const v2 = form.variacao_2_id ? combNovo.v2.trim() : "";
      if (form.variacao_2_id && !v2) throw new Error("Escolha o valor da segunda variação.");
      if (combinacoesForm.some((c) => chaveVariacao(c.variacao_1_valor, c.variacao_2_valor) === chaveVariacao(v1, v2 || null))) {
        throw new Error("Esta combinação já está cadastrada.");
      }
      const tabela = toNum(combNovo.tabela);
      const negociado = toNum(combNovo.negociado);

      const { data, error } = await (supabase as any)
        .from("sup_produto_variacao_precos")
        .insert({
          fornecedor_produto_id: vinculoForm.id,
          variacao_1_valor: v1,
          variacao_2_valor: v2 || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (tabela != null) {
        await aplicarPrecoVariacaoTabela({
          fornecedor_produto_id: vinculoForm.id,
          variacao_preco_id: data.id,
          preco_anterior: null,
          preco_novo: tabela,
        });
      }
      if (negociado != null) {
        await aplicarPrecoVariacaoNegociado({
          fornecedor_produto_id: vinculoForm.id,
          variacao_preco_id: data.id,
          preco_anterior: null,
          preco_novo: negociado,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-variacao-precos"] });
      qc.invalidateQueries({ queryKey: ["sup-alteracoes-preco"] });
      setCombNovo({ v1: "", v2: "", tabela: "", negociado: "" });
      toast.success("Combinação salva.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar combinação."),
  });

  const atualizarCombinacao = useMutation({
    mutationFn: async (args: { comb: SupProdutoVariacaoPreco; campo: "tabela" | "negociado"; valor: string }) => {
      const novo = toNum(args.valor);
      if (novo == null) throw new Error("Informe um preço.");
      const anterior = args.campo === "tabela" ? args.comb.preco_tabela : args.comb.preco_negociado;
      if (n(anterior) === novo) return;
      const fn = args.campo === "tabela" ? aplicarPrecoVariacaoTabela : aplicarPrecoVariacaoNegociado;
      await fn({
        fornecedor_produto_id: args.comb.fornecedor_produto_id,
        variacao_preco_id: args.comb.id,
        preco_anterior: anterior,
        preco_novo: novo,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-variacao-precos"] });
      qc.invalidateQueries({ queryKey: ["sup-alteracoes-preco"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar preço."),
  });

  const inativarCombinacao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("sup_produto_variacao_precos")
        .update({ ativo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sup-variacao-precos"] }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao inativar combinação."),
  });



  const fornecedoresFiltrados = useMemo(() => {
    const b = norm(buscaForn);
    return fornecedores
      .filter((f) => (mostrarInativos ? true : f.ativo))
      .filter((f) => !b || [f.razao_social, f.nome_fantasia].some((v) => (v ?? "").toLowerCase().includes(b)))
      .slice()
      .sort((a, b2) => a.razao_social.localeCompare(b2.razao_social, "pt-BR"));
  }, [fornecedores, buscaForn, mostrarInativos]);

  useEffect(() => {
    if (!fornId) return;
    const f = fornecedores.find((x) => x.id === fornId);
    if (f && !f.ativo && !mostrarInativos) {
      setFornId(null);
      setSelId(null);
    }
  }, [fornecedores, fornId, mostrarInativos]);


  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of produtos) {
      if (!p.fornecedor_id || !p.ativo) continue;
      m.set(p.fornecedor_id, (m.get(p.fornecedor_id) ?? 0) + 1);
    }
    return m;
  }, [produtos]);

  const fornecedorSel = fornecedores.find((f) => f.id === fornId) ?? null;

  const topoRef = useRef<HTMLDivElement | null>(null);

  function selecionarFornecedor(id: string) {
    setFornId(id);
    setSelId(null);
    setTimeout(() => {
      topoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const {
    rows: fornecedoresOrdenados,
    sortKey: fornSortKey,
    sortDir: fornSortDir,
    toggle: fornToggle,
  } = useTableSort(fornecedoresFiltrados, {
    nome: (r) => r.nome_fantasia || r.razao_social,
    razao_social: (r) => r.razao_social,
    documento: (r) => r.documento ?? "",
    contato: (r) => r.contato_nome ?? "",
    telefone: (r) => r.contato_telefone ?? "",
    cidade: (r) => r.cidade ?? "",
    condicao: (r) => r.condicao_pagamento_padrao ?? "",
    produtos: (r) => contagem.get(r.id) ?? 0,
    ativo: (r) => (r.ativo ? 1 : 0),
  }, { key: "nome" });

  const baseProdutosForn = useMemo(
    () => (fornId ? produtos.filter((p) => p.fornecedor_id === fornId) : ([] as SupProduto[])),
    [produtos, fornId],
  );

  const deptoOpcoes = useMemo(() => {
    const s = new Set<string>();
    for (const p of baseProdutosForn) if (p.departamento) s.add(p.departamento);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [baseProdutosForn]);

  const filtrados = useMemo(() => {
    if (!fornId) return [] as SupProduto[];
    const b = norm(busca);
    return baseProdutosForn
      .filter((p) => !b || [p.nome, p.departamento, p.especificacao].some((v) => (v ?? "").toLowerCase().includes(b)))
      .filter((p) => filtroDepto === "todos" || (p.departamento ?? "") === filtroDepto)
      .filter((p) => filtroSituacao === "todos" || (filtroSituacao === "ativos" ? p.ativo : !p.ativo));
  }, [baseProdutosForn, fornId, busca, filtroDepto, filtroSituacao]);

  const { rows: ordenados, sortKey, sortDir, toggle } = useTableSort(filtrados, {
    nome: (r) => r.nome,
    departamento: (r) => r.departamento,
    unidade: (r) => r.unidade,
    preco: (r) => vinculoDoProduto(r.id)?.preco_tabela ?? -1,
    negociado: (r) => vinculoDoProduto(r.id)?.preco_negociado ?? -1,
    grupo: (r) => grupos.find((g) => g.id === r.grupo_id)?.nome ?? "",
    por_ref: (r) => precoPorUnidadeRef(precoVigente(vinculoDoProduto(r.id)), r.fator_conversao) ?? -1,
    qtd_min: (r) => vinculoDoProduto(r.id)?.quantidade_minima ?? -1,
    prazo: (r) => vinculoDoProduto(r.id)?.prazo_entrega_dias ?? -1,
    ativo: (r) => (r.ativo ? 1 : 0),
  }, { key: "nome" });

  const sel = produtos.find((p) => p.id === selId) ?? null;

  const { data: historico = [] } = useQuery({
    queryKey: ["sup-preco-historico", selId],
    enabled: !!selId,
    queryFn: async () => {
      const ids = vinculos.filter((v) => v.produto_id === selId).map((v) => v.id);
      if (ids.length === 0) return [] as SupPrecoHistorico[];
      const { data, error } = await (supabase as any)
        .from("sup_preco_historico")
        .select("*")
        .in("fornecedor_produto_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupPrecoHistorico[];
    },
  });

  const historicoFiltrado = useMemo(
    () =>
      historico
        .filter((h) => histTipo === "todos" || (h.tipo ?? "tabela") === histTipo)
        .filter((h) => (histAnulados ? true : !h.anulado)),
    [historico, histTipo, histAnulados],
  );


  function invalidarTudo() {
    qc.invalidateQueries({ queryKey: ["sup-produtos"] });
    qc.invalidateQueries({ queryKey: ["sup-fornecedor-produtos"] });
    qc.invalidateQueries({ queryKey: ["sup-preco-historico"] });
    qc.invalidateQueries({ queryKey: ["sup-alteracoes-preco"] });
  }

  function nomeDuplicado(nome: string, fornecedor_id: string, ignorarId?: string) {
    return produtos.some(
      (p) => p.fornecedor_id === fornecedor_id && p.id !== ignorarId && norm(p.nome) === norm(nome),
    );
  }

  const salvar = useMutation({
    mutationFn: async (f: ProdForm) => {
      if (!fornId) throw new Error("Selecione um fornecedor.");
      if (!f.nome.trim()) throw new Error("Informe o nome do produto.");
      if (nomeDuplicado(f.nome, fornId, f.id)) {
        throw new Error("__DUP__");
      }
      const preco = toNum(f.preco);
      const precoNeg = toNum(f.preco_negociado);
      const qtd_min = toNum(f.qtd_min);
      const prazoNum = toNum(f.prazo);
      const prazo = prazoNum == null ? null : Math.round(prazoNum);
      const fator = f.grupo_id ? toNum(f.fator_conversao) : null;
      if (f.grupo_id && (fator == null || fator <= 0)) {
        throw new Error("Informe um fator de conversão maior que zero para o grupo escolhido.");
      }

      const base = {
        nome: f.nome.trim(),
        departamento: f.departamento.trim() || null,
        unidade: f.unidade || "unidade",
        especificacao: f.especificacao.trim() || null,
        preco_referencia: preco,
        ativo: f.ativo,
        grupo_id: f.grupo_id || null,
        fator_conversao: fator,
        variacao_1_id: f.variacao_1_id || null,
        variacao_2_id: f.variacao_2_id || null,
        preco_por_variacao: f.variacao_1_id ? f.preco_por_variacao : false,
      };

      let anexo_url: string | null = null;
      if (f.arquivo) {
        const path = `precos/${f.id ?? "novo"}/${Date.now()}-${f.arquivo.name}`;
        const { error } = await supabase.storage.from("sup-anexos").upload(path, f.arquivo);
        if (error) throw error;
        anexo_url = path;
      }

      if (!f.id) {
        const { data: u } = await supabase.auth.getUser();
        const { data: prod, error: e1 } = await (supabase as any)
          .from("sup_produtos")
          .insert({ ...base, fornecedor_id: fornId, created_by: u.user?.id ?? null })
          .select("id")
          .single();
        if (e1) throw e1;

        const { data: vinc, error: e2 } = await (supabase as any)
          .from("sup_fornecedor_produtos")
          .insert({
            fornecedor_id: fornId,
            produto_id: prod.id,
            quantidade_minima: qtd_min,
            prazo_entrega_dias: prazo,
          })
          .select("id")
          .single();
        if (e2) throw e2;

        if (preco != null) {
          await aplicarPrecoTabela({
            fornecedor_produto_id: vinc.id,
            preco_anterior: null,
            preco_novo: preco,
            motivo: f.motivo || null,
            anexo_url,
          });
        }
        if (precoNeg != null) {
          await aplicarPrecoNegociado({
            fornecedor_produto_id: vinc.id,
            preco_anterior: null,
            preco_novo: precoNeg,
            motivo: f.motivo || null,
            anexo_url,
          });
        }
        return;
      }

      const { error: e1 } = await (supabase as any).from("sup_produtos").update(base).eq("id", f.id);
      if (e1) throw e1;

      // Combinações deixam de valer quando o preço por variação é desligado
      // ou quando os tipos de variação mudam. Nada é apagado: inativamos.
      const antes = produtos.find((p) => p.id === f.id);
      const trocouTipos =
        (antes?.variacao_1_id ?? null) !== (f.variacao_1_id || null) ||
        (antes?.variacao_2_id ?? null) !== (f.variacao_2_id || null);
      const desligou = !!antes?.preco_por_variacao && !base.preco_por_variacao;
      if (trocouTipos || desligou) {
        const vId = vinculoDoProduto(f.id)?.id ?? null;
        if (vId) {
          const { error } = await (supabase as any)
            .from("sup_produto_variacao_precos")
            .update({ ativo: false })
            .eq("fornecedor_produto_id", vId)
            .eq("ativo", true);
          if (error) throw error;
        }
      }


      let vinculo = vinculoDoProduto(f.id);
      let vinculoId = vinculo?.id ?? null;
      if (!vinculoId) {
        const { data, error } = await (supabase as any)
          .from("sup_fornecedor_produtos")
          .insert({ fornecedor_id: fornId, produto_id: f.id, quantidade_minima: qtd_min, prazo_entrega_dias: prazo })
          .select("id")
          .single();
        if (error) throw error;
        vinculoId = data.id as string;
        vinculo = null;
      } else {
        const { error } = await (supabase as any)
          .from("sup_fornecedor_produtos")
          .update({ quantidade_minima: qtd_min, prazo_entrega_dias: prazo })
          .eq("id", vinculoId);
        if (error) throw error;
      }

      const atual = vinculo?.preco_tabela ?? null;
      if (preco != null && n(atual) !== preco) {
        await aplicarPrecoTabela({
          fornecedor_produto_id: vinculoId!,
          preco_anterior: atual,
          preco_novo: preco,
          motivo: f.motivo || null,
          anexo_url,
        });
      }

      const atualNeg = vinculo?.preco_negociado ?? null;
      if (precoNeg != null && n(atualNeg) !== precoNeg) {
        await aplicarPrecoNegociado({
          fornecedor_produto_id: vinculoId!,
          preco_anterior: atualNeg,
          preco_novo: precoNeg,
          motivo: f.motivo || null,
          anexo_url,
        });
      }
      if (precoNeg == null && atualNeg != null) {
        const { error } = await (supabase as any)
          .from("sup_fornecedor_produtos")
          .update({ preco_negociado: null })
          .eq("id", vinculoId);
        if (error) throw error;
      }

    },
    onSuccess: () => {
      invalidarTudo();
      toast.success("Produto salvo.");
      setProdOpen(false);
    },
    onError: (e: any) =>
      toast.error(e.message === "__DUP__" ? "Este fornecedor já tem um produto com esse nome." : (e.message ?? "Erro ao salvar produto.")),
  });

  const copiar = useMutation({
    mutationFn: async () => {
      const p = copiarAlvo;
      if (!p) return;
      if (!copiarDestino) throw new Error("Escolha o fornecedor de destino.");
      if (nomeDuplicado(p.nome, copiarDestino)) throw new Error("__DUP__");

      const { data: u } = await supabase.auth.getUser();
      const { data: novo, error: e1 } = await (supabase as any)
        .from("sup_produtos")
        .insert({
          nome: p.nome,
          departamento: p.departamento,
          unidade: p.unidade,
          especificacao: p.especificacao,
          preco_referencia: null,
          ativo: true,
          grupo_id: p.grupo_id ?? null,
          fator_conversao: p.fator_conversao ?? null,
          variacao_1_id: p.variacao_1_id ?? null,
          variacao_2_id: p.variacao_2_id ?? null,
          preco_por_variacao: p.preco_por_variacao ?? false,
          fornecedor_id: copiarDestino,
          created_by: u.user?.id ?? null,
        })
        .select("id")
        .single();
      if (e1) throw e1;

      const { error: e2 } = await (supabase as any)
        .from("sup_fornecedor_produtos")
        .insert({ fornecedor_id: copiarDestino, produto_id: novo.id });
      if (e2) throw e2;

    },
    onSuccess: () => {
      invalidarTudo();
      toast.success("Produto copiado. Cadastre o preço deste fornecedor.");
      setCopiarOpen(false);
      setCopiarAlvo(null);
      setCopiarDestino("");
    },
    onError: (e: any) =>
      toast.error(e.message === "__DUP__" ? "Este fornecedor já tem um produto com esse nome." : (e.message ?? "Erro ao copiar produto.")),
  });

  /** Apaga produto: bloqueia se já foi usado em pedido; limpa histórico e vínculos antes. */
  async function apagarProdutos(ids: string[]) {
    if (ids.length === 0) return;
    const { data: usados, error: eU } = await (supabase as any)
      .from("sup_pedido_itens").select("produto_id").in("produto_id", ids).limit(1);
    if (eU) throw eU;
    if ((usados ?? []).length > 0) throw new Error("__EM_USO__");

    const { data: vs, error: eV } = await (supabase as any)
      .from("sup_fornecedor_produtos").select("id").in("produto_id", ids);
    if (eV) throw eV;
    const vIds = (vs ?? []).map((v: any) => v.id as string);
    if (vIds.length) {
      const { error: eH } = await (supabase as any)
        .from("sup_preco_historico").delete().in("fornecedor_produto_id", vIds);
      if (eH) throw eH;
      const { error: eFP } = await (supabase as any)
        .from("sup_fornecedor_produtos").delete().in("id", vIds);
      if (eFP) throw eFP;
    }
    const { error: eP } = await (supabase as any).from("sup_produtos").delete().in("id", ids);
    if (eP) throw eP;
  }

  const excluirProduto = useMutation({
    mutationFn: async () => {
      if (!excluirProd) return;
      await apagarProdutos([excluirProd.id]);
    },
    onSuccess: () => {
      invalidarTudo();
      if (selId === excluirProd?.id) setSelId(null);
      setExcluirProd(null);
      toast.success("Produto apagado.");
    },
    onError: (e: any) =>
      toast.error(
        e.message === "__EM_USO__"
          ? "Este produto já foi usado em pedido de compra. Inative-o em vez de apagar."
          : (e.message ?? "Erro ao apagar produto."),
      ),
  });

  const excluirFornecedor = useMutation({
    mutationFn: async () => {
      const f = excluirForn;
      if (!f) return;
      const { data: pcs, error: eP } = await (supabase as any)
        .from("sup_pedidos_compra").select("id").eq("fornecedor_id", f.id).limit(1);
      if (eP) throw eP;
      if ((pcs ?? []).length > 0) throw new Error("__PC__");

      const ids = produtos.filter((p) => p.fornecedor_id === f.id).map((p) => p.id);
      await apagarProdutos(ids);

      const { error } = await (supabase as any).from("sup_fornecedores").delete().eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarTudo();
      qc.invalidateQueries({ queryKey: ["sup-fornecedores"] });
      if (fornId === excluirForn?.id) { setFornId(null); setSelId(null); }
      setExcluirForn(null);
      toast.success("Fornecedor apagado.");
    },
    onError: (e: any) =>
      toast.error(
        e.message === "__PC__"
          ? "Este fornecedor tem pedidos de compra. Inative-o em vez de apagar."
          : e.message === "__EM_USO__"
            ? "Há produtos deste fornecedor usados em pedidos de compra. Inative o fornecedor em vez de apagar."
            : (e.message ?? "Erro ao apagar fornecedor."),
      ),
  });



  const criarGrupo = useMutation({
    mutationFn: async () => {
      if (!grupoForm.nome.trim()) throw new Error("Informe o nome do grupo.");
      const { data, error } = await (supabase as any)
        .from("sup_produto_grupos")
        .insert({
          nome: grupoForm.nome.trim(),
          categoria: grupoForm.categoria.trim() || null,
          unidade_referencia: grupoForm.unidade_referencia || "unidade",
          ativo: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["sup-produto-grupos"] });
      setForm((f) => ({ ...f, grupo_id: id, fator_conversao: f.fator_conversao || "1" }));
      setGrupoOpen(false);
      toast.success("Grupo criado.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar grupo."),
  });

  function abrirNovoGrupo() {
    setGrupoForm({ nome: "", categoria: "", unidade_referencia: "unidade" });
    setGrupoOpen(true);
  }

  function abrirNovo() {
    setForm(formVazio());
    setPrecoOriginal(null);
    setNegociadoOriginal(null);
    setProdOpen(true);
  }

  function abrirDuplicar(p: SupProduto) {
    const v = vinculoDoProduto(p.id);
    let nome = `${p.nome} (cópia)`;
    let i = 2;
    while (fornId && nomeDuplicado(nome, fornId)) {
      nome = `${p.nome} (cópia ${i++})`;
    }
    setForm({
      id: undefined,
      nome,
      departamento: p.departamento ?? "",
      unidade: p.unidade,
      especificacao: p.especificacao ?? "",
      ativo: p.ativo,
      preco: v?.preco_tabela == null ? "" : String(v.preco_tabela),
      preco_negociado: v?.preco_negociado == null ? "" : String(v.preco_negociado),
      grupo_id: p.grupo_id ?? "",
      fator_conversao: p.fator_conversao == null ? "" : String(p.fator_conversao),
      qtd_min: v?.quantidade_minima == null ? "" : String(v.quantidade_minima),
      prazo: v?.prazo_entrega_dias == null ? "" : String(v.prazo_entrega_dias),
      motivo: "",
      arquivo: null,
      variacao_1_id: p.variacao_1_id ?? "",
      variacao_2_id: p.variacao_2_id ?? "",
      preco_por_variacao: !!p.preco_por_variacao,
    });
    setPrecoOriginal(null);
    setNegociadoOriginal(null);
    setProdOpen(true);
  }


  function abrirEdicao(p: SupProduto) {
    const v = vinculoDoProduto(p.id);
    const preco = v?.preco_tabela ?? null;
    const neg = v?.preco_negociado ?? null;
    setForm({
      id: p.id,
      nome: p.nome,
      departamento: p.departamento ?? "",
      unidade: p.unidade,
      especificacao: p.especificacao ?? "",
      ativo: p.ativo,
      preco: preco == null ? "" : String(preco),
      preco_negociado: neg == null ? "" : String(neg),
      grupo_id: p.grupo_id ?? "",
      fator_conversao: p.fator_conversao == null ? "" : String(p.fator_conversao),
      qtd_min: v?.quantidade_minima == null ? "" : String(v.quantidade_minima),
      prazo: v?.prazo_entrega_dias == null ? "" : String(v.prazo_entrega_dias),
      motivo: "",
      arquivo: null,
      variacao_1_id: p.variacao_1_id ?? "",
      variacao_2_id: p.variacao_2_id ?? "",
      preco_por_variacao: !!p.preco_por_variacao,
    });
    setPrecoOriginal(preco);
    setNegociadoOriginal(neg);
    setProdOpen(true);
  }

  const precoMudou = useMemo(() => {
    if (!form.id) return false;
    const val = (s: string) => {
      const t = s.trim().replace(",", ".");
      return t === "" ? null : Number(t);
    };
    return n(val(form.preco)) !== n(precoOriginal) || n(val(form.preco_negociado)) !== n(negociadoOriginal);
  }, [form.preco, form.preco_negociado, form.id, precoOriginal, negociadoOriginal]);

  const precoRefTexto = useMemo(() => {
    const grupo = grupos.find((g) => g.id === form.grupo_id) ?? null;
    if (!grupo) return null;
    const vig = precoVigente({
      preco_tabela: form.preco.trim().replace(",", "."),
      preco_negociado: form.preco_negociado.trim().replace(",", "."),
    });
    const porRef = precoPorUnidadeRef(vig, form.fator_conversao.trim().replace(",", "."));
    if (porRef == null) return `Grupo ${grupo.nome} — informe preço e fator para comparar por ${grupo.unidade_referencia}.`;
    return `Equivale a ${fmtMoeda(porRef)} por ${grupo.unidade_referencia} (${grupo.nome}).`;
  }, [grupos, form.grupo_id, form.preco, form.preco_negociado, form.fator_conversao]);


  return (
    <div className="space-y-3" ref={topoRef}>
      <Card className="border-primary/30">
        <CardContent className="py-2 flex items-center justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Fornecedor</div>
            <div className="text-2xl sm:text-4xl font-bold truncate">
              {fornecedorSel ? (fornecedorSel.nome_fantasia || fornecedorSel.razao_social) : "—"}
            </div>
            {fornecedorSel && (
              <div className="text-xs text-muted-foreground tabular-nums">
                {contagem.get(fornecedorSel.id) ?? 0} produto(s) ativo(s)
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => { setFornEdit(null); setFornDialogOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo fornecedor
            </Button>
            {fornecedorSel && (
              <Button size="sm" variant="outline" onClick={() => { setFornEdit(fornecedorSel); setFornDialogOpen(true); }}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar fornecedor
              </Button>
            )}
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" disabled={!fornId} onClick={abrirNovo}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo produto
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
        <Card className="border-l-4 border-l-teal-500 bg-teal-50/40 dark:bg-teal-950/10">
          <CardHeader className="py-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base text-teal-700 dark:text-teal-400">Dados do fornecedor</CardTitle>
              {fornecedorSel && (
                <Button
                  size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                  onClick={() => { setFornEdit(fornecedorSel); setFornDialogOpen(true); }}
                >
                  <Pencil className="h-3 w-3 mr-1" /> Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {fornecedorSel ? (
              <div className="rounded-lg border border-teal-200 dark:border-teal-900 bg-card/70 p-2.5 space-y-2">

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <div className="min-w-0 col-span-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Razão social</div>
                    <div className="text-[12px] font-medium truncate">{fornecedorSel.razao_social || "—"}</div>
                  </div>
                  <div className="min-w-0 col-span-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Nome fantasia</div>
                    <div className="text-[12px] font-medium truncate">{fornecedorSel.nome_fantasia || "—"}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">CNPJ / Doc.</div>
                    <div className="text-[12px] font-medium truncate">{fornecedorSel.documento || "—"}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Situação</div>
                    <div className="text-[12px] font-medium truncate">
                      <span className={`rounded font-semibold ${BADGE_SM_CLASS} ${
                        fornecedorSel.ativo
                          ? "bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-200"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {fornecedorSel.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Contato</div>
                    <div className="text-[12px] font-medium truncate">{fornecedorSel.contato_nome || "—"}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Telefone</div>
                    <div className="text-[12px] font-medium truncate">
                      {fornecedorSel.contato_telefone
                        ? <a href={`tel:${fornecedorSel.contato_telefone}`} className="hover:underline">{fornecedorSel.contato_telefone}</a>
                        : "—"}
                    </div>
                  </div>
                  <div className="min-w-0 col-span-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">E-mail</div>
                    <div className="text-[12px] font-medium truncate">
                      {fornecedorSel.contato_email
                        ? <a href={`mailto:${fornecedorSel.contato_email}`} className="hover:underline truncate">{fornecedorSel.contato_email}</a>
                        : "—"}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Cidade / UF</div>
                    <div className="text-[12px] font-medium truncate">
                      {fornecedorSel.cidade
                        ? `${fornecedorSel.cidade}${fornecedorSel.uf ? ` — ${fornecedorSel.uf}` : ""}`
                        : (fornecedorSel.uf || "—")}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Condição de pagamento</div>
                    <div className="text-[12px] font-medium truncate">{fornecedorSel.condicao_pagamento_padrao || "—"}</div>
                  </div>
                  {fornecedorSel.observacoes && (
                    <div className="min-w-0 col-span-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Observações</div>
                      <div className="whitespace-pre-wrap text-[11.5px] font-normal text-muted-foreground max-h-24 overflow-auto">
                        {fornecedorSel.observacoes}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Selecione um fornecedor na lista abaixo.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500 bg-violet-50/40 dark:bg-violet-950/10">
          <CardHeader className="py-2">
            <div className="flex items-baseline justify-between gap-2">
              <CardTitle className="text-base text-violet-700 dark:text-violet-400">
                {fornecedorSel ? `Produtos — ${fornecedorSel.nome_fantasia || fornecedorSel.razao_social}` : "Produtos"}
              </CardTitle>
              <span className="text-xs text-muted-foreground tabular-nums">
                {ordenados.length} {ordenados.length === 1 ? "registro" : "registros"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground font-medium">Buscar</Label>
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, departamento, especificação…" className="h-8" disabled={!fornId} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground font-medium">Departamento</Label>
                <Select value={filtroDepto} onValueChange={setFiltroDepto}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos departamentos</SelectItem>
                    {deptoOpcoes.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground font-medium">Situação</Label>
                <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="ativos">Somente ativos</SelectItem>
                    <SelectItem value="inativos">Somente inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5 flex flex-col justify-end">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => { setBusca(""); setFiltroDepto("todos"); setFiltroSituacao("todos"); }}
                  >
                    <FilterX className="h-3.5 w-3.5 mr-1" /> Limpar Filtros
                  </Button>
                  <ImportarXmlProdutosDialog
                    fornecedor={fornecedorSel}
                    produtos={produtos}
                    vinculos={vinculos}
                    departamentos={departamentos}
                    grupos={grupos}
                    unidades={unidades}
                    onImportado={invalidarTudo}
                  />
                </div>
              </div>

            </div>

            <div className={`${TABLE_WRAPPER_CLASS} max-h-[60vh] overflow-y-auto`} style={TABLE_FONT_STYLE}>
              <table className="w-full">
                <thead className="bg-muted/40 sticky top-0 z-10">
                  <tr>
                    <SortTh label="Produto" sortKey="nome" current={sortKey} dir={sortDir} onSort={toggle} className={`${TH_CLASS} text-left`} />
                    <SortTh label="Departamento" sortKey="departamento" current={sortKey} dir={sortDir} onSort={toggle} className={`${TH_CLASS} text-left`} />
                    <SortTh label="Unidade" sortKey="unidade" current={sortKey} dir={sortDir} onSort={toggle} className={TH_CLASS} />
                    <SortTh label="Preço de tabela" sortKey="preco" current={sortKey} dir={sortDir} onSort={toggle} className={`${TH_CLASS} text-right`} />
                    <SortTh label="Preço negociado" sortKey="negociado" current={sortKey} dir={sortDir} onSort={toggle} className={`${TH_CLASS} text-right`} />
                    <SortTh label="Grupo" sortKey="grupo" current={sortKey} dir={sortDir} onSort={toggle} className={`${TH_CLASS} text-left`} />
                    <SortTh label="Preço/un. ref." sortKey="por_ref" current={sortKey} dir={sortDir} onSort={toggle} className={`${TH_CLASS} text-right`} />
                    <SortTh label="Qtd. mínima" sortKey="qtd_min" current={sortKey} dir={sortDir} onSort={toggle} className={TH_CLASS} />
                    <SortTh label="Prazo" sortKey="prazo" current={sortKey} dir={sortDir} onSort={toggle} className={TH_CLASS} />
                    <SortTh label="Situação" sortKey="ativo" current={sortKey} dir={sortDir} onSort={toggle} className={TH_CLASS} />
                    <th className={`${TH_CLASS} w-20`}></th>
                  </tr>
                </thead>
                <tbody>
                  {!fornId ? (
                    <tr><td colSpan={11} className="p-4 text-center text-muted-foreground text-[11px]">Selecione um fornecedor para ver e cadastrar os produtos dele.</td></tr>
                  ) : isLoading ? (
                    <tr><td colSpan={11} className="p-4 text-center text-muted-foreground text-[11px]">Carregando…</td></tr>
                  ) : ordenados.length === 0 ? (
                    <tr><td colSpan={11} className="p-4 text-center text-muted-foreground text-[11px]">Nenhum produto cadastrado para este fornecedor.</td></tr>
                  ) : ordenados.map((p) => {
                    const v = vinculoDoProduto(p.id);
                    const grupo = grupos.find((g) => g.id === p.grupo_id) ?? null;
                    const porRef = precoPorUnidadeRef(precoVigente(v), p.fator_conversao);
                    return (
                      <tr
                        key={p.id}
                        className={`border-t cursor-pointer hover:bg-muted/20 ${selId === p.id ? "bg-violet-100/70 dark:bg-violet-900/30" : ""}`}
                        onClick={() => setSelId(p.id)}
                      >
                        <td className={`${TD_CLASS} text-left font-medium`}>{p.nome}</td>
                        <td className={`${TD_CLASS} text-left`}>{p.departamento ?? "—"}</td>
                        <td className={TD_CLASS}>{p.unidade}</td>
                        <td className={`${TD_CLASS} text-right tabular-nums`}>{v?.preco_tabela == null ? "—" : fmtMoeda(v.preco_tabela)}</td>
                        <td className={`${TD_CLASS} text-right font-semibold tabular-nums text-teal-800 dark:text-teal-300`}>
                          {v?.preco_negociado == null ? "—" : fmtMoeda(v.preco_negociado)}
                        </td>
                        <td className={`${TD_CLASS} text-left`}>{grupo ? grupo.nome : "—"}</td>
                        <td className={`${TD_CLASS} text-right tabular-nums`}>
                          {porRef == null || !grupo ? "—" : `${fmtMoeda(porRef)}/${grupo.unidade_referencia}`}
                        </td>
                        <td className={`${TD_CLASS} tabular-nums`}>{v?.quantidade_minima ?? "—"}</td>
                        <td className={`${TD_CLASS} tabular-nums`}>{v?.prazo_entrega_dias == null ? "—" : `${v.prazo_entrega_dias} d`}</td>
                        <td className={TD_CLASS}>
                          <span className={`rounded font-semibold ${BADGE_SM_CLASS} ${p.ativo ? "bg-teal-100 text-teal-900" : "bg-muted text-muted-foreground"}`}>
                            {p.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className={`${TD_CLASS} whitespace-nowrap`}>
                          <Button size="icon" variant="ghost" className="h-6 w-6" title="Editar" onClick={(e) => { e.stopPropagation(); abrirEdicao(p); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-6 w-6" title="Duplicar produto neste fornecedor"
                            onClick={(e) => { e.stopPropagation(); abrirDuplicar(p); }}
                          >
                            <CopyPlus className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-6 w-6" title="Copiar para outro fornecedor"
                            onClick={(e) => { e.stopPropagation(); setCopiarAlvo(p); setCopiarDestino(""); setCopiarOpen(true); }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-rose-700" title="Apagar produto"
                            onClick={(e) => { e.stopPropagation(); setExcluirProd(p); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {sel && (
        <Card>
          <CardHeader className="py-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">Histórico de preço — {sel.nome}</CardTitle>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[11.5px] cursor-pointer">
                  <Checkbox checked={histAnulados} onCheckedChange={(v) => setHistAnulados(!!v)} />
                  Mostrar anulados
                </label>
                <Select value={histTipo} onValueChange={setHistTipo}>
                  <SelectTrigger className="h-7 w-[190px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os preços</SelectItem>
                    <SelectItem value="tabela">Somente tabela</SelectItem>
                    <SelectItem value="negociado">Somente negociado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className={`${TABLE_WRAPPER_CLASS} max-h-[40vh] overflow-y-auto`} style={TABLE_FONT_STYLE}>
              <table className="w-full">
                <thead className="bg-muted/40 sticky top-0 z-10">
                  <tr>
                    <th className={`${TH_CLASS} text-left`}>Quando</th>
                    <th className={TH_CLASS}>Tipo</th>
                    <th className={`${TH_CLASS} text-right`}>De</th>
                    <th className={`${TH_CLASS} text-right`}>Para</th>
                    <th className={TH_CLASS}>Variação</th>
                    <th className={`${TH_CLASS} text-left`}>Motivo</th>
                    <th className={TH_CLASS}>Revisão</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoFiltrado.length === 0 ? (
                    <tr><td colSpan={7} className="p-3 text-center text-muted-foreground text-[11px]">Sem histórico.</td></tr>
                  ) : historicoFiltrado.map((h) => {
                    const varPct = variacaoPercentual(h.preco_anterior, n(h.preco_novo));
                    return (
                      <tr key={h.id} className={`border-t ${h.anulado ? "line-through text-muted-foreground" : ""}`}>
                        <td className={`${TD_CLASS} text-left whitespace-nowrap`}>{new Date(h.created_at).toLocaleString("pt-BR")}</td>
                        <td className={TD_CLASS}>
                          <span className={`rounded font-semibold ${BADGE_SM_CLASS} ${h.tipo === "negociado" ? "bg-teal-100 text-teal-900" : "bg-muted text-muted-foreground"}`}>
                            {h.tipo === "negociado" ? "Negociado" : "Tabela"}
                          </span>
                        </td>
                        <td className={`${TD_CLASS} text-right tabular-nums`}>{h.preco_anterior == null ? "—" : fmtMoeda(h.preco_anterior)}</td>
                        <td className={`${TD_CLASS} text-right font-semibold tabular-nums`}>{fmtMoeda(h.preco_novo)}</td>
                        <td className={TD_CLASS}>
                          <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${h.direcao === "alta" ? "text-rose-700" : h.direcao === "baixa" ? "text-emerald-700" : "text-muted-foreground"}`}>
                            {h.direcao === "alta" ? <TrendingUp className="h-3 w-3" /> : h.direcao === "baixa" ? <TrendingDown className="h-3 w-3" /> : null}
                            {varPct == null ? "inicial" : `${varPct > 0 ? "+" : ""}${varPct.toFixed(1)}%`}
                          </span>
                        </td>
                        <td className={`${TD_CLASS} text-left`}>
                          {h.anulado && (
                            <span className={`no-underline mr-1 rounded bg-muted text-muted-foreground font-semibold align-middle ${BADGE_SM_CLASS}`}>
                              Anulado
                            </span>
                          )}
                          {h.anulado ? (h.anulado_motivo ?? "—") : (h.motivo ?? "—")}
                        </td>
                        <td className={TD_CLASS}>
                          <span className={`rounded font-semibold ${BADGE_SM_CLASS} ${
                            h.status_revisao === "pendente" ? "bg-amber-100 text-amber-900"
                            : h.status_revisao === "contestada" ? "bg-rose-100 text-rose-900"
                            : "bg-emerald-100 text-emerald-900"}`}>
                            {h.status_revisao}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-l-4 border-l-teal-500 bg-teal-50/40 dark:bg-teal-950/10">
        <CardHeader className="py-2">
          <div className="flex items-baseline justify-between gap-2">
            <CardTitle className="text-base text-teal-700 dark:text-teal-400">Fornecedores</CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {fornecedoresFiltrados.length} {fornecedoresFiltrados.length === 1 ? "registro" : "registros"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-0.5 w-full sm:w-72">
              <Label className="text-xs text-muted-foreground font-medium">Buscar fornecedor</Label>
              <Input value={buscaForn} onChange={(e) => setBuscaForn(e.target.value)} placeholder="Razão social, fantasia…" className="h-8" />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground h-8">
              <Checkbox checked={mostrarInativos} onCheckedChange={(v) => setMostrarInativos(v === true)} />
              Mostrar inativos
            </label>
          </div>

          <div className={`${TABLE_WRAPPER_CLASS} max-h-[45vh] overflow-y-auto`} style={TABLE_FONT_STYLE}>
            <table className="w-full">
              <thead className="bg-muted/40 sticky top-0 z-10">
                <tr>
                  <SortTh label="Fornecedor" sortKey="nome" current={fornSortKey} dir={fornSortDir} onSort={fornToggle} className={`${TH_CLASS} text-left`} />
                  <SortTh label="Razão social" sortKey="razao_social" current={fornSortKey} dir={fornSortDir} onSort={fornToggle} className={`${TH_CLASS} text-left`} />
                  <SortTh label="CNPJ / Doc." sortKey="documento" current={fornSortKey} dir={fornSortDir} onSort={fornToggle} className={`${TH_CLASS} text-left`} />
                  <SortTh label="Contato" sortKey="contato" current={fornSortKey} dir={fornSortDir} onSort={fornToggle} className={`${TH_CLASS} text-left`} />
                  <SortTh label="Telefone" sortKey="telefone" current={fornSortKey} dir={fornSortDir} onSort={fornToggle} className={TH_CLASS} />
                  <SortTh label="Cidade / UF" sortKey="cidade" current={fornSortKey} dir={fornSortDir} onSort={fornToggle} className={`${TH_CLASS} text-left`} />
                  <SortTh label="Cond. pagamento" sortKey="condicao" current={fornSortKey} dir={fornSortDir} onSort={fornToggle} className={`${TH_CLASS} text-left`} />
                  <SortTh label="Produtos" sortKey="produtos" current={fornSortKey} dir={fornSortDir} onSort={fornToggle} className={TH_CLASS} />
                  <SortTh label="Situação" sortKey="ativo" current={fornSortKey} dir={fornSortDir} onSort={fornToggle} className={TH_CLASS} />
                  <th className={`${TH_CLASS} w-16`}></th>
                </tr>
              </thead>
              <tbody>
                {fornecedoresOrdenados.length === 0 ? (
                  <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Nenhum fornecedor.</td></tr>
                ) : fornecedoresOrdenados.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => selecionarFornecedor(f.id)}
                    className={`border-t cursor-pointer hover:bg-muted/20 ${fornId === f.id ? "bg-teal-100/70 dark:bg-teal-900/30" : ""}`}
                  >
                    <td className={`${TD_CLASS} text-left font-medium`}>{f.nome_fantasia || f.razao_social}</td>
                    <td className={`${TD_CLASS} text-left`}>{f.razao_social}</td>
                    <td className={`${TD_CLASS} text-left`}>{f.documento ?? "—"}</td>
                    <td className={`${TD_CLASS} text-left`}>{f.contato_nome ?? "—"}</td>
                    <td className={TD_CLASS}>{f.contato_telefone ?? "—"}</td>
                    <td className={`${TD_CLASS} text-left`}>
                      {f.cidade ? `${f.cidade}${f.uf ? ` — ${f.uf}` : ""}` : (f.uf || "—")}
                    </td>
                    <td className={`${TD_CLASS} text-left`}>{f.condicao_pagamento_padrao ?? "—"}</td>
                    <td className={`${TD_CLASS} tabular-nums`}>{contagem.get(f.id) ?? 0}</td>
                    <td className={TD_CLASS}>
                      <span className={`rounded font-semibold ${BADGE_SM_CLASS} ${
                        f.ativo
                          ? "bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-200"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {f.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className={TD_CLASS}>
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          size="icon" variant="ghost" className="h-6 w-6" title="Editar fornecedor"
                          onClick={(e) => { e.stopPropagation(); setFornEdit(f); setFornDialogOpen(true); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-rose-700" title="Apagar fornecedor"
                          onClick={(e) => { e.stopPropagation(); setExcluirForn(f); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>




      <Dialog open={prodOpen} onOpenChange={setProdOpen}>
        <DialogContent className="max-w-[720px]">
          <DialogHeader>
            <DialogTitle>
              {(form.id ? "Editar produto" : "Novo produto") + (fornecedorSel ? ` — ${fornecedorSel.nome_fantasia || fornecedorSel.razao_social}` : "")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Departamento</Label>
              <Select value={form.departamento || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, departamento: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {departamentos.filter((d) => d.ativo || d.nome === form.departamento).map((d) => (
                    <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                  ))}
                  {form.departamento && !departamentos.some((d) => d.nome === form.departamento) && (
                    <SelectItem value={form.departamento}>{form.departamento}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Unidade *</Label>
              <Select value={form.unidade} onValueChange={(v) => setForm((f) => ({ ...f, unidade: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  {form.unidade && !unidades.includes(form.unidade) && (
                    <SelectItem value={form.unidade}>{form.unidade}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Preço de tabela</Label>
              <Input value={form.preco} onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))} className="h-9 text-right" placeholder="0,00" />
            </div>
            <div>
              <Label className="text-xs">Preço negociado</Label>
              <Input value={form.preco_negociado} onChange={(e) => setForm((f) => ({ ...f, preco_negociado: e.target.value }))} className="h-9 text-right" placeholder="0,00" />
            </div>
            {precoRefTexto && (
              <div className="col-span-3 -mt-1 text-[11px] text-teal-700">{precoRefTexto}</div>
            )}
            <div className="col-span-2">
              <Label className="text-xs">Item equivalente (grupo)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Combobox
                    value={form.grupo_id || "__none__"}
                    onChange={(v) => setForm((f) => ({ ...f, grupo_id: v === "__none__" ? "" : v, fator_conversao: v === "__none__" ? "" : (f.fator_conversao || "1") }))}
                    options={[
                      { value: "__none__", label: "— sem grupo —" },
                      ...grupos.filter((g) => g.ativo || g.id === form.grupo_id).map((g) => ({ value: g.id, label: g.nome, hint: g.unidade_referencia })),
                    ]}
                    placeholder="Selecione o grupo"
                  />
                </div>
                <Button type="button" variant="outline" className="h-9 whitespace-nowrap" onClick={abrirNovoGrupo}>
                  <Plus className="h-4 w-4 mr-1" /> Criar novo grupo
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Fator de conversão</Label>
              <Input
                value={form.fator_conversao}
                disabled={!form.grupo_id}
                onChange={(e) => setForm((f) => ({ ...f, fator_conversao: e.target.value }))}
                className="h-9 text-right"
                placeholder="1"
              />
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Ex.: o produto é vendido em rolo e o grupo compara por metro — se o rolo tem 100 m, o fator é 100.
              </div>
            </div>

            <div className="col-span-3 rounded-md border p-3 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Variações</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Variação 1</Label>
                  <Combobox
                    value={form.variacao_1_id || "__none__"}
                    onChange={(v) => {
                      const valor = v === "__none__" ? "" : v;
                      if (form.id && combinacoesForm.length > 0 && valor !== form.variacao_1_id) {
                        setConfirmTroca({ campo: "variacao_1_id", valor });
                        return;
                      }
                      setForm((f) => ({
                        ...f,
                        variacao_1_id: valor,
                        variacao_2_id: valor ? f.variacao_2_id : "",
                        preco_por_variacao: valor ? f.preco_por_variacao : false,
                      }));
                    }}
                    options={[
                      { value: "__none__", label: "— sem variação —" },
                      ...variacoes.filter((v) => v.ativo || v.id === form.variacao_1_id).map((v) => ({ value: v.id, label: v.nome })),
                    ]}
                    placeholder="Selecione"
                  />
                </div>
                <div>
                  <Label className="text-xs">Variação 2</Label>
                  <Combobox
                    value={form.variacao_2_id || "__none__"}
                    onChange={(v) => {
                      const valor = v === "__none__" ? "" : v;
                      if (form.id && combinacoesForm.length > 0 && valor !== form.variacao_2_id) {
                        setConfirmTroca({ campo: "variacao_2_id", valor });
                        return;
                      }
                      setForm((f) => ({ ...f, variacao_2_id: valor }));
                    }}
                    options={[
                      { value: "__none__", label: "— sem variação —" },
                      ...variacoes
                        .filter((v) => (v.ativo || v.id === form.variacao_2_id) && v.id !== form.variacao_1_id)
                        .map((v) => ({ value: v.id, label: v.nome })),
                    ]}
                    placeholder="Selecione"
                  />
                </div>
              </div>

              {!form.variacao_1_id ? (
                <div className="text-[11px] text-muted-foreground">
                  Sem variação: o produto continua com um preço único. Os tipos e valores são cadastrados em Configurações › SUP.
                </div>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={form.preco_por_variacao}
                      onChange={(e) => {
                        if (!e.target.checked && combinacoesForm.length > 0) { setConfirmFlagOff(true); return; }
                        setForm((f) => ({ ...f, preco_por_variacao: e.target.checked }));
                      }}
                    />
                    O preço varia por variação
                  </label>

                  {form.preco_por_variacao && (
                    !form.id ? (
                      <div className="text-[11px] text-muted-foreground">
                        Salve o produto para cadastrar os preços de cada combinação.
                      </div>
                    ) : (
                      <div className="rounded-md border overflow-hidden">
                        <table className="w-full text-[13px]">
                          <thead className="bg-muted/40">
                            <tr>
                              <th className="text-left px-2 py-1 font-semibold">{nomeVariacao(form.variacao_1_id) || "Variação 1"}</th>
                              {form.variacao_2_id && (
                                <th className="text-left px-2 py-1 font-semibold">{nomeVariacao(form.variacao_2_id)}</th>
                              )}
                              <th className="text-right px-2 py-1 font-semibold w-28">Tabela</th>
                              <th className="text-right px-2 py-1 font-semibold w-28">Negociado</th>
                              <th className="w-8" />
                            </tr>
                          </thead>
                          <tbody>
                            {combinacoesForm.length === 0 && (
                              <tr><td colSpan={form.variacao_2_id ? 5 : 4} className="px-2 py-2 text-muted-foreground">Nenhuma combinação cadastrada.</td></tr>
                            )}
                            {combinacoesForm.map((c) => (
                              <tr key={c.id} className="border-t">
                                <td className="px-2 py-1">{c.variacao_1_valor}</td>
                                {form.variacao_2_id && <td className="px-2 py-1">{c.variacao_2_valor ?? "—"}</td>}
                                <td className="px-2 py-1">
                                  <Input
                                    defaultValue={c.preco_tabela == null ? "" : String(c.preco_tabela)}
                                    className="h-8 text-right"
                                    placeholder="0,00"
                                    onBlur={(e) => {
                                      if (e.target.value.trim() === "") return;
                                      atualizarCombinacao.mutate({ comb: c, campo: "tabela", valor: e.target.value });
                                    }}
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  <Input
                                    defaultValue={c.preco_negociado == null ? "" : String(c.preco_negociado)}
                                    className="h-8 text-right"
                                    placeholder="0,00"
                                    onBlur={(e) => {
                                      if (e.target.value.trim() === "") return;
                                      atualizarCombinacao.mutate({ comb: c, campo: "negociado", valor: e.target.value });
                                    }}
                                  />
                                </td>
                                <td className="px-1">
                                  <button
                                    type="button"
                                    title="Inativar combinação"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => inativarCombinacao.mutate(c.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            <tr className="border-t bg-muted/20">
                              <td className="px-2 py-1">
                                <Combobox
                                  value={combNovo.v1 || "__none__"}
                                  onChange={(v) => setCombNovo((c) => ({ ...c, v1: v === "__none__" ? "" : v }))}
                                  options={[
                                    { value: "__none__", label: "—" },
                                    ...valoresDeVariacao(form.variacao_1_id).map((v) => ({ value: v.valor, label: v.valor })),
                                  ]}
                                  placeholder="Valor"
                                />
                              </td>
                              {form.variacao_2_id && (
                                <td className="px-2 py-1">
                                  <Combobox
                                    value={combNovo.v2 || "__none__"}
                                    onChange={(v) => setCombNovo((c) => ({ ...c, v2: v === "__none__" ? "" : v }))}
                                    options={[
                                      { value: "__none__", label: "—" },
                                      ...valoresDeVariacao(form.variacao_2_id).map((v) => ({ value: v.valor, label: v.valor })),
                                    ]}
                                    placeholder="Valor"
                                  />
                                </td>
                              )}
                              <td className="px-2 py-1">
                                <Input
                                  value={combNovo.tabela}
                                  onChange={(e) => setCombNovo((c) => ({ ...c, tabela: e.target.value }))}
                                  className="h-8 text-right"
                                  placeholder="0,00"
                                />
                              </td>
                              <td className="px-2 py-1">
                                <Input
                                  value={combNovo.negociado}
                                  onChange={(e) => setCombNovo((c) => ({ ...c, negociado: e.target.value }))}
                                  className="h-8 text-right"
                                  placeholder="0,00"
                                />
                              </td>
                              <td className="px-1">
                                <button
                                  type="button"
                                  title="Adicionar combinação"
                                  className="text-teal-700 hover:text-teal-900"
                                  disabled={salvarCombinacao.isPending}
                                  onClick={() => salvarCombinacao.mutate()}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </>
              )}
            </div>

            <div>
              <Label className="text-xs">Qtd. mínima</Label>
              <Input value={form.qtd_min} onChange={(e) => setForm((f) => ({ ...f, qtd_min: e.target.value }))} className="h-9 text-right" />
            </div>
            <div>
              <Label className="text-xs">Prazo de entrega (dias)</Label>
              <Input value={form.prazo} onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))} className="h-9 text-right" />
            </div>
            <div>
              <Label className="text-xs">Situação *</Label>
              <Select value={form.ativo ? "ativo" : "inativo"} onValueChange={(v) => setForm((f) => ({ ...f, ativo: v === "ativo" }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Especificação</Label>
              <Textarea value={form.especificacao} onChange={(e) => setForm((f) => ({ ...f, especificacao: e.target.value }))} rows={3} />
            </div>
            {precoMudou && (
              <>
                <div className="col-span-2">
                  <Label className="text-xs">Motivo da alteração de preço</Label>
                  <Textarea value={form.motivo} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} rows={2} />
                </div>
                <div>
                  <Label className="text-xs">Anexo</Label>
                  <Input type="file" className="h-9" onChange={(e) => setForm((f) => ({ ...f, arquivo: e.target.files?.[0] ?? null }))} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProdOpen(false)}>Cancelar</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={salvar.isPending} onClick={() => salvar.mutate(form)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={grupoOpen} onOpenChange={setGrupoOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader><DialogTitle>Novo grupo de itens equivalentes</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={grupoForm.nome} onChange={(e) => setGrupoForm((g) => ({ ...g, nome: e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Unidade de referência *</Label>
              <Select value={grupoForm.unidade_referencia} onValueChange={(v) => setGrupoForm((g) => ({ ...g, unidade_referencia: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Input value={grupoForm.categoria} onChange={(e) => setGrupoForm((g) => ({ ...g, categoria: e.target.value }))} className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrupoOpen(false)}>Cancelar</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={criarGrupo.isPending} onClick={() => criarGrupo.mutate()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={copiarOpen} onOpenChange={setCopiarOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader><DialogTitle>Copiar para outro fornecedor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              O produto <b>{copiarAlvo?.nome}</b> será cadastrado no fornecedor escolhido sem preço e sem histórico.
              O grupo de equivalência e o fator de conversão vão junto.
            </div>
            <div>
              <Label className="text-xs">Fornecedor de destino *</Label>
              <Select value={copiarDestino} onValueChange={setCopiarDestino}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {fornecedores.filter((f) => f.ativo && f.id !== copiarAlvo?.fornecedor_id).map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopiarOpen(false)}>Cancelar</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={copiar.isPending} onClick={() => copiar.mutate()}>Copiar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FornecedorDialog
        open={fornDialogOpen}
        onOpenChange={setFornDialogOpen}
        fornecedor={fornEdit}
        onSaved={(id) => {
          const criando = fornEdit === null;
          if (criando && id) {
            setFornId(id);
            setSelId(null);
            setBuscaForn("");
          }
          setFornEdit(null);
        }}
      />

      <Dialog open={!!excluirProd} onOpenChange={(v) => { if (!v) setExcluirProd(null); }}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader><DialogTitle>Apagar produto</DialogTitle></DialogHeader>
          <div className="text-sm">
            Apagar <b>{excluirProd?.nome}</b> definitivamente? O histórico de preços deste produto também será apagado.
            Produtos já usados em pedidos de compra não podem ser apagados.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirProd(null)}>Cancelar</Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={excluirProduto.isPending}
              onClick={() => excluirProduto.mutate()}
            >
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!excluirForn} onOpenChange={(v) => { if (!v) setExcluirForn(null); }}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader><DialogTitle>Apagar fornecedor</DialogTitle></DialogHeader>
          <div className="text-sm">
            Apagar <b>{excluirForn?.nome_fantasia || excluirForn?.razao_social}</b> definitivamente?
            Todos os produtos deste fornecedor e seus históricos de preço serão apagados.
            Fornecedores com pedidos de compra não podem ser apagados.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirForn(null)}>Cancelar</Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={excluirFornecedor.isPending}
              onClick={() => excluirFornecedor.mutate()}
            >
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmFlagOff} onOpenChange={setConfirmFlagOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desligar preço por variação?</AlertDialogTitle>
            <AlertDialogDescription>
              As {combinacoesForm.length} combinação(ões) de preço deste produto serão inativadas ao salvar.
              Nada é apagado e o histórico de preços continua disponível. O produto volta a usar um preço único.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setForm((f) => ({ ...f, preco_por_variacao: false }))}>
              Desligar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmTroca} onOpenChange={(v) => { if (!v) setConfirmTroca(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar o tipo de variação?</AlertDialogTitle>
            <AlertDialogDescription>
              Este produto já tem {combinacoesForm.length} combinação(ões) de preço. Ao salvar, elas serão
              inativadas porque deixam de corresponder aos novos tipos. Nada é apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const t = confirmTroca;
                setConfirmTroca(null);
                if (!t) return;
                setForm((f) =>
                  t.campo === "variacao_1_id"
                    ? { ...f, variacao_1_id: t.valor, variacao_2_id: t.valor ? f.variacao_2_id : "", preco_por_variacao: t.valor ? f.preco_por_variacao : false }
                    : { ...f, variacao_2_id: t.valor },
                );
              }}
            >
              Trocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>

  );
}
