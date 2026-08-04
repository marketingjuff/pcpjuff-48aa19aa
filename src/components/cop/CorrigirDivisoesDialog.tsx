import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Cop, CopPeca } from "@/lib/cop";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";

export type DivisaoCorrompida = {
  pai: Cop;
  filhos: Cop[];
  rotuloPai: string;
  rotulosFilhos: string[];
  atuais: CopPeca[];
  nosFilhos: CopPeca[];
  resultado: CopPeca[];
  totalAtual: number;
  totalFilhos: number;
  totalResultado: number;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  itens: DivisaoCorrompida[];
  onConfirm: () => void | Promise<void>;
}

function qtdDe(pecas: CopPeca[], m: string, c: string, t: string): number {
  const f = pecas.find((p) => p.modelo === m && p.cor === c && p.tamanho === t);
  return f ? Number(f.qtd) || 0 : 0;
}

export function CorrigirDivisoesDialog({ open, onOpenChange, itens, onConfirm }: Props) {
  const [saving, setSaving] = useState(false);

  const totalRemovido = useMemo(
    () => itens.reduce((s, i) => s + i.totalFilhos, 0),
    [itens],
  );

  async function handleConfirm() {
    setSaving(true);
    try {
      await onConfirm();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[980px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Corrigir divisões duplicadas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            Estes COPs foram divididos mas ainda contêm as peças que foram movidas para os COPs
            filhos — provavelmente porque a tela foi salva logo após a divisão. Confira antes de
            aplicar.
          </div>

          {itens.map((it) => {
            const linhas = it.atuais
              .slice()
              .sort((a, b) =>
                `${a.modelo}${a.cor}${a.tamanho}`.localeCompare(`${b.modelo}${b.cor}${b.tamanho}`, "pt-BR"),
              );
            return (
              <div key={it.pai.id} className="rounded-md border overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-3 py-2">
                  <div className="text-sm font-semibold tabular-nums">
                    {it.rotuloPai} → {it.rotulosFilhos.join(", ")}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    Hoje: <b>{it.totalAtual}</b> peças · Nos filhos: <b>{it.totalFilhos}</b> · Fica:{" "}
                    <b>{it.totalResultado}</b>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/20">
                    <tr className="text-xs">
                      <th className="p-2 text-left">Modelo</th>
                      <th className="p-2 text-left">Cor</th>
                      <th className="p-2 text-center">Tamanho</th>
                      <th className="p-2 text-center">Hoje no COP</th>
                      <th className="p-2 text-center">Está no(s) filho(s)</th>
                      <th className="p-2 text-center">Fica</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((p, i) => {
                      const hex = corHex(p.cor);
                      const fg = corTextoSobre(hex);
                      const nf = qtdDe(it.nosFilhos, p.modelo, p.cor, p.tamanho);
                      const fica = qtdDe(it.resultado, p.modelo, p.cor, p.tamanho);
                      return (
                        <tr key={i} className="border-t">
                          <td className="p-2">{p.modelo}</td>
                          <td className="p-2">
                            <span
                              className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                              style={{ backgroundColor: hex, color: fg }}
                            >
                              {p.cor}
                            </span>
                          </td>
                          <td className="p-2 text-center font-medium">{p.tamanho}</td>
                          <td className="p-2 text-center tabular-nums">{p.qtd}</td>
                          <td className="p-2 text-center tabular-nums">{nf || "—"}</td>
                          <td className="p-2 text-center tabular-nums font-semibold">{fica}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div className="text-xs text-muted-foreground text-right">
            {itens.length} COP(s) serão corrigidos ·{" "}
            <span className="font-semibold tabular-nums">{totalRemovido}</span> peças serão removidas
            no total.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || itens.length === 0}>
            Corrigir todos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
