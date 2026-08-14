// Rótulos e formatadores PT-BR para os históricos (auditoria).
// Usado por AuditLogView e HistoricoPedidoDialog para deixar tudo legível a leigos.

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const LABELS: Record<string, string> = {
  // ---------- pedidos ----------
  pedido_olist: "Pedido Olist",
  orcamento: "Orçamento",
  vendedor: "Vendedor",
  tipo_estampa: "Tipo de estampa",
  status_pecas: "Status das peças",
  status_arte: "Anotações da arte",
  qtd: "Quantidade",
  frete: "Frete",
  uf_entrega: "UF de entrega",
  data_entrega: "Data de entrega",
  data_entrega_proposta: "Data de entrega proposta",
  entrada_pedido: "Entrada do pedido",
  inicio_estamparia: "Início da estamparia",
  termino_estamparia: "Término da estamparia",
  inicio_acabamento: "Início do acabamento",
  termino_acabamento: "Término do acabamento",
  saida_juff: "Saída da Juff",
  data_saida_juff: "Data de saída da Juff",
  acabamento_data: "Data do acabamento",
  arte_data: "Data da arte",
  arte_iniciou_em: "Entrada na Arte (automático)",
  dtf_data_executada: "Data do DTF estampado",
  silk_data_executada: "Data do Silk feito",
  dtf_estampado: "DTF estampado",
  dtf_impresso: "DTF impresso",
  dtf_executado: "DTF executado",
  dtf_cortado: "DTF cortado",
  dtf_cortado_data: "Data do DTF cortado",
  silk_feito: "Silk feito",
  fotolito_impresso: "Fotolito impresso",
  fotolito_executado: "Fotolito executado",
  tela_gravada: "Tela gravada",
  embalado: "Embalado",
  necessita_vetorizacao: "Precisa vetorizar",
  vetorizacao_executada: "Vetorização feita",
  vetorizacao_dtf: "Vetorização DTF",
  vetorizacao_silk: "Vetorização Silk",
  quem_bateu_dtf: "Quem estampou DTF",
  quem_bateu_silk: "Quem estampou Silk",
  quem_cortou_dtf: "Quem cortou o DTF",
  quem_revelou_tela: "Quem revelou a tela",
  responsavel_acabamento: "Responsável pelo acabamento",
  responsavel_conferencia: "Responsável pela conferência",
  layout_url: "Layout",
  finalizado_em: "Finalizado em",
  tempo_producao: "Tempo de produção",
  tempo_frete: "Tempo de frete",
  forma_pagamento: "Forma de pagamento",
  nf_emitida: "Nota fiscal emitida",
  expedicao_entrou_em: "Entrou na expedição em",
  exp_cobranca_pagamento: "Cobrança de pagamento (Expedição)",
  exp_pagamento: "Pagamento confirmado (Expedição)",
  exp_etiqueta: "Etiqueta emitida (Expedição)",
  exp_frete_solicitado: "Frete solicitado (Expedição)",
  exp_frete_solicitado_em: "Frete solicitado em (Expedição)",
  exp_despachado: "Pedido despachado (Expedição)",
  exp_despachado_em: "Despachado em (Expedição)",
  exp_observacoes: "Observações da expedição",
  exp_destino_humberto: "Despachado para o Humberto (Expedição)",
  canhoto_horario_comercial: "Entrega em horário comercial (Canhoto)",
  canhoto_impresso_em: "Canhoto impresso em",
  canhoto_fotos: "Fotos do canhoto",
  entrega_confirmada_em: "Entrega confirmada em",
  entrega_confirmada_por: "Entrega confirmada por",
  reaberto: "Reaberto",
  dias_secagem: "Dias de secagem",
  n_batidas_dtf: "Nº de batidas de DTF",
  n_batidas_silk: "Nº de batidas de Silk",
  dtf_pessoas_qtd: "Nº de pessoas no DTF",
  refacoes: "Refações",
  acabamento_observacao: "Observação do acabamento",
  arte_observacao: "Observação da arte",
  dtf_observacao: "Observação do DTF",
  silk_observacao: "Observação do Silk",
  observacoes_pedido: "Observações do pedido",
  obs_vendedor: "Observação do vendedor",
  historico_data_entrega: "Alterações na data de entrega",
  pecas_solicitadas: "Peças solicitadas",
  pecas_completadas_log: "Registro de peças concluídas",
  arte_warning: "Alerta de atenção na arte",
  correcoes_etapa: "Correções de etapa",
  pecas_lisas: "Peças lisas",

  // ---------- map (produção / tinturaria / malharia / estoque / devoluções) ----------
  numero: "Número",
  data_pedido: "Data do pedido",
  faturar_para: "Faturar para",
  fornecedor: "Fornecedor",
  kg_solicitados: "Kg solicitados",
  nota_fiscal: "Nota fiscal",
  data_faturamento: "Data do faturamento",
  data_pagamento: "Data do pagamento",
  status: "Status",
  malharia: "Malharia",
  quebra_conciliada: "Quebra conciliada",
  finalizado: "Finalizado",
  status_malharia: "Status da malharia",
  tinturaria: "Tinturaria",
  data_programacao: "Data da programação",
  pecas: "Peças",
  cor: "Cor",
  kg_enviados: "Kg enviados",
  kg_recebidos: "Kg recebidos",
  pecas_recebidas: "Peças recebidas",
  data_recebimento: "Data de recebimento",
  nota_fiscal_1: "Nota fiscal 1",
  nota_fiscal_2: "Nota fiscal 2",
  nota_cobertura: "Nota de cobertura",
  kg: "Kg",
  programacao_id: "Programação vinculada",
  producao_id: "Produção vinculada",
  numero_peca: "Nº da peça",
  data_entrada: "Data de entrada",
  data_abertura: "Data de abertura",
  alt_inicial: "Altura inicial (m)",
  cortes: "Cortes",
  faturado_para: "Faturado para",
  data_devolucao: "Data de devolução",
  obs: "Observação",
  observacoes: "Observações",

  // ---------- cop ----------
  solicitacao_risco: "Solicitação de risco",
  execucao_risco: "Execução do risco",
  solicitacao_corte: "Solicitação de corte",
  execucao_corte: "Execução do corte",
  observacoes_corte: "Observação do corte",
  cop_pai_id: "COP pai",
  corte_dividido: "Corte dividido",
  oficina_id: "Oficina",
  data_saida_oficina: "Saída da oficina",
  num_fretes: "Nº de fretes",
  romaneio_enviado_em: "Romaneio enviado em",
  letra: "Letra",
  conferido_em: "Conferido em",
  conferencia: "Conferência",
  pagamento_status: "Status do pagamento",
  pagamento_liberado_em: "Pagamento liberado em",
  pagamento_pago_em: "Pagamento pago em",
  pagamento_valor_calculado: "Valor do pagamento",
  perdas: "Perdas",
  observacoes_pagamento: "Observação do pagamento",
  historico_recebimentos: "Recebimentos",
  corte_em_correcao: "Corte em correção",
  pagamento_consolidado_id: "Pagamento consolidado (vínculo)",
  refacao_perda_origem_id: "Refação de perda (origem)",
  refacao_perda_itens: "Peças refeitas",

  // ---------- oficinas ----------
  nome: "Nome",
  cnpj_cpf: "CNPJ/CPF",
  endereco: "Endereço",
  cep: "CEP",
  valor_frete: "Valor do frete",
  valores_por_modelo: "Valores por modelo",
  cnpj: "CNPJ",
  cpf: "CPF",
  telefone: "Telefone",

  // ---------- cop_perdas ----------
  etiqueta: "Etiqueta",
  modelo: "Modelo",
  tamanho: "Tamanho",
  motivo: "Motivo",
  registrado_por: "Registrado por",

  // ---------- pagamentos_consolidados ----------
  detalhes: "Detalhes",
  valor_total: "Valor total",
  observacao: "Observação",
  pago_por: "Pago por",
  pago_em: "Pago em",

  // ---------- SUP ----------
  preco_tabela: "Preço de tabela",
  preco_negociado: "Preço negociado",
  fornecedor_id: "Fornecedor",
  grupo_id: "Item equivalente",
  fator_conversao: "Fator de conversão",
  anulado: "Anulado",
  anulado_motivo: "Motivo da anulação",
  anulado_por: "Anulado por",
  anulado_em: "Anulado em",
  comissionado_id: "Comissionado",
  unidade_referencia: "Unidade de referência",
  razao_social: "Razão social",
  nome_fantasia: "Nome fantasia",
  preco_anterior: "Preço anterior",
  preco_novo: "Preço novo",
  direcao: "Direção",
  preco_referencia: "Preço de referência",
  quantidade_minima: "Quantidade mínima",
  prazo_entrega_dias: "Prazo de entrega (dias)",
  condicao_pagamento: "Condição de pagamento",
  frete_valor: "Valor do frete",
  economia_total: "Economia total",
  valor_comissao: "Valor da comissão",
  competencia: "Competência",
};

export function labelCampo(campo: string): string {
  return LABELS[campo] ?? campo;
}

// Campos onde "Sim" significa "Concluído" e "Não/vazio" significa "Pendente".
const CAMPOS_EXECUCAO = new Set<string>([
  "embalado",
  "dtf_estampado",
  "dtf_impresso",
  "dtf_executado",
  "dtf_cortado",
  "silk_feito",
  "fotolito_impresso",
  "fotolito_executado",
  "tela_gravada",
  "vetorizacao_executada",
  "vetorizacao_dtf",
  "vetorizacao_silk",
  "nf_emitida",
  "exp_cobranca_pagamento",
  "exp_pagamento",
  "exp_etiqueta",
  "exp_frete_solicitado",
  "exp_despachado",
]);

// Campos onde o valor é um texto longo/URL — mostrar "(texto atualizado)".
const CAMPOS_TEXTO_LONGO = new Set<string>([
  "layout_url",
  "observacoes",
  "obs",
  "arte_observacao",
  "dtf_observacao",
  "silk_observacao",
  "acabamento_observacao",
  "exp_observacoes",
  "observacoes_pedido",
  "observacoes_corte",
  "observacoes_pagamento",
  "observacao",
  "obs_vendedor",
]);

// Campos jsonb — mostrar resumo em vez de despejar JSON.
const CAMPOS_LISTA: Record<string, string> = {
  cortes: "Cortes",
  refacoes: "Refações",
  pecas_completadas_log: "Peças concluídas",
  historico_recebimentos: "Recebimentos",
  perdas: "Perdas",
  pecas_solicitadas: "Peças solicitadas",
  pecas_lisas: "Peças lisas",
  detalhes: "Detalhes",
  valores_por_modelo: "Valores por modelo",
  historico_data_entrega: "Alterações na data de entrega",
  correcoes_etapa: "Correções de etapa",
  refacao_perda_itens: "Peças refeitas",
};

// Campos que são referências (UUIDs) — mostrar "(referência atualizada)" quando cru.
const CAMPOS_REFERENCIA = new Set<string>([
  "oficina_id",
  "cop_pai_id",
  "programacao_id",
  "producao_id",
  "pagamento_consolidado_id",
  "refacao_perda_origem_id",
  "registrado_por",
  "pago_por",
]);

// Sufixo/formato numérico por campo.
const CAMPOS_KG = new Set<string>(["kg", "kg_solicitados", "kg_enviados", "kg_recebidos"]);
const CAMPOS_METROS = new Set<string>(["alt_inicial"]);
const CAMPOS_MOEDA = new Set<string>(["valor_frete", "valor_total", "pagamento_valor_calculado"]);

const STATUS_PAGAMENTO: Record<string, string> = {
  aguardando: "Aguardando",
  liberado: "Liberado para pagamento",
  pago: "Pago",
};

function ehISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function ehISODateTime(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(s);
}
function fmtData(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}
function fmtDataHora(s: string): string {
  try {
    const d = new Date(s);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return s;
  }
}
function fmtNumBR(n: number, casas = 2): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
}

/**
 * Formata um valor de auditoria em texto legível.
 * Retorna { texto, tituloCompleto? } — o segundo é usado como tooltip
 * quando o valor foi resumido (jsonb, texto longo).
 */
export function formatValor(campo: string, v: Json): { texto: string; titulo?: string } {
  if (v === null || v === undefined || v === "") return { texto: "—" };

  // Alerta especial: arte_warning
  if (campo === "arte_warning") {
    const truthy = v === true || v === "true" || v === "sim" || v === "Sim";
    return { texto: truthy ? "Ativo" : "Removido" };
  }

  // Booleanos "de execução" → Concluído / Pendente
  if (CAMPOS_EXECUCAO.has(campo)) {
    const truthy =
      v === true ||
      v === "true" ||
      (typeof v === "string" && v.toLowerCase() === "sim");
    return { texto: truthy ? "Concluído" : "Pendente" };
  }

  // Booleanos genéricos
  if (typeof v === "boolean") return { texto: v ? "Sim" : "Não" };

  // Números
  if (typeof v === "number") {
    if (CAMPOS_KG.has(campo)) return { texto: `${fmtNumBR(v, 2)} kg` };
    if (CAMPOS_METROS.has(campo)) return { texto: `${fmtNumBR(v, 2)} m` };
    if (CAMPOS_MOEDA.has(campo)) return { texto: `R$ ${fmtNumBR(v, 2)}` };
    return { texto: String(v) };
  }

  // Strings
  if (typeof v === "string") {
    // Status de pagamento
    if (campo === "pagamento_status") {
      return { texto: STATUS_PAGAMENTO[v.toLowerCase()] ?? v };
    }
    // sim/não literais em string
    const low = v.toLowerCase();
    if (low === "sim" || low === "true") return { texto: "Sim" };
    if (low === "não" || low === "nao" || low === "false") return { texto: "Não" };

    // Datas
    if (ehISODateTime(v)) return { texto: fmtDataHora(v) };
    if (ehISODate(v)) return { texto: fmtData(v) };

    // UUID cru em campo de referência
    if (CAMPOS_REFERENCIA.has(campo) && /^[0-9a-f-]{20,}$/i.test(v)) {
      return { texto: "(referência atualizada)" };
    }

    // Texto longo
    if (CAMPOS_TEXTO_LONGO.has(campo) || v.length > 60) {
      return { texto: "(texto atualizado)", titulo: v };
    }
    return { texto: v };
  }

  // Arrays / objetos (jsonb)
  if (Array.isArray(v)) {
    const rotulo = CAMPOS_LISTA[campo] ?? "Lista";
    const titulo = safeStringify(v);
    return {
      texto: v.length === 0 ? `(sem ${rotulo.toLowerCase()})` : `(${v.length} ${v.length === 1 ? "item" : "itens"})`,
      titulo,
    };
  }
  if (typeof v === "object") {
    const titulo = safeStringify(v);
    return { texto: "(atualizado)", titulo };
  }

  return { texto: String(v) };
}

function safeStringify(v: unknown): string {
  try {
    const s = JSON.stringify(v, null, 2);
    return s.length > 2000 ? s.slice(0, 2000) + "…" : s;
  } catch {
    return String(v);
  }
}
