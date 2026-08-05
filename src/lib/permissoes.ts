// Fonte única de verdade das permissões granulares por aba.
// Chaves no formato "modulo.aba". 100% frontend — a coluna
// `user_roles.areas_extras` (text[]) continua sendo o armazenamento.

import type { AppRole } from "@/integrations/supabase/schema-extras";

export type ModuloKey = "pcp" | "cop" | "map" | "sup" | "kpi";

export type PermissaoKey = string; // "modulo.aba"

export type AbaPermissao = {
  key: PermissaoKey;
  modulo: ModuloKey;
  tabValue: string;
  label: string;
};

export const MODULOS: { key: ModuloKey; label: string; rota: string }[] = [
  { key: "pcp", label: "PCP — Produção de Pedidos", rota: "/" },
  { key: "cop", label: "COP — Ordem de Produção", rota: "/cop" },
  { key: "map", label: "MAP — Matéria Prima", rota: "/map" },
  { key: "sup", label: "SUP — Suprimentos", rota: "/sup" },
  { key: "kpi", label: "KPI — Indicadores", rota: "/kpi" },
];

export const CATALOGO_PERMISSOES: AbaPermissao[] = [
  // PCP
  { key: "pcp.dashboard", modulo: "pcp", tabValue: "dashboard", label: "Dashboard Master" },
  { key: "pcp.dados_in_vendedor", modulo: "pcp", tabValue: "dados", label: "Dados In — Input de Vendedor" },
  { key: "pcp.dados_in_producao", modulo: "pcp", tabValue: "dados", label: "Dados In — Input de Produção" },
  { key: "pcp.arte", modulo: "pcp", tabValue: "arte", label: "Arte" },
  { key: "pcp.dtf", modulo: "pcp", tabValue: "dtf", label: "DTF" },
  { key: "pcp.silk", modulo: "pcp", tabValue: "silk", label: "Silk Screen" },
  { key: "pcp.acabamento", modulo: "pcp", tabValue: "acab", label: "Acabamento" },
  { key: "pcp.expedicao", modulo: "pcp", tabValue: "exp", label: "Expedição" },
  { key: "pcp.finalizados", modulo: "pcp", tabValue: "fin", label: "Finalizados" },
  { key: "pcp.retrabalho", modulo: "pcp", tabValue: "retrab", label: "Retrabalho" },
  // COP
  { key: "cop.dashboard", modulo: "cop", tabValue: "dashboard", label: "Dashboard COP" },
  { key: "cop.disponivel", modulo: "cop", tabValue: "disponivel", label: "Disponível" },
  { key: "cop.falta", modulo: "cop", tabValue: "falta", label: "Falta por Pedido" },
  { key: "cop.oficinas_hoje", modulo: "cop", tabValue: "oficinas-hoje", label: "Oficinas Hoje" },
  { key: "cop.corte", modulo: "cop", tabValue: "corte", label: "Corte" },
  { key: "cop.romaneio", modulo: "cop", tabValue: "romaneio", label: "Romaneio" },
  { key: "cop.pagamento", modulo: "cop", tabValue: "pagamento", label: "Pagamentos" },
  { key: "cop.perdas", modulo: "cop", tabValue: "perdas", label: "Perdas" },
  { key: "cop.controle_perdas", modulo: "cop", tabValue: "controle-perdas", label: "Controle de Perdas" },
  { key: "cop.alimentacao_estoque", modulo: "cop", tabValue: "alimentacao-estoque", label: "Alimentação Estoque Real" },
  { key: "cop.saldo_real", modulo: "cop", tabValue: "saldo-real", label: "Saldo Real Juff" },
  // MAP
  { key: "map.programacao", modulo: "map", tabValue: "programacao", label: "Prod. de Tecido" },
  { key: "map.finalizados", modulo: "map", tabValue: "finalizados", label: "Prod. Finalizados" },
  { key: "map.estoque", modulo: "map", tabValue: "estoque", label: "Estoque de MP" },
  { key: "map.pecas_finalizadas", modulo: "map", tabValue: "pecas-finalizadas", label: "Peças Finalizadas" },
  { key: "map.quebra", modulo: "map", tabValue: "quebra", label: "Quebra" },
  { key: "map.devolucoes", modulo: "map", tabValue: "devolucoes", label: "Devoluções" },
  // SUP
  { key: "sup.produtos", modulo: "sup", tabValue: "produtos", label: "Produtos" },
  { key: "sup.pedidos", modulo: "sup", tabValue: "pedidos", label: "Pedidos de Compra" },
  { key: "sup.comissoes", modulo: "sup", tabValue: "comissoes", label: "Comissões" },
  { key: "sup.dashboard", modulo: "sup", tabValue: "dashboard", label: "Dashboard SUP" },
  // KPI
  { key: "kpi.importolist", modulo: "kpi", tabValue: "importolist", label: "Importação Olist" },
  { key: "kpi.custom", modulo: "kpi", tabValue: "custom", label: "KPI Juff Custom" },
  { key: "kpi.store", modulo: "kpi", tabValue: "store", label: "KPI Juff Store" },
  { key: "kpi.pcp", modulo: "kpi", tabValue: "pcp", label: "KPI PCP" },
];

const POR_KEY = new Map(CATALOGO_PERMISSOES.map((a) => [a.key, a]));

export function abasDoModulo(modulo: ModuloKey): AbaPermissao[] {
  return CATALOGO_PERMISSOES.filter((a) => a.modulo === modulo);
}

export function permissoesDoModulo(modulo: ModuloKey): PermissaoKey[] {
  return abasDoModulo(modulo).map((a) => a.key);
}

export function labelDaPermissao(key: PermissaoKey): string {
  return POR_KEY.get(key)?.label ?? key;
}

export function todasPermissoes(): PermissaoKey[] {
  return CATALOGO_PERMISSOES.map((a) => a.key);
}

/** Chaves legadas (formato antigo, sem ponto) → chaves novas. */
const LEGADO: Record<string, PermissaoKey[]> = {
  dashboard: ["pcp.dashboard"],
  dados_in_vendedor: ["pcp.dados_in_vendedor"],
  dados_in_producao: ["pcp.dados_in_producao"],
  arte: ["pcp.arte"],
  dtf: ["pcp.dtf"],
  silk: ["pcp.silk"],
  acabamento: ["pcp.acabamento"],
  expedicao: ["pcp.expedicao"],
  finalizados: ["pcp.finalizados"],
  cop: permissoesDoModulo("cop"),
  map: permissoesDoModulo("map"),
  sup: permissoesDoModulo("sup"),
};

/**
 * Traduz o conteúdo atual de `areas_extras` para o conjunto de permissões novas.
 * Nenhum usuário perde acesso: chaves legadas continuam válidas e gestores em
 * formato 100% legado mantêm Dashboard/Finalizados/Retrabalho do PCP.
 */
export function normalizarPermissoes(
  areasExtras: string[] | null | undefined,
  role?: AppRole,
): Set<PermissaoKey> {
  const arr = areasExtras ?? [];
  const out = new Set<PermissaoKey>();
  let temFormatoNovo = false;

  for (const raw of arr) {
    if (typeof raw !== "string") continue;
    const s = raw.trim();
    if (!s) continue;
    if (s.includes(".")) {
      temFormatoNovo = true;
      if (POR_KEY.has(s)) out.add(s);
      continue;
    }
    const novas = LEGADO[s];
    if (novas) novas.forEach((k) => out.add(k));
  }

  if (role === "gestor" && !temFormatoNovo) {
    out.add("pcp.dashboard");
    out.add("pcp.finalizados");
    out.add("pcp.retrabalho");
  }

  return out;
}

/** Rota do primeiro módulo com pelo menos 1 aba permitida. */
export function rotaInicial(permissoes: Set<PermissaoKey>, isAdmin: boolean): string {
  if (isAdmin) return "/";
  for (const m of MODULOS) {
    if (permissoesDoModulo(m.key).some((k) => permissoes.has(k))) return m.rota;
  }
  return "/";
}

// ---------------- Presets ----------------

export type Preset = { id: string; label: string; permissoes: PermissaoKey[] };

export const PRESETS: Preset[] = [
  { id: "vendedor_custom", label: "Vendedor — KPI Custom", permissoes: ["kpi.custom"] },
  {
    id: "vendedor_completo",
    label: "Vendedor — Dados In + KPI Custom",
    permissoes: ["pcp.dados_in_vendedor", "kpi.custom"],
  },
  { id: "operador_arte", label: "Operador — Arte", permissoes: ["pcp.arte"] },
  { id: "operador_dtf", label: "Operador — DTF", permissoes: ["pcp.dtf"] },
  { id: "operador_silk", label: "Operador — Silk", permissoes: ["pcp.silk"] },
  { id: "operador_acabamento", label: "Operador — Acabamento", permissoes: ["pcp.acabamento"] },
  {
    id: "operador_expedicao",
    label: "Operador — Expedição",
    permissoes: ["pcp.expedicao", "pcp.finalizados"],
  },
  { id: "pcp_completo", label: "PCP completo", permissoes: permissoesDoModulo("pcp") },
  { id: "cop_completo", label: "COP completo", permissoes: permissoesDoModulo("cop") },
  { id: "map_completo", label: "MAP completo", permissoes: permissoesDoModulo("map") },
  { id: "sup_completo", label: "SUP completo", permissoes: permissoesDoModulo("sup") },
  { id: "kpi_completo", label: "KPI completo", permissoes: permissoesDoModulo("kpi") },
];
