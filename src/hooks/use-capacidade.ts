import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TETO_PADRAO, type Etapa } from "@/lib/pcp-monitor";

export type CapacidadeRow = { etapa: string; teto_dia: number };

export function useCapacidade() {
  const q = useQuery({
    queryKey: ["pcp_capacidade_etapa"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pcp_capacidade_etapa").select("etapa, teto_dia");
      if (error) throw error;
      return (data ?? []) as CapacidadeRow[];
    },
    staleTime: 5 * 60 * 1000,
  });
  const tetos: Record<Etapa, number> = { ...TETO_PADRAO };
  for (const r of q.data ?? []) {
    if (r.etapa in tetos) tetos[r.etapa as Etapa] = Number(r.teto_dia) || 0;
  }
  return { tetos, isLoading: q.isLoading };
}

export function useSalvarCapacidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (valores: Record<Etapa, number>) => {
      const { data: auth } = await supabase.auth.getUser();
      const rows = Object.entries(valores).map(([etapa, teto_dia]) => ({
        etapa,
        teto_dia,
        atualizado_em: new Date().toISOString(),
        atualizado_por: auth.user?.id ?? null,
      }));
      const { error } = await (supabase as any).from("pcp_capacidade_etapa").upsert(rows, { onConflict: "etapa" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pcp_capacidade_etapa"] });
      toast.success("Capacidade atualizada.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar capacidade"),
  });
}
