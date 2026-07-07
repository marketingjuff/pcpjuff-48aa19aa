import { useEffect, useMemo, useRef, useState } from "react";
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

/* ---------- helpers públicos ---------- */

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

/* ---------- linhas agrupadas (UI) ---------- */

type GroupedRow = {
  modelo: string;
  cor: string;
  qtds: Record<string, number>; // tamanho → qtd
};

function novaLinhaVazia(): GroupedRow {
  return { modelo: "", cor: "", qtds: {} };
}

function groupFromFlat(flat: PecaPerdida[]): GroupedRow[] {
  const map = new Map<string, GroupedRow>();
  const ordem: string[] = [];
  for (const p of flat) {
    const key = `${p.modelo}|||${p.cor}`;
    let row = map.get(key);
    if (!row) {
      row = { modelo: p.modelo, cor: p.cor, qtds: {} };
      map.set(key, row);
      ordem.push(key);
    }
    if (p.tamanho) {
      const q = Number(p.qtd) || 0;
      if (q > 0) row.qtds[p.tamanho] = (row.qtds[p.tamanho] ?? 0) + q;
    }
  }
  return ordem.map((k) => map.get(k)!);
}

function flattenRows(rows: GroupedRow[]): PecaPerdida[] {
  const out: PecaPerdida[] = [];
  for (const r of rows) {
    if (!r.modelo || !r.cor) continue;
    for (const tam of REFACAO_TAMANHOS) {
      const q = Number(r.qtds[tam]) || 0;
      if (q >= 1) out.push({ modelo: r.modelo, cor: r.cor, tamanho: tam, qtd: q });
    }
  }
  return out;
}

function linhaCompleta(r: GroupedRow): boolean {
  if (!r.modelo || !r.cor) return false;
  return REFACAO_TAMANHOS.some((t) => (Number(r.qtds[t]) || 0) >= 1);
}
function somaLinha(r: GroupedRow): number {
  return REFACAO_TAMANHOS.reduce((s, t) => s + (Number(r.qtds[t]) || 0), 0);
}

function serialize(flat: PecaPerdida[]): string {
  const norm = flat.map((p) => ({
    modelo: p.modelo, cor: p.cor, tamanho: p.tamanho, qtd: Number(p.qtd) || 0,
  }));
  return JSON.stringify(norm);
}

/* ---------- chip agrupado (read-only e colapsado) ---------- */

const COL_MODELO = "w-32";
const COL_COR = "w-28";
const COL_TAM = "w-10";
const COL_TOTAL = "w-14";

export function ChipGroupedHeader() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium whitespace-nowrap">
      <span className={`${COL_MODELO} shrink-0`}>Modelo</span>
      <span className={`${COL_COR} shrink-0`}>Cor</span>
      {REFACAO_TAMANHOS.map((t) => (
        <span key={t} className={`${COL_TAM} shrink-0 text-center`}>{t}</span>
      ))}
      <span className={`${COL_TOTAL} shrink-0 text-center`}>Total</span>
    </div>
  );
}

function ChipGrouped({ row }: { row: GroupedRow }) {
  const hex = corHex(row.cor);
  const fg = corTextoSobre(hex);
  const total = REFACAO_TAMANHOS.reduce((s, t) => s + (Number(row.qtds[t]) || 0), 0);
  return (
    <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium border bg-muted/40 whitespace-nowrap">
      <span className={`${COL_MODELO} shrink-0 uppercase font-semibold truncate`} title={row.modelo || ""}>
        {row.modelo || "—"}
      </span>
      <span
        className={`${COL_COR} shrink-0 px-1.5 py-0.5 rounded font-bold text-center truncate`}
        style={{
          backgroundColor: hex,
          color: fg,
          borderColor: fg === "#ffffff" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)",
        }}
        title={row.cor || ""}
      >
        {row.cor || "—"}
      </span>
      {REFACAO_TAMANHOS.map((t) => {
        const q = Number(row.qtds[t]) || 0;
        return (
          <span key={t} className={`${COL_TAM} shrink-0 text-center tabular-nums ${q > 0 ? "" : "text-muted-foreground"}`}>
            {q > 0 ? q : "-"}
          </span>
        );
      })}
      <span className={`${COL_TOTAL} shrink-0 text-center tabular-nums font-semibold`}>{total}</span>
    </div>
  );
}

/* ---------- editor ---------- */

interface Props {
  value: PecaPerdida[];
  onChange?: (next: PecaPerdida[]) => void;
  readOnly?: boolean;
}

export function PecasPerdidasEditor({ value, onChange, readOnly = false }: Props) {
  const [rows, setRows] = useState<GroupedRow[]>(() => groupFromFlat(value));
  const [openIdx, setOpenIdx] = useState<Set<number>>(() => {
    const initial = groupFromFlat(value);
    const set = new Set<number>();
    initial.forEach((r, i) => { if (!linhaCompleta(r)) set.add(i); });
    return set;
  });
  const lastEmittedRef = useRef<string>(serialize(value));

  // Ressincroniza quando o `value` externo muda por fora do editor.
  useEffect(() => {
    const sig = serialize(value);
    if (sig !== lastEmittedRef.current) {
      const next = groupFromFlat(value);
      setRows(next);
      lastEmittedRef.current = sig;
    }
  }, [value]);

  function emit(nextRows: GroupedRow[]) {
    setRows(nextRows);
    const flat = flattenRows(nextRows);
    lastEmittedRef.current = serialize(flat);
    onChange?.(flat);
  }

  function setLinha(i: number, patch: Partial<GroupedRow>) {
    emit(rows.map((r, idx) => (idx === i ? { ...r, ...patch, qtds: { ...r.qtds, ...(patch.qtds ?? {}) } } : r)));
  }
  function setQtd(i: number, tam: string, q: number) {
    const next = rows.map((r, idx) => {
      if (idx !== i) return r;
      const qtds = { ...r.qtds };
      if (!q || q <= 0) delete qtds[tam];
      else qtds[tam] = q;
      return { ...r, qtds };
    });
    emit(next);
  }
  function adicionar() {
    const next = [...rows, novaLinhaVazia()];
    setOpenIdx((s) => new Set([...s, next.length - 1]));
    emit(next);
  }
  function remover(i: number) {
    emit(rows.filter((_, idx) => idx !== i));
    setOpenIdx((s) => {
      const n = new Set<number>();
      for (const k of s) if (k !== i) n.add(k > i ? k - 1 : k);
      return n;
    });
  }
  function colapsar(i: number) {
    setOpenIdx((s) => { const n = new Set(s); n.delete(i); return n; });
  }
  function expandir(i: number) {
    setOpenIdx((s) => new Set([...s, i]));
  }

  const totalTudo = useMemo(() => rows.reduce((s, r) => s + somaLinha(r), 0), [rows]);

  /* ----- read-only ----- */
  if (readOnly) {
    const completas = rows.filter(linhaCompleta);
    return (
      <div className="space-y-2">
        {completas.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma peça registrada.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {completas.map((r, i) => <ChipGrouped key={i} row={r} />)}
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          Total de peças perdidas: <span className="font-semibold tabular-nums">{totalTudo}</span>
        </div>
      </div>
    );
  }

  /* ----- editável ----- */
  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {rows.map((r, i) => {
          const aberto = openIdx.has(i) || !linhaCompleta(r);
          const hex = corHex(r.cor);
          const fg = corTextoSobre(hex);

          if (!aberto) {
            return (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => expandir(i)}
                  className="flex-1 text-left"
                  title="Editar peças"
                >
                  <div className="inline-flex items-center gap-1.5 flex-wrap">
                    <Pencil className="h-3 w-3 opacity-60" />
                    <ChipGrouped row={r} />
                  </div>
                </button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => remover(i)} title="Remover">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          }

          return (
            <div key={i} className="rounded-md border p-2 space-y-2 bg-muted/30">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[180px]">
                  <label className="text-[11px] text-muted-foreground font-medium block">Modelo</label>
                  <Select value={r.modelo} onValueChange={(v) => setLinha(i, { modelo: v })}>
                    <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {REFACAO_MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[160px]">
                  <label className="text-[11px] text-muted-foreground font-medium block">Cor</label>
                  <Select value={r.cor} onValueChange={(v) => setLinha(i, { cor: v })}>
                    <SelectTrigger
                      className="h-8 w-[160px] font-bold"
                      style={r.cor ? { backgroundColor: hex, color: fg, borderColor: fg === "#ffffff" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)" } : undefined}
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
                            className="my-0.5 rounded-sm font-semibold focus:opacity-90"
                          >
                            {c.nome}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {REFACAO_TAMANHOS.map((t) => (
                  <div key={t} className="w-[56px]">
                    <label className="text-[11px] text-muted-foreground font-medium block text-center">{t}</label>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 text-center px-1"
                      value={r.qtds[t] ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const n = raw === "" ? 0 : Math.max(0, Number(raw) || 0);
                        setQtd(i, t, n);
                      }}
                    />
                  </div>
                ))}

                <div className="ml-auto text-xs text-muted-foreground pb-1">
                  Total <span className="font-semibold tabular-nums text-foreground">{somaLinha(r)}</span>
                </div>
              </div>
              <div className="flex justify-end gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={() => colapsar(i)}
                  disabled={!linhaCompleta(r)}
                  title="Confirmar linha"
                >
                  <Check className="h-3.5 w-3.5 mr-1" />OK
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => remover(i)} title="Remover linha">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" onClick={adicionar}>
          <Plus className="h-4 w-4 mr-1" />Adicionar linha
        </Button>
        <div className="text-xs text-muted-foreground">
          Total de peças perdidas: <span className="font-semibold tabular-nums">{totalTudo}</span>
        </div>
      </div>
    </div>
  );
}
