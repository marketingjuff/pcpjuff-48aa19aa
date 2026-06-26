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
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
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
