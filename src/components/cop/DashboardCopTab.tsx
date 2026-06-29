import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCopColorSettings } from "@/hooks/use-cop-color-settings";
import { COP_STATUS_LIST, totalPecasCop, rotuloCop, type Cop } from "@/lib/cop";
import type { Pedido } from "@/lib/pedidos";
import { calcEmProducao, calcFaltantes, calcBaixado, calcDisponivel, pkKey, dataUrgencia, addDiasUteis } from "@/lib/cop-saldos";

export function DashboardCopTab() {
  const qc = useQueryClient();
  const { etapaStyle } = useCopColorSettings();

  const { data: cops = [] } = useQuery({
    queryKey: ["cops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cops" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Cop[];
    },
  });
  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-cop-saldos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pedidos" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Pedido[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("cop-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "cops" }, () => qc.invalidateQueries({ queryKey: ["cops"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => qc.invalidateQueries({ queryKey: ["pedidos-cop-saldos"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const contagemStatus = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of COP_STATUS_LIST) m[s] = 0;
    for (const c of cops) m[c.status] = (m[c.status] ?? 0) + 1;
    return m;
  }, [cops]);

  const totalProducao = useMemo(() => {
    return cops.reduce((s, c) => {
      if (c.status === "Aguardando Risco" || c.status === "Aguardando Corte") return s;
      return s + totalPecasCop(c.pecas);
    }, 0);
  }, [cops]);

  const producao = useMemo(() => calcEmProducao(cops), [cops]);
  const faltantes = useMemo(() => calcFaltantes(pedidos), [pedidos]);
  const baixado = useMemo(() => calcBaixado(pedidos), [pedidos]);
  const disponivel = useMemo(() => calcDisponivel(producao, faltantes, baixado), [producao, faltantes, baixado]);

  const saldoGeral = useMemo(() => {
    let s = 0;
    for (const v of disponivel.values()) s += v;
    return s;
  }, [disponivel]);

  const topNegativos = useMemo(() => {
    const arr = Array.from(disponivel.entries())
      .map(([k, v]) => ({ k, v }))
      .filter((x) => x.v < 0)
      .sort((a, b) => a.v - b.v)
      .slice(0, 5);
    return arr.map((x) => {
      const [modelo, cor, tamanho] = x.k.split("|");
      return { modelo, cor, tamanho, saldo: x.v };
    });
  }, [disponivel]);

  const urgentes = useMemo(() => {
    const incompletos = pedidos.filter((p) => p.status_pecas === "incompleto");
    return incompletos
      .map((p) => ({ p, ancora: dataUrgencia(p) }))
      .filter((x) => !!x.ancora)
      .sort((a, b) => (a.ancora! > b.ancora! ? 1 : -1))
      .slice(0, 10);
  }, [pedidos]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">COPs ativos</div>
          <div className="text-3xl font-bold tabular-nums">{cops.filter((c) => c.status !== "Finalizado").length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Peças em produção</div>
          <div className="text-3xl font-bold tabular-nums text-green-700">{totalProducao}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Saldo geral</div>
          <div className={`text-3xl font-bold tabular-nums ${saldoGeral < 0 ? "text-red-700" : "text-green-700"}`}>{saldoGeral}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Pedidos pendentes</div>
          <div className="text-3xl font-bold tabular-nums">{pedidos.filter((p) => p.status_pecas === "incompleto").length}</div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">COPs por status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {COP_STATUS_LIST.map((s) => (
              <div key={s} className="flex items-center justify-between text-sm">
                <span className="px-2 py-0.5 rounded text-xs border" style={etapaStyle(s)}>{s}</span>
                <span className="tabular-nums font-semibold">{contagemStatus[s] ?? 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top urgências (saldo negativo)</CardTitle></CardHeader>
          <CardContent>
            {topNegativos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tudo coberto.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground"><tr><th className="text-left p-1">Item</th><th className="text-right p-1">Saldo</th></tr></thead>
                <tbody>
                  {topNegativos.map((x, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-1">{x.modelo} · {x.cor} · {x.tamanho}</td>
                      <td className="p-1 text-right text-red-700 font-bold tabular-nums">{x.saldo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Pedidos mais urgentes</CardTitle></CardHeader>
        <CardContent>
          {urgentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem urgências por data conhecida.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground"><tr>
                <th className="text-left p-1">Orçamento</th>
                <th className="text-left p-1">Pedido Olist</th>
                <th className="text-left p-1">Início estamp./acab.</th>
                <th className="text-left p-1">Limite (-2 d.ú.)</th>
              </tr></thead>
              <tbody>
                {urgentes.map(({ p, ancora }) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-1 font-mono">{p.orcamento ?? "—"}</td>
                    <td className="p-1 font-mono">{(p as any).pedido_olist ?? "—"}</td>
                    <td className="p-1">{ancora ?? "—"}</td>
                    <td className="p-1">{ancora ? addDiasUteis(ancora, -2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Para usar rotuloCop no futuro caso seja necessário no dashboard */}
      <div className="hidden">{rotuloCop(0, null)}</div>
    </div>
  );
}
