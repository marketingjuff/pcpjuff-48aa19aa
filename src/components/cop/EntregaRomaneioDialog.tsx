import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Pencil } from "lucide-react";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import type { CopPeca, CopPecaRecebida } from "@/lib/cop";
import { getRecebida, setRecebida, colunasTamanhos } from "@/lib/cop";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pecas: CopPeca[];
  recebidas: CopPecaRecebida[];
  onConfirm: (next: CopPecaRecebida[]) => void | Promise<void>;
}

type LinhaAgrupada = { modelo: string; cor: string; tamanhos: { tamanho: string; qtd: number }[] };

function agruparPecas(pecas: CopPeca[]): LinhaAgrupada[] {
  const map = new Map<string, LinhaAgrupada>();
  for (const p of pecas) {
    const k = `${p.modelo}|${p.cor}`;
    let g = map.get(k);
    if (!g) { g = { modelo: p.modelo, cor: p.cor, tamanhos: [] }; map.set(k, g); }
    g.tamanhos.push({ tamanho: p.tamanho, qtd: p.qtd });
  }
  return Array.from(map.values());
}

export function EntregaRomaneioDialog({ open, onOpenChange, pecas, recebidas, onConfirm }: Props) {
  const [rec, setRec] = useState<CopPecaRecebida[]>([]);
  const [parcialEdit, setParcialEdit] = useState<string | null>(null); // key
  const [parcialVal, setParcialVal] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setRec(recebidas ?? []); }, [open, recebidas]);

  const grupos = useMemo(() => agruparPecas(pecas), [pecas]);

  const total = useMemo(() => pecas.reduce((s, p) => s + p.qtd, 0), [pecas]);
  const recebidoTotal = useMemo(() => rec.reduce((s, r) => s + r.qtd_recebida, 0), [rec]);

  function key(m: string, c: string, t: string) { return `${m}|${c}|${t}`; }

  function marcarCompleto(m: string, c: string, t: string, qtd: number) {
    setRec((r) => setRecebida(r, m, c, t, qtd));
    setParcialEdit(null);
  }
  function abrirParcial(m: string, c: string, t: string) {
    const k = key(m, c, t);
    setParcialEdit(k);
    setParcialVal(String(getRecebida(rec, m, c, t) || ""));
  }
  function salvarParcial(m: string, c: string, t: string, max: number) {
    const v = Math.max(0, Math.min(max, Math.floor(Number(parcialVal) || 0)));
    setRec((r) => setRecebida(r, m, c, t, v));
    setParcialEdit(null);
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      await onConfirm(rec);
      onOpenChange(false);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px]">
        <DialogHeader>
          <DialogTitle>Entrega de Romaneio — registrar recebimento</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground mb-1">
          Clique no <b>número</b> para marcar como recebido <b>completo</b> (bolinha verde).
          Clique no <b>lápis</b> para informar uma quantidade <b>parcial</b> (bolinha cinza).
        </div>
        <div className="rounded-md border overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs sticky top-0">
              <tr>
                <th className="p-2 text-left min-w-[160px]">Modelo</th>
                <th className="p-2 text-left min-w-[140px]">Cor</th>
                <th className="p-2 text-left">Tamanhos · Quantidades</th>
                <th className="p-2 text-right w-[160px]">Entregue / Pendente</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => {
                const hex = corHex(g.cor);
                const fg = corTextoSobre(hex);
                const entregueLinha = g.tamanhos.reduce((s, t) => s + getRecebida(rec, g.modelo, g.cor, t.tamanho), 0);
                const totalLinha = g.tamanhos.reduce((s, t) => s + t.qtd, 0);
                const pend = totalLinha - entregueLinha;
                return (
                  <tr key={`${g.modelo}|${g.cor}`} className="border-t align-top">
                    <td className="p-2 font-medium">{g.modelo}</td>
                    <td className="p-2">
                      <span className="inline-block px-2 py-0.5 rounded text-xs" style={{ backgroundColor: hex, color: fg }}>{g.cor}</span>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-2">
                        {g.tamanhos.map((tt) => {
                          const k = key(g.modelo, g.cor, tt.tamanho);
                          const r = getRecebida(rec, g.modelo, g.cor, tt.tamanho);
                          const completo = r >= tt.qtd && tt.qtd > 0;
                          const parcial = r > 0 && r < tt.qtd;
                          const bolaCor = completo ? "#16a34a" : parcial ? "#9ca3af" : "transparent";
                          const numCor = (completo || parcial) ? "#ffffff" : "#111827";
                          const numBg = (completo || parcial) ? bolaCor : "#f3f4f6";
                          return (
                            <div key={k} className="flex flex-col items-center gap-1 min-w-[64px]">
                              <div className="text-[10px] uppercase text-muted-foreground">{tt.tamanho}</div>
                              <button
                                type="button"
                                onClick={() => marcarCompleto(g.modelo, g.cor, tt.tamanho, tt.qtd)}
                                title="Marcar completo"
                                className="rounded-full w-12 h-12 flex items-center justify-center font-bold tabular-nums text-base border"
                                style={{ backgroundColor: numBg, color: numCor, borderColor: completo ? "#15803d" : parcial ? "#6b7280" : "#d1d5db" }}
                              >
                                {tt.qtd}
                              </button>
                              {parcialEdit === k ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    autoFocus
                                    min={0}
                                    max={tt.qtd}
                                    value={parcialVal}
                                    onChange={(e) => setParcialVal(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") salvarParcial(g.modelo, g.cor, tt.tamanho, tt.qtd); }}
                                    className="h-7 w-14 text-center text-xs"
                                  />
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => salvarParcial(g.modelo, g.cor, tt.tamanho, tt.qtd)}>
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => abrirParcial(g.modelo, g.cor, tt.tamanho)}
                                  title="Recebimento parcial"
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <div className="text-[10px] tabular-nums text-muted-foreground">{r}/{tt.qtd}</div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-2 text-right text-xs tabular-nums">
                      <div className="text-green-700 font-semibold">{entregueLinha} entregues</div>
                      <div className={pend > 0 ? "text-amber-700" : "text-muted-foreground"}>{pend} pendentes</div>
                    </td>
                  </tr>
                );
              })}
              {grupos.length === 0 && (
                <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">Sem peças.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Total do COP: <b className="tabular-nums">{total}</b></span>
          <span>
            Recebido: <b className="tabular-nums text-green-700">{recebidoTotal}</b> ·
            Pendente: <b className={`tabular-nums ${total - recebidoTotal > 0 ? "text-amber-700" : "text-muted-foreground"}`}> {total - recebidoTotal}</b>
          </span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving}>Salvar recebimento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
