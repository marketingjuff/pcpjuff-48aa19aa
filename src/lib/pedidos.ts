import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Pedido = Tables<"pedidos">;
export type PedidoInsert = TablesInsert<"pedidos">;

export const VENDEDORES = ["Wander", "Mirela", "Gabriel", "Outros"] as const;
export const STATUS_OPCOES = ["Aberto", "Completo"] as const;
export const MODELOS_ESTAMPA = ["DTF", "Silk", "DTF+Silk", "Lisa"] as const;
export const SIM_NAO_PROCESSO = ["Sim", "Não", "Em processo"] as const;
export const PEDIDO_OK_OPCOES = ["OK", "Pendente", "Revisão"] as const;
export const OK_OPCOES = ["Sim", "Não", "N/A"] as const;
export const RESPONSAVEIS = ["Patrícia", "Nuno", "Outros"] as const;

export function modeloIncluiDTF(modelo: string | null | undefined) {
  return modelo === "DTF" || modelo === "DTF+Silk";
}
export function modeloIncluiSilk(modelo: string | null | undefined) {
  return modelo === "Silk" || modelo === "DTF+Silk";
}

export function calcularEtapaAtual(p: Pedido): {
  etapa: string;
  percentual: number;
  cor: "green" | "yellow" | "red" | "gray" | "blue";
} {
  const modelo = p.modelo_estampa;
  const isLisa = modelo === "Lisa";

  const dadosInOk = !!p.pedido_olist;
  const arteOk = p.pedido_ok === "OK";
  const dtfOk = !modeloIncluiDTF(modelo) || p.dtf_estampado === "Sim";
  const silkOk = !modeloIncluiSilk(modelo) || p.silk_feito === "Sim";
  const acabamentoOk = p.embalado === "Sim";

  const etapas = isLisa
    ? [dadosInOk, acabamentoOk]
    : ([dadosInOk, arteOk, modeloIncluiDTF(modelo) ? dtfOk : null, modeloIncluiSilk(modelo) ? silkOk : null, acabamentoOk].filter(
        (v) => v !== null,
      ) as boolean[]);

  const completas = etapas.filter(Boolean).length;
  const percentual = Math.round((completas / etapas.length) * 100);

  let etapa = "Pendente entrada";
  let cor: "green" | "yellow" | "red" | "gray" | "blue" = "gray";

  if (acabamentoOk) { etapa = "Enviado"; cor = "green"; }
  else if (!dadosInOk) { etapa = "Pendente entrada"; cor = "gray"; }
  else if (!isLisa && !arteOk) { etapa = "Arte em progresso"; cor = "blue"; }
  else if (modeloIncluiDTF(modelo) && p.dtf_estampado !== "Sim") { etapa = "DTF aguardando"; cor = "yellow"; }
  else if (modeloIncluiSilk(modelo) && p.silk_feito !== "Sim") { etapa = "Silk aguardando"; cor = "yellow"; }
  else { etapa = "Acabamento"; cor = "blue"; }

  return { etapa, percentual, cor };
}

export function statusPrazo(p: Pedido): "ok" | "aviso" | "atrasado" | "neutro" {
  if (!p.saida_juff) return "neutro";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const saida = new Date(p.saida_juff + "T00:00:00");
  const diff = (saida.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24);
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
