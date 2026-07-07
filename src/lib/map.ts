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
  created_at: string;
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
