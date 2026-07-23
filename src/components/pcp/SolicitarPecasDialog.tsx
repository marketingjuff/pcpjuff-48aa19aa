import { useEffect, useMemo, useState } from "react";
import {
  REFACAO_MODELOS,
  REFACAO_TAMANHOS,
  REFACAO_CORES,
  type PecaSolicitada,
} from "@/lib/pedidos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, X, CheckCheck } from "lucide-react";
import { corHex, corTextoSobre } from "./PecasPerdidasEditor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: PecaSolicitada[];
  pecasCompletadasLog?: Array<{ modelo: string; cor: string; tamanho: string; qtd: number }> | null;
  onSave: (next: PecaSolicitada[]) => void | Promise<void>;
  readOnly?: boolean;
  /** Quantidade máxima de peças permitida (qtd do vendedor). */
  limite?: number;
  /** Libera para completo: apaga a solicitação e marca o pedido como completo. */
  onLiberarCompleto?: () => void | Promise<void>;
}

type GrupoLinha = {
  modelo: string;
  cor: string;
  // por tamanho
  qtd: Record<string, number>;
  qtd_enviada: Record<string, number>;
};

type LogPecaCompletada = { modelo: string; cor: string; tamanho: string; qtd: number };

function keyOf(p: { modelo: string; cor: string; tamanho: string }) {
  return `${p.modelo}|${p.cor}|${p.tamanho}`;
}

function enviadosPorLog(log?: LogPecaCompletada[] | null): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(log)) return map;
  for (const item of log) {
    const qtd = Number(item?.qtd) || 0;
    if (qtd <= 0) continue;
    map.set(keyOf(item), (map.get(keyOf(item)) ?? 0) + qtd);
  }
  return map;
}

function novoGrupo(): GrupoLinha {
  return { modelo: "", cor: "", qtd: {}, qtd_enviada: {} };
}

function agrupar(value: PecaSolicitada[], log?: LogPecaCompletada[] | null): GrupoLinha[] {
  const map = new Map<string, GrupoLinha>();
  const enviadosLog = enviadosPorLog(log);
  for (const p of value ?? []) {
    const key = `${p.modelo}|${p.cor}`;
    let g = map.get(key);
    if (!g) {
      g = { modelo: p.modelo, cor: p.cor, qtd: {}, qtd_enviada: {} };
      map.set(key, g);
    }
    const tam = p.tamanho || "—";
    g.qtd[tam] = (g.qtd[tam] || 0) + (Number(p.qtd) || 0);
  }
  // Preencher enviadas SEMPRE pelo log real (não cap pelo solicitado)
  if (Array.isArray(log)) {
    for (const item of log) {
      const qtd = Number(item?.qtd) || 0;
      if (qtd <= 0) continue;
      const key = `${item.modelo}|${item.cor}`;
      let g = map.get(key);
      if (!g) {
        g = { modelo: item.modelo, cor: item.cor, qtd: {}, qtd_enviada: {} };
        map.set(key, g);
      }
      const tam = item.tamanho || "—";
      g.qtd_enviada[tam] = (g.qtd_enviada[tam] || 0) + qtd;
    }
  } else {
    // fallback: usa qtd_enviada salvo
    for (const p of value ?? []) {
      const key = `${p.modelo}|${p.cor}`;
      const g = map.get(key);
      if (!g) continue;
      const tam = p.tamanho || "—";
      g.qtd_enviada[tam] = (g.qtd_enviada[tam] || 0) + (Number(p.qtd_enviada) || 0);
    }
  }
  return Array.from(map.values());
}


function desagrupar(grupos: GrupoLinha[]): PecaSolicitada[] {
  const out: PecaSolicitada[] = [];
  for (const g of grupos) {
    for (const tam of REFACAO_TAMANHOS) {
      const q = Number(g.qtd[tam]) || 0;
      if (q <= 0) continue;
      out.push({
        modelo: g.modelo,
        cor: g.cor,
        tamanho: tam,
        qtd: q,
        qtd_enviada: Number(g.qtd_enviada[tam]) || 0,
      });
    }
  }
  return out;
}


export function SolicitarPecasDialog({ open, onOpenChange, value, pecasCompletadasLog, onSave, readOnly = false, limite, onLiberarCompleto }: Props) {
  const [grupos, setGrupos] = useState<GrupoLinha[]>(() => agrupar(value, pecasCompletadasLog));
  const [saving, setSaving] = useState(false);
  const [totalSolicitado, setTotalSolicitado] = useState<number>(() => {
    const inicial = agrupar(value, pecasCompletadasLog).reduce((s, g) => {
      for (const t of REFACAO_TAMANHOS) s += Number(g.qtd[t]) || 0;
      return s;
    }, 0);
    if (inicial > 0) return inicial;
    return typeof limite === "number" && limite > 0 ? limite : 0;
  });

  useEffect(() => {
    if (open) {
      const g = agrupar(value, pecasCompletadasLog);
      setGrupos(g);
      const inicial = g.reduce((s, gr) => {
        for (const t of REFACAO_TAMANHOS) s += Number(gr.qtd[t]) || 0;
        return s;
      }, 0);
      if (inicial > 0) setTotalSolicitado(inicial);
      else if (typeof limite === "number" && limite > 0) setTotalSolicitado(limite);
      else setTotalSolicitado(0);
    }
  }, [open, value, pecasCompletadasLog, limite]);

  function setGrupo(i: number, patch: Partial<GrupoLinha>) {
    setGrupos((arr) => arr.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }
  function totalAtual(arr: GrupoLinha[], excluirIdx?: number, excluirTam?: string): number {
    let s = 0;
    arr.forEach((g, idx) => {
      for (const tam of REFACAO_TAMANHOS) {
        if (idx === excluirIdx && tam === excluirTam) continue;
        s += Number(g.qtd[tam]) || 0;
      }
    });
    return s;
  }
  function setQtd(i: number, tam: string, n: number) {
    setGrupos((arr) => arr.map((g, idx) => {
      if (idx !== i) return g;
      const valor = Math.max(0, n);
      if (totalSolicitado > 0) {
        const outros = totalAtual(arr, i, tam);
        const permitido = Math.max(0, totalSolicitado - outros);
        return { ...g, qtd: { ...g.qtd, [tam]: Math.min(valor, permitido) } };
      }
      return { ...g, qtd: { ...g.qtd, [tam]: valor } };
    }));
  }

  function adicionar() {
    setGrupos((arr) => [...arr, novoGrupo()]);
  }
  function remover(i: number) {
    setGrupos((arr) => arr.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (typeof limite === "number" && limite > 0 && totalSolicitado > limite) return;
    let sol = 0;
    for (const g of grupos) for (const tam of REFACAO_TAMANHOS) sol += Number(g.qtd[tam]) || 0;
    if (totalSolicitado > 0 && sol > totalSolicitado) return;
    setSaving(true);
    try {
      await onSave(desagrupar(grupos));
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const totals = useMemo(() => {
    let sol = 0, env = 0;
    for (const g of grupos) {
      for (const tam of REFACAO_TAMANHOS) {
        sol += Number(g.qtd[tam]) || 0;
        env += Number(g.qtd_enviada[tam]) || 0;
      }
    }
    return { sol, env, pend: Math.max(0, sol - env) };
  }, [grupos]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1200px] w-[95vw]">
        <DialogHeader>
          <DialogTitle>
            {readOnly ? "Peças solicitadas (somente leitura)" : "Solicitar Peças"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 overflow-x-auto">
          {grupos.length === 0 && (
            <div className="text-sm text-muted-foreground">Nenhuma peça registrada.</div>
          )}

          {grupos.length > 0 && (
            <div className="hidden md:grid gap-2 px-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
                 style={{ gridTemplateColumns: `minmax(140px,1.4fr) minmax(140px,1.4fr) repeat(${REFACAO_TAMANHOS.length}, minmax(60px,1fr)) minmax(160px,1.2fr) 28px` }}>
              <div>Modelo</div>
              <div>Cor</div>
              {REFACAO_TAMANHOS.map((t) => <div key={t} className="text-center">{t}</div>)}
              <div className="text-center">Sol / Env / Pend</div>
              <div />
            </div>
          )}

          {grupos.map((g, i) => {
            const hex = corHex(g.cor);
            const fg = corTextoSobre(hex);
            let sol = 0, env = 0;
            for (const tam of REFACAO_TAMANHOS) {
              const q = Number(g.qtd[tam]) || 0;
              sol += q;
              env += Number(g.qtd_enviada[tam]) || 0;
            }

            const pend = Math.max(0, sol - env);
            const tudoEnviado = sol > 0 && env >= sol;
            return (
              <div
                key={i}
                className="rounded-md border p-2 bg-muted/30 grid gap-2 items-end"
                style={{ gridTemplateColumns: `minmax(140px,1.4fr) minmax(140px,1.4fr) repeat(${REFACAO_TAMANHOS.length}, minmax(60px,1fr)) minmax(160px,1.2fr) 28px` }}
              >
                <div>
                  <label className="md:hidden text-[11px] text-muted-foreground font-medium">Modelo</label>
                  <Select value={g.modelo} onValueChange={(v) => setGrupo(i, { modelo: v })} disabled={effectiveReadOnly}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {REFACAO_MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="md:hidden text-[11px] text-muted-foreground font-medium">Cor</label>
                  <Select value={g.cor} onValueChange={(v) => setGrupo(i, { cor: v })} disabled={effectiveReadOnly}>
                    <SelectTrigger
                      className="h-8"
                      style={g.cor ? { backgroundColor: hex, color: fg, borderColor: fg === "#ffffff" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)" } : undefined}
                    >
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {REFACAO_CORES.map((c) => {
                        const f = corTextoSobre(c.hex);
                        return (
                          <SelectItem
                            key={c.nome}
                            value={c.nome}
                            style={{ backgroundColor: c.hex, color: f }}
                            className="my-0.5 rounded-sm focus:opacity-90"
                          >
                            {c.nome}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {REFACAO_TAMANHOS.map((tam) => {
                  const q = Number(g.qtd[tam]) || 0;
                  const e = Number(g.qtd_enviada[tam]) || 0;
                  return (
                    <div key={tam} className="flex flex-col items-center">
                      <label className="md:hidden text-[10px] text-muted-foreground font-medium">{tam}</label>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-center px-1"
                        value={q || ""}
                        placeholder="0"
                        disabled={effectiveReadOnly}
                        onChange={(ev) => setQtd(i, tam, Number(ev.target.value) || 0)}
                      />
                      {(q > 0 || e > 0) && (
                        <span className={`text-[10px] mt-0.5 tabular-nums ${e > q ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
                          {e}/{q}
                        </span>
                      )}
                    </div>
                  );
                })}


                <div className="flex flex-wrap gap-1 justify-center text-[11px]">
                  <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200">Sol. {sol}</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">Env. {env}</span>
                  <span className={`px-1.5 py-0.5 rounded border ${pend > 0 ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-muted text-muted-foreground"}`}>
                    Pend. {pend}
                  </span>
                  {tudoEnviado && <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white">OK</span>}
                </div>

                <div className="flex justify-end">
                  {!effectiveReadOnly && (
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => remover(i)} title="Remover">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {!effectiveReadOnly && (
            <div className="flex justify-start pt-1">
              <Button type="button" size="sm" variant="outline" onClick={adicionar}>
                <Plus className="h-4 w-4 mr-1" />Adicionar peça
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2 text-xs text-muted-foreground items-center">
            <div className="flex items-center gap-2 px-2 py-1 rounded border bg-violet-50 border-violet-200">
              <label className="font-medium text-violet-900">Total de peças a solicitar:</label>
              <Input
                type="number"
                min={0}
                max={typeof limite === "number" && limite > 0 ? limite : undefined}
                className="h-7 w-24 text-center px-1"
                value={totalSolicitado || ""}
                placeholder="0"
                disabled={effectiveReadOnly}
                onChange={(ev) => {
                  const n = Math.max(0, Number(ev.target.value) || 0);
                  const capped = typeof limite === "number" && limite > 0 ? Math.min(n, limite) : n;
                  setTotalSolicitado(capped);
                }}
              />
              {typeof limite === "number" && limite > 0 && (
                <span className="text-violet-900/70">/ {limite} (vendedor)</span>
              )}
            </div>
            <span>Total distribuído: <span className={`font-semibold tabular-nums ${totalSolicitado > 0 && totals.sol > totalSolicitado ? "text-red-600" : "text-foreground"}`}>{totals.sol}{totalSolicitado > 0 ? `/${totalSolicitado}` : ""}</span></span>
            <span>Total enviado: <span className="font-semibold tabular-nums text-foreground">{totals.env}</span></span>
            <span>Pendente: <span className="font-semibold tabular-nums text-foreground">{totals.pend}</span></span>
            {totalSolicitado > 0 && totals.sol > totalSolicitado && (
              <span className="text-red-600">
                Distribuição por tamanho ({totals.sol}) ultrapassa o total solicitado ({totalSolicitado}).
              </span>
            )}
          </div>
        </div>




        <DialogFooter className="gap-2 sm:gap-2">
          {!effectiveReadOnly && onLiberarCompleto && totals.pend > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 mr-auto"
                >
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Liberar para completo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Liberar pedido como completo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso vai apagar a solicitação de peças desse pedido e marcar o status como{" "}
                    <b>completo</b>, destravando o fluxo. Confirmar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Não</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      await onLiberarCompleto();
                      onOpenChange(false);
                    }}
                  >
                    Sim, liberar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {!editMode && (
            <Button
              type="button"
              variant="outline"
              className="border-amber-500 text-amber-700 hover:bg-amber-50 mr-auto"
              onClick={() => setEditMode(true)}
              title="Liberar edição de todos os campos"
            >
              <Pencil className="h-4 w-4 mr-1" />
              Corrigir solicitação
            </Button>
          )}

          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {effectiveReadOnly ? "Fechar" : "Cancelar"}
          </Button>
          {!effectiveReadOnly && (
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || (typeof limite === "number" && limite > 0 && totalSolicitado > limite) || (totalSolicitado > 0 && totals.sol > totalSolicitado)}
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
