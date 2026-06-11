import { useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw } from "lucide-react";
import { formatDateBR } from "@/lib/format";

interface Props {
  pedidos: Pedido[];
  onReabrir: (id: string) => void;
}

export function FinalizadosTab({ pedidos, onReabrir }: Props) {
  const [search, setSearch] = useState("");
  const [periodo, setPeriodo] = useState<string>("tudo");
  const [de, setDe] = useState<string>("");
  const [ate, setAte] = useState<string>("");

  const finalizados = useMemo(() => {
    const hoje = new Date();
    return pedidos.filter((p) => {
      if (!p.finalizado_em) return false;
      if (search && !`${p.pedido_olist} ${p.orcamento}`.toLowerCase().includes(search.toLowerCase())) return false;
      const fin = new Date(p.finalizado_em);
      if (periodo === "7d" && (hoje.getTime() - fin.getTime()) > 7 * 86400000) return false;
      if (periodo === "30d" && (hoje.getTime() - fin.getTime()) > 30 * 86400000) return false;
      if (periodo === "custom") {
        if (de && fin < new Date(de + "T00:00:00")) return false;
        if (ate && fin > new Date(ate + "T23:59:59")) return false;
      }
      return true;
    }).sort((a, b) => (b.finalizado_em ?? "").localeCompare(a.finalizado_em ?? ""));
  }, [pedidos, search, periodo, de, ate]);

  return (
    <Card>
      <CardHeader><CardTitle>Pedidos finalizados ({finalizados.length})</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-4">
          <Input placeholder="Buscar pedido ou orçamento..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tudo">Tudo</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {periodo === "custom" && (
            <>
              <DateInputBR value={de} onChange={(v) => setDe(v ?? "")} />
              <DateInputBR value={ate} onChange={(v) => setAte(v ?? "")} />
            </>
          )}
        </div>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                {["Pedido","Orçamento","QTD","Vendedor","Tipo","Saída Juff","Data Saída","Responsável","Finalizado em",""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {finalizados.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Nenhum pedido finalizado.</td></tr>
              ) : (
                finalizados.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{p.pedido_olist}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate">{p.orcamento}</td>
                    <td className="px-3 py-2">{p.qtd}</td>
                    <td className="px-3 py-2">{p.vendedor}</td>
                    <td className="px-3 py-2"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDateBR(p.saida_juff)}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDateBR(p.data_saida_juff)}</td>
                    <td className="px-3 py-2 text-xs">{p.responsavel_acabamento ?? "—"}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDateBR(p.finalizado_em?.slice(0,10))}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => onReabrir(p.id)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Reabrir
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
