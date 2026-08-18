import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CopPeca, CopPerdaLinha, HistoricoPerda, LancamentoPerda } from "@/lib/cop";
import { MOTIVOS_PERDA_PADRAO, getPerda, lancamentosPerda, motivosDaLinha } from "@/lib/cop";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { useAppList } from "@/lib/app-lists";
import { ChevronDown, ChevronRight, Info, Pencil, Undo2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pecas: CopPeca[];
  perdas: CopPerdaLinha[];
  historico?: HistoricoPerda[];
  canManage?: boolean;
  onConfirm: (lancamentos: CopPerdaLinha[]) => void;
  onCorrigir?: (l: LancamentoPerda) => void;
  onEstornar?: (l: LancamentoPerda) => void;
  disabled?: boolean;
};

const SEM_MOTIVO = "__sem__";

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function CorChip({ cor }: { cor: string }) {
  const hex = corHex(cor);
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: hex, color: corTextoSobre(hex) }}>
      {cor}
    </span>
  );
}

export function RegistrarPerdaDialog({
  open, onOpenChange, pecas, perdas, historico = [], canManage = false,
  onConfirm, onCorrigir, onEstornar, disabled,
}: Props) {
  const key = (m: string, c: string, t: string) => `${m}|${c}|${t}`;
  type Entrada = { qtd: number; motivo?: string };
  const [vals, setVals] = useState<Record<string, Entrada[]>>({});
  const [verAnteriores, setVerAnteriores] = useState(false);
  const [estornoAlvo, setEstornoAlvo] = useState<LancamentoPerda | null>(null);
  const { names: motivosDb } = useAppList("motivo_perda");
  const motivos = motivosDb.length > 0 ? motivosDb : MOTIVOS_PERDA_PADRAO;

  useEffect(() => {
    if (!open) return;
    setVals({});
    setVerAnteriores(false);
  }, [open]);

  const totalLancamento = useMemo(
    () => Object.values(vals).reduce((a, arr) => a + arr.reduce((s, e) => s + (Number(e.qtd) || 0), 0), 0),
    [vals],
  );
  const totalAcumulado = useMemo(
    () => (perdas ?? []).reduce((a, p) => a + (Number(p.qtd) || 0), 0),
    [perdas],
  );

  const historicoObj = useMemo(() => ({ historico_perdas: historico }), [historico]);
  const lancamentos = useMemo(
    () => lancamentosPerda(historicoObj).slice().reverse(),
    [historicoObj],
  );
  const itensPorEvento = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lancamentosPerda(historicoObj)) m.set(l.em, (m.get(l.em) ?? 0) + 1);
    return m;
  }, [historicoObj]);

  function maxDaLinha(p: CopPeca): number {
    return Math.max(0, (Number(p.qtd) || 0) - getPerda(perdas, p.modelo, p.cor, p.tamanho));
  }

  function entradas(p: CopPeca): Entrada[] {
    return vals[key(p.modelo, p.cor, p.tamanho)] ?? [{ qtd: 0 }];
  }

  function setEntradas(p: CopPeca, next: Entrada[]) {
    const k = key(p.modelo, p.cor, p.tamanho);
    setVals((s) => ({ ...s, [k]: next }));
  }

  function setQ(p: CopPeca, idx: number, raw: string) {
    const digits = raw.replace(/[^\d]/g, "");
    const arr = entradas(p).map((e) => ({ ...e }));
    const max = maxDaLinha(p);
    const outros = arr.reduce((s, e, i) => (i === idx ? s : s + (Number(e.qtd) || 0)), 0);
    const v = Math.max(0, Math.min(Math.max(0, max - outros), digits === "" ? 0 : parseInt(digits, 10) || 0));
    arr[idx] = { ...arr[idx], qtd: v };
    setEntradas(p, arr);
  }

  function setMotivo(p: CopPeca, idx: number, motivo: string) {
    const arr = entradas(p).map((e) => ({ ...e }));
    arr[idx] = { ...arr[idx], motivo: motivo === SEM_MOTIVO ? undefined : motivo };
    setEntradas(p, arr);
  }

  function addMotivo(p: CopPeca) {
    setEntradas(p, [...entradas(p), { qtd: 0 }]);
  }

  function removerMotivo(p: CopPeca, idx: number) {
    const arr = entradas(p).filter((_, i) => i !== idx);
    setEntradas(p, arr.length ? arr : [{ qtd: 0 }]);
  }

  function confirmar() {
    const out: CopPerdaLinha[] = [];
    for (const p of pecas) {
      for (const e of vals[key(p.modelo, p.cor, p.tamanho)] ?? []) {
        if ((Number(e.qtd) || 0) > 0) {
          out.push({ modelo: p.modelo, cor: p.cor, tamanho: p.tamanho, qtd: e.qtd, motivo: e.motivo ?? null });
        }
      }
    }
    onConfirm(out);
  }


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Registrar perdas do romaneio</DialogTitle>
            <DialogDescription>
              Lance apenas a perda nova desta chegada, com o motivo próprio. As perdas já lançadas ficam preservadas.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border overflow-x-auto max-h-[50vh]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs sticky top-0">
                <tr>
                  <th className="p-2 text-left">Modelo</th>
                  <th className="p-2 text-left">Cor</th>
                  <th className="p-2 text-center">Tam.</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2 text-right">Já perdidas</th>
                  <th className="p-2 text-left">Motivos já lançados</th>
                  <th className="p-2 text-right">Perda agora</th>
                  <th className="p-2 text-left">Motivo deste lançamento</th>
                </tr>
              </thead>
              <tbody>
                {pecas.length === 0 ? (
                  <tr><td colSpan={8} className="p-3 text-center text-muted-foreground">Sem peças.</td></tr>
                ) : pecas.map((p, i) => {
                  const k = key(p.modelo, p.cor, p.tamanho);
                  const cur = vals[k];
                  const v = cur?.qtd ?? 0;
                  const ja = getPerda(perdas, p.modelo, p.cor, p.tamanho);
                  const max = maxDaLinha(p);
                  const noTeto = v > 0 && v >= max;
                  const motivosJa = motivosDaLinha(historicoObj, p.modelo, p.cor, p.tamanho);
                  return (
                    <tr key={i} className="border-t">
                      <td className="p-2">{p.modelo}</td>
                      <td className="p-2"><CorChip cor={p.cor} /></td>
                      <td className="p-2 text-center">{p.tamanho}</td>
                      <td className="p-2 text-right tabular-nums">{p.qtd}</td>
                      <td className={`p-2 text-right tabular-nums ${ja > 0 ? "font-semibold text-purple-600" : "text-muted-foreground"}`}>{ja}</td>
                      <td className="p-2 text-xs text-muted-foreground">{motivosJa.length ? motivosJa.join(", ") : "—"}</td>
                      <td className="p-2 text-right">
                        <Input
                          inputMode="numeric"
                          className={`h-7 w-20 ml-auto text-right tabular-nums [appearance:textfield] ${noTeto ? "border-destructive text-destructive" : ""}`}
                          value={v || ""}
                          onChange={(e) => setQ(p, e.target.value)}
                          disabled={disabled || max === 0}
                        />
                        {noTeto && <div className="text-[10px] text-destructive text-right mt-0.5">máx {max}</div>}
                      </td>
                      <td className="p-2">
                        <Select
                          value={cur?.motivo ?? SEM_MOTIVO}
                          onValueChange={(m) => setMotivo(p, m)}
                          disabled={disabled || v === 0}
                        >
                          <SelectTrigger className="h-7 w-40">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SEM_MOTIVO}>—</SelectItem>
                            {motivos.map((m) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/30">
                <tr>
                  <td colSpan={6} className="p-2 text-right"><b>Total deste lançamento</b></td>
                  <td className="p-2 text-right tabular-nums"><b>{totalLancamento}</b></td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={6} className="p-2 text-right text-xs text-muted-foreground">Perdas acumuladas no COP</td>
                  <td className="p-2 text-right text-xs text-muted-foreground tabular-nums">{totalAcumulado}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="rounded-md border">
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/40"
              onClick={() => setVerAnteriores((s) => !s)}
            >
              {verAnteriores ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Lançamentos anteriores
              <span className="text-xs text-muted-foreground">({lancamentos.length})</span>
            </button>
            {verAnteriores && (
              <div className="border-t max-h-[30vh] overflow-y-auto divide-y">
                {lancamentos.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">Nenhum lançamento registrado.</div>
                ) : lancamentos.map((l) => (
                  <div key={`${l.em}|${l.item_idx}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="text-xs text-muted-foreground tabular-nums w-28 shrink-0">{fmtDataHora(l.em)}</span>
                    <span className={`flex items-center gap-1.5 flex-1 min-w-0 ${l.estornado ? "line-through opacity-60" : ""}`}>
                      <span className="font-semibold tabular-nums">{l.qtd}</span>
                      <span>{l.modelo}</span>
                      <CorChip cor={l.cor} />
                      <span>{l.tamanho}</span>
                      <span className="text-muted-foreground truncate">· {l.motivo || "sem motivo"}</span>
                    </span>
                    {l.corrigido && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 whitespace-nowrap">
                              corrigido <Info className="h-3 w-3" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {l.original
                              ? `Original: ${l.original.qtd} ${l.original.modelo} ${l.original.cor} ${l.original.tamanho} · ${l.original.motivo || "sem motivo"}`
                              : "Original não disponível"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {l.estornado && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 whitespace-nowrap">estornado</span>
                    )}
                    {canManage && !l.estornado && (
                      <span className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => onCorrigir?.(l)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />Corrigir
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => setEstornoAlvo(l)}>
                          <Undo2 className="h-3.5 w-3.5 mr-1" />Estornar
                        </Button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={confirmar}
              disabled={disabled || totalLancamento === 0}
              className="bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              Lançar perdas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!estornoAlvo} onOpenChange={(o) => !o && setEstornoAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar este lançamento de perda?</AlertDialogTitle>
            <AlertDialogDescription>
              As peças voltam a contar como pendentes no romaneio e a perda some do Controle de Perdas.
              O registro do estorno fica no histórico. Deseja continuar?
              {estornoAlvo && (itensPorEvento.get(estornoAlvo.em) ?? 1) > 1 && (
                <span className="block mt-2 font-medium text-foreground">
                  Este lançamento tem {itensPorEvento.get(estornoAlvo.em)} itens e todos serão estornados juntos.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (estornoAlvo) onEstornar?.(estornoAlvo);
                setEstornoAlvo(null);
              }}
            >
              Estornar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
