import type { Tables, TablesInsert } from "@/integrations/supabase/types";

// Tipo Pedido reflete o schema após Phase 2 (DB renomeado e colunas extras).
// `types.ts` é gerado automaticamente — fazemos o merge aqui até regenerar.
type PedidoBase = Omit<Tables<"pedidos">, "modelo_estampa" | "status">;
export type Pedido = PedidoBase & {
  tipo_estampa: string;
  status_geral: string;
  data_entrega: string | null;
  uf_entrega: string | null;
  necessita_vetorizacao: boolean | null;
  vetorizacao_executada: boolean | null;
  obs_vendedor: string | null;
  layout_url: string | null;
  status_arte: string | null;
  quem_bateu_dtf: string | null;
  quem_bateu_silk: string | null;
  responsavel_acabamento: string | null;
  finalizado_em: string | null;
  tempo_producao: number | null;
  // v2
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

type PedidoInsertBase = Omit<TablesInsert<"pedidos">, "modelo_estampa" | "status">;
export type PedidoInsert = PedidoInsertBase & {
  tipo_estampa: string;
  status_geral?: string;
  data_entrega?: string | null;
  uf_entrega?: string | null;
  necessita_vetorizacao?: boolean | null;
  vetorizacao_executada?: boolean | null;
  obs_vendedor?: string | null;
  layout_url?: string | null;
  status_arte?: string | null;
  quem_bateu_dtf?: string | null;
  quem_bateu_silk?: string | null;
  responsavel_acabamento?: string | null;
  finalizado_em?: string | null;
  tempo_producao?: number | null;
  forma_pagamento?: string | null;
  nf_emitida?: boolean | null;
  expedicao_entrou_em?: string | null;
  exp_cobranca_pagamento?: boolean | null;
  exp_pagamento?: boolean | null;
  exp_etiqueta?: boolean | null;
  exp_frete_solicitado?: boolean | null;
  exp_despachado?: boolean | null;
  exp_despachado_em?: string | null;
  exp_observacoes?: string | null;
};

export const VENDEDORES = ["Wander", "Mirela", "Gabriel", "Outros"] as const;
export const STATUS_GERAL_OPCOES = ["aberto", "completo"] as const;
export const FORMAS_PAGAMENTO = ["Cartão de crédito", "50%/50%", "Boleto", "À vista"] as const;
export const TIPOS_ESTAMPA = ["DTF", "Silk", "DTF+Silk", "Lisa"] as const;
export const SIM_NAO_PROCESSO = ["Sim", "Não", "Em processo"] as const;
export const SIM_NAO = ["Sim", "Não"] as const;
export const STATUS_ARTE_OPCOES = ["Imprimindo", "Aprovar Amostra", "Arte Finalizada"] as const;
export const OK_OPCOES = ["Sim", "Não", "N/A"] as const;
export const RESPONSAVEIS_ACABAMENTO = ["Vanessa", "Patrícia", "Juliana", "Outros"] as const;
export const QUEM_BATEU_DTF = ["Jefferson", "Sarah", "Rubens", "Outros"] as const;
export const QUEM_BATEU_SILK = ["Gleisson", "Marcelo", "Outros"] as const;
export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

// Aliases para retrocompatibilidade com abas ainda não migradas.
export const STATUS_OPCOES = STATUS_GERAL_OPCOES;
export const MODELOS_ESTAMPA = TIPOS_ESTAMPA;
export const RESPONSAVEIS = RESPONSAVEIS_ACABAMENTO;
export const PEDIDO_OK_OPCOES = STATUS_ARTE_OPCOES;

export function tipoIncluiDTF(tipo: string | null | undefined) {
  return tipo === "DTF" || tipo === "DTF+Silk";
}
export function tipoIncluiSilk(tipo: string | null | undefined) {
  return tipo === "Silk" || tipo === "DTF+Silk";
}
export const modeloIncluiDTF = tipoIncluiDTF;
export const modeloIncluiSilk = tipoIncluiSilk;

export function calcularEtapaAtual(p: Pedido): {
  etapa: string;
  percentual: number;
  cor: "green" | "yellow" | "red" | "gray" | "blue";
} {
  const tipo = p.tipo_estampa;
  const isLisa = tipo === "Lisa";

  const dadosInOk = !!p.pedido_olist;
  const arteOk = p.status_arte === "Arte Finalizada";
  const dtfDone = p.dtf_estampado === "Sim";
  const silkDone = p.silk_feito === "Sim";
  const acabamentoOk = p.embalado === "Sim";
  const producaoInputOk = notEmpty(p.arte_data);

  const etapas = isLisa
    ? [dadosInOk, acabamentoOk]
    : ([dadosInOk, arteOk, tipoIncluiDTF(tipo) ? dtfDone : null, tipoIncluiSilk(tipo) ? silkDone : null, acabamentoOk].filter(
        (v) => v !== null,
      ) as boolean[]);
  const completas = etapas.filter(Boolean).length;
  const percentual = Math.round((completas / etapas.length) * 100);

  let etapa = "Aguardando entrada";
  let cor: "green" | "yellow" | "red" | "gray" | "blue" = "gray";

  if (p.finalizado_em || acabamentoOk) {
    etapa = "Finalizado"; cor = "green";
  } else if (!dadosInOk) {
    etapa = "Aguardando entrada"; cor = "gray";
  } else if (!isLisa && !producaoInputOk) {
    etapa = "Aguardando input de produção"; cor = "yellow";
  } else if (isLisa) {
    etapa = "Aguardando Acabamento"; cor = "blue";
  } else if (!arteOk) {
    etapa = "Aguardando Arte"; cor = "blue";
  } else {
    const needDTF = tipoIncluiDTF(tipo) && !dtfDone;
    const needSilk = tipoIncluiSilk(tipo) && !silkDone;
    if (needDTF && needSilk) { etapa = "Aguardando DTF + Silk"; cor = "yellow"; }
    else if (needDTF) { etapa = "Aguardando DTF"; cor = "yellow"; }
    else if (needSilk) { etapa = "Aguardando Silk"; cor = "yellow"; }
    else { etapa = "Aguardando Acabamento"; cor = "blue"; }
  }

  return { etapa, percentual, cor };
}

export function statusPrazo(p: Pedido): "ok" | "aviso" | "atrasado" | "neutro" {
  const ref = p.data_entrega ?? p.saida_juff;
  if (!ref) return "neutro";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(ref + "T00:00:00");
  const diff = (alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24);
  if (p.embalado === "Sim") return "ok";
  if (diff < 0) return "atrasado";
  if (diff <= 2) return "aviso";
  return "ok";
}

export function diasAte(date: string | null | undefined): number | null {
  if (!date) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(date + "T00:00:00");
  return Math.round((d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------- Helpers de completude por etapa ----------

function notEmpty(v: any) {
  return v !== null && v !== undefined && v !== "";
}

export function dadosInCompletos(p: Pedido): boolean {
  return (
    notEmpty(p.pedido_olist) && notEmpty(p.orcamento) && notEmpty(p.qtd) &&
    notEmpty(p.vendedor) && notEmpty(p.frete) && notEmpty(p.tempo_frete) &&
    notEmpty(p.tipo_estampa) && notEmpty(p.entrada_pedido) && notEmpty(p.uf_entrega)
  );
}

export function arteCompleta(p: Pedido): boolean {
  if (p.status_arte !== "Arte Finalizada") return false;
  if (tipoIncluiDTF(p.tipo_estampa) && (p.dtf_impresso !== "Sim" || !notEmpty(p.dtf_executado))) return false;
  if (tipoIncluiSilk(p.tipo_estampa) && (p.fotolito_impresso !== "Sim" || !notEmpty(p.fotolito_executado))) return false;
  if (p.necessita_vetorizacao && !p.vetorizacao_executada) return false;
  return true;
}
export function arteAlgumPreenchido(p: Pedido): boolean {
  return notEmpty(p.status_arte) || notEmpty(p.dtf_impresso) || notEmpty(p.fotolito_impresso) ||
    notEmpty(p.dtf_executado) || notEmpty(p.fotolito_executado) || notEmpty(p.arte_observacao) ||
    !!p.vetorizacao_executada;
}

export function dtfCompleto(p: Pedido): boolean {
  return p.dtf_estampado === "Sim" && notEmpty(p.dtf_data_executada) && notEmpty(p.quem_bateu_dtf);
}
export function dtfAlgumPreenchido(p: Pedido): boolean {
  return notEmpty(p.dtf_estampado) || notEmpty(p.dtf_data_executada) || notEmpty(p.quem_bateu_dtf) || notEmpty(p.dtf_observacao);
}

export function silkCompleto(p: Pedido): boolean {
  return p.tela_gravada === "Sim" && p.silk_feito === "Sim" && notEmpty(p.silk_data_executada) && notEmpty(p.quem_bateu_silk);
}
export function silkAlgumPreenchido(p: Pedido): boolean {
  return notEmpty(p.tela_gravada) || notEmpty(p.silk_feito) || notEmpty(p.silk_data_executada) || notEmpty(p.quem_bateu_silk) || notEmpty(p.silk_observacao);
}

export function acabamentoCompleto(p: Pedido): boolean {
  return p.embalado === "Sim" && notEmpty(p.data_saida_juff) && notEmpty(p.responsavel_acabamento) && !!p.finalizado_em;
}
export function acabamentoAlgumPreenchido(p: Pedido): boolean {
  return notEmpty(p.embalado) || notEmpty(p.data_saida_juff) || notEmpty(p.responsavel_acabamento) || notEmpty((p as any).responsavel_conferencia);
}

// Visibilidade nos dashboards das abas:
// Todos os pedidos em aberto aparecem em todas as áreas — as áreas precisam enxergar
// o que está por vir e o que já passou. Só DTF e Silk podem excluir pedidos pelo
// tipo_estampa (quando já estiver definido e não incluir aquela técnica).
export function visivelEmArte(_p: Pedido): boolean { return true; }
export function visivelEmDTF(p: Pedido): boolean {
  if (!p.tipo_estampa) return true; // tipo ainda não definido — mostrar
  if (p.tipo_estampa === "Lisa") return true;
  return tipoIncluiDTF(p.tipo_estampa);
}
export function visivelEmSilk(p: Pedido): boolean {
  if (!p.tipo_estampa) return true;
  if (p.tipo_estampa === "Lisa") return true;
  return tipoIncluiSilk(p.tipo_estampa);
}
export function visivelEmAcabamento(_p: Pedido): boolean { return true; }

export type EtapaStatus = "pendente" | "andamento" | "concluido";
export function statusEtapa(completo: boolean, algumPreenchido: boolean): EtapaStatus {
  if (completo) return "concluido";
  if (algumPreenchido) return "andamento";
  return "pendente";
}

