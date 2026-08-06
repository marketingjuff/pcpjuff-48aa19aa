import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ETAPAS, type Etapa } from "@/lib/pcp-monitor";
import { useSalvarCapacidade } from "@/hooks/use-capacidade";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tetos: Record<Etapa, number>;
}

export function CapacidadeDialog({ open, onOpenChange, tetos }: Props) {
  const [valores, setValores] = useState<Record<Etapa, number>>(tetos);
  const salvar = useSalvarCapacidade();

  useEffect(() => { if (open) setValores(tetos); }, [open, tetos]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Capacidade diária por etapa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {ETAPAS.map((e) => (
            <div key={e.key} className="grid grid-cols-[1fr_120px] items-center gap-2">
              <Label htmlFor={`cap-${e.key}`}>{e.label}</Label>
              <Input
                id={`cap-${e.key}`}
                type="number"
                min={0}
                value={String(valores[e.key] ?? 0)}
                onChange={(ev) => setValores((v) => ({ ...v, [e.key]: Number(ev.target.value) || 0 }))}
              />
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">
            Teto de peças por dia (batidas por dia, no caso da Arte). O teto efetivo cai 1% por pedido extra no mesmo dia.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={salvar.isPending}
            onClick={() => salvar.mutate(valores, { onSuccess: () => onOpenChange(false) })}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
