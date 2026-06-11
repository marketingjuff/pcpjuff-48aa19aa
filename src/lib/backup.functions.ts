import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TABLES = ["pedidos", "feriados", "profiles", "user_roles"] as const;
type TableName = (typeof TABLES)[number];

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin required");
}

export const exportBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
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
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const summary: Record<string, { inserted: number; deleted: number }> = {};

    // Ordem de inserção respeita dependências (profiles antes de user_roles).
    const insertOrder: TableName[] = ["profiles", "user_roles", "feriados", "pedidos"];
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
