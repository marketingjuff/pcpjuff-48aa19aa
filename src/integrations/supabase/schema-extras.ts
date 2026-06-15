// Tipos auxiliares para tabelas/colunas adicionadas via migration recente.
// `types.ts` é regenerado automaticamente; até atualizar usamos estes.

export type AppRole = "admin" | "gestor" | "operador";

// Áreas usadas no checkbox de permissões (configurações > usuários).
// Operador NÃO pode ter "expedicao".
export type AppArea =
  | "dados_in_vendedor"
  | "dados_in_producao"
  | "arte"
  | "dtf"
  | "silk"
  | "acabamento"
  | "expedicao";

export const APP_AREAS_GESTOR: AppArea[] = [
  "dados_in_vendedor",
  "dados_in_producao",
  "arte",
  "dtf",
  "silk",
  "acabamento",
  "expedicao",
];
export const APP_AREAS_OPERADOR: AppArea[] = [
  "dados_in_vendedor",
  "dados_in_producao",
  "arte",
  "dtf",
  "silk",
  "acabamento",
];
export const APP_AREA_LABEL: Record<AppArea, string> = {
  dados_in_vendedor: "Dados In — Input de Vendedor",
  dados_in_producao: "Dados In — Input de Produção",
  arte: "Arte",
  dtf: "DTF",
  silk: "Silk Screen",
  acabamento: "Acabamento",
  expedicao: "Expedição",
};

export type Profile = {
  id: string;
  email: string;
  nome: string | null;
  created_at: string;
};

export type UserRoleRow = {
  id: string;
  user_id: string;
  role: AppRole;
  areas_extras: string[] | null;
  created_at: string;
};

export type Feriado = {
  id: string;
  data: string;
  descricao: string | null;
  created_at: string;
};

// Campos novos em `pedidos` (merge com Tables<"pedidos">)
export type PedidoExtras = {
  data_entrega: string | null;
  tempo_producao: string | null;
  uf_entrega: string | null;
  necessita_vetorizacao: boolean | null;
  vetorizacao_executada: boolean | null;
  obs_vendedor: string | null;
  layout_url: string | null;
  quem_bateu_dtf: string | null;
  quem_bateu_silk: string | null;
  finalizado_em: string | null;
  status_arte: string | null;
  status_pecas: string | null;
  reaberto: boolean | null;
  tipo_estampa: string | null;

  // Novos v2
  forma_pagamento: string | null;
  nf_emitida: boolean | null;
  expedicao_entrou_em: string | null;
  exp_cobranca_pagamento: boolean | null;
  exp_pagamento: boolean | null;
  exp_etiqueta: boolean | null;
  exp_frete_solicitado: boolean | null;
  exp_despachado: boolean | null;
  exp_despachado_em: string | null;
  exp_observacoes: string | null;
};
