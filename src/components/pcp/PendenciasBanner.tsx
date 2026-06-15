import { useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { tipoIncluiDTF, tipoIncluiSilk, statusPrazo } from "@/lib/pedidos";
import { AlertTriangle, Clock, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PendenciasBanner({ pedidos }: { pedidos: Pedido[] }) {
  const [open, setOpen] = useState(true);

  const { atrasados, aguardando } = useMemo(() => {
    const ativos = pedidos.filter((p) => !p.finalizado_em);
    const atrasados = ativos.filter((p) => statusPrazo(p) === "atrasado");
    const aguardando = ativos.filter((p) => {
      const arteFinal = p.status_arte === "Arte Finalizada";
      const dtfBloq = tipoIncluiDTF(p.tipo_estampa) && p.dtf_estampado !== "Sim" && p.dtf_impresso !== "Sim";
      const silkBloq = tipoIncluiSilk(p.tipo_estampa) && p.silk_feito !== "Sim" && p.fotolito_impresso !== "Sim";
      return !arteFinal && (dtfBloq || silkBloq);
    });
    return { atrasados, aguardando };
  }, [pedidos]);

  if (atrasados.length === 0 && aguardando.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Pendências</div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? <><ChevronUp className="h-4 w-4 mr-1" /> Recolher</> : <><ChevronDown className="h-4 w-4 mr-1" /> Expandir</>}
        </Button>
      </div>
      {open && (
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
          {atrasados.length > 0 && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-destructive/8 border border-destructive/25 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/15 text-destructive shrink-0 ring-1 ring-destructive/20">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-destructive">{atrasados.length} pedido(s) atrasado(s)</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {atrasados.slice(0, 5).map((p) => p.pedido_olist).join(", ")}
                  {atrasados.length > 5 && ` +${atrasados.length - 5}`}
                </div>
              </div>
            </div>
          )}
          {aguardando.length > 0 && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-warning/10 border border-warning/30 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/20 text-warning-foreground shrink-0 ring-1 ring-warning/30">
                <Clock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-warning-foreground">{aguardando.length} pedido(s) aguardando etapa anterior</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {aguardando.slice(0, 5).map((p) => p.pedido_olist).join(", ")}
                  {aguardando.length > 5 && ` +${aguardando.length - 5}`}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
