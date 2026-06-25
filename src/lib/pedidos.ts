import type { Tables, TablesInsert } from "@/integrations/supabase/types";

// Tipo Pedido reflete o schema após Phase 2 (DB renomeado e colunas extras).
// `types.ts` é gerado automaticamente — fazemos o merge aqui até regenerar.
type PedidoBase = Omit<Tables<"pedidos">, "modelo_estampa" | "status">;

export type RefacaoRetratoEtapa = {
  etapa: "Arte" | "DTF" | "Silk" | "Acabamento";
  data: string | null;
  responsavel: string | null;
};

export type RefacaoRetrato = {
  entrada_pedido: string | null;
  saida_juff: string | null;
  etapas_concluidas: RefacaoRetratoEtapa[];
  /** Snapshot completo de todos os campos que foram apagados pela refação. */
  campos_apagados?: Record<string, any>;
};

export type PecaPerdida = {
  modelo: string;
  cor: string;     // nome (chave em REFACAO_CORES)
  tamanho: string;
  qtd: number;
};

export const REFACAO_MODELOS = [
  "Camiseta", "Baby Look", "Regata Masculina", "Regata Feminina",
  "ML Masculina", "ML Feminina", "Camiseta Infantil", "ML Infantil",
  "Regata Cross", "Regata Wing", "Regata Move",
  "ML Hide Masculina", "ML Hide Feminina", "ML Hide Infantil",
] as const;

export const REFACAO_TAMANHOS = ["PP", "P", "M", "G", "GG", "EXG", "EXXG"] as const;

export const REFACAO_CORES: { nome: string; hex: string }[] = [
  { nome: "amarelo",        hex: "#ffe938" },
  { nome: "amarelo flúor",  hex: "#e0ff00" },
  { nome: "azul índigo",    hex: "#4d6694" },
  { nome: "bordô",          hex: "#551b2a" },
  { nome: "branco",         hex: "#f6f6fb" },
  { nome: "cinza chumbo",   hex: "#353439" },
  { nome: "cinza claro",    hex: "#585858" },
  { nome: "fúcsia",         hex: "#870065" },
  { nome: "laranja",        hex: "#e36837" },
  { nome: "laranja ultra",  hex: "#fd5f2f" },
  { nome: "marinho",        hex: "#1d2546" },
  { nome: "menta",          hex: "#93a393" },
  { nome: "pink",           hex: "#b7357a" },
  { nome: "preto",          hex: "#212120" },
  { nome: "roial",          hex: "#323db8" },
  { nome: "rosa flúor",     hex: "#f51eb1" },
  { nome: "rosa pop",       hex: "#e0418e" },
  { nome: "roxo",           hex: "#8354b5" },
  { nome: "roxo ultra",     hex: "#533189" },
  { nome: "turquesa",       hex: "#1581ae" },
  { nome: "verde água",     hex: "#a1e1d9" },
  { nome: "verde bandeira", hex: "#2e572d" },
  { nome: "verde militar",  hex: "#2a352a" },
  { nome: "vermelho",       hex: "#c12b3d" },
];

export type RefacaoEpisodio = {
  etapa_origem: string;
  etapa_destino: "dados" | "arte" | "dtf" | "silk" | "acabamento";
  data: string;            // ISO
  quem: string | null;     // uuid do usuário logado
  pecas_refazer: number;
  perda_pecas: number;
  perda_adesivos: number;
  pecas_extras?: number;   // apenas quando destino === "dados"
  pecas_perdidas?: PecaPerdida[];
  motivo: string;
  aberto: boolean;
  /** Marcado como true quando o pedido passou pela etapa de destino
   *  após o início da refação. Só com isso o auto-fechamento pode encerrar. */
  visitou_destino?: boolean;
  retrato?: RefacaoRetrato;
};

export const ETAPA_DESTINO_LABEL: Record<RefacaoEpisodio["etapa_destino"], string> = {
  dados: "Dados In",
  arte: "Arte",
  dtf: "DTF",
  silk: "Silk",
  acabamento: "Acabamento",
};

export type Pedido = PedidoBase & {
  tipo_estampa: string;
  status_pecas: string;
  reaberto: boolean;
  data_entrega: string | null;
  uf_entrega: string | null;
  necessita_vetorizacao: boolean | null;
  vetorizacao_executada: boolean | null;
  vetorizacao_dtf: string | null;
  vetorizacao_silk: string | null;
  dtf_cortado: string | null;
  dtf_cortado_data: string | null;
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
  nf_emitida: string | null;
  expedicao_entrou_em: string | null;
  exp_cobranca_pagamento: boolean | null;
  exp_pagamento: boolean | null;
  exp_etiqueta: boolean | null;
  exp_frete_solicitado: boolean | null;
  exp_despachado: boolean | null;
  exp_despachado_em: string | null;
  exp_frete_solicitado_em: string | null;
  exp_observacoes: string | null;
  data_entrega_proposta: string | null;
  data_entrega_proposta_em: string | null;
  data_entrega_proposta_por: string | null;
  // A1-A11
  dias_secagem: number | null;
  inicio_acabamento: string | null;
  termino_acabamento: string | null;
  n_batidas_dtf: number | null;
  n_batidas_silk: number | null;
  quem_cortou_dtf: string | null;
  quem_revelou_tela: string | null;
  dtf_pessoas_qtd: Record<string, number> | null;
  // Refação (Etapa 1)
  refacoes: RefacaoEpisodio[] | null;
};

type PedidoInsertBase = Omit<TablesInsert<"pedidos">, "modelo_estampa" | "status">;
export type PedidoInsert = PedidoInsertBase & {
  tipo_estampa: string;
  status_pecas?: string;
  reaberto?: boolean;
  data_entrega?: string | null;
  uf_entrega?: string | null;
  necessita_vetorizacao?: boolean | null;
  vetorizacao_executada?: boolean | null;
  vetorizacao_dtf?: string | null;
  vetorizacao_silk?: string | null;
  dtf_cortado?: string | null;
  dtf_cortado_data?: string | null;
  obs_vendedor?: string | null;
  layout_url?: string | null;
  status_arte?: string | null;
  quem_bateu_dtf?: string | null;
  quem_bateu_silk?: string | null;
  responsavel_acabamento?: string | null;
  finalizado_em?: string | null;
  tempo_producao?: number | null;
  forma_pagamento?: string | null;
  nf_emitida?: string | null;
  expedicao_entrou_em?: string | null;
  exp_cobranca_pagamento?: boolean | null;
  exp_pagamento?: boolean | null;
  exp_etiqueta?: boolean | null;
  exp_frete_solicitado?: boolean | null;
  exp_despachado?: boolean | null;
  exp_despachado_em?: string | null;
  exp_frete_solicitado_em?: string | null;
  exp_observacoes?: string | null;
  data_entrega_proposta?: string | null;
  data_entrega_proposta_em?: string | null;
  data_entrega_proposta_por?: string | null;
  dias_secagem?: number | null;
  inicio_acabamento?: string | null;
  termino_acabamento?: string | null;
  n_batidas_dtf?: number | null;
  n_batidas_silk?: number | null;
  quem_cortou_dtf?: string | null;
  quem_revelou_tela?: string | null;
  dtf_pessoas_qtd?: Record<string, number> | null;
  refacoes?: RefacaoEpisodio[] | null;
};

export const VENDEDORES = ["Wander", "Mirela", "Gabriel", "Outros"] as const;
export const STATUS_PECAS_OPCOES = ["completo", "incompleto"] as const;
export const FORMAS_PAGAMENTO = ["Cartão de crédito", "50%/50%", "Boleto", "À vista"] as const;
export const TIPOS_ESTAMPA = ["DTF", "Silk", "DTF+Silk", "Lisa"] as const;
export const SIM_NAO_PROCESSO = ["Sim", "Não", "Em processo"] as const;
export const SIM_NAO = ["Sim", "Não"] as const;
export const STATUS_ARTE_OPCOES = ["Em andamento", "Imprimindo", "Aprovar Amostra", "Arte Finalizada"] as const;
export const VETOR_OPCOES = ["Sim", "Não", "Não se aplica"] as const;
export const OK_OPCOES = ["Sim", "Não", "N/A"] as const;
export const RESPONSAVEIS_ACABAMENTO = ["Vanessa", "Patrícia", "Juliana", "Outros"] as const;
export const QUEM_BATEU_DTF = ["Jefferson", "Sarah", "Rubens", "Outros"] as const;
export const QUEM_BATEU_SILK = ["Gleisson", "Marcelo", "Outros"] as const;
export const UFS = [
  "SP","AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SE","TO",
] as const;

// Aliases para retrocompatibilidade com abas ainda não migradas.
export const STATUS_OPCOES = STATUS_PECAS_OPCOES;
export const STATUS_GERAL_OPCOES = STATUS_PECAS_OPCOES;
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

// ---------- Helpers da Arte (lado independente) ----------
export function dtfFinalizadoArte(p: Pedido): boolean {
  return p.dtf_impresso === "Sim" && p.dtf_cortado === "Sim"
    && !!p.dtf_executado && !!p.dtf_cortado_data;
}
export function fotolitoFinalizadoArte(p: Pedido): boolean {
  return p.fotolito_impresso === "Sim" && !!p.fotolito_executado;
}
export function vetorDtfResolvida(p: Pedido): boolean {
  if (!p.necessita_vetorizacao) return true;
  return p.vetorizacao_dtf === "Sim" || p.vetorizacao_dtf === "Não" || p.vetorizacao_dtf === "Não se aplica";
}
export function vetorSilkResolvida(p: Pedido): boolean {
  if (!p.necessita_vetorizacao) return true;
  return p.vetorizacao_silk === "Sim" || p.vetorizacao_silk === "Não" || p.vetorizacao_silk === "Não se aplica";
}
export function ladoDtfPronto(p: Pedido): boolean {
  return vetorDtfResolvida(p) && dtfFinalizadoArte(p);
}
export function ladoSilkPronto(p: Pedido): boolean {
  return vetorSilkResolvida(p) && fotolitoFinalizadoArte(p);
}
export function dtfFinalizadoLabel(p: Pedido): string {
  if (!tipoIncluiDTF(p.tipo_estampa)) return "—";
  if (p.dtf_impresso !== "Sim") return "Aguardando impressão";
  if (p.dtf_cortado !== "Sim") return "Aguardando corte";
  return "Finalizado";
}
export function fotolitoFinalizadoLabel(p: Pedido): string {
  if (!tipoIncluiSilk(p.tipo_estampa)) return "—";
  if (p.fotolito_impresso !== "Sim") return "Aguardando impressão";
  if (!p.fotolito_executado) return "Aguardando data";
  return "Finalizado";
}



export function calcularEtapaAtual(p: Pedido): {
  etapa: string;
  percentual: number;
  cor: "green" | "yellow" | "red" | "gray" | "blue";
} {
  return calcularEtapaInterno(p, false);
}

/** Cálculo "natural" da etapa, ignorando episódio aberto. Uso interno. */
export function calcularEtapaNatural(p: Pedido): {
  etapa: string;
  percentual: number;
  cor: "green" | "yellow" | "red" | "gray" | "blue";
} {
  return calcularEtapaInterno(p, true);
}

function calcularEtapaInterno(p: Pedido, _ignorarEpisodioAberto: boolean): {
  etapa: string;
  percentual: number;
  cor: "green" | "yellow" | "red" | "gray" | "blue";
} {
  const tipo = p.tipo_estampa;
  const isLisa = tipo === "Lisa";

  const dadosInOk = !!p.pedido_olist;
  const dtfArteOk = !tipoIncluiDTF(tipo) || ladoDtfPronto(p);
  const silkArteOk = !tipoIncluiSilk(tipo) || ladoSilkPronto(p);
  const arteOk = dtfArteOk && silkArteOk;
  const dtfDone = p.dtf_estampado === "Sim";
  const silkDone = p.silk_feito === "Sim";
  const acabamentoOk = p.embalado === "Sim";
  const producaoInputOk = notEmpty(p.status_pecas) && notEmpty(p.tipo_estampa);

  const etapas = isLisa
    ? [dadosInOk, acabamentoOk]
    : ([dadosInOk, arteOk, tipoIncluiDTF(tipo) ? dtfDone : null, tipoIncluiSilk(tipo) ? silkDone : null, acabamentoOk].filter(
        (v) => v !== null,
      ) as boolean[]);
  const completas = etapas.filter(Boolean).length;
  const percentual = Math.round((completas / etapas.length) * 100);

  let etapa = "Aguardando entrada";
  let cor: "green" | "yellow" | "red" | "gray" | "blue" = "gray";

  if (p.finalizado_em) {
    etapa = "Finalizado"; cor = "green";
  } else if (acabamentoOk) {
    etapa = "Aguardando Expedição"; cor = "blue";
  } else if (!dadosInOk) {
    etapa = "Aguardando entrada"; cor = "gray";
  } else if (!producaoInputOk) {
    etapa = "Aguardando input de produção"; cor = "yellow";
  } else if (isLisa) {
    const lisaPronta = p.status_pecas === "completo" && notEmpty(p.inicio_acabamento) && notEmpty(p.termino_acabamento);
    if (lisaPronta) { etapa = "Aguardando Acabamento"; cor = "blue"; }
    else { etapa = "Aguardando input de produção"; cor = "yellow"; }
  } else if (!arteOk) {
    if (tipo === "DTF+Silk" && dtfArteOk && !silkArteOk) {
      etapa = "DTF Liberado / Silk na Arte"; cor = "blue";
    } else if (tipo === "DTF+Silk" && silkArteOk && !dtfArteOk) {
      etapa = "Silk Liberado / DTF na Arte"; cor = "blue";
    } else {
      etapa = "Aguardando Arte"; cor = "blue";
    }
  } else {
    const needDTF = tipoIncluiDTF(tipo) && !dtfDone;
    const needSilk = tipoIncluiSilk(tipo) && !silkDone;
    if (needDTF && needSilk) { etapa = "Aguardando DTF + Silk"; cor = "yellow"; }
    else if (needDTF) { etapa = "Aguardando DTF"; cor = "yellow"; }
    else if (needSilk) { etapa = "Aguardando Silk"; cor = "yellow"; }
    else { etapa = "Aguardando Acabamento"; cor = "blue"; }
  }

  const refs = Array.isArray(p.refacoes) ? p.refacoes : [];
  if (refs.length > 0 && etapa !== "Finalizado") etapa = `${etapa}${"*".repeat(refs.length)}`;
  return { etapa, percentual, cor };
}


/** Episódio em aberto (se houver). */
export function episodioAberto(p: Pedido): RefacaoEpisodio | null {
  const refs = Array.isArray(p.refacoes) ? p.refacoes : [];
  return refs.find((e) => e.aberto) ?? null;
}
export function temEpisodioAberto(p: Pedido): boolean {
  return !!episodioAberto(p);
}

/** Etapa atual (label) sem o sufixo de asteriscos. */
export function etapaAtualSemAsterisco(p: Pedido): string {
  return calcularEtapaAtual(p).etapa.replace(/\*+$/, "");
}

/** Total de produção: qtd original + soma de peças perdidas dos episódios. */
export function totalProducao(p: Pedido): { total: number; original: number; extras: number } {
  const original = Number(p.qtd ?? 0) || 0;
  const refs = Array.isArray(p.refacoes) ? p.refacoes : [];
  const extras = refs.reduce((a, e) => a + (Number(e.perda_pecas ?? 0) || 0), 0);
  return { total: original + extras, original, extras };
}

/** Etapas naturais associadas a cada destino de refação. */
const DESTINO_ETAPAS_NATURAIS: Record<RefacaoEpisodio["etapa_destino"], string[]> = {
  dados: ["Aguardando entrada", "Aguardando input de produção", "Aguardando Dados In"],
  arte: ["Aguardando Arte", "DTF Liberado / Silk na Arte", "Silk Liberado / DTF na Arte"],
  dtf: ["Aguardando DTF", "Aguardando DTF + Silk"],
  silk: ["Aguardando Silk", "Aguardando DTF + Silk"],
  acabamento: ["Aguardando Acabamento"],
};

/**
 * Retorna `refacoes` atualizadas:
 * 1) Marca `visitou_destino=true` quando a etapa natural cai na etapa do destino.
 * 2) Só fecha o episódio quando a etapa natural voltou para `etapa_origem`
 *    E o pedido já passou pelo destino (visitou_destino).
 * Retorna null quando nada muda.
 */
export function fecharEpisodiosResolvidos(p: Pedido): RefacaoEpisodio[] | null {
  const refs = Array.isArray(p.refacoes) ? p.refacoes : [];
  if (refs.length === 0) return null;
  const etapaNatural = calcularEtapaNatural(p).etapa.replace(/\*+$/, "");
  let changed = false;
  const next = refs.map((e) => {
    if (!e.aberto) return e;
    const destinos = DESTINO_ETAPAS_NATURAIS[e.etapa_destino] ?? [];
    let merged = e;
    if (!e.visitou_destino && destinos.includes(etapaNatural)) {
      merged = { ...e, visitou_destino: true };
      changed = true;
    }
    if (merged.visitou_destino && merged.etapa_origem === etapaNatural) {
      changed = true;
      return { ...merged, aberto: false };
    }
    return merged;
  });
  return changed ? next : null;
}

export type SetorAtraso = "arte" | "dtf" | "silk" | "acabamento" | "expedicao";

/** Compara YYYY-MM-DD com hoje (sem horas). True se já passou da data. */
function dataNoPassado(date: string | null | undefined): boolean {
  if (!date) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(date + "T00:00:00");
  return d.getTime() < hoje.getTime();
}

/** True quando a etapa do setor está atrasada (data-limite passada e não concluída). */
export function isAtrasadoSetor(p: Pedido, setor: SetorAtraso): boolean {
  if (p.finalizado_em) return false;
  switch (setor) {
    case "arte":
      return dataNoPassado(p.arte_data) && p.status_arte !== "Arte Finalizada";
    case "dtf":
      return tipoIncluiDTF(p.tipo_estampa) && dataNoPassado(p.inicio_estamparia) && p.dtf_estampado !== "Sim";
    case "silk":
      return tipoIncluiSilk(p.tipo_estampa) && dataNoPassado(p.inicio_estamparia) && p.silk_feito !== "Sim";
    case "acabamento":
      return dataNoPassado(p.saida_juff) && p.embalado !== "Sim";
    case "expedicao":
      return dataNoPassado(p.saida_juff) && !p.finalizado_em;
  }
}


export function statusPrazo(p: Pedido): "ok" | "aviso" | "atrasado" | "neutro" {
  const ref = p.saida_juff;
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

export function pedidoAtivoNasAreas(p: Pedido): boolean {
  if (p.finalizado_em) return false;
  if (p.reaberto) return true;
  return !p.expedicao_entrou_em;
}

export function sortByDataSaidaJuffAsc<T extends { data_saida_juff?: string | null }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const av = a.data_saida_juff ?? "9999-12-31";
    const bv = b.data_saida_juff ?? "9999-12-31";
    return av.localeCompare(bv);
  });
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
  // Arte agora avança por lado, independente de status_arte
  if (tipoIncluiDTF(p.tipo_estampa) && !ladoDtfPronto(p)) return false;
  if (tipoIncluiSilk(p.tipo_estampa) && !ladoSilkPronto(p)) return false;
  return true;
}
export function arteAlgumPreenchido(p: Pedido): boolean {
  return notEmpty(p.status_arte) || notEmpty(p.dtf_impresso) || notEmpty(p.fotolito_impresso) ||
    notEmpty(p.dtf_executado) || notEmpty(p.fotolito_executado) || notEmpty(p.arte_observacao) ||
    notEmpty(p.dtf_cortado) || notEmpty(p.dtf_cortado_data) ||
    notEmpty(p.vetorizacao_dtf) || notEmpty(p.vetorizacao_silk) ||
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

