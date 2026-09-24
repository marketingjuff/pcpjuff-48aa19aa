// Lógica pura do Monitor PCP: contagem simples de peças que começam cada etapa
// em cada dia útil. Sem teto, sem vazamento. Sem React, sem acesso ao banco.
import {
  addDiasCorridos,
  isDiaUtil,
  proximoDiaUtil,
  todayISO,
  type Feriados,
} from "@/lib/dias-uteis";
import { tipoIncluiDTF, tipoIncluiSilk } from "@/lib/pedidos";
import type { Pedido } from "@/lib/pedidos";

export type Etapa = "arte" | "dtf" | "silk" | "acabamento";

export const ETAPAS: { key: Etapa; label: string }[] = [
  { key: "arte", label: "Arte" },
  { key: "dtf", label: "DTF" },
  { key: "silk", label: "Silk" },
  { key: "acabamento", label: "Acabamento" },
];

export const TETO_PADRAO: Record<Etapa, number> = { arte: 900, dtf: 700, silk: 900, acabamento: 900 };

/**
 * A1 — Início de Acabamento.
 * Corpo movido literalmente do useMemo de DadosInTab.tsx (mesma ordem de condições).
 * Silk/Silk+DTF com dias_secagem > 0: término_estamparia + dias_secagem + 1 dia corrido,
 * depois próximo dia útil.
 * Silk/Silk+DTF com dias_secagem = 0 (secagem forçada, produção no mesmo dia):
 * igual ao término_estamparia, sem pular dia corrido nem dia útil.
 * Só DTF: igual ao término_estamparia.
 */
export function calcInicioAcabamento(
  termino_estamparia: string | null | undefined,
  soDTF: boolean,
  incluiSilk: boolean,
  isLisa: boolean,
  diasSecagemNum: number,
  feriados: Feriados,
): string | null {
  if (!termino_estamparia || isLisa) return null;
  if (soDTF) return termino_estamparia;
  if (!incluiSilk) return null;
  // Secagem zero: pedido de emergência produzido inteiramente no mesmo dia → início = término.
  if (diasSecagemNum <= 0) return termino_estamparia;
  // término dia 1, secagem N dias → início no dia (1 + N + 1); o dia do término e o dia do início não contam.
  const base = addDiasCorridos(termino_estamparia, diasSecagemNum + 1);
  return proximoDiaUtil(base, feriados);
}

/** Mesma fórmula, recebendo o pedido inteiro (usado pelo Monitor). */
export function inicioAcabamentoDoPedido(p: Partial<Pedido>, feriados: Feriados): string | null {
  const isLisa = p.tipo_estampa === "Lisa";
  const incluiSilk = tipoIncluiSilk(p.tipo_estampa ?? null);
  const soDTF = tipoIncluiDTF(p.tipo_estampa ?? null) && !incluiSilk;
  const dias = Number(p.dias_secagem ?? 0) || 0;
  return calcInicioAcabamento(p.termino_estamparia ?? null, soDTF, incluiSilk, isLisa, dias, feriados);
}

/** Lista de dias úteis entre duas datas ISO (inclusive nos dois extremos). */
export function diasUteisNoIntervalo(ini: string, fim: string, feriados: Feriados): string[] {
  if (!ini || !fim) return [];
  const out: string[] = [];
  const d = new Date(ini + "T00:00:00");
  const end = new Date(fim + "T00:00:00");
  if (end.getTime() < d.getTime()) return [];
  let guard = 0;
  while (d.getTime() <= end.getTime() && guard++ < 800) {
    if (isDiaUtil(d, feriados)) out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export type IntervaloEtapa = { ini: string; fim: string } | null;

/** Intervalo gravado de cada etapa (sem simulação). */
export function intervaloEtapa(p: Pedido, etapa: Etapa, feriados: Feriados): IntervaloEtapa {
  const incluiSilk = tipoIncluiSilk(p.tipo_estampa ?? null);
  const incluiDTF = tipoIncluiDTF(p.tipo_estampa ?? null);
  if (etapa === "arte") {
    if (!p.arte_data || !incluiDTF) return null;
    return { ini: p.arte_data, fim: p.arte_data };
  }
  if (etapa === "dtf" || etapa === "silk") {
    if (etapa === "dtf" && !incluiDTF) return null;
    if (etapa === "silk" && !incluiSilk) return null;
    const ini = p.inicio_estamparia;
    const fim = p.termino_estamparia ?? p.inicio_estamparia;
    if (!ini || !fim) return null;
    return { ini, fim };
  }
  const ini = p.inicio_acabamento ?? inicioAcabamentoDoPedido(p, feriados);
  const fim = p.termino_acabamento ?? ini;
  if (!ini || !fim) return null;
  return { ini, fim };
}

/** Carga total do pedido naquela etapa. Nunca NaN. */
export function cargaDoPedido(p: Pedido, etapa: Etapa): number {
  if (etapa === "arte") {
    if (!tipoIncluiDTF(p.tipo_estampa ?? null)) return 0;
  }
  const q = Number(p.qtd ?? 0);
  return Number.isFinite(q) && q > 0 ? q : 0;
}

export type DiaCarga = {
  dia: string;
  /** total de peças dos pedidos que começam a etapa neste dia */
  carga: number;
  /** quantos pedidos começam a etapa neste dia */
  pedidos: number;
  /** ids dos pedidos que começam a etapa neste dia */
  pedidoIds: string[];
};

export type ResultadoEtapa = {
  etapa: Etapa;
  porDia: Map<string, DiaCarga>;
  /** mantido por compatibilidade com o Gantt; sempre vazio */
  pedidosVazados: Set<string>;
};

/**
 * Conta a quantidade TOTAL de peças de cada pedido no primeiro dia do
 * intervalo da etapa (ou no próximo dia útil, se cair em dia não útil).
 */
export function simularEtapa(pedidos: Pedido[], etapa: Etapa, feriados: Feriados): ResultadoEtapa {
  const porDia = new Map<string, DiaCarga>();
  for (const p of pedidos) {
    const iv = intervaloEtapa(p, etapa, feriados);
    const carga = cargaDoPedido(p, etapa);
    if (!iv || carga <= 0) continue;
    const dia = isDiaUtil(new Date(iv.ini + "T00:00:00"), feriados) ? iv.ini : proximoDiaUtil(iv.ini, feriados);
    const d = porDia.get(dia) ?? { dia, carga: 0, pedidos: 0, pedidoIds: [] as string[] };
    d.carga += carga;
    d.pedidos += 1;
    d.pedidoIds.push(p.id);
    porDia.set(dia, d);
  }
  return { etapa, porDia, pedidosVazados: new Set<string>() };
}

/** Segunda (1) ou quinta (4) dentro do intervalo, inclusive nos extremos. */
export function temSegundaOuQuinta(ini: string | null | undefined, fim: string | null | undefined): boolean {
  if (!ini) return false;
  const end = fim || ini;
  const d = new Date(ini + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  let guard = 0;
  while (d.getTime() <= e.getTime() && guard++ < 400) {
    const dow = d.getDay();
    if (dow === 1 || dow === 4) return true;
    d.setDate(d.getDate() + 1);
  }
  return false;
}

/** Próxima segunda ou quinta a partir de uma data ISO (inclusive). */
export function proximaSegundaOuQuinta(from: string): string {
  const d = new Date(from + "T00:00:00");
  let guard = 0;
  while (guard++ < 20) {
    const dow = d.getDay();
    if (dow === 1 || dow === 4) return d.toISOString().slice(0, 10);
    d.setDate(d.getDate() + 1);
  }
  return from;
}

/** Janela do monitor: 1 mês antes até 4 meses depois de hoje. */
export function janelaMonitor(): { de: string; ate: string } {
  const hoje = new Date(todayISO() + "T00:00:00");
  const de = new Date(hoje);
  de.setMonth(de.getMonth() - 1);
  const ate = new Date(hoje);
  ate.setMonth(ate.getMonth() + 4);
  return { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) };
}

/** Todos os dias úteis da janela, em ordem. */
export function diasDaJanela(de: string, ate: string, feriados: Feriados): string[] {
  return diasUteisNoIntervalo(de, ate, feriados);
}

/**
 * SOMENTE EXIBIÇÃO: todos os dias corridos da janela, incluindo sábados,
 * domingos e feriados. Não é usada por nenhum cálculo de carga.
 */
export function diasCorridosDaJanela(de: string, ate: string): string[] {
  if (!de || !ate) return [];
  const out: string[] = [];
  const d = new Date(de + "T00:00:00");
  const end = new Date(ate + "T00:00:00");
  let guard = 0;
  while (d.getTime() <= end.getTime() && guard++ < 1200) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}


/** Agrupa dias em semanas (chave = segunda-feira da semana). */
export function agruparPorSemana(dias: string[]): { semana: string; dias: string[] }[] {
  const out: { semana: string; dias: string[] }[] = [];
  const idx = new Map<string, number>();
  for (const dia of dias) {
    const d = new Date(dia + "T00:00:00");
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    const key = d.toISOString().slice(0, 10);
    if (!idx.has(key)) {
      idx.set(key, out.length);
      out.push({ semana: key, dias: [] });
    }
    out[idx.get(key)!]!.dias.push(dia);
  }
  return out;
}
