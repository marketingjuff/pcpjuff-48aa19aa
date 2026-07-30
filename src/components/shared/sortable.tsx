import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type SortDir = "asc" | "desc";

/**
 * Ordenação genérica para tabelas. `getters` mapeia a chave da coluna para o
 * valor comparável da linha. Sem coluna ativa, mantém a ordem original
 * (ex.: ordem manual definida pelo corte).
 */
export function useTableSort<T>(
  rows: T[],
  getters: Record<string, (row: T) => string | number | null | undefined>,
  initial?: { key: string; dir?: SortDir },
) {
  const [key, setKey] = useState<string | null>(initial?.key ?? null);
  const [dir, setDir] = useState<SortDir>(initial?.dir ?? "asc");

  function toggle(next: string) {
    if (next === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setKey(next);
      setDir("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!key || !getters[key]) return rows;
    const get = getters[key];
    const mult = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const ea = va == null || va === "";
      const eb = vb == null || vb === "";
      if (ea && eb) return 0;
      if (ea) return 1;
      if (eb) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * mult;
      return String(va).localeCompare(String(vb), "pt-BR", { numeric: true, sensitivity: "base" }) * mult;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, key, dir]);

  return { rows: sorted, sortKey: key, sortDir: dir, toggle };
}

/** Ícone de ordenação (neutro / crescente / decrescente). */
export function SortIcon({ active, dir }: { active?: boolean; dir?: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp className="h-3 w-3 opacity-100" />
    : <ArrowDown className="h-3 w-3 opacity-100" />;
}

/** <th> clicável com flechinhas de crescente/decrescente. */
export function SortTh({
  label, sortKey, current, dir, onSort, className, children,
}: {
  label?: string;
  sortKey: string;
  current: string | null;
  dir: SortDir;
  onSort: (key: string) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const active = current === sortKey;
  return (
    <th
      className={`p-1.5 font-medium cursor-pointer select-none whitespace-nowrap ${className ?? ""}`}
      onClick={() => onSort(sortKey)}
      title="Ordenar"
    >
      <span className="inline-flex items-center gap-1">
        {children ?? label}
        <SortIcon active={active} dir={dir} />
      </span>
    </th>
  );
}
