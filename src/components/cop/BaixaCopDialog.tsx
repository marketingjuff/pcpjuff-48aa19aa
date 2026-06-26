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
  itens: ItemFalta[];
  cops: Cop[];
  onConfirm: (copId: string, baixas: { idx: number; tamanho: string; qtd: number }[]) => void | Promise<void>;
}

export function BaixaCopDialog({ open, onOpenChange, modelo, cor, itens, cops, onConfirm }: Props) {
  // COPs candidatos: em produção e que tenham ao menos uma peça desse modelo+cor de algum tamanho pedido
  const tamanhosNeeded = useMemo(() => itens.map((i) => i.tamanho), [itens]);

  const candidatos = useMemo(() => {
    return cops
      .filter(isCopEmProducao)
      .map((c) => {
        const porTam = new Map<string, number>();
        for (const p of c.pecas ?? []) {
          if (p.modelo !== modelo || p.cor !== cor) continue;
          if (!tamanhosNeeded.includes(p.tamanho)) continue;
          porTam.set(p.tamanho, (porTam.get(p.tamanho) ?? 0) + (Number(p.qtd) || 0));
        }
        const totalItem = Array.from(porTam.values()).reduce((s, n) => s + n, 0);
        return { cop: c, porTam, totalItem };
      })
      .filter((x) => x.totalItem > 0)
      .sort((a, b) => b.cop.numero - a.cop.numero);
  }, [cops, modelo, cor, tamanhosNeeded]);

  const [copId, setCopId] = useState<string>("");
  const [qtds, setQtds] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const copSel = useMemo(() => candidatos.find((c) => c.cop.id === copId) ?? null, [candidatos, copId]);

  // Função: cap para um tamanho considerando COP selecionado
  function capFor(tamanho: string, falta: number) {
    const noCop = copSel?.porTam.get(tamanho) ?? 0;
    return Math.min(falta, noCop);
  }

  useEffect(() => {
    if (!open) return;
    const c = candidatos[0]?.cop.id ?? "";
    setCopId(c);
  }, [open, candidatos]);

  // Quando COP muda, pré-preencher com o máximo possível
  useEffect(() => {
    if (!open) return;
    const next: Record<string, number> = {};
    for (const it of itens) {
      next[it.tamanho] = capFor(it.tamanho, it.falta);
    }
    setQtds(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copId, open]);

  const totalAbater = useMemo(() => Object.values(qtds).reduce((s, n) => s + (Number(n) || 0), 0), [qtds]);
  const hex = corHex(cor); const fg = corTextoSobre(hex);

  async function handle() {
    if (!copId) return;
    const baixas = itens
      .map((it) => ({ idx: it.idx, tamanho: it.tamanho, qtd: Math.max(0, Math.floor(qtds[it.tamanho] || 0)) }))
      .filter((b) => b.qtd > 0);
    if (baixas.length === 0) return;
    setSaving(true);
    try { await onConfirm(copId, baixas); onOpenChange(false); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle>
            Dar baixa — {modelo} ·{" "}
            <span className="inline-block px-2 py-0.5 rounded text-xs align-middle" style={{ backgroundColor: hex, color: fg }}>{cor}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-xs text-muted-foreground">
            Selecione o COP de origem e ajuste a quantidade a abater por tamanho. O sistema soma em <b>qtd_enviada</b> e grava no histórico.
          </div>
          <div>
            <Label>COP de origem</Label>
            <Select value={copId} onValueChange={setCopId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {candidatos.length === 0 && <SelectItem value="__none__" disabled>Nenhum COP em produção tem esse modelo/cor</SelectItem>}
                {candidatos.map((x) => (
                  <SelectItem key={x.cop.id} value={x.cop.id}>
                    {rotuloCop(x.cop.numero, x.cop.letra)} · {x.cop.status} · {x.totalItem} peças desse modelo/cor · total {totalPecasCop(x.cop.pecas)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="p-2 text-left">Tamanho</th>
                  <th className="p-2 text-right">Falta</th>
                  <th className="p-2 text-right">No COP</th>
                  <th className="p-2 text-right">Abater</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it) => {
                  const noCop = copSel?.porTam.get(it.tamanho) ?? 0;
                  const cap = Math.min(it.falta, noCop);
                  const val = qtds[it.tamanho] ?? 0;
                  return (
                    <tr key={it.tamanho} className="border-t">
                      <td className="p-2 font-medium">{it.tamanho}</td>
                      <td className="p-2 text-right tabular-nums text-amber-700">{it.falta}</td>
                      <td className="p-2 text-right tabular-nums">{noCop}</td>
                      <td className="p-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          max={cap}
                          value={val}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(cap, Math.floor(Number(e.target.value) || 0)));
                            setQtds((s) => ({ ...s, [it.tamanho]: v }));
                          }}
                          disabled={!copId || cap === 0}
                          className="h-8 w-20 text-right ml-auto"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30">
                  <td className="p-2 text-right" colSpan={3}><b>Total a abater</b></td>
                  <td className="p-2 text-right tabular-nums"><b>{totalAbater}</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handle} disabled={saving || !copId || totalAbater <= 0}>Confirmar baixa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
