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
