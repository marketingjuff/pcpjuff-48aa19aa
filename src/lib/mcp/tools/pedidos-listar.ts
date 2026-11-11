import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { isAtrasadoSetor, type Pedido, type SetorAtraso } from "@/lib/pedidos";
import { criarClienteDoUsuario, linkSistema, lerTudo, responder } from "../supabase";
import { abasDe, carregarPermissoes, chaveDaEtapa, etapaDoPedido, exigir, pedidoVisivel, tabDoPedido } from "../permissoes";

const SETORES: SetorAtraso[] = ["arte", "dtf", "silk", "acabamento", "expedicao"];

export default defineTool({
  name: "pedidos_listar",
  title: "Listar pedidos do PCP",
  description:
    "Lista pedidos de produção do PCP com filtros. Use para perguntas como quais pedidos estão atrasados no Silk ou o que a Mirela tem em produção.",
  inputSchema: {
    etapa: z.enum(["dados_in", "arte", "dtf", "silk", "acabamento", "expedicao", "finalizado"]).optional().describe("Etapa atual do pedido."),
    vendedor: z.string().optional().describe("Nome (ou parte) do vendedor."),
    tipo_estampa: z.enum(["DTF", "Silk", "DTF+Silk", "Lisa"]).optional().describe("Tipo de estampa."),
    atrasados: z.boolean().optional().describe("Só pedidos atrasados em algum setor."),
    com_refacao: z.boolean().optional().describe("Só pedidos com refação."),
    captacao_video: z.boolean().optional().describe("Só pedidos que precisam de captação de vídeo."),
    entrada_de: z.string().optional().describe("Entrada a partir de (AAAA-MM-DD)."),
    entrada_ate: z.string().optional().describe("Entrada até (AAAA-MM-DD)."),
    entrega_de: z.string().optional().describe("Entrega a partir de (AAAA-MM-DD)."),
    entrega_ate: z.string().optional().describe("Entrega até (AAAA-MM-DD)."),
    incluir_finalizados: z.boolean().optional().describe("Incluir pedidos finalizados (padrão não)."),
    busca: z.string().optional().describe("Parte do número do pedido Olist ou do orçamento."),
    limite: z.number().int().min(1).max(200).optional().describe("Máximo de pedidos (padrão 50, máximo 200)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    const sb = criarClienteDoUsuario(ctx);
    const perm = await carregarPermissoes(sb, ctx);
    exigir(perm, abasDe("pcp"), "pedidos do PCP");
    const limite = a.limite ?? 50;
    const rows = await lerTudo<Pedido>((f, t) => {
      let q = sb.from("pedidos").select("*");
      if (!a.incluir_finalizados && a.etapa !== "finalizado") q = q.is("finalizado_em", null);
      if (a.vendedor) q = q.ilike("vendedor", `%${a.vendedor}%`);
      if (a.entrada_de) q = q.gte("entrada_pedido", a.entrada_de);
      if (a.entrada_ate) q = q.lte("entrada_pedido", a.entrada_ate);
      if (a.entrega_de) q = q.gte("data_entrega", a.entrega_de);
      if (a.entrega_ate) q = q.lte("data_entrega", a.entrega_ate);
      if (a.captacao_video) q = q.eq("necessita_captacao_video", true);
      if (a.busca) {
        const b = a.busca.replace(/[,()%]/g, "");
        q = q.or(`pedido_olist.ilike.%${b}%,orcamento.ilike.%${b}%`);
      }
      return q.order("data_entrega", { ascending: true, nullsFirst: false }).range(f, t);
    });
    const tipoOk = (p: Pedido) => {
      if (!a.tipo_estampa) return true;
      const t = String(p.tipo_estampa ?? "").replace(/\s+/g, "").toLowerCase();
      return t === a.tipo_estampa.replace(/\s+/g, "").toLowerCase();
    };
    const out = [];
    let ocultos = 0;
    for (const p of rows) {
      if (!tipoOk(p)) continue;
      const { etapa, percentual } = etapaDoPedido(p);
      if (a.etapa && chaveDaEtapa(etapa) !== a.etapa) continue;
      const refacoes = Array.isArray((p as any).refacoes) ? ((p as any).refacoes as unknown[]) : [];
      if (a.com_refacao && refacoes.length === 0) continue;
      const atrasado_em = SETORES.filter((s) => isAtrasadoSetor(p, s));
      if (a.atrasados && atrasado_em.length === 0) continue;
      if (!pedidoVisivel(perm, p)) { ocultos++; continue; }
      out.push({
        id: p.id, pedido_olist: p.pedido_olist, orcamento: p.orcamento, vendedor: p.vendedor, etapa, percentual,
        tipo_estampa: p.tipo_estampa, qtd: p.qtd, pecas_solicitadas: (p as any).pecas_solicitadas,
        entrada_pedido: p.entrada_pedido, data_entrega: p.data_entrega, saida_juff: p.saida_juff,
        atrasado_em, refacoes_qtd: refacoes.length, link: linkSistema("pedido", p.id, tabDoPedido(p)),
      });
      if (out.length >= limite) break;
    }
    if (!out.length && ocultos > 0) throw new ToolError("Os pedidos encontrados estão em etapas que você não tem liberadas.");
    return responder({ total: out.length, pedidos: out }, ocultos ? [`${ocultos} pedido(s) em etapas que você não tem liberadas`] : undefined);
  },
});
