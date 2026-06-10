import { useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function FinalizadosTab({ pedidos }: { pedidos: Pedido[] }) {
  const [search, setSearch] = useState("");

  const finalizados = useMemo(
    () => pedidos.filter((p) => p.embalado === "Sim" && (!search || `${p.pedido_olist} ${p.orcamento}`.toLowerCase().includes(search.toLowerCase()))),
    [pedidos, search],
  );

  return (
    <Card>
      <CardHeader><CardTitle>Pedidos finalizados ({finalizados.length})</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Orçamento</TableHead>
                <TableHead>QTD</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Saída Juff</TableHead>
                <TableHead>Data Saída</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finalizados.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum pedido finalizado.</TableCell></TableRow>
              ) : (
                finalizados.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.pedido_olist}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{p.orcamento}</TableCell>
                    <TableCell>{p.qtd}</TableCell>
                    <TableCell>{p.vendedor}</TableCell>
                    <TableCell><Badge variant="outline">{p.modelo_estampa}</Badge></TableCell>
                    <TableCell className="text-xs">{p.saida_juff ?? "—"}</TableCell>
                    <TableCell className="text-xs">{p.data_saida_juff ?? "—"}</TableCell>
                    <TableCell className="text-xs">{p.responsavel_conferencia ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
