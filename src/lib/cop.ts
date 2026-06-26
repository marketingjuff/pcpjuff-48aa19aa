// Tipos e helpers do módulo COP (Controle de Ordem de Produção).
// Reaproveita as constantes de Modelo/Cor/Tamanho do PCP em src/lib/pedidos.ts.

export type CopStatus =
  | "Aguardando Risco"
  | "Aguardando Corte"
  | "Aguardando Romaneio"
  | "Na Oficina (Costura)"
  | "Romaneio Parcial"
  | "Romaneio Completo"
  | "Em Oficina"
  | "Aguardando Pagamento"
  | "Finalizado";

export const COP_STATUS_LIST: CopStatus[] = [
  "Aguardando Risco",
  "Aguardando Corte",
  "Aguardando Romaneio",
  "Na Oficina (Costura)",
  "Romaneio Parcial",
  "Romaneio Completo",
  "Em Oficina",
  "Aguardando Pagamento",
  "Finalizado",
];

/** Peça de um COP: um registro por (modelo, cor, tamanho). */
export type CopPeca = {
  modelo: string;
  cor: string;
  tamanho: string;
  qtd: number;
};

export type Cop = {
  id: string;
  numero: number;
  status: CopStatus;
  solicitacao_risco: string | null;
  execucao_risco: string | null;
  solicitacao_corte: string | null;
  execucao_corte: string | null;
  observacoes_corte: string | null;
  pecas: CopPeca[];
  cop_pai_id: string | null;
  corte_dividido: boolean;
  // Romaneio
  oficina_id: string | null;
  data_saida_oficina: string | null;
  data_recebimento: string | null;
  observacoes_romaneio: string | null;
  num_fretes: number;
  pecas_recebidas: CopPecaRecebida[];
  romaneio_enviado_em: string | null;
  letra: string | null;
  cop_romaneio_pai_id: string | null;
  conferido_em: string | null;
  conferido_por: string | null;
  // Conferência + Pagamento + Perdas
  conferencia: CopConferenciaItem[];
  pagamento_status: "nao_pago" | "liberado" | "pago";
  pagamento_liberado_em: string | null;
  pagamento_liberado_por: string | null;
  pagamento_pago_em: string | null;
  pagamento_pago_por: string | null;
  pagamento_valor_calculado: number | null;
  perdas: unknown[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

/** Quantidade conferida por linha (após Conferência no Romaneio). */
export type CopConferenciaItem = {
  modelo: string;
  cor: string;
  tamanho: string;
  qtd_conferida: number;
};

/** Registro de perda (peça que foi para conserto e voltou). */
export type CopPerdaRegistro = {
  id: string;
  cop_id: string | null;
  oficina_id: string | null;
  etiqueta: string | null;
  modelo: string;
  cor: string;
  tamanho: string;
  qtd: number;
  motivo: string | null;
  registrado_por: string | null;
  created_at: string;
  updated_at: string;
};

/** Item de log de baixa do COP gravado em pedidos.pecas_completadas_log */
export type PecaCompletadaLog = {
  modelo: string;
  cor: string;
  tamanho: string;
  qtd: number;
  em: string;
  por: string | null;
  cop_id: string;
  cop_numero: number;
  cop_letra: string | null;
};

/** Recebimento por linha (Modelo|Cor|Tamanho). qtd_recebida<=qtd; completo opcional. */
export type CopPecaRecebida = {
  modelo: string;
  cor: string;
  tamanho: string;
  qtd_recebida: number;
};

export type Oficina = {
  id: string;
  nome: string;
  cnpj_cpf: string | null;
  endereco: string | null;
  cep: string | null;
  valor_frete: number;
  valores_por_modelo: Record<string, number>;
  created_at: string;
  updated_at: string;
};

export function formatCopNumero(n: number | null | undefined): string {
  if (n == null) return "—";
  return String(n).padStart(4, "0");
}

export function totalPecasCop(p: CopPeca[] | null | undefined): number {
  if (!p) return 0;
  return p.reduce((s, x) => s + (Number(x.qtd) || 0), 0);
}

/** Soma `b` em `a` (mesma chave modelo+cor+tamanho). Retorna novo array. */
export function somarPecas(a: CopPeca[], b: CopPeca[]): CopPeca[] {
  const map = new Map<string, CopPeca>();
  for (const p of a) {
    if (p.qtd > 0) map.set(`${p.modelo}|${p.cor}|${p.tamanho}`, { ...p });
  }
  for (const p of b) {
    if (!(p.qtd > 0)) continue;
    const k = `${p.modelo}|${p.cor}|${p.tamanho}`;
    const cur = map.get(k);
    if (cur) cur.qtd += p.qtd;
    else map.set(k, { ...p });
  }
  return Array.from(map.values());
}

/** Subtrai `b` de `a` (mesma chave). Linhas zeradas são removidas. */
export function subtrairPecas(a: CopPeca[], b: CopPeca[]): CopPeca[] {
  const map = new Map<string, CopPeca>();
  for (const p of a) {
    if (p.qtd > 0) map.set(`${p.modelo}|${p.cor}|${p.tamanho}`, { ...p });
  }
  for (const p of b) {
    if (!(p.qtd > 0)) continue;
    const k = `${p.modelo}|${p.cor}|${p.tamanho}`;
    const cur = map.get(k);
    if (!cur) continue;
    cur.qtd = Math.max(0, cur.qtd - p.qtd);
    if (cur.qtd === 0) map.delete(k);
  }
  return Array.from(map.values());
}

/** Lê qtd_recebida para uma chave (modelo|cor|tamanho). */
export function getRecebida(rec: CopPecaRecebida[] | null | undefined, m: string, c: string, t: string): number {
  if (!rec) return 0;
  const f = rec.find((r) => r.modelo === m && r.cor === c && r.tamanho === t);
  return f ? Number(f.qtd_recebida) || 0 : 0;
}

/** Define qtd_recebida para uma chave; remove se 0. */
export function setRecebida(rec: CopPecaRecebida[], m: string, c: string, t: string, q: number): CopPecaRecebida[] {
  const out = rec.filter((r) => !(r.modelo === m && r.cor === c && r.tamanho === t));
  if (q > 0) out.push({ modelo: m, cor: c, tamanho: t, qtd_recebida: q });
  return out;
}

/** Total recebido. */
export function totalRecebidas(rec: CopPecaRecebida[] | null | undefined): number {
  if (!rec) return 0;
  return rec.reduce((s, r) => s + (Number(r.qtd_recebida) || 0), 0);
}

/** True quando todas as linhas têm qtd_recebida === qtd. */
export function todasCompletas(pecas: CopPeca[], rec: CopPecaRecebida[]): boolean {
  if (!pecas?.length) return false;
  for (const p of pecas) {
    if (getRecebida(rec, p.modelo, p.cor, p.tamanho) < p.qtd) return false;
  }
  return true;
}

/** Próxima letra livre dado um conjunto de letras já usadas (A,B,C,...). */
export function proximaLetra(usadas: (string | null | undefined)[]): string {
  const set = new Set(usadas.filter(Boolean).map((s) => String(s).toUpperCase()));
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(65 + i);
    if (!set.has(c)) return c;
  }
  return "Z";
}

/** Rótulo "0001" ou "0001A" quando há letra. */
export function rotuloCop(n: number | null | undefined, letra: string | null | undefined): string {
  const base = formatCopNumero(n);
  return letra ? `${base}${letra.toUpperCase()}` : base;
}
