import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { REFACAO_TAMANHOS } from "@/lib/pedidos";
import { rotuloCop } from "@/lib/cop";
import { criarClienteDoUsuario, linkSistema, responder } from "../supabase";
import { abasDe, carregarPermissoes, exigir } from "../permissoes";

const ordemTam = (t: string) => { const i = (REFACAO_TAMANHOS as readonly string[]).indexOf(t); return i < 0 ? 99 : i; };

function grade(pecas: unknown) {
  const arr = Array.isArray(pecas) ? (pecas as any[]) : [];
  return arr
    .map((p) => ({ modelo: p.modelo ?? null, cor: p.cor ?? null, tamanho: p.tamanho ?? null, qtd: Number(p.qtd ?? 0) }))
    .sort((a, b) => String(a.modelo).localeCompare(String(b.modelo)) || String(a.cor).localeCompare(String(b.cor)) || ordemTam(a.tamanho) - ordemTam(b.tamanho));
}

export default defineTool({
  name: "cop_detalhe",
  title: "Detalhe de um COP",
  description:
    "Mostra um COP completo: grade por modelo, cor e tamanho, datas de corte, quem cortou, romaneio, recebimentos, urgências e oficina. Use para perguntas como o que falta receber do COP 0152A.",
  inputSchema: {
    id: z.string().uuid().optional().describe("Identificador interno do COP."),
    numero: z.string().optional().describe("Número do COP, com ou sem letra (ex.: 0152 ou 0152A)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    const sb = criarClienteDoUsuario(ctx);
    const perm = await carregarPermissoes(sb, ctx);
    exigir(perm, abasDe("cop"), "COPs");
    if (!a.id && !a.numero) throw new ToolError("Informe o id ou o número do COP.");
    let q = sb.from("cops").select("*, oficinas(nome, telefone)");
    if (a.id) q = q.eq("id", a.id);
    else {
      const m = a.numero!.trim().match(/^(\d+)\s*([A-Za-z]*)$/);
      if (!m) throw new ToolError("Número de COP inválido. Use algo como 0152 ou 0152A.");
      q = q.eq("numero", parseInt(m[1], 10));
      if (m[2]) q = q.ilike("letra", m[2]);
    }
    const { data, error } = await q.limit(30);
    if (error) throw new ToolError("Erro ao ler o COP: " + error.message);
    const lista = (data ?? []) as any[];
    if (!lista.length) throw new ToolError("COP não encontrado.");
    if (lista.length > 1) {
      return responder({
        mensagem: "Encontrei mais de um COP. Peça para escolher um e chame de novo com o id.",
        opcoes: lista.map((c) => ({ id: c.id, rotulo: rotuloCop(c.numero, c.letra, !!c.refacao_perda_origem_id), status: c.status, link: linkSistema("cop", c.id, "dashboard") })),
      });
    }
    const c = lista[0];
    const omitidos: string[] = [];
    const { data: rel } = await sb.from("cops").select("id, numero, letra, status, refacao_perda_origem_id").or(`cop_pai_id.eq.${c.id},cop_romaneio_pai_id.eq.${c.id}`);
    const out: Record<string, unknown> = {
      id: c.id, rotulo: rotuloCop(c.numero, c.letra, !!c.refacao_perda_origem_id), status: c.status,
      grade_pecas: grade(c.pecas), grade_recebidas: grade(c.pecas_recebidas),
      solicitacao_risco: c.solicitacao_risco, execucao_risco: c.execucao_risco, solicitacao_corte: c.solicitacao_corte, execucao_corte: c.execucao_corte,
      observacoes_corte: c.observacoes_corte, quem_cortou: c.quem_cortou, corte_dividido: c.corte_dividido,
      oficina: c.oficinas ? { nome: c.oficinas.nome, telefone: c.oficinas.telefone } : null,
      data_saida_oficina: c.data_saida_oficina, romaneio_enviado_em: c.romaneio_enviado_em, observacoes_romaneio: c.observacoes_romaneio, num_fretes: c.num_fretes,
      data_recebimento: c.data_recebimento, historico_recebimentos: c.historico_recebimentos, urgencias: c.urgencias,
      conferido_em: c.conferido_em, conferencia: c.conferencia,
      cop_pai_id: c.cop_pai_id, cop_romaneio_pai_id: c.cop_romaneio_pai_id,
      cops_filhos: (rel ?? []).map((f: any) => ({ id: f.id, rotulo: rotuloCop(f.numero, f.letra, !!f.refacao_perda_origem_id), status: f.status, link: linkSistema("cop", f.id, "dashboard") })),
      link: linkSistema("cop", c.id, "dashboard"),
    };
    if (perm.pode("cop.pagamento")) {
      Object.assign(out, { pagamento_status: c.pagamento_status, pagamento_valor_calculado: c.pagamento_valor_calculado, pagamento_liberado_em: c.pagamento_liberado_em, pagamento_pago_em: c.pagamento_pago_em, observacoes_pagamento: c.observacoes_pagamento });
      if (c.pagamento_consolidado_id) {
        const { data: pc } = await sb.from("pagamentos_consolidados").select("id, valor_total, pago_em, observacao, detalhes").eq("id", c.pagamento_consolidado_id);
        out.pagamentos_consolidados = pc ?? [];
      }
    } else omitidos.push("dados de pagamento");
    if (perm.podeAlguma(["cop.perdas", "cop.controle_perdas"])) {
      const { data: cp } = await sb.from("cop_perdas").select("modelo, cor, tamanho, qtd, motivo, etiqueta, created_at").eq("cop_id", c.id);
      Object.assign(out, { perdas: c.perdas, historico_perdas: c.historico_perdas, cop_perdas: cp ?? [] });
    } else omitidos.push("perdas do COP");
    return responder(out, omitidos);
  },
});
