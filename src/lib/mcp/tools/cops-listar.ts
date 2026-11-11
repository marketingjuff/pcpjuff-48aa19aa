import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { COP_STATUS_LIST, rotuloCop, type CopPeca } from "@/lib/cop";
import { criarClienteDoUsuario, linkSistema, responder } from "../supabase";
import { abasDe, carregarPermissoes, exigir } from "../permissoes";

const soma = (v: unknown) => (Array.isArray(v) ? (v as CopPeca[]).reduce((s, x) => s + Number((x as any)?.qtd ?? 0), 0) : 0);

export default defineTool({
  name: "cops_listar",
  title: "Listar COPs",
  description:
    "Lista ordens de corte (COPs) com filtros por status, oficina, modelo, cor e período. Use para perguntas como quais COPs estão na oficina X ou o que tem urgência.",
  inputSchema: {
    status: z.enum(COP_STATUS_LIST as [string, ...string[]]).optional().describe("Status do COP."),
    oficina: z.string().optional().describe("Nome (ou parte) da oficina."),
    modelo: z.string().optional().describe("Modelo que aparece nas peças do COP."),
    cor: z.string().optional().describe("Cor que aparece nas peças do COP."),
    com_urgencia: z.boolean().optional().describe("Só COPs com urgência marcada."),
    pagamento_pendente: z.boolean().optional().describe("Só COPs com pagamento ainda não pago (precisa permissão de pagamento)."),
    de: z.string().optional().describe("Criado a partir de (AAAA-MM-DD)."),
    ate: z.string().optional().describe("Criado até (AAAA-MM-DD)."),
    busca: z.string().optional().describe("Número do COP (ex.: 0152)."),
    limite: z.number().int().min(1).max(200).optional().describe("Máximo de COPs (padrão 50, máximo 200)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    const sb = criarClienteDoUsuario(ctx);
    const perm = await carregarPermissoes(sb, ctx);
    exigir(perm, abasDe("cop"), "COPs");
    const pagto = perm.pode("cop.pagamento");
    const omitidos: string[] = [];
    if (!pagto) omitidos.push("dados de pagamento dos COPs");
    if (a.pagamento_pendente && !pagto) omitidos.push("filtro pagamento_pendente (ignorado)");
    let q = sb.from("cops").select("*, oficinas(nome)").order("numero", { ascending: false }).limit(1000);
    if (a.status) q = q.eq("status", a.status);
    if (a.de) q = q.gte("created_at", a.de);
    if (a.ate) q = q.lte("created_at", a.ate + "T23:59:59");
    if (a.busca && /^\d+/.test(a.busca)) q = q.eq("numero", parseInt(a.busca, 10));
    if (a.pagamento_pendente && pagto) q = q.neq("pagamento_status", "pago");
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const out = [];
    for (const c of (data ?? []) as any[]) {
      const pecas = Array.isArray(c.pecas) ? c.pecas : [];
      if (a.modelo && !pecas.some((p: any) => String(p.modelo ?? "").toLowerCase().includes(a.modelo!.toLowerCase()))) continue;
      if (a.cor && !pecas.some((p: any) => String(p.cor ?? "").toLowerCase().includes(a.cor!.toLowerCase()))) continue;
      if (a.oficina && !String(c.oficinas?.nome ?? "").toLowerCase().includes(a.oficina.toLowerCase())) continue;
      const urg = Array.isArray(c.urgencias) && c.urgencias.length > 0;
      if (a.com_urgencia && !urg) continue;
      const linha: Record<string, unknown> = {
        id: c.id, rotulo: rotuloCop(c.numero, c.letra, !!c.refacao_perda_origem_id), status: c.status,
        oficina: c.oficinas?.nome ?? null, total_pecas: soma(c.pecas), total_recebidas: soma(c.pecas_recebidas),
        com_urgencia: urg, solicitacao_corte: c.solicitacao_corte, execucao_corte: c.execucao_corte,
        romaneio_enviado_em: c.romaneio_enviado_em, data_recebimento: c.data_recebimento,
        link: linkSistema("cop", c.id, "dashboard"),
      };
      if (pagto) Object.assign(linha, { pagamento_status: c.pagamento_status, pagamento_valor_calculado: c.pagamento_valor_calculado, pagamento_liberado_em: c.pagamento_liberado_em, pagamento_pago_em: c.pagamento_pago_em, observacoes_pagamento: c.observacoes_pagamento });
      out.push(linha);
      if (out.length >= (a.limite ?? 50)) break;
    }
    return responder({ total: out.length, cops: out }, omitidos);
  },
});
