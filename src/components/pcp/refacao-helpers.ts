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

function montarLinhaObservacao(args: {
  origem: string;
  destino: VoltarDestino;
  payload: RefacaoFormPayload;
  responsavel: string;
  tipoEstampa: string | null | undefined;
}): string {
  const { origem, destino, payload, responsavel, tipoEstampa } = args;
  const partes: string[] = [];
  partes.push(`Voltou de ${origemHumano(origem)} para ${ETAPA_DESTINO_LABEL[destino]}`);
  partes.push(`${payload.pecas_refazer} peças a refazer`);
  if (payload.perda_pecas > 0) partes.push(`${payload.perda_pecas} peças perdidas`);
  if (tipoIncluiDTF(tipoEstampa) && payload.perda_adesivos > 0) {
    partes.push(`${payload.perda_adesivos} adesivos perdidos`);
  }
  if (destino === "dados" && payload.pecas_extras && payload.pecas_extras > 0) {
    partes.push(`+${payload.pecas_extras} extras`);
  }
  partes.push(`responsável: ${responsavel}`);
  partes.push(`motivo: ${payload.motivo}`);
  return `${fmtBR(new Date().toISOString())} — Refação (automático)\n${partes.join(" · ")}`;
}

/**
 * Constrói o resultado de um Refazer:
 * - Se já há episódio aberto: apenas atualiza `etapa_destino` (sem nova observação).
 * - Caso contrário: cria novo episódio com retrato + acrescenta linha automática
 *   ao campo `observacoes_pedido`.
 */
export async function montarRefacoesAposRefazer(
  pedido: Pedido,
  destino: VoltarDestino,
  payload: RefacaoFormPayload | null,
): Promise<{ refacoes: RefacaoEpisodio[]; observacoes_pedido?: string | null }> {
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
  const nome = await nomeUsuarioAtual(uid);
  const origem = etapaAtualSemAsterisco(pedido);
  const novo: RefacaoEpisodio = {
    etapa_origem: origem,
    etapa_destino: destino,
    data: new Date().toISOString(),
    quem: uid,
    pecas_refazer: payload.pecas_refazer,
    perda_pecas: payload.perda_pecas,
    perda_adesivos: payload.perda_adesivos,
    ...(destino === "dados" && payload.pecas_extras ? { pecas_extras: payload.pecas_extras } : {}),
    motivo: payload.motivo,
    aberto: true,
    retrato: montarRetrato(pedido),
  };
  const linha = montarLinhaObservacao({
    origem,
    destino,
    payload,
    responsavel: nome,
    tipoEstampa: pedido.tipo_estampa,
  });
  const obsAtual = (pedido.observacoes_pedido ?? "").trim();
  const observacoes_pedido = obsAtual ? `${linha}\n\n${obsAtual}` : linha;
  return { refacoes: [...refsAtuais, novo], observacoes_pedido };
}
