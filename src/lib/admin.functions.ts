import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "@/integrations/supabase/schema-extras";

const APP_ROLES = ["admin", "gestor", "operador"] as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin required");
}

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        nome: z.string().optional(),
        role: z.enum(APP_ROLES),
        areas_extras: z.array(z.string()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome ?? "" },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    await admin.from("profiles").upsert({ id: uid, email: data.email, nome: data.nome ?? null });
    const { error: rErr } = await admin.from("user_roles").upsert(
      {
        user_id: uid,
        role: data.role as AppRole,
        areas_extras: data.areas_extras ?? null,
      },
      { onConflict: "user_id,role" },
    );
    if (rErr) throw new Error(rErr.message);
    return { ok: true, userId: uid };
  });

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("id, email, nome, created_at")
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);
    const { data: roles, error: rErr } = await admin
      .from("user_roles")
      .select("user_id, role, areas_extras");
    if (rErr) throw new Error(rErr.message);
    return ((profiles ?? []) as any[]).map((p) => ({
      ...p,
      roles: ((roles ?? []) as any[]).filter((r) => r.user_id === p.id),
    }));
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(APP_ROLES),
        areas_extras: z.array(z.string()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    await admin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await admin.from("user_roles").insert({
      user_id: data.userId,
      role: data.role as AppRole,
      areas_extras: data.areas_extras ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateUserName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), nome: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { error } = await admin.from("profiles").update({ nome: data.nome }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await admin.auth.admin.updateUserById(data.userId, { user_metadata: { nome: data.nome } });
    return { ok: true };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("Não é possível excluir a própria conta.");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      userId: z.string().uuid(),
      password: z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(72),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { error } = await admin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

