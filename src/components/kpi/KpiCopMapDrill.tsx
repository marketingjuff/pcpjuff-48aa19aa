import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateBR } from "@/lib/format";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import type { DrillLinhaCop } from "@/lib/kpi-cop-map";

export type ColunasCop = {
  oficina?: boolean;
  modelo?: boolean;
  cor?: boolean;
  tamanho?: boolean;
  qtd?: boolean;
  metros?: boolean;
  valor?: boolean;
  inicio?: boolean;
  fim?: boolean;
  dias?: boolean;
  nota?: boolean;
};

export interface DrillCopSpec {
  titulo: string;
  apoio: string;
  linhas: DrillLinhaCop[];
  colunas: ColunasCop;
  total: string;
}

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ChipCor({ cor }: { cor: string }) {
  if (!cor || cor === "—") return <span className="text-muted-foreground">—</span>;
  const hex = corHex(cor);
  return (
    <span className="inline-block rounded px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: hex, color: corTextoSobre(hex) }}>
      {cor}
    </span>
  );
}

export function KpiCopMapDrill({ spec, onClose }: { spec: DrillCopSpec | null; onClose: () => void }) {
  const c = spec?.colunas ?? {};
  return (
    <Dialog open={!!spec} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        {spec && (
          <>
            <DialogHeader>
              <DialogTitle>{spec.titulo}</DialogTitle>
              <DialogDescription>{spec.apoio}</DialogDescription>
            </DialogHeader>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-semibold">Total: {spec.total}</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>COP</TableHead>
                  {c.oficina && <TableHead>Oficina</TableHead>}
                  {c.modelo && <TableHead>Modelo</TableHead>}
                  {c.cor && <TableHead>Cor</TableHead>}
                  {c.tamanho && <TableHead>Tamanho</TableHead>}
                  {c.qtd && <TableHead className="text-right">Qtd.</TableHead>}
                  {c.metros && <TableHead className="text-right">Metros</TableHead>}
                  {c.valor && <TableHead className="text-right">Valor</TableHead>}
                  {c.inicio && <TableHead>Início</TableHead>}
                  {c.fim && <TableHead>Fim</TableHead>}
                  {c.dias && <TableHead className="text-right">Dias úteis</TableHead>}
                  {c.nota && <TableHead>Obs.</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {spec.linhas.map((l, i) => (
                  <TableRow key={`${l.id}-${i}`}>
                    <TableCell className="font-semibold">{l.rotulo}</TableCell>
                    {c.oficina && <TableCell>{l.oficina}</TableCell>}
                    {c.modelo && <TableCell>{l.modelo || "—"}</TableCell>}
                    {c.cor && <TableCell><ChipCor cor={l.cor} /></TableCell>}
                    {c.tamanho && <TableCell>{l.tamanho || "—"}</TableCell>}
                    {c.qtd && <TableCell className="text-right tabular-nums">{l.qtd == null ? "—" : nf.format(l.qtd)}</TableCell>}
                    {c.metros && <TableCell className="text-right tabular-nums">{l.metros == null ? "—" : nf1.format(l.metros)}</TableCell>}
                    {c.valor && <TableCell className="text-right tabular-nums">{l.valor == null ? "—" : `R$ ${nf2.format(l.valor)}`}</TableCell>}
                    {c.inicio && <TableCell>{formatDateBR(l.inicio) || "—"}</TableCell>}
                    {c.fim && <TableCell>{formatDateBR(l.fim) || "—"}</TableCell>}
                    {c.dias && <TableCell className="text-right tabular-nums">{l.dias == null ? "—" : nf.format(l.dias)}</TableCell>}
                    {c.nota && <TableCell className="text-xs text-muted-foreground">{l.nota || "—"}</TableCell>}
                  </TableRow>
                ))}
                {spec.linhas.length === 0 && (
                  <TableRow><TableCell colSpan={12} className="text-sm text-muted-foreground">Nada neste período.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
