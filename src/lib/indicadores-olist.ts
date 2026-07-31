/**
 * Agregações do Painel de Indicadores (Olist).
 *
 * Todas as funções aqui são puras: recebem os registros já lidos do banco e
 * devolvem os números prontos. A tela só apresenta; a exportação em PDF
 * (fase 6) reaproveita as mesmas funções.
 *
 * Regras obrigatórias:
 *  - Faturamento = Σ líquido do pedido. Frete e despesas NUNCA entram.
 *  - subtotal_item   = qtd × valor_unitario − desconto_item
 *  - subtotal_pedido = Σ subtotal_item
 *  - liquido_pedido  = subtotal_pedido − desconto_valor
 *                      − (subtotal_pedido × desconto_percentual / 100)
 *    (o percentual incide sobre o subtotal DEPOIS dos descontos de item;
 *     desconto_valor e desconto_percentual são mutuamente exclusivos)
 *  - Peças = Σ qtd apenas de itens com is_servico = false.
 *  - Tamanhos sempre na ordem de REFACAO_TAMANHOS; modelo/cor com cmpModelo/cmpCor.
 */

import { REFACAO_TAMANHOS, cmpModelo, cmpCor } from "@/lib/pedidos";

export type EmpresaFiltro = "CONSOLIDADO" | "JOKE" | "JUFF";
export type Grupo = "casados" | "so_olist" | "excluidos" | "so_pcp";

export interface PedidoDb {
  numero_pedido: string;
  lote_id: string;
  empresa: string;
  data: string | null;
  nome_contato: string | null;
  cpf_cnpj: string | null;
  situacao: string | null;
  vendedor: string | null;
  desconto_valor: number | null;
  desconto_percentual: number | null;
  frete: number | null;
  despesas: number | null;
}

export interface ItemDb {
  numero_pedido: string;
  lote_id: string;
  produto_olist: string | null;
  cor: string | null;
  tamanho: string | null;
  qtd: number | null;
  valor_unitario: number | null;
  desconto_item: number | null;
  is_servico: boolean | null;
}

export interface ItemCalc {
  produto_olist: string | null;
  modelo: string | null;
  cor: string | null;
  tamanho: string | null;
  qtd: number;
  is_servico: boolean;
  /** qtd × valor_unitario − desconto_item */
  subtotal: number;
}

export interface PedidoCalc {
  numero_pedido: string;
  empresa: string;
  data: string | null;
  mes: string | null; // AAAA-MM
  cliente_id: string; // cpf_cnpj quando existe, senão nome
  cliente_nome: string;
  situacao: string;
  vendedor: string;
  frete: number;
  despesas: number;
  desconto_valor: number;
  desconto_percentual: number;
  itens: ItemCalc[];
  subtotal: number;
  /** desconto_valor + subtotal × desconto_percentual / 100 */
  desconto_pedido: number;
  liquido: number;
  pecas: number;
}

/** Pedido depois dos filtros de item (modelo/cor/tamanho). */
export interface PedidoFiltrado extends PedidoCalc {
  itensSel: ItemCalc[];
  /** líquido correspondente apenas aos itens selecionados */
  liquidoSel: number;
  pecasSel: number;
}

export interface Filtros {
  de: string; // AAAA-MM-DD
  ate: string; // AAAA-MM-DD
  empresa: EmpresaFiltro;
  vendedores: string[];
  modelos: string[];
  cores: string[];
  tamanhos: string[];
  situacoes: string[];
  grupos: Grupo[];
}

/* ------------------------------------------------------------------ */
/* Preparação                                                          */
/* ------------------------------------------------------------------ */

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v ?? 0) || 0);

/** Junta pedidos + itens (já vigentes) e calcula subtotais e líquido. */
export function calcularPedidos(
  pedidos: PedidoDb[],
  itens: ItemDb[],
  modeloPorProduto: Map<string, string>,
): PedidoCalc[] {
  const porPedido = new Map<string, ItemCalc[]>();
  for (const it of itens) {
    const qtd = n(it.qtd);
    const subtotal = qtd * n(it.valor_unitario) - n(it.desconto_item);
    const produto = it.produto_olist ?? null;
    const arr = porPedido.get(it.numero_pedido) ?? [];
    arr.push({
      produto_olist: produto,
      modelo: produto ? (modeloPorProduto.get(produto) ?? null) : null,
      cor: it.cor ?? null,
      tamanho: it.tamanho ?? null,
      qtd,
      is_servico: !!it.is_servico,
      subtotal,
    });
    porPedido.set(it.numero_pedido, arr);
  }

  return pedidos.map((p) => {
    const its = porPedido.get(p.numero_pedido) ?? [];
    const subtotal = its.reduce((s, i) => s + i.subtotal, 0);
    const dv = n(p.desconto_valor);
    const dp = n(p.desconto_percentual);
    const desconto_pedido = dv + (subtotal * dp) / 100;
    const nome = (p.nome_contato ?? "").trim();
    const doc = (p.cpf_cnpj ?? "").replace(/\D/g, "");
    return {
      numero_pedido: p.numero_pedido,
      empresa: p.empresa,
      data: p.data,
      mes: p.data ? p.data.slice(0, 7) : null,
      cliente_id: doc || nome.toUpperCase() || "—",
      cliente_nome: nome || doc || "—",
      situacao: (p.situacao ?? "").trim() || "—",
      vendedor: (p.vendedor ?? "").trim() || "Outros",
      frete: n(p.frete),
      despesas: n(p.despesas),
      desconto_valor: dv,
      desconto_percentual: dp,
      itens: its,
      subtotal,
      desconto_pedido,
      liquido: subtotal - desconto_pedido,
      pecas: its.filter((i) => !i.is_servico).reduce((s, i) => s + i.qtd, 0),
    };
  });
}

/**
 * Primeira compra de cada cliente sobre o HISTÓRICO COMPLETO (sem filtro de
 * período). Quem comprou em março não é "novo" em julho.
 */
export function primeiraCompraPorCliente(todos: PedidoCalc[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of todos) {
    if (!p.data) continue;
    const atual = map.get(p.cliente_id);
    if (!atual || p.data < atual) map.set(p.cliente_id, p.data);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Filtros                                                            */
/* ------------------------------------------------------------------ */

export function aplicarFiltros(
  pedidos: PedidoCalc[],
  f: Filtros,
  ctx: { excluidos: Set<string>; noPcp: Set<string> },
): PedidoFiltrado[] {
  const temVend = f.vendedores.length > 0;
  const temSit = f.situacoes.length > 0;
  const temMod = f.modelos.length > 0;
  const temCor = f.cores.length > 0;
  const temTam = f.tamanhos.length > 0;
  const grupos = new Set(f.grupos);
  const out: PedidoFiltrado[] = [];

  for (const p of pedidos) {
    if (p.data && (p.data < f.de || p.data > f.ate)) continue;
    if (!p.data) continue;
    if (f.empresa !== "CONSOLIDADO" && p.empresa !== f.empresa) continue;
    if (temVend && !f.vendedores.includes(p.vendedor)) continue;
    if (temSit && !f.situacoes.includes(p.situacao)) continue;

    const excluido = ctx.excluidos.has(p.numero_pedido);
    const casado = ctx.noPcp.has(p.numero_pedido);
    const grupo: Grupo = excluido ? "excluidos" : casado ? "casados" : "so_olist";
    if (!grupos.has(grupo)) continue;

    const itensSel = p.itens.filter(
      (i) =>
        (!temMod || (i.modelo != null && f.modelos.includes(i.modelo))) &&
        (!temCor || (i.cor != null && f.cores.includes(i.cor))) &&
        (!temTam || (i.tamanho != null && f.tamanhos.includes(i.tamanho))),
    );
    if ((temMod || temCor || temTam) && itensSel.length === 0) continue;

    const subSel = itensSel.reduce((s, i) => s + i.subtotal, 0);
    const fator = p.subtotal ? subSel / p.subtotal : 1;
    out.push({
      ...p,
      itensSel,
      liquidoSel: subSel - p.desconto_pedido * fator,
      pecasSel: itensSel.filter((i) => !i.is_servico).reduce((s, i) => s + i.qtd, 0),
    });
  }
  return out;
}

/** Período imediatamente anterior, de mesma duração. */
export function periodoAnterior(de: string, ate: string): { de: string; ate: string } {
  const d1 = new Date(`${de}T00:00:00`);
  const d2 = new Date(`${ate}T00:00:00`);
  const dias = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
  const fim = new Date(d1.getTime() - 86400000);
  const ini = new Date(fim.getTime() - (dias - 1) * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { de: iso(ini), ate: iso(fim) };
}

/* ------------------------------------------------------------------ */
/* Bloco 1 — Resumo                                                    */
/* ------------------------------------------------------------------ */

export interface Resumo {
  faturamento: number;
  pedidos: number;
  pecas: number;
  ticket: number;
  precoMedio: number;
}

export function resumo(pedidos: PedidoFiltrado[]): Resumo {
  const faturamento = pedidos.reduce((s, p) => s + p.liquidoSel, 0);
  const pecas = pedidos.reduce((s, p) => s + p.pecasSel, 0);
  // Preço médio por peça: serviços fora do numerador e do denominador.
  const receitaProdutos = pedidos.reduce(
    (s, p) => s + p.itensSel.filter((i) => !i.is_servico).reduce((t, i) => t + i.subtotal, 0),
    0,
  );
  return {
    faturamento,
    pedidos: pedidos.length,
    pecas,
    ticket: pedidos.length ? faturamento / pedidos.length : 0,
    precoMedio: pecas ? receitaProdutos / pecas : 0,
  };
}

export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/* ------------------------------------------------------------------ */
/* Bloco 2 — Faturamento                                               */
/* ------------------------------------------------------------------ */

export interface LinhaMes {
  mes: string;
  faturamento: number;
  joke: number;
  juff: number;
  pedidos: number;
  pecas: number;
}

export function evolucaoMensal(pedidos: PedidoFiltrado[]): LinhaMes[] {
  const map = new Map<string, LinhaMes>();
  for (const p of pedidos) {
    if (!p.mes) continue;
    const l =
      map.get(p.mes) ?? { mes: p.mes, faturamento: 0, joke: 0, juff: 0, pedidos: 0, pecas: 0 };
    l.faturamento += p.liquidoSel;
    if (p.empresa === "JOKE") l.joke += p.liquidoSel;
    if (p.empresa === "JUFF") l.juff += p.liquidoSel;
    l.pedidos += 1;
    l.pecas += p.pecasSel;
    map.set(p.mes, l);
  }
  return [...map.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

export interface LinhaChave {
  chave: string;
  faturamento: number;
  pedidos: number;
  pecas: number;
  perc: number;
}

export function porSituacao(pedidos: PedidoFiltrado[]): LinhaChave[] {
  const map = new Map<string, LinhaChave>();
  for (const p of pedidos) {
    const l = map.get(p.situacao) ?? { chave: p.situacao, faturamento: 0, pedidos: 0, pecas: 0, perc: 0 };
    l.faturamento += p.liquidoSel;
    l.pedidos += 1;
    l.pecas += p.pecasSel;
    map.set(p.situacao, l);
  }
  const total = [...map.values()].reduce((s, l) => s + l.faturamento, 0);
  return [...map.values()]
    .map((l) => ({ ...l, perc: total ? (l.faturamento / total) * 100 : 0 }))
    .sort((a, b) => b.faturamento - a.faturamento);
}

/* ------------------------------------------------------------------ */
/* Rankings (bloco 12) e composição de produto (bloco 3)               */
/* ------------------------------------------------------------------ */

export interface LinhaRanking {
  chave: string;
  modelo?: string | null;
  cor?: string | null;
  tamanho?: string | null;
  pecas: number;
  faturamento: number;
  pedidos: number;
  percPecas: number;
  percFaturamento: number;
}

export type DimRanking = "modelo" | "cor" | "tamanho" | "peca";

function chaveDim(i: ItemCalc, dim: DimRanking): string | null {
  if (dim === "modelo") return i.modelo;
  if (dim === "cor") return i.cor;
  if (dim === "tamanho") return i.tamanho;
  if (!i.modelo || !i.cor || !i.tamanho) return null;
  return `${i.modelo} · ${i.cor} · ${i.tamanho}`;
}

/** Ranking por dimensão. Itens de serviço e sem mapeamento ficam fora. */
export function ranking(pedidos: PedidoFiltrado[], dim: DimRanking): LinhaRanking[] {
  const map = new Map<string, LinhaRanking & { _pedidos: Set<string> }>();
  for (const p of pedidos) {
    for (const i of p.itensSel) {
      if (i.is_servico) continue;
      if (!i.modelo) continue; // sem mapeamento fica fora dos rankings
      const k = chaveDim(i, dim);
      if (!k) continue;
      const l =
        map.get(k) ??
        {
          chave: k,
          modelo: i.modelo,
          cor: i.cor,
          tamanho: i.tamanho,
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

export type OrdemRanking = "pecas" | "faturamento" | "pedidos";

export function ordenarRanking(linhas: LinhaRanking[], ordem: OrdemRanking, dim: DimRanking): LinhaRanking[] {
  const arr = [...linhas];
  if (dim === "tamanho" && ordem === "pecas") {
    // ordem por quantidade continua sendo por quantidade; o desempate usa a
    // ordem canônica de tamanho.
    return arr.sort((a, b) => b.pecas - a.pecas || cmpTamanho(a.chave, b.chave));
  }
  return arr.sort((a, b) => b[ordem] - a[ordem]);
}

const _TAM_IDX = new Map<string, number>(REFACAO_TAMANHOS.map((t, i) => [t, i]));

export function cmpTamanho(a: string, b: string): number {
  const ia = _TAM_IDX.get(a);
  const ib = _TAM_IDX.get(b);
  if (ia !== undefined && ib !== undefined) return ia - ib;
  if (ia !== undefined) return -1;
  if (ib !== undefined) return 1;
  return a.localeCompare(b, "pt-BR");
}

/** Curva ABC: A até 80%, B até 95%, C o resto. */
export interface LinhaABC extends LinhaRanking {
  acumulado: number;
  classe: "A" | "B" | "C";
}

export function curvaAbc(linhas: LinhaRanking[]): LinhaABC[] {
  const arr = [...linhas].sort((a, b) => b.faturamento - a.faturamento);
  const total = arr.reduce((s, l) => s + l.faturamento, 0);
  let acc = 0;
  return arr.map((l) => {
    acc += total ? (l.faturamento / total) * 100 : 0;
    return { ...l, acumulado: acc, classe: acc <= 80 ? "A" : acc <= 95 ? "B" : "C" };
  });
}

/** Grade cruzada: percentual de cada tamanho (ou cor) dentro de cada modelo. */
export interface GradeCruzada {
  colunas: string[];
  linhas: { modelo: string; total: number; celulas: Record<string, { pecas: number; perc: number }> }[];
}

export function gradePorModelo(pedidos: PedidoFiltrado[], dim: "tamanho" | "cor"): GradeCruzada {
  const porModelo = new Map<string, Map<string, number>>();
  const colunas = new Set<string>();
  for (const p of pedidos) {
    for (const i of p.itensSel) {
      if (i.is_servico || !i.modelo) continue;
      const col = dim === "tamanho" ? i.tamanho : i.cor;
      if (!col) continue;
      colunas.add(col);
      const m = porModelo.get(i.modelo) ?? new Map<string, number>();
      m.set(col, (m.get(col) ?? 0) + i.qtd);
      porModelo.set(i.modelo, m);
    }
  }
  const cols = [...colunas].sort(dim === "tamanho" ? cmpTamanho : (a, b) => cmpCor(a, b));
  const linhas = [...porModelo.entries()]
    .sort((a, b) => cmpModelo(a[0], b[0]))
    .map(([modelo, m]) => {
      const total = [...m.values()].reduce((s, v) => s + v, 0);
      const celulas: Record<string, { pecas: number; perc: number }> = {};
      for (const c of cols) {
        const pecas = m.get(c) ?? 0;
        celulas[c] = { pecas, perc: total ? (pecas / total) * 100 : 0 };
      }
      return { modelo, total, celulas };
    });
  return { colunas: cols, linhas };
}

/* ------------------------------------------------------------------ */
/* Bloco 4 — Clientes                                                  */
/* ------------------------------------------------------------------ */

export interface LinhaCliente {
  cliente_id: string;
  nome: string;
  faturamento: number;
  pedidos: number;
  pecas: number;
  novo: boolean;
}

export function porCliente(
  pedidos: PedidoFiltrado[],
  primeiraCompra: Map<string, string>,
  de: string,
): LinhaCliente[] {
  const map = new Map<string, LinhaCliente>();
  for (const p of pedidos) {
    const l =
      map.get(p.cliente_id) ??
      {
        cliente_id: p.cliente_id,
        nome: p.cliente_nome,
        faturamento: 0,
        pedidos: 0,
        pecas: 0,
        // "novo" só quando a PRIMEIRA compra de todos os tempos cai no período
        novo: (primeiraCompra.get(p.cliente_id) ?? "") >= de,
      };
    l.faturamento += p.liquidoSel;
    l.pedidos += 1;
    l.pecas += p.pecasSel;
    map.set(p.cliente_id, l);
  }
  return [...map.values()].sort((a, b) => b.faturamento - a.faturamento);
}

export function abcClientes(clientes: LinhaCliente[]) {
  const total = clientes.reduce((s, c) => s + c.faturamento, 0);
  let acc = 0;
  return clientes.map((c) => {
    acc += total ? (c.faturamento / total) * 100 : 0;
    return { ...c, perc: total ? (c.faturamento / total) * 100 : 0, acumulado: acc, classe: acc <= 80 ? "A" : acc <= 95 ? "B" : "C" };
  });
}

/* ------------------------------------------------------------------ */
/* Bloco 5 — Vendedores                                                */
/* ------------------------------------------------------------------ */

export interface LinhaVendedor {
  vendedor: string;
  faturamento: number;
  pedidos: number;
  pecas: number;
  ticket: number;
  /** desconto concedido em reais (item + pedido) */
  descontoValor: number;
  /** desconto em % sobre o subtotal bruto — base única e comparável */
  descontoPerc: number;
}

export function porVendedor(pedidos: PedidoFiltrado[]): LinhaVendedor[] {
  const map = new Map<
    string,
    LinhaVendedor & { _bruto: number; _descTotal: number }
  >();
  for (const p of pedidos) {
    const l =
      map.get(p.vendedor) ??
      {
        vendedor: p.vendedor,
        faturamento: 0,
        pedidos: 0,
        pecas: 0,
        ticket: 0,
        descontoValor: 0,
        descontoPerc: 0,
        _bruto: 0,
        _descTotal: 0,
      };
    l.faturamento += p.liquidoSel;
    l.pedidos += 1;
    l.pecas += p.pecasSel;
    // Base única: desconto do pedido convertido para reais e comparado ao
    // subtotal, para que 13% e R$ 200 sejam comparáveis.
    l._bruto += p.subtotal;
    l._descTotal += p.desconto_pedido;
    map.set(p.vendedor, l);
  }
  return [...map.values()]
    .map(({ _bruto, _descTotal, ...l }) => ({
      ...l,
      ticket: l.pedidos ? l.faturamento / l.pedidos : 0,
      descontoValor: _descTotal,
      descontoPerc: _bruto ? (_descTotal / _bruto) * 100 : 0,
    }))
    .sort((a, b) => b.faturamento - a.faturamento);
}

/* ------------------------------------------------------------------ */
/* Bloco 10 — Frete (sempre separado do faturamento)                   */
/* ------------------------------------------------------------------ */

export interface ResumoFrete {
  total: number;
  medio: number;
  percComFrete: number;
  porUf: { uf: string; frete: number; pedidos: number; faturamento: number; pecas: number }[];
}

/** A UF vem SEMPRE do PCP (pedidos.uf_entrega), nunca do arquivo da Olist. */
export function resumoFrete(pedidos: PedidoFiltrado[], ufPorPedido: Map<string, string>): ResumoFrete {
  const total = pedidos.reduce((s, p) => s + p.frete, 0);
  const comFrete = pedidos.filter((p) => p.frete > 0).length;
  const map = new Map<string, { uf: string; frete: number; pedidos: number; faturamento: number; pecas: number }>();
  for (const p of pedidos) {
    const uf = (ufPorPedido.get(p.numero_pedido) ?? "").toUpperCase() || "—";
    const l = map.get(uf) ?? { uf, frete: 0, pedidos: 0, faturamento: 0, pecas: 0 };
    l.frete += p.frete;
    l.pedidos += 1;
    l.faturamento += p.liquidoSel;
    l.pecas += p.pecasSel;
    map.set(uf, l);
  }
  return {
    total,
    medio: pedidos.length ? total / pedidos.length : 0,
    percComFrete: pedidos.length ? (comFrete / pedidos.length) * 100 : 0,
    porUf: [...map.values()].sort((a, b) => b.frete - a.frete),
  };
}

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */

export const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
export const fmtNum = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
export const fmtPerc = (v: number | null) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
export const fmtMes = (mes: string) => {
  const [a, m] = mes.split("-");
  return `${m}/${a.slice(2)}`;
};
