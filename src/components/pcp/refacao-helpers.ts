import { supabase } from "@/integrations/supabase/client";
import {
  ETAPA_DESTINO_LABEL,
  acabamentoCompleto,
  arteCompleta,
  dtfCompleto,
  episodioAberto,
  etapaAtualSemAsterisco,
  silkCompleto,
  tipoIncluiDTF,
  tipoIncluiSilk,
  type Pedido,
  type RefacaoEpisodio,
  type RefacaoRetrato,
  type RefacaoRetratoEtapa,
} from "@/lib/pedidos";
import type { RefacaoFormPayload } from "./RefacaoDialog";
import type { VoltarDestino } from "./VoltarDropdown";

/** Origem → label "humano" para o registro automático. */
const ORIGEM_LABEL: Record<string, string> = {
  "Aguardando Dados In": "Dados In",
  "Aguardando entrada": "Dados In",
  "Aguardando input de produção": "Dados In",
  "Aguardando Arte": "Arte",
  "DTF Liberado / Silk na Arte": "Arte",
  "Silk Liberado / DTF na Arte": "Arte",
  "Aguardando DTF": "DTF",
  "Aguardando Silk": "Silk",
  "Aguardando DTF + Silk": "DTF/Silk",
  "Aguardando Acabamento": "Acabamento",
  "Aguardando Expedição": "Expedição",
};

function origemHumano(label: string): string {
  return ORIGEM_LABEL[label] ?? label;
}

function fmtBR(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

function montarRetrato(p: Pedido): RefacaoRetrato {
  const etapas: RefacaoRetratoEtapa[] = [];
  if (arteCompleta(p)) {
    etapas.push({ etapa: "Arte", data: p.arte_data ?? null, responsavel: null });
  }
  if (tipoIncluiDTF(p.tipo_estampa) && dtfCompleto(p)) {
    etapas.push({ etapa: "DTF", data: p.dtf_data_executada ?? null, responsavel: p.quem_bateu_dtf ?? null });
  }
  if (tipoIncluiSilk(p.tipo_estampa) && silkCompleto(p)) {
    etapas.push({ etapa: "Silk", data: p.silk_data_executada ?? null, responsavel: p.quem_bateu_silk ?? null });
  }
  if (acabamentoCompleto(p)) {
    etapas.push({ etapa: "Acabamento", data: p.acabamento_data ?? null, responsavel: p.responsavel_acabamento ?? null });
  }
  return {
    entrada_pedido: p.entrada_pedido ?? null,
    saida_juff: p.saida_juff ?? null,
    etapas_concluidas: etapas,
  };
}

async function nomeUsuarioAtual(uuid: string | null): Promise<string> {
  if (!uuid) return "—";
  const { data } = await supabase.from("profiles").select("nome, email").eq("id", uuid).maybeSingle();
  return (data as any)?.nome || (data as any)?.email || uuid.slice(0, 8);
}

/**
 * Constrói o resultado de um Refazer:
 * - Se já há episódio aberto: apenas atualiza `etapa_destino`.
 * - Caso contrário: cria novo episódio com retrato.
 * Os dados da refação ficam apenas no array `refacoes` — não escreve em observações.
 */
export async function montarRefacoesAposRefazer(
  pedido: Pedido,
  destino: VoltarDestino,
  payload: RefacaoFormPayload | null,
): Promise<{ refacoes: RefacaoEpisodio[] }> {
  const refsAtuais: RefacaoEpisodio[] = Array.isArray(pedido.refacoes) ? pedido.refacoes : [];
  const aberto = episodioAberto(pedido);
  if (aberto) {
    const refacoes = refsAtuais.map((e) =>
      e === aberto ? { ...e, etapa_destino: destino } : e,
    );
    return { refacoes };
  }
  if (!payload) return { refacoes: refsAtuais };
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id ?? null;
  const origem = etapaAtualSemAsterisco(pedido);
  // Snapshot COMPLETO de todas as etapas (independente do destino do wipe).
  // Mantém registro de tudo que cada área já tinha assinalado antes da refação.
  const camposSnapshot: string[] = [
    // Input de produção
    "status_pecas", "tipo_estampa", "arte_data",
    "inicio_estamparia", "termino_estamparia",
    // Arte
    ...Object.keys(WIPE_ARTE_COMUM),
    ...Object.keys(WIPE_ARTE_DTF),
    ...Object.keys(WIPE_ARTE_SILK),
    // DTF / Silk / Acabamento / Expedição
    ...Object.keys(WIPE_DTF),
    ...Object.keys(WIPE_SILK),
    ...Object.keys(WIPE_ACABAMENTO),
  ];
  const camposApagados: Record<string, any> = {};
  for (const k of camposSnapshot) {
    const v = (pedido as any)[k];
    if (v !== null && v !== undefined && v !== "") camposApagados[k] = v;
  }
  const retrato: RefacaoRetrato = {
    ...montarRetrato(pedido),
    campos_apagados: camposApagados,
  };
  const novo: RefacaoEpisodio = {
    etapa_origem: origem,
    etapa_destino: destino,
    data: new Date().toISOString(),
    quem: uid,
    pecas_refazer: payload.pecas_refazer,
    perda_pecas: payload.perda_pecas,
    perda_adesivos: payload.perda_adesivos,
    motivo: payload.motivo,
    aberto: true,
    retrato,
  };
  return { refacoes: [...refsAtuais, novo] };
}

// ---------- Wipe de campos a partir do destino da refação ----------

type WipeDestino = "dados" | "arte" | "dtf" | "silk" | "acabamento";

const WIPE_ARTE_COMUM = {
  status_arte: null,
  arte_observacao: null,
  vetorizacao_executada: null,
} as const;
const WIPE_ARTE_DTF = {
  vetorizacao_dtf: null,
  dtf_impresso: null,
  dtf_executado: null,
  dtf_cortado: null,
  dtf_cortado_data: null,
} as const;
const WIPE_ARTE_SILK = {
  vetorizacao_silk: null,
  fotolito_impresso: null,
  fotolito_executado: null,
} as const;
const WIPE_DTF = {
  dtf_estampado: null,
  dtf_data_executada: null,
  quem_bateu_dtf: null,
  quem_cortou_dtf: null,
  n_batidas_dtf: null,
  dtf_pessoas_qtd: null,
  dtf_observacao: null,
} as const;
const WIPE_SILK = {
  tela_gravada: null,
  silk_feito: null,
  silk_data_executada: null,
  quem_bateu_silk: null,
  quem_revelou_tela: null,
  n_batidas_silk: null,
  silk_observacao: null,
} as const;
const WIPE_ACABAMENTO = {
  embalado: null,
  acabamento_data: null,
  data_saida_juff: null,
  responsavel_acabamento: null,
  responsavel_conferencia: null,
  inicio_acabamento: null,
  termino_acabamento: null,
  dias_secagem: null,
  finalizado_em: null,
  tempo_producao: null,
  expedicao_entrou_em: null,
  exp_cobranca_pagamento: null,
  exp_pagamento: null,
  exp_etiqueta: null,
  exp_frete_solicitado: null,
  exp_frete_solicitado_em: null,
  exp_despachado: null,
  exp_despachado_em: null,
  exp_observacoes: null,
} as const;
const WIPE_INPUT_PRODUCAO = {
  status_pecas: null,
  tipo_estampa: null,
  dias_secagem: null,
  n_batidas_dtf: null,
  n_batidas_silk: null,
  arte_data: null,
  inicio_estamparia: null,
  termino_estamparia: null,
  inicio_acabamento: null,
  termino_acabamento: null,
  tempo_producao: null,
} as const;

/**
 * Campos a apagar (status/data/responsável de execução) ao mandar o pedido
 * de volta para `destino`. Para `dados`, também limpa o Input de Produção;
 * para os demais destinos, preserva as datas de planejamento anteriores.
 *
 * Em DTF+Silk, "dtf" só apaga DTF (+ acabamento) e "silk" só apaga Silk
 * (+ acabamento) — o lado já pronto permanece pronto.
 */
export function camposAlimpar(pedido: Pedido, destino: WipeDestino): Record<string, any> {
  const incluiDTF = tipoIncluiDTF(pedido.tipo_estampa);
  const incluiSilk = tipoIncluiSilk(pedido.tipo_estampa);
  let out: Record<string, any> = { ...WIPE_ACABAMENTO };
  if (destino === "acabamento") return out;
  if (destino === "dtf") {
    if (incluiDTF) out = { ...out, ...WIPE_DTF };
    return out;
  }
  if (destino === "silk") {
    if (incluiSilk) out = { ...out, ...WIPE_SILK };
    return out;
  }
  // destino === "arte" → apaga Arte + DTF + Silk + Acabamento
  out = { ...out, ...WIPE_ARTE_COMUM };
  if (incluiDTF) out = { ...out, ...WIPE_ARTE_DTF, ...WIPE_DTF };
  if (incluiSilk) out = { ...out, ...WIPE_ARTE_SILK, ...WIPE_SILK };
  if (destino === "arte") return out;
  // destino === "dados" → também limpa o Input de Produção para refazer o fluxo normal desde essa etapa.
  out = { ...out, ...WIPE_INPUT_PRODUCAO };
  return out;
}

export function camposAlimparAposInputProducao(pedido: Pedido): Record<string, any> {
  const out = camposAlimpar(pedido, "arte");
  delete out.n_batidas_dtf;
  delete out.n_batidas_silk;
  delete out.inicio_acabamento;
  delete out.termino_acabamento;
  delete out.tempo_producao;
  return out;
}

