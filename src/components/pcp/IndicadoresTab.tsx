import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/lib/indicadores-olist";
import { useFeriados } from "@/hooks/use-feriados";
import { useProfilesMap } from "@/hooks/use-profiles-map";
import { abrirIndicadoresParaImpressao } from "@/lib/indicadores-pdf";
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

function MultiSelect({
  label,
  opcoes,
  valor,
  onChange,
}: {
  label: string;
  opcoes: string[];
  valor: string[];
  onChange: (v: string[]) => void;
}) {
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
          {opcoes.length === 0 && <div className="text-xs text-muted-foreground">Sem opções</div>}
          {opcoes.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted">
              <Checkbox
                checked={valor.includes(o)}
                onCheckedChange={(c) => onChange(c ? [...valor, o] : valor.filter((v) => v !== o))}
              />
              <span className="truncate">{o}</span>
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

/* ------------------------------------------------------------------ */

export function IndicadoresTab() {
  const [preset, setPreset] = useState<Preset>("mes");
  const [intervalo, setIntervalo] = useState(() => intervaloPreset("mes"));
  const [comparar, setComparar] = useState(false);
  const [empresa, setEmpresa] = useState<EmpresaFiltro>("CONSOLIDADO");
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [modelos, setModelos] = useState<string[]>([]);
  const [cores, setCores] = useState<string[]>([]);
  const [tamanhos, setTamanhos] = useState<string[]>([]);
  const [situacoes, setSituacoes] = useState<string[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>(["casados", "so_olist"]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["indicadores-olist", "base"],
    queryFn: async () => {
      const [lotesRes, pedidos, itens, mapRes, exclRes, pcp] = await Promise.all([
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
            .select("numero_pedido, lote_id, produto_olist, cor, tamanho, qtd, valor_unitario, desconto_item, is_servico")
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
      ]);
      if (lotesRes.error) throw lotesRes.error;
      if (mapRes.error) throw mapRes.error;
      if (exclRes.error) throw exclRes.error;

      const lotes: LotesPorData = {};
      for (const l of (lotesRes.data ?? []) as any[]) lotes[String(l.id)] = String(l.importado_em);

      const modeloPorProduto = new Map<string, string>();
      for (const r of (mapRes.data ?? []) as any[]) modeloPorProduto.set(String(r.produto_olist), String(r.modelo_cop));

      const ufPorPedido = new Map<string, string>();
      const noPcp = new Set<string>();
      const pcpPorPedido = new Map<string, PcpDb>();
      for (const r of pcp) {
        const num = String(r.pedido_olist ?? "").trim();
        if (!num) continue;
        noPcp.add(num);
        pcpPorPedido.set(num, r);
        if (r.uf_entrega) ufPorPedido.set(num, String(r.uf_entrega).trim().toUpperCase());
      }

      const pedidosVig = apenasVigentes(pedidos as any, lotes) as PedidoDb[];
      const vigentePorPedido = new Map(pedidosVig.map((p) => [p.numero_pedido, p.lote_id]));
      const itensVig = (itens as ItemDb[]).filter((i) => vigentePorPedido.get(i.numero_pedido) === i.lote_id);

      const calc = calcularPedidos(pedidosVig, itensVig, modeloPorProduto);
      const excluidos = new Set((exclRes.data ?? []).map((r: any) => String(r.numero_pedido)));
      const numsOlist = new Set(calc.map((p) => p.numero_pedido));

      return {
        calc,
        excluidos,
        noPcp,
        ufPorPedido,
        pcpPorPedido,
        pcpLista: pcp,
        modeloPorProduto,
        primeiraCompra: primeiraCompraPorCliente(calc),
        soPcp: [...noPcp].filter((n) => !numsOlist.has(n)),
      };
    },
  });

  const base = data?.calc ?? [];

  const opcoes = useMemo(() => {
    const v = new Set<string>();
    const s = new Set<string>();
    const m = new Set<string>();
    const c = new Set<string>();
    const t = new Set<string>();
    for (const p of base) {
      v.add(p.vendedor);
      s.add(p.situacao);
      for (const i of p.itens) {
        if (i.modelo) m.add(i.modelo);
        if (i.cor) c.add(i.cor);
        if (i.tamanho) t.add(i.tamanho);
      }
    }
    const ord = (x: Set<string>) => [...x].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { vendedores: ord(v), situacoes: ord(s), modelos: ord(m), cores: ord(c), tamanhos: ord(t) };
  }, [base]);

  const filtros: Filtros = useMemo(
    () => ({
      de: intervalo.de,
      ate: intervalo.ate,
      empresa,
      vendedores,
      modelos,
      cores,
      tamanhos,
      situacoes,
      grupos,
    }),
    [intervalo, empresa, vendedores, modelos, cores, tamanhos, situacoes, grupos],
  );

  const ctx = useMemo(
    () => ({ excluidos: data?.excluidos ?? new Set<string>(), noPcp: data?.noPcp ?? new Set<string>() }),
    [data],
  );

  const atuais = useMemo(() => aplicarFiltros(base, filtros, ctx), [base, filtros, ctx]);
  const anteriores = useMemo(() => {
    if (!comparar) return [];
    const p = periodoAnterior(intervalo.de, intervalo.ate);
    return aplicarFiltros(base, { ...filtros, de: p.de, ate: p.ate }, ctx);
  }, [comparar, base, filtros, ctx, intervalo]);

  const r = useMemo(() => resumo(atuais), [atuais]);
  const rAnt = useMemo(() => resumo(anteriores), [anteriores]);
  const mensal = useMemo(() => evolucaoMensal(atuais), [atuais]);
  const situacoesLinhas = useMemo(() => porSituacao(atuais), [atuais]);
  const rankModelo = useMemo(() => ranking(atuais, "modelo"), [atuais]);
  const abcModelo = useMemo(() => curvaAbc(rankModelo), [rankModelo]);
  const clientes = useMemo(
    () => abcClientes(porCliente(atuais, data?.primeiraCompra ?? new Map(), intervalo.de)),
    [atuais, data, intervalo.de],
  );
  const vendedoresLinhas = useMemo(() => porVendedor(atuais), [atuais]);
  const frete = useMemo(() => resumoFrete(atuais, data?.ufPorPedido ?? new Map()), [atuais, data]);
  const gradeTam = useMemo(() => gradePorModelo(atuais, "tamanho"), [atuais]);
  const gradeCor = useMemo(() => gradePorModelo(atuais, "cor"), [atuais]);

  /* ---- Fase 5 — cruzamento com o PCP ---- */
  const { feriados } = useFeriados();
  const pcpPorPedido = data?.pcpPorPedido ?? new Map<string, PcpDb>();
  const ufLinhas = useMemo(() => porUf(atuais, data?.ufPorPedido ?? new Map()), [atuais, data]);
  const vxp = useMemo(() => vendidoVsProduzido(atuais, pcpPorPedido), [atuais, pcpPorPedido]);
  const pcpPeriodo = useMemo(
    () =>
      (data?.pcpLista ?? []).filter(
        (r) => r.entrada_pedido && r.entrada_pedido >= intervalo.de && r.entrada_pedido <= intervalo.ate,
      ),
    [data, intervalo],
  );
  const prod = useMemo(() => produtividadePcp(pcpPeriodo, feriados), [pcpPeriodo, feriados]);
  const saude = useMemo(
    () => saudeCadastro(atuais, pcpPorPedido, data?.modeloPorProduto ?? new Map(), data?.soPcp ?? []),
    [atuais, pcpPorPedido, data],
  );

  const mostraSoPcp = grupos.includes("so_pcp");

  /* ---- Detalhamento (drill-down), somente leitura ---- */
  const nomes = useProfilesMap();
  const [drill, setDrill] = useState<DrillPayload | null>(null);
  const abrirDrill = (p: DrillPayload) => setDrill(p);
  const subPcp = `Entrada entre ${intervalo.de} e ${intervalo.ate}`;
  const subOlist = `Período ${intervalo.de} a ${intervalo.ate} · filtros do painel aplicados`;


  const exportarPdf = () => {
    void abrirIndicadoresParaImpressao({
      periodo: intervalo,
      comparar,
      periodoAnterior: comparar ? periodoAnterior(intervalo.de, intervalo.ate) : null,
      filtros: {
        empresa,
        vendedores,
        modelos,
        cores,
        tamanhos,
        situacoes,
        grupos: grupos.map((g) => GRUPOS.find((x) => x.v === g)?.label ?? g),
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
      ufs: ufLinhas,
      vendidoProduzido: vxp,
      producao: prod,
      saude,
    });
  };




  return (
    <div className="space-y-4">
      {/* ---------------- Filtros ---------------- */}
      <div className="sticky top-0 z-20 -mx-1 space-y-2 rounded-md border bg-background/95 p-3 backdrop-blur">
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

          <Button variant="outline" size="sm" className="h-9 gap-2" onClick={exportarPdf} disabled={isLoading}>
            <FileDown className="h-4 w-4" /> Exportar PDF
          </Button>


          <Button variant="outline" size="icon" className="h-9 w-9" title="Recarregar" onClick={() => refetch()}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect label="Vendedor" opcoes={opcoes.vendedores} valor={vendedores} onChange={setVendedores} />
          <MultiSelect label="Modelo" opcoes={opcoes.modelos} valor={modelos} onChange={setModelos} />
          <MultiSelect label="Cor" opcoes={opcoes.cores} valor={cores} onChange={setCores} />
          <MultiSelect label="Tamanho" opcoes={opcoes.tamanhos} valor={tamanhos} onChange={setTamanhos} />
          <MultiSelect label="Situação" opcoes={opcoes.situacoes} valor={situacoes} onChange={setSituacoes} />
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
        </div>
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


      {/* ---------------- Bloco 12 — Rankings (prioritário) ---------------- */}
      <Card className="border-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rankings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {RANKINGS.map((cfg) => (
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
                    data?.primeiraCompra ?? new Map(),
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
                    data?.primeiraCompra ?? new Map(),
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
                  <td className="px-2 py-1 text-right tabular-nums">{fmtMoeda(v.descontoValor)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{v.descontoPerc.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

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
            <Kpi titulo="Frete total" valor={fmtMoeda(frete.total)} varPerc={null} comparar={false} />
            <Kpi titulo="Frete médio/pedido" valor={fmtMoeda(frete.medio)} varPerc={null} comparar={false} />
            <Kpi titulo="Pedidos com frete" valor={`${frete.percComFrete.toFixed(1)}%`} varPerc={null} comparar={false} />
          </div>
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
                {frete.porUf.map((u) => (
                  <tr key={u.uf} className="border-t">
                    <td className="px-2 py-1">{u.uf}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(u.pedidos)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(u.pecas)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtMoeda(u.frete)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
                {ufLinhas.map((u) => (
                  <tr key={u.uf} className="border-t">
                    <td className="px-2 py-1">{u.uf}</td>
                    <td className="px-2 py-1 text-right font-semibold tabular-nums">{fmtMoeda(u.faturamento)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{u.perc.toFixed(1)}%</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(u.pedidos)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(u.pecas)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtMoeda(u.frete)}</td>
                  </tr>
                ))}
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
            <Kpi titulo="Pedidos casados" valor={fmtNum(vxp.total.pedidos)} varPerc={null} comparar={false} />
            <Kpi titulo="Peças vendidas" valor={fmtNum(vxp.total.vendidas)} varPerc={null} comparar={false} />
            <Kpi titulo="Peças produzidas" valor={fmtNum(vxp.total.produzidas)} varPerc={null} comparar={false} />
            <Kpi titulo="Peças perdidas" valor={fmtNum(vxp.total.perdidas)} varPerc={null} comparar={false} />
            <Kpi
              titulo="Diferença"
              valor={`${vxp.total.diferenca > 0 ? "+" : ""}${fmtNum(vxp.total.diferenca)}${
                vxp.total.difPerc == null ? "" : ` (${vxp.total.difPerc.toFixed(1)}%)`
              }`}
              varPerc={null}
              comparar={false}
            />
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
                {vxp.mensal.map((l) => (
                  <tr key={l.chave} className="border-t">
                    <td className="px-2 py-1">{fmtMes(l.chave)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(l.pedidos)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(l.vendidas)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(l.produzidas)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{fmtNum(l.perdidas)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {l.diferenca > 0 ? "+" : ""}
                      {fmtNum(l.diferenca)}
                    </td>
                  </tr>
                ))}
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
            Bloco exclusivamente do PCP: os filtros de empresa, vendedor, modelo, cor, tamanho e situação não valem
            aqui. Recorte pela entrada do pedido no período, prazos em dias úteis (com feriados).
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
            <ListaDiagnostico titulo="Pedidos somente na Olist" itens={saude.soOlist} />
            <ListaDiagnostico titulo="Pedidos somente no PCP" itens={saude.soPcp} />

            <div className="overflow-auto">
              <div className="mb-1 text-xs font-semibold">
                Produtos sem mapeamento <Badge variant="secondary">{saude.semMapeamento.length}</Badge>
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
                Divergências de quantidade (casados) <Badge variant="secondary">{saude.divergencias.length}</Badge>
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

      {/* ---------------- Somente PCP: lista e contagem ---------------- */}
      {mostraSoPcp && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Somente PCP <Badge variant="secondary">{data?.soPcp.length ?? 0}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 text-xs text-muted-foreground">
              Pedidos que existem no PCP e não na Olist. Sem item, preço ou cliente — por isso entram apenas como
              lista e contagem, fora de faturamento, ticket médio, peças e rankings.
            </div>
            <div className="max-h-56 overflow-auto text-xs">
              <div className="flex flex-wrap gap-1">
                {(data?.soPcp ?? []).map((num) => (
                  <Badge key={num} variant="outline" className="tabular-nums">
                    {num}
                  </Badge>
                ))}
              </div>
            </div>
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
  atuais,
  anteriores,
  pedidos,
  subtitulo,
  onDrill,
}: {
  titulo: string;
  dim: DimRanking;
  atuais: ReturnType<typeof ranking>;
  anteriores: ReturnType<typeof ranking> | null;
  pedidos: PedidoFiltrado[];
  subtitulo: string;
  onDrill: (p: DrillPayload) => void;
}) {
  const filtroDim = (chave: string) => (i: ItemCalc) => {
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

function ListaDiagnostico({ titulo, itens }: { titulo: string; itens: string[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold">
          {titulo} <Badge variant="secondary">{itens.length}</Badge>
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
