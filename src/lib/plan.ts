// Módulo PLAN — cálculos de sugestão. Somente leitura sobre COP/MAP/Olist;
// escreve em plan_config, plan_fichas_modelo e na chave plan_cores_fora_de_linha de map_config.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Cop } from "@/lib/cop";
import type { Pedido } from "@/lib/pedidos";
import {
  calcDisponivel, calcEmProducao, calcFaltantes, calcPerdas, calcRecebido, pkKey,
} from "@/lib/cop-saldos";
import { apenasVigentes, type LotesPorData } from "@/lib/olist-vendas";
import { REFACAO_CORES } from "@/lib/pedidos";
import { corIgnorada, normalizarCor } from "@/lib/plan-cores";

export { pkKey };

/* ------------------------- normalização de cor ------------------------- */

export { normalizarCor };

export interface FichaModelo {
  id: string;
  modelo: string;
  tamanho_referencia: string;
  pecas_por_folha: number;
  altura_folha_m: number;
  largura_tecido_m: number;
  ativo: boolean;
  observacao: string | null;
}

export type PlanConfig = Record<string, number>;

export const CONFIG_PADRAO: PlanConfig = {
  gramatura_g_por_metro: 250,
  largura_padrao_m: 1.8,
  fator_perda_encaixe: 1.05,
  semanas_seguranca: 3,
  lead_time_completo_dias: 65,
  lead_time_com_cru_dias: 40,
  lote_minimo_tinturaria_kg: 80,
  horizonte_meses_padrao: 3,
  horizonte_corte_meses_padrao: 2,
};

export function cfg(config: PlanConfig | undefined, chave: string): number {
  const v = config?.[chave];
  return typeof v === "number" && Number.isFinite(v) ? v : CONFIG_PADRAO[chave] ?? 0;
}

/* ---------------------------- funções puras ---------------------------- */

export function kgPorPeca(
  ficha: Pick<FichaModelo, "altura_folha_m" | "largura_tecido_m" | "pecas_por_folha">,
  config: PlanConfig,
): number {
  const ppf = Number(ficha.pecas_por_folha);
  if (!ppf || ppf <= 0) return 0;
  const largPadrao = cfg(config, "largura_padrao_m") || 1;
  return (
    (Number(ficha.altura_folha_m) * cfg(config, "fator_perda_encaixe") *
      (Number(ficha.largura_tecido_m) / largPadrao) * cfg(config, "gramatura_g_por_metro")) /
    1000 / ppf
  );
}

export function demandaTotal(
  previstoMensal: number, horizonteMeses: number, faltaFirme: number, semanasSeguranca: number,
): number {
  return previstoMensal * horizonteMeses + faltaFirme + (previstoMensal * semanasSeguranca) / 4.33;
}

export function necessidadeLiquida(demanda: number, emEstoque: number, emProducao: number): number {
  return Math.max(0, demanda - emEstoque - emProducao);
}

/** Dias até o saldo zerar no ritmo de consumo. Sem consumo → Infinity. Saldo ≤ 0 → 0. */
export function diasAteRuptura(saldoAtual: number, consumoMensal: number): number {
  if (saldoAtual <= 0) return 0;
  if (consumoMensal <= 0) return Infinity;
  return (saldoAtual / consumoMensal) * 30;
}

export function arredondarLote(kg: number, loteMinimo: number): number {
  if (kg <= 0) return 0;
  if (!loteMinimo || loteMinimo <= 0) return Math.ceil(kg);
  return Math.ceil(kg / loteMinimo) * loteMinimo;
}

export function dataLimiteDecisao(diasRuptura: number, leadTimeDias: number, hoje = new Date()): Date | null {
  if (!Number.isFinite(diasRuptura)) return null;
  const d = new Date(hoje);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Math.floor(diasRuptura - leadTimeDias));
  return d;
}

/* ------------------------------- hooks ------------------------------- */

const PLAN_KEY = ["plan"] as const;

export const CHAVE_CORES_FORA_LINHA = "plan_cores_fora_de_linha";

/** Nomes canônicos de REFACAO_CORES que não entram no planejamento. */
export function validarCoresForaDeLinha(value: unknown): Set<string> {
  const oficiais = new Set(REFACAO_CORES.map((c) => c.nome));
  return new Set(Array.isArray(value) ? value.filter((c): c is string => typeof c === "string" && oficiais.has(c)) : []);
}

export function usePlanCoresForaDeLinha() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: [...PLAN_KEY, "cores-fora-de-linha"],
    queryFn: async () => {
      const { data, error } = await supabase.from("map_config").select("value").eq("key", CHAVE_CORES_FORA_LINHA).maybeSingle();
      if (error) throw error;
      return validarCoresForaDeLinha(data?.value);
    },
  });
  const salvar = useMutation({
    mutationFn: async (cores: string[]) => {
      const { error } = await supabase.from("map_config").upsert({
        key: CHAVE_CORES_FORA_LINHA,
        value: Array.from(validarCoresForaDeLinha(cores)),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: PLAN_KEY });
      toast.success("Cores fora de linha salvas.");
    },
    onError: () => toast.error("Não foi possível salvar as cores fora de linha."),
  });
  return { cores: query.data ?? new Set<string>(), isLoading: query.isLoading, error: query.error, salvar };
}

async function paginar<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: any }>): Promise<T[]> {
  const out: T[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export function usePlanFichas() {
  return useQuery({
    queryKey: [...PLAN_KEY, "fichas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plan_fichas_modelo" as any).select("*").order("modelo");
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        pecas_por_folha: Number(r.pecas_por_folha),
        altura_folha_m: Number(r.altura_folha_m),
        largura_tecido_m: Number(r.largura_tecido_m),
      })) as FichaModelo[];
    },
  });
}

export function usePlanConfigRows() {
  return useQuery({
    queryKey: [...PLAN_KEY, "config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plan_config" as any).select("*").order("chave");
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({ chave: String(r.chave), valor: Number(r.valor), descricao: r.descricao as string | null }));
    },
  });
}

export function usePlanConfig(): { data: PlanConfig; isLoading: boolean } {
  const q = usePlanConfigRows();
  const data: PlanConfig = { ...CONFIG_PADRAO };
  for (const r of q.data ?? []) data[r.chave] = r.valor;
  return { data, isLoading: q.isLoading };
}

export function useSalvarConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: number }) => {
      const { error } = await supabase.from("plan_config" as any)
        .update({ valor, updated_at: new Date().toISOString() } as any).eq("chave", chave);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PLAN_KEY }),
  });
}

export function useSalvarFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: Pick<FichaModelo, "id" | "tamanho_referencia" | "pecas_por_folha" | "altura_folha_m" | "largura_tecido_m" | "ativo">) => {
      const { id, ...rest } = f;
      const { error } = await supabase.from("plan_fichas_modelo" as any)
        .update({ ...rest, updated_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PLAN_KEY }),
  });
}

export interface VendaHistorica {
  /** chave pkKey(modelo, cor, tamanho) → média mensal de peças */
  mediaMensal: Map<string, number>;
  /** produtos Olist sem mapeamento → peças nos 12 meses */
  naoMapeados: Map<string, number>;
  /** cores que normalizarCor não reconheceu → peças nos 12 meses (fora dos totais) */
  coresNaoReconhecidas: Map<string, number>;
}

export function usePlanVendaHistorica() {
  return useQuery({
    queryKey: [...PLAN_KEY, "venda-historica"],
    queryFn: async (): Promise<VendaHistorica> => {
      const desde = new Date();
      desde.setMonth(desde.getMonth() - 12);
      const desdeIso = desde.toISOString().slice(0, 10);

      const [lotesRes, mapRes] = await Promise.all([
        supabase.from("olist_import_lotes" as any).select("id, importado_em, anulado_em"),
        supabase.from("olist_produto_map" as any).select("produto_olist, modelo_cop"),
      ]);
      if (lotesRes.error) throw lotesRes.error;
      if (mapRes.error) throw mapRes.error;
      const lotes: LotesPorData = {};
      const anulados = new Set<string>();
      for (const l of (lotesRes.data ?? []) as any[]) {
        if (l.anulado_em) { anulados.add(String(l.id)); continue; }
        lotes[String(l.id)] = String(l.importado_em);
      }
      const modeloPorProduto = new Map<string, string>();
      for (const r of (mapRes.data ?? []) as any[]) modeloPorProduto.set(String(r.produto_olist), String(r.modelo_cop));

      const pedidos = await paginar<{ numero_pedido: string; lote_id: string; data: string | null }>((a, b) =>
        supabase.from("olist_pedidos" as any).select("numero_pedido, lote_id, data").gte("data", desdeIso).order("id").range(a, b));
      const ativos = pedidos.filter((p) => !anulados.has(p.lote_id));
      const vig = apenasVigentes(ativos, lotes);
      const vigentes = new Set(vig.map((p) => `${p.lote_id}|${p.numero_pedido}`));
      const lotesUsados = Array.from(new Set(vig.map((p) => p.lote_id)));

      const soma = new Map<string, number>();
      const naoMapeados = new Map<string, number>();
      const coresNaoReconhecidas = new Map<string, number>();
      for (let i = 0; i < lotesUsados.length; i += 50) {
        const fatia = lotesUsados.slice(i, i + 50);
        const itens = await paginar<any>((a, b) =>
          supabase.from("olist_itens" as any)
            .select("numero_pedido, lote_id, produto_olist, cor, tamanho, qtd, is_servico")
            .in("lote_id", fatia).order("id").range(a, b));
        for (const it of itens) {
          if (it.is_servico) continue;
          if (!vigentes.has(`${it.lote_id}|${it.numero_pedido}`)) continue;
          const qtd = Number(it.qtd) || 0;
          if (qtd <= 0) continue;
          const prod = String(it.produto_olist ?? "").trim();
          const modelo = prod ? modeloPorProduto.get(prod) : undefined;
          if (!modelo) {
            const nome = prod || "(sem produto)";
            naoMapeados.set(nome, (naoMapeados.get(nome) ?? 0) + qtd);
            continue;
          }
          if (!it.cor || !it.tamanho) continue;
          const cor = normalizarCor(String(it.cor));
          if (!cor) {
            const bruta = String(it.cor).trim() || "(sem cor)";
            if (corIgnorada(bruta)) continue;
            coresNaoReconhecidas.set(bruta, (coresNaoReconhecidas.get(bruta) ?? 0) + qtd);
            continue;
          }
          const k = pkKey(modelo, cor, String(it.tamanho));
          soma.set(k, (soma.get(k) ?? 0) + qtd);
        }
      }
      const mediaMensal = new Map<string, number>();
      for (const [k, v] of soma) mediaMensal.set(k, v / 12);
      return { mediaMensal, naoMapeados, coresNaoReconhecidas };
    },
    staleTime: 5 * 60_000,
  });
}

export interface SaldoRealPlan {
  /** Saldo Real por pkKey(modelo, cor, tamanho): max(0, JOKE+JUFF) + disponível COP. */
  saldoReal: Map<string, number>;
  /** Peça física pronta: max(0, JOKE + JUFF), por modelo/cor/tamanho. */
  prontoFisico: Map<string, number>;
  /** Produção em andamento (calcEmProducao) — informativa, já embutida no saldo. */
  emProducao: Map<string, number>;
  /** Produtos Olist sem modelo COP no de-para → peças em estoque (fora dos totais). */
  naoMapeados: Map<string, number>;
  /** Cores do estoque Olist que normalizarCor não reconheceu → peças (fora dos totais). */
  coresNaoReconhecidas: Map<string, number>;
}

interface ItemEstoqueOlist {
  empresa: string;
  produto_olist: string;
  cor: string | null;
  tamanho: string | null;
  qtd: number | null;
}

/**
 * Estoque do PLAN = Saldo Real, mesma montagem da aba Saldo Real do COP
 * (SaldoRealTab.tsx): multiEmpresa com piso zero + disponível do COP.
 * Usa as mesmas query keys do COP para dividir cache.
 */
export function usePlanSaldoReal() {
  const copsQ = useQuery({
    queryKey: ["cops"],
    queryFn: () => paginar<any>((a, b) => supabase.from("cops" as any).select("*").order("id").range(a, b)),
  });
  const pedidosQ = useQuery({
    queryKey: ["pedidos-cop-saldos"],
    queryFn: () => paginar<any>((a, b) => supabase.from("pedidos" as any).select("*").order("id").range(a, b)),
  });
  const snapsQ = useQuery({
    queryKey: ["estoque-olist", "snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_olist_snapshots" as any)
        .select("*")
        .order("importado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const ultimosIds = (() => {
    const m = new Map<string, any>();
    for (const s of snapsQ.data ?? []) if (!m.has(String(s.empresa))) m.set(String(s.empresa), s);
    return Array.from(m.values()).map((s) => String(s.id)).sort();
  })();
  const itensQ = useQuery({
    queryKey: ["estoque-olist", "itens", ultimosIds],
    enabled: ultimosIds.length > 0,
    queryFn: () =>
      paginar<ItemEstoqueOlist>((a, b) =>
        supabase.from("estoque_olist_itens" as any)
          .select("*")
          .in("snapshot_id", ultimosIds)
          .order("id", { ascending: true })
          .range(a, b)),
  });
  const mapQ = useQuery({
    queryKey: ["estoque-olist", "produto-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("olist_produto_map" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as { produto_olist: string; modelo_cop: string }[];
    },
  });

  const snapsProntos = snapsQ.data !== undefined && ultimosIds.length === 0;
  const isLoading =
    copsQ.isLoading || pedidosQ.isLoading || snapsQ.isLoading || mapQ.isLoading ||
    (ultimosIds.length > 0 && itensQ.isLoading);

  if (isLoading || (!snapsProntos && !itensQ.data)) {
    return {
      data: { saldoReal: new Map(), prontoFisico: new Map(), emProducao: new Map(), naoMapeados: new Map(), coresNaoReconhecidas: new Map() } as SaldoRealPlan,
      isLoading: true,
    };
  }

  const cops = (copsQ.data ?? []) as unknown as Cop[];
  const pedidos = (pedidosQ.data ?? []) as unknown as Pedido[];
  const emProducao = calcEmProducao(cops);
  const disponivel = calcDisponivel(emProducao, calcFaltantes(pedidos), calcRecebido(cops), calcPerdas(cops));

  const modeloPorProduto = new Map<string, string>();
  for (const r of mapQ.data ?? []) modeloPorProduto.set(String(r.produto_olist), String(r.modelo_cop));

  const joke = new Map<string, number>();
  const juff = new Map<string, number>();
  const naoMapeados = new Map<string, number>();
  const coresNaoReconhecidas = new Map<string, number>();
  for (const it of itensQ.data ?? []) {
    const qtd = Number(it.qtd) || 0;
    const modelo = modeloPorProduto.get(String(it.produto_olist ?? ""));
    if (!modelo) {
      const nome = String(it.produto_olist ?? "").trim() || "(sem produto)";
      naoMapeados.set(nome, (naoMapeados.get(nome) ?? 0) + qtd);
      continue;
    }
    if (!it.cor || !it.tamanho) continue;
    const cor = normalizarCor(String(it.cor));
    if (!cor) {
      const bruta = String(it.cor).trim() || "(sem cor)";
      if (corIgnorada(bruta)) continue;
      coresNaoReconhecidas.set(bruta, (coresNaoReconhecidas.get(bruta) ?? 0) + qtd);
      continue;
    }
    const k = pkKey(modelo, cor, String(it.tamanho));
    const alvo = it.empresa === "JOKE" ? joke : juff;
    alvo.set(k, (alvo.get(k) ?? 0) + qtd);
  }

  const chaves = new Set<string>([...joke.keys(), ...juff.keys(), ...disponivel.keys()]);
  const saldoReal = new Map<string, number>();
  const prontoFisico = new Map<string, number>();
  for (const k of chaves) {
    const multiEmpresa = Math.max(0, (joke.get(k) ?? 0) + (juff.get(k) ?? 0));
    prontoFisico.set(k, multiEmpresa);
    saldoReal.set(k, multiEmpresa + (disponivel.get(k) ?? 0));
  }

  return {
    data: { saldoReal, prontoFisico, emProducao, naoMapeados, coresNaoReconhecidas } as SaldoRealPlan,
    isLoading: false,
  };
}

export interface MapaPorCor {
  /** valor agregado por cor canônica (normalizarCor) */
  porCor: Map<string, number>;
  /** cores não reconhecidas → valor envolvido (fora dos totais) */
  coresNaoReconhecidas: Map<string, number>;
}

/** Metros restantes de tecido tingido em estoque, por cor canônica. */
export function usePlanEstoqueTingido() {
  return useQuery({
    queryKey: [...PLAN_KEY, "estoque-tingido"],
    queryFn: async (): Promise<MapaPorCor> => {
      const pecas = await paginar<any>((a, b) =>
        supabase.from("map_estoque_pecas" as any)
          .select("id, cor, alt_inicial, cortes, status, programacao_id")
          .in("status", ["Fechada", "Aberta", "Corte"]).order("id").range(a, b));
      const progs = await paginar<any>((a, b) =>
        supabase.from("map_tinturaria_programacoes" as any).select("id, cor").order("id").range(a, b));
      const corProg = new Map<string, string>(progs.map((p) => [String(p.id), String(p.cor ?? "")]));
      const porCor = new Map<string, number>();
      const coresNaoReconhecidas = new Map<string, number>();
      for (const p of pecas) {
        const bruta = (corProg.get(String(p.programacao_id)) || p.cor || "").trim();
        if (!bruta) continue;
        const cortado = (Array.isArray(p.cortes) ? p.cortes : []).reduce((s: number, c: any) => s + (Number(c?.metros) || 0), 0);
        const restante = Math.max(0, (Number(p.alt_inicial) || 0) - cortado);
        const cor = normalizarCor(bruta);
        if (!cor) {
          if (!corIgnorada(bruta)) coresNaoReconhecidas.set(bruta, (coresNaoReconhecidas.get(bruta) ?? 0) + restante);
          continue;
        }
        porCor.set(cor, (porCor.get(cor) ?? 0) + restante);
      }
      return { porCor, coresNaoReconhecidas };
    },
  });
}

/** Kg enviados à tinturaria e ainda não recebidos, por cor canônica. */
export function usePlanNaTinturaria() {
  return useQuery({
    queryKey: [...PLAN_KEY, "na-tinturaria"],
    queryFn: async (): Promise<MapaPorCor> => {
      const rows = await paginar<any>((a, b) =>
        supabase.from("map_tinturaria_programacoes" as any)
          .select("id, cor, kg_enviados, data_recebimento")
          .not("kg_enviados", "is", null).is("data_recebimento", null).order("id").range(a, b));
      const porCor = new Map<string, number>();
      const coresNaoReconhecidas = new Map<string, number>();
      for (const r of rows) {
        const bruta = String(r.cor ?? "").trim();
        if (!bruta) continue;
        const kgv = Number(r.kg_enviados) || 0;
        const cor = normalizarCor(bruta);
        if (!cor) {
          if (!corIgnorada(bruta)) coresNaoReconhecidas.set(bruta, (coresNaoReconhecidas.get(bruta) ?? 0) + kgv);
          continue;
        }
        porCor.set(cor, (porCor.get(cor) ?? 0) + kgv);
      }
      return { porCor, coresNaoReconhecidas };
    },
  });
}

export interface CruParado { total: number; porProd: { numero: number; kg: number }[] }

export function usePlanCruParado() {
  return useQuery({
    queryKey: [...PLAN_KEY, "cru-parado"],
    queryFn: async (): Promise<CruParado> => {
      const [prods, entregas, progs] = await Promise.all([
        paginar<any>((a, b) => supabase.from("map_producoes" as any).select("id, numero").order("id").range(a, b)),
        paginar<any>((a, b) => supabase.from("map_malharia_entregas" as any).select("producao_id, kg").order("id").range(a, b)),
        paginar<any>((a, b) => supabase.from("map_tinturaria_programacoes" as any).select("producao_id, kg_enviados").order("id").range(a, b)),
      ]);
      const saldo = new Map<string, number>();
      for (const e of entregas) saldo.set(e.producao_id, (saldo.get(e.producao_id) ?? 0) + (Number(e.kg) || 0));
      for (const p of progs) saldo.set(p.producao_id, (saldo.get(p.producao_id) ?? 0) - (Number(p.kg_enviados) || 0));
      const numero = new Map<string, number>(prods.map((p) => [String(p.id), Number(p.numero)]));
      const porProd: { numero: number; kg: number }[] = [];
      for (const [id, kg] of saldo) if (kg > 1) porProd.push({ numero: numero.get(id) ?? 0, kg });
      porProd.sort((a, b) => b.kg - a.kg);
      return { total: porProd.reduce((s, p) => s + p.kg, 0), porProd };
    },
  });
}

/* --------------------------- montagem da grade --------------------------- */

export interface LinhaNecessidade {
  modelo: string;
  cor: string;
  foraDeLinha: boolean;
  /** Informativos por tamanho; não entram novamente na sugestão de corte. */
  prontoPorTam: Record<string, number>;
  producaoPorTam: Record<string, number>;
  /** total a produzir por tamanho (firme + previsto líquido) */
  aProduzirPorTam: Record<string, number>;
  /** parte firme (pedido vendido sem estoque) por tamanho */
  firmePorTam: Record<string, number>;
  /** parte da sugestão que só existe por causa do piso do mínimo adotado */
  porMinimoPorTam: Record<string, number>;
  porMinimo: number;
  vendaPrevistaMensal: number;
  jaVendido: number;
  emEstoque: number;
  /** informativo: já está embutido no saldo real, não desconta de novo */
  emProducao: number;
  aProduzir: number;
  diasRuptura: number;
}

export function montarNecessidade(params: {
  tamanhos: readonly string[];
  saldoReal: Map<string, number>;
  emProducao: Map<string, number>;
  prontoFisico?: Map<string, number>;
  mediaMensal: Map<string, number>;
  horizonteMeses: number;
  semanasSeguranca: number;
  coresForaDeLinha?: Set<string>;
  minimosAdotados?: Map<string, MinimoSalvo>;
}): LinhaNecessidade[] {
  const { tamanhos, saldoReal, emProducao, mediaMensal, horizonteMeses, semanasSeguranca } = params;
  const combos = new Map<string, { modelo: string; cor: string }>();
  for (const k of [...saldoReal.keys(), ...mediaMensal.keys()]) {
    const [modelo, cor, tam] = k.split("|");
    if (!modelo || !cor || !tamanhos.includes(tam)) continue;
    combos.set(`${modelo}|${cor}`, { modelo, cor });
  }
  const out: LinhaNecessidade[] = [];
  for (const { modelo, cor } of combos.values()) {
    const foraDeLinha = params.coresForaDeLinha?.has(cor) ?? false;
    const aProduzirPorTam: Record<string, number> = {};
    const firmePorTam: Record<string, number> = {};
    const prontoPorTam: Record<string, number> = {};
    const producaoPorTam: Record<string, number> = {};
    const porMinimoPorTam: Record<string, number> = {};
    let consumo = 0, livreTot = 0, firmeTot = 0, prodTot = 0, aProd = 0, porMinTot = 0;
    for (const t of tamanhos) {
      const k = pkKey(modelo, cor, t);
      prontoPorTam[t] = params.prontoFisico?.get(k) ?? 0;
      producaoPorTam[t] = emProducao.get(k) ?? 0;
      const saldo = saldoReal.get(k) ?? 0;
      const media = mediaMensal.get(k) ?? 0;
      const estoqueLivre = Math.max(0, saldo);
      const firme = Math.max(0, -saldo);
      const prevBruto = demandaTotal(media, horizonteMeses, 0, semanasSeguranca);
      const prevLiquido = Math.ceil(Math.max(0, prevBruto - estoqueLivre) - 1e-9);
      firmePorTam[t] = firme;
      // Fora de linha pode ter peça já vendida e não entregue: preservar firme,
      // mas sugerir zero produção mesmo com saldo negativo, por regra de negócio.
      const minimo = params.minimosAdotados?.get(k)?.minimo_adotado ?? 0;
      const faltaParaMinimo = Math.max(0, minimo - estoqueLivre);
      const previsao = Math.max(prevLiquido, faltaParaMinimo);
      aProduzirPorTam[t] = foraDeLinha ? 0 : firme + previsao;
      porMinimoPorTam[t] = foraDeLinha ? 0 : Math.max(0, faltaParaMinimo - prevLiquido);
      porMinTot += porMinimoPorTam[t];
      consumo += media;
      livreTot += estoqueLivre;
      firmeTot += firme;
      prodTot += emProducao.get(k) ?? 0;
      aProd += aProduzirPorTam[t];
    }
    if (consumo === 0 && firmeTot === 0) continue;
    out.push({
      modelo, cor, foraDeLinha, aProduzirPorTam, firmePorTam, prontoPorTam, producaoPorTam,
      porMinimoPorTam, porMinimo: porMinTot,
      vendaPrevistaMensal: consumo,
      jaVendido: firmeTot,
      emEstoque: livreTot,
      emProducao: prodTot,
      aProduzir: aProd,
      diasRuptura: firmeTot > 0 ? 0 : diasAteRuptura(livreTot, consumo),
    });
  }
  out.sort((a, b) => a.diasRuptura - b.diasRuptura || b.aProduzir - a.aProduzir);
  return out;
}

export interface SugestaoCor {
  cor: string;
  pecas: number;
  kgNecessario: number;
  kgEstoque: number;
  kgTinturaria: number;
  kgATingir: number;
  diasRuptura: number;
  temCru: boolean;
  leadTime: number;
  decidirAte: Date | null;
}

export function montarTinturaria(params: {
  linhas: LinhaNecessidade[];
  tamanhos: readonly string[];
  fichas: FichaModelo[];
  config: PlanConfig;
  metrosEstoquePorCor: Map<string, number>;
  kgTinturariaPorCor: Map<string, number>;
  cruTotal: number;
}): SugestaoCor[] {
  const { linhas, tamanhos, fichas, config, metrosEstoquePorCor, kgTinturariaPorCor, cruTotal } = params;
  const fichaPor = new Map(fichas.filter((f) => f.ativo).map((f) => [f.modelo, f]));
  const kgMetro = cfg(config, "gramatura_g_por_metro") / 1000;
  const porCor = new Map<string, { pecas: number; kg: number; consumo: number; dias: number }>();
  for (const l of linhas) {
    const f = fichaPor.get(l.modelo);
    const kgp = f ? kgPorPeca(f, config) : 0;
    const pecas = tamanhos.reduce((s, t) => s + (l.aProduzirPorTam[t] ?? 0), 0);
    const c = porCor.get(l.cor) ?? { pecas: 0, kg: 0, consumo: 0, dias: Infinity };
    c.pecas += pecas;
    c.kg += pecas * kgp;
    c.consumo += l.vendaPrevistaMensal * kgp;
    c.dias = Math.min(c.dias, l.diasRuptura);
    porCor.set(l.cor, c);
  }
  const lote = cfg(config, "lote_minimo_tinturaria_kg");
  const base: SugestaoCor[] = [];
  for (const [cor, c] of porCor) {
    const kgEstoque = (metrosEstoquePorCor.get(cor) ?? 0) * kgMetro;
    const kgTint = kgTinturariaPorCor.get(cor) ?? 0;
    const falta = Math.max(0, c.kg - kgEstoque - kgTint);
    // Tecido tingido + tinturaria estendem a cobertura no ritmo de consumo em kg.
    const diasExtra = c.consumo > 0 ? ((kgEstoque + kgTint) / c.consumo) * 30 : Infinity;
    const dias = c.dias === Infinity ? Infinity : c.dias + (Number.isFinite(diasExtra) ? diasExtra : 0);
    base.push({
      cor, pecas: c.pecas, kgNecessario: c.kg, kgEstoque, kgTinturaria: kgTint,
      kgATingir: arredondarLote(falta, lote), diasRuptura: dias,
      temCru: false, leadTime: cfg(config, "lead_time_completo_dias"), decidirAte: null,
    });
  }
  base.sort((a, b) => a.diasRuptura - b.diasRuptura || b.kgATingir - a.kgATingir);
  // Cru distribuído por urgência, sem contar duas vezes.
  let cruRestante = cruTotal;
  for (const s of base) {
    if (s.kgATingir > 0 && cruRestante >= s.kgATingir) {
      s.temCru = true;
      cruRestante -= s.kgATingir;
    }
    s.leadTime = cfg(config, s.temCru ? "lead_time_com_cru_dias" : "lead_time_completo_dias");
    s.decidirAte = dataLimiteDecisao(s.diasRuptura, s.leadTime);
  }
  return base;
}

/* ------------------------- pausas (adiar / sob demanda) ------------------------- */
// Aplicadas SOMENTE na aba Necessidade. A Tinturaria continua usando a previsão cheia.

export interface PlanPausa {
  id: string;
  modelo: string;
  cor: string;
  tipo: "adiado" | "sob_demanda";
  ate: string | null;
  observacao: string | null;
  criado_em: string;
}

export interface LinhaComPausa extends LinhaNecessidade {
  pausa: PlanPausa | null;
  /** true quando a pausa está valendo e a previsão foi zerada */
  previsaoSuspensa: boolean;
  /** sugestão cheia que existiria sem a pausa */
  aProduzirSemPausa: number;
}

function dataLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

export function pausaValendo(p: PlanPausa, hoje: Date = new Date()): boolean {
  if (p.tipo === "sob_demanda") return true;
  if (p.tipo !== "adiado" || !p.ate) return false;
  const h = new Date(hoje);
  h.setHours(0, 0, 0, 0);
  return dataLocal(p.ate).getTime() >= h.getTime();
}

export function aplicarPausas(params: {
  linhas: LinhaNecessidade[];
  pausas: PlanPausa[];
  tamanhos: readonly string[];
  hoje?: Date;
}): { ativas: LinhaComPausa[]; pausadas: LinhaComPausa[] } {
  const hoje = params.hoje ?? new Date();
  const porChave = new Map<string, PlanPausa>();
  for (const p of params.pausas) if (pausaValendo(p, hoje)) porChave.set(`${p.modelo}|${p.cor}`, p);
  const ativas: LinhaComPausa[] = [];
  const pausadas: LinhaComPausa[] = [];
  for (const l of params.linhas) {
    const pausa = porChave.get(`${l.modelo}|${l.cor}`) ?? null;
    if (!pausa) {
      ativas.push({ ...l, pausa: null, previsaoSuspensa: false, aProduzirSemPausa: l.aProduzir });
      continue;
    }
    const aProduzirPorTam: Record<string, number> = {};
    const porMinimoPorTam: Record<string, number> = {};
    let soma = 0;
    for (const t of params.tamanhos) {
      porMinimoPorTam[t] = 0;
      // fora de linha mantém a regra existente: sugestão zero
      const v = l.foraDeLinha ? 0 : (l.firmePorTam[t] ?? 0);
      aProduzirPorTam[t] = v;
      soma += v;
    }
    const nova: LinhaComPausa = {
      ...l, aProduzirPorTam, aProduzir: soma, porMinimoPorTam, porMinimo: 0,
      pausa, previsaoSuspensa: true, aProduzirSemPausa: l.aProduzir,
    };
    (l.jaVendido > 0 ? ativas : pausadas).push(nova);
  }
  pausadas.sort((a, b) => {
    const ta = a.pausa!.tipo === "adiado" ? 0 : 1;
    const tb = b.pausa!.tipo === "adiado" ? 0 : 1;
    if (ta !== tb) return ta - tb;
    if (ta === 0) {
      const d = (a.pausa!.ate ?? "").localeCompare(b.pausa!.ate ?? "");
      if (d !== 0) return d;
    }
    return a.modelo.localeCompare(b.modelo, "pt-BR") || a.cor.localeCompare(b.cor, "pt-BR");
  });
  return { ativas, pausadas };
}

export function usePlanPausas() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: [...PLAN_KEY, "pausas"],
    queryFn: () =>
      paginar<PlanPausa>((a, b) =>
        supabase.from("plan_pausas" as any)
          .select("id, modelo, cor, tipo, ate, observacao, criado_em")
          .is("retomado_em", null).order("id").range(a, b)),
  });
  const pausar = useMutation({
    mutationFn: async (p: { modelo: string; cor: string; tipo: "adiado" | "sob_demanda"; ate: string | null; observacao: string | null }) => {
      if (p.tipo === "adiado" && !p.ate) throw new Error("Escolha até quando adiar.");
      const ate = p.tipo === "sob_demanda" ? null : p.ate;
      const { data: u } = await supabase.auth.getUser();
      const agora = new Date().toISOString();
      const { error: e1 } = await supabase.from("plan_pausas" as any)
        .update({ retomado_em: agora, retomado_por: u.user?.id ?? null })
        .eq("modelo", p.modelo).eq("cor", p.cor).is("retomado_em", null);
      if (e1) throw e1;
      const obs = p.observacao?.trim() || null;
      const { error: e2 } = await supabase.from("plan_pausas" as any)
        .insert({ modelo: p.modelo, cor: p.cor, tipo: p.tipo, ate, observacao: obs });
      if (e2) throw e2;
    },
    onSuccess: async (_d, p) => {
      await qc.invalidateQueries({ queryKey: PLAN_KEY });
      toast.success(p.tipo === "adiado" ? "Linha adiada." : "Linha marcada como sob demanda.");
    },
    onError: () => toast.error("Não foi possível salvar."),
  });
  const retomar = useMutation({
    mutationFn: async (id: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("plan_pausas" as any)
        .update({ retomado_em: new Date().toISOString(), retomado_por: u.user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: PLAN_KEY });
      toast.success("Linha retomada.");
    },
    onError: () => toast.error("Não foi possível retomar."),
  });
  return { pausas: query.data ?? [], isLoading: query.isLoading, error: query.error as Error | null, pausar, retomar };
}

/* --------------------------- estoque mínimo --------------------------- */

export type OrigemLead = "modelo" | "geral" | "parametro";

export interface LeadTimePorModelo {
  porModelo: Map<string, number>;
  geral: number | null;
  amostraPorModelo: Map<string, number>;
  amostraGeral: number;
}

export function mediana(valores: number[]): number {
  if (!valores.length) return 0;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const DIA_MS = 86_400_000;
function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DIA_MS);
}

/** Pura: monta lead time a partir das linhas de COP. */
export function calcLeadTimePorModelo(
  cops: { solicitacao_risco: string | null; execucao_corte: string | null; data_recebimento: string | null; pecas: unknown }[],
): LeadTimePorModelo {
  const tempos: number[] = [];
  const porModeloLista = new Map<string, number[]>();
  for (const c of cops) {
    if (!c.data_recebimento) continue;
    const inicio = c.solicitacao_risco ?? c.execucao_corte;
    if (!inicio) continue;
    const d = diasEntre(inicio, c.data_recebimento);
    if (!Number.isFinite(d) || d < 0 || d > 180) continue;
    tempos.push(d);
    const modelos = new Set<string>();
    for (const p of (Array.isArray(c.pecas) ? c.pecas : []) as any[]) if (p?.modelo) modelos.add(String(p.modelo));
    for (const m of modelos) {
      const l = porModeloLista.get(m) ?? [];
      l.push(d);
      porModeloLista.set(m, l);
    }
  }
  const porModelo = new Map<string, number>();
  const amostraPorModelo = new Map<string, number>();
  for (const [m, l] of porModeloLista) {
    amostraPorModelo.set(m, l.length);
    if (l.length >= 5) porModelo.set(m, mediana(l));
  }
  return { porModelo, geral: tempos.length >= 5 ? mediana(tempos) : null, amostraPorModelo, amostraGeral: tempos.length };
}

export function usePlanLeadTimePorModelo() {
  return useQuery({
    queryKey: [...PLAN_KEY, "lead-time-modelo"],
    queryFn: async () => {
      const desde = new Date();
      desde.setMonth(desde.getMonth() - 12);
      const rows = await paginar<any>((a, b) =>
        supabase.from("cops").select("id, solicitacao_risco, execucao_corte, data_recebimento, pecas")
          .not("data_recebimento", "is", null).gte("data_recebimento", desde.toISOString().slice(0, 10))
          .order("id").range(a, b));
      return calcLeadTimePorModelo(rows);
    },
    staleTime: 5 * 60_000,
  });
}

export function leadTimeDoModelo(
  modelo: string, lead: LeadTimePorModelo | undefined, config: PlanConfig,
): { dias: number; origem: OrigemLead; amostra: number } {
  const m = lead?.porModelo.get(modelo);
  if (m !== undefined) return { dias: m, origem: "modelo", amostra: lead!.amostraPorModelo.get(modelo) ?? 0 };
  if (lead?.geral != null) return { dias: lead.geral, origem: "geral", amostra: lead.amostraGeral };
  return { dias: cfg(config, "lead_time_com_cru_dias"), origem: "parametro", amostra: 0 };
}

export function consumoNaReposicao(mediaMensal: number, leadDias: number): number {
  return (mediaMensal / 30) * leadDias;
}
export function folgaSeguranca(mediaMensal: number, semanasSeguranca: number): number {
  return (mediaMensal * semanasSeguranca) / 4.33;
}

export function minimoSugerido(mediaMensal: number, leadDias: number, semanasSeguranca: number): number {
  if (!(mediaMensal > 0)) return 0;
  return Math.ceil(consumoNaReposicao(mediaMensal, leadDias) + folgaSeguranca(mediaMensal, semanasSeguranca) - 1e-9);
}

export interface MinimoSalvo {
  modelo: string; cor: string; tamanho: string;
  minimo_adotado: number; sugerido_na_adocao: number | null;
  adotado_em: string; adotado_por: string | null;
}

export interface LinhaEstoqueMinimo {
  modelo: string; cor: string; tamanho: string;
  mediaMensal: number; leadDias: number; origemLead: OrigemLead; amostraLead: number;
  consumo: number; folga: number; sugerido: number;
  adotado: number | null; defasado: boolean; sugeridoNaAdocao: number | null;
}

export function montarEstoqueMinimo(params: {
  mediaMensal: Map<string, number>;
  tamanhos: readonly string[];
  leadTime: LeadTimePorModelo | undefined;
  config: PlanConfig;
  coresForaDeLinha: Set<string>;
  minimosAdotados: Map<string, MinimoSalvo>;
  limiarPct: number;
}): LinhaEstoqueMinimo[] {
  const { mediaMensal, tamanhos, leadTime, config, coresForaDeLinha, minimosAdotados, limiarPct } = params;
  const chaves = new Set<string>();
  for (const [k, v] of mediaMensal) if (v > 0) chaves.add(k);
  for (const k of minimosAdotados.keys()) chaves.add(k);
  const semanas = cfg(config, "semanas_seguranca");
  const out: LinhaEstoqueMinimo[] = [];
  for (const k of chaves) {
    const [modelo, cor, tamanho] = k.split("|");
    if (!modelo || !cor || !tamanho) continue;
    if (coresForaDeLinha.has(cor)) continue;
    const media = mediaMensal.get(k) ?? 0;
    const lt = leadTimeDoModelo(modelo, leadTime, config);
    const sugerido = minimoSugerido(media, lt.dias, semanas);
    const salvo = minimosAdotados.get(k);
    const adotado = salvo ? salvo.minimo_adotado : null;
    out.push({
      modelo, cor, tamanho, mediaMensal: media, leadDias: lt.dias, origemLead: lt.origem, amostraLead: lt.amostra,
      consumo: media > 0 ? consumoNaReposicao(media, lt.dias) : 0,
      folga: media > 0 ? folgaSeguranca(media, semanas) : 0,
      sugerido, adotado,
      defasado: adotado !== null && sugerido > adotado * (1 + limiarPct / 100),
      sugeridoNaAdocao: salvo?.sugerido_na_adocao ?? null,
    });
  }
  const ordCor = new Map(REFACAO_CORES.map((c, i) => [c.nome, i]));
  const ordTam = new Map(tamanhos.map((t, i) => [t, i]));
  out.sort((a, b) =>
    a.modelo.localeCompare(b.modelo, "pt-BR")
    || (ordCor.get(a.cor) ?? 999) - (ordCor.get(b.cor) ?? 999) || a.cor.localeCompare(b.cor, "pt-BR")
    || (ordTam.get(a.tamanho) ?? 999) - (ordTam.get(b.tamanho) ?? 999));
  return out;
}

export function usePlanMinimos() {
  return useQuery({
    queryKey: [...PLAN_KEY, "estoque-minimo"],
    queryFn: async () => {
      const rows = await paginar<MinimoSalvo>((a, b) =>
        supabase.from("plan_estoque_minimo").select("modelo, cor, tamanho, minimo_adotado, sugerido_na_adocao, adotado_em, adotado_por")
          .order("id").range(a, b));
      const m = new Map<string, MinimoSalvo>();
      for (const r of rows) m.set(pkKey(r.modelo, r.cor, r.tamanho), r);
      return m;
    },
  });
}

export interface MinimoParaSalvar { modelo: string; cor: string; tamanho: string; minimo: number; sugerido: number }

async function upsertMinimos(itens: MinimoParaSalvar[]) {
  const { data: u } = await supabase.auth.getUser();
  const agora = new Date().toISOString();
  const { error } = await supabase.from("plan_estoque_minimo").upsert(
    itens.map((i) => ({
      modelo: i.modelo, cor: i.cor, tamanho: i.tamanho,
      minimo_adotado: i.minimo, sugerido_na_adocao: i.sugerido,
      adotado_em: agora, adotado_por: u.user?.id ?? null,
    })),
    { onConflict: "modelo,cor,tamanho" },
  );
  if (error) throw error;
}

export function useSalvarMinimo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: MinimoParaSalvar) => upsertMinimos([i]),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLAN_KEY }),
  });
}

export function useSalvarMinimosEmLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itens: MinimoParaSalvar[]) => (itens.length ? upsertMinimos(itens) : Promise.resolve()),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLAN_KEY }),
  });
}
