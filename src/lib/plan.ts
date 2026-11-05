// Módulo PLAN — cálculos de sugestão. Somente leitura sobre COP/MAP/Olist;
// escreve apenas em plan_config e plan_fichas_modelo.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Cop } from "@/lib/cop";
import type { Pedido } from "@/lib/pedidos";
import {
  calcDisponivel, calcEmProducao, calcFaltantes, calcPerdas, calcRecebido, pkKey,
} from "@/lib/cop-saldos";
import { apenasVigentes, type LotesPorData } from "@/lib/olist-vendas";
import { REFACAO_CORES } from "@/lib/pedidos";

export { pkKey };

/* ------------------------- normalização de cor ------------------------- */

function normTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Escapa texto para uso literal em RegExp. */
function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const _CORES_NORM: { canonico: string; norm: string; re: RegExp }[] = REFACAO_CORES.map((c) => {
  const norm = normTexto(c.nome);
  return { canonico: c.nome, norm, re: new RegExp(`(^| )${escRe(norm)}( |$)`) };
});

/**
 * Traduz uma descrição de cor vinda de fora (Olist, MAP) para o nome canônico
 * de REFACAO_CORES. Casa exato; senão, por palavra inteira em qualquer direção,
 * somente quando há exatamente uma candidata. Nunca adivinha: sem candidata
 * única, devolve null.
 */
export function normalizarCor(bruto: string): string | null {
  const t = normTexto(bruto ?? "");
  if (!t) return null;
  const exato = _CORES_NORM.find((c) => c.norm === t);
  if (exato) return exato.canonico;
  const reT = new RegExp(`(^| )${escRe(t)}( |$)`);
  const candidatas = _CORES_NORM.filter((c) => c.re.test(t) || reT.test(c.norm));
  return candidatas.length === 1 ? candidatas[0].canonico : null;
}

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
      data: { saldoReal: new Map(), emProducao: new Map(), naoMapeados: new Map(), coresNaoReconhecidas: new Map() } as SaldoRealPlan,
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
      coresNaoReconhecidas.set(bruta, (coresNaoReconhecidas.get(bruta) ?? 0) + qtd);
      continue;
    }
    const k = pkKey(modelo, cor, String(it.tamanho));
    const alvo = it.empresa === "JOKE" ? joke : juff;
    alvo.set(k, (alvo.get(k) ?? 0) + qtd);
  }

  const chaves = new Set<string>([...joke.keys(), ...juff.keys(), ...disponivel.keys()]);
  const saldoReal = new Map<string, number>();
  for (const k of chaves) {
    const multiEmpresa = Math.max(0, (joke.get(k) ?? 0) + (juff.get(k) ?? 0));
    saldoReal.set(k, multiEmpresa + (disponivel.get(k) ?? 0));
  }

  return {
    data: { saldoReal, emProducao, naoMapeados, coresNaoReconhecidas } as SaldoRealPlan,
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
          coresNaoReconhecidas.set(bruta, (coresNaoReconhecidas.get(bruta) ?? 0) + restante);
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
          coresNaoReconhecidas.set(bruta, (coresNaoReconhecidas.get(bruta) ?? 0) + kgv);
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
  vendido: Record<string, number>;
  previsto: Record<string, number>;
  vendaPrevistaMensal: number;
  jaVendido: number;
  emEstoque: number;
  emProducao: number;
  aProduzir: number;
  diasRuptura: number;
}

export function montarNecessidade(params: {
  tamanhos: readonly string[];
  disponivel: Map<string, number>;
  emProducao: Map<string, number>;
  mediaMensal: Map<string, number>;
  horizonteMeses: number;
  semanasSeguranca: number;
}): LinhaNecessidade[] {
  const { tamanhos, disponivel, emProducao, mediaMensal, horizonteMeses, semanasSeguranca } = params;
  const combos = new Map<string, { modelo: string; cor: string }>();
  for (const k of [...disponivel.keys(), ...mediaMensal.keys()]) {
    const [modelo, cor, tam] = k.split("|");
    if (!modelo || !cor || !tamanhos.includes(tam)) continue;
    combos.set(`${modelo}|${cor}`, { modelo, cor });
  }
  const out: LinhaNecessidade[] = [];
  for (const { modelo, cor } of combos.values()) {
    const vendido: Record<string, number> = {};
    const previsto: Record<string, number> = {};
    let consumo = 0, livreTot = 0, firmeTot = 0, prodTot = 0, aProd = 0;
    for (const t of tamanhos) {
      const k = pkKey(modelo, cor, t);
      const disp = disponivel.get(k) ?? 0;
      const media = mediaMensal.get(k) ?? 0;
      const firme = Math.max(0, -disp);
      // Disponível positivo = estoque + produção ainda não comprometidos.
      const livre = Math.max(0, disp);
      const prevBruto = demandaTotal(media, horizonteMeses, 0, semanasSeguranca);
      vendido[t] = firme;
      previsto[t] = Math.ceil(necessidadeLiquida(prevBruto, livre, 0) - 1e-9);
      consumo += media;
      livreTot += livre;
      firmeTot += firme;
      prodTot += emProducao.get(k) ?? 0;
      aProd += vendido[t] + previsto[t];
    }
    if (consumo === 0 && firmeTot === 0) continue;
    const livreEstoque = Math.max(0, livreTot - prodTot);
    out.push({
      modelo, cor, vendido, previsto,
      vendaPrevistaMensal: consumo,
      jaVendido: firmeTot,
      emEstoque: livreEstoque,
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
    const pecas = tamanhos.reduce((s, t) => s + (l.vendido[t] ?? 0) + (l.previsto[t] ?? 0), 0);
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
