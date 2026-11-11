import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { criarClienteDoUsuario, linkSistema, responder } from "../supabase";
import { carregarPermissoes, exigir } from "../permissoes";

const PERMS = {
  prods: ["map.programacao", "map.finalizados"],
  estoque: ["map.estoque"],
  devolucoes: ["map.devolucoes"],
  quebra: ["map.quebra"],
} as const;

/** Metros restantes de uma peça: altura inicial menos o que já foi cortado (cópia local, só leitura). */
const metrosRestantes = (alt: unknown, cortes: unknown) =>
  Number(alt ?? 0) - (Array.isArray(cortes) ? cortes.reduce((s: number, c: any) => s + Number(c?.metros ?? 0), 0) : 0);

export default defineTool({
  name: "map_consultar",
  title: "Consultar tecidos (MAP)",
  description:
    "Consulta o MAP: produções de tecido (PROD), estoque de peças de malha, devoluções e quebra. Use para perguntas como quanto tem de malha preta no estoque ou em que pé está o PROD101.",
  inputSchema: {
    visao: z.enum(["prods", "estoque", "devolucoes", "quebra"]).describe("O que consultar."),
    numero_prod: z.number().int().optional().describe("Número do PROD (ex.: 101)."),
    empresa: z.enum(["Juff", "Joke"]).optional().describe("Empresa faturada."),
    cor: z.string().optional().describe("Cor (ou parte)."),
    status_peca: z.enum(["Fechada", "Aberta", "Corte", "Devolvida", "100% utilizada"]).optional().describe("Status da peça no estoque."),
    de: z.string().optional().describe("A partir de (AAAA-MM-DD)."),
    ate: z.string().optional().describe("Até (AAAA-MM-DD)."),
    incluir_finalizados: z.boolean().optional().describe("Incluir PRODs finalizados (padrão não)."),
    limite: z.number().int().min(1).max(200).optional().describe("Máximo de linhas (padrão 50, máximo 200)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    const sb = criarClienteDoUsuario(ctx);
    const perm = await carregarPermissoes(sb, ctx);
    exigir(perm, [...PERMS[a.visao]], `MAP (${a.visao})`);
    const limite = a.limite ?? 50;

    if (a.visao === "prods" || a.visao === "quebra") {
      let q = sb.from("map_producoes").select("*, map_malharia_entregas(*), map_tinturaria_programacoes(*)").order("numero", { ascending: false });
      if (a.numero_prod) q = q.eq("numero", a.numero_prod);
      if (a.empresa) q = q.ilike("faturar_para", a.empresa);
      if (a.de) q = q.gte("data_pedido", a.de);
      if (a.ate) q = q.lte("data_pedido", a.ate);
      if (!a.incluir_finalizados && !a.numero_prod) q = q.eq("finalizado", false);
      const { data, error } = await q.limit(limite);
      if (error) throw new ToolError("Erro ao ler PRODs: " + error.message);
      const prods = (data ?? []).map((p: any) => {
        const base = { id: p.id, prod: `PROD${p.numero}`, link: linkSistema("prod", p.id) };
        if (a.visao === "quebra") {
          const kgEnv = (p.map_tinturaria_programacoes ?? []).reduce((s: number, t: any) => s + Number(t.kg_enviados ?? 0), 0);
          const kgRec = (p.map_tinturaria_programacoes ?? []).reduce((s: number, t: any) => s + Number(t.kg_recebidos ?? 0), 0);
          const kgMalharia = (p.map_malharia_entregas ?? []).reduce((s: number, m: any) => s + Number(m.kg ?? 0), 0);
          return { ...base, kg_solicitados: p.kg_solicitados, kg_malharia: kgMalharia, kg_enviados_tinturaria: kgEnv, kg_recebidos_tinturaria: kgRec, quebra_kg: kgEnv - kgRec, quebra_conciliada: p.quebra_conciliada, quebra_conciliacao_obs: p.quebra_conciliacao_obs };
        }
        return { ...base, data_pedido: p.data_pedido, faturar_para: p.faturar_para, fornecedor: p.fornecedor, malharia: p.malharia, kg_solicitados: p.kg_solicitados, status: p.status, status_malharia: p.status_malharia, finalizado: p.finalizado, observacoes: p.observacoes, entregas_malharia: p.map_malharia_entregas, tinturaria: p.map_tinturaria_programacoes };
      });
      return responder({ total: prods.length, prods });
    }

    let q = sb.from("map_estoque_pecas").select("*, map_producoes(numero, faturar_para)");
    if (a.visao === "devolucoes") q = q.eq("status", "Devolvida");
    else if (a.status_peca) q = q.eq("status", a.status_peca);
    if (a.cor) q = q.ilike("cor", `%${a.cor}%`);
    if (a.de) q = q.gte("data_entrada", a.de);
    if (a.ate) q = q.lte("data_entrada", a.ate);
    const { data, error } = await q.limit(5000);
    if (error) throw new ToolError("Erro ao ler o estoque: " + error.message);
    let rows = (data ?? []) as any[];
    if (a.numero_prod) rows = rows.filter((r) => r.map_producoes?.numero === a.numero_prod);
    if (a.empresa) rows = rows.filter((r) => String(r.map_producoes?.faturar_para ?? "").toLowerCase() === a.empresa!.toLowerCase());
    if (a.visao === "estoque" && !a.status_peca) rows = rows.filter((r) => r.status !== "Devolvida" && r.status !== "100% utilizada");
    const resumo: Record<string, { pecas: number; metros_restantes: number }> = {};
    for (const r of rows) {
      const k = r.cor ?? "(sem cor)";
      const e = (resumo[k] ??= { pecas: 0, metros_restantes: 0 });
      e.pecas++; e.metros_restantes += metrosRestantes(r.alt_inicial, r.cortes);
    }
    const pecas = rows.slice(0, limite).map((r) => ({
      id: r.id, prod: r.map_producoes ? `PROD${r.map_producoes.numero}` : null, numero_peca: r.numero_peca, cor: r.cor, status: r.status,
      nota_fiscal: r.nota_fiscal, data_entrada: r.data_entrada, data_abertura: r.data_abertura, alt_inicial: r.alt_inicial,
      metros_restantes: metrosRestantes(r.alt_inicial, r.cortes), larg: r.larg,
      ...(a.visao === "devolucoes" ? { devolucao_motivo: r.devolucao_motivo, devolucao_data: r.devolucao_data, devolucao_nf: r.devolucao_nf } : {}),
      link: linkSistema("map", null, a.visao === "devolucoes" ? "devolucoes" : "estoque"),
    }));
    return responder({ total_pecas: rows.length, resumo_por_cor: resumo, pecas });
  },
});
