// FASE 2 da Juff Store — fonte única da regra de produto do e-commerce.
// O parse é APENAS classificação: não altera qtd, valor_unitario, desconto ou
// qualquer cálculo financeiro. Indicadores e importação usam este módulo.
import type { ItemCalc, LinhaRanking, PedidoFiltrado } from "@/lib/indicadores-olist";
import { REFACAO_CORES, REFACAO_TAMANHOS } from "@/lib/pedidos";

export type TipoPecaStore = "LISA" | "ESTAMPADA";

export interface ProdutoStore {
  modelo_base: string | null;
  tipo_peca: TipoPecaStore;
  is_outlet: boolean;
  is_xtra: boolean;
  estampa: string | null;
  cor: string | null;
  tamanho: string | null;
  ok: boolean;
  motivo: string | null;
}

/** Item com a classificação da Store anexada (continua sendo um ItemCalc). */
export type ItemStoreCalc = ItemCalc & { store: ProdutoStore };

/* ------------------------------------------------------------------ */
/* Normalização                                                        */
/* ------------------------------------------------------------------ */

export function norm(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Modelos base, testados do mais longo para o mais curto. */
const MODELOS_BASE = [
  "Camiseta Infantil",
  "Manga Longa Masculina",
  "Manga Longa Feminina",
  "Regata Masculina",
  "Regata Feminina",
  "Regata Cross",
  "Regata Wing",
  "Baby Look",
  "Camiseta",
].sort((a, b) => b.length - a.length);

const TAM_POR_NORM = new Map<string, string>(REFACAO_TAMANHOS.map((t) => [norm(t), t]));
const COR_POR_NORM = new Map<string, string>(REFACAO_CORES.map((c) => [norm(c.nome), c.nome]));

const cache = new Map<string, ProdutoStore>();

/** Classifica uma descrição original da Olist (Juff Store). */
export function parseProdutoStore(descricao: string | null | undefined): ProdutoStore {
  const bruto = (descricao ?? "").trim();
  const hit = cache.get(bruto);
  if (hit) return hit;

  const out = calcular(bruto);
  cache.set(bruto, out);
  return out;
}

function calcular(bruto: string): ProdutoStore {
  const res: ProdutoStore = {
    modelo_base: null,
    tipo_peca: "ESTAMPADA",
    is_outlet: false,
    is_xtra: false,
    estampa: null,
    cor: null,
    tamanho: null,
    ok: true,
    motivo: null,
  };

  // 2. remove o prefixo "Juff Store" e o separador seguinte
  let texto = bruto.replace(/^\s*juff\s*store\s*(-{1,2}|:)?\s*/i, "").trim();
  if (!texto) {
    return { ...res, ok: false, motivo: "Descrição vazia" };
  }

  // 3. cor e tamanho pelos dois últimos pedaços, em qualquer ordem
  const partes = texto
    .split(" - ")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  let resto = partes;
  if (partes.length >= 2) {
    const ult = partes[partes.length - 1]!;
    const pen = partes[partes.length - 2]!;
    const tamUlt = TAM_POR_NORM.get(norm(ult));
    const tamPen = TAM_POR_NORM.get(norm(pen));
    const corUlt = COR_POR_NORM.get(norm(ult));
    const corPen = COR_POR_NORM.get(norm(pen));

    if (tamUlt && corPen) {
      res.tamanho = tamUlt;
      res.cor = corPen;
      resto = partes.slice(0, -2);
    } else if (corUlt && tamPen) {
      res.tamanho = tamPen;
      res.cor = corUlt;
      resto = partes.slice(0, -2);
    } else if (tamUlt) {
      res.tamanho = tamUlt;
      resto = partes.slice(0, -1);
      res.ok = false;
      res.motivo = "Cor/tamanho fora do padrão";
    } else if (corUlt) {
      res.cor = corUlt;
      resto = partes.slice(0, -1);
      res.ok = false;
      res.motivo = "Cor/tamanho fora do padrão";
    } else {
      res.ok = false;
      res.motivo = "Cor/tamanho fora do padrão";
    }
  } else {
    res.ok = false;
    res.motivo = "Cor/tamanho fora do padrão";
  }

  const restoTexto = resto.join(" - ");
  const restoNorm = norm(restoTexto);

  // 4-5. outlet, xtra e tipo de peça
  res.is_outlet = restoNorm.includes("outlet");
  res.is_xtra = /\bxtra\b/.test(restoNorm);
  res.tipo_peca = res.is_outlet || /\blisas?\b/.test(restoNorm) ? "LISA" : "ESTAMPADA";

  // 6. modelo base (mais longo primeiro)
  for (const m of MODELOS_BASE) {
    if (restoNorm.includes(norm(m))) {
      res.modelo_base = m;
      break;
    }
  }
  if (!res.modelo_base) {
    res.ok = false;
    res.motivo = res.motivo ? `${res.motivo} · Modelo não reconhecido` : "Modelo não reconhecido";
  }

  // 7. estampa (só para peça estampada)
  if (res.tipo_peca === "ESTAMPADA") {
    let e = restoTexto;
    if (res.modelo_base) e = e.replace(new RegExp(escapeRe(res.modelo_base), "i"), " ");
    e = e
      .replace(/thermo\s*air/gi, " ")
      .replace(/\bkits?\b/gi, " ")
      .replace(/\blisas?\b/gi, " ")
      .replace(/\boutlet\b/gi, " ")
      .replace(/\bxtra\b/gi, " ")
      .replace(/[-–—]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    res.estampa = e.length > 0 ? e : null;
  } else {
    res.estampa = null;
  }

  return res;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ------------------------------------------------------------------ */
/* Agregações                                                          */
/* ------------------------------------------------------------------ */

const NAO_CLASSIFICADO = "Não classificado";

function store(i: ItemCalc): ProdutoStore {
  const s = (i as ItemStoreCalc).store;
  return s ?? parseProdutoStore(i.descricao_original ?? i.produto_olist);
}

export type DimRankingStore = "modelo_base" | "estampa" | "cor" | "tamanho" | "peca";

function chaveStore(i: ItemCalc, s: ProdutoStore, dim: DimRankingStore): string | null {
  if (dim === "modelo_base") return s.modelo_base ?? NAO_CLASSIFICADO;
  if (dim === "estampa") return s.tipo_peca === "ESTAMPADA" ? (s.estampa ?? NAO_CLASSIFICADO) : null;
  if (dim === "cor") return s.cor ?? i.cor ?? NAO_CLASSIFICADO;
  if (dim === "tamanho") return s.tamanho ?? i.tamanho ?? NAO_CLASSIFICADO;
  const modelo = s.modelo_base ?? NAO_CLASSIFICADO;
  const cor = s.cor ?? i.cor ?? "—";
  const tam = s.tamanho ?? i.tamanho ?? "—";
  const marca = s.tipo_peca === "LISA" ? "Lisa" : "Estampada";
  return `${modelo} · ${cor} · ${tam} (${marca})`;
}

/** Ranking da Store. "estampa" considera só itens ESTAMPADA. */
export function rankingStore(pedidos: PedidoFiltrado[], dim: DimRankingStore): LinhaRanking[] {
  const map = new Map<string, LinhaRanking & { _pedidos: Set<string> }>();
  for (const p of pedidos) {
    for (const i of p.itensSel) {
      if (i.is_servico) continue;
      const s = store(i);
      const k = chaveStore(i, s, dim);
      if (!k) continue;
      const l =
        map.get(k) ??
        {
          chave: k,
          modelo: s.modelo_base,
          cor: s.cor ?? i.cor,
          tamanho: s.tamanho ?? i.tamanho,
          pecas: 0,
          faturamento: 0,
          pedidos: 0,
          percPecas: 0,
          percFaturamento: 0,
          _pedidos: new Set<string>(),
        };
      l.pecas += i.qtd;
      l.faturamento += i.subtotal;
      l._pedidos.add(p.numero_pedido);
      map.set(k, l);
    }
  }
  const linhas = [...map.values()];
  const totPecas = linhas.reduce((s, l) => s + l.pecas, 0);
  const totFat = linhas.reduce((s, l) => s + l.faturamento, 0);
  return linhas
    .map(({ _pedidos, ...l }) => ({
      ...l,
      pedidos: _pedidos.size,
      percPecas: totPecas ? (l.pecas / totPecas) * 100 : 0,
      percFaturamento: totFat ? (l.faturamento / totFat) * 100 : 0,
    }))
    .sort((a, b) => b.pecas - a.pecas);
}

export interface ComposicaoStore {
  lisas: { faturamento: number; pecas: number; pedidos: number; ticket: number; precoMedio: number; percFaturamento: number };
  estampadas: { faturamento: number; pecas: number; pedidos: number; ticket: number; precoMedio: number; percFaturamento: number };
  /** Subconjunto das lisas. */
  outlet: { faturamento: number; pecas: number; pedidos: number; precoMedio: number; percFaturamento: number };
}

export function composicaoStore(pedidos: PedidoFiltrado[]): ComposicaoStore {
  const acc = {
    lisas: { faturamento: 0, pecas: 0, ped: new Set<string>() },
    estampadas: { faturamento: 0, pecas: 0, ped: new Set<string>() },
    outlet: { faturamento: 0, pecas: 0, ped: new Set<string>() },
  };
  for (const p of pedidos) {
    for (const i of p.itensSel) {
      if (i.is_servico) continue;
      const s = store(i);
      const alvo = s.tipo_peca === "LISA" ? acc.lisas : acc.estampadas;
      alvo.faturamento += i.subtotal;
      alvo.pecas += i.qtd;
      alvo.ped.add(p.numero_pedido);
      if (s.is_outlet) {
        acc.outlet.faturamento += i.subtotal;
        acc.outlet.pecas += i.qtd;
        acc.outlet.ped.add(p.numero_pedido);
      }
    }
  }
  const total = acc.lisas.faturamento + acc.estampadas.faturamento;
  const perc = (v: number) => (total ? (v / total) * 100 : 0);
  const bloco = (b: { faturamento: number; pecas: number; ped: Set<string> }) => ({
    faturamento: b.faturamento,
    pecas: b.pecas,
    pedidos: b.ped.size,
    ticket: b.ped.size ? b.faturamento / b.ped.size : 0,
    precoMedio: b.pecas ? b.faturamento / b.pecas : 0,
    percFaturamento: perc(b.faturamento),
  });
  const l = bloco(acc.lisas);
  const e = bloco(acc.estampadas);
  const o = bloco(acc.outlet);
  return {
    lisas: l,
    estampadas: e,
    outlet: { faturamento: o.faturamento, pecas: o.pecas, pedidos: o.pedidos, precoMedio: o.precoMedio, percFaturamento: o.percFaturamento },
  };
}

export interface DescricaoForaPadrao {
  descricao: string;
  motivo: string;
  linhas: number;
  pecas: number;
}

export function descricoesForaPadrao(pedidos: PedidoFiltrado[]): DescricaoForaPadrao[] {
  const map = new Map<string, DescricaoForaPadrao>();
  for (const p of pedidos) {
    for (const i of p.itensSel) {
      if (i.is_servico) continue;
      const s = store(i);
      if (s.ok) continue;
      const desc = (i.descricao_original ?? i.produto_olist ?? "—").trim();
      const l = map.get(desc) ?? { descricao: desc, motivo: s.motivo ?? "Fora do padrão", linhas: 0, pecas: 0 };
      l.linhas += 1;
      l.pecas += i.qtd;
      map.set(desc, l);
    }
  }
  return [...map.values()].sort((a, b) => b.pecas - a.pecas);
}
