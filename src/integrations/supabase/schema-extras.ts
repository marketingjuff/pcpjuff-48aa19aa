// Tipos auxiliares para tabelas/colunas adicionadas via migration recente.
// `types.ts` é regenerado automaticamente; até atualizar usamos estes.

export type AppRole = "admin" | "gestor" | "arte" | "dtf" | "silk" | "acabamento";

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
  status_geral: string | null;
  tipo_estampa: string | null;
};
