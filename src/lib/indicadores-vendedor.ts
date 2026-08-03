/**
 * Filtro de Vendedor unificado (Olist + PCP) — funções puras, sem React e sem Supabase.
 * Somente leitura: nada aqui grava, edita ou apaga dados.
 */

/** Chave de comparação: trim + maiúsculas + sem acento. */
export function chaveVendedor(nome: string | null | undefined): string {
  return String(nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export interface OpcaoVendedor {
  /** normalizada */
  chave: string;
  /** grafia exibida */
  label: string;
  origem: "olist" | "pcp" | "ambos";
}

/** Pontua a grafia: prefere a que tem acentuação e capitalização mista. */
function pontuaLabel(nome: string): number {
  const temAcento = /[\u00c0-\u024f]/.test(nome) ? 2 : 0;
  const misto = /[a-z]/.test(nome) && /[A-Z]/.test(nome) ? 1 : 0;
  return temAcento + misto;
}

function melhorLabel(atual: string | undefined, candidato: string): string {
  const c = candidato.trim();
  if (!atual) return c;
  return pontuaLabel(c) > pontuaLabel(atual) ? c : atual;
}

/** União das duas origens, deduplicada e ordenada em pt-BR. */
export function opcoesVendedores(
  olist: { vendedor: string | null }[],
  pcp: { vendedor?: string | null }[],
): OpcaoVendedor[] {
  const map = new Map<string, { label: string; olist: boolean; pcp: boolean }>();

  const add = (nome: string | null | undefined, origem: "olist" | "pcp") => {
    const chave = chaveVendedor(nome);
    if (!chave) return;
    const atual = map.get(chave);
    const label = melhorLabel(atual?.label, String(nome ?? ""));
    map.set(chave, {
      label,
      olist: (atual?.olist ?? false) || origem === "olist",
      pcp: (atual?.pcp ?? false) || origem === "pcp",
    });
  };

  for (const p of olist) add(p.vendedor, "olist");
  for (const r of pcp) add(r.vendedor, "pcp");

  return [...map.entries()]
    .map(([chave, v]) => ({
      chave,
      label: v.label,
      origem: (v.olist && v.pcp ? "ambos" : v.olist ? "olist" : "pcp") as OpcaoVendedor["origem"],
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/**
 * Base do pedido da Olist → vendedor do PCP.
 * Parciais (`3996A`, `3996B`) caem na mesma base (`3996`); vale o vendedor do
 * primeiro parcial que tiver valor.
 */
export function mapaVendedorPcp(
  pcp: { pedido_olist: string | null; vendedor?: string | null }[],
): Map<string, string> {
  const map = new Map<string, string>();
  const ordenado = [...pcp].sort((a, b) =>
    sufixoParcial(a.pedido_olist).localeCompare(sufixoParcial(b.pedido_olist), "pt-BR"),
  );
  for (const r of ordenado) {
    const num = basePedidoOlist(r.pedido_olist);
    const vend = String(r.vendedor ?? "").trim();
    if (!num || !vend || map.has(num)) continue;
    map.set(num, vend);
  }
  return map;
}


/** Aplica a regra de união: Olist OU PCP. Seleção vazia devolve a lista intacta. */
export function filtrarPorVendedor<T extends { numero_pedido: string; vendedor: string }>(
  pedidos: T[],
  selecionados: string[],
  vendedorPcpPorPedido: Map<string, string>,
): T[] {
  if (selecionados.length === 0) return pedidos;
  const sel = new Set(selecionados);
  return pedidos.filter((p) => {
    if (sel.has(chaveVendedor(p.vendedor))) return true;
    const vPcp = vendedorPcpPorPedido.get(String(p.numero_pedido).trim());
    return !!vPcp && sel.has(chaveVendedor(vPcp));
  });
}

/** true se o registro do PCP entra no recorte. Seleção vazia => sempre true. */
export function pcpNoRecorteVendedor(reg: { vendedor?: string | null }, selecionados: string[]): boolean {
  if (selecionados.length === 0) return true;
  const chave = chaveVendedor(reg.vendedor);
  if (!chave) return false;
  return selecionados.includes(chave);
}
