import { useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useIsAdmin, useHasRole } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { apenasVigentes, type LotesPorData } from "@/lib/olist-vendas";
import {
  aplicarFiltros,
  calcularPedidos,
  curvaAbc,
  evolucaoMensal,
  fmtMes,
  fmtMoeda,
  fmtNum,
  fmtPerc,
  gradePorModelo,
  ordenarRanking,
  periodoAnterior,
  porCliente,
  abcClientes,
  porSituacao,
  porVendedor,
  FAIXAS_QTD,
  faixaDoPedido,
  filtrarPorFaixaQtd,
  porFaixaQtd,
  type FaixaQtd,

  primeiraCompraPorCliente,
  ranking,
  resumo,
  resumoFrete,
  variacao,
  porUf,
  vendidoVsProduzido,
  produtividadePcp,
  saudeCadastro,
  type DimRanking,
  type EmpresaFiltro,
  type Filtros,
  type Grupo,
  type ItemDb,
  type OrdemRanking,
  type PcpDb,
  type PedidoDb,
  type PedidoFiltrado,
  type ItemCalc,
  type EscopoIndicadores,
  pedidosJuffStore,
} from "@/lib/indicadores-olist";
import {
  parseProdutoStore,
  rankingStore,
  composicaoStore,
  descricoesForaPadrao,
  type DimRankingStore,
  type ItemStoreCalc,
} from "@/lib/indicadores-store";
import {
  agruparPcpPorPedidoOlist,
  basePedidoOlist,
  registroConsolidado,
  type PcpAgregado,
} from "@/lib/pedido-olist-match";
import { useFeriados } from "@/hooks/use-feriados";


import { useProfilesMap } from "@/hooks/use-profiles-map";
import { abrirIndicadoresParaImpressao } from "@/lib/indicadores-pdf";
import { abrirFaixasQtdParaImpressao } from "@/lib/faixas-qtd-pdf";
import {
  opcoesVendedores,
  mapaVendedorPcp,
  filtrarPorVendedor,
  pcpNoRecorteVendedor,
  type OpcaoVendedor,
} from "@/lib/indicadores-vendedor";
import { FileDown } from "lucide-react";
import {
  drillPedidos,
  drillItens,
  drillClientes,
  drillVendidoProduzido,
  drillSoOlist,
  drillSoPcp,
  drillSemMapeamento,
  drillDivergencias,
  drillPcpAtraso,
  drillPcpEntregas,
  drillPcpEtapa,
  drillPcpPedidos,
  drillPcpPendentes,
  drillPcpPrazo,
  drillRefacoes,
  drillCorrecoes,
  NOTA_BLOCO_PCP,
  type CampoVxp,
  type DrillPayload,
  type PcpDrill,
} from "@/lib/indicadores-drill";
import { IndicadorDrillDialog } from "@/components/pcp/IndicadorDrillDialog";
import { ValorDrill } from "@/components/pcp/ValorDrill";



/* ------------------------------------------------------------------ */

async function lerTudo<T>(fn: (from: number, to: number) => Promise<T[]>): Promise<T[]> {
  const passo = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += passo) {
    const parte = await fn(from, from + passo - 1);
    out.push(...parte);
    if (parte.length < passo) break;
  }
  return out;
}

const iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

type Preset = "mes" | "mes_ant" | "d30" | "d60" | "d90" | "ano" | "livre";

function intervaloPreset(p: Preset): { de: string; ate: string } {
  const hoje = new Date();
  if (p === "mes") {
    return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: iso(hoje) };
  }
  if (p === "mes_ant") {
    return {
      de: iso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
      ate: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
    };
  }
  if (p === "ano") return { de: iso(new Date(hoje.getFullYear(), 0, 1)), ate: iso(hoje) };
  const dias = p === "d30" ? 30 : p === "d60" ? 60 : 90;
  return { de: iso(new Date(hoje.getTime() - (dias - 1) * 86400000)), ate: iso(hoje) };
}

type OpcaoMulti = string | { valor: string; label: string; hint?: string };

function MultiSelect({
  label,
  opcoes,
  valor,
  onChange,
}: {
  label: string;
  opcoes: OpcaoMulti[];
  valor: string[];
  onChange: (v: string[]) => void;
}) {
  const itens = opcoes.map((o) => (typeof o === "string" ? { valor: o, label: o, hint: undefined } : o));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 justify-between gap-2 min-w-[130px]">
          <span className="truncate">
            {label}
            {valor.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({valor.length})</span>}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold">{label}</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => onChange([])}>
            Limpar
          </Button>
        </div>
        <div className="max-h-64 space-y-1 overflow-auto">
          {itens.length === 0 && <div className="text-xs text-muted-foreground">Sem opções</div>}
          {itens.map((o) => (
            <label
              key={o.valor}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted"
            >
              <Checkbox
                checked={valor.includes(o.valor)}
                onCheckedChange={(c) => onChange(c ? [...valor, o.valor] : valor.filter((v) => v !== o.valor))}
              />
              <span className="truncate">{o.label}</span>
              {o.hint ? (
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{o.hint}</span>
              ) : null}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}


function Kpi({
  titulo,
  valor,
  varPerc,
  comparar,
  onDrill,
}: {
  titulo: string;
  valor: string;
  varPerc: number | null;
  comparar: boolean;
  onDrill?: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{titulo}</div>
        {onDrill ? (
          <button
            type="button"
            onClick={onDrill}
            title="Ver detalhamento"
            className="mt-1 text-xl font-semibold tabular-nums underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 hover:text-primary hover:decoration-foreground transition-colors"
          >
            {valor}
          </button>
        ) : (
          <div className="mt-1 text-xl font-semibold tabular-nums">{valor}</div>
        )}

        {comparar && (
          <div
            className={`text-xs tabular-nums ${
              varPerc == null ? "text-muted-foreground" : varPerc >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {fmtPerc(varPerc)} vs. período anterior
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const GRUPOS: { v: Grupo; label: string }[] = [
  { v: "casados", label: "Casados" },
  { v: "so_olist", label: "Somente Olist" },
  { v: "excluidos", label: "Excluídos" },
  { v: "so_pcp", label: "Somente PCP" },
];

const RANKINGS: { dim: DimRanking; titulo: string }[] = [
  { dim: "modelo", titulo: "Modelos mais vendidos" },
  { dim: "cor", titulo: "Cores mais vendidas" },
  { dim: "tamanho", titulo: "Tamanhos mais vendidos" },
  { dim: "peca", titulo: "Peças mais vendidas (modelo · cor · tamanho)" },
];

/* Rankings da aba Juff Store: modelo vem do parse próprio, não do de-para. */
const RANKINGS_STORE: { dimStore: DimRankingStore; dim: DimRanking; titulo: string }[] = [
  { dimStore: "modelo_base", dim: "modelo", titulo: "Modelos mais vendidos" },
  { dimStore: "estampa", dim: "modelo", titulo: "Estampas mais vendidas" },
  { dimStore: "cor", dim: "cor", titulo: "Cores mais vendidas" },
  { dimStore: "tamanho", dim: "tamanho", titulo: "Tamanhos mais vendidos" },
  { dimStore: "peca", dim: "peca", titulo: "Peças mais vendidas (modelo · cor · tamanho)" },
];


/* ------------------------------------------------------------------ */

export function IndicadoresTab({ escopo = "custom" }: { escopo?: EscopoIndicadores } = {}) {
  const soPcpAtivo = escopo === "custom";
  const [preset, setPreset] = usePersistedState<Preset>(`kpi:${escopo}:preset`, "mes");
  const [intervalo, setIntervalo] = usePersistedState(`kpi:${escopo}:intervalo`, intervaloPreset("mes"));
  const [comparar, setComparar] = useState(false);
  const [empresa, setEmpresa] = usePersistedState<EmpresaFiltro>(`kpi:${escopo}:empresa`, "CONSOLIDADO");
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [modelos, setModelos] = useState<string[]>([]);
  const [cores, setCores] = useState<string[]>([]);
  const [tamanhos, setTamanhos] = useState<string[]>([]);
  const [situacoes, setSituacoes] = useState<string[]>([]);
  const [faixaQtd, setFaixaQtd] = useState<FaixaQtd>("todas");

  const [grupos, setGrupos] = useState<Grupo[]>(["casados", "so_olist"]);
  /* Filtros exclusivos da Juff Store. */
  const [tipoPeca, setTipoPeca] = useState<"todas" | "lisas" | "estampadas">("todas");
  const [somenteOutlet, setSomenteOutlet] = useState(false);


  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["indicadores-olist", "base"],
    queryFn: async () => {
      const [lotesRes, pedidos, itens, mapRes, exclRes, pcp, escopoRes] = await Promise.all([
        supabase.from("olist_import_lotes" as any).select("id, importado_em"),
        lerTudo<PedidoDb>(async (from, to) => {
          const { data, error } = await supabase
            .from("olist_pedidos" as any)
            .select(
              "numero_pedido, lote_id, empresa, data, nome_contato, cpf_cnpj, situacao, vendedor, desconto_valor, desconto_percentual, frete, despesas",
            )
            .range(from, to);
          if (error) throw error;
          return (data ?? []) as any;
        }),
        lerTudo<ItemDb>(async (from, to) => {
          const { data, error } = await supabase
            .from("olist_itens" as any)
            .select(
              "numero_pedido, lote_id, produto_olist, descricao_original, cor, tamanho, qtd, valor_unitario, desconto_item, is_servico",
            )
            .range(from, to);
          if (error) throw error;
          return (data ?? []) as any;
        }),
        supabase.from("olist_produto_map" as any).select("produto_olist, modelo_cop"),
        supabase.from("olist_pedidos_excluidos" as any).select("numero_pedido"),
        lerTudo<PcpDrill>(async (from, to) => {
          const { data, error } = await supabase
            .from("pedidos")
            .select(
              "id, pedido_olist, orcamento, vendedor, tipo_estampa, uf_entrega, qtd, entrada_pedido, data_entrega, inicio_estamparia, termino_estamparia, inicio_acabamento, termino_acabamento, saida_juff, finalizado_em, arte_data, refacoes, correcoes_etapa",

            )
            .not("pedido_olist", "is", null)
            .range(from, to);
          if (error) throw error;
          return (data ?? []) as any;
        }),
        supabase.from("kpi_pedido_escopo" as any).select("numero_pedido, escopo"),
      ]);
      if (lotesRes.error) throw lotesRes.error;
      if (escopoRes.error) throw escopoRes.error;
      if (mapRes.error) throw mapRes.error;
      if (exclRes.error) throw exclRes.error;

      const lotes: LotesPorData = {};
      for (const l of (lotesRes.data ?? []) as any[]) lotes[String(l.id)] = String(l.importado_em);

      const modeloPorProduto = new Map<string, string>();
      for (const r of (mapRes.data ?? []) as any[]) modeloPorProduto.set(String(r.produto_olist), String(r.modelo_cop));

      /* Parciais do PCP (3996A + 3996B) formam o pedido 3996 da Olist:
         quantidade soma, demais campos vêm do primeiro parcial. */
      const agregados = agruparPcpPorPedidoOlist(pcp as PcpDrill[]);
      const ufPorPedido = new Map<string, string>();
      const noPcp = new Set<string>();
      const pcpPorPedido = new Map<string, PcpDb>();
      const pcpAgregado = new Map<string, PcpAgregado<PcpDrill>>();
      for (const [base, ag] of agregados) {
        noPcp.add(base);
        pcpAgregado.set(base, ag);
        pcpPorPedido.set(base, registroConsolidado(ag));
        if (ag.uf_entrega) ufPorPedido.set(base, ag.uf_entrega);
      }


      const pedidosVig = apenasVigentes(pedidos as any, lotes) as PedidoDb[];
      const vigentePorPedido = new Map(pedidosVig.map((p) => [p.numero_pedido, p.lote_id]));
      const itensVig = (itens as ItemDb[]).filter((i) => vigentePorPedido.get(i.numero_pedido) === i.lote_id);

      const calc = calcularPedidos(pedidosVig, itensVig, modeloPorProduto);
      const pedidosStore = pedidosJuffStore(itensVig);
      const excluidos = new Set((exclRes.data ?? []).map((r: any) => String(r.numero_pedido)));
      const numsOlist = new Set(calc.map((p) => p.numero_pedido));

      return {
        calc,
        excluidos,
        noPcp,
        ufPorPedido,
        pcpPorPedido,
        pcpAgregado,
        pcpLista: pcp,
        modeloPorProduto,
        pedidosStore,
        overrides: new Map<string, "custom" | "store">(
          ((escopoRes.data ?? []) as any[]).map((r) => [String(r.numero_pedido), String(r.escopo) as "custom" | "store"]),
        ),
        /* Bases do PCP sem pedido correspondente na Olist. */
        soPcp: [...noPcp].filter((n) => !numsOlist.has(n)),
      };

    },
  });

  /* Recorte por escopo: pedido com ao menos um item "Juff Store" vive só na aba Store. */
  const base = useMemo(() => {
    const todos = data?.calc ?? [];
    const store = data?.pedidosStore ?? new Set<string>();
    const overrides = data?.overrides ?? new Map<string, "custom" | "store">();
    const ehStorePedido = (p: (typeof todos)[number]) => {
      const ov = overrides.get(p.numero_pedido);
      if (ov) return ov === "store";
      return store.has(p.numero_pedido) && p.empresa === "JOKE";
    };
    const doEscopo = todos.filter((p) => (escopo === "store" ? ehStorePedido(p) : !ehStorePedido(p)));
    if (escopo !== "store") return doEscopo;

    /* Na Store o modelo/cor/tamanho vêm do parse próprio (nada de olist_produto_map).
       O parse é só classificação: qtd, subtotal e descontos ficam idênticos. */
    const out: typeof doEscopo = [];
    for (const p of doEscopo) {
      const itens = p.itens
        .map((i) => {
          const ps = parseProdutoStore(i.descricao_original ?? i.produto_olist);
          const item: ItemStoreCalc = {
            ...i,
            store: ps,
            modelo: i.is_servico ? i.modelo : (ps.modelo_base ?? "Não classificado"),
            cor: ps.cor ?? i.cor,
            tamanho: ps.tamanho ?? i.tamanho,
          };
          return item;
        })
        .filter((i) => {
          if (i.is_servico) return true;
          if (somenteOutlet && !i.store.is_outlet) return false;
          if (tipoPeca === "lisas" && i.store.tipo_peca !== "LISA") return false;
          if (tipoPeca === "estampadas" && i.store.tipo_peca !== "ESTAMPADA") return false;
          return true;
        });
      if (itens.length === 0) continue;
      const subtotal = itens.reduce((s, i) => s + i.subtotal, 0);
      const fator = p.subtotal ? subtotal / p.subtotal : 1;
      const desconto_pedido = p.desconto_pedido * fator;
      out.push({
        ...p,
        itens,
        subtotal,
        desconto_pedido,
        liquido: subtotal - desconto_pedido,
        pecas: itens.filter((i) => !i.is_servico).reduce((s, i) => s + i.qtd, 0),
      });
    }
    return out;
  }, [data, escopo, tipoPeca, somenteOutlet]);

  /* Novo/recorrente é medido só contra o histórico do próprio escopo. */
  const primeiraCompra = useMemo(() => primeiraCompraPorCliente(base), [base]);


  const opcoesVend: OpcaoVendedor[] = useMemo(
    () => opcoesVendedores(base, data?.pcpLista ?? []),
    [base, data],
  );
  const opcoesVendMulti = useMemo(
    () =>
      opcoesVend.map((o) => ({
        valor: o.chave,
        label: o.label,
        hint: o.origem === "ambos" ? "Olist + PCP" : o.origem === "pcp" ? "só PCP" : "só Olist",
      })),
    [opcoesVend],
  );
  const labelsVendSelecionados = useMemo(
    () => vendedores.map((k) => opcoesVend.find((o) => o.chave === k)?.label ?? k),
    [vendedores, opcoesVend],
  );
  const vendedorPcpPorPedido = useMemo(() => mapaVendedorPcp(data?.pcpLista ?? []), [data]);

  const opcoes = useMemo(() => {
    const s = new Set<string>();
    const m = new Set<string>();
    const c = new Set<string>();
    const t = new Set<string>();
    for (const p of base) {
      s.add(p.situacao);
      for (const i of p.itens) {
        if (i.modelo) m.add(i.modelo);
        if (i.cor) c.add(i.cor);
        if (i.tamanho) t.add(i.tamanho);
      }
    }
    const ord = (x: Set<string>) => [...x].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { situacoes: ord(s), modelos: ord(m), cores: ord(c), tamanhos: ord(t) };
  }, [base]);

  const filtros: Filtros = useMemo(
    () => ({
      de: intervalo.de,
      ate: intervalo.ate,
      empresa: escopo === "store" ? "CONSOLIDADO" : empresa,
      vendedores,
      modelos,
      cores,
      tamanhos,
      situacoes,
      grupos: soPcpAtivo ? grupos : (["casados", "so_olist"] as Grupo[]),
    }),
    [intervalo, empresa, escopo, vendedores, modelos, cores, tamanhos, situacoes, grupos, soPcpAtivo],
  );

  const ctx = useMemo(
    () => ({
      excluidos: data?.excluidos ?? new Set<string>(),
      noPcp: soPcpAtivo ? (data?.noPcp ?? new Set<string>()) : new Set<string>(),
    }),
    [data, soPcpAtivo],
  );

  // O recorte por vendedor sai do aplicarFiltros e passa a usar a regra de união (Olist OU PCP).
  const atuaisSemFaixa = useMemo(
    () =>
      filtrarPorVendedor(
        aplicarFiltros(base, { ...filtros, vendedores: [] }, ctx),
        vendedores,
        vendedorPcpPorPedido,
      ),
    [base, filtros, ctx, vendedores, vendedorPcpPorPedido],
  );
  const anterioresSemFaixa = useMemo(() => {
    if (!comparar) return [];
    const p = periodoAnterior(intervalo.de, intervalo.ate);
    return filtrarPorVendedor(
      aplicarFiltros(base, { ...filtros, vendedores: [], de: p.de, ate: p.ate }, ctx),
      vendedores,
      vendedorPcpPorPedido,
    );
  }, [comparar, base, filtros, ctx, intervalo, vendedores, vendedorPcpPorPedido]);

  const atuais = useMemo(
    () => filtrarPorFaixaQtd(atuaisSemFaixa, faixaQtd),
    [atuaisSemFaixa, faixaQtd],
  );
  const anteriores = useMemo(
    () => filtrarPorFaixaQtd(anterioresSemFaixa, faixaQtd),
    [anterioresSemFaixa, faixaQtd],
  );
  const faixasLinhas = useMemo(() => porFaixaQtd(atuaisSemFaixa), [atuaisSemFaixa]);



  const r = useMemo(() => resumo(atuais), [atuais]);
  const rAnt = useMemo(() => resumo(anteriores), [anteriores]);
  const mensal = useMemo(() => evolucaoMensal(atuais), [atuais]);
  const situacoesLinhas = useMemo(() => porSituacao(atuais), [atuais]);
  const rankModelo = useMemo(() => ranking(atuais, "modelo"), [atuais]);
  const abcModelo = useMemo(() => curvaAbc(rankModelo), [rankModelo]);
  const clientes = useMemo(
    () => abcClientes(porCliente(atuais, primeiraCompra, intervalo.de)),
    [atuais, primeiraCompra, intervalo.de],
  );
  const vendedoresLinhas = useMemo(() => porVendedor(atuais), [atuais]);
  const frete = useMemo(() => resumoFrete(atuais, data?.ufPorPedido ?? new Map()), [atuais, data]);
  const gradeTam = useMemo(() => gradePorModelo(atuais, "tamanho"), [atuais]);
  const gradeCor = useMemo(() => gradePorModelo(atuais, "cor"), [atuais]);

  /* ---- Fase 5 — cruzamento com o PCP ---- */
  const { feriados } = useFeriados();
  const pcpPorPedido = data?.pcpPorPedido ?? new Map<string, PcpDb>();
  const ufLinhas = useMemo(
    () => (soPcpAtivo ? porUf(atuais, data?.ufPorPedido ?? new Map()) : []),
    [atuais, data, soPcpAtivo],
  );
  const vxp = useMemo(
    () => vendidoVsProduzido(soPcpAtivo ? atuais : [], pcpPorPedido),
    [atuais, pcpPorPedido, soPcpAtivo],
  );
  const pcpPeriodo = useMemo(
    () =>
      (soPcpAtivo ? (data?.pcpLista ?? []) : []).filter(
        (r) =>
          r.entrada_pedido &&
          r.entrada_pedido >= intervalo.de &&
          r.entrada_pedido <= intervalo.ate &&
          pcpNoRecorteVendedor(r, vendedores),
      ),
    [data, intervalo, vendedores, soPcpAtivo],
  );
  const prod = useMemo(() => produtividadePcp(pcpPeriodo, feriados), [pcpPeriodo, feriados]);
  const saude = useMemo(
    () =>
      saudeCadastro(
        soPcpAtivo ? atuais : [],
        pcpPorPedido,
        data?.modeloPorProduto ?? new Map(),
        soPcpAtivo ? (data?.soPcp ?? []) : [],
      ),
    [atuais, pcpPorPedido, data, soPcpAtivo],
  );

  const mostraSoPcp = soPcpAtivo && grupos.includes("so_pcp");
  const soPcpLista = useMemo(() => {
    const lista = soPcpAtivo ? (data?.soPcp ?? []) : [];
    if (vendedores.length === 0) return lista;
    const ags = data?.pcpAgregado ?? new Map<string, PcpAgregado<PcpDrill>>();
    return lista.filter((num) => {
      const ag = ags.get(basePedidoOlist(num));
      return ag ? pcpNoRecorteVendedor({ vendedor: ag.vendedor }, vendedores) : false;
    });
  }, [data, vendedores, soPcpAtivo]);

  /* Registros consolidados do PCP para os pedidos "Somente PCP" (peças somadas dos parciais). */
  const soPcpRegs = useMemo(() => {
    const ags = data?.pcpAgregado ?? new Map<string, PcpAgregado<PcpDrill>>();
    return soPcpLista
      .map((num) => {
        const ag = ags.get(basePedidoOlist(num));
        return ag ? registroConsolidado(ag) : undefined;
      })
      .filter((r): r is PcpDrill => Boolean(r));
  }, [data, soPcpLista]);


  const soPcpResumo = useMemo(() => {
    const pecas = soPcpRegs.reduce((a, r) => a + (Number(r.qtd) || 0), 0);
    const comQtd = soPcpRegs.filter((r) => Number(r.qtd) > 0).length;
    const finalizados = soPcpRegs.filter((r) => Boolean(r.finalizado_em)).length;
    const vendedoresDistintos = new Set(
      soPcpRegs.map((r) => String(r.vendedor ?? "").trim()).filter(Boolean),
    ).size;
    return {
      pedidos: soPcpLista.length,
      pecas,
      mediaPecas: comQtd > 0 ? pecas / comQtd : 0,
      finalizados,
      emAberto: soPcpRegs.length - finalizados,
      vendedoresDistintos,
      semRegistro: soPcpLista.length - soPcpRegs.length,
    };
  }, [soPcpRegs, soPcpLista]);

  /* ---- Juff Store: composição e diagnóstico de descrição (só classificação) ---- */
  const ehStore = escopo === "store";
  const composicao = useMemo(() => (ehStore ? composicaoStore(atuais) : null), [ehStore, atuais]);
  const foraPadrao = useMemo(() => (ehStore ? descricoesForaPadrao(atuais) : []), [ehStore, atuais]);
  const rankEstampas = useMemo(() => (ehStore ? rankingStore(atuais, "estampa") : []), [ehStore, atuais]);


  /* ---- Detalhamento (drill-down), somente leitura ---- */
  const nomes = useProfilesMap();
  /* No escopo Store não há PCP: nada de UF nos detalhamentos. */
  const ufMapaDrill = soPcpAtivo ? (data?.ufPorPedido ?? new Map<string, string>()) : new Map<string, string>();
  const [drill, setDrill] = useState<DrillPayload | null>(null);

  /* ---- Exceção manual de escopo: mover pedido entre Juff Store e Juff Custom ---- */
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const isGestor = useHasRole("gestor");
  const podeMoverEscopo = isAdmin || isGestor;
  const [movendo, setMovendo] = useState<string | null>(null);
  const ehStoreAuto = (numero: string) => {
    const store = data?.pedidosStore ?? new Set<string>();
    const p = (data?.calc ?? []).find((x) => x.numero_pedido === numero);
    return store.has(numero) && p?.empresa === "JOKE";
  };
  const moverEscopo = async (numero: string, destino: "custom" | "store") => {
    setMovendo(numero);
    try {
      const auto = ehStoreAuto(numero) ? "store" : "custom";
      if (destino === auto) {
        const { error } = await supabase.from("kpi_pedido_escopo" as any).delete().eq("numero_pedido", numero);
        if (error) throw error;
      } else {
        const { data: sess } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("kpi_pedido_escopo" as any)
          .upsert(
            { numero_pedido: numero, escopo: destino, definido_por: sess.user?.id ?? null, definido_em: new Date().toISOString() },
            { onConflict: "numero_pedido" },
          );
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["indicadores-olist", "base"] });
      setDrill(null);
      toast.success(
        `Pedido ${numero} movido para ${destino === "store" ? "Juff Store" : "Juff Custom"}.`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível mover o pedido.");
    } finally {
      setMovendo(null);
    }
  };

  const abrirDrill = (p: DrillPayload) => {
    const temNumero = p.colunas.some((c) => c.chave === "numero_pedido");
    if (podeMoverEscopo && temNumero) {
      setDrill({
        ...p,
        acaoEscopo: {
          chaveNumero: "numero_pedido",
          escopoAtual: escopo,
          ehStoreAuto,
          onMover: (numero, destino) => void moverEscopo(numero, destino),
          pendente: movendo,
        },
      });
      return;
    }
    setDrill(p);
  };
  const subPcp = `Entrada entre ${intervalo.de} e ${intervalo.ate}`;
  const subOlist = `Período ${intervalo.de} a ${intervalo.ate} · filtros do painel aplicados`;


  const exportarPdf = () => {
    void abrirIndicadoresParaImpressao({
      escopoLabel: soPcpAtivo ? "Juff Custom" : "Juff Store",
      periodo: intervalo,
      comparar,
      periodoAnterior: comparar ? periodoAnterior(intervalo.de, intervalo.ate) : null,
      filtros: {
        empresa: escopo === "store" ? "JOKE" : empresa,
        vendedores: labelsVendSelecionados,

        modelos,
        cores,
        tamanhos,
        situacoes,
        grupos: soPcpAtivo ? grupos.map((g) => GRUPOS.find((x) => x.v === g)?.label ?? g) : [],
      },
      resumo: r,
      resumoAnterior: rAnt,
      mensal,
      situacoes: situacoesLinhas,
      rankings: RANKINGS.map((cfg) => ({ titulo: cfg.titulo, linhas: ranking(atuais, cfg.dim) })),
      gradeTamanho: gradeTam,
      gradeCor,
      abcModelo,
      clientes,
      vendedores: vendedoresLinhas,
      frete,
      ufs: soPcpAtivo ? ufLinhas : undefined,
      vendidoProduzido: soPcpAtivo ? vxp : undefined,
      producao: soPcpAtivo ? prod : undefined,
      saude: soPcpAtivo ? saude : undefined,
      composicaoStore: composicao ?? undefined,
      rankingEstampas: ehStore ? rankEstampas : undefined,

    });
  };

  const exportarPdfFaixas = () => {
    const linhas = faixasLinhas.map((l) => {
      const pedidosFaixa = atuaisSemFaixa.filter((p) => faixaDoPedido(p) === l.faixa);
      const top = ranking(pedidosFaixa, "modelo")[0] ?? null;
      return {
        ...l,
        precoMedio: l.pecas ? l.faturamento / l.pecas : 0,
        topModelo: top ? { nome: top.chave, pecas: top.pecas } : null,
      };
    });
    const topGeral = ranking(atuaisSemFaixa, "modelo")[0] ?? null;
    void abrirFaixasQtdParaImpressao({
      periodo: intervalo,
      filtros: {
        empresa: escopo === "store" ? "JOKE" : empresa,
        vendedores: labelsVendSelecionados,
        modelos,
        cores,
        tamanhos,
        situacoes,
        grupos: soPcpAtivo ? grupos.map((g) => GRUPOS.find((x) => x.v === g)?.label ?? g) : [],
      },
      linhas,
      totalTopModelo: topGeral ? { nome: topGeral.chave, pecas: topGeral.pecas } : null,
    });
  };




  return (
    <div className="space-y-4">
      {/* ---------------- Filtros ---------------- */}
      <div className="sticky top-[68px] z-40 -mx-1 space-y-2 rounded-md border bg-background p-3 shadow-sm">

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={preset}
            onValueChange={(v) => {
              const p = v as Preset;
              setPreset(p);
              if (p !== "livre") setIntervalo(intervaloPreset(p));
            }}
          >
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Mês atual</SelectItem>
              <SelectItem value="mes_ant">Mês anterior</SelectItem>
              <SelectItem value="d30">Últimos 30 dias</SelectItem>
              <SelectItem value="d60">Últimos 60 dias</SelectItem>
              <SelectItem value="d90">Últimos 90 dias</SelectItem>
              <SelectItem value="ano">Ano atual</SelectItem>
              <SelectItem value="livre">Intervalo livre</SelectItem>
            </SelectContent>
          </Select>

          <input
            type="date"
            className="h-9 rounded-md border bg-background px-2 text-xs"
            value={intervalo.de}
            onChange={(e) => {
              setPreset("livre");
              setIntervalo((p) => ({ ...p, de: e.target.value }));
            }}
          />
          <span className="text-xs text-muted-foreground">até</span>
          <input
            type="date"
            className="h-9 rounded-md border bg-background px-2 text-xs"
            value={intervalo.ate}
            onChange={(e) => {
              setPreset("livre");
              setIntervalo((p) => ({ ...p, ate: e.target.value }));
            }}
          />

          <div className="flex items-center gap-2 pl-2">
            <Switch id="comparar" checked={comparar} onCheckedChange={setComparar} />
            <Label htmlFor="comparar" className="text-xs">
              Comparar com período anterior
            </Label>
          </div>

          {escopo !== "store" && (
            <Select value={empresa} onValueChange={(v) => setEmpresa(v as EmpresaFiltro)}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONSOLIDADO">Consolidado</SelectItem>
                <SelectItem value="JOKE">JOKE</SelectItem>
                <SelectItem value="JUFF">JUFF</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Button variant="outline" size="sm" className="h-9 gap-2" onClick={exportarPdf} disabled={isLoading}>
            <FileDown className="h-4 w-4" /> Exportar PDF
          </Button>


          <Button variant="outline" size="icon" className="h-9 w-9" title="Recarregar" onClick={() => refetch()}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect label="Vendedor" opcoes={opcoesVendMulti} valor={vendedores} onChange={setVendedores} />
          <MultiSelect label="Modelo" opcoes={opcoes.modelos} valor={modelos} onChange={setModelos} />
          <MultiSelect label="Cor" opcoes={opcoes.cores} valor={cores} onChange={setCores} />
          <MultiSelect label="Tamanho" opcoes={opcoes.tamanhos} valor={tamanhos} onChange={setTamanhos} />
          <MultiSelect label="Situação" opcoes={opcoes.situacoes} valor={situacoes} onChange={setSituacoes} />
          {soPcpAtivo && (
            <Select value={faixaQtd} onValueChange={(v) => setFaixaQtd(v as FaixaQtd)}>
              <SelectTrigger className="h-9 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as faixas</SelectItem>
                {FAIXAS_QTD.map((f) => (
                  <SelectItem key={f.v} value={f.v}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {ehStore && (
            <>
              <Select value={tipoPeca} onValueChange={(v) => setTipoPeca(v as typeof tipoPeca)}>
                <SelectTrigger className="h-9 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as peças</SelectItem>
                  <SelectItem value="lisas">Lisas</SelectItem>
                  <SelectItem value="estampadas">Estampadas</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex cursor-pointer items-center gap-1 pl-1 text-xs">
                <Checkbox checked={somenteOutlet} onCheckedChange={(c) => setSomenteOutlet(c === true)} />
                Somente Outlet
              </label>
            </>
          )}

          {soPcpAtivo && (
          <div className="flex flex-wrap items-center gap-2 pl-2">
            {GRUPOS.map((g) => (
              <label key={g.v} className="flex cursor-pointer items-center gap-1 text-xs">
                <Checkbox
                  checked={grupos.includes(g.v)}
                  onCheckedChange={(c) =>
                    setGrupos((prev) => (c ? [...prev, g.v] : prev.filter((x) => x !== g.v)))
                  }
                />
                {g.label}
              </label>
            ))}
          </div>
          )}
        </div>
      </div>

      <div className="text-xs font-medium text-muted-foreground">
        {soPcpAtivo
          ? "Indicadores — Juff Custom (atacado · sincronizado com o PCP)"
          : "Indicadores — Juff Store (e-commerce · independente do PCP)"}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados da Olist…
        </div>
      )}

      {/* ---------------- Bloco 1 — Resumo ---------------- */}
      <div className="grid gap-2 md:grid-cols-5">
        <Kpi
          titulo="Faturamento"
          valor={fmtMoeda(r.faturamento)}
          varPerc={variacao(r.faturamento, rAnt.faturamento)}
          comparar={comparar}
          onDrill={() =>
            abrirDrill(
              drillPedidos(atuais, {
                titulo: "Faturamento do período",
                subtitulo: subOlist,
                indicadorLabel: fmtMoeda(r.faturamento),
                indicadorValor: r.faturamento,
                campo: "faturamento",
              }),
            )
          }
        />
        <Kpi
          titulo="Pedidos"
          valor={fmtNum(r.pedidos)}
          varPerc={variacao(r.pedidos, rAnt.pedidos)}
          comparar={comparar}
          onDrill={() =>
            abrirDrill(
              drillPedidos(atuais, {
                titulo: "Pedidos do período",
                subtitulo: subOlist,
                indicadorLabel: fmtNum(r.pedidos),
                indicadorValor: r.pedidos,
                campo: "linhas",
              }),
            )
          }
        />
        <Kpi
          titulo="Peças vendidas"
          valor={fmtNum(r.pecas)}
          varPerc={variacao(r.pecas, rAnt.pecas)}
          comparar={comparar}
          onDrill={() =>
            abrirDrill(
              drillPedidos(atuais, {
                titulo: "Peças vendidas no período",
                subtitulo: subOlist,
                nota: "Serviços não contam como peça.",
                indicadorLabel: fmtNum(r.pecas),
                indicadorValor: r.pecas,
                campo: "pecas",
              }),
            )
          }
        />
        <Kpi
          titulo="Ticket médio"
          valor={fmtMoeda(r.ticket)}
          varPerc={variacao(r.ticket, rAnt.ticket)}
          comparar={comparar}
          onDrill={() =>
            abrirDrill(
              drillPedidos(atuais, {
                titulo: "Ticket médio — pedidos que compõem a média",
                subtitulo: subOlist,
                indicadorLabel: fmtMoeda(r.ticket),
                indicadorValor: r.ticket,
                campo: "faturamento",
                media: true,
              }),
            )
          }
        />
        <Kpi
          titulo="Preço médio/peça"
          valor={fmtMoeda(r.precoMedio)}
          varPerc={variacao(r.precoMedio, rAnt.precoMedio)}
          comparar={comparar}
          onDrill={() =>
            abrirDrill(
              drillItens(atuais, {
                titulo: "Preço médio por peça — itens que compõem a média",
                subtitulo: subOlist,
                nota: "Preço médio = faturamento líquido ÷ peças. Confira dividindo o total de subtotal pelo total de peças.",
                indicadorLabel: fmtMoeda(r.precoMedio),
                indicadorValor: null,
                campo: "subtotal",
                filtro: () => true,
              }),
            )
          }
        />
      </div>

      {/* ---------------- Composição Juff Store ---------------- */}
      {composicao && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Composição Juff Store</CardTitle>
            <div className="text-xs text-muted-foreground">
              Kit Outlet é peça lisa de ponta de estoque: entra nas Lisas e aparece também como recorte próprio.
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              {([
                { t: "Lisas (inclui Outlet)", d: composicao.lisas },
                { t: "Estampadas", d: composicao.estampadas },
              ] as const).map((b) => (
                <div key={b.t} className="rounded-md border p-3">
                  <div className="text-xs font-semibold">{b.t}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">{fmtMoeda(b.d.faturamento)}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {b.d.percFaturamento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da receita ·{" "}
                    {fmtNum(b.d.pecas)} peças · {fmtNum(b.d.pedidos)} pedidos
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    Ticket médio {fmtMoeda(b.d.ticket)} · preço médio/peça {fmtMoeda(b.d.precoMedio)}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-md border border-dashed p-3">
              <div className="text-xs font-semibold">Outlet — recorte das Lisas</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{fmtMoeda(composicao.outlet.faturamento)}</div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {composicao.outlet.percFaturamento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da receita do
                período · {fmtNum(composicao.outlet.pecas)} peças · preço médio/peça{" "}
                {fmtMoeda(composicao.outlet.precoMedio)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------- Bloco 12 — Rankings (prioritário) ---------------- */}
      <Card className="border-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rankings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {ehStore
            ? RANKINGS_STORE.map((cfg) => (
                <RankingCard
                  key={cfg.dimStore}
                  titulo={cfg.titulo}
                  dim={cfg.dim}
                  dimStore={cfg.dimStore}
                  atuais={rankingStore(atuais, cfg.dimStore)}
                  anteriores={comparar ? rankingStore(anteriores, cfg.dimStore) : null}
                  pedidos={atuais}
                  subtitulo={subOlist}
                  onDrill={abrirDrill}
                />
              ))
            : RANKINGS.map((cfg) => (
                <RankingCard
                  key={cfg.dim}
                  titulo={cfg.titulo}
                  dim={cfg.dim}
                  atuais={ranking(atuais, cfg.dim)}
                  anteriores={comparar ? ranking(anteriores, cfg.dim) : null}
                  pedidos={atuais}
                  subtitulo={subOlist}
                  onDrill={abrirDrill}
                />
              ))}
        </CardContent>
      </Card>


      <div className="grid gap-4 lg:grid-cols-2">
        <GradeCard
          titulo="Tamanhos por modelo (% dentro do modelo)"
          grade={gradeTam}
          dim="tamanho"
          pedidos={atuais}
          subtitulo={subOlist}
          onDrill={abrirDrill}
        />
        <GradeCard
          titulo="Cores por modelo (% dentro do modelo)"
          grade={gradeCor}
          dim="cor"
          pedidos={atuais}
          subtitulo={subOlist}
          onDrill={abrirDrill}
        />
      </div>

      {/* ---------------- Bloco 2 — Faturamento ---------------- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Faturamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mensal.map((m) => ({ ...m, mesLabel: fmtMes(m.mes) }))}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="mesLabel" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => fmtNum(Number(v))} />
                <RTooltip formatter={(v: any) => fmtMoeda(Number(v))} />
                <Legend />
                <Bar dataKey="joke" name="JOKE" stackId="a" fill="hsl(var(--primary))" />
                <Bar dataKey="juff" name="JUFF" stackId="a" fill="hsl(var(--muted-foreground))" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-auto">
              <table className="tbl-congelada w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left">Mês</th>
                    <th className="px-2 py-1 text-right">Faturamento</th>
                    <th className="px-2 py-1 text-right">JOKE</th>
                    <th className="px-2 py-1 text-right">JUFF</th>
                    <th className="px-2 py-1 text-right">Pedidos</th>
                    <th className="px-2 py-1 text-right">Peças</th>
                  </tr>
                </thead>
                <tbody>
                  {mensal.map((m) => {
                    const mesPedidos = atuais.filter((p) => p.mes === m.mes);
                    const cel = (
                      valor: number,
                      tipo: "moeda" | "num",
                      campo: "faturamento" | "pecas" | "linhas",
                      titulo: string,
                      empresaAlvo?: "JOKE" | "JUFF",
                      forte?: boolean,
                    ) => (
                      <td className={`px-2 py-1 text-right tabular-nums ${forte ? "font-semibold" : ""}`}>
                        <ValorDrill
                          onDrill={abrirDrill}
                          build={() =>
                            drillPedidos(
                              empresaAlvo ? mesPedidos.filter((p) => p.empresa === empresaAlvo) : mesPedidos,
                              {
                                titulo,
                                subtitulo: `${fmtMes(m.mes)} · ${subOlist}`,
                                indicadorLabel: tipo === "moeda" ? fmtMoeda(valor) : fmtNum(valor),
                                indicadorValor: valor,
                                campo,
                              },
                            )
                          }
                        >
                          {tipo === "moeda" ? fmtMoeda(valor) : fmtNum(valor)}
                        </ValorDrill>
                      </td>
                    );
                    return (
                      <tr key={m.mes} className="border-t">
                        <td className="px-2 py-1">{fmtMes(m.mes)}</td>
                        {cel(m.faturamento, "moeda", "faturamento", `Faturamento — ${fmtMes(m.mes)}`, undefined, true)}
                        {cel(m.joke, "moeda", "faturamento", `Faturamento JOKE — ${fmtMes(m.mes)}`, "JOKE")}
                        {cel(m.juff, "moeda", "faturamento", `Faturamento JUFF — ${fmtMes(m.mes)}`, "JUFF")}
                        {cel(m.pedidos, "num", "linhas", `Pedidos — ${fmtMes(m.mes)}`)}
                        {cel(m.pecas, "num", "pecas", `Peças — ${fmtMes(m.mes)}`)}
                      </tr>
                    );
                  })}

                  {mensal.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">
                        Sem dados no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-auto">
              <table className="tbl-congelada w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left">Situação</th>
                    <th className="px-2 py-1 text-right">Pedidos</th>
                    <th className="px-2 py-1 text-right">Peças</th>
                    <th className="px-2 py-1 text-right">Faturamento</th>
                    <th className="px-2 py-1 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {situacoesLinhas.map((s) => {
                    const linhasSit = atuais.filter((p) => p.situacao === s.chave);
                    const cel = (
                      valor: number,
                      tipo: "moeda" | "num",
                      campo: "faturamento" | "pecas" | "linhas",
                      titulo: string,
                    ) => (
                      <td className="px-2 py-1 text-right tabular-nums">
                        <ValorDrill
                          onDrill={abrirDrill}
                          build={() =>
                            drillPedidos(linhasSit, {
                              titulo,
                              subtitulo: `Situação "${s.chave}" · ${subOlist}`,
                              indicadorLabel: tipo === "moeda" ? fmtMoeda(valor) : fmtNum(valor),
                              indicadorValor: valor,
                              campo,
                            })
                          }
                        >
                          {tipo === "moeda" ? fmtMoeda(valor) : fmtNum(valor)}
                        </ValorDrill>
                      </td>
                    );
                    return (
                      <tr key={s.chave} className="border-t">
                        <td className="px-2 py-1">{s.chave}</td>
                        {cel(s.pedidos, "num", "linhas", `Pedidos — ${s.chave}`)}
                        {cel(s.pecas, "num", "pecas", `Peças — ${s.chave}`)}
                        {cel(s.faturamento, "moeda", "faturamento", `Faturamento — ${s.chave}`)}
                        <td className="px-2 py-1 text-right tabular-nums">{s.perc.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Bloco 3 — Produto ---------------- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Produto — composição e curva ABC</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-auto">
            <div className="mb-1 text-xs font-semibold">Composição por receita</div>
            <table className="tbl-congelada w-full text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">Modelo</th>
                  <th className="px-2 py-1 text-right">Faturamento</th>
                  <th className="px-2 py-1 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {[...rankModelo]
                  .sort((a, b) => b.faturamento - a.faturamento)
                  .map((l) => (
                    <tr key={l.chave} className="border-t">
                      <td className="px-2 py-1">{l.chave}</td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        <ValorDrill
                          onDrill={abrirDrill}
                          build={() =>
                            drillItens(atuais, {
                              titulo: `Receita do modelo ${l.chave}`,
                              subtitulo: subOlist,
                              indicadorLabel: fmtMoeda(l.faturamento),
                              indicadorValor: l.faturamento,
                              campo: "subtotal",
                              filtro: (i) => i.modelo === l.chave,
                            })
                          }
                        >
                          {fmtMoeda(l.faturamento)}
                        </ValorDrill>
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">{l.percFaturamento.toFixed(1)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-auto">
            <div className="mb-1 text-xs font-semibold">Composição por volume</div>
            <table className="tbl-congelada w-full text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">Modelo</th>
                  <th className="px-2 py-1 text-right">Peças</th>
                  <th className="px-2 py-1 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {[...rankModelo]
                  .sort((a, b) => b.pecas - a.pecas)
                  .map((l) => (
                    <tr key={l.chave} className="border-t">
                      <td className="px-2 py-1">{l.chave}</td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        <ValorDrill
                          onDrill={abrirDrill}
                          build={() =>
                            drillItens(atuais, {
                              titulo: `Peças do modelo ${l.chave}`,
                              subtitulo: subOlist,
                              indicadorLabel: fmtNum(l.pecas),
                              indicadorValor: l.pecas,
                              campo: "qtd",
                              filtro: (i) => i.modelo === l.chave,
                            })
                          }
                        >
                          {fmtNum(l.pecas)}
                        </ValorDrill>
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">{l.percPecas.toFixed(1)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-auto lg:col-span-2">
            <div className="mb-1 text-xs font-semibold">Curva ABC de modelo</div>
            <table className="tbl-congelada w-full text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">Modelo</th>
                  <th className="px-2 py-1 text-right">Faturamento</th>
                  <th className="px-2 py-1 text-right">Peças</th>
                  <th className="px-2 py-1 text-right">% acumulado</th>
                  <th className="px-2 py-1 text-center">Classe</th>
                </tr>
              </thead>
              <tbody>
                {abcModelo.map((l) => (
                  <tr key={l.chave} className="border-t">
                    <td className="px-2 py-1">{l.chave}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      <ValorDrill
                        onDrill={abrirDrill}
                        build={() =>
                          drillItens(atuais, {
                            titulo: `Curva ABC — receita do modelo ${l.chave} (classe ${l.classe})`,
                            subtitulo: subOlist,
                            indicadorLabel: fmtMoeda(l.faturamento),
                            indicadorValor: l.faturamento,
                            campo: "subtotal",
                            filtro: (i) => i.modelo === l.chave,
                          })
                        }
                      >
                        {fmtMoeda(l.faturamento)}
                      </ValorDrill>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      <ValorDrill
                        onDrill={abrirDrill}
                        build={() =>
                          drillItens(atuais, {
                            titulo: `Curva ABC — peças do modelo ${l.chave} (classe ${l.classe})`,
                            subtitulo: subOlist,
                            indicadorLabel: fmtNum(l.pecas),
                            indicadorValor: l.pecas,
                            campo: "qtd",
                            filtro: (i) => i.modelo === l.chave,
                          })
                        }
                      >
                        {fmtNum(l.pecas)}
                      </ValorDrill>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{l.acumulado.toFixed(1)}%</td>
                    <td className="px-2 py-1 text-center">
                      <Badge variant={l.classe === "A" ? "default" : "secondary"}>{l.classe}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Bloco 4 — Clientes ---------------- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Clientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-4 text-xs">
            <span>
              Novos:{" "}
              <ValorDrill
                onDrill={abrirDrill}
                build={() =>
                  drillClientes(
                    clientes.filter((c) => c.novo),
                    primeiraCompra,
                    {
                      titulo: "Clientes novos no período",
                      subtitulo: `${subOlist} · primeira compra apurada em todo o histórico`,
                      indicadorLabel: fmtNum(clientes.filter((c) => c.novo).length),
                      indicadorValor: clientes.filter((c) => c.novo).length,
                    },
                  )
                }
                className="font-semibold tabular-nums"
              >
                {clientes.filter((c) => c.novo).length}
              </ValorDrill>
            </span>
            <span>
              Recorrentes:{" "}
              <ValorDrill
                onDrill={abrirDrill}
                build={() =>
                  drillClientes(
                    clientes.filter((c) => !c.novo),
                    primeiraCompra,
                    {
                      titulo: "Clientes recorrentes no período",
                      subtitulo: `${subOlist} · primeira compra apurada em todo o histórico`,
                      indicadorLabel: fmtNum(clientes.filter((c) => !c.novo).length),
                      indicadorValor: clientes.filter((c) => !c.novo).length,
                    },
                  )
                }
                className="font-semibold tabular-nums"
              >
                {clientes.filter((c) => !c.novo).length}
              </ValorDrill>
            </span>
            <span className="text-muted-foreground">
              (a primeira compra é apurada sobre todo o histórico, não sobre o período filtrado)
            </span>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="tbl-congelada w-full text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">Cliente</th>
                  <th className="px-2 py-1 text-left">CPF/CNPJ</th>
                  <th className="px-2 py-1 text-right">Pedidos</th>
                  <th className="px-2 py-1 text-right">Peças</th>
                  <th className="px-2 py-1 text-right">Faturamento</th>
                  <th className="px-2 py-1 text-right">%</th>
                  <th className="px-2 py-1 text-right">% acum.</th>
                  <th className="px-2 py-1 text-center">Classe</th>
                  <th className="px-2 py-1 text-center">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.cliente_id} className="border-t">
                    <td className="px-2 py-1">
                      <ValorDrill
                        onDrill={abrirDrill}
                        build={() =>
                          drillPedidos(
                            atuais.filter((p) => p.cliente_id === c.cliente_id),
                            {
                              titulo: `Pedidos de ${c.nome}`,
                              subtitulo: subOlist,
                              indicadorLabel: fmtMoeda(c.faturamento),
                              indicadorValor: c.faturamento,
                              campo: "faturamento",
                            },
                          )
                        }
                      >
                        {c.nome}
                      </ValorDrill>
                    </td>
                    <td className="px-2 py-1 tabular-nums">{c.cliente_id}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      <ValorDrill
                        onDrill={abrirDrill}
                        build={() =>
                          drillPedidos(
                            atuais.filter((p) => p.cliente_id === c.cliente_id),
                            {
                              titulo: `Pedidos de ${c.nome}`,
                              subtitulo: subOlist,
                              indicadorLabel: fmtNum(c.pedidos),
                              indicadorValor: c.pedidos,
                              campo: "linhas",
                            },
                          )
                        }
                      >
                        {fmtNum(c.pedidos)}
                      </ValorDrill>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      <ValorDrill
                        onDrill={abrirDrill}
                        build={() =>
                          drillPedidos(
                            atuais.filter((p) => p.cliente_id === c.cliente_id),
                            {
                              titulo: `Peças de ${c.nome}`,
                              subtitulo: subOlist,
                              indicadorLabel: fmtNum(c.pecas),
                              indicadorValor: c.pecas,
                              campo: "pecas",
                            },
                          )
                        }
                      >
                        {fmtNum(c.pecas)}
                      </ValorDrill>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      <ValorDrill
                        onDrill={abrirDrill}
                        build={() =>
                          drillPedidos(
                            atuais.filter((p) => p.cliente_id === c.cliente_id),
                            {
                              titulo: `Faturamento de ${c.nome}`,
                              subtitulo: subOlist,
                              indicadorLabel: fmtMoeda(c.faturamento),
                              indicadorValor: c.faturamento,
                              campo: "faturamento",
                            },
                          )
                        }
                      >
                        {fmtMoeda(c.faturamento)}
                      </ValorDrill>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{c.perc.toFixed(1)}%</td>
                    <td className="px-2 py-1 text-right tabular-nums">{c.acumulado.toFixed(1)}%</td>
                    <td className="px-2 py-1 text-center">
                      <Badge variant={c.classe === "A" ? "default" : "secondary"}>{c.classe}</Badge>
                    </td>
                    <td className="px-2 py-1 text-center">{c.novo ? "Novo" : "Recorrente"}</td>
                  </tr>
                ))}
                {clientes.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-2 py-4 text-center text-muted-foreground">
                      Sem dados no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Bloco 5 — Vendedores ---------------- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vendedores</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="tbl-congelada w-full text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left">Vendedor</th>
                <th className="px-2 py-1 text-right">Faturamento</th>
                <th className="px-2 py-1 text-right">Pedidos</th>
                <th className="px-2 py-1 text-right">Peças</th>
                <th className="px-2 py-1 text-right">Ticket médio</th>
                <th className="px-2 py-1 text-right">Preço médio/peça</th>
                <th className="px-2 py-1 text-right">Desconto (R$)</th>
                <th className="px-2 py-1 text-right">Desconto médio (%)</th>
              </tr>
            </thead>
            <tbody>
              {vendedoresLinhas.map((v) => (
                <tr key={v.vendedor} className="border-t">
                  <td className="px-2 py-1">{v.vendedor}</td>
                  <td className="px-2 py-1 text-right font-semibold tabular-nums">
                    <ValorDrill
                      onDrill={abrirDrill}
                      build={() =>
                        drillPedidos(
                          atuais.filter((p) => p.vendedor === v.vendedor),
                          {
                            titulo: `Faturamento — ${v.vendedor}`,
                            subtitulo: subOlist,
                            indicadorLabel: fmtMoeda(v.faturamento),
                            indicadorValor: v.faturamento,
                            campo: "faturamento",
                          },
                        )
                      }
                    >
                      {fmtMoeda(v.faturamento)}
                    </ValorDrill>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    <ValorDrill
                      onDrill={abrirDrill}
                      build={() =>
                        drillPedidos(
                          atuais.filter((p) => p.vendedor === v.vendedor),
                          {
                            titulo: `Pedidos — ${v.vendedor}`,
                            subtitulo: subOlist,
                            indicadorLabel: fmtNum(v.pedidos),
                            indicadorValor: v.pedidos,
                            campo: "linhas",
                          },
                        )
                      }
                    >
                      {fmtNum(v.pedidos)}
                    </ValorDrill>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    <ValorDrill
                      onDrill={abrirDrill}
                      build={() =>
                        drillPedidos(
                          atuais.filter((p) => p.vendedor === v.vendedor),
                          {
                            titulo: `Peças — ${v.vendedor}`,
                            subtitulo: subOlist,
                            indicadorLabel: fmtNum(v.pecas),
                            indicadorValor: v.pecas,
                            campo: "pecas",
                          },
                        )
                      }
                    >
                      {fmtNum(v.pecas)}
                    </ValorDrill>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    <ValorDrill
                      onDrill={abrirDrill}
                      build={() =>
                        drillPedidos(
                          atuais.filter((p) => p.vendedor === v.vendedor),
                          {
                            titulo: `Ticket médio — ${v.vendedor}`,
                            subtitulo: subOlist,
                            indicadorLabel: fmtMoeda(v.ticket),
                            indicadorValor: v.ticket,
                            campo: "faturamento",
                            media: true,
                          },
                        )
                      }
                    >
                      {fmtMoeda(v.ticket)}
                    </ValorDrill>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {v.pecas > 0 ? (
                      <ValorDrill
                        onDrill={abrirDrill}
                        build={() =>
                          drillPedidos(
                            atuais.filter((p) => p.vendedor === v.vendedor),
                            {
                              titulo: `Preço médio/peça — ${v.vendedor}`,
                              subtitulo: subOlist,
                              indicadorLabel: fmtMoeda(v.faturamento / v.pecas),
                              indicadorValor: v.faturamento / v.pecas,
                              campo: "faturamento",
                              media: true,
                            },
                          )
                        }
                      >
                        {fmtMoeda(v.faturamento / v.pecas)}
                      </ValorDrill>
                    ) : (
                      fmtMoeda(0)
                    )}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmtMoeda(v.descontoValor)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{v.descontoPerc.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ---------------- Faixas de tamanho de pedido (só Custom) ---------------- */}
      {soPcpAtivo && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Faixas de tamanho de pedido</CardTitle>
              <CardDescription>Peças por pedido · período e demais filtros aplicados</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-2" onClick={exportarPdfFaixas} disabled={isLoading}>
              <FileDown className="h-4 w-4" /> PDF por faixa
            </Button>
          </CardHeader>
          <CardContent className="overflow-auto">
            <table className="tbl-congelada w-full text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">Faixa</th>
                  <th className="px-2 py-1 text-right">Pedidos</th>
                  <th className="px-2 py-1 text-right">% pedidos</th>
                  <th className="px-2 py-1 text-right">Peças</th>
                  <th className="px-2 py-1 text-right">Faturamento</th>
                  <th className="px-2 py-1 text-right">% faturamento</th>
                  <th className="px-2 py-1 text-right">Ticket médio</th>
                </tr>
              </thead>
              <tbody>
                {faixasLinhas.map((l) => {
                  const sel = faixaQtd === l.faixa;
                  const pedidosFaixa = atuaisSemFaixa.filter((p) => faixaDoPedido(p) === l.faixa);
                  return (
                    <tr key={l.faixa} className={`border-t ${sel ? "bg-muted/50 font-semibold" : ""}`}>
                      <td className="px-2 py-1">
                        <button
                          type="button"
                          className="text-left underline-offset-2 hover:underline"
                          onClick={() => setFaixaQtd(sel ? "todas" : l.faixa)}
                        >
                          {l.label}
                        </button>
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {l.pedidos > 0 ? (
                          <ValorDrill
                            onDrill={abrirDrill}
                            build={() =>
                              drillPedidos(pedidosFaixa, {
                                titulo: `Pedidos — ${l.label}`,
                                subtitulo: subOlist,
                                indicadorLabel: fmtNum(l.pedidos),
                                indicadorValor: l.pedidos,
                                campo: "linhas",
                              })
                            }
                          >
                            {fmtNum(l.pedidos)}
                          </ValorDrill>
                        ) : (
                          fmtNum(l.pedidos)
                        )}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">{l.pctPedidos.toFixed(1)}%</td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {l.pecas > 0 ? (
                          <ValorDrill
                            onDrill={abrirDrill}
                            build={() =>
                              drillPedidos(pedidosFaixa, {
                                titulo: `Peças — ${l.label}`,
                                subtitulo: subOlist,
                                indicadorLabel: fmtNum(l.pecas),
                                indicadorValor: l.pecas,
                                campo: "pecas",
                              })
                            }
                          >
                            {fmtNum(l.pecas)}
                          </ValorDrill>
                        ) : (
                          fmtNum(l.pecas)
                        )}
                      </td>
                      <td className="px-2 py-1 text-right font-semibold tabular-nums">
                        {l.pedidos > 0 ? (
                          <ValorDrill
                            onDrill={abrirDrill}
                            build={() =>
                              drillPedidos(pedidosFaixa, {
                                titulo: `Faturamento — ${l.label}`,
                                subtitulo: subOlist,
                                indicadorLabel: fmtMoeda(l.faturamento),
                                indicadorValor: l.faturamento,
                                campo: "faturamento",
                              })
                            }
                          >
                            {fmtMoeda(l.faturamento)}
                          </ValorDrill>
                        ) : (
                          fmtMoeda(l.faturamento)
                        )}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">{l.pctFaturamento.toFixed(1)}%</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtMoeda(l.ticket)}</td>
                    </tr>
                  );
                })}
                {(() => {
                  const tPed = faixasLinhas.reduce((s, l) => s + l.pedidos, 0);
                  const tPec = faixasLinhas.reduce((s, l) => s + l.pecas, 0);
                  const tFat = faixasLinhas.reduce((s, l) => s + l.faturamento, 0);
                  return (
                    <tr className="border-t-2 font-semibold">
                      <td className="px-2 py-1">Total</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtNum(tPed)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{tPed ? "100,0%" : "0,0%"}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtNum(tPec)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtMoeda(tFat)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{tFat ? "100,0%" : "0,0%"}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtMoeda(tPed ? tFat / tPed : 0)}</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}



      {/* ---------------- Bloco 10 — Frete ---------------- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Frete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            O frete é apresentado separadamente e nunca é somado ao faturamento. A UF vem do PCP.
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <Kpi
              titulo="Frete total"
              valor={fmtMoeda(frete.total)}
              varPerc={null}
              comparar={false}
              onDrill={() =>
                abrirDrill(
                  drillPedidos(atuais, {
                    titulo: "Frete total",
                    subtitulo: subOlist,
                    nota: "O frete nunca é somado ao faturamento. UF vem do PCP.",
                    indicadorLabel: fmtMoeda(frete.total),
                    indicadorValor: frete.total,
                    campo: "frete",
                    ufPorPedido: ufMapaDrill,
                  }),
                )
              }
            />
            <Kpi
              titulo="Frete médio/pedido"
              valor={fmtMoeda(frete.medio)}
              varPerc={null}
              comparar={false}
              onDrill={() =>
                abrirDrill(
                  drillPedidos(atuais, {
                    titulo: "Frete médio por pedido",
                    subtitulo: subOlist,
                    indicadorLabel: fmtMoeda(frete.medio),
                    indicadorValor: frete.medio,
                    campo: "frete",
                    media: true,
                    ufPorPedido: ufMapaDrill,
                  }),
                )
              }
            />
            <Kpi
              titulo="Pedidos com frete"
              valor={`${frete.percComFrete.toFixed(1)}%`}
              varPerc={null}
              comparar={false}
              onDrill={() =>
                abrirDrill(
                  drillPedidos(
                    atuais.filter((p) => Number(p.frete ?? 0) > 0),
                    {
                      titulo: "Pedidos com frete",
                      subtitulo: subOlist,
                      nota: `${frete.percComFrete.toFixed(1)}% dos pedidos do período têm frete maior que zero.`,
                      indicadorLabel: `${frete.percComFrete.toFixed(1)}%`,
                      indicadorValor: null,
                      campo: "linhas",
                      ufPorPedido: ufMapaDrill,
                    },
                  ),
                )
              }
            />
          </div>
          {escopo === "custom" && (
          <div className="max-h-72 overflow-auto">
            <table className="tbl-congelada w-full text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">UF (PCP)</th>
                  <th className="px-2 py-1 text-right">Pedidos</th>
                  <th className="px-2 py-1 text-right">Peças</th>
                  <th className="px-2 py-1 text-right">Frete</th>
                </tr>
              </thead>
              <tbody>
                {frete.porUf.map((u) => {
                  const mapaUf = data?.ufPorPedido ?? new Map();
                  const linhasUf = atuais.filter((p) => (mapaUf.get(p.numero_pedido) ?? "—") === u.uf);
                  const cel = (valor: number, label: string, campo: "linhas" | "pecas" | "frete", titulo: string) => (
                    <td className="px-2 py-1 text-right tabular-nums">
                      <ValorDrill
                        onDrill={abrirDrill}
                        build={() =>
                          drillPedidos(linhasUf, {
                            titulo,
                            subtitulo: `UF ${u.uf} · ${subOlist}`,
                            indicadorLabel: label,
                            indicadorValor: valor,
                            campo,
                            ufPorPedido: mapaUf,
                          })
                        }
                      >
                        {label}
                      </ValorDrill>
                    </td>
                  );
                  return (
                    <tr key={u.uf} className="border-t">
                      <td className="px-2 py-1">{u.uf}</td>
                      {cel(u.pedidos, fmtNum(u.pedidos), "linhas", `Pedidos — ${u.uf}`)}
                      {cel(u.pecas, fmtNum(u.pecas), "pecas", `Peças — ${u.uf}`)}
                      {cel(u.frete, fmtMoeda(u.frete), "frete", `Frete — ${u.uf}`)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>

      {escopo === "custom" && (
        <>
      {/* ---------------- Bloco 6 — Distribuição geográfica ---------------- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Distribuição geográfica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            A UF de entrega vem sempre do PCP (<code>uf_entrega</code>). Pedido sem par no PCP aparece como “—”.
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ufLinhas.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="uf" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => fmtNum(Number(v))} />
                <RTooltip formatter={(v: any) => fmtMoeda(Number(v))} />
                <Bar dataKey="faturamento" name="Faturamento" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="tbl-congelada w-full text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">UF (PCP)</th>
                  <th className="px-2 py-1 text-right">Faturamento</th>
                  <th className="px-2 py-1 text-right">%</th>
                  <th className="px-2 py-1 text-right">Pedidos</th>
                  <th className="px-2 py-1 text-right">Peças</th>
                  <th className="px-2 py-1 text-right">Frete</th>
                </tr>
              </thead>
              <tbody>
                {ufLinhas.map((u) => {
                  const mapaUf = data?.ufPorPedido ?? new Map();
                  const linhasUf = atuais.filter((p) => (mapaUf.get(p.numero_pedido) ?? "—") === u.uf);
                  const cel = (
                    valor: number,
                    label: string,
                    campo: "faturamento" | "linhas" | "pecas" | "frete",
                    titulo: string,
                    className = "",
                  ) => (
                    <td className={`px-2 py-1 text-right tabular-nums ${className}`}>
                      <ValorDrill
                        onDrill={abrirDrill}
                        build={() =>
                          drillPedidos(linhasUf, {
                            titulo,
                            subtitulo: `UF ${u.uf} · ${subOlist}`,
                            indicadorLabel: label,
                            indicadorValor: valor,
                            campo,
                            ufPorPedido: mapaUf,
                          })
                        }
                      >
                        {label}
                      </ValorDrill>
                    </td>
                  );
                  return (
                    <tr key={u.uf} className="border-t">
                      <td className="px-2 py-1">{u.uf}</td>
                      {cel(u.faturamento, fmtMoeda(u.faturamento), "faturamento", `Faturamento — ${u.uf}`, "font-semibold")}
                      <td className="px-2 py-1 text-right tabular-nums">{u.perc.toFixed(1)}%</td>
                      {cel(u.pedidos, fmtNum(u.pedidos), "linhas", `Pedidos — ${u.uf}`)}
                      {cel(u.pecas, fmtNum(u.pecas), "pecas", `Peças — ${u.uf}`)}
                      {cel(u.frete, fmtMoeda(u.frete), "frete", `Frete — ${u.uf}`)}
                    </tr>
                  );
                })}
                {ufLinhas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">
                      Sem dados no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Bloco 7 — Vendido × Produzido ---------------- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vendido × Produzido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Comparação de totais, somente nos pedidos casados (existem na Olist e no PCP). Peças vendidas vêm dos
            itens da Olist; peças produzidas, da quantidade do pedido no PCP. A diferença é esperada: perdas e
            refações fazem a produção não coincidir com a venda — é informação, não erro.
          </div>
          <div className="grid gap-2 md:grid-cols-5">
            {(
              [
                { t: "Pedidos casados", v: vxp.total.pedidos, l: fmtNum(vxp.total.pedidos), c: "linhas" as const },
                { t: "Peças vendidas", v: vxp.total.vendidas, l: fmtNum(vxp.total.vendidas), c: "vendidas" as const },
                { t: "Peças produzidas", v: vxp.total.produzidas, l: fmtNum(vxp.total.produzidas), c: "produzidas" as const },
                { t: "Peças perdidas", v: vxp.total.perdidas, l: fmtNum(vxp.total.perdidas), c: "perdidas" as const },
                {
                  t: "Diferença",
                  v: vxp.total.diferenca,
                  l: `${vxp.total.diferenca > 0 ? "+" : ""}${fmtNum(vxp.total.diferenca)}${
                    vxp.total.difPerc == null ? "" : ` (${vxp.total.difPerc.toFixed(1)}%)`
                  }`,
                  c: "diferenca" as const,
                },
              ]
            ).map((k) => (
              <Kpi
                key={k.t}
                titulo={k.t}
                valor={k.l}
                varPerc={null}
                comparar={false}
                onDrill={() =>
                  abrirDrill(
                    drillVendidoProduzido(atuais, pcpPorPedido, {
                      titulo: `${k.t} — Vendido × Produzido`,
                      subtitulo: subOlist,
                      indicadorLabel: k.l,
                      indicadorValor: k.c === "linhas" ? k.v : k.v,
                      campo: k.c,
                    }),
                  )
                }
              />
            ))}
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="tbl-congelada w-full text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">Mês</th>
                  <th className="px-2 py-1 text-right">Pedidos</th>
                  <th className="px-2 py-1 text-right">Vendidas</th>
                  <th className="px-2 py-1 text-right">Produzidas</th>
                  <th className="px-2 py-1 text-right">Perdidas</th>
                  <th className="px-2 py-1 text-right">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {vxp.mensal.map((l) => {
                  const cel = (valor: number, label: string, campo: CampoVxp, titulo: string) => (
                    <td className="px-2 py-1 text-right tabular-nums">
                      <ValorDrill
                        onDrill={abrirDrill}
                        build={() =>
                          drillVendidoProduzido(atuais, pcpPorPedido, {
                            titulo,
                            subtitulo: `${fmtMes(l.chave)} · ${subOlist}`,
                            indicadorLabel: label,
                            indicadorValor: valor,
                            campo,
                            mes: l.chave,
                          })
                        }
                      >
                        {label}
                      </ValorDrill>
                    </td>
                  );
                  return (
                    <tr key={l.chave} className="border-t">
                      <td className="px-2 py-1">{fmtMes(l.chave)}</td>
                      {cel(l.pedidos, fmtNum(l.pedidos), "linhas", `Pedidos casados — ${fmtMes(l.chave)}`)}
                      {cel(l.vendidas, fmtNum(l.vendidas), "vendidas", `Peças vendidas — ${fmtMes(l.chave)}`)}
                      {cel(l.produzidas, fmtNum(l.produzidas), "produzidas", `Peças produzidas — ${fmtMes(l.chave)}`)}
                      {cel(l.perdidas, fmtNum(l.perdidas), "perdidas", `Peças perdidas — ${fmtMes(l.chave)}`)}
                      {cel(
                        l.diferenca,
                        `${l.diferenca > 0 ? "+" : ""}${fmtNum(l.diferenca)}`,
                        "diferenca",
                        `Diferença — ${fmtMes(l.chave)}`,
                      )}
                    </tr>
                  );
                })}
                {vxp.mensal.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">
                      Sem pedidos casados no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Bloco 8 — Produção e prazo (só PCP) ---------------- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Produção e prazo (só PCP)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Bloco exclusivamente do PCP: os filtros de empresa, modelo, cor, tamanho e situação não valem aqui. O
            filtro de Vendedor vale e usa o vendedor cadastrado no PCP. Recorte pela entrada do pedido no período,
            prazos em dias úteis (com feriados).
          </div>
          <div className="grid gap-2 md:grid-cols-5">
            <Kpi
              titulo="Pedidos no período"
              valor={fmtNum(prod.pedidos)}
              varPerc={null}
              comparar={false}
              onDrill={() =>
                abrirDrill(
                  drillPcpPedidos(pcpPeriodo, {
                    titulo: "Pedidos no período (PCP)",
                    subtitulo: subPcp,
                    indicadorLabel: fmtNum(prod.pedidos),
                    indicadorValor: prod.pedidos,
                  }),
                )
              }
            />
            <Kpi
              titulo="Prazo médio (entrada → saída)"
              valor={prod.prazoMedio == null ? "—" : `${prod.prazoMedio.toFixed(1)} d.ú.`}
              varPerc={null}
              comparar={false}
              onDrill={() =>
                abrirDrill(
                  drillPcpPrazo(pcpPeriodo, feriados, {
                    titulo: "Prazo médio (entrada → saída Juff)",
                    subtitulo: `${subPcp} · somente pedidos com entrada e saída preenchidas`,
                    indicadorLabel: prod.prazoMedio == null ? "—" : `${prod.prazoMedio.toFixed(1)} d.ú.`,
                    indicadorValor: prod.prazoMedio,
                  }),
                )
              }
            />
            <Kpi
              titulo="Entregas no prazo"
              valor={prod.percNoPrazo == null ? "—" : `${prod.percNoPrazo.toFixed(1)}%`}
              varPerc={null}
              comparar={false}
              onDrill={() =>
                abrirDrill(
                  drillPcpEntregas(pcpPeriodo, feriados, {
                    titulo: "Entregas no prazo",
                    subtitulo: `${subPcp} · somente pedidos com entrega prometida e saída`,
                    indicadorLabel: prod.percNoPrazo == null ? "—" : `${prod.percNoPrazo.toFixed(1)}%`,
                    indicadorValor: null,
                  }),
                )
              }
            />
            <Kpi
              titulo="Atraso médio"
              valor={prod.atrasoMedio == null ? "—" : `${prod.atrasoMedio.toFixed(1)} d.ú.`}
              varPerc={null}
              comparar={false}
              onDrill={() =>
                abrirDrill(
                  drillPcpAtraso(pcpPeriodo, feriados, {
                    titulo: "Atraso médio",
                    subtitulo: `${subPcp} · somente pedidos entregues após a data prometida`,
                    indicadorLabel: prod.atrasoMedio == null ? "—" : `${prod.atrasoMedio.toFixed(1)} d.ú.`,
                    indicadorValor: prod.atrasoMedio,
                  }),
                )
              }
            />
            <Kpi
              titulo="Gargalo"
              valor={prod.gargalo ?? "—"}
              varPerc={null}
              comparar={false}
              onDrill={
                prod.gargalo
                  ? () =>
                      abrirDrill(
                        drillPcpEtapa(pcpPeriodo, feriados, prod.gargalo!, {
                          titulo: `Gargalo — etapa ${prod.gargalo}`,
                          subtitulo: subPcp,
                          indicadorLabel: prod.gargalo!,
                          indicadorValor: null,
                        }),
                      )
                  : undefined
              }
            />
          </div>


          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-auto">
              <div className="mb-1 text-xs font-semibold">Tempo médio por etapa</div>
              <table className="tbl-congelada w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left">Etapa</th>
                    <th className="px-2 py-1 text-right">Média (d.ú.)</th>
                    <th className="px-2 py-1 text-right">Pedidos</th>
                  </tr>
                </thead>
                <tbody>
                  {prod.etapas.map((e) => (
                    <tr key={e.etapa} className="border-t">
                      <td className="px-2 py-1">
                        {e.etapa}
                        {prod.gargalo === e.etapa && (
                          <Badge variant="secondary" className="ml-2">
                            gargalo
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right font-semibold tabular-nums">
                        <ValorDrill
                          onDrill={abrirDrill}
                          build={() =>
                            drillPcpEtapa(pcpPeriodo, feriados, e.etapa, {
                              titulo: `Tempo na etapa ${e.etapa}`,
                              subtitulo: subPcp,
                              indicadorLabel: `${e.media.toFixed(1)} d.ú.`,
                              indicadorValor: e.media,
                            })
                          }
                        >
                          {e.media.toFixed(1)}
                        </ValorDrill>
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        <ValorDrill
                          onDrill={abrirDrill}
                          build={() =>
                            drillPcpEtapa(pcpPeriodo, feriados, e.etapa, {
                              titulo: `Pedidos que passaram pela etapa ${e.etapa}`,
                              subtitulo: subPcp,
                              indicadorLabel: fmtNum(e.pedidos),
                              indicadorValor: e.pedidos,
                              contagem: true,
                            })
                          }
                        >
                          {fmtNum(e.pedidos)}
                        </ValorDrill>
                      </td>
                    </tr>
                  ))}

                </tbody>
              </table>
            </div>

            <div className="overflow-auto">
              <div className="mb-1 text-xs font-semibold">Refações por área</div>
              <table className="tbl-congelada w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left">Área</th>
                    <th className="px-2 py-1 text-right">Episódios</th>
                    <th className="px-2 py-1 text-right">Peças a refazer</th>
                    <th className="px-2 py-1 text-right">Peças perdidas</th>
                  </tr>
                </thead>
                <tbody>
                  {prod.refacoesPorArea.map((a) => {
                    const cel = (
                      modo: "episodios" | "refazer" | "perdidas",
                      valor: number,
                      titulo: string,
                    ) => (
                      <td className="px-2 py-1 text-right tabular-nums">
                        <ValorDrill
                          onDrill={abrirDrill}
                          build={() =>
                            drillRefacoes(pcpPeriodo, nomes, modo, a.area, {
                              titulo,
                              subtitulo: `${subPcp} · área ${a.area}`,
                              indicadorLabel: fmtNum(valor),
                              indicadorValor: valor,
                            })
                          }
                        >
                          {fmtNum(valor)}
                        </ValorDrill>
                      </td>
                    );
                    return (
                      <tr key={a.area} className="border-t">
                        <td className="px-2 py-1">{a.area}</td>
                        {cel("episodios", a.episodios, `Episódios de refação — ${a.area}`)}
                        {cel("refazer", a.pecas, `Peças a refazer — ${a.area}`)}
                        {cel("perdidas", a.perdidas, `Peças perdidas — ${a.area}`)}
                      </tr>
                    );
                  })}

                  {prod.refacoesPorArea.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-4 text-center text-muted-foreground">
                        Sem refações no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-auto">
              <div className="mb-1 text-xs font-semibold">
                Pedidos atrasados{" "}
                <ValorDrill
                  onDrill={abrirDrill}
                  build={() =>
                    drillPcpPendentes(pcpPeriodo, feriados, "atrasados", {
                      titulo: "Pedidos atrasados",
                      subtitulo: `${subPcp} · sem saída e com entrega vencida`,
                      indicadorLabel: fmtNum(prod.atrasados.length),
                      indicadorValor: prod.atrasados.length,
                    })
                  }
                >
                  <Badge variant="secondary">{prod.atrasados.length}</Badge>
                </ValorDrill>
              </div>

              <div className="max-h-56 overflow-auto">
                <table className="tbl-congelada w-full text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left">Pedido</th>
                      <th className="px-2 py-1 text-left">Entrega</th>
                      <th className="px-2 py-1 text-right">Dias em atraso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prod.atrasados.map((a) => (
                      <tr key={`${a.pedido}-${a.data_entrega}`} className="border-t">
                        <td className="px-2 py-1 tabular-nums">{a.pedido}</td>
                        <td className="px-2 py-1 tabular-nums">{a.data_entrega}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{fmtNum(a.dias)}</td>
                      </tr>
                    ))}
                    {prod.atrasados.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">
                          Nenhum pedido atrasado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-auto">
              <div className="mb-1 text-xs font-semibold">
                Pedidos em risco (até 3 dias úteis){" "}
                <ValorDrill
                  onDrill={abrirDrill}
                  build={() =>
                    drillPcpPendentes(pcpPeriodo, feriados, "risco", {
                      titulo: "Pedidos em risco (até 3 dias úteis)",
                      subtitulo: `${subPcp} · sem saída e entrega a vencer em até 3 d.ú.`,
                      indicadorLabel: fmtNum(prod.emRisco.length),
                      indicadorValor: prod.emRisco.length,
                    })
                  }
                >
                  <Badge variant="secondary">{prod.emRisco.length}</Badge>
                </ValorDrill>
              </div>

              <div className="max-h-56 overflow-auto">
                <table className="tbl-congelada w-full text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left">Pedido</th>
                      <th className="px-2 py-1 text-left">Entrega</th>
                      <th className="px-2 py-1 text-right">Dias restantes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prod.emRisco.map((a) => (
                      <tr key={`${a.pedido}-${a.data_entrega}`} className="border-t">
                        <td className="px-2 py-1 tabular-nums">{a.pedido}</td>
                        <td className="px-2 py-1 tabular-nums">{a.data_entrega}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{fmtNum(a.dias)}</td>
                      </tr>
                    ))}
                    {prod.emRisco.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">
                          Nenhum pedido em risco.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="overflow-auto">
            <div className="mb-1 text-xs font-semibold">Correções de etapa por aba de origem</div>
            <div className="flex flex-wrap gap-2 text-xs">
              {prod.correcoesPorAba.map((c) => (
                <ValorDrill
                  key={c.aba}
                  onDrill={abrirDrill}
                  build={() =>
                    drillCorrecoes(pcpPeriodo, nomes, c.aba, {
                      titulo: `Correções de etapa — ${c.aba}`,
                      subtitulo: subPcp,
                      indicadorLabel: fmtNum(c.qtd),
                      indicadorValor: c.qtd,
                    })
                  }
                >
                  <Badge variant="outline" className="tabular-nums">
                    {c.aba}: {fmtNum(c.qtd)}
                  </Badge>
                </ValorDrill>
              ))}

              {prod.correcoesPorAba.length === 0 && (
                <span className="text-muted-foreground">Sem correções de etapa no período.</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Bloco 9 — Saúde do cadastro ---------------- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Saúde do cadastro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Diagnóstico de cadastro para conferência. Nenhum item aqui bloqueia nada.
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ListaDiagnostico
              titulo="Pedidos somente na Olist"
              itens={saude.soOlist}
              onDrill={() =>
                abrirDrill(
                  drillSoOlist(atuais, saude.soOlist, {
                    titulo: "Pedidos somente na Olist",
                    indicadorLabel: fmtNum(saude.soOlist.length),
                    indicadorValor: saude.soOlist.length,
                  }),
                )
              }
            />
            <ListaDiagnostico
              titulo="Pedidos somente no PCP"
              itens={saude.soPcp}
              onDrill={() =>
                abrirDrill(
                  drillSoPcp(pcpPeriodo, saude.soPcp, {
                    titulo: "Pedidos somente no PCP",
                    subtitulo: NOTA_BLOCO_PCP,
                    indicadorLabel: fmtNum(saude.soPcp.length),
                    indicadorValor: saude.soPcp.length,
                  }),
                )
              }
            />

            <div className="overflow-auto">
              <div className="mb-1 text-xs font-semibold">
                Produtos sem mapeamento{" "}
                <ValorDrill
                  onDrill={abrirDrill}
                  build={() =>
                    drillSemMapeamento(saude.semMapeamento, {
                      titulo: "Produtos sem mapeamento",
                      indicadorLabel: fmtNum(saude.semMapeamento.length),
                      indicadorValor: saude.semMapeamento.length,
                    })
                  }
                >
                  <Badge variant="secondary">{saude.semMapeamento.length}</Badge>
                </ValorDrill>
              </div>
              <div className="max-h-56 overflow-auto">
                <table className="tbl-congelada w-full text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left">Produto Olist</th>
                      <th className="px-2 py-1 text-right">Peças</th>
                      <th className="px-2 py-1 text-right">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saude.semMapeamento.map((s) => (
                      <tr key={s.produto} className="border-t">
                        <td className="px-2 py-1">{s.produto}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{fmtNum(s.pecas)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{fmtMoeda(s.faturamento)}</td>
                      </tr>
                    ))}
                    {saude.semMapeamento.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">
                          Todos os produtos do período estão mapeados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-auto">
              <div className="mb-1 text-xs font-semibold">
                Divergências de quantidade (casados){" "}
                <ValorDrill
                  onDrill={abrirDrill}
                  build={() =>
                    drillDivergencias(saude.divergencias, atuais, {
                      titulo: "Divergências de quantidade (pedidos casados)",
                      indicadorLabel: fmtNum(saude.divergencias.length),
                      indicadorValor: saude.divergencias.length,
                    })
                  }
                >
                  <Badge variant="secondary">{saude.divergencias.length}</Badge>
                </ValorDrill>
              </div>
              <div className="max-h-56 overflow-auto">
                <table className="tbl-congelada w-full text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left">Pedido</th>
                      <th className="px-2 py-1 text-right">Olist</th>
                      <th className="px-2 py-1 text-right">PCP</th>
                      <th className="px-2 py-1 text-right">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saude.divergencias.map((d) => (
                      <tr key={d.pedido} className="border-t">
                        <td className="px-2 py-1 tabular-nums">{d.pedido}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{fmtNum(d.olist)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{fmtNum(d.pcp)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {d.diferenca > 0 ? "+" : ""}
                          {fmtNum(d.diferenca)}
                        </td>
                      </tr>
                    ))}
                    {saude.divergencias.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-2 py-4 text-center text-muted-foreground">
                          Sem divergências no período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
        </>
      )}


      {/* ---------------- Somente PCP: lista e contagem ---------------- */}
      {escopo === "custom" && mostraSoPcp && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Somente PCP <Badge variant="secondary">{soPcpLista.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Pedidos que existem no PCP e não na Olist. Sem item, preço ou cliente — por isso ficam fora de
              faturamento, ticket médio e rankings da Olist. Abaixo, os dados que o PCP possui (peças, prazos e
              vendedor). O filtro de Vendedor usa o vendedor cadastrado no PCP.
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi titulo="Pedidos" valor={fmtNum(soPcpResumo.pedidos)} varPerc={null} comparar={false} />
              <Kpi
                titulo="Peças (qtd PCP)"
                valor={fmtNum(soPcpResumo.pecas)}
                varPerc={null}
                comparar={false}
                onDrill={() =>
                  abrirDrill(
                    drillPcpPedidos(soPcpRegs, {
                      titulo: "Peças — Somente PCP",
                      subtitulo: "Pedidos presentes no PCP e ausentes na Olist",
                      indicadorLabel: fmtNum(soPcpResumo.pecas),
                      indicadorValor: soPcpResumo.pecas,
                    }),
                  )
                }
              />
              <Kpi
                titulo="Média de peças/pedido"
                valor={soPcpResumo.mediaPecas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                varPerc={null}
                comparar={false}
              />
              <Kpi
                titulo="Finalizados / em aberto"
                valor={`${fmtNum(soPcpResumo.finalizados)} / ${fmtNum(soPcpResumo.emAberto)}`}
                varPerc={null}
                comparar={false}
              />
            </div>

            {soPcpResumo.semRegistro > 0 && (
              <div className="text-xs text-muted-foreground">
                {fmtNum(soPcpResumo.semRegistro)} pedido(s) sem registro detalhado no PCP — contam apenas na lista.
              </div>
            )}

            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="tbl-congelada w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-2 py-1">Pedido</th>
                    <th className="px-2 py-1">Orçamento</th>
                    <th className="px-2 py-1">Vendedor</th>
                    <th className="px-2 py-1">Tipo estampa</th>
                    <th className="px-2 py-1 text-right">Qtd</th>
                    <th className="px-2 py-1">Entrada</th>
                    <th className="px-2 py-1">Entrega</th>
                    <th className="px-2 py-1">Saída Juff</th>
                  </tr>
                </thead>
                <tbody>
                  {soPcpRegs.map((r) => (
                    <tr key={String(r.id ?? r.pedido_olist)} className="border-t">
                      <td className="px-2 py-1 tabular-nums">
                        {data?.pcpAgregado?.get(basePedidoOlist(r.pedido_olist))?.label ?? r.pedido_olist ?? "—"}
                      </td>

                      <td className="px-2 py-1">{r.orcamento ?? "—"}</td>
                      <td className="px-2 py-1">{r.vendedor ?? "—"}</td>
                      <td className="px-2 py-1">{r.tipo_estampa ?? "—"}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtNum(Number(r.qtd) || 0)}</td>
                      <td className="px-2 py-1 tabular-nums">{r.entrada_pedido ?? "—"}</td>
                      <td className="px-2 py-1 tabular-nums">{r.data_entrega ?? "—"}</td>
                      <td className="px-2 py-1 tabular-nums">{r.saida_juff ?? "—"}</td>
                    </tr>
                  ))}
                  {soPcpRegs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-2 py-3 text-center text-muted-foreground">
                        Nenhum pedido somente PCP no recorte atual.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>

        </Card>
      )}

      {ehStore && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Descrições fora do padrão</CardTitle>
            <div className="text-xs text-muted-foreground">
              Informativo. Esses itens contam normalmente no faturamento e nas peças — o bloco existe para corrigir o
              cadastro na Olist.
            </div>
          </CardHeader>
          <CardContent>
            {foraPadrao.length === 0 ? (
              <div className="text-xs text-muted-foreground">Todas as descrições do período foram reconhecidas.</div>
            ) : (
              <div className="max-h-80 overflow-auto">
                <table className="tbl-congelada w-full text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left">Descrição na Olist</th>
                      <th className="px-2 py-1 text-left">Motivo</th>
                      <th className="px-2 py-1 text-right">Linhas</th>
                      <th className="px-2 py-1 text-right">Peças</th>
                    </tr>
                  </thead>
                  <tbody>
                    {foraPadrao.map((f) => (
                      <tr key={f.descricao} className="border-t">
                        <td className="px-2 py-1">{f.descricao}</td>
                        <td className="px-2 py-1">{f.motivo}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{fmtNum(f.linhas)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{fmtNum(f.pecas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <IndicadorDrillDialog payload={drill} onOpenChange={(o) => !o && setDrill(null)} />

    </div>

  );
}

/* ------------------------------------------------------------------ */

function RankingCard({
  titulo,
  dim,
  dimStore,
  atuais,
  anteriores,
  pedidos,
  subtitulo,
  onDrill,
}: {
  titulo: string;
  dim: DimRanking;
  /** Quando presente, a chave do ranking vem do parse da Juff Store. */
  dimStore?: DimRankingStore;
  atuais: ReturnType<typeof ranking>;
  anteriores: ReturnType<typeof ranking> | null;
  pedidos: PedidoFiltrado[];
  subtitulo: string;
  onDrill: (p: DrillPayload) => void;
}) {
  const filtroDim = (chave: string) => (i: ItemCalc) => {
    if (dimStore) {
      const s = (i as ItemStoreCalc).store ?? parseProdutoStore(i.descricao_original ?? i.produto_olist);
      if (dimStore === "modelo_base") return (s.modelo_base ?? "Não classificado") === chave;
      if (dimStore === "estampa")
        return s.tipo_peca === "ESTAMPADA" && (s.estampa ?? "Não classificado") === chave;
      if (dimStore === "cor") return (s.cor ?? i.cor ?? "Não classificado") === chave;
      if (dimStore === "tamanho") return (s.tamanho ?? i.tamanho ?? "Não classificado") === chave;
      const marca = s.tipo_peca === "LISA" ? "Lisa" : "Estampada";
      return (
        `${s.modelo_base ?? "Não classificado"} \u00b7 ${s.cor ?? i.cor ?? "—"} \u00b7 ${
          s.tamanho ?? i.tamanho ?? "—"
        } (${marca})` === chave
      );
    }
    if (dim === "modelo") return i.modelo === chave;
    if (dim === "cor") return i.cor === chave;
    if (dim === "tamanho") return i.tamanho === chave;
    return `${i.modelo} \u00b7 ${i.cor} \u00b7 ${i.tamanho}` === chave;
  };

  const [ordem, setOrdem] = useState<OrdemRanking>("pecas");
  const [limite, setLimite] = useState<string>("10");

  const ordenadas = useMemo(() => ordenarRanking(atuais, ordem, dim), [atuais, ordem, dim]);
  const posAnterior = useMemo(() => {
    if (!anteriores) return null;
    const ord = ordenarRanking(anteriores, ordem, dim);
    return new Map(ord.map((l, i) => [l.chave, i + 1]));
  }, [anteriores, ordem, dim]);

  const linhas = limite === "todas" ? ordenadas : ordenadas.slice(0, Number(limite));

  return (
    <div className="rounded-md border p-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold">{titulo}</div>
        <div className="flex items-center gap-1">
          <Select value={ordem} onValueChange={(v) => setOrdem(v as OrdemRanking)}>
            <SelectTrigger className="h-7 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pecas">Por quantidade</SelectItem>
              <SelectItem value="faturamento">Por faturamento</SelectItem>
              <SelectItem value="pedidos">Por nº de pedidos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={limite} onValueChange={setLimite}>
            <SelectTrigger className="h-7 w-[80px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="tbl-congelada w-full text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left w-8">#</th>
              <th className="px-2 py-1 text-left">Item</th>
              <th className="px-2 py-1 text-right">Peças</th>
              <th className="px-2 py-1 text-right">%</th>
              <th className="px-2 py-1 text-right">Faturamento</th>
              <th className="px-2 py-1 text-right">Pedidos</th>
              {posAnterior && <th className="px-2 py-1 text-right">Antes</th>}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, idx) => {
              const antes = posAnterior?.get(l.chave);
              const delta = antes ? antes - (idx + 1) : null;
              return (
                <tr key={l.chave} className="border-t">
                  <td className="px-2 py-1 tabular-nums">{idx + 1}</td>
                  <td className="px-2 py-1">{l.chave}</td>
                  <td className="px-2 py-1 text-right font-semibold tabular-nums">
                    <ValorDrill
                      onDrill={onDrill}
                      build={() =>
                        drillItens(pedidos, {
                          titulo: `${titulo} — peças de "${l.chave}"`,
                          subtitulo,
                          indicadorLabel: fmtNum(l.pecas),
                          indicadorValor: l.pecas,
                          campo: "qtd",
                          filtro: filtroDim(l.chave),
                        })
                      }
                    >
                      {fmtNum(l.pecas)}
                    </ValorDrill>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{l.percPecas.toFixed(1)}%</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    <ValorDrill
                      onDrill={onDrill}
                      build={() =>
                        drillItens(pedidos, {
                          titulo: `${titulo} — receita de "${l.chave}"`,
                          subtitulo,
                          indicadorLabel: fmtMoeda(l.faturamento),
                          indicadorValor: l.faturamento,
                          campo: "subtotal",
                          filtro: filtroDim(l.chave),
                        })
                      }
                    >
                      {fmtMoeda(l.faturamento)}
                    </ValorDrill>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    <ValorDrill
                      onDrill={onDrill}
                      build={() =>
                        drillItens(pedidos, {
                          titulo: `${titulo} — pedidos com "${l.chave}"`,
                          subtitulo,
                          indicadorLabel: fmtNum(l.pedidos),
                          indicadorValor: l.pedidos,
                          campo: "pedidos",
                          filtro: filtroDim(l.chave),
                        })
                      }
                    >
                      {fmtNum(l.pedidos)}
                    </ValorDrill>
                  </td>
                  {posAnterior && (
                    <td className="px-2 py-1 text-right tabular-nums">
                      {antes ? (
                        <span className={delta && delta > 0 ? "text-green-700" : delta && delta < 0 ? "text-red-700" : ""}>
                          {antes}º {delta ? `(${delta > 0 ? "+" : ""}${delta})` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={posAnterior ? 7 : 6} className="px-2 py-4 text-center text-muted-foreground">
                  Sem dados no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GradeCard({
  titulo,
  grade,
  dim,
  pedidos,
  subtitulo,
  onDrill,
}: {
  titulo: string;
  grade: ReturnType<typeof gradePorModelo>;
  dim: "tamanho" | "cor";
  pedidos: PedidoFiltrado[];
  subtitulo: string;
  onDrill: (p: DrillPayload) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-auto">
        <table className="tbl-congelada w-full text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left">Modelo</th>
              {grade.colunas.map((c) => (
                <th key={c} className="px-2 py-1 text-right">
                  {c}
                </th>
              ))}
              <th className="px-2 py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {grade.linhas.map((l) => (
              <tr key={l.modelo} className="border-t">
                <td className="px-2 py-1">{l.modelo}</td>
                {grade.colunas.map((c) => (
                  <td key={c} className="px-2 py-1 text-right tabular-nums">
                    {l.celulas[c].pecas ? (
                      <ValorDrill
                        onDrill={onDrill}
                        build={() =>
                          drillItens(pedidos, {
                            titulo: `${l.modelo} — ${c}`,
                            subtitulo,
                            nota: `Percentual exibido = ${l.celulas[c].perc.toFixed(1)}% das ${fmtNum(l.total)} peças do modelo.`,
                            indicadorLabel: fmtNum(l.celulas[c].pecas),
                            indicadorValor: l.celulas[c].pecas,
                            campo: "qtd",
                            filtro: (i) =>
                              i.modelo === l.modelo && (dim === "tamanho" ? i.tamanho === c : i.cor === c),
                          })
                        }
                      >
                        {`${l.celulas[c].perc.toFixed(0)}%`}
                      </ValorDrill>
                    ) : (
                      "—"
                    )}
                  </td>
                ))}
                <td className="px-2 py-1 text-right font-semibold tabular-nums">
                  <ValorDrill
                    onDrill={onDrill}
                    build={() =>
                      drillItens(pedidos, {
                        titulo: `${l.modelo} — total de peças`,
                        subtitulo,
                        indicadorLabel: fmtNum(l.total),
                        indicadorValor: l.total,
                        campo: "qtd",
                        filtro: (i) => i.modelo === l.modelo,
                      })
                    }
                  >
                    {fmtNum(l.total)}
                  </ValorDrill>
                </td>
              </tr>
            ))}
            {grade.linhas.length === 0 && (
              <tr>
                <td colSpan={grade.colunas.length + 2} className="px-2 py-4 text-center text-muted-foreground">
                  Sem dados no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function ListaDiagnostico({
  titulo,
  itens,
  onDrill,
}: {
  titulo: string;
  itens: string[];
  onDrill?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold">
          {titulo}{" "}
          {onDrill ? (
            <button
              type="button"
              title="Ver detalhamento"
              onClick={onDrill}
              className="cursor-pointer transition-colors hover:opacity-80"
            >
              <Badge variant="secondary" className="underline decoration-dotted underline-offset-2">
                {itens.length}
              </Badge>
            </button>
          ) : (
            <Badge variant="secondary">{itens.length}</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAberto((v) => !v)}>
          {aberto ? "Ocultar" : "Ver lista"}
        </Button>
      </div>
      {aberto && (
        <div className="mt-2 max-h-56 overflow-auto">
          {itens.length === 0 ? (
            <div className="text-xs text-muted-foreground">Nenhum pedido nesta condição.</div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {itens.map((n) => (
                <Badge key={n} variant="outline" className="tabular-nums">
                  {n}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
