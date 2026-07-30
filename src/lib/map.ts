import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type MapStatus = "aguardando_faturamento" | "entregue";
export type MapFaturar = "Joke" | "Juff";

export interface MapProducao {
  id: string;
  numero: number;
  data_pedido: string;
  faturar_para: MapFaturar;
  fornecedor: string;
  kg_solicitados: number;
  nota_fiscal: string | null;
  data_faturamento: string | null;
  data_pagamento: string | null;
  status: MapStatus;
  malharia: string | null;
  status_malharia: "completo" | "incompleto";
  quebra_conciliada: boolean;
  quebra_conciliacao_obs: string | null;
  quebra_conciliada_em: string | null;
  quebra_conciliada_por: string | null;
  finalizado: boolean;
  finalizado_em: string | null;
  finalizado_por: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MapEntregaMalharia {
  id: string;
  producao_id: string;
  data_recebimento: string | null;
  kg: number | null;
  pecas: number | null;
  nota_fiscal_1: string | null;
  nota_fiscal_2: string | null;
  nota_cobertura: string | null;
  created_at: string;
}

export interface MapProgramacaoTinturaria {
  id: string;
  producao_id: string;
  tinturaria: string;
  data_programacao: string | null;
  pecas: number | null;
  cor: string | null;
  kg_enviados: number | null;
  kg_recebidos: number | null;
  pecas_recebidas: number | null;
  data_recebimento: string | null;
  nota_fiscal_recebimento: string | null;
  nota_cobertura: string | null;
  retingir_origem_id?: string | null;
  created_at: string;
}

export type MapEstoquePecaStatus = "Fechada" | "Aberta" | "Corte" | "Devolvida" | "100% utilizada";

export type CorrecaoTipo = "retingir" | "retrabalhar";
export type CorrecaoStatus = "aguardando_retingir" | "em_retrabalho";

export interface HistoricoCorrecaoEvento {
  tipo: "devolucao" | "correcao_iniciada" | "retorno";
  em: string;
  motivo?: string | null;
  data_devolucao?: string | null;
  nf_devolucao?: string | null;
  correcao?: CorrecaoTipo;
  cor_nova?: string | null;
  programacao_origem_id?: string | null;
  programacao_destino_id?: string | null;
  destino_criada?: boolean;
  delta_kg_enviados?: number;
  origem_snapshot?: {
    pecas: number;
    kg_enviados: number;
    pecas_recebidas: number | null;
    kg_recebidos: number | null;
  } | null;
  numero_peca_antigo?: string | null;
  nota_fiscal_antiga?: string | null;
  cor_antiga?: string | null;
  data_entrada_antiga?: string | null;
  numero_peca_novo?: string | null;
  nota_fiscal_nova?: string | null;
  data_entrada_nova?: string | null;
}

export interface MapEstoqueCorte {
  cop_id: string;
  cop_numero: number;
  letra: string | null;
  metros: number;
  data: string;
}

export interface MapEstoquePeca {
  id: string;
  ne: number | null;
  programacao_id: string;
  producao_id: string;
  nota_fiscal: string | null;
  cor: string | null;
  data_entrada: string | null;
  numero_peca: string | null;
  status: MapEstoquePecaStatus;
  data_abertura: string | null;
  alt_inicial: number | null;
  larg: number | null;
  cortes: MapEstoqueCorte[];
  devolucao_motivo?: string | null;
  devolucao_data?: string | null;
  devolucao_nf?: string | null;
  correcao_tipo?: CorrecaoTipo | null;
  correcao_status?: CorrecaoStatus | null;
  cor_nova?: string | null;
  historico_correcoes?: HistoricoCorrecaoEvento[];
  created_at: string;
  updated_at: string;
}

// Cor base = parte antes do sufixo "-ACABx"
export function corBase(cor: string | null | undefined): string {
  if (!cor) return "";
  return cor.split("-")[0];
}

export function programacaoRecebimentoCompleto(p: MapProgramacaoTinturaria): boolean {
  return (
    p.pecas_recebidas != null &&
    Number(p.pecas_recebidas) > 0 &&
    notEmpty(p.data_recebimento) &&
    notEmpty(p.nota_fiscal_recebimento)
  );
}

// -------------------- Helpers --------------------

export function sumKgEntregas(entregas: MapEntregaMalharia[]): number {
  return entregas.reduce((s, e) => s + Number(e.kg ?? 0), 0);
}
export function sumPecasEntregas(entregas: MapEntregaMalharia[]): number {
  return entregas.reduce((s, e) => s + Number(e.pecas ?? 0), 0);
}
export function sumPecasProgramadas(progs: MapProgramacaoTinturaria[]): number {
  return progs.reduce((s, p) => s + Number(p.pecas ?? 0), 0);
}

export function calcQuebra(prod: MapProducao, entregas: MapEntregaMalharia[]): number {
  return sumKgEntregas(entregas) - Number(prod.kg_solicitados ?? 0);
}

// -------------------- Status derivados (frontend-only) --------------------

export type MapStatusFio = "entregue" | "aguardando_faturamento";
export type MapStatusEtapa = "completo" | "incompleto";

function notEmpty(v: unknown): boolean {
  return v != null && String(v).trim() !== "";
}

export function calcStatusFio(prod: MapProducao): MapStatusFio {
  return notEmpty(prod.nota_fiscal) && notEmpty(prod.data_faturamento)
    ? "entregue"
    : "aguardando_faturamento";
}

export function calcStatusMalharia(
  prod: MapProducao,
  _entregas: MapEntregaMalharia[],
): MapStatusEtapa {
  return prod.status_malharia === "completo" ? "completo" : "incompleto";
}

export function calcStatusTinturaria(
  progs: MapProgramacaoTinturaria[],
  pecasRecebidasMalharia: number,
): MapStatusEtapa {
  if (progs.length === 0) return "incompleto";
  const todasOk = progs.every(
    (p) =>
      p.kg_recebidos != null &&
      p.pecas_recebidas != null &&
      notEmpty(p.data_recebimento) &&
      notEmpty(p.nota_fiscal_recebimento),
  );
  if (!todasOk) return "incompleto";
  return sumPecasProgramadas(progs) === pecasRecebidasMalharia ? "completo" : "incompleto";
}

export function podeFinalizar(
  prod: MapProducao,
  entregas: MapEntregaMalharia[],
  progs: MapProgramacaoTinturaria[],
): boolean {
  if (calcStatusFio(prod) !== "entregue") return false;
  if (entregas.length === 0) return false;
  if (progs.length === 0) return false;
  return progs.every(
    (p) =>
      !!p.data_recebimento &&
      p.kg_recebidos != null &&
      p.pecas_recebidas != null,
  );
}


export function fmt(v: unknown, opts?: { decimals?: number }): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") {
    const d = opts?.decimals ?? 2;
    return v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  return String(v);
}

export function prodCode(numero: number | string): string {
  return `PROD${numero}`;
}

export function fmtDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}

// -------------------- kg_por_peca (map_config) --------------------

export function useKgPorPeca() {
  const qc = useQueryClient();
  const { data = 20, isLoading } = useQuery({
    queryKey: ["map", "config", "kg_por_peca"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("map_config")
        .select("value")
        .eq("key", "kg_por_peca")
        .maybeSingle();
      if (error) throw error;
      const v = data?.value;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) && n > 0 ? n : 20;
    },
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async (kg: number) => {
      const { error } = await (supabase as any)
        .from("map_config")
        .upsert({ key: "kg_por_peca", value: kg, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["map", "config", "kg_por_peca"] });
      toast.success("Configuração salva.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  return { kgPorPeca: data, isLoading, save };
}

// -------------------- cor_acabamentos (map_config) --------------------

export type CorAcabamentoMap = Record<string, string>;

export function corComAcabamento(nomeCor: string, mapa: CorAcabamentoMap | undefined | null): string {
  const acab = mapa?.[nomeCor];
  return acab ? `${nomeCor}-${acab}` : nomeCor;
}

export function useCorAcabamentos() {
  const qc = useQueryClient();
  const { data = {} as CorAcabamentoMap, isLoading } = useQuery({
    queryKey: ["map", "config", "cor_acabamentos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("map_config")
        .select("value")
        .eq("key", "cor_acabamentos")
        .maybeSingle();
      if (error) throw error;
      const v = data?.value;
      return (v && typeof v === "object" ? v : {}) as CorAcabamentoMap;
    },
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async (mapa: CorAcabamentoMap) => {
      const { error } = await (supabase as any)
        .from("map_config")
        .upsert({ key: "cor_acabamentos", value: mapa, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["map", "config", "cor_acabamentos"] });
      toast.success("Acabamento salvo.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  return { mapa: data, isLoading, save };
}

// -------------------- Queries principais --------------------

export function useMapData(finalizado: boolean) {
  const qc = useQueryClient();
  const producoes = useQuery({
    queryKey: ["map", "producoes", { finalizado }],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("map_producoes")
        .select("*")
        .eq("finalizado", finalizado)
        .order("data_pedido", { ascending: true })
        .order("numero", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MapProducao[];
    },
  });
  const entregas = useQuery({
    queryKey: ["map", "entregas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("map_malharia_entregas")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MapEntregaMalharia[];
    },
  });
  const programacoes = useQuery({
    queryKey: ["map", "programacoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("map_tinturaria_programacoes")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MapProgramacaoTinturaria[];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["map", "producoes"] });
    qc.invalidateQueries({ queryKey: ["map", "entregas"] });
    qc.invalidateQueries({ queryKey: ["map", "programacoes"] });
  };

  return { producoes, entregas, programacoes, invalidateAll };
}

// -------------------- Mutations por campo (anti stale-write) --------------------

export async function patchProducao(id: string, patch: Partial<MapProducao>) {
  const { error } = await (supabase as any).from("map_producoes").update(patch).eq("id", id);
  if (error) throw error;
}
export async function patchEntrega(id: string, patch: Partial<MapEntregaMalharia>) {
  const { error } = await (supabase as any).from("map_malharia_entregas").update(patch).eq("id", id);
  if (error) throw error;
}
export async function patchProgramacao(id: string, patch: Partial<MapProgramacaoTinturaria>) {
  const { error } = await (supabase as any).from("map_tinturaria_programacoes").update(patch).eq("id", id);
  if (error) throw error;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp0 = (n: number) => (n < 0 ? 0 : round2(n));

/**
 * Move 1 peça (e os kg proporcionais) da programação de tinturaria original para
 * uma linha da cor nova. Reduz a original e cria/incrementa a linha destino.
 * A soma (original reduzida + nova) fecha com os totais anteriores.
 * Retorna dados suficientes para desfazer a operação com exatidão.
 */
export interface RetingirResultado {
  destino_id: string;
  destino_criada: boolean;
  delta_kg_enviados: number;
  origem_snapshot: {
    pecas: number;
    kg_enviados: number;
    pecas_recebidas: number | null;
    kg_recebidos: number | null;
  };
}

export async function retingirProgramacao(
  programacaoId: string,
  corNova: string,
): Promise<RetingirResultado> {
  const { data: orig, error: e1 } = await (supabase as any)
    .from("map_tinturaria_programacoes")
    .select("*")
    .eq("id", programacaoId)
    .maybeSingle();
  if (e1) throw e1;
  if (!orig) throw new Error("Programação de tinturaria da peça não encontrada.");

  const pecas = Number(orig.pecas ?? 0);
  const pecasRec = orig.pecas_recebidas == null ? null : Number(orig.pecas_recebidas);
  const kgEnv = Number(orig.kg_enviados ?? 0);
  const kgRec = orig.kg_recebidos == null ? null : Number(orig.kg_recebidos);

  const razaoEnv = pecas > 0 ? kgEnv / pecas : 0;
  const razaoRec = pecasRec != null && pecasRec > 0 && kgRec != null ? kgRec / pecasRec : 0;
  const deltaEnv = round2(razaoEnv);
  const deltaRec = round2(razaoRec);

  const origemSnapshot = {
    pecas,
    kg_enviados: kgEnv,
    pecas_recebidas: pecasRec,
    kg_recebidos: kgRec,
  };

  // 1) Reduz a linha original proporcionalmente (nunca negativo).
  const patchOrig: Record<string, unknown> = {
    pecas: Math.max(0, pecas - 1),
    kg_enviados: clamp0(kgEnv - deltaEnv),
  };
  if (pecasRec != null && pecasRec > 0) {
    patchOrig.pecas_recebidas = Math.max(0, pecasRec - 1);
    if (kgRec != null) patchOrig.kg_recebidos = clamp0(kgRec - deltaRec);
  }
  await patchProgramacao(orig.id, patchOrig as Partial<MapProgramacaoTinturaria>);

  // 2) Procura linha destino já aberta (mesma origem, mesma cor, sem recebimento).
  const { data: existentes, error: e2 } = await (supabase as any)
    .from("map_tinturaria_programacoes")
    .select("*")
    .eq("producao_id", orig.producao_id)
    .eq("retingir_origem_id", orig.id)
    .eq("cor", corNova)
    .is("pecas_recebidas", null)
    .is("nota_fiscal_recebimento", null);
  if (e2) throw e2;

  const destino = (existentes ?? [])[0];
  if (destino) {
    await patchProgramacao(destino.id, {
      pecas: Number(destino.pecas ?? 0) + 1,
      kg_enviados: round2(Number(destino.kg_enviados ?? 0) + deltaEnv),
    } as Partial<MapProgramacaoTinturaria>);
    return {
      destino_id: destino.id as string,
      destino_criada: false,
      delta_kg_enviados: deltaEnv,
      origem_snapshot: origemSnapshot,
    };
  }

  const { data: nova, error: e3 } = await (supabase as any)
    .from("map_tinturaria_programacoes")
    .insert({
      producao_id: orig.producao_id,
      tinturaria: orig.tinturaria,
      data_programacao: new Date().toISOString().slice(0, 10),
      cor: corNova,
      pecas: 1,
      kg_enviados: deltaEnv,
      kg_recebidos: null,
      pecas_recebidas: null,
      data_recebimento: null,
      nota_fiscal_recebimento: null,
      nota_cobertura: null,
      retingir_origem_id: orig.id,
    })
    .select("id")
    .single();
  if (e3) throw e3;
  return {
    destino_id: nova.id as string,
    destino_criada: true,
    delta_kg_enviados: deltaEnv,
    origem_snapshot: origemSnapshot,
  };
}




// -------------------- Estoque de MP (peças de tecido) --------------------

export function useEstoquePecas() {
  return useQuery({
    queryKey: ["map", "estoque_pecas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("map_estoque_pecas")
        .select("*")
        .order("data_entrada", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        cortes: Array.isArray(r.cortes) ? r.cortes : [],
      })) as MapEstoquePeca[];
    },
  });
}

export async function patchEstoquePeca(id: string, patch: Partial<MapEstoquePeca>) {
  const { error } = await (supabase as any).from("map_estoque_pecas").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Idempotente: para cada programação de tinturaria com recebimento completo,
 * garante que existam `pecas_recebidas` linhas em map_estoque_pecas com aquele
 * programacao_id. Se faltarem, insere a diferença. Nunca deleta.
 */
export async function syncEstoquePecas(): Promise<void> {
  const { data: progs, error: e1 } = await (supabase as any)
    .from("map_tinturaria_programacoes")
    .select("id, producao_id, pecas_recebidas, data_recebimento, nota_fiscal_recebimento, cor");
  if (e1) throw e1;
  const completas = ((progs ?? []) as any[]).filter(
    (p) =>
      p.pecas_recebidas != null &&
      Number(p.pecas_recebidas) > 0 &&
      p.data_recebimento &&
      p.nota_fiscal_recebimento,
  );
  if (completas.length === 0) return;
  const ids = completas.map((p) => p.id);
  const { data: existentes, error: e2 } = await (supabase as any)
    .from("map_estoque_pecas")
    .select("programacao_id")
    .in("programacao_id", ids);
  if (e2) throw e2;
  const contagem = new Map<string, number>();
  for (const r of (existentes ?? []) as any[]) {
    contagem.set(r.programacao_id, (contagem.get(r.programacao_id) ?? 0) + 1);
  }
  const inserts: any[] = [];
  for (const p of completas) {
    const alvo = Number(p.pecas_recebidas);
    const atual = contagem.get(p.id) ?? 0;
    const faltam = alvo - atual;
    for (let i = 0; i < faltam; i++) {
      inserts.push({
        programacao_id: p.id,
        producao_id: p.producao_id,
        nota_fiscal: p.nota_fiscal_recebimento,
        cor: p.cor,
        data_entrada: p.data_recebimento,
        status: "Fechada",
        cortes: [],
      });
    }
  }
  if (inserts.length === 0) return;
  const { error: e3 } = await (supabase as any).from("map_estoque_pecas").insert(inserts);
  if (e3) throw e3;
}


/**
 * Reverso de `retingirProgramacao`: devolve 1 peça (e kg proporcionais) da linha
 * de destino para a linha de origem. Se a linha de destino ficar vazia (0 peças)
 * e tiver sido criada por retingir, ela é removida.
 */
export async function desfazerRetingirProgramacao(
  destinoId: string,
  origemId: string,
  info?: {
    destino_criada?: boolean;
    delta_kg_enviados?: number;
    origem_snapshot?: RetingirResultado["origem_snapshot"] | null;
  },
): Promise<void> {
  const { data: dest, error: e1 } = await (supabase as any)
    .from("map_tinturaria_programacoes")
    .select("*")
    .eq("id", destinoId)
    .maybeSingle();
  if (e1) throw e1;
  const { data: orig, error: e2 } = await (supabase as any)
    .from("map_tinturaria_programacoes")
    .select("*")
    .eq("id", origemId)
    .maybeSingle();
  if (e2) throw e2;
  if (!dest || !orig) return;

  const pecasDest = Number(dest.pecas ?? 0);
  const kgDest = Number(dest.kg_enviados ?? 0);
  // kg movidos nesta operação: preferimos o valor registrado no histórico.
  const delta =
    info?.delta_kg_enviados != null
      ? round2(info.delta_kg_enviados)
      : pecasDest > 0
        ? round2(kgDest / pecasDest)
        : 0;

  // 1) Restaura a linha de origem exatamente como estava (quando temos snapshot).
  const snap = info?.origem_snapshot ?? null;
  if (snap) {
    const patch: Record<string, unknown> = {
      pecas: snap.pecas,
      kg_enviados: round2(snap.kg_enviados),
    };
    if (snap.pecas_recebidas != null) patch.pecas_recebidas = snap.pecas_recebidas;
    if (snap.kg_recebidos != null) patch.kg_recebidos = round2(snap.kg_recebidos);
    await patchProgramacao(orig.id, patch as Partial<MapProgramacaoTinturaria>);
  } else {
    const pecasRecOrig = orig.pecas_recebidas == null ? null : Number(orig.pecas_recebidas);
    const patch: Record<string, unknown> = {
      pecas: Number(orig.pecas ?? 0) + 1,
      kg_enviados: round2(Number(orig.kg_enviados ?? 0) + delta),
    };
    if (pecasRecOrig != null) patch.pecas_recebidas = pecasRecOrig + 1;
    await patchProgramacao(orig.id, patch as Partial<MapProgramacaoTinturaria>);
  }

  // 2) Remove a linha destino se ela foi criada por esta operação; senão devolve 1 peça.
  const restante = Math.max(0, pecasDest - 1);
  const criadaAqui = info?.destino_criada ?? dest.retingir_origem_id === origemId;
  if (criadaAqui && restante === 0) {
    const { error: e3 } = await (supabase as any)
      .from("map_tinturaria_programacoes")
      .delete()
      .eq("id", dest.id);
    if (e3) throw e3;
    return;
  }
  await patchProgramacao(dest.id, {
    pecas: restante,
    kg_enviados: clamp0(kgDest - delta),
  } as Partial<MapProgramacaoTinturaria>);
}

/**
 * Desfaz a correção iniciada (retingir/retrabalhar) de uma peça devolvida,
 * voltando-a ao status "Devolvida" sem correção.
 */
export async function desfazerCorrecaoPeca(peca: MapEstoquePeca): Promise<void> {
  const hist = Array.isArray(peca.historico_correcoes) ? [...peca.historico_correcoes] : [];
  const idx = [...hist].reverse().findIndex((e) => e.tipo === "correcao_iniciada");
  const evento = idx >= 0 ? hist[hist.length - 1 - idx] : null;
  const origemId = evento?.programacao_origem_id ?? null;
  const destinoId = evento?.programacao_destino_id ?? peca.programacao_id;

  if (peca.correcao_tipo === "retingir" && origemId && destinoId && destinoId !== origemId) {
    await desfazerRetingirProgramacao(destinoId, origemId, {
      destino_criada: evento?.destino_criada ?? undefined,
      delta_kg_enviados: evento?.delta_kg_enviados ?? undefined,
      origem_snapshot: evento?.origem_snapshot ?? null,
    });
  }

  if (idx >= 0) hist.splice(hist.length - 1 - idx, 1);

  await patchEstoquePeca(peca.id, {
    correcao_tipo: null,
    correcao_status: null,
    cor_nova: null,
    historico_correcoes: hist,
    ...(origemId ? { programacao_id: origemId } : {}),
  } as Partial<MapEstoquePeca>);
}


/**
 * Desfaz a devolução de uma peça: volta ao estoque de MP limpando os campos de
 * devolução. Status volta para "Aberta" quando já houve cortes, senão "Fechada".
 */
export async function desfazerDevolucaoPeca(peca: MapEstoquePeca): Promise<void> {
  const hist = Array.isArray(peca.historico_correcoes) ? [...peca.historico_correcoes] : [];
  const idx = [...hist].reverse().findIndex((e) => e.tipo === "devolucao");
  if (idx >= 0) hist.splice(hist.length - 1 - idx, 1);
  const temCortes = Array.isArray(peca.cortes) && peca.cortes.length > 0;
  await patchEstoquePeca(peca.id, {
    status: temCortes ? "Aberta" : "Fechada",
    devolucao_motivo: null,
    devolucao_data: null,
    devolucao_nf: null,
    historico_correcoes: hist,
  } as Partial<MapEstoquePeca>);
}
