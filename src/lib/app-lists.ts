import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppListKind =
  | "vendedor" | "dtf" | "silk" | "acabamento" | "frete" | "pagamento" | "nf"
  | "status_arte" | "corte_dtf" | "revelacao_silk" | "motivo_perda"
  | "refacao_problema_arte" | "refacao_problema_dtf" | "refacao_problema_silk" | "refacao_problema_acabamento"
  | "refacao_problema_input_vendedor"
  | "refacao_area_identifica" | "refacao_area_erro"
  | "map_fio_fornecedor" | "map_malharia" | "map_tinturaria" | "map_acabamento"
  | "map_motivo_devolucao"
  | "destino_perda"
  | "cop_cortador"
  | "sup_unidade"
  | `refacao_problema_area:${string}`;

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

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Atualiza a coluna `ordem` para refletir a nova sequência.
      const updates = orderedIds.map((id, idx) =>
        (supabase as any).from("app_lists").update({ ordem: (idx + 1) * 10 }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const firstError = results.find((r: any) => r.error)?.error;
      if (firstError) throw firstError;
    },
    onSuccess: invalidate,
  });

  return { add, rename, remove, reorder };
}


/** Listas de problemas antigas, ligadas pelo id da área (não pelo nome — renomear não quebra). */
const PROBLEMA_LEGADO_POR_AREA_ID: Record<string, AppListKind> = {
  "12bb14ee-a3e2-490b-9012-4474810b1357": "refacao_problema_arte",
  "986ceb34-bfff-4409-9f02-d568bd8a22a7": "refacao_problema_dtf",
  "55940e0f-0480-41fc-bae9-95cc8801d8ae": "refacao_problema_silk",
  "9eeb454b-3d48-4e4f-b843-a2663d659210": "refacao_problema_acabamento",
  "c6d9798d-bc82-4dd1-8bc0-4d05ff2747a1": "refacao_problema_input_vendedor",
};

/** Lista de problemas de uma "Área que errou a produção". Cada área nova ganha a sua. */
export function kindProblemaDaArea(areaId: string): AppListKind {
  return PROBLEMA_LEGADO_POR_AREA_ID[areaId] ?? `refacao_problema_area:${areaId}`;
}

/** Resolve pelo nome escolhido; se a área não existe ou a lista dela está vazia, usa os motivos de perda. */
export function useKindProblemaPorArea(areaNome: string): AppListKind {
  const { items: areas } = useAppList("refacao_area_erro");
  const area = areas.find((a) => a.nome === areaNome);
  const kind: AppListKind = area ? kindProblemaDaArea(area.id) : "motivo_perda";
  const { items, isLoading } = useAppList(kind);
  if (kind !== "motivo_perda" && !isLoading && items.length === 0) return "motivo_perda";
  return kind;
}
