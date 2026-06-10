import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/integrations/supabase/types";

export function useCurrentUser() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);
  return userId;
}

export function useMyRoles() {
  const userId = useCurrentUser();
  return useQuery({
    queryKey: ["my-roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, areas_extras")
        .eq("user_id", userId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useIsAdmin() {
  const { data } = useMyRoles();
  return (data ?? []).some((r) => r.role === "admin");
}

export function useHasRole(role: AppRole) {
  const { data } = useMyRoles();
  return (data ?? []).some((r) => r.role === role);
}
