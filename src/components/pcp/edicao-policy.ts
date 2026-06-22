import type { Pedido } from "@/lib/pedidos";
import { tipoIncluiDTF, tipoIncluiSilk, etapaAtualSemAsterisco } from "@/lib/pedidos";

export function canEditArte(p: Pedido | null | undefined): boolean {
  if (!p) return true;
  if (p.finalizado_em) return false;
  if (p.tipo_estampa === "Lisa") return false;
  return p.status_arte !== "Arte Finalizada";
}

export function canEditDTF(p: Pedido | null | undefined): boolean {
  if (!p) return true;
  if (p.finalizado_em) return false;
  if (!tipoIncluiDTF(p.tipo_estampa)) return false;
  return p.dtf_estampado !== "Sim";
}

export function canEditSilk(p: Pedido | null | undefined): boolean {
  if (!p) return true;
  if (p.finalizado_em) return false;
  if (!tipoIncluiSilk(p.tipo_estampa)) return false;
  return p.silk_feito !== "Sim";
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
