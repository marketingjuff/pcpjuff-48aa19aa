import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/use-role";
import { useProfilesMap, resolveNome } from "@/hooks/use-profiles-map";
import type { Pedido, RefacaoDesfeita, RefacaoEpisodio } from "@/lib/pedidos";
import { CAMPO_LABEL } from "./RefacaoViewerButton";

interface Props {
  pedido: Pedido;
  episodio: RefacaoEpisodio;
  /** Índice do episódio no array `refacoes`. */
  index: number;
  /** Há reclassificação de perda vinculada a este episódio. */
  bloqueadoPorReclass: boolean;
}

function useCanDesfazerRefacao(): boolean {
  const { data: roles = [] } = useMyRoles();
  return roles.some((r) => r.role === "admin" || r.role === "gestor");
}

function fmtValor(key: string, value: any, profilesMap: Record<string, string>): string {
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
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return resolveNome(profilesMap, s);
  }
  return s;
}

export function DesfazerRefacaoButton({ pedido, episodio, index, bloqueadoPorReclass }: Props) {
  const podeDesfazer = useCanDesfazerRefacao();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const { data: profilesMap = {} } = useProfilesMap();

  const refsAtuais: RefacaoEpisodio[] = Array.isArray(pedido.refacoes) ? pedido.refacoes : [];
  const isUltimo = index === refsAtuais.length - 1;

  if (!podeDesfazer || !isUltimo) return null;

  const campos = ((episodio.retrato as any)?.campos_apagados ?? {}) as Record<string, any>;
  const entradas = Object.entries(campos).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  async function confirmar() {
    const txt = motivo.trim();
    if (!txt) {
      toast.error("Informe o motivo.");
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id ?? null;
      const desfeitasAtuais: RefacaoDesfeita[] = Array.isArray(pedido.refacoes_desfeitas)
        ? pedido.refacoes_desfeitas
        : [];
      const entrada: RefacaoDesfeita = {
        data: new Date().toISOString(),
        usuario_id: uid,
        motivo: txt,
        indice_original: index,
        episodio: JSON.parse(JSON.stringify(episodio)),
        campos_restaurados: Object.keys(campos),
      };
      const patch: Record<string, any> = {
        ...campos,
        refacoes: refsAtuais.filter((_, i) => i !== index),
        refacoes_desfeitas: [...desfeitasAtuais, entrada],
      };
      const { error } = await supabase.from("pedidos").update(patch as any).eq("id", pedido.id);
      if (error) throw error;
      toast.success("Refação desfeita. O pedido voltou ao estado anterior.");
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["perdas-cons-pedidos"] });
      qc.invalidateQueries({ queryKey: ["perdas-cons-reclass"] });
      setOpen(false);
      setMotivo("");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao desfazer a refação.");
    } finally {
      setSaving(false);
    }
  }

  const botao = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={bloqueadoPorReclass}
      onClick={() => setOpen(true)}
      className="h-8 border-red-300 text-red-700 hover:bg-red-50"
    >
      <RotateCcw className="h-3.5 w-3.5 mr-1" />
      Desfazer refação
    </Button>
  );

  return (
    <>
      {bloqueadoPorReclass ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">{botao}</span>
            </TooltipTrigger>
            <TooltipContent>
              Esta perda foi reclassificada no Controle de Perdas. Remova a reclassificação antes de
              desfazer a refação.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        botao
      )}

      <AlertDialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v); }}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer refação</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o episódio de refação e devolve o pedido ao estado exato de antes da
              refação: todos os campos apagados voltam com os valores originais, e o asterisco some
              da etapa. A perda de peças registrada neste episódio também deixa de contar nos
              indicadores e no Controle de Perdas.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {entradas.length > 0 ? (
            <div className="rounded-md border bg-muted/20 p-2 text-xs space-y-1 max-h-56 overflow-auto">
              <div className="font-medium text-muted-foreground uppercase text-[10px]">
                Campos que serão restaurados
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                {entradas.map(([k, v]) => (
                  <div key={k} className="flex gap-1">
                    <span className="text-muted-foreground">{CAMPO_LABEL[k] ?? k}:</span>
                    <span className="font-medium">{fmtValor(k, v, profilesMap)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
              Este episódio não tem snapshot dos campos apagados. O episódio será removido e o
              asterisco sumirá, mas os campos das etapas <strong>não</strong> serão restaurados
              automaticamente — será preciso preencher manualmente.
            </div>
          )}

          <div className="text-[11px] text-muted-foreground">
            COPs de reposição já criados a partir da perda deste episódio <strong>não</strong> são
            apagados automaticamente — confira no módulo COP se for o caso.
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">Motivo (obrigatório) *</label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ex.: refação lançada no pedido errado — era o 16543"
              autoFocus
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmar(); }}
              disabled={saving || !motivo.trim()}
            >
              Confirmar e desfazer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
