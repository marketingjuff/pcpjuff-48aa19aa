import type { Pedido } from "@/lib/pedidos";
import {
  tipoIncluiDTF,
  tipoIncluiSilk,
  etapaAtualSemAsterisco,
  ladoDtfPronto,
  ladoSilkPronto,
} from "@/lib/pedidos";

export function canEditArte(p: Pedido | null | undefined): boolean {
  if (!p) return true;
  if (p.finalizado_em) return false;
  if (p.tipo_estampa === "Lisa") return false;

  // Enquanto ainda faltar concluir algum lado de arte do tipo de estampa,
  // a aba Arte continua editável para o operador, mesmo se status_arte já
  // tiver sido marcado como "Arte Finalizada" no meio do processo.
  const temArtePendente =
    (tipoIncluiDTF(p.tipo_estampa) && !ladoDtfPronto(p)) ||
    (tipoIncluiSilk(p.tipo_estampa) && !ladoSilkPronto(p));
  if (temArtePendente) return true;

  // Mantém também a liberação por etapa exibida, para cobrir variantes e
  // pedidos antigos cujo cálculo de campos ainda aponte visualmente para Arte.
  const etapa = etapaAtualSemAsterisco(p);
  if (
    etapa === "Aguardando Arte" ||
    etapa === "DTF Liberado / Silk na Arte" ||
    etapa === "Silk Liberado / DTF na Arte"
  ) {
    return true;
  }
  return p.status_arte !== "Arte Finalizada";
}

export function canEditDTF(p: Pedido | null | undefined): boolean {
  if (!p) return true;
  if (p.finalizado_em) return false;
  if (!tipoIncluiDTF(p.tipo_estampa)) return false;
  if (p.dtf_estampado === "Sim") return false;
  // Só libera depois que a arte do DTF estiver pronta
  return ladoDtfPronto(p);
}

export function canEditSilk(p: Pedido | null | undefined): boolean {
  if (!p) return true;
  if (p.finalizado_em) return false;
  if (!tipoIncluiSilk(p.tipo_estampa)) return false;
  if (p.silk_feito === "Sim") return false;
  // Só libera depois que a arte do Silk estiver pronta
  return ladoSilkPronto(p);
}

export function canEditAcabamento(p: Pedido | null | undefined): boolean {
  if (!p) return true;
  if (p.finalizado_em) return false;
  if (p.embalado === "Sim") return false;
  return etapaAtualSemAsterisco(p) === "Aguardando Acabamento";
}

export type AbaTrava = "arte" | "dtf" | "silk" | "acabamento";

export function isReadOnly(
  aba: AbaTrava,
  pedido: Pedido | null | undefined,
  canManage: boolean,
): boolean {
  if (canManage) return false;
  if (!pedido) return false;
  switch (aba) {
    case "arte": return !canEditArte(pedido);
    case "dtf": return !canEditDTF(pedido);
    case "silk": return !canEditSilk(pedido);
    case "acabamento": return !canEditAcabamento(pedido);
  }
}

