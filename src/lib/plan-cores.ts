// Normalização de cor do PLAN — módulo puro (sem React, sem acesso ao banco)
// para poder ser testado isoladamente.

import { CORES_APELIDOS, REFACAO_CORES } from "@/lib/pedidos";

function normTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Escapa texto para uso literal em RegExp. */
function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const _CORES_NORM: { canonico: string; norm: string; re: RegExp }[] = REFACAO_CORES.map((c) => {
  const norm = normTexto(c.nome);
  return { canonico: c.nome, norm, re: new RegExp(`(^| )${escRe(norm)}( |$)`) };
});

/**
 * Traduz uma descrição de cor vinda de fora (Olist, MAP) para o nome canônico
 * de REFACAO_CORES. Casa exato; senão, por palavra inteira em qualquer direção,
 * somente quando há exatamente uma candidata. Nunca adivinha: sem candidata
 * única, devolve null.
 */
export function normalizarCor(bruto: string): string | null {
  const t = normTexto(bruto ?? "");
  if (!t) return null;
  const apelido = CORES_APELIDOS[t];
  if (apelido) return apelido;
  const exato = _CORES_NORM.find((c) => c.norm === t);
  if (exato) return exato.canonico;
  const reT = new RegExp(`(^| )${escRe(t)}( |$)`);
  const candidatas = _CORES_NORM.filter((c) => c.re.test(t) || reT.test(c.norm));
  return candidatas.length === 1 ? candidatas[0].canonico : null;
}

/**
 * Descrições de cor que devem ser simplesmente desconsideradas: não entram em
 * nenhum total do planejamento e não aparecem no aviso de "cores não
 * reconhecidas". Chaves já em minúsculas e sem acento.
 */
const CORES_IGNORADAS = new Set(["azul celeste"]);

/** true quando a cor bruta deve ser ignorada (caixa/acentos/espaços não importam). */
export function corIgnorada(bruto: string): boolean {
  return CORES_IGNORADAS.has(normTexto(bruto ?? ""));
}
