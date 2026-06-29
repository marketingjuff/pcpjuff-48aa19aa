import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TABLES = [
  "profiles",
  "user_roles",
  "app_color_settings",
  "app_lists",
  "feriados",
  "oficinas",
  "pedidos",
  "cops",
  "cop_perdas",
] as const;
type TableName = (typeof TABLES)[number];

async function assertAdminOrGestor(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "gestor"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden: admin or gestor required");
}

export const exportBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrGestor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const result: Record<string, any[]> = {};
    for (const t of TABLES) {
      const { data, error } = await admin.from(t).select("*");
      if (error) throw new Error(`Erro ao exportar ${t}: ${error.message}`);
      result[t] = data ?? [];
    }
    return {
      version: 1,
      exported_at: new Date().toISOString(),
      tables: result,
    };
  });

export const importBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        replace: z.boolean(),
        payload: z.object({
          version: z.number().optional(),
          tables: z.record(z.string(), z.array(z.record(z.string(), z.any()))),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const summary: Record<string, { inserted: number; deleted: number }> = {};

    // Ordem de inserção respeita dependências (profiles antes de user_roles).
    const insertOrder: TableName[] = [
      "profiles",
      "user_roles",
      "app_color_settings",
      "app_lists",
      "feriados",
      "oficinas",
      "pedidos",
      "cops",
      "cop_perdas",
    ];
    // Ordem de remoção é a inversa.
    const deleteOrder = [...insertOrder].reverse();

    if (data.replace) {
      for (const t of deleteOrder) {
        if (!(t in data.payload.tables)) continue;
        const { error, count } = await admin
          .from(t)
          .delete({ count: "exact" })
          .not("id", "is", null);
        if (error) throw new Error(`Erro ao limpar ${t}: ${error.message}`);
        summary[t] = { inserted: 0, deleted: count ?? 0 };
      }
    }

    for (const t of insertOrder) {
      const rows = data.payload.tables[t];
      const prevDeleted = summary[t]?.deleted ?? 0;
      if (!rows || rows.length === 0) {
        summary[t] = { inserted: 0, deleted: prevDeleted };
        continue;
      }
      const { error, count } = await admin
        .from(t)
        .upsert(rows, { onConflict: "id", count: "exact" });
      if (error) throw new Error(`Erro ao importar ${t}: ${error.message}`);
      summary[t] = { inserted: count ?? rows.length, deleted: prevDeleted };
    }

    return { ok: true, summary };
  });
