import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { criarClienteDoUsuario, linkSistema, responder } from "../supabase";
import { abasDe, carregarPermissoes, type Perm } from "../permissoes";

type Area = {
  tabela: string;
  colunas: string[];
  busca?: string;
  pode: (p: Perm) => boolean;
  descricao: string;
  link?: string;
};

const qualquer = () => true;
const admin = (p: Perm) => p.ehAdmin;
const algum = (ks: string[]) => (p: Perm) => p.podeAlguma(ks);
const AUDIT = ["id", "tabela", "registro_id", "identificador", "acao", "mudancas", "feito_por_email", "feito_por_nome", "feito_em"];

/** Colunas conferidas contra src/integrations/supabase/types.ts. */
const AREAS: Record<string, Area> = {
  plan_estoque_minimo: { tabela: "plan_estoque_minimo", colunas: ["id", "modelo", "cor", "tamanho", "minimo_adotado", "sugerido_na_adocao", "adotado_em", "sob_demanda"], busca: "modelo", pode: algum(["plan.estoque_minimo"]), descricao: "estoque mínimo do PLAN", link: linkSistema("plan", null, "estoque_minimo") },
  plan_pausas: { tabela: "plan_pausas", colunas: ["id", "modelo", "cor", "tipo", "ate", "observacao", "criado_em", "retomado_em"], busca: "modelo", pode: algum(["plan.necessidade", "plan.tinturaria"]), descricao: "pausas do PLAN", link: linkSistema("plan", null, "necessidade") },
  plan_fichas_modelo: { tabela: "plan_fichas_modelo", colunas: ["id", "modelo", "tamanho_referencia", "pecas_por_folha", "altura_folha_m", "largura_tecido_m", "ativo", "observacao"], busca: "modelo", pode: algum(["plan.parametros"]), descricao: "fichas de modelo do PLAN", link: linkSistema("plan", null, "parametros") },
  plan_config: { tabela: "plan_config", colunas: ["chave", "valor", "descricao", "updated_at"], pode: algum(["plan.parametros"]), descricao: "parâmetros do PLAN", link: linkSistema("plan", null, "parametros") },
  perdas_manuais: { tabela: "perdas_manuais", colunas: ["id", "data", "modelo", "cor", "tamanho", "qtd", "motivo", "oficina_id", "berco", "destino", "responsavel", "observacoes", "area_identificou", "erro_producao", "area_erro", "problema", "created_at"], busca: "motivo", pode: algum(["cop.perdas", "cop.controle_perdas"]), descricao: "perdas manuais" },
  perdas_reclassificacoes: { tabela: "perdas_reclassificacoes", colunas: ["id", "pedido_id", "refacao_data", "refacao_idx", "modelo", "cor", "tamanho", "qtd", "motivo_original", "area_erro_original", "motivo_novo", "oficina_id", "berco", "destino", "observacao", "created_at"], pode: algum(["cop.controle_perdas"]), descricao: "reclassificações de perdas" },
  cop_perdas: { tabela: "cop_perdas", colunas: ["id", "cop_id", "oficina_id", "etiqueta", "modelo", "cor", "tamanho", "qtd", "motivo", "created_at"], pode: algum(["cop.perdas", "cop.controle_perdas"]), descricao: "perdas dos COPs" },
  oficinas: { tabela: "oficinas", colunas: ["id", "nome", "cnpj_cpf", "cnpj", "cpf", "endereco", "cep", "telefone", "observacoes", "valor_frete", "valores_por_modelo"], busca: "nome", pode: (p) => p.podeAlguma(abasDe("cop")), descricao: "oficinas" },
  saldo_estoque_olist: { tabela: "estoque_olist_itens", colunas: ["empresa", "produto_olist", "cor", "tamanho", "qtd"], busca: "produto_olist", pode: algum(["cop.saldo_real", "cop.alimentacao_estoque"]), descricao: "saldo de estoque Olist" },
  capacidade_etapas: { tabela: "pcp_capacidade_etapa", colunas: ["etapa", "teto_dia", "atualizado_em"], pode: algum(["pcp.monitor"]), descricao: "capacidade das etapas" },
  feriados: { tabela: "feriados", colunas: ["id", "data", "descricao"], pode: qualquer, descricao: "feriados" },
  listas_configuracao: { tabela: "app_lists", colunas: ["id", "kind", "nome", "ordem"], busca: "kind", pode: qualquer, descricao: "listas de configuração" },
  map_config: { tabela: "map_config", colunas: ["key", "value", "updated_at"], pode: (p) => p.podeAlguma(abasDe("map")), descricao: "configurações do MAP" },
  sup_departamentos: { tabela: "sup_departamentos", colunas: ["id", "nome", "ativo"], pode: (p) => p.podeAlguma(abasDe("sup")), descricao: "departamentos do SUP" },
  historico_pedidos: { tabela: "pedido_audit_log", colunas: ["id", "pedido_id", "orcamento", "pedido_olist", "acao", "mudancas", "feito_por_email", "feito_por_nome", "feito_em"], pode: admin, descricao: "histórico de pedidos" },
  historico_cop: { tabela: "cop_audit_log", colunas: AUDIT, pode: admin, descricao: "histórico de COPs" },
  historico_map: { tabela: "map_audit_log", colunas: AUDIT, pode: admin, descricao: "histórico do MAP" },
  historico_sup: { tabela: "sup_audit_log", colunas: AUDIT, pode: admin, descricao: "histórico do SUP" },
  usuarios: { tabela: "profiles", colunas: ["id", "email", "nome", "created_at"], busca: "email", pode: admin, descricao: "usuários" },
};

const ORDEM: Record<string, string> = { pedido_audit_log: "feito_em", cop_audit_log: "feito_em", map_audit_log: "feito_em", sup_audit_log: "feito_em", perdas_manuais: "data", cop_perdas: "created_at", perdas_reclassificacoes: "created_at", feriados: "data" };

export default defineTool({
  name: "dados_consultar",
  title: "Consultar outras tabelas",
  description:
    "Consulta tabelas de apoio por área (estoque mínimo e pausas do PLAN, perdas, oficinas, saldo Olist, feriados, listas, históricos e usuários). Use para perguntas como qual o mínimo da Camiseta preta P ou quais perdas foram lançadas esta semana.",
  inputSchema: {
    area: z.enum(Object.keys(AREAS) as [string, ...string[]]).describe("Qual área consultar."),
    filtros: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe("Filtros de igualdade coluna → valor, só com colunas aceitas pela área."),
    busca: z.string().optional().describe("Texto para busca parcial na coluna de busca da área."),
    limite: z.number().int().min(1).max(200).optional().describe("Máximo de linhas (padrão 50, máximo 200)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    const sb = criarClienteDoUsuario(ctx);
    const perm = await carregarPermissoes(sb, ctx);
    const area = AREAS[a.area];
    if (!area.pode(perm)) throw new ToolError(`Sem acesso a ${area.descricao} no PCP Juff.`);
    const omitidos: string[] = [];
    let colunas = area.colunas;
    if (a.area === "oficinas" && !perm.pode("cop.pagamento")) {
      colunas = colunas.filter((c) => c !== "valor_frete" && c !== "valores_por_modelo");
      omitidos.push("valor_frete e valores_por_modelo das oficinas");
    }
    for (const k of Object.keys(a.filtros ?? {})) {
      if (!area.colunas.includes(k)) throw new ToolError(`Coluna "${k}" não aceita em ${a.area}. Colunas aceitas: ${area.colunas.join(", ")}.`);
      if (!colunas.includes(k)) throw new ToolError(`Sem acesso à coluna "${k}" em ${a.area}.`);
    }
    if (a.busca && !area.busca) throw new ToolError(`A área ${a.area} não aceita busca por texto; use filtros.`);
    const limite = a.limite ?? 50;
    const t = sb.from(area.tabela as "feriados") as any;
    let q = t.select(colunas.join(", "));
    if (a.area === "saldo_estoque_olist") {
      const { data: snaps, error } = await sb.from("estoque_olist_snapshots").select("id, empresa, importado_em").order("importado_em", { ascending: false });
      if (error) throw new ToolError("Erro ao ler o saldo: " + error.message);
      const ultimos = new Map<string, string>();
      for (const s of snaps ?? []) if (!ultimos.has(s.empresa)) ultimos.set(s.empresa, s.id);
      if (!ultimos.size) return responder({ mensagem: "Nenhum saldo de estoque importado ainda." });
      q = q.in("snapshot_id", [...ultimos.values()]);
    }
    for (const [k, v] of Object.entries(a.filtros ?? {})) q = q.eq(k, v);
    if (a.busca && area.busca) q = q.ilike(area.busca, `%${a.busca.replace(/[%,()]/g, "")}%`);
    if (ORDEM[area.tabela]) q = q.order(ORDEM[area.tabela], { ascending: false });
    const { data, error } = await q.limit(limite);
    if (error) throw new ToolError("Erro ao ler dados: " + error.message);
    let linhas = (data ?? []) as Record<string, unknown>[];
    if (a.area === "usuarios") {
      const ids = linhas.map((l) => String(l.id));
      const { data: roles, error: e2 } = await sb.from("user_roles").select("user_id, role, areas_extras").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      if (e2) throw new ToolError("Erro ao ler papéis: " + e2.message);
      linhas = linhas.map((l) => ({ ...l, papeis: (roles ?? []).filter((r) => r.user_id === l.id).map((r) => ({ role: r.role, areas_extras: r.areas_extras })) }));
    }
    return responder({ area: a.area, total: linhas.length, linhas, ...(area.link ? { link: area.link } : {}) }, omitidos);
  },
});
