import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CopPeca } from "@/lib/cop";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pecas: CopPeca[];
  onConfirm: (movidas: CopPeca[]) => void | Promise<void>;
}

export function DivisaoCorteDialog({ open, onOpenChange, pecas, onConfirm }: Props) {
  const [mover, setMover] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);

  const totalMov = useMemo(
    () => Object.values(mover).reduce((s, v) => s + (Number(v) || 0), 0),
    [mover],
  );

  function setQ(i: number, v: number, max: number) {
    setMover((m) => ({ ...m, [i]: Math.max(0, Math.min(max, Math.floor(Number(v) || 0))) }));
  }

  async function handleConfirm() {
    const movidas: CopPeca[] = [];
    pecas.forEach((p, i) => {
      const q = Number(mover[i]) || 0;
      if (q > 0) movidas.push({ modelo: p.modelo, cor: p.cor, tamanho: p.tamanho, qtd: q });
    });
    if (movidas.length === 0) return;
    setSaving(true);
    try {
      await onConfirm(movidas);
      setMover({});
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px]">
        <DialogHeader>
          <DialogTitle>Divisão de Corte</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Defina quantas peças de cada linha vão para um novo COP. O restante permanece no COP atual.
          </div>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-xs">
                  <th className="p-2 text-left">Modelo</th>
                  <th className="p-2 text-left">Cor</th>
                  <th className="p-2 text-center">Tamanho</th>
                  <th className="p-2 text-center">Disp.</th>
                  <th className="p-2 text-center">Mover</th>
                </tr>
              </thead>
              <tbody>
                {pecas.length === 0 ? (
                  <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Sem peças.</td></tr>
                ) : pecas.map((p, i) => {
                  const hex = corHex(p.cor);
                  const fg = corTextoSobre(hex);
                  return (
                    <tr key={i} className="border-t">
                      <td className="p-2">{p.modelo}</td>
                      <td className="p-2">
                        <span className="inline-block px-2 py-0.5 rounded text-xs" style={{ backgroundColor: hex, color: fg }}>
                          {p.cor}
                        </span>
                      </td>
                      <td className="p-2 text-center font-medium">{p.tamanho}</td>
                      <td className="p-2 text-center tabular-nums">{p.qtd}</td>
                      <td className="p-2 text-center">
                        <Input
                          type="number"
                          min={0}
                          max={p.qtd}
                          className="h-8 w-20 mx-auto text-center"
                          value={mover[i] ?? ""}
                          onChange={(e) => setQ(i, Number(e.target.value), p.qtd)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-muted-foreground text-right">
            Total a mover: <span className="font-semibold tabular-nums">{totalMov}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving || totalMov === 0}>
            Criar COP filho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
