import { useMemo, useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Cop } from "@/lib/cop";
import { rotuloCop, totalPecasCop } from "@/lib/cop";
import { isCopEmProducao } from "@/lib/cop-saldos";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modelo: string;
  cor: string;
  tamanho: string;
  faltaMax: number;
  cops: Cop[];
  onConfirm: (copId: string, qtd: number) => void | Promise<void>;
}

export function BaixaCopDialog({ open, onOpenChange, modelo, cor, tamanho, faltaMax, cops, onConfirm }: Props) {
  const candidatos = useMemo(() => {
    return cops
      .filter(isCopEmProducao)
      .map((c) => {
        const qtdItem = (c.pecas ?? [])
          .filter((p) => p.modelo === modelo && p.cor === cor && p.tamanho === tamanho)
          .reduce((s, p) => s + (Number(p.qtd) || 0), 0);
        return { cop: c, qtdItem };
      })
      .filter((x) => x.qtdItem > 0)
      .sort((a, b) => b.cop.numero - a.cop.numero);
  }, [cops, modelo, cor, tamanho]);

  const [copId, setCopId] = useState<string>("");
  const [qtd, setQtd] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCopId(candidatos[0]?.cop.id ?? "");
    setQtd(Math.max(1, Math.min(faltaMax, candidatos[0]?.qtdItem ?? 1)));
  }, [open, candidatos, faltaMax]);

  async function handle() {
    if (!copId || qtd <= 0) return;
    setSaving(true);
    try { await onConfirm(copId, qtd); onOpenChange(false); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Dar baixa — {modelo} · {cor} · {tamanho}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-xs text-muted-foreground">
            Selecione o COP que vai fornecer a peça e a quantidade a abater. O sistema soma em <b>qtd_enviada</b> no pedido e grava no histórico.
          </div>
          <div>
            <Label>COP de origem</Label>
            <Select value={copId} onValueChange={setCopId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {candidatos.length === 0 && <SelectItem value="__none__" disabled>Nenhum COP em produção tem esse item</SelectItem>}
                {candidatos.map((x) => (
                  <SelectItem key={x.cop.id} value={x.cop.id}>
                    {rotuloCop(x.cop.numero, x.cop.letra)} · {x.cop.status} · {x.qtdItem} peças desse item · total {totalPecasCop(x.cop.pecas)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantidade a abater (falta: {faltaMax})</Label>
            <Input
              type="number"
              min={1}
              max={faltaMax}
              value={qtd}
              onChange={(e) => setQtd(Math.max(1, Math.min(faltaMax, Math.floor(Number(e.target.value) || 0))))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handle} disabled={saving || !copId || qtd <= 0}>Confirmar baixa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
