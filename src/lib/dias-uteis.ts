/**
 * Cálculos de dias úteis considerando feriados (datas ISO yyyy-mm-dd).
 */
export type Feriados = Set<string>; // set of yyyy-mm-dd

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isDiaUtil(d: Date, feriados: Feriados): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  if (feriados.has(toISO(d))) return false;
  return true;
}

/** Adiciona N dias úteis a uma data (positivo no futuro, negativo no passado). */
export function addDiasUteis(start: string | Date, n: number, feriados: Feriados = new Set()): string {
  const d = typeof start === "string" ? new Date(start + "T00:00:00") : new Date(start);
  if (n === 0) return toISO(d);
  const step = n > 0 ? 1 : -1;
  let restantes = Math.abs(n);
  while (restantes > 0) {
    d.setDate(d.getDate() + step);
    if (isDiaUtil(d, feriados)) restantes--;
  }
  return toISO(d);
}

/** Dias úteis entre duas datas (exclusivo do início, inclusivo do fim). */
export function diasUteisEntre(a: string | Date, b: string | Date, feriados: Feriados = new Set()): number {
  const start = typeof a === "string" ? new Date(a + "T00:00:00") : new Date(a);
  const end = typeof b === "string" ? new Date(b + "T00:00:00") : new Date(b);
  if (end.getTime() <= start.getTime()) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur.getTime() < end.getTime()) {
    cur.setDate(cur.getDate() + 1);
    if (isDiaUtil(cur, feriados)) count++;
  }
  return count;
}

/** Dias úteis a partir de hoje até a data informada (negativo se atrasada). */
export function diasUteisAteHoje(target: string | null | undefined, feriados: Feriados = new Set()): number | null {
  if (!target) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(target + "T00:00:00");
  if (alvo.getTime() === hoje.getTime()) return 0;
  if (alvo.getTime() > hoje.getTime()) return diasUteisEntre(hoje, alvo, feriados);
  return -diasUteisEntre(alvo, hoje, feriados);
}
