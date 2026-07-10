import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Pencil } from "lucide-react";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import type { Cop, CopPerdaLinha, CopRefacaoPerdaItem } from "@/lib/cop";
import { colunasTamanhos, formatCopNumero } from "@/lib/cop";

export type RefazerCopInput = {
  cop: Cop;
  perdasRestantes: CopPerdaLinha[]; // já deduzidas de refações anteriores
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cops: RefazerCopInput[];
  onConfirm: (
    selecoes: Array<{ cop: Cop; itens: CopRefacaoPerdaItem[] }>,
  ) => void | Promise<void>;
}


type LinhaAgrupada = {
  modelo: string;
  cor: string;
  tamanhos: { tamanho: string; qtdMax: number; motivo?: string | null }[];
};

function agrupar(perdas: CopPerdaLinha[]): LinhaAgrupada[] {
  const map = new Map<string, LinhaAgrupada>();
  for (const p of perdas) {
    if (!(p.qtd > 0)) continue;
    const k = `${p.modelo}|${p.cor}`;
    let g = map.get(k);
    if (!g) { g = { modelo: p.modelo, cor: p.cor, tamanhos: [] }; map.set(k, g); }
    g.tamanhos.push({ tamanho: p.tamanho, qtdMax: p.qtd, motivo: p.motivo ?? null });
  }
  return Array.from(map.values());
}

export function RefazerPerdaDialog({ open, onOpenChange, cops, onConfirm }: Props) {
  const [sel, setSel] = useState<Selecionadas>(new Map());
  const [parcialEdit, setParcialEdit] = useState<string | null>(null);
  const [parcialVal, setParcialVal] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setSel(new Map()); setParcialEdit(null); } }, [open]);

  const totais = useMemo(() => {
    let max = 0, selTotal = 0;
    for (const c of cops) for (const p of c.perdasRestantes) max += p.qtd;
    for (const v of sel.values()) selTotal += v;
    return { max, selTotal };
  }, [cops, sel]);

  function key(copId: string, m: string, c: string, t: string) {
    return `${copId}|${m}|${c}|${t}`;
  }

  function get(copId: string, m: string, c: string, t: string) {
    return sel.get(key(copId, m, c, t)) ?? 0;
  }

  function set(copId: string, m: string, c: string, t: string, q: number) {
    setSel((prev) => {
      const next = new Map(prev);
      const k = key(copId, m, c, t);
      if (q > 0) next.set(k, q); else next.delete(k);
      return next;
    });
  }

  async function handleConfirm() {
    const selecoes: Array<{ cop: Cop; itens: CopPerdaLinha[] }> = [];
    for (const c of cops) {
      const itens: CopPerdaLinha[] = [];
      for (const p of c.perdasRestantes) {
        const q = get(c.cop.id, p.modelo, p.cor, p.tamanho);
        if (q > 0) itens.push({ modelo: p.modelo, cor: p.cor, tamanho: p.tamanho, qtd: q, motivo: p.motivo ?? null });
      }
      if (itens.length) selecoes.push({ cop: c.cop, itens });
    }
    if (!selecoes.length) return;
    setSaving(true);
    try {
      await onConfirm(selecoes);
      onOpenChange(false);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px]">
        <DialogHeader>
          <DialogTitle>Refazer perdas — selecionar peças a recuperar</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground mb-1">
          Clique no <b>número</b> para selecionar todas as peças daquela célula.
          Use o <b>lápis</b> para uma quantidade <b>parcial</b>. As peças selecionadas
          criarão um novo COP em <b>Aguardando Risco</b> com o corte pré-preenchido.
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {cops.map((c) => {
            const grupos = agrupar(c.perdasRestantes);
            if (!grupos.length) return null;
            const cols = colunasTamanhos(c.perdasRestantes.map((p) => p.tamanho));
            const rotulo = `${formatCopNumero(c.cop.numero)}${c.cop.letra ?? ""}`;
            return (
              <div key={c.cop.id} className="rounded-md border">
                <div className="px-3 py-1.5 bg-muted/40 text-xs font-semibold border-b">
                  COP {rotulo}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/20 text-[10px]">
                      <tr>
                        <th className="px-2 py-1 text-left min-w-[140px]">Modelo</th>
                        <th className="px-2 py-1 text-left min-w-[110px]">Cor</th>
                        {cols.map((tc) => (
                          <th key={tc} className="px-1 py-1 text-center w-[68px]">{tc}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {grupos.map((g) => {
                        const hex = corHex(g.cor);
                        const fg = corTextoSobre(hex);
                        const byTam = new Map(g.tamanhos.map((t) => [t.tamanho, t.qtdMax]));
                        return (
                          <tr key={`${g.modelo}|${g.cor}`} className="border-t align-middle">
                            <td className="px-2 py-1 font-medium">{g.modelo}</td>
                            <td className="px-2 py-1">
                              <span className="inline-block px-1.5 py-0 rounded text-[10px] font-bold" style={{ backgroundColor: hex, color: fg }}>{g.cor}</span>
                            </td>
                            {cols.map((tam) => {
                              const qtdMax = byTam.get(tam) ?? 0;
                              if (!qtdMax) {
                                return (
                                  <td key={tam} className="px-1 py-1 text-center">
                                    <div className="rounded-full w-8 h-8 mx-auto flex items-center justify-center text-[11px] tabular-nums text-muted-foreground/40 border border-dashed">–</div>
                                  </td>
                                );
                              }
                              const k = key(c.cop.id, g.modelo, g.cor, tam);
                              const q = get(c.cop.id, g.modelo, g.cor, tam);
                              const completo = q >= qtdMax && qtdMax > 0;
                              const parcial = q > 0 && q < qtdMax;
                              const bolaCor = completo ? "#16a34a" : parcial ? "#9ca3af" : "transparent";
                              const numCor = (completo || parcial) ? "#ffffff" : "#111827";
                              const numBg = (completo || parcial) ? bolaCor : "#f3f4f6";
                              return (
                                <td key={tam} className="px-1 py-1 text-center">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() => { set(c.cop.id, g.modelo, g.cor, tam, completo ? 0 : qtdMax); setParcialEdit(null); }}
                                      title={completo ? "Desmarcar" : "Selecionar todos"}
                                      className="rounded-full w-9 h-9 flex items-center justify-center font-semibold tabular-nums text-[12px] border"
                                      style={{ backgroundColor: numBg, color: numCor, borderColor: completo ? "#15803d" : parcial ? "#6b7280" : "#d1d5db" }}
                                    >
                                      {qtdMax}
                                    </button>
                                    {parcialEdit === k ? (
                                      <div className="flex items-center gap-0.5">
                                        <Input
                                          type="number" autoFocus min={0} max={qtdMax}
                                          value={parcialVal}
                                          onChange={(e) => setParcialVal(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              const v = Math.max(0, Math.min(qtdMax, Math.floor(Number(parcialVal) || 0)));
                                              set(c.cop.id, g.modelo, g.cor, tam, v);
                                              setParcialEdit(null);
                                            }
                                          }}
                                          className="h-6 w-16 text-center text-[11px] px-1"
                                        />
                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                                          const v = Math.max(0, Math.min(qtdMax, Math.floor(Number(parcialVal) || 0)));
                                          set(c.cop.id, g.modelo, g.cor, tam, v);
                                          setParcialEdit(null);
                                        }}>
                                          <Check className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <button type="button" onClick={() => { setParcialEdit(k); setParcialVal(String(q || "")); }} title="Parcial" className="text-muted-foreground hover:text-foreground">
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                    )}
                                    <div className="text-[9px] tabular-nums text-muted-foreground">{q}/{qtdMax}</div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {cops.every((c) => c.perdasRestantes.length === 0) && (
            <div className="p-6 text-center text-sm text-muted-foreground">Sem perdas pendentes para refazer.</div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Máximo disponível: <b className="tabular-nums">{totais.max}</b></span>
          <span>Selecionadas: <b className="tabular-nums text-green-700">{totais.selTotal}</b></span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving || totais.selTotal === 0}>Criar COP de refação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
