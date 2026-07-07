import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPedidoHistorico, type PedidoAuditEntry } from "@/lib/pedido-historico.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { History, Loader2 } from "lucide-react";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

// Dicionário PT-BR dos campos principais
const LABELS: Record<string, string> = {
  pedido_olist: "Pedido Olist",
  orcamento: "Orçamento",
  vendedor: "Vendedor",
  tipo_estampa: "Tipo de estampa",
  status_pecas: "Status de peças",
  status_arte: "Status de arte",
  qtd: "Quantidade",
  frete: "Frete",
  uf_entrega: "UF de entrega",
  data_entrega: "Data de entrega",
  entrada_pedido: "Entrada do pedido",
  inicio_estamparia: "Início estamparia",
  termino_estamparia: "Término estamparia",
  saida_juff: "Saída Juff",
  data_saida_juff: "Data saída Juff",
  acabamento_data: "Acabamento (data)",
  arte_data: "Arte (data)",
  dtf_data_executada: "DTF executado (data)",
  silk_data_executada: "Silk executado (data)",
  dtf_estampado: "DTF estampado",
  dtf_impresso: "DTF impresso",
  dtf_executado: "DTF executado",
  dtf_cortado: "DTF cortado",
  silk_feito: "Silk feito",
  fotolito_impresso: "Fotolito impresso",
  fotolito_executado: "Fotolito executado",
  tela_gravada: "Tela gravada",
  embalado: "Embalado",
  necessita_vetorizacao: "Necessita vetorização",
  vetorizacao_executada: "Vetorização executada",
  quem_bateu_dtf: "Quem bateu DTF",
  quem_bateu_silk: "Quem bateu Silk",
  responsavel_acabamento: "Responsável acabamento",
  layout_url: "Layout",
  finalizado_em: "Finalizado em",
  tempo_producao: "Tempo de produção",
  tempo_frete: "Tempo de frete",
  responsavel_conferencia: "Responsável conferência",
  forma_pagamento: "Forma de pagamento",
  nf_emitida: "NF emitida",
  expedicao_entrou_em: "Entrou na expedição",
  exp_cobranca_pagamento: "Exp. cobrança pgto",
  exp_pagamento: "Exp. pagamento",
  exp_etiqueta: "Exp. etiqueta",
  exp_frete_solicitado: "Exp. frete solicitado",
  exp_despachado: "Exp. despachado",
  exp_despachado_em: "Exp. despachado em",
  exp_observacoes: "Exp. observações",
  reaberto: "Reaberto",
  data_entrega_proposta: "Data entrega proposta",
  dtf_cortado_data: "DTF cortado (data)",
  vetorizacao_dtf: "Vetorização DTF",
  vetorizacao_silk: "Vetorização Silk",
  dias_secagem: "Dias de secagem",
  inicio_acabamento: "Início acabamento",
  termino_acabamento: "Término acabamento",
  n_batidas_dtf: "Nº batidas DTF",
  n_batidas_silk: "Nº batidas Silk",
  quem_cortou_dtf: "Quem cortou DTF",
  quem_revelou_tela: "Quem revelou tela",
  dtf_pessoas_qtd: "DTF pessoas (qtd)",
  refacoes: "Refações",
  acabamento_observacao: "Acabamento observação",
  arte_observacao: "Arte observação",
  dtf_observacao: "DTF observação",
  silk_observacao: "Silk observação",
  observacoes_pedido: "Observações do pedido",
  obs_vendedor: "Obs. vendedor",
  historico_data_entrega: "Histórico data entrega",
  pecas_solicitadas: "Peças solicitadas",
  pecas_completadas_log: "Peças completadas (log)",
  arte_warning: "Arte warning",
  correcoes_etapa: "Correções de etapa",
  pecas_lisas: "Peças lisas",
};

function label(campo: string) { return LABELS[campo] ?? campo; }

function fmtVal(v: Json): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "string") {
    // ISO date yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split("-");
      return `${d}/${m}/${y}`;
    }
    if (v.length > 60) return v.slice(0, 60) + "…";
    return v || "—";
  }
  if (typeof v === "number") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 80) + "…" : s;
  } catch { return String(v); }
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function autor(e: PedidoAuditEntry): string {
  return e.feito_por_nome || e.feito_por_email || (e.feito_por ? "usuário " + e.feito_por.slice(0, 6) : "sistema");
}

function acaoBadge(a: PedidoAuditEntry["acao"]) {
  if (a === "insert") return <Badge className="bg-green-600 hover:bg-green-600">criado</Badge>;
  if (a === "delete") return <Badge variant="destructive">deletado</Badge>;
  return <Badge variant="secondary">alterado</Badge>;
}

interface Props {
  pedidoId?: string;
  pedidoOlist?: string | null;
}

export function HistoricoPedidoDialog({ pedidoId, pedidoOlist }: Props) {
  const [open, setOpen] = useState(false);
  const fetchHist = useServerFn(getPedidoHistorico);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pedido-historico", pedidoId, pedidoOlist],
    enabled: open && (!!pedidoId || !!pedidoOlist),
    queryFn: async () => {
      const res = await fetchHist({
        data: {
          pedidoId: pedidoId,
          pedidoOlist: pedidoOlist || undefined,
        },
      });
      return res.entries;
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <History className="h-4 w-4 mr-1" />Histórico
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico do pedido</DialogTitle>
          <DialogDescription>
            Todas as criações, alterações e deleções registradas para este pedido{pedidoOlist ? ` (Olist ${pedidoOlist})` : ""}.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico…
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive py-4">
            Erro ao carregar: {(error as Error).message}
          </div>
        )}

        {!isLoading && !error && (data?.length ?? 0) === 0 && (
          <div className="text-sm text-muted-foreground py-6">
            Nenhum registro de histórico encontrado. O histórico só é gravado a partir da instalação da auditoria.
          </div>
        )}

        {!isLoading && data && data.length > 0 && (
          <ol className="relative border-l border-border pl-5 space-y-4 pt-2">
            {data.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[26px] top-1.5 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {acaoBadge(e.acao)}
                  <span className="font-medium">{autor(e)}</span>
                  <span className="text-muted-foreground">em {fmtDateTime(e.feito_em)}</span>
                  {e.pedido_id !== pedidoId && (
                    <Badge variant="outline" className="text-[10px]">outro registro deste Olist</Badge>
                  )}
                </div>
                {e.acao === "update" && e.mudancas && e.mudancas.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-xs">
                    {e.mudancas.map((m, i) => (
                      <li key={i} className="text-muted-foreground">
                        <span className="text-foreground font-medium">{label(m.campo)}</span>{": "}
                        <span className="line-through opacity-70">{fmtVal(m.de)}</span>
                        {" → "}
                        <span className="text-foreground">{fmtVal(m.para)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {e.acao === "insert" && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Orçamento: <span className="text-foreground">{e.orcamento || "—"}</span> · Olist: <span className="text-foreground">{e.pedido_olist || "—"}</span>
                  </div>
                )}
                {e.acao === "delete" && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Registro removido. Orçamento: <span className="text-foreground">{e.orcamento || "—"}</span> · Olist: <span className="text-foreground">{e.pedido_olist || "—"}</span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
