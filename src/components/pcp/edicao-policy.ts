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

  // A trava da Arte é definida exclusivamente pela conclusão dos campos de
  // execução (impressão/corte de DTF e fotolito). O campo "Anotações"
  // (status_arte) é apenas informativo e NUNCA bloqueia a edição.
  // Em pedidos combinados (Silk + DTF), a arte só é travada quando AMBOS
  // os lados aplicáveis estiverem prontos.
  const dtfPendente = tipoIncluiDTF(p.tipo_estampa) && !ladoDtfPronto(p);
  const silkPendente = tipoIncluiSilk(p.tipo_estampa) && !ladoSilkPronto(p);
  if (dtfPendente || silkPendente) return true;
  return false;
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
  soLeitura = false,
): boolean {
  // Somente leitura vence tudo, inclusive canManage (gestor em leitura não edita).
  if (soLeitura) return true;
  if (canManage) return false;
  if (!pedido) return false;
  switch (aba) {
    case "arte": return !canEditArte(pedido);
    case "dtf": return !canEditDTF(pedido);
    case "silk": return !canEditSilk(pedido);
    case "acabamento": return !canEditAcabamento(pedido);
  }
}

