import { useState } from "react";
import {
  REFACAO_MODELOS,
  REFACAO_TAMANHOS,
  REFACAO_CORES,
  type PecaPerdida,
} from "@/lib/pedidos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, X, Check, Pencil } from "lucide-react";

/* ---------- helpers ---------- */

export function pecaLinhaCompleta(p: PecaPerdida): boolean {
  return !!(p.modelo && p.cor && p.tamanho && Number(p.qtd) >= 1);
}
export function somaPecas(linhas: PecaPerdida[]): number {
  return linhas.reduce((acc, l) => acc + (Number(l.qtd) || 0), 0);
}
export function corHex(nome: string): string {
  return REFACAO_CORES.find((c) => c.nome === nome)?.hex ?? "#cccccc";
}
/** Retorna #353439 para cores claras, branco para escuras (luminância relativa). */
export function corTextoSobre(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const L = 0.299 * r + 0.587 * g + 0.114 * b;
  return L > 186 ? "#353439" : "#ffffff";
}
export function novaPecaVazia(): PecaPerdida {
  return { modelo: "", cor: "", tamanho: "", qtd: 1 };
}

/* ---------- chip (resumo / read-only) ---------- */

function Chip({ p }: { p: PecaPerdida }) {
  const hex = corHex(p.cor);
  const fg = corTextoSobre(hex);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium border"
      style={{ backgroundColor: hex, color: fg, borderColor: fg === "#ffffff" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)" }}
    >
      <span>{p.modelo || "—"}</span>
      <span className="opacity-80">·</span>
      <span>{p.tamanho || "—"}</span>
      <span className="opacity-80">·</span>
      <span>{p.qtd || 0}</span>
    </span>
  );
}

/* ---------- editor ---------- */

interface Props {
  value: PecaPerdida[];
  onChange?: (next: PecaPerdida[]) => void;
  readOnly?: boolean;
}

export function PecasPerdidasEditor({ value, onChange, readOnly = false }: Props) {
  // Quais índices estão expandidos (em edição). Por padrão: linhas incompletas expandidas.
  const [openIdx, setOpenIdx] = useState<Set<number>>(
    () => new Set(value.map((p, i) => (pecaLinhaCompleta(p) ? -1 : i)).filter((i) => i >= 0)),
  );

  function emit(next: PecaPerdida[]) {
    onChange?.(next);
  }
  function setLinha(i: number, patch: Partial<PecaPerdida>) {
    emit(value.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function adicionar() {
    const next = [...value, novaPecaVazia()];
    setOpenIdx((s) => new Set([...s, next.length - 1]));
    emit(next);
  }
  function remover(i: number) {
    emit(value.filter((_, idx) => idx !== i));
    setOpenIdx((s) => {
      const n = new Set<number>();
      for (const k of s) if (k !== i) n.add(k > i ? k - 1 : k);
      return n;
    });
  }
  function colapsar(i: number) {
    setOpenIdx((s) => {
      const n = new Set(s);
      n.delete(i);
      return n;
    });
  }
  function expandir(i: number) {
    setOpenIdx((s) => new Set([...s, i]));
  }

  /* ----- read-only ----- */
  if (readOnly) {
    const completas = value.filter(pecaLinhaCompleta);
    return (
      <div className="space-y-2">
        {completas.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma peça registrada.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {completas.map((p, i) => <Chip key={i} p={p} />)}
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          Total de peças perdidas: <span className="font-semibold tabular-nums">{somaPecas(completas)}</span>
        </div>
      </div>
    );
  }

  /* ----- editável ----- */
  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {value.map((p, i) => {
          const aberto = openIdx.has(i) || !pecaLinhaCompleta(p);
          const hex = corHex(p.cor);
          const fg = corTextoSobre(hex);
          if (!aberto) {
            return (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => expandir(i)}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium border hover:opacity-90"
                  style={{ backgroundColor: hex, color: fg, borderColor: fg === "#ffffff" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)" }}
                  title="Editar peça"
                >
                  <Pencil className="h-3 w-3" />
                  <span>{p.modelo}</span>
                  <span className="opacity-80">·</span>
                  <span>{p.tamanho}</span>
                  <span className="opacity-80">·</span>
                  <span>{p.qtd}</span>
                </button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => remover(i)} title="Remover peça">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          }
          return (
            <div key={i} className="rounded-md border p-2 space-y-2 bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-4">
                  <label className="text-[11px] text-muted-foreground font-medium">Modelo</label>
                  <Select value={p.modelo} onValueChange={(v) => setLinha(i, { modelo: v })}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {REFACAO_MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-4">
                  <label className="text-[11px] text-muted-foreground font-medium">Cor</label>
                  <Select value={p.cor} onValueChange={(v) => setLinha(i, { cor: v })}>
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
                  <Select value={p.tamanho} onValueChange={(v) => setLinha(i, { tamanho: v })}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {REFACAO_TAMANHOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-muted-foreground font-medium">Qtd</label>
                  <Input
                    type="number"
                    min={1}
                    className="h-8"
                    value={p.qtd}
                    onChange={(e) => setLinha(i, { qtd: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={() => colapsar(i)}
                  disabled={!pecaLinhaCompleta(p)}
                  title="Confirmar peça"
                >
                  <Check className="h-3.5 w-3.5 mr-1" />OK
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => remover(i)} title="Remover peça">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" onClick={adicionar}>
          <Plus className="h-4 w-4 mr-1" />Adicionar peça
        </Button>
        <div className="text-xs text-muted-foreground">
          Total de peças perdidas: <span className="font-semibold tabular-nums">{somaPecas(value.filter(pecaLinhaCompleta))}</span>
        </div>
      </div>
    </div>
  );
}
