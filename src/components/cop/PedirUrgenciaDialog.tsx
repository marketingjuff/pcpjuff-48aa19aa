import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Flame } from "lucide-react";
import type { CopPeca, CopPecaRecebida, CopPerdaLinha, CopUrgenciaLinha } from "@/lib/cop";
import { getRecebida, getPerda } from "@/lib/cop";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rotulo: string;
  pecas: CopPeca[];
  recebidas: CopPecaRecebida[];
  perdas: CopPerdaLinha[];
  onConfirm: (obs: string, linhas: CopUrgenciaLinha[]) => void;
  disabled?: boolean;
};

type Grupo = { modelo: string; cor: string; qtdTotal: number; recTotal: number; perdaTotal: number; completa: boolean };

function agruparPorModeloCor(pecas: CopPeca[], recebidas: CopPecaRecebida[], perdas: CopPerdaLinha[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const p of pecas) {
    const k = `${p.modelo}|${p.cor}`;
    let g = map.get(k);
    if (!g) { g = { modelo: p.modelo, cor: p.cor, qtdTotal: 0, recTotal: 0, perdaTotal: 0, completa: false }; map.set(k, g); }
    const q = Number(p.qtd) || 0;
    g.qtdTotal += q;
    g.recTotal += getRecebida(recebidas, p.modelo, p.cor, p.tamanho);
    g.perdaTotal += getPerda(perdas, p.modelo, p.cor, p.tamanho);
  }
  for (const g of map.values()) g.completa = g.recTotal + g.perdaTotal >= g.qtdTotal;
  return Array.from(map.values()).sort((a, b) => a.modelo.localeCompare(b.modelo) || a.cor.localeCompare(b.cor));
}

export function PedirUrgenciaDialog({ open, onOpenChange, rotulo, pecas, recebidas, perdas, onConfirm, disabled }: Props) {
  const grupos = useMemo(() => agruparPorModeloCor(pecas, recebidas, perdas), [pecas, recebidas, perdas]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (!open) return;
    setSel({});
    setObs("");
  }, [open]);

  const linhasSelecionadas: CopUrgenciaLinha[] = grupos
    .filter((g) => !g.completa && sel[`${g.modelo}|${g.cor}`])
    .map((g) => ({ modelo: g.modelo, cor: g.cor }));

  const podeConfirmar = obs.trim().length > 0 && linhasSelecionadas.length > 0 && !disabled;

  function toggle(k: string) {
    setSel((s) => ({ ...s, [k]: !s[k] }));
  }

  function confirmar() {
    if (!podeConfirmar) return;
    onConfirm(obs.trim().toUpperCase(), linhasSelecionadas);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-red-600" />
            Pedir Urgência — Romaneio {rotulo}
          </DialogTitle>
          <DialogDescription>
            Selecione as linhas (modelo + cor) que você cobrou como urgentes e registre a observação da cobrança
            (ex.: "falei com a Mirta, prometeu dia 15"). O registro é imutável e fica no histórico.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border overflow-x-auto max-h-[45vh]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs sticky top-0">
              <tr>
                <th className="p-2 w-10"></th>
                <th className="p-2 text-left">Modelo</th>
                <th className="p-2 text-left">Cor</th>
                <th className="p-2 text-right">Recebido/Total</th>
                <th className="p-2 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {grupos.length === 0 ? (
                <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Sem peças.</td></tr>
              ) : grupos.map((g) => {
                const k = `${g.modelo}|${g.cor}`;
                const hex = corHex(g.cor); const fg = corTextoSobre(hex);
                const checked = !!sel[k];
                return (
                  <tr key={k} className={`border-t ${g.completa ? "opacity-60" : ""}`}>
                    <td className="p-2 text-center">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(k)}
                        disabled={disabled || g.completa}
                        aria-label={`Marcar ${g.modelo} ${g.cor}`}
                      />
                    </td>
                    <td className="p-2">{g.modelo}</td>
                    <td className="p-2">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: hex, color: fg }}>{g.cor}</span>
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {g.recTotal + g.perdaTotal}/{g.qtdTotal}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {g.completa ? "completa" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Observação (obrigatória)</label>
          <Textarea
            rows={3}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="EX.: FALEI COM A MIRTA, PROMETEU DIA 15"
            className="uppercase"
            disabled={disabled}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={disabled}>Cancelar</Button>
          <Button
            onClick={confirmar}
            disabled={!podeConfirmar}
            style={{ backgroundColor: "#dc2626", color: "#ffffff", borderColor: "#dc2626" }}
          >
            <Flame className="h-4 w-4 mr-1" />
            Registrar urgência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
