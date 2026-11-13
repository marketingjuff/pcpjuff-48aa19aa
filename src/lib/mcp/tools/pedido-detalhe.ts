import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { totalProducao, type Pedido } from "@/lib/pedidos";
import { criarClienteDoUsuario, linkSistema, responder } from "../supabase";
import { abasDe, carregarPermissoes, etapaDoPedido, exigir, pedidoVisivel, tabDoPedido } from "../permissoes";

export default defineTool({
  name: "pedido_detalhe",
  title: "Detalhe de um pedido",
  description:
    "Mostra tudo de um pedido do PCP: etapa, datas, peças, refações e correções. Use para perguntas como em que pé está o pedido 3996.",
  inputSchema: {
    id: z.string().uuid().optional().describe("Identificador interno do pedido."),
    numero: z.string().optional().describe("Número do pedido Olist (ex.: 3996 ou 3996A) ou do orçamento."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    const sb = criarClienteDoUsuario(ctx);
    const perm = await carregarPermissoes(sb, ctx);
    exigir(perm, abasDe("pcp"), "pedidos do PCP");
    if (!a.id && !a.numero) throw new ToolError("Informe o id ou o número do pedido.");
    let lista: Pedido[] = [];
    if (a.id) {
      const { data, error } = await sb.from("pedidos").select("*").eq("id", a.id);
      if (error) throw new ToolError("Erro ao ler o pedido: " + error.message);
      lista = (data ?? []) as unknown as Pedido[];
    } else {
      const n = a.numero!.trim().replace(/[,()%]/g, "");
      for (const busca of [
        () => sb.from("pedidos").select("*").eq("pedido_olist", n),
        () => sb.from("pedidos").select("*").ilike("pedido_olist", `${n}%`).limit(20),
        () => sb.from("pedidos").select("*").eq("orcamento", n),
      ]) {
        const { data, error } = await busca();
        if (error) throw new ToolError("Erro ao ler o pedido: " + error.message);
        if (data?.length) { lista = data as unknown as Pedido[]; break; }
      }
    }
    if (!lista.length) throw new ToolError("Pedido não encontrado.");
    const visiveis = lista.filter((p) => pedidoVisivel(perm, p));
    if (!visiveis.length) throw new ToolError("Este pedido está numa etapa que você não tem liberada.");
    if (visiveis.length > 1) {
      return responder({
        mensagem: "Encontrei mais de um pedido. Peça para a pessoa escolher um e chame de novo com o id.",
        opcoes: visiveis.map((p) => ({ id: p.id, pedido_olist: p.pedido_olist, orcamento: p.orcamento, etapa: etapaDoPedido(p).etapa, link: linkSistema("pedido", p.id, tabDoPedido(p)) })),
      });
    }
    const p = visiveis[0];
    const { canhoto_fotos, layout_url, ...resto } = p as unknown as Record<string, unknown>;
    const { etapa, percentual } = etapaDoPedido(p);
    return responder({
      ...resto,
      tem_foto_canhoto: Array.isArray(canhoto_fotos) && canhoto_fotos.length > 0,
      tem_layout: !!layout_url,
      etapa, percentual,
      refacoes: resto.refacoes,
      observacao_refacoes: "Em cada refação, perda_pecas (peças perdidas) e qtd_falta_adesivos (adesivos faltando) são coisas diferentes; nunca some. Uma refação pode ter `blocos` (vários motivos), cada um com área, problema e peças perdidas próprios; nesse caso os campos de topo são a soma dos blocos (peças) ou o primeiro bloco (área e problema).",
      correcoes_etapa: resto.correcoes_etapa,
      totalProducao: totalProducao(p),
      link: linkSistema("pedido", p.id, tabDoPedido(p)),
    });
  },
});
