import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useEstoquePecas, fmtDateBR, type MapEstoquePeca } from "@/lib/map";
import { abrirInventarioParaImpressao, type InventarioRow } from "@/lib/inventario-pdf";

const STATUS_INVENTARIO = new Set(["Fechada", "Aberta", "Corte"]);

function saldoAltura(p: MapEstoquePeca): number | null {
  if (p.alt_inicial == null) return null;
  const usado = (p.cortes ?? []).reduce((s, c) => s + Number(c.metros || 0), 0);
  return Number(p.alt_inicial) - usado;
}

function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toFixed(2).replace(".", ",");
}

function hojeBR(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function InventarioTab() {
  const { data: pecas = [], isLoading } = useEstoquePecas();

  const rows = useMemo(() => {
    const filtered = pecas.filter((p) => STATUS_INVENTARIO.has(p.status));
    filtered.sort((a, b) => {
      const c = (a.cor ?? "").localeCompare(b.cor ?? "", "pt-BR");
      if (c !== 0) return c;
      return (a.numero_peca ?? "").localeCompare(b.numero_peca ?? "", "pt-BR", { numeric: true });
    });
    return filtered;
  }, [pecas]);

  const printRows: InventarioRow[] = useMemo(
    () =>
      rows.map((p) => ({
        cor: p.cor ?? "",
        numero_peca: p.numero_peca ?? "",
        status: p.status,
        data_entrada: p.data_entrada ? fmtDateBR(p.data_entrada) : "—",
        larg: fmtNum(p.larg),
        altura: fmtNum(saldoAltura(p)),
      })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">
          Data: <span className="font-semibold text-foreground">{hojeBR()}</span>
          <span className="mx-2">·</span>
          {rows.length} peça{rows.length === 1 ? "" : "s"}
        </div>
        <Button
          onClick={() => abrirInventarioParaImpressao(printRows)}
          disabled={rows.length === 0}
          size="sm"
        >
          <Printer className="h-4 w-4 mr-1.5" />
          Imprimir Inventário (PDF)
        </Button>
      </div>

      <div className="overflow-auto rounded-lg border border-border/60 bg-card">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-2 py-2">Cor</th>
              <th className="text-left px-2 py-2">Nº da peça</th>
              <th className="text-left px-2 py-2">Status</th>
              <th className="text-left px-2 py-2">Data de entrada</th>
              <th className="text-left px-2 py-2">Descanso</th>
              <th className="text-right px-2 py-2">Largura</th>
              <th className="text-right px-2 py-2">Altura</th>
              <th className="text-left px-2 py-2">Corte</th>
              <th className="text-left px-2 py-2">Sobra/Obs</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">Nenhuma peça em inventário.</td></tr>
            ) : rows.map((p) => (
              <tr key={p.id} className="border-t border-border/40">
                <td className="px-2 py-1.5">{p.cor ?? ""}</td>
                <td className="px-2 py-1.5">{p.numero_peca ?? ""}</td>
                <td className="px-2 py-1.5">{p.status}</td>
                <td className="px-2 py-1.5">{p.data_entrada ? fmtDateBR(p.data_entrada) : "—"}</td>
                <td className="px-2 py-1.5 text-muted-foreground/50">—</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(p.larg)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(saldoAltura(p))}</td>
                <td className="px-2 py-1.5 text-muted-foreground/50">—</td>
                <td className="px-2 py-1.5 text-muted-foreground/50">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
