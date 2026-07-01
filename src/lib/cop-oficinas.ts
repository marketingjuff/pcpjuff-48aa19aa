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

export function arvoreOficinasHoje(cops: Cop[], oficinas: Oficina[]): NoOficina[] {
  const porOficina = copsPorOficina(cops);
  const out: NoOficina[] = [];

  for (const of of oficinas) {
    const lista = porOficina.get(of.id) ?? [];
    if (lista.length === 0) continue;

    const nosCop: NoCop[] = lista.map((c) => {
      // agrupar peças: modelo -> cor -> tamanho
      const mm = new Map<string, Map<string, Record<string, number>>>();
      for (const p of c.pecas ?? []) {
        if (!p || !p.modelo || !p.cor || !p.tamanho) continue;
        const modelo = p.modelo;
        const cor = p.cor;
        const tam = p.tamanho;
        const qtd = Number(p.qtd) || 0;
        if (qtd === 0) continue;
        let porCor = mm.get(modelo);
        if (!porCor) { porCor = new Map(); mm.set(modelo, porCor); }
        let porTam = porCor.get(cor);
        if (!porTam) { porTam = {}; porCor.set(cor, porTam); }
        porTam[tam] = (porTam[tam] ?? 0) + qtd;
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
      return { cop: c, rotulo: rotuloRomaneio(c, cops), modelos, total };
    });

    nosCop.sort((a, b) => a.rotulo.localeCompare(b.rotulo));
    const total = nosCop.reduce((s, n) => s + n.total, 0);
    out.push({ oficina: of, cops: nosCop, total });
  }

  out.sort((a, b) => b.total - a.total);
  return out;
}

export const TAMANHOS_PIVOT = REFACAO_TAMANHOS;
