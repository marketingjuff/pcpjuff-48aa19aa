import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { type Cop, type Oficina, rotuloRomaneio, totalPecasCop } from "@/lib/cop";
import { cargaPorOficina, copsPorOficina } from "@/lib/cop-oficinas";
import { useCopColorSettings } from "@/hooks/use-cop-color-settings";

export function OficinasHojeTab() {
  const qc = useQueryClient();
  const { etapaStyle } = useCopColorSettings();

  const { data: cops = [], isLoading } = useQuery({
    queryKey: ["cops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cops" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Cop[];
    },
  });

  const { data: oficinas = [] } = useQuery({
    queryKey: ["oficinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oficinas" as any).select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Oficina[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("cops-oficinas-hoje")
      .on("postgres_changes", { event: "*", schema: "public", table: "cops" }, () => qc.invalidateQueries({ queryKey: ["cops"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const carga = useMemo(() => cargaPorOficina(cops), [cops]);
  const porOficina = useMemo(() => copsPorOficina(cops), [cops]);

  const grupos = useMemo(() => {
    const out: { oficina: Oficina; cops: Cop[]; total: number }[] = [];
    for (const o of oficinas) {
      const arr = (porOficina.get(o.id) ?? []).slice().sort((a, b) => rotuloRomaneio(a, cops).localeCompare(rotuloRomaneio(b, cops)));
      if (arr.length === 0) continue;
      out.push({ oficina: o, cops: arr, total: carga.get(o.id) ?? 0 });
    }
    out.sort((a, b) => b.total - a.total);
    return out;
  }, [oficinas, porOficina, carga, cops]);

  const totalGeral = useMemo(() => grupos.reduce((s, g) => s + g.total, 0), [grupos]);
  const totalRomaneios = useMemo(() => grupos.reduce((s, g) => s + g.cops.length, 0), [grupos]);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Oficinas Hoje</h2>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ["cops"] })} title="Recarregar">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <div className="text-xs text-muted-foreground">
          {grupos.length} oficinas · {totalRomaneios} romaneios · {totalGeral} peças
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : grupos.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">Nenhuma oficina com romaneio ativo no momento.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {grupos.map((g) => (
            <Card key={g.oficina.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{g.oficina.nome}</CardTitle>
                  <div className="text-xs">
                    <span className="text-muted-foreground mr-1">Total na oficina:</span>
                    <span className="font-bold tabular-nums text-lg">{g.total}</span>
                    <span className="text-muted-foreground"> peças</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs">
                      <tr>
                        <th className="p-2 text-left">Romaneio</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-right">Peças</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.cops.map((c) => (
                        <tr key={c.id} className="border-t">
                          <td className="p-2 font-semibold tabular-nums">{rotuloRomaneio(c, cops)}</td>
                          <td className="p-2">
                            <span className="px-2 py-0.5 rounded text-xs border" style={etapaStyle(c.status)}>{c.status}</span>
                          </td>
                          <td className="p-2 text-right tabular-nums">{totalPecasCop(c.pecas)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 border-t">
                        <td className="p-2" colSpan={2}><b>Total da oficina</b></td>
                        <td className="p-2 text-right tabular-nums font-bold">{g.total}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
