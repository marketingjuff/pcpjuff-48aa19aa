import { defineTool } from "@lovable.dev/mcp-js";
import { MODULOS, CATALOGO_PERMISSOES, labelDaPermissao } from "@/lib/permissoes";
import type { Pedido } from "@/lib/pedidos";
import { criarClienteDoUsuario, lerTudo, responder } from "../supabase";
import { abasDe, carregarPermissoes, etapaDoPedido, pedidoVisivel, type Perm } from "../permissoes";

const VOCABULARIO = [
  "Pedido Olist: número do pedido vindo da Olist (ex.: 3996). Orçamento: número da proposta comercial.",
  "Parciais: 3996A e 3996B são partes do mesmo pedido 3996 da Olist.",
  "Etapas do PCP: Dados In, Arte, DTF, Silk, Acabamento, Expedição, Finalizados.",
  "Batida: unidade de carga de trabalho no DTF e no Silk.",
  "Refação: retrabalho de um pedido que voltou para alguma etapa. Correção de etapa: ajuste manual da etapa.",
  "COP: ordem de corte; a letra separa partes (ex.: 0001A). Romaneio: lista de peças enviadas à oficina. Oficina: costura terceirizada.",
  "PROD: produção de tecido no MAP, exibida como PROD101. Estoque de MP: peças de malha (matéria-prima).",
  "PC: pedido de compra do SUP (ex.: PC26MAI-01).",
  "Juff Custom: vendas personalizadas (atacado, passam pelo PCP). Juff Store: e-commerce.",
  "PLAN: planejamento do que produzir. Estoque mínimo: quantidade mínima por modelo, cor e tamanho. Sob demanda: tamanho que só se produz quando vende.",
];

const FERRAMENTAS: { nome: string; libera: (p: Perm) => boolean }[] = [
  { nome: "mapa_do_sistema", libera: () => true },
  { nome: "pedidos_listar", libera: (p) => p.podeAlguma(abasDe("pcp")) },
  { nome: "pedido_detalhe", libera: (p) => p.podeAlguma(abasDe("pcp")) },
  { nome: "producao_panorama", libera: (p) => p.podeAlguma(["pcp.dashboard", "pcp.monitor", "kpi.pcp"]) },
  { nome: "cops_listar", libera: (p) => p.podeAlguma(abasDe("cop")) },
  { nome: "cop_detalhe", libera: (p) => p.podeAlguma(abasDe("cop")) },
  { nome: "map_consultar", libera: (p) => p.podeAlguma(["map.programacao", "map.finalizados", "map.estoque", "map.devolucoes", "map.quebra"]) },
  { nome: "compras_consultar", libera: (p) => p.podeAlguma(["sup.pedidos", "sup.produtos", "sup.dashboard", "sup.comissoes"]) },
  { nome: "vendas_olist_resumo", libera: (p) => p.podeAlguma(["kpi.custom", "kpi.store"]) },
  { nome: "dados_consultar", libera: () => true },
];

export default defineTool({
  name: "mapa_do_sistema",
  title: "Mapa do sistema",
  description:
    "Chame primeiro. Explica os módulos e o vocabulário da Juff, diz quem é a pessoa conectada, o que ela pode ver e traz contagens rápidas só dos módulos liberados.",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_a, ctx) => {
    const sb = criarClienteDoUsuario(ctx);
    const perm = await carregarPermissoes(sb, ctx);
    const modulos = perm.modulosLiberados.map((m) => ({
      modulo: m,
      nome: MODULOS.find((x) => x.key === m)?.label ?? m,
      abas: CATALOGO_PERMISSOES.filter((a) => a.modulo === m && !a.acao && perm.pode(a.key)).map((a) => labelDaPermissao(a.key)),
    }));
    const contagens: Record<string, unknown> = {};
    const lib = perm.modulosLiberados;
    if (lib.includes("pcp")) {
      const ps = await lerTudo<Pedido>((f, t) => sb.from("pedidos").select("*").is("finalizado_em", null).range(f, t));
      const porEtapa: Record<string, number> = {};
      for (const p of ps) if (pedidoVisivel(perm, p)) { const e = etapaDoPedido(p).etapa; porEtapa[e] = (porEtapa[e] ?? 0) + 1; }
      contagens.pedidos_abertos_por_etapa = porEtapa;
    }
    if (lib.includes("cop")) {
      const cs = await lerTudo<{ status: string }>((f, t) => sb.from("cops").select("status").range(f, t));
      const s: Record<string, number> = {};
      for (const c of cs) s[c.status] = (s[c.status] ?? 0) + 1;
      contagens.cops_por_status = s;
    }
    if (lib.includes("map")) {
      const { count } = await sb.from("map_producoes").select("id", { count: "exact", head: true }).eq("finalizado", false);
      contagens.prods_nao_finalizados = count ?? 0;
    }
    if (perm.pode("sup.pedidos")) {
      const { count } = await sb.from("sup_pedidos_compra").select("id", { count: "exact", head: true }).not("status", "in", "(recebido,pago,cancelado)");
      contagens.pcs_abertos = count ?? 0;
    }
    return responder({
      pessoa: { email: ctx.getUserEmail() ?? null, papel: perm.papeis.join(", ") || null, admin: perm.ehAdmin },
      modulos_liberados: modulos,
      pode_ver_faturamento_em_reais: perm.pode("kpi.faturamento"),
      vocabulario: VOCABULARIO,
      contagens,
      ferramentas_disponiveis: FERRAMENTAS.map((f) => ({ nome: f.nome, liberada: f.libera(perm) })),
    });
  },
});
