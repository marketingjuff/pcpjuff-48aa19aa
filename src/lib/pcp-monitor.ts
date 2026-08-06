// Lógica pura do Monitor PCP: cargas por etapa, teto efetivo e simulação de
// vazamento. Sem React, sem acesso ao banco.
import {
  addDiasCorridos,
  addDiasUteis,
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
 * Silk/Silk+DTF: término_estamparia + dias_secagem + 1 dia corrido, depois próximo dia útil.
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
    const n = Number(p.n_batidas_dtf ?? 1);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  const q = Number(p.qtd ?? 0);
  return Number.isFinite(q) && q > 0 ? q : 0;
}

export type DiaCarga = {
  dia: string;
  carga: number;
  teto: number;
  tetoEfetivo: number;
  pedidos: number;
  vazou: boolean;
};

export type ResultadoEtapa = {
  etapa: Etapa;
  porDia: Map<string, DiaCarga>;
  /** pedidos cuja carga não caberia dentro do intervalo planejado */
  pedidosVazados: Set<string>;
};

/**
 * Simula a etapa: distribui a carga de cada pedido pelos dias úteis do seu
 * intervalo, na ordem de Saída Juff, escorregando para os dias úteis seguintes
 * quando o teto efetivo do dia estoura.
 */
export function simularEtapa(
  pedidos: Pedido[],
  etapa: Etapa,
  teto: number,
  feriados: Feriados,
): ResultadoEtapa {
  const elegiveis = pedidos
    .map((p) => ({ p, iv: intervaloEtapa(p, etapa, feriados), carga: cargaDoPedido(p, etapa) }))
    .filter((x) => x.iv && x.carga > 0) as { p: Pedido; iv: { ini: string; fim: string }; carga: number }[];

  // nPedidosNoDia é contado sobre as datas gravadas, antes da simulação.
  const pedidosPorDia = new Map<string, number>();
  for (const { p, iv } of elegiveis) {
    for (const d of diasUteisNoIntervalo(iv.ini, iv.fim, feriados)) {
      pedidosPorDia.set(d, (pedidosPorDia.get(d) ?? 0) + 1);
      void p;
    }
  }

  const tetoEfetivoDe = (dia: string) => {
    const n = pedidosPorDia.get(dia) ?? 1;
    return Math.max(0, Math.floor(teto * (1 - 0.01 * (Math.max(1, n) - 1))));
  };

  const porDia = new Map<string, DiaCarga>();
  const garanteDia = (dia: string): DiaCarga => {
    let d = porDia.get(dia);
    if (!d) {
      const tef = tetoEfetivoDe(dia);
      d = { dia, carga: 0, teto, tetoEfetivo: tef, pedidos: pedidosPorDia.get(dia) ?? 0, vazou: false };
      porDia.set(dia, d);
    }
    return d;
  };

  const pedidosVazados = new Set<string>();
  const ordenados = [...elegiveis].sort((a, b) =>
    (a.p.saida_juff ?? "9999-12-31").localeCompare(b.p.saida_juff ?? "9999-12-31"),
  );

  for (const { p, iv, carga } of ordenados) {
    const dias = diasUteisNoIntervalo(iv.ini, iv.fim, feriados);
    if (dias.length === 0) continue;
    let restante = carga;
    let cursor = dias[0]!;
    let idx = 0;
    let guard = 0;
    while (restante > 0 && guard++ < 400) {
      const d = garanteDia(cursor);
      const espaco = Math.max(0, d.tetoEfetivo - d.carga);
      const usa = Math.min(restante, espaco);
      d.carga += usa;
      restante -= usa;
      if (restante > 0) {
        idx++;
        if (idx < dias.length) {
          cursor = dias[idx]!;
        } else {
          // escorrega para além do término planejado
          pedidosVazados.add(p.id);
          cursor = addDiasUteis(cursor, 1, feriados);
          const dd = garanteDia(cursor);
          dd.vazou = true;
          dias.push(cursor);
          idx = dias.length - 1;
        }
      }
    }
    if (restante > 0) pedidosVazados.add(p.id);
  }

  return { etapa, porDia, pedidosVazados };
}

export type Nivel = "vazio" | "ok" | "atencao" | "estouro";

export function nivelDoDia(d: DiaCarga | undefined): Nivel {
  if (!d || d.carga <= 0) return "vazio";
  if (d.vazou) return "estouro";
  const pct = d.tetoEfetivo > 0 ? d.carga / d.tetoEfetivo : 1;
  if (pct > 1) return "estouro";
  if (pct > 0.8) return "atencao";
  return "ok";
}

export const NIVEL_BG: Record<Nivel, string> = {
  vazio: "bg-muted/30",
  ok: "bg-emerald-200",
  atencao: "bg-amber-200",
  estouro: "bg-rose-300",
};

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
