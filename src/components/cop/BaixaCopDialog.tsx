import { useMemo, useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, Pencil } from "lucide-react";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { colunasTamanhos } from "@/lib/cop";

export interface ItemFalta {
  idx: number;
  tamanho: string;
  falta: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modelo: string;
  cor: string;
  orcamento?: string | number | null;
  itens: ItemFalta[];
  onConfirm: (observacao: string, baixas: { idx: number; tamanho: string; qtd: number }[]) => void | Promise<void>;
}

export function BaixaCopDialog({ open, onOpenChange, modelo, cor, orcamento, itens, onConfirm }: Props) {
  const [qtds, setQtds] = useState<Record<string, number>>({});
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [parcialEdit, setParcialEdit] = useState<string | null>(null);
  const [parcialVal, setParcialVal] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    const next: Record<string, number> = {};
    for (const it of itens) next[it.tamanho] = 0;
    setQtds(next);
    setObservacao("");
    setParcialEdit(null);
    setParcialVal("");
  }, [open, itens]);

  const cols = useMemo(() => colunasTamanhos(itens.map((i) => i.tamanho)), [itens]);
  const itensOrdenados = useMemo(
    () => [...itens].sort((a, b) => cols.indexOf(a.tamanho) - cols.indexOf(b.tamanho)),
    [itens, cols],
  );

  const totalFalta = useMemo(() => itens.reduce((s, i) => s + i.falta, 0), [itens]);
  const totalAbater = useMemo(() => Object.values(qtds).reduce((s, n) => s + (Number(n) || 0), 0), [qtds]);
  const hex = corHex(cor); const fg = corTextoSobre(hex);

  function marcarCompleto(tam: string, falta: number) {
    setQtds((s) => ({ ...s, [tam]: falta }));
    setParcialEdit(null);
  }
  function abrirParcial(tam: string) {
    setParcialEdit(tam);
    setParcialVal(String(qtds[tam] || ""));
  }
  function salvarParcial(tam: string, max: number) {
    const v = Math.max(0, Math.min(max, Math.floor(Number(parcialVal) || 0)));
    setQtds((s) => ({ ...s, [tam]: v }));
    setParcialEdit(null);
  }

  async function handle() {
    const baixas = itens
      .map((it) => ({ idx: it.idx, tamanho: it.tamanho, qtd: Math.max(0, Math.floor(qtds[it.tamanho] || 0)) }))
      .filter((b) => b.qtd > 0);
    if (baixas.length === 0) return;
    setSaving(true);
    try { await onConfirm(observacao.trim(), baixas); onOpenChange(false); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[960px]">
        <DialogHeader>
          <DialogTitle>
            {orcamento != null && <>Orçamento <span className="font-mono">{orcamento}</span> — </>}
            {modelo} ·{" "}
            <span className="inline-block px-2 py-0.5 rounded text-xs align-middle font-bold" style={{ backgroundColor: hex, color: fg }}>{cor}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-xs text-muted-foreground">
            Clique no <b>número</b> para dar baixa <b>completa</b> da falta (bolinha verde).
            Clique no <b>lápis</b> para informar uma quantidade <b>parcial</b> (bolinha cinza).
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-[10px]">
                <tr>
                  {itensOrdenados.map((it) => (
                    <th key={it.tamanho} className="px-1 py-1 text-center w-[76px]">{it.tamanho}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="align-middle leading-tight">
                  {itensOrdenados.map((it) => {
                    const val = qtds[it.tamanho] ?? 0;
                    const completo = val >= it.falta && it.falta > 0;
                    const parcial = val > 0 && val < it.falta;
                    const restante = it.falta - val;
                    const bolaCor = completo ? "#16a34a" : parcial ? "#9ca3af" : "transparent";
                    const numCor = (completo || parcial) ? "#ffffff" : "#111827";
                    const numBg = (completo || parcial) ? bolaCor : "#f3f4f6";
                    return (
                      <td key={it.tamanho} className="px-1 py-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => marcarCompleto(it.tamanho, it.falta)}
                            title="Baixar tudo"
                            className="rounded-full w-10 h-10 flex items-center justify-center font-semibold tabular-nums text-[13px] border"
                            style={{ backgroundColor: numBg, color: numCor, borderColor: completo ? "#15803d" : parcial ? "#6b7280" : "#d1d5db" }}
                          >
                            {restante}
                          </button>
                          {(completo || parcial) && (
                            <div className="text-[10px] tabular-nums text-muted-foreground">baixa {val}</div>
                          )}
                          {parcialEdit === it.tamanho ? (
                            <div className="flex items-center gap-0.5">
                              <Input
                                type="number"
                                autoFocus
                                min={0}
                                max={it.falta}
                                value={parcialVal}
                                onChange={(e) => setParcialVal(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") salvarParcial(it.tamanho, it.falta); }}
                                className="h-6 w-16 text-center text-[11px] px-1"
                              />
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => salvarParcial(it.tamanho, it.falta)}>
                                <Check className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => abrirParcial(it.tamanho)}
                              title="Baixa parcial"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                          <div className="text-[9px] tabular-nums text-muted-foreground">{val}/{it.falta}</div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Falta total: <b className="tabular-nums text-amber-700">{totalFalta}</b></span>
            <span>Total a abater: <b className="tabular-nums">{totalAbater}</b></span>
          </div>

          <div>
            <Label>Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: COP 0001 e 0002, misturado"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handle} disabled={saving || totalAbater <= 0}>Confirmar baixa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
