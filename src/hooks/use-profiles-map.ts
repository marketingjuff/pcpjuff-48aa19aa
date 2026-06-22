import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cache: Record<string, string> | null = null;
const listeners = new Set<(m: Record<string, string>) => void>();

async function load() {
  const { data } = await supabase.from("profiles").select("id, nome, email");
  const map: Record<string, string> = {};
  (data ?? []).forEach((p: any) => {
    map[p.id] = p.nome || p.email || p.id;
  });
  cache = map;
  listeners.forEach((l) => l(map));
}

export function useProfilesMap(): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>(cache ?? {});
  useEffect(() => {
    listeners.add(setMap);
    if (!cache) load();
    return () => {
      listeners.delete(setMap);
    };
  }, []);
  return map;
}

export function resolveNome(map: Record<string, string>, uuid: string | null | undefined): string {
  if (!uuid) return "—";
  return map[uuid] ?? uuid.slice(0, 8);
}
