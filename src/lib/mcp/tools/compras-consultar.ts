import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { criarClienteDoUsuario, linkSistema, responder } from "../supabase";
import { carregarPermissoes, exigir } from "../permissoes";

const PERMS = {
  pedidos_compra: ["sup.pedidos"],
  fornecedores: ["sup.produtos"],
  produtos: ["sup.produtos"],
  historico_precos: ["sup.produtos", "sup.dashboard"],
  comissoes: ["sup.comissoes"],
} as const;

const limpa = (s: string) => s.replace(/[,()%]/g, "");

export default defineTool({
  name: "compras_consultar",
  title: "Consultar compras (SUP)",
  description:
    "Consulta o SUP: pedidos de compra (PC), fornecedores, produtos com preço, histórico de preços e comissões. Use para perguntas como o que está em aberto com o fornecedor X ou quanto custa a linha preta hoje.",
  inputSchema: {
    visao: z.enum(["pedidos_compra", "fornecedores", "produtos", "historico_precos", "comissoes"]).describe("O que consultar."),
    fornecedor: z.string().optional().describe("Razão social ou nome fantasia (ou parte)."),
    numero_pc: z.string().optional().describe("Número do PC (ex.: PC26MAI-01)."),
    status: z.string().optional().describe("Status (ex.: enviado, confirmado, recebido, pago, cancelado)."),
    produto: z.string().optional().describe("Nome do produto (ou parte)."),
    de: z.string().optional().describe("A partir de (AAAA-MM-DD)."),
    ate: z.string().optional().describe("Até (AAAA-MM-DD)."),
    limite: z.number().int().min(1).max(200).optional().describe("Máximo de linhas (padrão 50, máximo 200)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    const sb = criarClienteDoUsuario(ctx);
    const perm = await carregarPermissoes(sb, ctx);
    exigir(perm, [...PERMS[a.visao]], `compras (${a.visao})`);
    const limite = a.limite ?? 50;
    const err = (e: { message: string } | null) => { if (e) throw new ToolError("Erro ao ler compras: " + e.message); };

    let fornIds: string[] | null = null;
    if (a.fornecedor) {
      const f = limpa(a.fornecedor);
      const { data, error } = await sb.from("sup_fornecedores").select("id").or(`razao_social.ilike.%${f}%,nome_fantasia.ilike.%${f}%`);
      err(error);
      fornIds = (data ?? []).map((r) => r.id);
      if (!fornIds.length) throw new ToolError("Fornecedor não encontrado.");
    }

    if (a.visao === "pedidos_compra") {
      let q = sb.from("sup_pedidos_compra").select("*, sup_fornecedores(razao_social, nome_fantasia), sup_pedido_itens(quantidade, unidade, preco_tabela, preco_negociado, quantidade_recebida, variacao_1_valor, variacao_2_valor, sup_produtos(nome))").order("data_pedido", { ascending: false });
      if (fornIds) q = q.in("fornecedor_id", fornIds);
      if (a.numero_pc) q = q.ilike("numero", `%${limpa(a.numero_pc)}%`);
      if (a.status) q = q.eq("status", a.status);
      if (a.de) q = q.gte("data_pedido", a.de);
      if (a.ate) q = q.lte("data_pedido", a.ate);
      const { data, error } = await q.limit(limite);
      err(error);
      const pcs = (data ?? []).map((p: any) => {
        const itens = (p.sup_pedido_itens ?? []).map((i: any) => ({ produto: i.sup_produtos?.nome ?? null, variacao: [i.variacao_1_valor, i.variacao_2_valor].filter(Boolean).join(" / ") || null, quantidade: i.quantidade, unidade: i.unidade, preco_negociado: i.preco_negociado, preco_tabela: i.preco_tabela, quantidade_recebida: i.quantidade_recebida }));
        const subtotal = itens.reduce((s: number, i: any) => s + Number(i.quantidade ?? 0) * Number(i.preco_negociado ?? 0), 0);
        const desc = p.desconto_global_tipo === "percentual" ? (subtotal * Number(p.desconto_global_valor ?? 0)) / 100 : Number(p.desconto_global_valor ?? 0);
        return { id: p.id, numero: p.numero, empresa: p.empresa, fornecedor: p.sup_fornecedores?.nome_fantasia || p.sup_fornecedores?.razao_social, status: p.status, data_pedido: p.data_pedido, previsao_entrega: p.previsao_entrega, itens, frete: p.frete_valor, desconto: desc, total: subtotal - desc + Number(p.frete_valor ?? 0), link: linkSistema("pc", p.id) };
      });
      return responder({ total: pcs.length, pedidos_compra: pcs });
    }
    if (a.visao === "fornecedores") {
      let q = sb.from("sup_fornecedores").select("id, razao_social, nome_fantasia, categoria, contato_nome, contato_telefone, contato_email, cidade, uf, condicao_pagamento_padrao, ativo, observacoes").order("razao_social");
      if (fornIds) q = q.in("id", fornIds);
      const { data, error } = await q.limit(limite);
      err(error);
      return responder({ fornecedores: (data ?? []).map((f) => ({ ...f, link: linkSistema("fornecedor", f.id) })) });
    }
    if (a.visao === "produtos") {
      let q = sb.from("sup_fornecedor_produtos").select("preco_tabela, preco_negociado, quantidade_minima, prazo_entrega_dias, ativo, fornecedor_id, sup_fornecedores(razao_social, nome_fantasia), sup_produtos!inner(id, nome, categoria, unidade, departamento, ativo)");
      if (fornIds) q = q.in("fornecedor_id", fornIds);
      if (a.produto) q = q.ilike("sup_produtos.nome", `%${limpa(a.produto)}%`);
      const { data, error } = await q.limit(limite);
      err(error);
      return responder({ produtos: (data ?? []).map((r: any) => ({ produto: r.sup_produtos?.nome, categoria: r.sup_produtos?.categoria, unidade: r.sup_produtos?.unidade, departamento: r.sup_produtos?.departamento, fornecedor: r.sup_fornecedores?.nome_fantasia || r.sup_fornecedores?.razao_social, preco_atual: r.preco_negociado ?? r.preco_tabela, preco_tabela: r.preco_tabela, quantidade_minima: r.quantidade_minima, prazo_entrega_dias: r.prazo_entrega_dias, ativo: r.ativo, link: linkSistema("fornecedor", r.fornecedor_id) })) });
    }
    if (a.visao === "historico_precos") {
      let q = sb.from("sup_preco_historico").select("preco_anterior, preco_novo, direcao, motivo, tipo, created_at, status_revisao, sup_fornecedor_produtos!inner(fornecedor_id, sup_fornecedores(razao_social, nome_fantasia), sup_produtos!inner(nome))").eq("anulado", false).order("created_at", { ascending: false });
      if (fornIds) q = q.in("sup_fornecedor_produtos.fornecedor_id", fornIds);
      if (a.produto) q = q.ilike("sup_fornecedor_produtos.sup_produtos.nome", `%${limpa(a.produto)}%`);
      if (a.de) q = q.gte("created_at", a.de);
      if (a.ate) q = q.lte("created_at", a.ate + "T23:59:59");
      const { data, error } = await q.limit(limite);
      err(error);
      return responder({ historico: (data ?? []).map((h: any) => ({ data: String(h.created_at).slice(0, 10), produto: h.sup_fornecedor_produtos?.sup_produtos?.nome, fornecedor: h.sup_fornecedor_produtos?.sup_fornecedores?.nome_fantasia || h.sup_fornecedor_produtos?.sup_fornecedores?.razao_social, preco_anterior: h.preco_anterior, preco_novo: h.preco_novo, direcao: h.direcao, tipo: h.tipo, motivo: h.motivo, status_revisao: h.status_revisao, link: linkSistema("fornecedor", h.sup_fornecedor_produtos?.fornecedor_id) })) });
    }
    let q = sb.from("sup_comissoes").select("*, sup_comissionados(nome, percentual), sup_comissao_itens(economia, pedido_id)").order("competencia", { ascending: false });
    if (a.status) q = q.eq("status", a.status);
    const { data, error } = await q.limit(limite);
    err(error);
    return responder({ comissoes: (data ?? []).map((c: any) => ({ id: c.id, competencia: c.competencia, comissionado: c.sup_comissionados?.nome, economia_total: c.economia_total, percentual_aplicado: c.percentual_aplicado, valor_comissao: c.valor_comissao, ajuste_valor: c.ajuste_valor, ajuste_motivo: c.ajuste_motivo, status: c.status, liberado_em: c.liberado_em, pago_em: c.pago_em, pedidos: (c.sup_comissao_itens ?? []).length, link: "https://pcpjuff.lovable.app/sup?tab=comissoes" })) });
  },
});
