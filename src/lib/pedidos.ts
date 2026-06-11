import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Pedido = Tables<"pedidos">;
export type PedidoInsert = TablesInsert<"pedidos">;

export const VENDEDORES = ["Wander", "Mirela", "Gabriel", "Outros"] as const;
export const STATUS_GERAL_OPCOES = ["Aberto", "Completo"] as const;
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

export function tipoIncluiDTF(tipo: string | null | undefined) {
  return tipo === "DTF" || tipo === "DTF+Silk";
}
export function tipoIncluiSilk(tipo: string | null | undefined) {
  return tipo === "Silk" || tipo === "DTF+Silk";
}
// Backwards-compat (algumas abas ainda importam estes nomes)
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
  const dtfOk = !tipoIncluiDTF(tipo) || p.dtf_estampado === "Sim";
  const silkOk = !tipoIncluiSilk(tipo) || p.silk_feito === "Sim";
  const acabamentoOk = p.embalado === "Sim";

  const etapas = isLisa
    ? [dadosInOk, acabamentoOk]
    : ([dadosInOk, arteOk, tipoIncluiDTF(tipo) ? dtfOk : null, tipoIncluiSilk(tipo) ? silkOk : null, acabamentoOk].filter(
        (v) => v !== null,
      ) as boolean[]);

  const completas = etapas.filter(Boolean).length;
  const percentual = Math.round((completas / etapas.length) * 100);

  let etapa = "Pendente entrada";
  let cor: "green" | "yellow" | "red" | "gray" | "blue" = "gray";

  if (p.finalizado_em) { etapa = "Finalizado"; cor = "green"; }
  else if (acabamentoOk) { etapa = "Enviado"; cor = "green"; }
  else if (!dadosInOk) { etapa = "Pendente entrada"; cor = "gray"; }
  else if (!isLisa && !arteOk) { etapa = "Arte em progresso"; cor = "blue"; }
  else if (tipoIncluiDTF(tipo) && p.dtf_estampado !== "Sim") { etapa = "DTF aguardando"; cor = "yellow"; }
  else if (tipoIncluiSilk(tipo) && p.silk_feito !== "Sim") { etapa = "Silk aguardando"; cor = "yellow"; }
  else { etapa = "Acabamento"; cor = "blue"; }

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
