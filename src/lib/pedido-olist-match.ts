/**
 * Casamento entre o pedido único da Olist e os parciais do PCP.
 *
 * O PCP abre um registro por parcial, reaproveitando o número da Olist com uma
 * letra no fim (`3996A`, `3996B`). Na Olist existe um pedido só (`3996`).
 * Aqui reduzimos o número do PCP à sua BASE e agregamos os parciais em memória
 * — nada é gravado no banco.
 *
 * Regra de consolidação: quem manda são os dados do PRIMEIRO parcial (o `A`).
 * A única coisa que soma é a quantidade de peças (e as contagens de episódios).
 */

import type { PcpDb } from "@/lib/indicadores-olist";

/** "3996A" → "3996". "3996" → "3996". Formato inesperado → texto normalizado. */
export function basePedidoOlist(numero: string | null | undefined): string {
  const s = String(numero ?? "").replace(/\s+/g, "").trim();
  if (!s) return "";
  const m = s.match(/^(\d+)([A-Za-z]{1,2})$/);
  if (m) return m[1];
  return s;
}

/** Sufixo de parcial em maiúsculas: "3996A" → "A"; "3996" → "". */
export function sufixoParcial(numero: string | null | undefined): string {
  const s = String(numero ?? "").replace(/\s+/g, "").trim();
  const m = s.match(/^(\d+)([A-Za-z]{1,2})$/);
  return m ? m[2].toUpperCase() : "";
}

export interface PcpAgregado<T extends PcpDb = PcpDb> {
  /** Número do pedido na Olist. */
  base: string;
  /** Números dos parciais do PCP, na ordem das letras. */
  parciais: string[];
  /** Registros originais, preservados e ordenados. */
  registros: T[];
  /** Soma das quantidades de todos os parciais. */
  qtd: number;
  uf_entrega: string | null;
  vendedor: string | null;
  entrada_pedido: string | null;
  data_entrega: string | null;
  saida_juff: string | null;
  finalizado_em: string | null;
  /** true quando o pedido foi produzido em mais de um parcial. */
  parcial: boolean;
  /** "3996 (3996A + 3996B)" quando parcial; senão só a base. */
  label: string;
}

function vazio(v: unknown): boolean {
  return v == null || String(v).trim() === "";
}

/** Primeiro valor não vazio na ordem dos parciais. */
function primeiro<T>(registros: T[], pega: (r: T) => unknown): string | null {
  for (const r of registros) {
    const v = pega(r);
    if (!vazio(v)) return String(v);
  }
  return null;
}

/** Agrupa registros do PCP pela base do `pedido_olist`. Sem número → fora do mapa. */
export function agruparPcpPorPedidoOlist<T extends PcpDb & Record<string, any>>(
  registros: T[],
): Map<string, PcpAgregado<T>> {
  const porBase = new Map<string, T[]>();
  for (const r of registros) {
    const base = basePedidoOlist(r.pedido_olist);
    if (!base) continue;
    const lista = porBase.get(base);
    if (lista) lista.push(r);
    else porBase.set(base, [r]);
  }

  const saida = new Map<string, PcpAgregado<T>>();
  for (const [base, lista] of porBase) {
    const ordenados = [...lista].sort((a, b) =>
      sufixoParcial(a.pedido_olist).localeCompare(sufixoParcial(b.pedido_olist), "pt-BR"),
    );
    const parciais = ordenados.map((r) => String(r.pedido_olist ?? "").replace(/\s+/g, "").trim());
    const parcial = ordenados.length > 1;
    const uf = primeiro(ordenados, (r) => r.uf_entrega);
    saida.set(base, {
      base,
      parciais,
      registros: ordenados,
      qtd: ordenados.reduce((s, r) => s + (Number(r.qtd) || 0), 0),
      uf_entrega: uf ? uf.trim().toUpperCase() : null,
      vendedor: primeiro(ordenados, (r) => r.vendedor),
      entrada_pedido: primeiro(ordenados, (r) => r.entrada_pedido),
      data_entrega: primeiro(ordenados, (r) => r.data_entrega),
      saida_juff: primeiro(ordenados, (r) => r.saida_juff),
      finalizado_em: primeiro(ordenados, (r) => r.finalizado_em),
      parcial,
      label: parcial ? `${base} (${parciais.join(" + ")})` : base,
    });
  }
  return saida;
}

/**
 * Registro sintético do PCP para os blocos agregados: campos do primeiro
 * parcial, quantidade somada, episódios (refações/correções) de todos.
 */
export function registroConsolidado<T extends PcpDb & Record<string, any>>(ag: PcpAgregado<T>): T {
  const base = ag.registros[0];
  return {
    ...base,
    pedido_olist: ag.base,
    qtd: ag.qtd,
    uf_entrega: ag.uf_entrega,
    vendedor: ag.vendedor,
    entrada_pedido: ag.entrada_pedido,
    data_entrega: ag.data_entrega,
    saida_juff: ag.saida_juff,
    finalizado_em: ag.finalizado_em,
    refacoes: ag.registros.flatMap((r) => r.refacoes ?? []),
    correcoes_etapa: ag.registros.flatMap((r) => r.correcoes_etapa ?? []),
  } as T;
}
