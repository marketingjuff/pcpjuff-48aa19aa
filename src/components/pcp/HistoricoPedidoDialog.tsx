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

import { labelCampo, formatValor } from "@/lib/audit-labels";

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
                    {e.mudancas.map((m, i) => {
                      const de = formatValor(m.campo, m.de as any);
                      const para = formatValor(m.campo, m.para as any);
                      return (
                        <li key={i} className="text-muted-foreground">
                          <span className="text-foreground font-medium">{labelCampo(m.campo)}</span>{": "}
                          <span className="line-through opacity-70" title={de.titulo}>{de.texto}</span>
                          {" → "}
                          <span className="text-foreground" title={para.titulo}>{para.texto}</span>
                        </li>
                      );
                    })}
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
