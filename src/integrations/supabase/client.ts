import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL =
  (typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined) ||
  import.meta.env.VITE_SUPABASE_URL ||
  "https://lmhbegsfwbvxjxmlkrid.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  (typeof process !== "undefined" ? process.env.SUPABASE_PUBLISHABLE_KEY : undefined) ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
