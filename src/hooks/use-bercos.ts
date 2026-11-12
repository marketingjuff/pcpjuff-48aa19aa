import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Bercos = { dtf: string[]; silk: string[]; qtd: { dtf: number; silk: number } };

function lista(prefixo: string, n: number): string[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => `${prefixo}${i + 1}`);
}

export function useBercos(): Bercos & { isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["pcp_bercos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pcp_capacidade_etapa")
        .select("etapa, qtd_bercos")
        .in("etapa", ["dtf", "silk"]);
      if (error) throw error;
      const qtd = { dtf: 0, silk: 0 };
      for (const r of data ?? []) {
        if (r.etapa === "dtf" || r.etapa === "silk") qtd[r.etapa] = Number(r.qtd_bercos ?? 0) || 0;
      }
      return qtd;
    },
  });
  const qtd = data ?? { dtf: 0, silk: 0 };
  return { dtf: lista("D", qtd.dtf), silk: lista("S", qtd.silk), qtd, isLoading };
}

export function useSalvarBercos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (qtd: { dtf: number | null; silk: number | null }) => {
      const { error } = await supabase
        .from("pcp_capacidade_etapa")
        .upsert(
          [
            { etapa: "dtf", qtd_bercos: qtd.dtf },
            { etapa: "silk", qtd_bercos: qtd.silk },
          ] as any,
          { onConflict: "etapa" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pcp_bercos"] }),
  });
}
