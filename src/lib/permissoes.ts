// Fonte única de verdade das permissões granulares por aba.
// Chaves no formato "modulo.aba". 100% frontend — a coluna
// `user_roles.areas_extras` (text[]) continua sendo o armazenamento.
// O nível de acesso vai como sufixo na própria chave:
//   "pcp.acabamento"          → edição (padrão)
//   "pcp.acabamento:leitura"  → somente leitura

import type { AppRole } from "@/integrations/supabase/schema-extras";

export type ModuloKey = "pcp" | "cop" | "map" | "sup" | "kpi";

export type PermissaoKey = string; // "modulo.aba"

export type NivelAcesso = "edicao" | "leitura";

export type AbaPermissao = {
  key: PermissaoKey;
  modulo: ModuloKey;
  tabValue: string;
  label: string;
  /** true = admin pode escolher entre edição e somente leitura nesta aba. */
  nivelConfiguravel: boolean;
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
  { key: "pcp.dashboard", modulo: "pcp", tabValue: "dashboard", label: "Dashboard Master", nivelConfiguravel: false },
  { key: "pcp.dados_in_vendedor", modulo: "pcp", tabValue: "dados", label: "Dados In — Input de Vendedor", nivelConfiguravel: true },
  { key: "pcp.dados_in_vendedor", modulo: "pcp", tabValue: "dados", label: "Dados In — Input de Vendedor", nivelConfiguravel: true },
  { key: "pcp.dados_in_producao", modulo: "pcp", tabValue: "dados", label: "Dados In — Input de Produção", nivelConfiguravel: true },
  { key: "pcp.arte", modulo: "pcp", tabValue: "arte", label: "Arte", nivelConfiguravel: true },
  { key: "pcp.dtf", modulo: "pcp", tabValue: "dtf", label: "DTF", nivelConfiguravel: true },
  { key: "pcp.silk", modulo: "pcp", tabValue: "silk", label: "Silk Screen", nivelConfiguravel: true },
  { key: "pcp.acabamento", modulo: "pcp", tabValue: "acab", label: "Acabamento", nivelConfiguravel: true },
  { key: "pcp.expedicao", modulo: "pcp", tabValue: "exp", label: "Expedição", nivelConfiguravel: true },
  { key: "pcp.finalizados", modulo: "pcp", tabValue: "fin", label: "Finalizados", nivelConfiguravel: true },
  { key: "pcp.retrabalho", modulo: "pcp", tabValue: "retrab", label: "Retrabalho", nivelConfiguravel: true },
  // COP
  { key: "cop.dashboard", modulo: "cop", tabValue: "dashboard", label: "Dashboard COP", nivelConfiguravel: false },
  { key: "cop.disponivel", modulo: "cop", tabValue: "disponivel", label: "Disponível", nivelConfiguravel: false },
  { key: "cop.falta", modulo: "cop", tabValue: "falta", label: "Falta por Pedido", nivelConfiguravel: false },
  { key: "cop.oficinas_hoje", modulo: "cop", tabValue: "oficinas-hoje", label: "Oficinas Hoje", nivelConfiguravel: false },
  { key: "cop.corte", modulo: "cop", tabValue: "corte", label: "Corte", nivelConfiguravel: false },
  { key: "cop.romaneio", modulo: "cop", tabValue: "romaneio", label: "Romaneio", nivelConfiguravel: false },
  { key: "cop.pagamento", modulo: "cop", tabValue: "pagamento", label: "Pagamentos", nivelConfiguravel: false },
  { key: "cop.perdas", modulo: "cop", tabValue: "perdas", label: "Perdas", nivelConfiguravel: false },
  { key: "cop.controle_perdas", modulo: "cop", tabValue: "controle-perdas", label: "Controle de Perdas", nivelConfiguravel: false },
  { key: "cop.alimentacao_estoque", modulo: "cop", tabValue: "alimentacao-estoque", label: "Alimentação Estoque Real", nivelConfiguravel: false },
  { key: "cop.saldo_real", modulo: "cop", tabValue: "saldo-real", label: "Saldo Real Juff", nivelConfiguravel: false },
  // MAP
  { key: "map.programacao", modulo: "map", tabValue: "programacao", label: "Prod. de Tecido", nivelConfiguravel: false },
  { key: "map.finalizados", modulo: "map", tabValue: "finalizados", label: "Prod. Finalizados", nivelConfiguravel: false },
  { key: "map.estoque", modulo: "map", tabValue: "estoque", label: "Estoque de MP", nivelConfiguravel: false },
  { key: "map.pecas_finalizadas", modulo: "map", tabValue: "pecas-finalizadas", label: "Peças Finalizadas", nivelConfiguravel: false },
  { key: "map.quebra", modulo: "map", tabValue: "quebra", label: "Quebra", nivelConfiguravel: false },
  { key: "map.devolucoes", modulo: "map", tabValue: "devolucoes", label: "Devoluções", nivelConfiguravel: false },
  // SUP
  { key: "sup.produtos", modulo: "sup", tabValue: "produtos", label: "Produtos", nivelConfiguravel: false },
  { key: "sup.pedidos", modulo: "sup", tabValue: "pedidos", label: "Pedidos de Compra", nivelConfiguravel: false },
  { key: "sup.comissoes", modulo: "sup", tabValue: "comissoes", label: "Comissões", nivelConfiguravel: false },
  { key: "sup.dashboard", modulo: "sup", tabValue: "dashboard", label: "Dashboard SUP", nivelConfiguravel: false },
  // KPI
  { key: "kpi.importolist", modulo: "kpi", tabValue: "importolist", label: "Importação Olist", nivelConfiguravel: false },
  { key: "kpi.custom", modulo: "kpi", tabValue: "custom", label: "KPI Juff Custom", nivelConfiguravel: false },
  { key: "kpi.store", modulo: "kpi", tabValue: "store", label: "KPI Juff Store", nivelConfiguravel: false },
  { key: "kpi.pcp", modulo: "kpi", tabValue: "pcp", label: "KPI PCP", nivelConfiguravel: false },
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

export function nivelConfiguravel(key: PermissaoKey): boolean {
  return POR_KEY.get(key)?.nivelConfiguravel ?? false;
}

/** "pcp.acabamento:leitura" → { key: "pcp.acabamento", nivel: "leitura" } */
export function parsePermissao(raw: string): { key: PermissaoKey; nivel: NivelAcesso } | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const i = s.indexOf(":");
  if (i === -1) return { key: s, nivel: "edicao" };
  const key = s.slice(0, i).trim();
  const suf = s.slice(i + 1).trim().toLowerCase();
  if (!key) return null;
  return { key, nivel: suf === "leitura" ? "leitura" : "edicao" };
}

/** Monta o valor para gravar no array. */
export function serializarPermissao(key: PermissaoKey, nivel: NivelAcesso): string {
  return nivel === "leitura" ? `${key}:leitura` : key;
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
 * O sufixo de nível é ignorado aqui — somente leitura continua VENDO a aba.
 */
export function normalizarPermissoes(
  areasExtras: string[] | null | undefined,
  role?: AppRole,
): Set<PermissaoKey> {
  const arr = areasExtras ?? [];
  const out = new Set<PermissaoKey>();
  let temFormatoNovo = false;

  for (const raw of arr) {
    const p = parsePermissao(typeof raw === "string" ? raw : "");
    if (!p) continue;
    const s = p.key;
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

/** Nível efetivo de cada permissão do usuário. Chave sem sufixo → "edicao". */
export function niveisPermissoes(
  areasExtras: string[] | null | undefined,
  role?: AppRole,
): Map<PermissaoKey, NivelAcesso> {
  const out = new Map<PermissaoKey, NivelAcesso>();
  // Base: todas as abas visíveis entram como edição (comportamento atual).
  for (const k of normalizarPermissoes(areasExtras, role)) out.set(k, "edicao");
  // Só chaves no formato novo podem declarar leitura; se a mesma aba aparecer
  // também sem sufixo, edição vence.
  const leitura = new Set<PermissaoKey>();
  const edicao = new Set<PermissaoKey>();
  for (const raw of areasExtras ?? []) {
    const p = parsePermissao(typeof raw === "string" ? raw : "");
    if (!p || !POR_KEY.has(p.key)) continue;
    (p.nivel === "leitura" ? leitura : edicao).add(p.key);
  }
  for (const k of leitura) if (!edicao.has(k) && out.has(k)) out.set(k, "leitura");

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

export type Preset = { id: string; label: string; permissoes: string[] };

export const PRESETS: Preset[] = [
  { id: "vendedor_custom", label: "Vendedor — KPI Custom", permissoes: ["kpi.custom"] },
  {
    id: "vendedor_completo",
    label: "Vendedor — Dados In + KPI Custom",
    permissoes: ["pcp.dados_in_vendedor", "kpi.custom"],
  },
  {
    id: "vendedor_acompanha",
    label: "Vendedor — Dados In + acompanha produção",
    permissoes: [
      "pcp.dados_in_vendedor",
      "pcp.arte:leitura",
      "pcp.dtf:leitura",
      "pcp.silk:leitura",
      "pcp.acabamento:leitura",
      "kpi.custom",
    ],
  },
  {
    id: "consulta_pcp",
    label: "Consulta — PCP inteiro somente leitura",
    permissoes: permissoesDoModulo("pcp").map((k) =>
      nivelConfiguravel(k) ? serializarPermissao(k, "leitura") : k,
    ),
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
