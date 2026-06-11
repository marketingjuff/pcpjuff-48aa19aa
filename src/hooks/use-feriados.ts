import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Feriado } from "@/integrations/supabase/schema-extras";

export function useFeriados() {
  const q = useQuery({
    queryKey: ["feriados"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("feriados").select("data");
      if (error) throw error;
      return (data ?? []) as Pick<Feriado, "data">[];
    },
    staleTime: 5 * 60 * 1000,
  });
  const set = useMemo(() => new Set((q.data ?? []).map((f) => f.data)), [q.data]);
  return { feriados: set, isLoading: q.isLoading };
}
