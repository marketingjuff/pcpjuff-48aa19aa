import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateBR } from "@/lib/format";
import type { DrillLinha } from "@/lib/kpi-pcp";

export interface DrillSpec {
  titulo: string;
  apoio?: string;
  linhas: DrillLinha[];
  colunas?: { batidas?: string; valor?: string; datas?: boolean; dias?: boolean };
  total: string;
}

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const num = (v: number | null | undefined) => (v == null ? "—" : Number.isInteger(v) ? nf.format(v) : nf1.format(v));

export function KpiPcpDrill({ spec, onClose }: { spec: DrillSpec | null; onClose: () => void }) {
  const c = spec?.colunas ?? {};
  const temNota = !!spec?.linhas.some((l) => l.nota || l.rateado);
  return (
    <Dialog open={!!spec} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        {spec && (
          <>
            <DialogHeader>
              <DialogTitle>{spec.titulo}</DialogTitle>
              <DialogDescription>{spec.apoio ?? "Pedidos que formam esse número, com os filtros do topo aplicados."}</DialogDescription>
            </DialogHeader>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-semibold">Total: {spec.total}</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Peças</TableHead>
                  {c.batidas && <TableHead className="text-right">{c.batidas}</TableHead>}
                  {c.valor && <TableHead className="text-right">{c.valor}</TableHead>}
                  {c.datas && <TableHead>Início</TableHead>}
                  {c.datas && <TableHead>Fim</TableHead>}
                  {c.dias && <TableHead className="text-right">Dias úteis</TableHead>}
                  {temNota && <TableHead>Obs.</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {spec.linhas.map((l, i) => (
                  <TableRow key={`${l.id}-${i}`}>
                    <TableCell className="font-semibold">{l.numero}</TableCell>
                    <TableCell>{l.vendedor}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(l.pecas)}</TableCell>
                    {c.batidas && <TableCell className="text-right tabular-nums">{num(l.batidas)}</TableCell>}
                    {c.valor && <TableCell className="text-right tabular-nums">{num(l.valor)}</TableCell>}
                    {c.datas && <TableCell>{formatDateBR(l.inicio) || "—"}</TableCell>}
                    {c.datas && <TableCell>{formatDateBR(l.fim) || "—"}</TableCell>}
                    {c.dias && <TableCell className="text-right tabular-nums">{num(l.dias)}</TableCell>}
                    {temNota && (
                      <TableCell className="text-xs">
                        {l.rateado && (
                          <span className="mr-1 rounded bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground">dividido</span>
                        )}
                        <span className="text-muted-foreground">{l.nota}</span>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {spec.linhas.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-sm text-muted-foreground">Nenhum pedido.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
