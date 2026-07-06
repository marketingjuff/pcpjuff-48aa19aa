import { useState } from "react";
import type { Pedido, PecaSolicitada } from "@/lib/pedidos";
import { rotuloCop } from "@/lib/cop";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Check, X } from "lucide-react";

interface Props { pedido: Pedido | null }

type LogItem = NonNullable<Pedido["pecas_completadas_log"]>[number];

function recomputeEnviadas(
  solicitadas: PecaSolicitada[],
  log: LogItem[],
): PecaSolicitada[] {
  const totals = new Map<string, number>();
  for (const l of log) {
    const k = `${l.modelo}||${l.cor}||${l.tamanho}`;
    totals.set(k, (totals.get(k) ?? 0) + (Number(l.qtd) || 0));
  }
  return solicitadas.map((s) => {
    const k = `${s.modelo}||${s.cor}||${s.tamanho}`;
    const t = totals.get(k) ?? 0;
    return { ...s, qtd_enviada: Math.min(Number(s.qtd) || 0, t) };
  });
}

export function PecasCompletadasPanel({ pedido }: Props) {
  const raw = pedido?.pecas_completadas_log as unknown;
  const log: LogItem[] = Array.isArray(raw) ? (raw as LogItem[]) : [];
  const qc = useQueryClient();
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editQtd, setEditQtd] = useState<number>(0);
  const [editObs, setEditObs] = useState<string>("");

  const salvar = useMutation({
    mutationFn: async (novoLog: LogItem[]) => {
      if (!pedido) return;
      const solicitadas = ((pedido.pecas_solicitadas as PecaSolicitada[] | null) ?? []).slice();
      const novaSolic = recomputeEnviadas(solicitadas, novoLog);
      const { error } = await supabase
        .from("pedidos" as any)
        .update({
          pecas_completadas_log: novoLog as any,
          pecas_solicitadas: novaSolic as any,
        })
        .eq("id", pedido.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["pedidos-falta"] });
      qc.invalidateQueries({ queryKey: ["pedidos-cop-saldos"] });
      toast.success("Registro corrigido.");
      setEditIdx(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao corrigir."),
  });

  if (!pedido || log.length === 0) return null;

  // Ordena por data desc mantendo o índice original para editar/excluir.
  const ordenado = log
    .map((l, idx) => ({ l, idx }))
    .sort((a, b) => (b.l.em || "").localeCompare(a.l.em || ""));

  function iniciarEdicao(idx: number) {
    const item = log[idx];
    setEditIdx(idx);
    setEditQtd(Number(item.qtd) || 0);
    setEditObs(item.observacao || "");
  }
  function cancelarEdicao() {
    setEditIdx(null);
  }
  function confirmarEdicao(idx: number) {
    const novo = log.slice();
    const q = Math.max(0, Math.floor(Number(editQtd) || 0));
    if (q <= 0) {
      // qty 0 = deletar
      novo.splice(idx, 1);
    } else {
      novo[idx] = { ...(novo[idx] as LogItem), qtd: q, observacao: editObs || null };
    }
    salvar.mutate(novo);
  }
  function excluir(idx: number) {
    const novo = log.slice();
    novo.splice(idx, 1);
    salvar.mutate(novo);
  }

  return (
    <div className="mt-2 rounded-md border bg-emerald-50/50 border-emerald-200 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-emerald-900 mb-1 flex items-center justify-between">
        <span>Peças completadas pelo COP ({log.length})</span>
        <span className="text-[10px] font-normal normal-case text-emerald-700">
          Clique no lápis para corrigir.
        </span>
      </div>
      <ul className="text-xs space-y-1">
        {ordenado.map(({ l, idx }) => {
          const isEdit = editIdx === idx;
          return (
            <li key={idx} className="text-emerald-900 flex items-start gap-2">
              <div className="flex-1">
                <span className="font-mono">{new Date(l.em).toLocaleString("pt-BR")}</span>
                {" — "}
                {isEdit ? (
                  <span className="inline-flex items-center gap-1 align-middle">
                    <Input
                      type="number"
                      min={0}
                      className="h-6 w-16 text-center px-1 inline-block"
                      value={editQtd || ""}
                      onChange={(ev) => setEditQtd(Number(ev.target.value) || 0)}
                    />
                    <span>× {l.modelo} · {l.cor} · {l.tamanho}</span>
                  </span>
                ) : (
                  <>
                    <b>{l.qtd}×</b> {l.modelo} · {l.cor} · {l.tamanho}
                  </>
                )}
                {l.cop_numero != null && (
                  <> {" "}<span className="text-emerald-700">(COP {rotuloCop(l.cop_numero, l.cop_letra ?? null)})</span></>
                )}
                {isEdit ? (
                  <div className="mt-1">
                    <Textarea
                      className="text-xs min-h-[40px]"
                      placeholder="Observação (opcional)"
                      value={editObs}
                      onChange={(ev) => setEditObs(ev.target.value)}
                    />
                  </div>
                ) : (
                  l.observacao && <> {" — "}<i className="text-emerald-700">{l.observacao}</i></>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isEdit ? (
                  <>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-emerald-700 hover:bg-emerald-100"
                      onClick={() => confirmarEdicao(idx)}
                      disabled={salvar.isPending}
                      title="Salvar"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={cancelarEdicao}
                      title="Cancelar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-emerald-800 hover:bg-emerald-100"
                      onClick={() => iniciarEdicao(idx)}
                      title="Corrigir"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-red-600 hover:bg-red-100"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir baixa do COP?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta baixa de <b>{l.qtd}× {l.modelo} · {l.cor} · {l.tamanho}</b> será removida e o
                            enviado da peça será recalculado. Não é possível desfazer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => excluir(idx)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
