import type { Pedido } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calcularEtapaAtual, tipoIncluiDTF, tipoIncluiSilk, type EtapaStatus } from "@/lib/pedidos";
import { CheckCircle2, Clock, AlertTriangle, Info } from "lucide-react";
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

/** Extrai nome original do arquivo (path = `${uuid}-${filename}`). */
export function nomeArquivoLayout(path: string | null | undefined): string {
  if (!path) return "";
  return path.replace(/^[0-9a-f-]{36}-/i, "") || path;
}

export function EtapaBadge({ status, labels }: { status: EtapaStatus; labels: { pendente: string; andamento: string; concluido: string } }) {
  const cfg = status === "concluido"
    ? { cls: "bg-success/15 text-success border-success/30", icon: "🟢", text: labels.concluido }
    : status === "andamento"
    ? { cls: "bg-warning/15 text-warning-foreground border-warning/30", icon: "🟡", text: labels.andamento }
    : { cls: "bg-destructive/15 text-destructive border-destructive/30", icon: "🔴", text: labels.pendente };
  return <Badge variant="outline" className={`${cfg.cls} whitespace-nowrap`}>{cfg.icon} {cfg.text}</Badge>;
}

/** Paleta por etapa — combina com as áreas (Arte=índigo, DTF=teal, Silk=roxo, Acabamento=âmbar, Expedição=rosa). */
export function etapaPaletteClass(etapa: string): string {
  if (etapa === "Finalizado") return "bg-success/15 text-success border-success/30";
  if (etapa.includes("DTF + Silk")) return "bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-300";
  if (etapa.includes("Arte")) return "bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:text-indigo-300";
  if (etapa.includes("DTF")) return "bg-teal-500/15 text-teal-700 border-teal-500/30 dark:text-teal-300";
  if (etapa.includes("Silk")) return "bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-300";
  if (etapa.includes("Acabamento")) return "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300";
  if (etapa.includes("Expedição")) return "bg-pink-500/15 text-pink-700 border-pink-500/30 dark:text-pink-300";
  if (etapa.includes("produção")) return "bg-warning/15 text-warning-foreground border-warning/30";
  return "bg-muted text-muted-foreground border-border";
}

/** Badge mostrando a Etapa atual do pedido — consistente em todos os dashboards. */
export function EtapaBadgeFromPedido({ pedido }: { pedido: Pedido }) {
  const { etapa } = calcularEtapaAtual(pedido);
  return <Badge variant="outline" className={`${etapaPaletteClass(etapa)} whitespace-nowrap`}>{etapa}</Badge>;
}

/** Badge do status do pedido — mesma exibição do Dados In. */
export function StatusPedidoBadge({ pedido }: { pedido: Pedido }) {
  return <Badge variant={pedido.status_geral === "completo" ? "default" : "secondary"}>{pedido.status_geral ?? "—"}</Badge>;
}

/** Pequeno chip rótulo:valor usado nos cards mobile dos dashboards. */
export function Chip({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "" || value === "—") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px]">
        <span className="text-muted-foreground">{label}:</span>
        <span>—</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px]">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

/** Card clicável de pedido para os dashboards no mobile. */
export function PedidoMobileCard({
  pedido, active, onClick, children, right,
}: {
  pedido: Pedido;
  active?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`w-full text-left p-3 hover:bg-accent transition-colors cursor-pointer ${active ? "bg-accent" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{pedido.pedido_olist ?? "—"}</div>
          <div className="text-xs text-muted-foreground truncate">{pedido.orcamento ?? ""}</div>
        </div>
        <div
          className="flex flex-col items-end gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <EtapaBadgeFromPedido pedido={pedido} />
          {right}
        </div>
      </div>
      {children && <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>}
    </div>
  );
}

/** Banner do topo de cada aba mostrando a etapa atual do pedido. */
export function EtapaTopoBanner({ pedido, tab }: { pedido: Pedido; tab: "arte" | "dtf" | "silk" | "acabamento" | "dadosin" }) {
  const { etapa, cor } = calcularEtapaAtual(pedido);
  const tipo = pedido.tipo_estampa;
  let msg = etapa;
  let tone: "green" | "yellow" | "blue" | "gray" = cor === "red" ? "yellow" : (cor as any);

  if (tipo === "Lisa" && (tab === "arte" || tab === "dtf" || tab === "silk")) {
    msg = "Pedido Lisa — sem estampa. Aguardando Acabamento";
    tone = "blue";
  } else if (tab === "dtf" && !tipoIncluiDTF(tipo) && tipo !== "Lisa") {
    msg = etapa === "Aguardando Silk" || etapa === "Aguardando DTF + Silk" ? "Aguardando Silk" : "Aguardando Acabamento";
  } else if (tab === "silk" && !tipoIncluiSilk(tipo) && tipo !== "Lisa") {
    msg = etapa === "Aguardando DTF" || etapa === "Aguardando DTF + Silk" ? "Aguardando DTF" : "Aguardando Acabamento";
  }

  const cls =
    tone === "green" ? "bg-success/10 text-success border-success/30" :
    tone === "yellow" ? "bg-warning/15 text-warning-foreground border-warning/30" :
    tone === "blue" ? "bg-info/10 text-info border-info/30" :
    "bg-muted text-muted-foreground border-border";
  const Icon = tone === "green" ? CheckCircle2 : tone === "blue" ? Info : Clock;

  return (
    <div className={`flex items-center gap-2 p-3 rounded-md border text-sm ${cls}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="font-medium">Etapa: {msg}</span>
    </div>
  );
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
