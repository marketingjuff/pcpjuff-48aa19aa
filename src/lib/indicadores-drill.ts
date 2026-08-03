/**
 * Detalhamento (drill-down) do Painel de Indicadores.
 *
 * Funções PURAS que recebem exatamente as mesmas fontes já disponíveis no
 * componente e devolvem as linhas individuais que formam cada número agregado.
 *
 * Regras obrigatórias (espelham `indicadores-olist.ts`, que NÃO é alterado):
 *  - Casamento Olist ↔ PCP pela BASE do `pedido_olist`: parciais do PCP
 *    (`3996A`, `3996B`) pertencem ao pedido `3996` da Olist. `orcamento` é
 *    coluna informativa, nunca chave.

 *  - Campo de saída é `saida_juff`.
 *  - Prazos sempre em dias úteis com feriados (`diasUteisEntre`).
 *  - Peças perdidas de um pedido = Σ `perda_pecas` dos episódios
 *    (`perdaPecasPcp`). `perda_adesivos` e `qtd_falta_adesivos` aparecem em
 *    colunas próprias e NUNCA são somados com contagem de peças nem entre si.
 */

import { diasUteisEntre, todayISO, type Feriados } from "@/lib/dias-uteis";
import { ETAPA_DESTINO_LABEL } from "@/lib/pedidos";
import {
  perdaPecasPcp,
  type ItemCalc,
  type PcpDb,
  type PedidoFiltrado,
} from "@/lib/indicadores-olist";
import { resolveNome } from "@/hooks/use-profiles-map";
import { basePedidoOlist, sufixoParcial } from "@/lib/pedido-olist-match";


/* ------------------------------------------------------------------ */
/* Contrato                                                            */
/* ------------------------------------------------------------------ */

export type DrillTipo = "texto" | "numero" | "moeda" | "data" | "perc" | "dias";

export interface DrillColuna {
  chave: string;
  label: string;
  tipo: DrillTipo;
  align?: "left" | "right" | "center";
  /** Se true, entra na soma do rodapé (só uma coluna por payload). */
  somar?: boolean;
}

export type DrillLinha = Record<string, string | number | null>;

export interface DrillPayload {
  titulo: string;
  subtitulo?: string;
  nota?: string;
  colunas: DrillColuna[];
  linhas: DrillLinha[];
  /** Valor do indicador clicado, já formatado, para o rodapé de conferência. */
  indicadorLabel: string;
  /** Valor numérico do indicador clicado (null quando não numérico). */
  indicadorValor: number | null;
  /** Soma (ou média) das linhas na coluna marcada como `somar`. */
  totalConferencia: number | null;
  /** Tipo da coluna de conferência, para formatar o rodapé. */
  conferenciaTipo?: DrillTipo;
}

/** Registro do PCP com as colunas extras usadas apenas no detalhamento. */
export type PcpDrill = PcpDb & {
  id?: string | null;
  orcamento?: string | null;
  vendedor?: string | null;
  tipo_estampa?: string | null;
  data_saida_juff?: string | null;
  reaberto?: boolean | null;
  status_pecas?: string | null;
};

export type Nomes = Record<string, string>;

/* ------------------------------------------------------------------ */
/* Utilidades internas                                                 */
/* ------------------------------------------------------------------ */

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v ?? 0) || 0);
const txt = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s || null;
};

function somaCol(linhas: DrillLinha[], chave: string): number {
  return linhas.reduce((s, l) => s + num(l[chave]), 0);
}

function fechar(
  base: Omit<DrillPayload, "totalConferencia" | "conferenciaTipo">,
  conf: { chave: string | null; media?: boolean } | null,
): DrillPayload {
  const colConf = conf?.chave ? base.colunas.find((c) => c.chave === conf.chave) : null;
  let total: number | null = null;
  if (conf === null) total = base.linhas.length;
  else if (conf.chave) {
    const s = somaCol(base.linhas, conf.chave);
    total = conf.media ? (base.linhas.length ? s / base.linhas.length : 0) : s;
  }
  return { ...base, totalConferencia: total, conferenciaTipo: colConf?.tipo ?? "numero" };
}

const COL_PEDIDO_OLIST: DrillColuna[] = [
  { chave: "pedido", label: "Nº pedido", tipo: "texto" },
  { chave: "data", label: "Data", tipo: "data" },
  { chave: "empresa", label: "Empresa", tipo: "texto" },
  { chave: "cliente", label: "Cliente", tipo: "texto" },
  { chave: "vendedor", label: "Vendedor", tipo: "texto" },
  { chave: "situacao", label: "Situação", tipo: "texto" },
  { chave: "pecas", label: "Peças", tipo: "numero", align: "right", somar: true },
  { chave: "faturamento", label: "Faturamento", tipo: "moeda", align: "right" },
];

function linhaPedido(p: PedidoFiltrado): DrillLinha {
  return {
    pedido: p.numero_pedido,
    data: p.data,
    empresa: p.empresa,
    cliente: p.cliente_nome,
    vendedor: p.vendedor,
    situacao: p.situacao,
    pecas: p.pecasSel,
    faturamento: p.liquidoSel,
  };
}

/* ------------------------------------------------------------------ */
/* Blocos Olist — pedidos                                              */
/* ------------------------------------------------------------------ */

export type CampoPedido = "faturamento" | "pecas" | "linhas" | "frete";

export interface OpcoesPedidos {
  titulo: string;
  subtitulo?: string;
  nota?: string;
  indicadorLabel: string;
  indicadorValor: number | null;
  /** Campo somado no rodapé. `linhas` = contagem de pedidos. */
  campo: CampoPedido;
  /** Quando true, a conferência é a média do campo (ticket, preço médio). */
  media?: boolean;
  /** Inclui colunas de UF (PCP) e frete. */
  ufPorPedido?: Map<string, string>;
}

export function drillPedidos(pedidos: PedidoFiltrado[], o: OpcoesPedidos): DrillPayload {
  const comUf = !!o.ufPorPedido;
  const colunas: DrillColuna[] = [
    ...COL_PEDIDO_OLIST.map((c) => ({ ...c, somar: c.chave === o.campo })),
    ...(comUf
      ? ([
          { chave: "uf", label: "UF (PCP)", tipo: "texto" },
          { chave: "frete", label: "Frete", tipo: "moeda", align: "right", somar: o.campo === "frete" },
        ] as DrillColuna[])
      : []),
  ];

  const chaveOrdem = o.campo === "linhas" ? "faturamento" : o.campo;
  const linhas = pedidos
    .map((p) => {
      const l = linhaPedido(p);
      if (comUf) {
        l.uf = (o.ufPorPedido!.get(p.numero_pedido) ?? "").toUpperCase() || "—";
        l.frete = p.frete;
      }
      return l;
    })
    .sort((a, b) => num(b[chaveOrdem]) - num(a[chaveOrdem]));

  return fechar(
    {
      titulo: o.titulo,
      subtitulo: o.subtitulo,
      nota: o.nota,
      colunas,
      linhas,
      indicadorLabel: o.indicadorLabel,
      indicadorValor: o.indicadorValor,
    },
    o.campo === "linhas" ? null : { chave: o.campo, media: o.media },
  );
}

/* ------------------------------------------------------------------ */
/* Blocos Olist — itens                                                */
/* ------------------------------------------------------------------ */

export type CampoItem = "qtd" | "subtotal" | "pedidos";

export interface OpcoesItens {
  titulo: string;
  subtitulo?: string;
  nota?: string;
  indicadorLabel: string;
  indicadorValor: number | null;
  campo: CampoItem;
  /** Filtro do item. Serviços e itens sem modelo já saem antes (como no agregado). */
  filtro: (i: ItemCalc) => boolean;
}

/** Itens que compõem uma chave de ranking / grade / composição de produto. */
export function drillItens(pedidos: PedidoFiltrado[], o: OpcoesItens): DrillPayload {
  const colunas: DrillColuna[] = [
    { chave: "pedido", label: "Nº pedido", tipo: "texto" },
    { chave: "data", label: "Data", tipo: "data" },
    { chave: "cliente", label: "Cliente", tipo: "texto" },
    { chave: "produto", label: "Produto Olist", tipo: "texto" },
    { chave: "modelo", label: "Modelo", tipo: "texto" },
    { chave: "cor", label: "Cor", tipo: "texto" },
    { chave: "tamanho", label: "Tamanho", tipo: "texto" },
    { chave: "qtd", label: "Qtd", tipo: "numero", align: "right", somar: o.campo === "qtd" },
    { chave: "subtotal", label: "Subtotal", tipo: "moeda", align: "right", somar: o.campo === "subtotal" },
  ];

  const linhas: DrillLinha[] = [];
  const pedidosUnicos = new Set<string>();
  for (const p of pedidos) {
    for (const i of p.itensSel) {
      if (i.is_servico || !i.modelo) continue;
      if (!o.filtro(i)) continue;
      pedidosUnicos.add(p.numero_pedido);
      linhas.push({
        pedido: p.numero_pedido,
        data: p.data,
        cliente: p.cliente_nome,
        produto: i.produto_olist,
        modelo: i.modelo,
        cor: i.cor,
        tamanho: i.tamanho,
        qtd: i.qtd,
        subtotal: i.subtotal,
      });
    }
  }
  const chaveOrdem = o.campo === "pedidos" ? "qtd" : o.campo;
  linhas.sort((a, b) => num(b[chaveOrdem]) - num(a[chaveOrdem]));

  const base = {
    titulo: o.titulo,
    subtitulo: o.subtitulo,
    nota: o.nota,
    colunas,
    linhas,
    indicadorLabel: o.indicadorLabel,
    indicadorValor: o.indicadorValor,
  };
  if (o.campo === "pedidos") {
    return { ...base, totalConferencia: pedidosUnicos.size, conferenciaTipo: "numero" };
  }
  return fechar(base, { chave: o.campo });
}

/* ------------------------------------------------------------------ */
/* Bloco 4 — clientes (lista de clientes)                              */
/* ------------------------------------------------------------------ */

export function drillClientes(
  clientes: { cliente_id: string; nome: string; pedidos: number; pecas: number; faturamento: number; novo: boolean }[],
  primeiraCompra: Map<string, string>,
  o: { titulo: string; subtitulo?: string; indicadorLabel: string; indicadorValor: number | null },
): DrillPayload {
  const colunas: DrillColuna[] = [
    { chave: "cliente", label: "Cliente", tipo: "texto" },
    { chave: "documento", label: "CPF/CNPJ", tipo: "texto" },
    { chave: "primeira", label: "1ª compra (histórico)", tipo: "data" },
    { chave: "pedidos", label: "Pedidos", tipo: "numero", align: "right" },
    { chave: "pecas", label: "Peças", tipo: "numero", align: "right" },
    { chave: "faturamento", label: "Faturamento no período", tipo: "moeda", align: "right" },
  ];
  const linhas: DrillLinha[] = clientes
    .map((c) => ({
      cliente: c.nome,
      documento: c.cliente_id,
      primeira: primeiraCompra.get(c.cliente_id) ?? null,
      pedidos: c.pedidos,
      pecas: c.pecas,
      faturamento: c.faturamento,
    }))
    .sort((a, b) => num(b.faturamento) - num(a.faturamento));

  return fechar(
    { ...o, colunas, linhas },
    null,
  );
}

/* ------------------------------------------------------------------ */
/* Bloco 7 — Vendido × Produzido                                       */
/* ------------------------------------------------------------------ */

export type CampoVxp = "vendidas" | "produzidas" | "perdidas" | "diferenca" | "linhas";

export function drillVendidoProduzido(
  pedidos: PedidoFiltrado[],
  pcpPorPedido: Map<string, PcpDb>,
  o: {
    titulo: string;
    subtitulo?: string;
    indicadorLabel: string;
    indicadorValor: number | null;
    campo: CampoVxp;
    mes?: string | null;
  },
): DrillPayload {
  const colunas: DrillColuna[] = [
    { chave: "pedido", label: "Nº pedido", tipo: "texto" },
    { chave: "data", label: "Data", tipo: "data" },
    { chave: "cliente", label: "Cliente", tipo: "texto" },
    { chave: "vendidas", label: "Peças vendidas (Olist)", tipo: "numero", align: "right", somar: o.campo === "vendidas" },
    { chave: "produzidas", label: "Peças produzidas (PCP)", tipo: "numero", align: "right", somar: o.campo === "produzidas" },
    { chave: "perdidas", label: "Peças perdidas", tipo: "numero", align: "right", somar: o.campo === "perdidas" },
    { chave: "diferenca", label: "Diferença", tipo: "numero", align: "right", somar: o.campo === "diferenca" },
  ];

  const linhas: DrillLinha[] = [];
  for (const p of pedidos) {
    const pcp = pcpPorPedido.get(p.numero_pedido);
    if (!pcp) continue;
    if (o.mes && p.mes !== o.mes) continue;
    const vendidas = p.itens.filter((i) => !i.is_servico).reduce((s, i) => s + i.qtd, 0);
    const produzidas = num(pcp.qtd);
    linhas.push({
      pedido: p.numero_pedido,
      data: p.data,
      cliente: p.cliente_nome,
      vendidas,
      produzidas,
      perdidas: perdaPecasPcp(pcp),
      diferenca: produzidas - vendidas,
    });
  }
  const chaveOrdem = o.campo === "linhas" ? "vendidas" : o.campo;
  linhas.sort((a, b) => Math.abs(num(b[chaveOrdem])) - Math.abs(num(a[chaveOrdem])));

  return fechar(
    {
      titulo: o.titulo,
      subtitulo: o.subtitulo,
      nota: "Somente pedidos casados (existem na Olist e no PCP). Peças perdidas = Σ perda_pecas dos episódios de refação.",
      colunas,
      linhas,
      indicadorLabel: o.indicadorLabel,
      indicadorValor: o.indicadorValor,
    },
    o.campo === "linhas" ? null : { chave: o.campo },
  );
}

/* ------------------------------------------------------------------ */
/* Bloco 8 — Produção e prazo (só PCP)                                 */
/* ------------------------------------------------------------------ */

export const NOTA_BLOCO_PCP =
  "Bloco só PCP: filtros de empresa, vendedor, modelo, cor, tamanho e situação não valem aqui. Recorte pela entrada do pedido no período; prazos em dias úteis com feriados.";

const dias = (a: string | null | undefined, b: string | null | undefined, feriados: Feriados) =>
  a && b ? diasUteisEntre(a, b, feriados) : null;

const idPcp = (r: PcpDrill) => txt(r.pedido_olist) ?? "—";

/**
 * Uma linha por parcial (dado real de produção) + a que pedido da Olist ela
 * pertence. Parcial recebe marcador visual.
 */
const idsPcp = (r: PcpDrill) => {
  const registro = idPcp(r);
  const base = basePedidoOlist(r.pedido_olist);
  const parcial = sufixoParcial(r.pedido_olist) !== "";
  return {
    pedido: parcial ? `${registro} *` : registro,
    pedido_olist: base || "—",
  };
};

const COL_PCP_ID: DrillColuna[] = [
  { chave: "pedido", label: "Registro PCP", tipo: "texto" },
  { chave: "pedido_olist", label: "Pedido Olist", tipo: "texto" },
];

const COL_PCP_BASE: DrillColuna[] = [
  ...COL_PCP_ID,
  { chave: "orcamento", label: "Orçamento", tipo: "texto" },
  { chave: "vendedor", label: "Vendedor", tipo: "texto" },
  { chave: "tipo_estampa", label: "Tipo estampa", tipo: "texto" },
];


/** KPI "Pedidos no período". */
export function drillPcpPedidos(
  registros: PcpDrill[],
  o: { titulo: string; subtitulo?: string; indicadorLabel: string; indicadorValor: number | null },
): DrillPayload {
  const colunas: DrillColuna[] = [
    ...COL_PCP_BASE,
    { chave: "qtd", label: "Qtd", tipo: "numero", align: "right" },
    { chave: "entrada", label: "Entrada", tipo: "data" },
    { chave: "entrega", label: "Entrega", tipo: "data" },
    { chave: "saida", label: "Saída Juff", tipo: "data" },
  ];
  const linhas: DrillLinha[] = registros
    .map((r) => ({
      ...idsPcp(r),
      orcamento: txt(r.orcamento),
      vendedor: txt(r.vendedor),
      tipo_estampa: txt(r.tipo_estampa),
      qtd: num(r.qtd),
      entrada: r.entrada_pedido,
      entrega: r.data_entrega,
      saida: r.saida_juff,
    }))
    .sort((a, b) => String(b.entrada ?? "").localeCompare(String(a.entrada ?? "")));

  return fechar({ ...o, nota: NOTA_BLOCO_PCP, colunas, linhas }, null);
}

/** KPI "Prazo médio (entrada → saída)". */
export function drillPcpPrazo(
  registros: PcpDrill[],
  feriados: Feriados,
  o: { titulo: string; subtitulo?: string; indicadorLabel: string; indicadorValor: number | null },
): DrillPayload {
  const colunas: DrillColuna[] = [
    ...COL_PCP_BASE,
    { chave: "entrada", label: "Entrada", tipo: "data" },
    { chave: "saida", label: "Saída Juff", tipo: "data" },
    { chave: "prazo", label: "Prazo (d.ú.)", tipo: "dias", align: "right", somar: true },
  ];
  const linhas: DrillLinha[] = [];
  for (const r of registros) {
    const p = dias(r.entrada_pedido, r.saida_juff, feriados);
    if (p == null) continue;
    linhas.push({
      ...idsPcp(r),
      orcamento: txt(r.orcamento),
      vendedor: txt(r.vendedor),
      tipo_estampa: txt(r.tipo_estampa),
      entrada: r.entrada_pedido,
      saida: r.saida_juff,
      prazo: p,
    });
  }
  linhas.sort((a, b) => num(b.prazo) - num(a.prazo));
  return fechar({ ...o, nota: NOTA_BLOCO_PCP, colunas, linhas }, { chave: "prazo", media: true });
}

/** Tabela "Tempo médio por etapa". */
export const ETAPAS_DRILL: { etapa: string; de: keyof PcpDb; ate: keyof PcpDb; labelDe: string; labelAte: string }[] = [
  { etapa: "Arte", de: "entrada_pedido", ate: "arte_data", labelDe: "Entrada", labelAte: "Arte" },
  { etapa: "Estamparia", de: "inicio_estamparia", ate: "termino_estamparia", labelDe: "Início", labelAte: "Término" },
  { etapa: "Acabamento", de: "inicio_acabamento", ate: "termino_acabamento", labelDe: "Início", labelAte: "Término" },
  { etapa: "Expedição", de: "termino_acabamento", ate: "saida_juff", labelDe: "Término acabamento", labelAte: "Saída Juff" },
];

export function drillPcpEtapa(
  registros: PcpDrill[],
  feriados: Feriados,
  etapa: string,
  o: { titulo: string; subtitulo?: string; indicadorLabel: string; indicadorValor: number | null; contagem?: boolean },
): DrillPayload {
  const cfg = ETAPAS_DRILL.find((e) => e.etapa === etapa);
  const colunas: DrillColuna[] = [
    ...COL_PCP_BASE,
    { chave: "inicio", label: cfg?.labelDe ?? "Início", tipo: "data" },
    { chave: "fim", label: cfg?.labelAte ?? "Término", tipo: "data" },
    { chave: "diasUteis", label: "Dias (d.ú.)", tipo: "dias", align: "right", somar: true },
  ];
  const linhas: DrillLinha[] = [];
  if (cfg) {
    for (const r of registros) {
      const a = r[cfg.de] as string | null;
      const b = r[cfg.ate] as string | null;
      const d = dias(a, b, feriados);
      if (d == null) continue;
      linhas.push({
        ...idsPcp(r),
        orcamento: txt(r.orcamento),
        vendedor: txt(r.vendedor),
        tipo_estampa: txt(r.tipo_estampa),
        inicio: a,
        fim: b,
        diasUteis: d,
      });
    }
  }
  linhas.sort((a, b) => num(b.diasUteis) - num(a.diasUteis));
  return fechar(
    { ...o, nota: NOTA_BLOCO_PCP, colunas, linhas },
    o.contagem ? null : { chave: "diasUteis", media: true },
  );
}

/** KPI "Entregas no prazo". */
export function drillPcpEntregas(
  registros: PcpDrill[],
  feriados: Feriados,
  o: { titulo: string; subtitulo?: string; indicadorLabel: string; indicadorValor: number | null },
): DrillPayload {
  const colunas: DrillColuna[] = [
    ...COL_PCP_BASE,
    { chave: "entrega", label: "Entrega prometida", tipo: "data" },
    { chave: "saida", label: "Saída Juff", tipo: "data" },
    { chave: "no_prazo", label: "No prazo?", tipo: "texto", align: "center" },
    { chave: "desvio", label: "Desvio (d.ú.)", tipo: "dias", align: "right" },
  ];
  const linhas: DrillLinha[] = [];
  for (const r of registros) {
    if (!r.data_entrega || !r.saida_juff) continue;
    const noPrazo = r.saida_juff <= r.data_entrega;
    const desvio = noPrazo
      ? -diasUteisEntre(r.saida_juff, r.data_entrega, feriados)
      : diasUteisEntre(r.data_entrega, r.saida_juff, feriados);
    linhas.push({
      ...idsPcp(r),
      orcamento: txt(r.orcamento),
      vendedor: txt(r.vendedor),
      tipo_estampa: txt(r.tipo_estampa),
      entrega: r.data_entrega,
      saida: r.saida_juff,
      no_prazo: noPrazo ? "Sim" : "Não",
      desvio,
    });
  }
  linhas.sort((a, b) => num(b.desvio) - num(a.desvio));
  return fechar(
    {
      ...o,
      nota: `${NOTA_BLOCO_PCP} Desvio negativo significa adiantado.`,
      colunas,
      linhas,
    },
    null,
  );
}

/** KPI "Atraso médio" — só entregues em atraso. */
export function drillPcpAtraso(
  registros: PcpDrill[],
  feriados: Feriados,
  o: { titulo: string; subtitulo?: string; indicadorLabel: string; indicadorValor: number | null },
): DrillPayload {
  const colunas: DrillColuna[] = [
    ...COL_PCP_BASE,
    { chave: "entrega", label: "Entrega prometida", tipo: "data" },
    { chave: "saida", label: "Saída Juff", tipo: "data" },
    { chave: "atraso", label: "Dias de atraso (d.ú.)", tipo: "dias", align: "right", somar: true },
  ];
  const linhas: DrillLinha[] = [];
  for (const r of registros) {
    if (!r.data_entrega || !r.saida_juff) continue;
    if (r.saida_juff <= r.data_entrega) continue;
    linhas.push({
      ...idsPcp(r),
      orcamento: txt(r.orcamento),
      vendedor: txt(r.vendedor),
      tipo_estampa: txt(r.tipo_estampa),
      entrega: r.data_entrega,
      saida: r.saida_juff,
      atraso: diasUteisEntre(r.data_entrega, r.saida_juff, feriados),
    });
  }
  linhas.sort((a, b) => num(b.atraso) - num(a.atraso));
  return fechar({ ...o, nota: NOTA_BLOCO_PCP, colunas, linhas }, { chave: "atraso", media: true });
}

/** Pedidos atrasados (sem saída, entrega vencida) e pedidos em risco. */
export function drillPcpPendentes(
  registros: PcpDrill[],
  feriados: Feriados,
  modo: "atrasados" | "risco",
  o: { titulo: string; subtitulo?: string; indicadorLabel: string; indicadorValor: number | null },
  hojeIso: string = todayISO(),
): DrillPayload {
  const labelDias = modo === "atrasados" ? "Dias em atraso" : "Dias restantes";
  const colunas: DrillColuna[] = [
    ...COL_PCP_BASE,
    { chave: "entrega", label: "Entrega", tipo: "data" },
    { chave: "diasUteis", label: `${labelDias} (d.ú.)`, tipo: "dias", align: "right" },
    { chave: "qtd", label: "Qtd", tipo: "numero", align: "right" },
    { chave: "etapas", label: "Etapas já batidas", tipo: "texto" },
  ];

  const etapasBatidas = (r: PcpDrill) => {
    const marcos: [string, string | null | undefined][] = [
      ["Arte", r.arte_data],
      ["Estamparia", r.termino_estamparia],
      ["Acabamento", r.termino_acabamento],
      ["Saída", r.saida_juff],
    ];
    const feitas = marcos.filter(([, v]) => !!v).map(([k]) => k);
    return feitas.length ? feitas.join(" · ") : "—";
  };

  const linhas: DrillLinha[] = [];
  for (const r of registros) {
    if (!r.data_entrega || r.saida_juff) continue;
    const vencido = r.data_entrega < hojeIso;
    if (modo === "atrasados" && !vencido) continue;
    if (modo === "risco") {
      if (vencido) continue;
      const restantes = diasUteisEntre(hojeIso, r.data_entrega, feriados);
      if (restantes > 3) continue;
    }
    linhas.push({
      ...idsPcp(r),
      orcamento: txt(r.orcamento),
      vendedor: txt(r.vendedor),
      tipo_estampa: txt(r.tipo_estampa),
      entrega: r.data_entrega,
      diasUteis:
        modo === "atrasados"
          ? diasUteisEntre(r.data_entrega, hojeIso, feriados)
          : diasUteisEntre(hojeIso, r.data_entrega, feriados),
      qtd: num(r.qtd),
      etapas: etapasBatidas(r),
    });
  }
  linhas.sort((a, b) =>
    modo === "atrasados" ? num(b.diasUteis) - num(a.diasUteis) : num(a.diasUteis) - num(b.diasUteis),
  );
  return fechar({ ...o, nota: NOTA_BLOCO_PCP, colunas, linhas }, null);
}

/* ---- Refações ---- */

export type ModoRefacao = "episodios" | "refazer" | "perdidas";

export const NOTA_REFACOES =
  "Falta de adesivos e perda de adesivos ficam em colunas próprias e nunca são somadas com contagem de peças, nem entre si. Peças perdidas = perda_pecas do episódio.";

export function drillRefacoes(
  registros: PcpDrill[],
  nomes: Nomes,
  modo: ModoRefacao,
  area: string | null,
  o: { titulo: string; subtitulo?: string; indicadorLabel: string; indicadorValor: number | null },
): DrillPayload {
  const colunas: DrillColuna[] = [
    ...COL_PCP_ID,
    { chave: "orcamento", label: "Orçamento", tipo: "texto" },
    { chave: "data", label: "Data do episódio", tipo: "data" },
    { chave: "origem_destino", label: "Etapa origem → destino", tipo: "texto" },
    { chave: "quem", label: "Quem registrou", tipo: "texto" },
    { chave: "area_identificou", label: "Área que identificou", tipo: "texto" },
    { chave: "erro_producao", label: "Erro de produção?", tipo: "texto", align: "center" },
    { chave: "area_erro", label: "Área do erro", tipo: "texto" },
    { chave: "problema", label: "Problema", tipo: "texto" },
    { chave: "motivo", label: "Motivo", tipo: "texto" },
    { chave: "pecas_refazer", label: "Peças a refazer", tipo: "numero", align: "right", somar: modo === "refazer" },
    { chave: "perda_pecas", label: "Peças perdidas", tipo: "numero", align: "right", somar: modo === "perdidas" },
    ...(modo === "perdidas"
      ? ([{ chave: "detalhe_perdidas", label: "Detalhe das peças perdidas", tipo: "texto" }] as DrillColuna[])
      : []),
    { chave: "falta_adesivos", label: "Falta adesivos?", tipo: "texto", align: "center" },
    { chave: "qtd_falta_adesivos", label: "Qtd falta adesivos", tipo: "numero", align: "right" },
    { chave: "perda_adesivos", label: "Perda de adesivos", tipo: "numero", align: "right" },
    { chave: "situacao", label: "Situação", tipo: "texto", align: "center" },
    { chave: "fechado_em", label: "Fechado em", tipo: "data" },
  ];

  const linhas: DrillLinha[] = [];
  for (const r of registros) {
    for (const e of r.refacoes ?? []) {
      if (!e) continue;
      const areaEp = (e.area_erro || e.area_identificou || "—").trim() || "—";
      if (area != null && areaEp !== area) continue;
      const perda = num(e.perda_pecas);
      if (modo === "perdidas" && perda <= 0) continue;
      const detalhe = (e.pecas_perdidas ?? [])
        .map((x: any) => `${x?.modelo ?? "—"} · ${x?.cor ?? "—"} · ${x?.tamanho ?? "—"} · ${num(x?.qtd)}`)
        .join(" | ");
      linhas.push({
        ...idsPcp(r),
        orcamento: txt(r.orcamento),
        data: e.data ? String(e.data).slice(0, 10) : null,
        origem_destino: `${e.etapa_origem ?? "—"} → ${
          ETAPA_DESTINO_LABEL[e.etapa_destino as keyof typeof ETAPA_DESTINO_LABEL] ?? e.etapa_destino ?? "—"
        }`,
        quem: resolveNome(nomes, e.quem),
        area_identificou: txt(e.area_identificou) ?? "—",
        erro_producao: e.erro_producao == null ? "—" : e.erro_producao ? "Sim" : "Não",
        area_erro: txt(e.area_erro) ?? "—",
        problema: txt(e.problema) ?? "—",
        motivo: txt(e.motivo) ?? "—",
        pecas_refazer: num(e.pecas_refazer),
        perda_pecas: perda,
        ...(modo === "perdidas" ? { detalhe_perdidas: detalhe || "—" } : {}),
        falta_adesivos: e.falta_adesivos == null ? "—" : e.falta_adesivos ? "Sim" : "Não",
        qtd_falta_adesivos: num(e.qtd_falta_adesivos),
        perda_adesivos: num(e.perda_adesivos),
        situacao: e.aberto ? "Aberto" : "Fechado",
        fechado_em: e.fechado_em ? String(e.fechado_em).slice(0, 10) : null,
      });
    }
  }

  const chaveOrdem = modo === "perdidas" ? "perda_pecas" : modo === "refazer" ? "pecas_refazer" : "data";
  linhas.sort((a, b) =>
    chaveOrdem === "data"
      ? String(b.data ?? "").localeCompare(String(a.data ?? ""))
      : num(b[chaveOrdem]) - num(a[chaveOrdem]),
  );

  return fechar(
    {
      ...o,
      nota: `${NOTA_REFACOES} ${NOTA_BLOCO_PCP}`,
      colunas,
      linhas,
    },
    modo === "episodios" ? null : { chave: chaveOrdem },
  );
}

/* ---- Correções de etapa ---- */

export function drillCorrecoes(
  registros: PcpDrill[],
  nomes: Nomes,
  aba: string | null,
  o: { titulo: string; subtitulo?: string; indicadorLabel: string; indicadorValor: number | null },
): DrillPayload {
  const colunas: DrillColuna[] = [
    ...COL_PCP_ID,
    { chave: "orcamento", label: "Orçamento", tipo: "texto" },
    { chave: "quando", label: "Data/hora", tipo: "texto" },
    { chave: "usuario", label: "Usuário", tipo: "texto" },
    { chave: "aba", label: "Aba de origem", tipo: "texto" },
    { chave: "etapas", label: "Etapa anterior → nova", tipo: "texto" },
    { chave: "observacao", label: "Observação", tipo: "texto" },
  ];
  const linhas: DrillLinha[] = [];
  for (const r of registros) {
    for (const c of r.correcoes_etapa ?? []) {
      if (!c) continue;
      const abaC = (c.aba_origem ?? "—") as string;
      if (aba != null && abaC !== aba) continue;
      const d = c.data ? new Date(c.data) : null;
      linhas.push({
        ...idsPcp(r),
        orcamento: txt(r.orcamento),
        quando: d && !Number.isNaN(d.getTime()) ? d.toLocaleString("pt-BR") : (txt(c.data) ?? "—"),
        usuario: resolveNome(nomes, c.usuario_id),
        aba: abaC,
        etapas: `${c.etapa_anterior ?? "—"} → ${c.etapa_nova_apos_correcao ?? "—"}`,
        observacao: txt(c.observacao) ?? "—",
      });
    }
  }
  linhas.sort((a, b) => String(b.quando ?? "").localeCompare(String(a.quando ?? "")));
  return fechar({ ...o, nota: NOTA_BLOCO_PCP, colunas, linhas }, null);
}

/* ------------------------------------------------------------------ */
/* Bloco 9 — Saúde do cadastro                                         */
/* ------------------------------------------------------------------ */

export function drillSoOlist(
  pedidos: PedidoFiltrado[],
  numeros: string[],
  o: { titulo: string; indicadorLabel: string; indicadorValor: number | null },
): DrillPayload {
  const set = new Set(numeros);
  return drillPedidos(
    pedidos.filter((p) => set.has(p.numero_pedido)),
    {
      ...o,
      campo: "linhas",
      nota: NOTA_CASAMENTO,
    },
  );
}

export function drillSoPcp(
  registros: PcpDrill[],
  numeros: string[],
  o: { titulo: string; subtitulo?: string; indicadorLabel: string; indicadorValor: number | null },
): DrillPayload {
  /* `numeros` já são bases de pedido da Olist; cada parcial vira uma linha. */
  const set = new Set(numeros.map((n) => basePedidoOlist(n)));
  const colunas: DrillColuna[] = [
    ...COL_PCP_ID,
    { chave: "orcamento", label: "Orçamento", tipo: "texto" },
    { chave: "vendedor", label: "Vendedor", tipo: "texto" },
    { chave: "entrada", label: "Entrada", tipo: "data" },
    { chave: "entrega", label: "Entrega", tipo: "data" },
    { chave: "qtd", label: "Qtd", tipo: "numero", align: "right" },
  ];
  const vistos = new Set<string>();
  const basesVistas = new Set<string>();
  const linhas: DrillLinha[] = [];
  for (const r of registros) {
    const base = basePedidoOlist(r.pedido_olist);
    const registro = idPcp(r);
    if (!set.has(base) || vistos.has(registro)) continue;
    vistos.add(registro);
    basesVistas.add(base);
    linhas.push({
      ...idsPcp(r),
      orcamento: txt(r.orcamento),
      vendedor: txt(r.vendedor),
      entrada: r.entrada_pedido,
      entrega: r.data_entrega,
      qtd: num(r.qtd),
    });
  }
  for (const n of set) {
    if (basesVistas.has(n)) continue;
    basesVistas.add(n);
    linhas.push({
      pedido: n,
      pedido_olist: n,
      orcamento: null,
      vendedor: null,
      entrada: null,
      entrega: null,
      qtd: null,
    });
  }
  linhas.sort((a, b) => String(a.pedido ?? "").localeCompare(String(b.pedido ?? ""), "pt-BR"));

  return fechar(
    {
      ...o,
      nota: "Pedidos que existem no PCP e não na Olist. Sem item, preço ou cliente.",
      colunas,
      linhas,
    },
    null,
  );
}

export function drillSemMapeamento(
  itens: { produto: string; pecas: number; faturamento: number }[],
  o: { titulo: string; indicadorLabel: string; indicadorValor: number | null },
): DrillPayload {
  const colunas: DrillColuna[] = [
    { chave: "produto", label: "Produto Olist", tipo: "texto" },
    { chave: "pecas", label: "Peças", tipo: "numero", align: "right" },
    { chave: "faturamento", label: "Receita", tipo: "moeda", align: "right" },
  ];
  const linhas: DrillLinha[] = itens.map((s) => ({
    produto: s.produto,
    pecas: s.pecas,
    faturamento: s.faturamento,
  }));
  return fechar({ ...o, nota: "Produtos da Olist sem De/Para para modelo do COP.", colunas, linhas }, null);
}

export function drillDivergencias(
  divergencias: { pedido: string; olist: number; pcp: number; diferenca: number }[],
  pedidos: PedidoFiltrado[],
  o: { titulo: string; indicadorLabel: string; indicadorValor: number | null },
): DrillPayload {
  const porNum = new Map(pedidos.map((p) => [p.numero_pedido, p]));
  const colunas: DrillColuna[] = [
    { chave: "pedido", label: "Nº pedido", tipo: "texto" },
    { chave: "cliente", label: "Cliente", tipo: "texto" },
    { chave: "olist", label: "Olist", tipo: "numero", align: "right" },
    { chave: "pcp", label: "PCP", tipo: "numero", align: "right" },
    { chave: "diferenca", label: "Diferença", tipo: "numero", align: "right" },
  ];
  const linhas: DrillLinha[] = divergencias.map((d) => ({
    pedido: d.pedido,
    cliente: porNum.get(d.pedido)?.cliente_nome ?? "—",
    olist: d.olist,
    pcp: d.pcp,
    diferenca: d.diferenca,
  }));
  return fechar({ ...o, colunas, linhas }, null);
}
