import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CopPeca, CopPerdaLinha } from "@/lib/cop";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pecas: CopPeca[];
  perdas: CopPerdaLinha[];
  onConfirm: (perdas: CopPerdaLinha[]) => void;
  disabled?: boolean;
};

export function RegistrarPerdaDialog({ open, onOpenChange, pecas, perdas, onConfirm, disabled }: Props) {
  const key = (m: string, c: string, t: string) => `${m}|${c}|${t}`;
  const [vals, setVals] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    const init: Record<string, number> = {};
    for (const p of perdas ?? []) init[key(p.modelo, p.cor, p.tamanho)] = Number(p.qtd) || 0;
    setVals(init);
  }, [open]); // eslint-disable-line

  const total = useMemo(() => Object.values(vals).reduce((a, b) => a + (Number(b) || 0), 0), [vals]);

  function setQ(p: CopPeca, q: number) {
    const max = Number(p.qtd) || 0;
    const v = Math.max(0, Math.min(max, Math.floor(Number(q) || 0)));
    setVals((s) => ({ ...s, [key(p.modelo, p.cor, p.tamanho)]: v }));
  }

  function confirmar() {
    const out: CopPerdaLinha[] = [];
    for (const p of pecas) {
      const q = vals[key(p.modelo, p.cor, p.tamanho)] || 0;
      if (q > 0) out.push({ modelo: p.modelo, cor: p.cor, tamanho: p.tamanho, qtd: q });
    }
    onConfirm(out);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar perdas do romaneio</DialogTitle>
          <DialogDescription>
            Digite a quantidade perdida por linha. A peça perdida não é paga e sai do saldo Disponível.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border overflow-x-auto max-h-[55vh]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs sticky top-0">
              <tr>
                <th className="p-2 text-left">Modelo</th>
                <th className="p-2 text-left">Cor</th>
                <th className="p-2 text-center">Tam.</th>
                <th className="p-2 text-right">Qtd</th>
                <th className="p-2 text-right">Perda</th>
              </tr>
            </thead>
            <tbody>
              {pecas.length === 0 ? (
                <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Sem peças.</td></tr>
              ) : pecas.map((p, i) => {
                const hex = corHex(p.cor); const fg = corTextoSobre(hex);
                const v = vals[key(p.modelo, p.cor, p.tamanho)] ?? 0;
                return (
                  <tr key={i} className="border-t">
                    <td className="p-2">{p.modelo}</td>
                    <td className="p-2"><span className="inline-block px-2 py-0.5 rounded text-xs" style={{ backgroundColor: hex, color: fg }}>{p.cor}</span></td>
                    <td className="p-2 text-center">{p.tamanho}</td>
                    <td className="p-2 text-right tabular-nums">{p.qtd}</td>
                    <td className="p-2 text-right">
                      <Input
                        type="number" min={0} max={p.qtd}
                        className="h-7 w-20 ml-auto text-right tabular-nums"
                        value={v || ""}
                        onChange={(e) => setQ(p, Number(e.target.value))}
                        disabled={disabled}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/30">
              <tr>
                <td colSpan={4} className="p-2 text-right"><b>Total de perdas</b></td>
                <td className="p-2 text-right tabular-nums"><b>{total}</b></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={disabled} className="bg-yellow-500 hover:bg-yellow-600 text-black">
            Salvar perdas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
