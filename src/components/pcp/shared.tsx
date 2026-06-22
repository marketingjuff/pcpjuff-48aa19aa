import type { Pedido } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
import { calcularEtapaAtual, tipoIncluiDTF, tipoIncluiSilk, isAtrasadoSetor, type EtapaStatus, type SetorAtraso } from "@/lib/pedidos";
import { CheckCircle2, Clock, AlertTriangle, Info, ArrowUpDown, Save, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, forwardRef } from "react";
import { diasUteisAteHoje } from "@/lib/dias-uteis";
import { useColorSettings } from "@/hooks/use-color-settings";



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
export function EtapaBadgeFromPedido({ pedido, compact }: { pedido: Pedido; compact?: boolean }) {
  const { etapa } = calcularEtapaAtual(pedido);
  return <EtapaBadgeView etapa={etapa} compact={compact} />;
}

/** Badge de etapa por string (para casos onde já temos a label). Usa cores do painel de configuração. */
export function EtapaBadgeView({ etapa, compact, className }: { etapa: string; compact?: boolean; className?: string }) {
  const { etapaStyle } = useColorSettings();
  const sizeCls = compact ? "text-[10px] px-1.5 py-0" : "";
  return (
    <Badge
      variant="outline"
      className={`${etapaPaletteClass(etapa)} whitespace-nowrap ${sizeCls} ${className ?? ""}`}
      style={etapaStyle(etapa)}
    >
      {etapa}
    </Badge>
  );
}

/** Botão de ação principal (Atualizar/Salvar) com cor configurável (default azul). */
export const UpdateButton = forwardRef<HTMLButtonElement, ButtonProps & { icon?: boolean }>(
  ({ icon = true, children, style, className, ...rest }, ref) => {
    const { btnStyle } = useColorSettings();
    return (
      <Button ref={ref} className={className} style={{ ...btnStyle("atualizar"), ...style }} {...rest}>
        {icon && <Save className="h-4 w-4 mr-1" />}
        {children}
      </Button>
    );
  },
);
UpdateButton.displayName = "UpdateButton";

/** Botão de finalizar pedido(s) com cor configurável (default verde). */
export const FinalizarButton = forwardRef<HTMLButtonElement, ButtonProps & { icon?: boolean }>(
  ({ icon = true, children, style, className, ...rest }, ref) => {
    const { btnStyle } = useColorSettings();
    return (
      <Button ref={ref} className={className} style={{ ...btnStyle("finalizar"), ...style }} {...rest}>
        {icon && <Flag className="h-4 w-4 mr-1" />}
        {children}
      </Button>
    );
  },
);
FinalizarButton.displayName = "FinalizarButton";

/** ===== Estilos compartilhados de tabela compacta (padrão Dashboard Master) ===== */
export const TABLE_FONT_STYLE = {
  fontFamily: '"Google Sans Flex", Arial, sans-serif',
  fontStretch: 'condensed' as const,
};
export const TABLE_WRAPPER_CLASS =
  "hidden md:block rounded-lg border border-border/60 bg-card overflow-x-auto shadow-xs [&_th]:text-center [&_td]:text-center";

export const TH_CLASS = "h-7 px-1.5 text-[11px] font-bold text-center";
export const TD_CLASS = "py-0.5 px-1.5 text-[11px] align-top text-center";
export const TH_RAW_CLASS = "h-7 px-1.5 text-center text-[11px] uppercase whitespace-nowrap font-bold text-muted-foreground";
export const TD_RAW_CLASS = "px-1.5 py-0.5 text-[11px] align-top text-center";
export const BADGE_SM_CLASS = "text-[10px] px-1.5 py-0";


/** Cor de fundo de alerta para linhas — mesma regra do Dashboard Master. */
export function rowAlertBgClass(p: Pedido, feriados: Set<string>): string {
  if (p.embalado === "Sim") return "";
  if (!p.saida_juff) return "";
  const dias = diasUteisAteHoje(p.saida_juff, feriados);
  if (dias === null) return "";
  if (dias <= 0) return "bg-red-50 hover:bg-red-100/80";
  if (dias === 1) return "bg-yellow-50 hover:bg-yellow-100/80";
  return "";
}

/** Classe vermelha para linhas atrasadas por setor (item 4 da spec). */
export function linhaAtrasoClasse(p: Pedido, setor: SetorAtraso): string {
  return isAtrasadoSetor(p, setor)
    ? "bg-red-100 text-red-900 hover:bg-red-200/90"
    : "";
}

/** Mapeamento aba → setor para atraso. */
export function setorDaAba(tab: "dadosin" | "arte" | "dtf" | "silk" | "acabamento" | "expedicao" | "dashboard"): SetorAtraso | null {
  switch (tab) {
    case "arte": return "arte";
    case "dtf": return "dtf";
    case "silk": return "silk";
    case "acabamento": return "acabamento";
    case "expedicao": return "expedicao";
    default: return null;
  }
}


export type SortDir = "asc" | "desc";

/** Hook simples de ordenação por coluna; alterna asc/desc, troca coluna reseta para asc. */
export function useSort<K extends string>(initialKey: K | null = null, initialDir: SortDir = "asc") {
  const [key, setKey] = useState<K | null>(initialKey);
  const [dir, setDir] = useState<SortDir>(initialDir);
  function toggle(k: K) {
    if (key !== k) { setKey(k); setDir("asc"); }
    else setDir((d) => (d === "asc" ? "desc" : "asc"));
  }
  return { key, dir, toggle };
}

export function cmpDate(a: string | null | undefined, b: string | null | undefined, dir: SortDir): number {
  const av = a ?? "9999-12-31";
  const bv = b ?? "9999-12-31";
  return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
}
export function cmpNum(a: number | null | undefined, b: number | null | undefined, dir: SortDir): number {
  const av = a == null ? Number.POSITIVE_INFINITY : a;
  const bv = b == null ? Number.POSITIVE_INFINITY : b;
  return dir === "asc" ? av - bv : bv - av;
}

/** <th> com cabeçalho clicável estilizado igual ao Master. */
export function SortableTh({
  label, active, onClick, className,
}: { label: string; active?: boolean; onClick?: () => void; className?: string }) {
  return (
    <th className={`${TH_RAW_CLASS} cursor-pointer select-none ${className ?? ""}`} onClick={onClick}>
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-50"}`} />
      </span>
    </th>
  );
}

/** <th> não clicável com mesmo estilo. */
export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`${TH_RAW_CLASS} ${className ?? ""}`}>{children}</th>;
}


/** Classe de cor por Status de Peças. */
export function statusPecasColorClass(status: string | null | undefined): string {
  if (status === "completo") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300";
  if (status === "incompleto") return "bg-slate-500/15 text-slate-700 border-slate-500/40 dark:text-slate-300";
  return "bg-muted text-muted-foreground border-border";
}

/** Badge do Status de Peças do pedido (Completo / Incompleto). */
export function StatusPecasBadge({ pedido }: { pedido: Pedido }) {
  const s = pedido.status_pecas;
  const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
  return <Badge variant="outline" className={`${statusPecasColorClass(s)} whitespace-nowrap capitalize`}>{label}</Badge>;
}

/** Chip "Status de Peças: <badge colorido>" para os cards mobile. */
export function StatusPecasChip({ pedido }: { pedido: Pedido }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px]">
      <span className="text-muted-foreground">Status de Peças:</span>
      <StatusPecasBadge pedido={pedido} />
    </span>
  );
}

// Aliases de retrocompatibilidade.
export const statusGeralColorClass = statusPecasColorClass;
export const StatusPedidoBadge = StatusPecasBadge;
export const StatusPedidoChip = StatusPecasChip;

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
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm font-medium px-3 py-2 rounded-md bg-muted/50 border border-dashed border-border/60">{value || "—"}</div>
    </div>
  );
}

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
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

// ============================================================
// Filtro de Etapa (compartilhado em todas as abas)
// ============================================================

export const ETAPA_FILTRO_OPCOES: { value: string; label: string }[] = [
  { value: "ativas", label: "Todas (menos finalizados)" },
  { value: "pendencias_data", label: "Pendências de Data" },
  { value: "aguardando_entrada", label: "Aguardando entrada" },
  { value: "aguardando_input", label: "Aguardando input de produção" },
  { value: "arte", label: "Aguardando Arte" },
  { value: "dtf_pronto_silk_arte", label: "DTF Liberado / Silk na Arte" },
  { value: "silk_pronto_dtf_arte", label: "Silk Liberado / DTF na Arte" },
  { value: "dtf", label: "Aguardando DTF" },
  { value: "silk", label: "Aguardando Silk" },
  { value: "dtf_silk", label: "Aguardando DTF + Silk" },
  { value: "acabamento", label: "Aguardando Acabamento" },
  { value: "expedicao", label: "Aguardando Expedição" },
  { value: "finalizados", label: "Finalizados" },
];

const _ETAPA_MAP: Record<string, string[]> = {
  aguardando_entrada: ["Aguardando entrada"],
  aguardando_input: ["Aguardando input de produção"],
  arte: ["Aguardando Arte", "DTF Liberado / Silk na Arte", "Silk Liberado / DTF na Arte"],
  dtf_pronto_silk_arte: ["DTF Liberado / Silk na Arte"],
  silk_pronto_dtf_arte: ["Silk Liberado / DTF na Arte"],
  dtf: ["Aguardando DTF", "Aguardando DTF + Silk", "DTF Liberado / Silk na Arte", "Silk Liberado / DTF na Arte"],
  silk: ["Aguardando Silk", "Aguardando DTF + Silk", "DTF Liberado / Silk na Arte", "Silk Liberado / DTF na Arte"],
  dtf_silk: ["Aguardando DTF + Silk"],
  acabamento: ["Aguardando Acabamento"],
  expedicao: ["Aguardando Expedição"],
};

const _pickEtapaOpcoes = (values: string[]) =>
  values
    .map((v) => ETAPA_FILTRO_OPCOES.find((o) => o.value === v))
    .filter((o): o is { value: string; label: string } => !!o);

export const ETAPA_FILTRO_OPCOES_DADOS_IN = ETAPA_FILTRO_OPCOES.filter(
  (o) => o.value !== "pendencias_arte",
);

export const ETAPA_FILTRO_OPCOES_ARTE = _pickEtapaOpcoes([
  "ativas",
  "arte",
  "dtf_pronto_silk_arte",
  "silk_pronto_dtf_arte",
  "dtf",
  "silk",
  "dtf_silk",
]);

export const ETAPA_FILTRO_OPCOES_DTF = _pickEtapaOpcoes([
  "ativas",
  "arte",
  "dtf_pronto_silk_arte",
  "silk_pronto_dtf_arte",
  "dtf",
  "dtf_silk",
]);

export const ETAPA_FILTRO_OPCOES_SILK = _pickEtapaOpcoes([
  "ativas",
  "arte",
  "dtf_pronto_silk_arte",
  "silk_pronto_dtf_arte",
  "silk",
  "dtf_silk",
]);

export const ETAPA_FILTRO_OPCOES_ACABAMENTO = ETAPA_FILTRO_OPCOES.filter(
  (o) => o.value !== "pendencias_arte",
);

export const ETAPA_FILTRO_OPCOES_EXPEDICAO = _pickEtapaOpcoes([
  "ativas",
  "acabamento",
  "expedicao",
  "finalizados",
]);

export function matchEtapaFiltro(p: Pedido, value: string): boolean {
  if (value === "finalizados") return !!p.finalizado_em;
  if (!!p.finalizado_em) return false;
  if (value === "pendencias_data") return !!p.data_entrega_proposta;
  if (value === "ativas" || value === "todas") return true;
  const etapaAtual = calcularEtapaAtual(p).etapa.replace(/\*$/, "");
  
  return _ETAPA_MAP[value]?.includes(etapaAtual) ?? false;
}
