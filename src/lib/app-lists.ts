import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppListKind =
  | "vendedor" | "dtf" | "silk" | "acabamento" | "frete" | "pagamento" | "nf"
  | "status_arte" | "corte_dtf" | "revelacao_silk" | "motivo_perda"
  | "refacao_problema_arte" | "refacao_problema_dtf" | "refacao_problema_silk" | "refacao_problema_acabamento"
  | "refacao_problema_input_vendedor"
  | "refacao_area_identifica" | "refacao_area_erro" | "refacao_area_erro_externa"
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

/** Resolve pelo nome escolhido (áreas da Juff primeiro, depois de fora). Área encontrada usa sempre a própria lista, mesmo vazia. */
export function useKindProblemaPorArea(areaNome: string): AppListKind {
  const { items: areasInt } = useAppList("refacao_area_erro");
  const { items: areasExt } = useAppList("refacao_area_erro_externa");
  const area = areasInt.find((a) => a.nome === areaNome) ?? areasExt.find((a) => a.nome === areaNome);
  const kind: AppListKind = area ? kindProblemaDaArea(area.id) : "motivo_perda";
  return kind;
}

/** Área cujo nome contém "oficina" (sem acento e sem maiúscula). */
export function areaExigeOficina(nome: string): boolean {
  const n = normalizarTexto(nome);
  return n.includes("costura") || n.includes("oficina");
}

function normalizarTexto(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Problemas de peça desfiada no berço pedem o berço; o tipo vem da área. */
export function tipoBercoDoProblema(areaNome: string, problema: string): "dtf" | "silk" | null {
  const p = normalizarTexto(problema);
  if (!(p.includes("desfiad") && p.includes("berco"))) return null;
  const a = normalizarTexto(areaNome);
  if (a.includes("dtf")) return "dtf";
  if (a.includes("silk")) return "silk";
  return null;
}

export type GrupoOpcoesErro = { interna: boolean; area: string; problemas: string[] };

/** Todas as áreas (Juff e de fora) com seus problemas, numa consulta só. */
export function useOpcoesErro(): { grupos: GrupoOpcoesErro[]; isLoading: boolean } {
  const { items: areasInt, isLoading: l1 } = useAppList("refacao_area_erro");
  const { items: areasExt, isLoading: l2 } = useAppList("refacao_area_erro_externa");
  const areas = [...areasInt.map((a) => ({ a, interna: true })), ...areasExt.map((a) => ({ a, interna: false }))];
  const kinds = areas.map(({ a }) => kindProblemaDaArea(a.id));
  const { data: itens = [], isLoading: l4 } = useQuery({
    queryKey: ["app-lists-multi", kinds],
    enabled: kinds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("app_lists").select("id, kind, nome, ordem").in("kind", kinds)
        .order("ordem", { ascending: true }).order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AppListItem[];
    },
  });
  const grupos = areas.map(({ a, interna }, i) => {
    const probs = itens.filter((it) => it.kind === kinds[i]).map((it) => it.nome);
    return { interna, area: a.nome, problemas: probs };
  });
  return { grupos, isLoading: l1 || l2 || l4 };
}
