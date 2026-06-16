import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppListKind = "vendedor" | "dtf" | "silk" | "acabamento" | "frete" | "pagamento" | "nf" | "status_arte";

export interface AppListItem {
  id: string;
  kind: AppListKind;
  nome: string;
  ordem: number;
}

async function fetchList(kind: AppListKind): Promise<AppListItem[]> {
  const { data, error } = await (supabase as any)
    .from("app_lists")
    .select("id, kind, nome, ordem")
    .eq("kind", kind)
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AppListItem[];
}

export function useAppList(kind: AppListKind) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["app-lists", kind],
    queryFn: () => fetchList(kind),
    staleTime: 60_000,
  });
  return { items: data, names: data.map((i) => i.nome), isLoading };
}

export function useAppListMutations(kind: AppListKind) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["app-lists", kind] });

  const add = useMutation({
    mutationFn: async (nome: string) => {
      const trimmed = nome.trim();
      if (!trimmed) throw new Error("Informe um nome.");
      const { error } = await (supabase as any)
        .from("app_lists")
        .insert({ kind, nome: trimmed, ordem: 50 });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: async (v: { id: string; nome: string }) => {
      const trimmed = v.nome.trim();
      if (!trimmed) throw new Error("Informe um nome.");
      const { error } = await (supabase as any)
        .from("app_lists")
        .update({ nome: trimmed })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("app_lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, rename, remove };
}
