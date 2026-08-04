// Domínio do módulo SUP (Suprimentos) — tipos, listas e cálculos puros.

export const SUP_UNIDADES = [
  "unidade",
  "peça",
  "kg",
  "litro",
  "metro",
  "rolo",
  "caixa",
  "pacote",
] as const;

export const SUP_CONDICOES_PAGAMENTO = [
  "À vista",
  "7 dias",
  "15 dias",
  "28 dias",
  "30 dias",
  "30/60",
  "30/60/90",
  "Boleto",
  "PIX",
  "Cartão",
  "Outros",
] as const;

export const SUP_EMPRESAS = ["joke", "juff"] as const;
export type SupEmpresa = (typeof SUP_EMPRESAS)[number];
export const SUP_EMPRESA_LABEL: Record<SupEmpresa, string> = {
  joke: "Joke",
  juff: "Juff",
};

export const SUP_STATUS_PC = [
  "rascunho",
  "enviado",
  "confirmado",
  "recebido_parcial",
  "recebido",
  "pago",
  "cancelado",
] as const;
export type SupStatusPc = (typeof SUP_STATUS_PC)[number];

export const SUP_STATUS_LABEL: Record<SupStatusPc, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  confirmado: "Confirmado",
  recebido_parcial: "Recebido parcial",
  recebido: "Recebido",
  pago: "Pago",
  cancelado: "Cancelado",
};

export const SUP_STATUS_CLASSE: Record<SupStatusPc, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-sky-100 text-sky-900",
  confirmado: "bg-indigo-100 text-indigo-900",
  recebido_parcial: "bg-amber-100 text-amber-900",
  recebido: "bg-teal-100 text-teal-900",
  pago: "bg-emerald-100 text-emerald-900",
  cancelado: "bg-rose-100 text-rose-900",
};

/** Próximos status possíveis (cancelado é sempre disponível à parte). */
export const SUP_FLUXO: Record<string, SupStatusPc[]> = {
  rascunho: ["enviado"],
  enviado: ["confirmado"],
  confirmado: ["recebido"],
  recebido_parcial: ["recebido"],
  recebido: ["pago"],
  pago: [],
  cancelado: [],
};

// ---------------- Tipos das tabelas ----------------

export type SupFornecedor = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  documento: string | null;
  categoria: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  cidade: string | null;
  uf: string | null;
  condicao_pagamento_padrao: string | null;
  prazo_entrega_padrao_dias: number | null;
  ativo: boolean;
  observacoes: string | null;
  created_at?: string;
};

export type SupProduto = {
  id: string;
  fornecedor_id: string | null;
  nome: string;

  categoria: string | null;
  unidade: string;
  especificacao: string | null;
  preco_referencia: number | null;
  ativo: boolean;
  created_at?: string;
};


export type SupFornecedorProduto = {
  id: string;
  fornecedor_id: string;
  produto_id: string;
  preco_tabela: number | null;
  quantidade_minima: number | null;
  prazo_entrega_dias: number | null;
  ativo: boolean;
};

export type SupPrecoHistorico = {
  id: string;
  fornecedor_produto_id: string;
  preco_anterior: number | null;
  preco_novo: number;
  direcao: "alta" | "baixa" | "inicial";
  motivo: string | null;
  anexo_url: string | null;
  status_revisao: "pendente" | "revisada" | "contestada";
  revisado_por: string | null;
  revisado_em: string | null;
  alterado_por: string | null;
  created_at: string;
};

export type SupPedidoCompra = {
  id: string;
  numero: string | null;
  empresa: string;
  fornecedor_id: string;
  data_pedido: string;
  responsavel_id: string | null;
  comissionado_id: string | null;
  comissao_percentual: number | null;
  status: string;
  condicao_pagamento: string | null;
  condicao_pagamento_outros: string | null;
  previsao_entrega: string | null;
  data_recebimento_total: string | null;
  data_pagamento: string | null;
  frete_valor: number;
  desconto_global_tipo: "valor" | "percentual" | null;
  desconto_global_valor: number;
  nota_fiscal_numero: string | null;
  observacoes: string | null;
  cancelado_em: string | null;
  cancelado_motivo: string | null;
  created_at?: string;
};

export type SupPedidoItem = {
  id: string;
  pedido_id: string;
  produto_id: string;
  quantidade: number;
  unidade: string;
  preco_tabela: number;
  preco_negociado: number;
  preco_historico_id: string | null;
  quantidade_recebida: number;
  ordem: number;
};

export type SupComissionado = {
  id: string;
  user_id: string;
  nome: string;
  percentual: number;
  ativo: boolean;
};

export type SupComissao = {
  id: string;
  competencia: string;
  comissionado_id: string;
  economia_total: number;
  percentual_aplicado: number;
  valor_comissao: number;
  ajuste_valor: number;
  ajuste_motivo: string | null;
  status: "a_apurar" | "a_pagar" | "paga";
  liberado_por: string | null;
  liberado_em: string | null;
  pago_por: string | null;
  pago_em: string | null;
};

export type SupConfig = {
  id: string;
  percentual_padrao: number;
  dias_carencia_recebimento: number;
};

// ---------------- Cálculos puros ----------------

export function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** Economia da linha. Nunca negativa. */
export function economiaItem(item: { preco_tabela?: unknown; preco_negociado?: unknown; quantidade?: unknown }): number {
  const diff = n(item.preco_tabela) - n(item.preco_negociado);
  return Math.max(0, diff) * n(item.quantidade);
}

export function subtotalItem(item: { preco_negociado?: unknown; quantidade?: unknown }): number {
  return n(item.preco_negociado) * n(item.quantidade);
}

export function subtotalNegociado(itens: { preco_negociado?: unknown; quantidade?: unknown }[]): number {
  return itens.reduce((s, i) => s + subtotalItem(i), 0);
}

export function descontoGlobalRs(
  subtotal: number,
  tipo: "valor" | "percentual" | null | undefined,
  valor: unknown,
): number {
  const v = n(valor);
  if (v <= 0) return 0;
  const bruto = tipo === "percentual" ? subtotal * (v / 100) : v;
  return Math.max(0, Math.min(subtotal, bruto));
}

export type SupTotais = {
  subtotal_negociado: number;
  economia_itens: number;
  desconto_global_rs: number;
  economia_total: number;
  total_pedido: number;
  custo_total: number;
  comissao_prevista: number;
};

export function calcTotaisPedido(
  itens: { preco_tabela?: unknown; preco_negociado?: unknown; quantidade?: unknown }[],
  opts: {
    desconto_global_tipo?: "valor" | "percentual" | null;
    desconto_global_valor?: unknown;
    frete_valor?: unknown;
    comissao_percentual?: unknown;
  } = {},
): SupTotais {
  const subtotal = subtotalNegociado(itens);
  const economiaIt = itens.reduce((s, i) => s + economiaItem(i), 0);
  const desc = descontoGlobalRs(subtotal, opts.desconto_global_tipo ?? null, opts.desconto_global_valor);
  const economiaTotal = Math.max(0, economiaIt + desc);
  const total = subtotal - desc;
  return {
    subtotal_negociado: subtotal,
    economia_itens: economiaIt,
    desconto_global_rs: desc,
    economia_total: economiaTotal,
    total_pedido: total,
    custo_total: total + n(opts.frete_valor),
    comissao_prevista: economiaTotal * (n(opts.comissao_percentual) / 100),
  };
}

/** Status derivado do recebimento item a item. */
export function statusPorRecebimento(
  itens: { quantidade?: unknown; quantidade_recebida?: unknown }[],
  statusAtual: string,
): { status: string; recebido_total: boolean } {
  if (itens.length === 0) return { status: statusAtual, recebido_total: false };
  const completos = itens.every((i) => n(i.quantidade_recebida) >= n(i.quantidade) && n(i.quantidade) > 0);
  const algum = itens.some((i) => n(i.quantidade_recebida) > 0);
  if (completos) return { status: "recebido", recebido_total: true };
  if (algum) return { status: "recebido_parcial", recebido_total: false };
  return { status: statusAtual === "recebido_parcial" || statusAtual === "recebido" ? "confirmado" : statusAtual, recebido_total: false };
}

// ---------------- Datas / competência ----------------

export function addDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Competência (AAAA-MM) da data de elegibilidade. */
export function competenciaDe(dataISO: string): string {
  return dataISO.slice(0, 7);
}

export function competenciaLabel(comp: string): string {
  const [a, m] = comp.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const idx = Number(m) - 1;
  return `${nomes[idx] ?? m}/${a}`;
}

export function competenciaSeguinte(comp: string): string {
  const [a, m] = comp.split("-").map(Number);
  const d = new Date(Date.UTC(a, (m ?? 1) - 1 + 1, 1));
  return d.toISOString().slice(0, 7);
}

export function fmtMoeda(v: unknown): string {
  return n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtQtd(v: unknown): string {
  const x = n(v);
  return x.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function fmtDataBR(v: string | null | undefined): string {
  if (!v) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

export function variacaoPercentual(anterior: number | null | undefined, novo: number): number | null {
  const a = n(anterior);
  if (a <= 0) return null;
  return ((novo - a) / a) * 100;
}
