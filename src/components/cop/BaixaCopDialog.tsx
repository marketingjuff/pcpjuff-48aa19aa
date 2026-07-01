import { useMemo, useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";

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

  useEffect(() => {
    if (!open) return;
    const next: Record<string, number> = {};
    for (const it of itens) next[it.tamanho] = 0;
    setQtds(next);
    setObservacao("");
  }, [open, itens]);

  const totalAbater = useMemo(() => Object.values(qtds).reduce((s, n) => s + (Number(n) || 0), 0), [qtds]);
  const hex = corHex(cor); const fg = corTextoSobre(hex);

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
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle>
            {orcamento != null && <>Orçamento <span className="font-mono">{orcamento}</span> — </>}
            {modelo} ·{" "}
            <span className="inline-block px-2 py-0.5 rounded text-xs align-middle" style={{ backgroundColor: hex, color: fg }}>{cor}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-xs text-muted-foreground">
            Ajuste a quantidade a abater por tamanho. O sistema soma em <b>qtd_enviada</b> e grava no histórico.
            Use o campo de observação para anotar a origem (ex: "COP 0001 e 0002" ou "misturado").
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="p-2 text-left">Tamanho</th>
                  <th className="p-2 text-right">Falta</th>
                  <th className="p-2 text-right">Abater</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it) => {
                  const val = qtds[it.tamanho] ?? 0;
                  return (
                    <tr key={it.tamanho} className="border-t">
                      <td className="p-2 font-medium">{it.tamanho}</td>
                      <td className="p-2 text-right tabular-nums text-amber-700">{it.falta}</td>
                      <td className="p-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          max={it.falta}
                          value={val}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(it.falta, Math.floor(Number(e.target.value) || 0)));
                            setQtds((s) => ({ ...s, [it.tamanho]: v }));
                          }}
                          className="h-8 w-20 text-right ml-auto"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30">
                  <td className="p-2 text-right" colSpan={2}><b>Total a abater</b></td>
                  <td className="p-2 text-right tabular-nums"><b>{totalAbater}</b></td>
                </tr>
              </tfoot>
            </table>
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
