import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { REFACAO_TAMANHOS } from "@/lib/pedidos";
import {
  cfg, montarTinturaria, usePlanCruParado, usePlanEstoqueTingido, usePlanFichas, usePlanNaTinturaria,
} from "@/lib/plan";
import { CorChip, HorizonteSuprimentoSelect, usePlanLinhas } from "@/components/plan/NecessidadeTab";

const kg = (n: number) => `${Math.round(n).toLocaleString("pt-BR")} kg`;
const dataBr = (d: Date | null) => d ? d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" }) : "—";

export function TinturariaTab() {
  const { linhas, config, isLoading } = usePlanLinhas("suprimento");
  const fichas = usePlanFichas();
  const estoque = usePlanEstoqueTingido();
  const tint = usePlanNaTinturaria();
  const cru = usePlanCruParado();
  const [verTudo, setVerTudo] = useState(false);

  const sugestoes = useMemo(() => montarTinturaria({
    linhas, tamanhos: REFACAO_TAMANHOS, fichas: fichas.data ?? [], config,
    metrosEstoquePorCor: estoque.data?.porCor ?? new Map(),
    kgTinturariaPorCor: tint.data?.porCor ?? new Map(),
    cruTotal: cru.data?.total ?? 0,
  }), [linhas, fichas.data, config, estoque.data, tint.data, cru.data]);

  const carregando = isLoading || fichas.isLoading || estoque.isLoading || tint.isLoading || cru.isLoading;
  const acao = sugestoes.filter((s) => s.kgATingir > 0);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const tot = sugestoes.reduce((a, s) => ({
    pecas: a.pecas + s.pecas, nec: a.nec + s.kgNecessario, est: a.est + s.kgEstoque,
    tin: a.tin + s.kgTinturaria, ating: a.ating + s.kgATingir,
  }), { pecas: 0, nec: 0, est: 0, tin: 0, ating: 0 });

  const etapas: [string, number][] = [
    ["Fio", 10], ["Malharia", 15], ["Tinturaria", 15], ["Corte", 3], ["Oficina", 22],
  ];
  const ganho = cfg(config, "lead_time_completo_dias") - cfg(config, "lead_time_com_cru_dias");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold tracking-tight">O que mandar tingir</h2>
        <div className="flex flex-col items-end gap-1">
          <HorizonteSuprimentoSelect />
          <p className="text-xs text-muted-foreground">Horizonte longo porque a reposição completa leva 65 dias. Se o horizonte for menor que o ciclo, o aviso chega atrasado.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">Tecido necessário</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{carregando ? "…" : kg(tot.nec)}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">Já tingido em estoque</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{carregando ? "…" : kg(Array.from((estoque.data?.porCor ?? new Map()).values()).reduce((s, m) => s + m, 0) * cfg(config, "gramatura_g_por_metro") / 1000)}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">Na tinturaria agora</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{carregando ? "…" : kg(Array.from((tint.data?.porCor ?? new Map()).values()).reduce((s, m) => s + m, 0))}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">Cru parado para tingir</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{carregando ? "…" : kg(cru.data?.total ?? 0)}</div>
            <div className="mt-1 text-xs text-muted-foreground max-h-16 overflow-auto">
              {(cru.data?.porProd ?? []).map((p) => `PROD${p.numero} ${kg(p.kg)}`).join(" · ") || "Nenhum"}
            </div>
          </CardContent></Card>
      </div>

      <div className="space-y-2">
        {!carregando && acao.length === 0 && (
          <div className="rounded-md border bg-card p-4 text-sm">Tudo coberto no horizonte atual. Nenhuma cor precisa ir para a tinturaria agora.</div>
        )}
        {acao.map((s) => {
          const atrasado = s.decidirAte !== null && s.decidirAte < hoje;
          return (
            <div key={s.cor} className={`rounded-md border-2 bg-card p-3 flex flex-wrap items-center gap-x-4 gap-y-1 ${atrasado ? "border-red-600" : "border-border"}`}>
              <CorChip cor={s.cor} grande />
              <span className="text-lg font-bold">Mandar tingir {kg(s.kgATingir)}</span>
              <span className={s.temCru ? "text-green-700 font-medium" : "text-amber-700 font-medium"}>
                {s.temCru ? "Tem cru parado, dá para tingir já" : "Falta cru, precisa pedir fio antes"}
              </span>
              <span className={atrasado ? "text-red-700 font-bold" : "font-medium"}>
                {atrasado ? `Atrasado — era para decidir até ${dataBr(s.decidirAte)}` : `Decidir até ${dataBr(s.decidirAte)}`}
              </span>
              <span className="w-full text-sm text-muted-foreground">
                No ritmo atual o {s.cor} acaba em {Number.isFinite(s.diasRuptura) ? `${Math.round(s.diasRuptura)} dias` : "—"} e a reposição leva {s.leadTime}.
              </span>
            </div>
          );
        })}
      </div>

      <Button variant="outline" size="sm" onClick={() => setVerTudo((v) => !v)}>
        {verTudo ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
        Ver todas as cores
      </Button>
      {verTudo && (
        <div className="tbl-congelada max-h-[70vh] overflow-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead><tr>
              <th className="px-2 py-2 text-left">Cor</th>
              <th className="px-2 py-2 text-right">Peças</th>
              <th className="px-2 py-2 text-right">Kg necessários</th>
              <th className="px-2 py-2 text-right">Em estoque</th>
              <th className="px-2 py-2 text-right">Na tinturaria</th>
              <th className="px-2 py-2 text-right">A tingir</th>
              <th className="px-2 py-2 text-left">Decidir até</th>
            </tr></thead>
            <tbody>
              {sugestoes.map((s) => (
                <tr key={s.cor} className="border-t">
                  <td className="px-2 py-1"><CorChip cor={s.cor} /></td>
                  <td className="px-2 py-1 text-right tabular-nums">{s.pecas.toLocaleString("pt-BR")}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{kg(s.kgNecessario)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{kg(s.kgEstoque)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{kg(s.kgTinturaria)}</td>
                  <td className="px-2 py-1 text-right tabular-nums font-bold">{kg(s.kgATingir)}</td>
                  <td className="px-2 py-1">{s.kgATingir > 0 ? dataBr(s.decidirAte) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t font-bold">
              <td className="px-2 py-1">Total</td>
              <td className="px-2 py-1 text-right tabular-nums">{tot.pecas.toLocaleString("pt-BR")}</td>
              <td className="px-2 py-1 text-right tabular-nums">{kg(tot.nec)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{kg(tot.est)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{kg(tot.tin)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{kg(tot.ating)}</td>
              <td />
            </tr></tfoot>
          </table>
        </div>
      )}

      <div className="rounded-md border bg-card p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {etapas.map(([n, d], i) => (
            <span key={n} className="flex items-center gap-2">
              <span className="rounded bg-muted px-2 py-1"><b>{n}</b> {d} d</span>
              {i < etapas.length - 1 && <span>→</span>}
            </span>
          ))}
          <span className="ml-2 font-bold">Total {cfg(config, "lead_time_completo_dias")} dias</span>
          <span className="text-muted-foreground">· com cru parado: {cfg(config, "lead_time_com_cru_dias")} dias (economiza {ganho})</span>
        </div>
        <p className="mt-2 text-muted-foreground">São tempos normais de operação, sem atraso de fornecedor.</p>
      </div>
    </div>
  );
}
