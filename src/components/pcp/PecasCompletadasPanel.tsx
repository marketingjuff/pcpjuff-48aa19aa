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
import { Pencil, Undo2, Check, X } from "lucide-react";

interface Props { pedido: Pedido | null }

type LogItem = NonNullable<Pedido["pecas_completadas_log"]>[number];

function keyOf(p: { modelo: string; cor: string; tamanho: string }) {
  return `${p.modelo}||${p.cor}||${p.tamanho}`;
}

function recomputeEnviadas(
  solicitadas: PecaSolicitada[],
  logAnterior: LogItem[],
  log: LogItem[],
): PecaSolicitada[] {
  const totaisAtuais = new Map<string, number>();
  const totaisAnteriores = new Map<string, number>();
  const exemploPorKey = new Map<string, LogItem>();

  for (const l of logAnterior) {
    const k = keyOf(l);
    totaisAnteriores.set(k, (totaisAnteriores.get(k) ?? 0) + (Number(l.qtd) || 0));
    exemploPorKey.set(k, l);
  }
  for (const l of log) {
    const k = keyOf(l);
    totaisAtuais.set(k, (totaisAtuais.get(k) ?? 0) + (Number(l.qtd) || 0));
  }

  const next = solicitadas.map((s) => ({ ...s }));
  const totalSolicitadoPorKey = new Map<string, number>();
  for (const s of next) {
    const k = keyOf(s);
    totalSolicitadoPorKey.set(k, (totalSolicitadoPorKey.get(k) ?? 0) + (Number(s.qtd) || 0));
  }

  for (const [k, totalAnterior] of totaisAnteriores) {
    const totalAtual = totaisAtuais.get(k) ?? 0;
    const totalSolicitado = totalSolicitadoPorKey.get(k) ?? 0;
    if (totalAnterior <= totalAtual || totalSolicitado >= totalAnterior) continue;

    const exemplo = exemploPorKey.get(k);
    if (!exemplo) continue;
    next.push({
      modelo: exemplo.modelo,
      cor: exemplo.cor,
      tamanho: exemplo.tamanho,
      qtd: totalAnterior - totalSolicitado,
      qtd_enviada: 0,
    });
  }

  const enviadoUsadoPorKey = new Map<string, number>();
  return next.map((s) => {
    const k = keyOf(s);
    const enviadoDisponivel = totaisAtuais.get(k) ?? 0;
    const enviadoUsado = enviadoUsadoPorKey.get(k) ?? 0;
    const qtd = Number(s.qtd) || 0;
    const qtdEnviada = Math.min(qtd, Math.max(0, enviadoDisponivel - enviadoUsado));
    enviadoUsadoPorKey.set(k, enviadoUsado + qtdEnviada);
    return { ...s, qtd_enviada: qtdEnviada };
  });
}

function statusPecas(solicitadas: PecaSolicitada[]): "completo" | "incompleto" {
  if (solicitadas.length === 0) return "incompleto";
  return solicitadas.some((s) => (Number(s.qtd_enviada) || 0) < (Number(s.qtd) || 0)) ? "incompleto" : "completo";
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
      const novaSolic = recomputeEnviadas(solicitadas, log, novoLog);
      const { error } = await supabase
        .from("pedidos" as any)
        .update({
          pecas_completadas_log: novoLog as any,
          pecas_solicitadas: novaSolic as any,
          status_pecas: statusPecas(novaSolic),
        })
        .eq("id", pedido.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["pedidos-falta"] });
      qc.invalidateQueries({ queryKey: ["pedidos-cop-saldos"] });
      toast.success("Baixa corrigida.");
      setEditIdx(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao corrigir."),
  });

  if (!pedido || log.length === 0) return null;

  // Ordena por data desc mantendo o índice original para editar/reverter.
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
      // qtd 0 = reverter baixa
      novo.splice(idx, 1);
    } else {
      const atual = novo[idx] as any;
      novo[idx] = { ...atual, qtd: q, observacao: editObs || null } as LogItem;
    }
    salvar.mutate(novo);
  }
  function reverter(idx: number) {
    const novo = log.slice();
    novo.splice(idx, 1);
    salvar.mutate(novo);
  }

  return (
    <div className="mt-2 rounded-md border bg-emerald-50/50 border-emerald-200 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-emerald-900 mb-1 flex items-center justify-between">
        <span>Peças completadas pelo COP ({log.length})</span>
        <span className="text-[10px] font-normal normal-case text-emerald-700">
          Lápis edita; seta reverte a baixa.
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
                          className="h-6 w-6 text-amber-700 hover:bg-amber-100"
                          title="Reverter baixa"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reverter baixa do COP?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta baixa de <b>{l.qtd}× {l.modelo} · {l.cor} · {l.tamanho}</b> será revertida,
                            voltando como pendência incompleta no COP.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => reverter(idx)}>
                            Reverter baixa
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
