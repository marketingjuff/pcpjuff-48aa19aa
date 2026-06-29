import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CopPecaRecebida } from "@/lib/cop";
import { useMemo, useState } from "react";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  letraAtual: string | null;
  letraNova: string;
  recebidas: CopPecaRecebida[];
  rotuloAtual: string;
  rotuloRestante: string;
  rotuloNovo: string;
  onConfirm: () => void | Promise<void>;
}

export function ParticionarRomaneioDialog({
  open, onOpenChange, letraAtual, letraNova, recebidas, rotuloAtual, rotuloRestante, rotuloNovo, onConfirm,
}: Props) {
  const [saving, setSaving] = useState(false);
  const total = useMemo(() => recebidas.reduce((s, r) => s + r.qtd_recebida, 0), [recebidas]);

  async function handle() {
    setSaving(true);
    try { await onConfirm(); onOpenChange(false); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Particionar Romaneio por Letra</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/30 p-3 space-y-1">
            <div>
              O romaneio <b>{rotuloAtual}</b> será particionado.
            </div>
            <div>
              As peças <b>já recebidas</b> formarão um novo romaneio <b>{rotuloNovo}</b> (status <b>Romaneio Completo</b>),
              pronto para seguir o fluxo de pagamento parcial.
            </div>
            <div>
              O restante permanecerá em <b>{rotuloRestante}</b> como <b>Romaneio Parcial</b>,
              podendo ser reparticionado novamente quando necessário.
            </div>
          </div>

          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="p-2 text-left">Modelo</th>
                  <th className="p-2 text-left">Cor</th>
                  <th className="p-2 text-center">Tamanho</th>
                  <th className="p-2 text-right">Qtd recebida</th>
                </tr>
              </thead>
              <tbody>
                {recebidas.length === 0 ? (
                  <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">Nenhuma peça recebida para particionar.</td></tr>
                ) : recebidas.map((r, i) => {
                  const hex = corHex(r.cor); const fg = corTextoSobre(hex);
                  return (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.modelo}</td>
                      <td className="p-2"><span className="inline-block px-2 py-0.5 rounded text-xs" style={{ backgroundColor: hex, color: fg }}>{r.cor}</span></td>
                      <td className="p-2 text-center">{r.tamanho}</td>
                      <td className="p-2 text-right tabular-nums">{r.qtd_recebida}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30"><td colSpan={3} className="p-2 text-right"><b>Total</b></td><td className="p-2 text-right tabular-nums"><b>{total}</b></td></tr>
              </tfoot>
            </table>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handle} disabled={saving || total === 0}>Confirmar partição</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
