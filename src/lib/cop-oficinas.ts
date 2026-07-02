// Helpers para visão de carga por oficina no COP.
import { type Cop, type Oficina, totalPecasCop, STATUS_POS_CORTE, STATUS_CORTE, rotuloRomaneio } from "@/lib/cop";
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

// ---------- Árvore hierárquica para "Oficinas Hoje" (pivot) ----------
export type NoCor = { cor: string; porTamanho: Record<string, number>; total: number };
export type NoModelo = { modelo: string; cores: NoCor[]; total: number };
export type NoCop = { cop: Cop; rotulo: string; modelos: NoModelo[]; total: number };
export type NoOficina = { oficina: Oficina; cops: NoCop[]; total: number };

const _MODELO_IDX = new Map<string, number>(REFACAO_MODELOS.map((m, i) => [m, i]));
const _COR_IDX = new Map<string, number>(REFACAO_CORES.map((c, i) => [c.nome, i]));

function cmpOrdem(a: string, b: string, idx: Map<string, number>): number {
  const ia = idx.get(a); const ib = idx.get(b);
  if (ia !== undefined && ib !== undefined) return ia - ib;
  if (ia !== undefined) return -1;
  if (ib !== undefined) return 1;
  return a.localeCompare(b);
}

function _agruparCopsEmNos(cops: Cop[], todosCopsRef: Cop[]): NoCop[] {
  return cops.map((c) => {
    const mm = new Map<string, Map<string, Record<string, number>>>();
    for (const p of c.pecas ?? []) {
      if (!p || !p.modelo || !p.cor || !p.tamanho) continue;
      const qtd = Number(p.qtd) || 0;
      if (qtd === 0) continue;
      let porCor = mm.get(p.modelo);
      if (!porCor) { porCor = new Map(); mm.set(p.modelo, porCor); }
      let porTam = porCor.get(p.cor);
      if (!porTam) { porTam = {}; porCor.set(p.cor, porTam); }
      porTam[p.tamanho] = (porTam[p.tamanho] ?? 0) + qtd;
    }
    const modelos: NoModelo[] = [];
    for (const [modelo, porCor] of mm) {
      const cores: NoCor[] = [];
      for (const [cor, porTam] of porCor) {
        const total = Object.values(porTam).reduce((s, n) => s + n, 0);
        cores.push({ cor, porTamanho: porTam, total });
      }
      cores.sort((a, b) => cmpOrdem(a.cor, b.cor, _COR_IDX));
      const total = cores.reduce((s, c) => s + c.total, 0);
      modelos.push({ modelo, cores, total });
    }
    modelos.sort((a, b) => cmpOrdem(a.modelo, b.modelo, _MODELO_IDX));
    const total = modelos.reduce((s, m) => s + m.total, 0);
    return { cop: c, rotulo: rotuloRomaneio(c, todosCopsRef), modelos, total };
  });
}

export function arvoreOficinasHoje(cops: Cop[], oficinas: Oficina[]): NoOficina[] {
  const porOficina = copsPorOficina(cops);
  const out: NoOficina[] = [];

  for (const of of oficinas) {
    const lista = porOficina.get(of.id) ?? [];
    if (lista.length === 0) continue;
    const nosCop = _agruparCopsEmNos(lista, cops);
    nosCop.sort((a, b) => a.rotulo.localeCompare(b.rotulo));
    const total = nosCop.reduce((s, n) => s + n.total, 0);
    out.push({ oficina: of, cops: nosCop, total });
  }

  out.sort((a, b) => b.total - a.total);
  return out;
}

export const TAMANHOS_PIVOT = REFACAO_TAMANHOS;

// ---------- Grupo "Em corte" + agregados ----------
export const OFICINA_EM_CORTE: Oficina = {
  id: "__corte__",
  nome: "Em corte",
} as unknown as Oficina;

export function nosEmCorte(cops: Cop[]): NoOficina | null {
  const emCorte = cops.filter((c) => !c.oficina_id && STATUS_CORTE.includes(c.status));
  if (emCorte.length === 0) return null;
  const nosCop = _agruparCopsEmNos(emCorte, cops);
  nosCop.sort((a, b) => a.rotulo.localeCompare(b.rotulo));
  const total = nosCop.reduce((s, n) => s + n.total, 0);
  return { oficina: OFICINA_EM_CORTE, cops: nosCop, total };
}

export function arvoreProducaoHoje(cops: Cop[], oficinas: Oficina[]): NoOficina[] {
  const grupoCorte = nosEmCorte(cops);
  const oficinasNos = arvoreOficinasHoje(cops, oficinas);
  return grupoCorte ? [grupoCorte, ...oficinasNos] : oficinasNos;
}

export function subtotaisPorTamanho(no: NoOficina, tamanhos: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tamanhos) out[t] = 0;
  for (const c of no.cops) {
    for (const m of c.modelos) {
      for (const cor of m.cores) {
        for (const [t, q] of Object.entries(cor.porTamanho)) {
          out[t] = (out[t] ?? 0) + q;
        }
      }
    }
  }
  return out;
}

export function totaisGeraisPorTamanho(nos: NoOficina[], tamanhos: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tamanhos) out[t] = 0;
  for (const no of nos) {
    const sub = subtotaisPorTamanho(no, tamanhos);
    for (const t of tamanhos) out[t] += sub[t] ?? 0;
  }
  return out;
}

const _TAM_IDX = new Map<string, number>(REFACAO_TAMANHOS.map((t, i) => [t, i]));

export function tamanhosVisiveis(nos: NoOficina[]): string[] {
  const presentes = new Set<string>();
  for (const no of nos) {
    for (const c of no.cops) {
      for (const m of c.modelos) {
        for (const cor of m.cores) {
          for (const [t, q] of Object.entries(cor.porTamanho)) {
            if (q > 0) presentes.add(t);
          }
        }
      }
    }
  }
  if (presentes.size === 0) return [...REFACAO_TAMANHOS];
  const canon = REFACAO_TAMANHOS.filter((t) => presentes.has(t));
  const extras = [...presentes].filter((t) => !_TAM_IDX.has(t)).sort();
  return [...canon, ...extras];
}

