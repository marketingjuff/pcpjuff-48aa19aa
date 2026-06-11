// Utilitários e fontes de sugestões de feriados.

export type Sugestao = { data: string; descricao: string };

// Algoritmo de Gauss para Páscoa (domingo).
function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fixa(ano: number, mes: number, dia: number): string {
  return iso(new Date(Date.UTC(ano, mes - 1, dia)));
}

export function sugestoesEstadoSP(ano: number): Sugestao[] {
  return [
    { data: fixa(ano, 7, 9), descricao: "Revolução Constitucionalista (SP)" },
  ];
}

export function sugestoesCapitalSP(ano: number): Sugestao[] {
  const p = pascoa(ano);
  return [
    { data: fixa(ano, 1, 25), descricao: "Aniversário de São Paulo" },
    { data: iso(addDays(p, -2)), descricao: "Sexta-feira Santa" },
    { data: iso(addDays(p, 60)), descricao: "Corpus Christi" },
    { data: fixa(ano, 11, 20), descricao: "Consciência Negra" },
  ];
}

export type BrasilApiFeriado = { date: string; name: string; type: string };

export async function fetchFeriadosNacionais(ano: number): Promise<Sugestao[]> {
  const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
  if (!res.ok) throw new Error(`BrasilAPI ${res.status}`);
  const arr = (await res.json()) as BrasilApiFeriado[];
  return arr.map((f) => ({ data: f.date, descricao: f.name }));
}

export function anosSugeridos(): number[] {
  const atual = new Date().getFullYear();
  return [atual, atual + 1, atual + 2, atual + 3, atual + 4, atual + 5];
}
