// Serves PDFs from the private `layouts` bucket so the browser never sees Supabase URLs.
// Auth is enforced via verify_jwt (default true) AND a team-membership check.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const url = new URL(req.url);
    let path = url.searchParams.get("path");
    if (!path && (req.method === "POST")) {
      const body = await req.json().catch(() => ({}));
      path = body?.path ?? null;
    }
    if (!path) return new Response(JSON.stringify({ error: "Missing path" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });

    // Verify caller is a team member using their JWT (RLS-aware client).
    const userSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: isMember, error: roleErr } = await userSupabase.rpc("is_team_member");
    if (roleErr || !isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.storage.from("layouts").download(path);
    if (error || !data) {
      return new Response(JSON.stringify({ error: error?.message ?? "Not found" }), { status: 404, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="layout.pdf"`,
        "cache-control": "private, max-age=300",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
