import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export interface AuditLogEntry {
  id: string;
  tabela: string;
  registro_id: string;
  identificador: string | null;
  acao: "insert" | "update" | "delete";
  mudancas: Array<{ campo: string; de: Json; para: Json }> | null;
  linha_completa: { [k: string]: Json } | null;
  feito_por: string | null;
  feito_por_email: string | null;
  feito_por_nome: string | null;
  feito_em: string;
}

export interface AuditLogResult {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 200;

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin required");
}

export const getAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      area: z.enum(["pcp", "map", "cop"]),
      busca: z.string().optional(),
      usuarioId: z.string().uuid().optional(),
      acao: z.enum(["insert", "update", "delete"]).optional(),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
      page: z.number().int().min(1).default(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await assertAdmin(supabase, context.userId);

    const tabela =
      data.area === "pcp"
        ? "pedido_audit_log"
        : data.area === "map"
        ? "map_audit_log"
        : "cop_audit_log";

    let query = supabase
      .from(tabela)
      .select("*", { count: "exact" })
      .order("feito_em", { ascending: false });

    if (data.usuarioId) query = query.eq("feito_por", data.usuarioId);
    if (data.acao) query = query.eq("acao", data.acao);
    if (data.dataInicio) query = query.gte("feito_em", data.dataInicio);
    if (data.dataFim) query = query.lte("feito_em", data.dataFim);

    if (data.busca && data.busca.trim()) {
      const b = data.busca.trim().replace(/,/g, " ");
      const like = `%${b}%`;
      if (data.area === "pcp") {
        query = query.or(
          `orcamento.ilike.${like},pedido_olist.ilike.${like}`,
        );
      } else {
        query = query.ilike("identificador", like);
      }
    }

    const from = (data.page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);

    return {
      entries: (rows ?? []) as AuditLogEntry[],
      total: count ?? 0,
      page: data.page,
      pageSize: PAGE_SIZE,
    } as AuditLogResult;
  });

export const listAuditUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    await assertAdmin(supabase, context.userId);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, email")
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; nome: string | null; email: string | null }>;
  });
