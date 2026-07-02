import { useMemo, useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import type { PagamentoConsolidado, Oficina } from "@/lib/cop";
import { rotuloCop } from "@/lib/cop";
import { useProfilesMap, resolveNome } from "@/hooks/use-profiles-map";

function fmtMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export function HistoricoPagamentosConsolidados() {
  const [limite, setLimite] = useState(50);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const profiles = useProfilesMap();

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["pagamentos_consolidados", limite],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_consolidados" as any)
        .select("*")
        .order("pago_em", { ascending: false })
        .limit(limite);
      if (error) throw error;
      return (data ?? []) as unknown as PagamentoConsolidado[];
    },
  });

  const { data: oficinas = [] } = useQuery({
    queryKey: ["oficinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oficinas" as any).select("id, nome");
      if (error) throw error;
      return (data ?? []) as unknown as Pick<Oficina, "id" | "nome">[];
    },
  });
  const oficinaNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of oficinas) m.set(o.id, o.nome);
    return m;
  }, [oficinas]);

  function toggle(id: string) {
    setExpandidos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Histórico de pagamentos consolidados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="p-2 w-8"></th>
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Oficina</th>
                <th className="p-2 text-center">Qtd COPs</th>
                <th className="p-2 text-right">Valor total</th>
                <th className="p-2 text-left">Observação</th>
                <th className="p-2 text-left">Pago por</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="p-3 text-center text-muted-foreground">Carregando…</td></tr>
              ) : registros.length === 0 ? (
                <tr><td colSpan={7} className="p-3 text-center text-muted-foreground">Nenhum pagamento consolidado ainda.</td></tr>
              ) : registros.map((r) => {
                const aberto = expandidos.has(r.id);
                const detalhes = Array.isArray(r.detalhes) ? r.detalhes : [];
                return (
                  <Fragment key={r.id}>
                    <tr className="border-t cursor-pointer hover:bg-accent/40" onClick={() => toggle(r.id)}>
                      <td className="p-2 text-center">
                        {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="p-2 tabular-nums">{fmtDateTime(r.pago_em)}</td>
                      <td className="p-2">{oficinaNome.get(r.oficina_id) ?? "—"}</td>
                      <td className="p-2 text-center tabular-nums">{detalhes.length}</td>
                      <td className="p-2 text-right tabular-nums font-semibold">{fmtMoney(Number(r.valor_total))}</td>
                      <td className="p-2 text-xs">{r.observacao ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-2 text-xs">{resolveNome(profiles, r.pago_por)}</td>
                    </tr>
                    {aberto && (
                      <tr key={r.id + "-det"} className="bg-muted/20">
                        <td></td>
                        <td colSpan={6} className="p-2">
                          <div className="rounded border bg-background">
                            <table className="w-full text-xs">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="p-1 text-left">COP</th>
                                  <th className="p-1 text-right">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detalhes.map((d, i) => (
                                  <tr key={i} className="border-t">
                                    <td className="p-1 tabular-nums">{rotuloCop(d.numero, d.letra)}</td>
                                    <td className="p-1 text-right tabular-nums">{fmtMoney(Number(d.valor))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        {registros.length >= limite && (
          <div className="flex justify-center pt-3">
            <Button variant="outline" size="sm" onClick={() => setLimite((n) => n + 50)}>
              Carregar mais
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
