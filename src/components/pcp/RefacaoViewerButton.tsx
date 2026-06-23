import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ETAPA_DESTINO_LABEL,
  tipoIncluiDTF,
  type PecaPerdida,
  type Pedido,
  type RefacaoEpisodio,
  type RefacaoRetrato,
} from "@/lib/pedidos";
import { useProfilesMap, resolveNome } from "@/hooks/use-profiles-map";
import { useMyRoles } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, Save } from "lucide-react";
import { PecasPerdidasEditor, pecaLinhaCompleta, somaPecas } from "./PecasPerdidasEditor";

const ORANGE = "#ff8c2f";

function fmtDataHoraBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return String(iso); }
}
function fmtDataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(iso);
    const d = onlyDate ? new Date(iso + "T00:00:00") : new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch { return String(iso); }
}

const ETAPA_LABEL_MAP: Record<string, string> = {
  dados: "Dados In", arte: "Arte", dtf: "DTF", silk: "Silk", acabamento: "Acabamento", expedicao: "Expedição",
  "Aguardando entrada": "Dados In",
  "Aguardando Dados In": "Dados In",
  "Aguardando input de produção": "Dados In",
  "Aguardando Arte": "Arte",
  "DTF Liberado / Silk na Arte": "Arte",
  "Silk Liberado / DTF na Arte": "Arte",
  "Aguardando DTF": "DTF",
  "Aguardando Silk": "Silk",
  "Aguardando DTF + Silk": "DTF/Silk",
  "Aguardando Acabamento": "Acabamento",
  "Aguardando Expedição": "Expedição",
};
function fmtEtapa(v: string | null | undefined): string {
  if (!v) return "—";
  return ETAPA_LABEL_MAP[v] ?? v;
}

const CAMPO_LABEL: Record<string, string> = {
  status_pecas: "Status de peças", tipo_estampa: "Tipo de estampa", arte_data: "Arte (limite)",
  inicio_estamparia: "Início estamparia", termino_estamparia: "Término estamparia",
  status_arte: "Status da arte", arte_observacao: "Observação da arte",
  vetorizacao_executada: "Vetorização executada",
  vetorizacao_dtf: "Vetorização DTF", vetorizacao_silk: "Vetorização Silk",
  dtf_impresso: "DTF impresso", dtf_executado: "DTF executado",
  dtf_cortado: "DTF cortado", dtf_cortado_data: "Data corte DTF",
  fotolito_impresso: "Fotolito impresso", fotolito_executado: "Fotolito executado",
  dtf_estampado: "DTF estampado", dtf_data_executada: "Data DTF executado",
  quem_bateu_dtf: "Quem bateu DTF", quem_cortou_dtf: "Quem cortou DTF",
  n_batidas_dtf: "Nº batidas DTF", dtf_pessoas_qtd: "Pessoas/qtd DTF", dtf_observacao: "Observação DTF",
  tela_gravada: "Tela gravada", silk_feito: "Silk feito",
  silk_data_executada: "Data Silk executado", quem_bateu_silk: "Quem bateu Silk",
  quem_revelou_tela: "Quem revelou tela", n_batidas_silk: "Nº batidas Silk", silk_observacao: "Observação Silk",
  embalado: "Embalado", acabamento_data: "Data acabamento",
  data_saida_juff: "Data saída Juff", responsavel_acabamento: "Responsável acabamento",
  responsavel_conferencia: "Responsável conferência",
  inicio_acabamento: "Início acabamento", termino_acabamento: "Término acabamento",
  dias_secagem: "Dias de secagem", finalizado_em: "Finalizado em", tempo_producao: "Tempo de produção",
  expedicao_entrou_em: "Entrou em expedição",
  exp_cobranca_pagamento: "Cobrança de pagamento", exp_pagamento: "Pagamento",
  exp_etiqueta: "Etiqueta", exp_frete_solicitado: "Frete solicitado",
  exp_frete_solicitado_em: "Frete solicitado em", exp_despachado: "Despachado",
  exp_despachado_em: "Despachado em", exp_observacoes: "Observações expedição",
};

const GRUPOS_CAMPOS: { titulo: string; chaves: string[] }[] = [
  { titulo: "Input de Produção", chaves: ["status_pecas", "tipo_estampa", "arte_data", "inicio_estamparia", "termino_estamparia"] },
  { titulo: "Arte", chaves: ["status_arte", "arte_observacao", "vetorizacao_executada", "vetorizacao_dtf", "dtf_impresso", "dtf_executado", "dtf_cortado", "dtf_cortado_data", "vetorizacao_silk", "fotolito_impresso", "fotolito_executado"] },
  { titulo: "DTF", chaves: ["dtf_estampado", "dtf_data_executada", "quem_bateu_dtf", "quem_cortou_dtf", "n_batidas_dtf", "dtf_pessoas_qtd", "dtf_observacao"] },
  { titulo: "Silk", chaves: ["tela_gravada", "silk_feito", "silk_data_executada", "quem_bateu_silk", "quem_revelou_tela", "n_batidas_silk", "silk_observacao"] },
  { titulo: "Acabamento", chaves: ["embalado", "acabamento_data", "data_saida_juff", "responsavel_acabamento", "responsavel_conferencia", "inicio_acabamento", "termino_acabamento", "dias_secagem", "finalizado_em", "tempo_producao"] },
  { titulo: "Expedição", chaves: ["expedicao_entrou_em", "exp_cobranca_pagamento", "exp_pagamento", "exp_etiqueta", "exp_frete_solicitado", "exp_frete_solicitado_em", "exp_despachado", "exp_despachado_em", "exp_observacoes"] },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fmtCampo(key: string, value: any, profilesMap: Record<string, string>): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (key === "dtf_pessoas_qtd") {
      const entries = Object.entries(value as Record<string, number>);
      if (entries.length === 0) return "—";
      return entries.map(([uid, qtd]) => `${resolveNome(profilesMap, uid)}: ${qtd}`).join(", ");
    }
    return JSON.stringify(value);
  }
  const s = String(value);
  if (UUID_RE.test(s)) return resolveNome(profilesMap, s);
  if (ISO_DT_RE.test(s)) return fmtDataHoraBR(s);
  if (ISO_DATE_RE.test(s)) return fmtDataBR(s);
  return s;
}

function RetratoView({ retrato, profilesMap }: { retrato: RefacaoRetrato; profilesMap: Record<string, string> }) {
  const campos = retrato.campos_apagados ?? {};
  const grupos = GRUPOS_CAMPOS.map((g) => ({
    ...g,
    entradas: g.chaves
      .map((k) => [k, campos[k]] as [string, any])
      .filter(([, v]) => v !== null && v !== undefined && v !== ""),
  })).filter((g) => g.entradas.length > 0);
  return (
    <div className="rounded-md bg-background border p-2 text-xs space-y-2">
      <div className="font-medium text-muted-foreground uppercase text-[10px]">
        Retrato congelado no momento da refação
      </div>
      <div>
        <span className="text-muted-foreground">Datas originais: </span>
        entrada {fmtDataBR(retrato.entrada_pedido)} · saída Juff {fmtDataBR(retrato.saida_juff)}
      </div>
      <div>
        <span className="text-muted-foreground">Etapas concluídas: </span>
        {retrato.etapas_concluidas.length === 0 ? (
          <span>—</span>
        ) : (
          retrato.etapas_concluidas.map((e, i) => (
            <span key={i}>
              {i > 0 && " · "}
              {e.etapa} ✓ {fmtDataBR(e.data)}
              {e.responsavel ? ` (${resolveNome(profilesMap, e.responsavel)})` : ""}
            </span>
          ))
        )}
      </div>
      {grupos.length > 0 && (
        <div className="pt-1 border-t space-y-2">
          <div className="text-muted-foreground">Registros das áreas no momento da refação:</div>
          {grupos.map((g) => (
            <div key={g.titulo}>
              <div className="font-semibold text-[11px] mb-0.5">{g.titulo}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 pl-2">
                {g.entradas.map(([k, v]) => (
                  <div key={k} className="flex gap-1">
                    <span className="text-muted-foreground">{CAMPO_LABEL[k] ?? k}:</span>
                    <span className="font-medium">{fmtCampo(k, v, profilesMap)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EpisodioRead({ pedido, episodio, profilesMap }: { pedido: Pedido; episodio: RefacaoEpisodio; profilesMap: Record<string, string> }) {
  const mostraAdesivos = tipoIncluiDTF(pedido.tipo_estampa);
  const responsavel = resolveNome(profilesMap, episodio.quem);
  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>{fmtEtapa(episodio.etapa_origem)}</span>
        <span className="text-muted-foreground">→</span>
        <span>{ETAPA_DESTINO_LABEL[episodio.etapa_destino] ?? episodio.etapa_destino}</span>
        <Badge variant={episodio.aberto ? "default" : "secondary"} className="ml-auto">
          {episodio.aberto ? "Em aberto" : "Encerrado"}
        </Badge>
      </div>
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 text-sm">
        <Read label="Data" value={fmtDataHoraBR(episodio.data)} />
        <Read label="Responsável" value={responsavel} />
        <Read label="Peças a refazer" value={String(episodio.pecas_refazer ?? 0)} />
        <Read label="Peças perdidas" value={(episodio.perda_pecas ?? 0) > 0 ? `Sim — ${episodio.perda_pecas}` : "Não"} />
        {mostraAdesivos && (
          <Read label="Adesivos perdidos" value={(episodio.perda_adesivos ?? 0) > 0 ? `Sim — ${episodio.perda_adesivos}` : "Não"} />
        )}
      </div>
      <div>
        <div className="text-[11px] text-muted-foreground font-medium mb-0.5">Motivo</div>
        <div className="text-sm whitespace-pre-wrap">{episodio.motivo || "—"}</div>
      </div>
      
    </div>
  );
}

function Read({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground font-medium">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

interface ButtonProps {
  pedido: Pedido;
  className?: string;
}

/**
 * Botão laranja "Visualizar dados de refação" + dialog read-only.
 * Só renderiza se o pedido tiver pelo menos um episódio de refação.
 */
export function RefacaoViewerButton({ pedido, className }: ButtonProps) {
  const [open, setOpen] = useState(false);
  const profilesMap = useProfilesMap();
  const refs = Array.isArray(pedido.refacoes) ? pedido.refacoes : [];
  if (refs.length === 0) return null;
  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        style={{ backgroundColor: ORANGE, color: "white", borderColor: ORANGE }}
      >
        <History className="h-4 w-4 mr-1" />
        Visualizar dados de refação
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dados de refação — {pedido.pedido_olist ?? "—"}</DialogTitle>
            <DialogDescription>
              {refs.length} episódio{refs.length === 1 ? "" : "s"} registrado{refs.length === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {refs.map((e, i) => (
              <EpisodioRead key={i} pedido={pedido} episodio={e} profilesMap={profilesMap} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
