import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const STORAGE_PREFIX = "table-col-widths:";

export function useColumnWidths(tableId: string, defaults: Record<string, number>) {
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return defaults;
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + tableId);
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch {}
    return defaults;
  });

  const setWidth = useCallback((key: string, w: number) => {
    setWidths((prev) => {
      const next = { ...prev, [key]: Math.max(24, Math.round(w)) };
      try { window.localStorage.setItem(STORAGE_PREFIX + tableId, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [tableId]);

  const reset = useCallback(() => {
    try { window.localStorage.removeItem(STORAGE_PREFIX + tableId); } catch {}
    setWidths(defaults);
  }, [tableId, defaults]);

  return { widths, setWidth, reset };
}

type Props = {
  colKey: string;
  width: number;
  onResize: (key: string, w: number) => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  minWidth?: number;
};

export function ResizableTh({ colKey, width, onResize, children, className, style, minWidth = 24 }: Props) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!thRef.current) return;
      const rect = thRef.current.getBoundingClientRect();
      const w = Math.max(minWidth, e.clientX - rect.left);
      onResize(colKey, w);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging, colKey, onResize, minWidth]);

  return (
    <th
      ref={thRef}
      className={`relative ${className ?? ""}`}
      style={{ width, minWidth: width, maxWidth: width, ...style }}
    >
      <div className="truncate pr-1">{children}</div>
      <div
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
        onDoubleClick={(e) => e.stopPropagation()}
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/50 active:bg-primary z-10"
        title="Arraste para redimensionar"
      />
    </th>
  );
}
