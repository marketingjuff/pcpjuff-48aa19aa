import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, UserRoleRow } from "@/integrations/supabase/schema-extras";

export function useCurrentUser() {
  const [state, setState] = useState<{ userId: string | null; isLoading: boolean }>({
    userId: null,
    isLoading: true,
  });
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setState({ userId: data.user?.id ?? null, isLoading: false });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setState({ userId: s?.user?.id ?? null, isLoading: false });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return state;
}

export function useMyRoles() {
  const { userId, isLoading: isUserLoading } = useCurrentUser();
  const query = useQuery({
    queryKey: ["my-roles", userId],
    enabled: !isUserLoading && !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_roles")
        .select("role, areas_extras")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as Pick<UserRoleRow, "role" | "areas_extras">[];
    },
  });
  return {
    ...query,
    isLoading: isUserLoading || (!!userId && query.isLoading),
    isPending: isUserLoading || (!!userId && query.isPending),
  };
}

export function useIsAdmin() {
  const { data } = useMyRoles();
  return (data ?? []).some((r) => r.role === "admin");
}

export function useHasRole(role: AppRole) {
  const { data } = useMyRoles();
  return (data ?? []).some((r) => r.role === role);
}

export function useHasArea(area: string) {
  const { data } = useMyRoles();
  return (data ?? []).some(
    (r) => r.role === "admin" || (r.areas_extras ?? []).includes(area),
  );
}

/** Todas as permissões efetivas do usuário, já normalizadas. Admin recebe o catálogo inteiro. */
export function useMinhasPermissoes(): Set<PermissaoKey> {
  const { data } = useMyRoles();
  const rows = data ?? [];
  if (rows.some((r) => r.role === "admin")) return new Set(todasPermissoes());
  const out = new Set<PermissaoKey>();
  for (const r of rows) {
    normalizarPermissoes(r.areas_extras ?? [], r.role).forEach((k) => out.add(k));
  }
  return out;
}

/** Checa uma permissão específica. Admin sempre true. */
export function usePode(key: PermissaoKey): boolean {
  return useMinhasPermissoes().has(key);
}

/** Abas do módulo que este usuário pode ver, na ordem do catálogo. */
export function useAbasPermitidas(modulo: ModuloKey): AbaPermissao[] {
  const perms = useMinhasPermissoes();
  return abasDoModulo(modulo).filter((a) => perms.has(a.key));
}

/** Módulos com pelo menos 1 aba permitida. */
export function useModulosPermitidos(): ModuloKey[] {
  const perms = useMinhasPermissoes();
  return MODULOS.map((m) => m.key).filter((m) =>
    permissoesDoModulo(m).some((k) => perms.has(k)),
  );
}

function useTemModulo(modulo: ModuloKey): boolean {
  const perms = useMinhasPermissoes();
  return permissoesDoModulo(modulo).some((k) => perms.has(k));
}

export function useCanAccessCop() {
  return useTemModulo("cop");
}

export function useCanAccessMap() {
  return useTemModulo("map");
}

export function useCanAccessSup() {
  return useTemModulo("sup");
}

export function useCanAccessKpi() {
  return useTemModulo("kpi");
}

