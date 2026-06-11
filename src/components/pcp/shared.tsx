import type { Pedido } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calcularEtapaAtual, type EtapaStatus } from "@/lib/pedidos";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Baixa o PDF do layout via edge function (sem expor URL do Supabase). */
export async function baixarLayoutPDF(path: string) {
  try {
    const { data, error } = await supabase.functions.invoke("get-layout-pdf", { body: { path } });
    if (error) throw error;
    const blob = data instanceof Blob ? data : new Blob([data as ArrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    // Extrai nome original (path = `${uuid}-${filename}`)
    const filename = path.replace(/^[0-9a-f-]{36}-/i, "") || "layout.pdf";
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch (e: any) {
    toast.error(e?.message ?? "Falha ao baixar PDF");
  }
}

/** @deprecated use baixarLayoutPDF */
export const abrirLayoutPDF = baixarLayoutPDF;

export function EtapaBadge({ status, labels }: { status: EtapaStatus; labels: { pendente: string; andamento: string; concluido: string } }) {
  const cfg = status === "concluido"
    ? { cls: "bg-success/15 text-success border-success/30", icon: "🟢", text: labels.concluido }
    : status === "andamento"
    ? { cls: "bg-warning/15 text-warning-foreground border-warning/30", icon: "🟡", text: labels.andamento }
    : { cls: "bg-destructive/15 text-destructive border-destructive/30", icon: "🔴", text: labels.pendente };
  return <Badge variant="outline" className={`${cfg.cls} whitespace-nowrap`}>{cfg.icon} {cfg.text}</Badge>;
}


export function EtapaStatusBanner({
  pendencias,
  atrasado,
  atrasadoMsg,
}: {
  pendencias: string[];
  atrasado?: boolean;
  atrasadoMsg?: string;
}) {
  if (atrasado) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/30">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold">Atrasado</div>
          {atrasadoMsg && <div className="text-xs opacity-90 mt-0.5">{atrasadoMsg}</div>}
        </div>
      </div>
    );
  }
  if (pendencias.length > 0) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-md bg-warning/15 text-warning-foreground text-sm border border-warning/30">
        <Clock className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold">Pendências</div>
          <div className="text-xs opacity-90 mt-0.5">{pendencias.join(" • ")}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 p-3 rounded-md bg-success/10 text-success text-sm border border-success/30">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span className="font-medium">Sem pendências</span>
    </div>
  );
}

interface Props {
  pedidos: Pedido[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter?: (p: Pedido) => boolean;
}

export function PedidoSelector({ pedidos, selectedId, onSelect, filter }: Props) {
  const filtered = filter ? pedidos.filter(filter) : pedidos;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Pedidos ({filtered.length})</CardTitle></CardHeader>
      <CardContent className="p-0 max-h-[600px] overflow-y-auto">
        <ul className="divide-y">
          {filtered.map((p) => {
            const { etapa } = calcularEtapaAtual(p);
            return (
              <li
                key={p.id}
                onClick={() => onSelect(p.id)}
                className={`cursor-pointer px-4 py-3 hover:bg-accent transition-colors ${selectedId === p.id ? "bg-accent" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{p.pedido_olist}</span>
                  <Badge variant="outline" className="text-xs">{p.tipo_estampa}</Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">{p.orcamento}</div>
                <div className="text-xs text-muted-foreground mt-1">{etapa}</div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum pedido aplicável a esta etapa.
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm font-medium px-3 py-2 rounded-md bg-muted/50 border border-dashed">{value || "—"}</div>
    </div>
  );
}

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium">{label}</div>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-16 text-center text-sm text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}
