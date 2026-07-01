// Helpers para visão de carga por oficina no COP.
import { type Cop, type Oficina, totalPecasCop, STATUS_POS_CORTE, rotuloRomaneio } from "@/lib/cop";
import { REFACAO_MODELOS, REFACAO_CORES, REFACAO_TAMANHOS } from "@/lib/pedidos";

/** COP é "ativo na oficina" quando tem oficina_id, está pós-corte e ainda não foi pago/finalizado. */
export function copAtivoEmOficina(c: Cop): boolean {
  if (!c.oficina_id) return false;
  if (c.status === "Finalizado") return false;
  if (c.pagamento_status === "pago") return false;
  return STATUS_POS_CORTE.includes(c.status);
}

/** Soma de peças (do romaneio/COP) por oficina_id considerando apenas COPs ativos. */
export function cargaPorOficina(cops: Cop[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cops) {
    if (!copAtivoEmOficina(c)) continue;
    const k = c.oficina_id!;
    m.set(k, (m.get(k) ?? 0) + totalPecasCop(c.pecas));
  }
  return m;
}

/** Lista de COPs ativos por oficina_id. */
export function copsPorOficina(cops: Cop[]): Map<string, Cop[]> {
  const m = new Map<string, Cop[]>();
  for (const c of cops) {
    if (!copAtivoEmOficina(c)) continue;
    const arr = m.get(c.oficina_id!) ?? [];
    arr.push(c);
    m.set(c.oficina_id!, arr);
  }
  return m;
}
