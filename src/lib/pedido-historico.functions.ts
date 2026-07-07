import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PedidoAuditEntry {
  id: string;
  pedido_id: string;
  orcamento: string | null;
  pedido_olist: string | null;
  acao: "insert" | "update" | "delete";
  mudancas: Array<{ campo: string; de: unknown; para: unknown }> | null;
  linha_completa: Record<string, unknown> | null;
  feito_por: string | null;
  feito_por_email: string | null;
  feito_por_nome: string | null;
  feito_em: string;
}

export const getPedidoHistorico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      pedidoId: z.string().uuid().optional(),
      pedidoOlist: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const conds: string[] = [];
    if (data.pedidoId) conds.push(`pedido_id.eq.${data.pedidoId}`);
    if (data.pedidoOlist) conds.push(`pedido_olist.eq.${data.pedidoOlist}`);
    if (conds.length === 0) return { entries: [] as PedidoAuditEntry[] };

    let query = supabase
      .from("pedido_audit_log")
      .select("*")
      .order("feito_em", { ascending: false })
      .limit(500);

    query = query.or(conds.join(","));

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { entries: (rows ?? []) as PedidoAuditEntry[] };
  });
