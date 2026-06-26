import { useEffect, useState } from "react";
import {
  REFACAO_MODELOS,
  REFACAO_TAMANHOS,
  REFACAO_CORES,
  type PecaSolicitada,
} from "@/lib/pedidos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { corHex, corTextoSobre } from "./PecasPerdidasEditor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: PecaSolicitada[];
  onSave: (next: PecaSolicitada[]) => void | Promise<void>;
  readOnly?: boolean;
}

function novaLinha(): PecaSolicitada {
  return { modelo: "", cor: "", tamanho: "", qtd: 1, qtd_enviada: 0 };
}

export function SolicitarPecasDialog({ open, onOpenChange, value, onSave, readOnly = false }: Props) {
  const [linhas, setLinhas] = useState<PecaSolicitada[]>(value ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setLinhas((value ?? []).map((p) => ({ ...p })));
  }, [open, value]);

  function setLinha(i: number, patch: Partial<PecaSolicitada>) {
    setLinhas((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function adicionar() {
    setLinhas((arr) => [...arr, novaLinha()]);
  }
  function remover(i: number) {
    setLinhas((arr) => arr.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(linhas);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const total = linhas.reduce((a, l) => a + (Number(l.qtd) || 0), 0);
  const enviado = linhas.reduce((a, l) => a + (Number(l.qtd_enviada) || 0), 0);
  const pendente = Math.max(0, total - enviado);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{readOnly ? "Peças solicitadas (somente leitura)" : "Solicitar Peças"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {linhas.length === 0 && (
            <div className="text-sm text-muted-foreground">Nenhuma peça registrada.</div>
          )}

          {linhas.map((p, i) => {
            const hex = corHex(p.cor);
            const fg = corTextoSobre(hex);
            const pend = Math.max(0, (Number(p.qtd) || 0) - (Number(p.qtd_enviada) || 0));
            const linhaTudoEnviado = (Number(p.qtd_enviada) || 0) >= (Number(p.qtd) || 0) && (Number(p.qtd) || 0) > 0;
            return (
              <div key={i} className="rounded-md border p-2 space-y-2 bg-muted/30">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-3">
                    <label className="text-[11px] text-muted-foreground font-medium">Modelo</label>
                    <Select value={p.modelo} onValueChange={(v) => setLinha(i, { modelo: v })} disabled={readOnly}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {REFACAO_MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-[11px] text-muted-foreground font-medium">Cor</label>
                    <Select value={p.cor} onValueChange={(v) => setLinha(i, { cor: v })} disabled={readOnly}>
                      <SelectTrigger
                        className="h-8"
                        style={p.cor ? { backgroundColor: hex, color: fg, borderColor: fg === "#ffffff" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)" } : undefined}
                      >
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {REFACAO_CORES.map((c) => {
                          const f = corTextoSobre(c.hex);
                          return (
                            <SelectItem
                              key={c.nome}
                              value={c.nome}
                              style={{ backgroundColor: c.hex, color: f }}
                              className="my-0.5 rounded-sm focus:opacity-90"
                            >
                              {c.nome}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] text-muted-foreground font-medium">Tamanho</label>
                    <Select value={p.tamanho} onValueChange={(v) => setLinha(i, { tamanho: v })} disabled={readOnly}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {REFACAO_TAMANHOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="text-[11px] text-muted-foreground font-medium">Qtd</label>
                    <Input
                      type="number"
                      min={1}
                      className="h-8"
                      value={p.qtd}
                      disabled={readOnly}
                      onChange={(e) => setLinha(i, { qtd: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </div>
                  <div className="sm:col-span-3 flex items-end gap-1">
                    <div className="flex flex-wrap gap-1 text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200">Sol. {p.qtd || 0}</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">Env. {p.qtd_enviada || 0}</span>
                      <span className={`px-1.5 py-0.5 rounded border ${pend > 0 ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-muted text-muted-foreground"}`}>
                        Pend. {pend}
                      </span>
                      {linhaTudoEnviado && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white">OK</span>
                      )}
                    </div>
                    {!readOnly && (
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 ml-auto" onClick={() => remover(i)} title="Remover">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {!readOnly && (
            <div className="flex justify-start pt-1">
              <Button type="button" size="sm" variant="outline" onClick={adicionar}>
                <Plus className="h-4 w-4 mr-1" />Adicionar peça
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2 text-xs text-muted-foreground">
            <span>Total solicitado: <span className="font-semibold tabular-nums text-foreground">{total}</span></span>
            <span>Total enviado: <span className="font-semibold tabular-nums text-foreground">{enviado}</span></span>
            <span>Pendente: <span className="font-semibold tabular-nums text-foreground">{pendente}</span></span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? "Fechar" : "Cancelar"}
          </Button>
          {!readOnly && (
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
