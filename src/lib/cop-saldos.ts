// Helpers de saldo: produção (cortada) − faltantes (pedidos incompletos do PCP).
import type { Cop } from "@/lib/cop";
import type { Pedido, PecaSolicitada } from "@/lib/pedidos";

/** Chave canônica para agregação por peça. */
export function pkKey(modelo: string, cor: string, tamanho: string) {
  return `${modelo}|${cor}|${tamanho}`;
}

/** Em produção = peças de COPs já cortados (status fora de Risco/Corte). */
export function isCopEmProducao(c: Cop): boolean {
  return c.status !== "Aguardando Risco" && c.status !== "Aguardando Corte";
}

/** Map M·C·T → qtd em produção (Σ pecas dos COPs cortados). */
export function calcEmProducao(cops: Cop[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cops) {
    if (!isCopEmProducao(c)) continue;
    for (const p of c.pecas ?? []) {
      const k = pkKey(p.modelo, p.cor, p.tamanho);
      m.set(k, (m.get(k) ?? 0) + (Number(p.qtd) || 0));
    }
  }
  return m;
}

/** Map M·C·T → qtd faltante (Σ qtd-qtd_enviada em pedidos.pecas_solicitadas incompletos). */
export function calcFaltantes(pedidos: Pedido[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of pedidos) {
    if (p.status_pecas !== "incompleto") continue;
    for (const ps of p.pecas_solicitadas ?? []) {
      const falta = (Number(ps.qtd) || 0) - (Number(ps.qtd_enviada) || 0);
      if (falta <= 0) continue;
      const k = pkKey(ps.modelo, ps.cor, ps.tamanho);
      m.set(k, (m.get(k) ?? 0) + falta);
    }
  }
  return m;
}

/**
 * Map M·C·T → qtd recebida da oficina (Σ cops[].pecas_recebidas[].qtd_recebida).
 *
 * Representa peças que voltaram fisicamente da oficina ao estoque. Cresce
 * monotonicamente por COP conforme o Romaneio recebe (parcial ou completo).
 * Substitui `baixado` no cálculo do Disponível: a baixa em pedido só ocorre
 * após o recebimento, então contar os dois causaria desconto duplicado.
 */
export function calcRecebido(cops: Cop[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cops) {
    for (const r of c.pecas_recebidas ?? []) {
      const q = Number(r?.qtd_recebida) || 0;
      if (q <= 0) continue;
      const k = pkKey(r.modelo, r.cor, r.tamanho);
      m.set(k, (m.get(k) ?? 0) + q);
    }
  }
  return m;
}

/** @deprecated use calcRecebido(cops). Mantido temporariamente para compat. */
export function calcBaixado(pedidos: Pedido[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of pedidos) {
    const log = (p as any).pecas_completadas_log as
      | Array<{ modelo: string; cor: string; tamanho: string; qtd: number }>
      | null
      | undefined;
    if (!Array.isArray(log)) continue;
    for (const item of log) {
      const q = Number(item?.qtd) || 0;
      if (q <= 0) continue;
      const k = pkKey(item.modelo, item.cor, item.tamanho);
      m.set(k, (m.get(k) ?? 0) + q);
    }
  }
  return m;
}

/** Map M·C·T → qtd perdida (Σ cops[].perdas em todos COPs). */
export function calcPerdas(cops: Cop[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cops) {
    for (const p of (c.perdas as any[] ?? [])) {
      const q = Number(p?.qtd) || 0;
      if (q <= 0) continue;
      const k = pkKey(p.modelo, p.cor, p.tamanho);
      m.set(k, (m.get(k) ?? 0) + q);
    }
  }
  return m;
}

/** Disponível = produção − faltantes − recebido − perdas (pode ser negativo). */
export function calcDisponivel(
  producao: Map<string, number>,
  faltantes: Map<string, number>,
  recebido: Map<string, number> = new Map(),
  perdas: Map<string, number> = new Map(),
): Map<string, number> {
  const out = new Map<string, number>();
  const keys = new Set<string>([...producao.keys(), ...faltantes.keys(), ...recebido.keys(), ...perdas.keys()]);
  for (const k of keys) {
    out.set(k, (producao.get(k) ?? 0) - (faltantes.get(k) ?? 0) - (recebido.get(k) ?? 0) - (perdas.get(k) ?? 0));
  }
  return out;
}

/** Lista pedidos PCP que pedem aquele M·C·T (com faltantes daquele item). */
export function pedidosDoItem(
  pedidos: Pedido[],
  modelo: string, cor: string, tamanho: string,
): { pedido: Pedido; pecaSolic: PecaSolicitada }[] {
  const out: { pedido: Pedido; pecaSolic: PecaSolicitada }[] = [];
  for (const p of pedidos) {
    for (const ps of p.pecas_solicitadas ?? []) {
      if (ps.modelo === modelo && ps.cor === cor && ps.tamanho === tamanho) {
        out.push({ pedido: p, pecaSolic: ps });
      }
    }
  }
  return out;
}

/** Determina a data-âncora de urgência do pedido (estamparia ou, para Lisa, acabamento). */
export function dataUrgencia(p: Pedido): string | null {
  // Heurística: se tem início de estamparia, usa-o; senão usa início_acabamento (Lisa).
  return (p as any).inicio_estamparia || p.inicio_acabamento || null;
}

/** Adiciona N dias úteis (subtrai se negativo). Não considera feriados; sex+2 = ter. */
export function addDiasUteis(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  let restante = n;
  const step = n >= 0 ? 1 : -1;
  while (restante !== 0) {
    d.setDate(d.getDate() + step);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) restante -= step;
  }
  return d.toISOString().slice(0, 10);
}
