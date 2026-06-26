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

function novoGrupo(): GrupoLinha {
  return { modelo: "", cor: "", qtd: {}, qtd_enviada: {} };
}

function agrupar(value: PecaSolicitada[]): GrupoLinha[] {
  const map = new Map<string, GrupoLinha>();
  for (const p of value ?? []) {
    const key = `${p.modelo}|${p.cor}`;
    let g = map.get(key);
    if (!g) {
      g = { modelo: p.modelo, cor: p.cor, qtd: {}, qtd_enviada: {} };
      map.set(key, g);
    }
    const tam = p.tamanho || "—";
    g.qtd[tam] = (g.qtd[tam] || 0) + (Number(p.qtd) || 0);
    g.qtd_enviada[tam] = (g.qtd_enviada[tam] || 0) + (Number(p.qtd_enviada) || 0);
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
        qtd_enviada: Math.min(q, Number(g.qtd_enviada[tam]) || 0),
      });
    }
  }
  return out;
}

export function SolicitarPecasDialog({ open, onOpenChange, value, onSave, readOnly = false, limite }: Props) {
  const [grupos, setGrupos] = useState<GrupoLinha[]>(() => agrupar(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setGrupos(agrupar(value));
  }, [open, value]);

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
      let valor = Math.max(0, n);
      if (typeof limite === "number" && limite > 0) {
        const outros = totalAtual(arr, i, tam);
        const max = Math.max(0, limite - outros);
        if (valor > max) valor = max;
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
        env += Math.min(Number(g.qtd[tam]) || 0, Number(g.qtd_enviada[tam]) || 0);
      }
    }
    return { sol, env, pend: Math.max(0, sol - env) };
  }, [grupos]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1200px] w-[95vw]">
        <DialogHeader>
          <DialogTitle>{readOnly ? "Peças solicitadas (somente leitura)" : "Solicitar Peças"}</DialogTitle>
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
              env += Math.min(q, Number(g.qtd_enviada[tam]) || 0);
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
                  <Select value={g.modelo} onValueChange={(v) => setGrupo(i, { modelo: v })} disabled={readOnly}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {REFACAO_MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="md:hidden text-[11px] text-muted-foreground font-medium">Cor</label>
                  <Select value={g.cor} onValueChange={(v) => setGrupo(i, { cor: v })} disabled={readOnly}>
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
                  const e = Math.min(q, Number(g.qtd_enviada[tam]) || 0);
                  return (
                    <div key={tam} className="flex flex-col items-center">
                      <label className="md:hidden text-[10px] text-muted-foreground font-medium">{tam}</label>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-center px-1"
                        value={q || ""}
                        placeholder="0"
                        disabled={readOnly}
                        onChange={(ev) => setQtd(i, tam, Number(ev.target.value) || 0)}
                      />
                      {q > 0 && (
                        <span className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
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
                  {!readOnly && (
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => remover(i)} title="Remover">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {!readOnly && (
            <div className="flex justify-start pt-1">
              <Button type="button" size="sm" variant="outline" onClick={adicionar}>
                <Plus className="h-4 w-4 mr-1" />Adicionar peça
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2 text-xs text-muted-foreground items-center">
            <span>Total solicitado: <span className="font-semibold tabular-nums text-foreground">{totals.sol}</span></span>
            <span>Total enviado: <span className="font-semibold tabular-nums text-foreground">{totals.env}</span></span>
            <span>Pendente: <span className="font-semibold tabular-nums text-foreground">{totals.pend}</span></span>
            {typeof limite === "number" && limite > 0 && (
              <span>
                Limite do vendedor:{" "}
                <span className={`font-semibold tabular-nums ${totals.sol > limite ? "text-red-600" : "text-foreground"}`}>
                  {totals.sol}/{limite}
                </span>
              </span>
            )}
          </div>
          {typeof limite === "number" && limite > 0 && totals.sol > limite && (
            <div className="text-[12px] text-red-600 font-medium">
              O total solicitado ({totals.sol}) ultrapassa a quantidade do vendedor ({limite}).
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? "Fechar" : "Cancelar"}
          </Button>
          {!readOnly && (
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || (typeof limite === "number" && limite > 0 && totals.sol > limite)}
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
