import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  calcularEtapaNatural,
  type CorrecaoEtapa,
  type Pedido,
} from "@/lib/pedidos";
import { camposAlimpar } from "./refacao-helpers";

export type CorrigirDestino = "dados" | "arte" | "dtf" | "silk" | "acabamento";

const DESTINO_LABEL: Record<CorrigirDestino, string> = {
  dados: "Dados In",
  arte: "Arte",
  dtf: "DTF",
  silk: "Silk",
  acabamento: "Acabamento",
};

const DESTINO_ETAPA_NOVA: Record<CorrigirDestino, string> = {
  dados: "Aguardando input de produção",
  arte: "Aguardando Arte",
  dtf: "Aguardando DTF",
  silk: "Aguardando Silk",
  acabamento: "Aguardando Acabamento",
};

interface Props {
  pedido: Pedido;
  destino: CorrigirDestino;
  abaOrigem: CorrecaoEtapa["aba_origem"];
  /** Texto opcional do botão (usado no caso DTF+Silk em Acabamento). */
  label?: string;
  onSave: (patch: Partial<Pedido> & { id: string }) => void;
  onCorrigido?: (destino: CorrigirDestino) => void | Promise<void>;
  disabled?: boolean;
}

export function CorrigirEtapaButton({
  pedido,
  destino,
  abaOrigem,
  label,
  onSave,
  onCorrigido,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const destinoLabel = DESTINO_LABEL[destino];
  const btnLabel = label ?? "Corrigir etapa";
  const tooltipText = `Puxa a etapa de volta para: ${destinoLabel}`;

  async function confirmar() {
    const motivo = obs.trim();
    if (!motivo) {
      toast.error("Informe o motivo da correção.");
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id ?? null;
      const etapaAnterior = calcularEtapaNatural(pedido).etapa.replace(/\*+$/, "");
      const entrada: CorrecaoEtapa = {
        data: new Date().toISOString(),
        usuario_id: uid,
        aba_origem: abaOrigem,
        etapa_anterior: etapaAnterior,
        etapa_nova_apos_correcao: DESTINO_ETAPA_NOVA[destino],
        observacao: motivo,
      };
      const historico: CorrecaoEtapa[] = Array.isArray(pedido.correcoes_etapa)
        ? pedido.correcoes_etapa
        : [];
      onSave({
        id: pedido.id,
        ...(camposAlimpar(pedido, destino) as any),
        correcoes_etapa: [...historico, entrada] as any,
      });
      setOpen(false);
      setObs("");
      toast.success(`Pedido enviado de volta para ${destinoLabel}.`);
      if (onCorrigido) await onCorrigido(destino);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao corrigir etapa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => setOpen(true)}
              className="h-9"
            >
              <Undo2 className="h-4 w-4 mr-1" />
              {btnLabel}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AlertDialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Corrigir etapa</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido volta para <strong>{destinoLabel}</strong>. Essa ação não pode ser desfeita automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">
              Observação (motivo da correção) *
            </label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
              placeholder="Ex.: Pedido errado, era o 12345 e não o 12346"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmar(); }}
              disabled={saving || !obs.trim()}
            >
              Confirmar correção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
