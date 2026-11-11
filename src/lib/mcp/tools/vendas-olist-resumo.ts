import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  aplicarFiltros, calcularPedidos, pedidosJuffStore, resumo,
  type EmpresaFiltro, type ItemDb, type PedidoCalc, type PedidoDb,
} from "@/lib/indicadores-olist";
import { basePedidoOlist } from "@/lib/pedido-olist-match";
import { criarClienteDoUsuario, linkSistema, lerTudo, responder } from "../supabase";
import { carregarPermissoes, exigir } from "../permissoes";

type ComLote = { numero_pedido: string; lote_id: string };
type LotesPorData = Record<string, string>;
/** Cópia idêntica de apenasVigentes (src/lib/olist-vendas.ts); aquele arquivo importa xlsx/jszip. */
function apenasVigentes<T extends ComLote>(registros: T[], lotes: LotesPorData): T[] {
  const melhorLote = new Map<string, string>();
  for (const r of registros) {
    const atual = melhorLote.get(r.numero_pedido);
    if (!atual || (lotes[r.lote_id] ?? "") > (lotes[atual] ?? "")) melhorLote.set(r.numero_pedido, r.lote_id);
  }
  return registros.filter((r) => melhorLote.get(r.numero_pedido) === r.lote_id);
}

export default defineTool({
  name: "vendas_olist_resumo",
  title: "Resumo de vendas Olist",
  description:
    "Resumo de vendas importadas da Olist por período, separando Juff Custom e Juff Store. Valores em R$ só aparecem para quem tem permissão de faturamento.",
  inputSchema: {
    de: z.string().describe("Início do período (AAAA-MM-DD)."),
    ate: z.string().describe("Fim do período (AAAA-MM-DD)."),
    frente: z.enum(["custom", "store", "ambas"]).optional().describe("Juff Custom, Juff Store ou ambas (padrão ambas)."),
    empresa: z.enum(["CONSOLIDADO", "JOKE", "JUFF"]).optional().describe("Empresa (padrão CONSOLIDADO)."),
    vendedor: z.string().optional().describe("Nome exato do vendedor como aparece no KPI."),
    por_mes: z.boolean().optional().describe("Abrir também mês a mês."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    const sb = criarClienteDoUsuario(ctx);
    const perm = await carregarPermissoes(sb, ctx);
    exigir(perm, ["kpi.custom", "kpi.store"], "vendas da Olist");
    const pedidas = a.frente === "custom" ? ["custom"] : a.frente === "store" ? ["store"] : ["custom", "store"];
    const omitidos: string[] = [];
    const frentes = pedidas.filter((f) => {
      const ok = perm.pode(`kpi.${f}`);
      if (!ok) omitidos.push(`frente Juff ${f === "custom" ? "Custom" : "Store"}`);
      return ok;
    }) as ("custom" | "store")[];
    if (!frentes.length) throw new ToolError("Sem acesso a essa frente de vendas no PCP Juff.");
    const fat = perm.pode("kpi.faturamento");
    if (!fat) omitidos.push("valores de faturamento em R$");

    const [lotesRes, pedidos, itens, mapRes, exclRes, pcp, escopoRes] = await Promise.all([
      sb.from("olist_import_lotes").select("id, importado_em, anulado_em"),
      lerTudo<PedidoDb>((f, t) => sb.from("olist_pedidos").select("numero_pedido, lote_id, empresa, data, nome_contato, cpf_cnpj, situacao, vendedor, desconto_valor, desconto_percentual, frete, despesas").range(f, t)),
      lerTudo<ItemDb>((f, t) => sb.from("olist_itens").select("numero_pedido, lote_id, produto_olist, descricao_original, cor, tamanho, qtd, valor_unitario, desconto_item, is_servico").range(f, t)),
      sb.from("olist_produto_map").select("produto_olist, modelo_cop"),
      sb.from("olist_pedidos_excluidos").select("numero_pedido"),
      lerTudo<{ pedido_olist: string | null }>((f, t) => sb.from("pedidos").select("pedido_olist").not("pedido_olist", "is", null).range(f, t)),
      sb.from("kpi_pedido_escopo").select("numero_pedido, escopo"),
    ]);
    for (const r of [lotesRes, mapRes, exclRes, escopoRes]) if (r.error) throw new ToolError("Erro ao ler vendas: " + r.error.message);
    if (!pedidos.length) return responder({ mensagem: "Sem dados de vendas visíveis para você." }, omitidos);

    const lotes: LotesPorData = {};
    const anulados = new Set<string>();
    for (const l of lotesRes.data ?? []) {
      if (l.anulado_em) { anulados.add(String(l.id)); continue; }
      lotes[String(l.id)] = String(l.importado_em);
    }
    const modeloPorProduto = new Map<string, string>();
    for (const r of mapRes.data ?? []) modeloPorProduto.set(String(r.produto_olist), String(r.modelo_cop));
    const noPcp = new Set(pcp.map((p) => basePedidoOlist(p.pedido_olist)).filter(Boolean));
    const pedidosVig = apenasVigentes(pedidos.filter((p) => !anulados.has(p.lote_id)), lotes);
    const vig = new Map(pedidosVig.map((p) => [p.numero_pedido, p.lote_id]));
    const itensVig = itens.filter((i) => !anulados.has(i.lote_id) && vig.get(i.numero_pedido) === i.lote_id);
    const calc = calcularPedidos(pedidosVig, itensVig, modeloPorProduto);
    const store = pedidosJuffStore(itensVig);
    const overrides = new Map((escopoRes.data ?? []).map((r) => [String(r.numero_pedido), String(r.escopo)]));
    const ehStore = (p: PedidoCalc) => { const ov = overrides.get(p.numero_pedido); if (ov) return ov === "store"; return store.has(p.numero_pedido) && p.empresa === "JOKE"; };
    const excluidos = new Set((exclRes.data ?? []).map((r) => String(r.numero_pedido)));

    const fmt = (r: ReturnType<typeof resumo>) => ({
      pedidos: r.pedidos, pecas: r.pecas,
      ...(fat ? { faturamento: r.faturamento, ticket_medio: r.ticket, preco_medio_peca: r.precoMedio } : {}),
    });
    const saida: Record<string, unknown> = { periodo: { de: a.de, ate: a.ate }, empresa: a.empresa ?? "CONSOLIDADO" };
    for (const fr of frentes) {
      const base = calc.filter((p) => (fr === "store" ? ehStore(p) : !ehStore(p)));
      const filtrados = aplicarFiltros(base, {
        de: a.de, ate: a.ate, empresa: (a.empresa ?? "CONSOLIDADO") as EmpresaFiltro,
        vendedores: a.vendedor ? [a.vendedor] : [], modelos: [], cores: [], tamanhos: [], situacoes: [],
        grupos: ["casados", "so_olist"],
      }, { excluidos, noPcp });
      const bloco: Record<string, unknown> = { ...fmt(resumo(filtrados)), link: linkSistema("kpi", null, fr) };
      if (a.por_mes) {
        const meses = new Map<string, typeof filtrados>();
        for (const p of filtrados) { const m = p.mes ?? "?"; (meses.get(m) ?? meses.set(m, []).get(m)!).push(p); }
        bloco.por_mes = [...meses.entries()].sort().map(([mes, ps]) => ({ mes, ...fmt(resumo(ps)) }));
      }
      saida[fr === "custom" ? "juff_custom" : "juff_store"] = bloco;
    }
    return responder(saida, omitidos);
  },
});
