import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { REFACAO_TAMANHOS } from "@/lib/pedidos";
import {
  cfg, montarNecessidade, usePlanConfig, usePlanSaldoReal, usePlanVendaHistorica,
  type LinhaNecessidade,
} from "@/lib/plan";

const HORIZONTES = [3, 5, 6] as const;
const LS_HORIZONTE = "plan:horizonte";

/** Horizonte de planejamento compartilhado entre as abas do PLAN. */
export function useHorizontePlan(): [number, (h: number) => void] {
  const { data: config } = usePlanConfig();
  const padrao = cfg(config, "horizonte_meses_padrao");
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const ler = () => {
      const s = Number(window.localStorage.getItem(LS_HORIZONTE));
      setH(HORIZONTES.includes(s as any) ? s : null);
    };
    ler();
    window.addEventListener("plan-horizonte", ler);
    return () => window.removeEventListener("plan-horizonte", ler);
  }, []);
  const set = (v: number) => {
    window.localStorage.setItem(LS_HORIZONTE, String(v));
    setH(v);
    window.dispatchEvent(new Event("plan-horizonte"));
  };
  return [h ?? padrao, set];
}

export function HorizonteSelect() {
  const [h, setH] = useHorizontePlan();
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Horizonte:</span>
      {HORIZONTES.map((v) => (
        <Button key={v} size="sm" variant={h === v ? "default" : "outline"} onClick={() => setH(v)}>
          {v} meses
        </Button>
      ))}
    </div>
  );
}

export function CorChip({ cor, grande = false }: { cor: string; grande?: boolean }) {
  const hex = corHex(cor);
  return (
    <span
      className={`inline-block rounded font-semibold whitespace-nowrap ${grande ? "px-3 py-1 text-base" : "px-2 py-0.5 text-xs"}`}
      style={{ backgroundColor: hex, color: corTextoSobre(hex) }}
    >
      {cor}
    </span>
  );
}

export function usePlanLinhas() {
  const { data: config, isLoading: lc } = usePlanConfig();
  const [horizonte] = useHorizontePlan();
  const saldo = usePlanSaldoReal();
  const venda = usePlanVendaHistorica();
  const linhas = useMemo(() => {
    if (!venda.data) return [] as LinhaNecessidade[];
    return montarNecessidade({
      tamanhos: REFACAO_TAMANHOS,
      saldoReal: saldo.data.saldoReal,
      emProducao: saldo.data.emProducao,
      mediaMensal: venda.data.mediaMensal,
      horizonteMeses: horizonte,
      semanasSeguranca: cfg(config, "semanas_seguranca"),
    });
  }, [venda.data, saldo.data, horizonte, config]);
  const naoMapeados = useMemo(() => {
    const m = new Map<string, number>();
    for (const [k, v] of venda.data?.naoMapeados ?? []) m.set(k, (m.get(k) ?? 0) + v);
    for (const [k, v] of saldo.data.naoMapeados) m.set(k, (m.get(k) ?? 0) + v);
    return m;
  }, [venda.data, saldo.data]);
  const coresNaoReconhecidas = useMemo(() => {
    const m = new Map<string, number>();
    for (const [k, v] of venda.data?.coresNaoReconhecidas ?? []) m.set(k, (m.get(k) ?? 0) + v);
    for (const [k, v] of saldo.data.coresNaoReconhecidas) m.set(k, (m.get(k) ?? 0) + v);
    return m;
  }, [venda.data, saldo.data]);
  return {
    linhas, config, horizonte,
    naoMapeados,
    coresNaoReconhecidas,
    isLoading: lc || saldo.isLoading || venda.isLoading,
    error: venda.error as Error | null,
  };
}

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

function SituacaoBadge({ dias, lead }: { dias: number; lead: number }) {
  if (dias < lead) return <Badge className="bg-red-600 text-white hover:bg-red-600">Crítico · {Number.isFinite(dias) ? `${Math.round(dias)} d` : "—"}</Badge>;
  if (dias < lead * 2) return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Atenção · {Math.round(dias)} d</Badge>;
  return <Badge className="bg-green-600 text-white hover:bg-green-600">Coberto{Number.isFinite(dias) ? ` · ${Math.round(dias)} d` : ""}</Badge>;
}

export function NecessidadeTab() {
  const { linhas, config, naoMapeados, coresNaoReconhecidas, isLoading, error } = usePlanLinhas();
  const [verConferencia, setVerConferencia] = useState(false);
  const lead = cfg(config, "lead_time_completo_dias");

  const totais = useMemo(() => {
    let estoque = 0, producao = 0, falta = 0;
    for (const l of linhas) {
      estoque += l.emEstoque;
      producao += l.emProducao;
      falta += l.aProduzir;
    }
    // Demanda = o que falta + o que já está coberto por estoque e produção.
    return { demanda: falta + estoque + producao, estoque, producao, falta };
  }, [linhas]);

  const naoMap = Array.from(naoMapeados.entries()).sort((a, b) => b[1] - a[1]);
  const coresFora = Array.from(coresNaoReconhecidas.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold tracking-tight">O que produzir</h2>
        <HorizonteSelect />
      </div>

      {error && <div className="rounded border border-destructive p-3 text-sm text-destructive">Erro ao ler vendas: {error.message}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Demanda do período", totais.demanda],
          ["Peça pronta em estoque", totais.estoque],
          ["Já em produção", totais.producao],
          ["Falta produzir", totais.falta],
        ].map(([l, v]) => (
          <Card key={l as string}>
            <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">{l}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{isLoading ? "…" : `${fmt(v as number)} pç`}</CardContent>
          </Card>
        ))}
      </div>

      {naoMap.length > 0 && (
        <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            {naoMap.length} produto(s) da Olist sem modelo ligado no De-para — {fmt(naoMap.reduce((s, x) => s + x[1], 0))} peças vendidas nos últimos 12 meses ficaram fora da conta.
          </div>
          <ul className="mt-2 max-h-40 overflow-auto grid sm:grid-cols-2 gap-x-6 text-amber-900">
            {naoMap.map(([p, q]) => <li key={p}>{p} — {fmt(q)} pç</li>)}
          </ul>
        </div>
      )}

      <div className="tbl-congelada max-h-[70vh] overflow-auto rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left">Modelo</th>
              <th className="px-2 py-2 text-left">Cor</th>
              {REFACAO_TAMANHOS.map((t) => <th key={t} className="px-2 py-2 text-right">{t}</th>)}
              <th className="px-2 py-2 text-right">Total</th>
              <th className="px-2 py-2 text-left">Situação</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={11} className="p-4 text-muted-foreground">Calculando…</td></tr>}
            {!isLoading && linhas.length === 0 && <tr><td colSpan={11} className="p-4 text-muted-foreground">Nada a produzir no horizonte.</td></tr>}
            {linhas.map((l) => (
              <Fragment key={`${l.modelo}|${l.cor}`}>
                {(["vendido", "previsto"] as const).map((orig, i) => {
                  const vals = l[orig];
                  const tot = REFACAO_TAMANHOS.reduce((s, t) => s + (vals[t] ?? 0), 0);
                  return (
                    <tr key={orig} className={orig === "previsto" ? "bg-muted/40 border-b" : "border-t"}>
                      <td className="px-2 py-1 whitespace-nowrap">
                        {i === 0 && <span className="font-semibold mr-2">{l.modelo}</span>}
                        <span className={`inline-block rounded border px-1.5 text-[11px] font-bold uppercase ${orig === "vendido" ? "border-foreground" : "border-dashed border-muted-foreground text-muted-foreground"}`}>
                          {orig === "vendido" ? "Vendido" : "Previsto"}
                        </span>
                      </td>
                      <td className="px-2 py-1">{i === 0 && <CorChip cor={l.cor} />}</td>
                      {REFACAO_TAMANHOS.map((t) => {
                        const v = vals[t] ?? 0;
                        return <td key={t} className={`px-2 py-1 text-right tabular-nums ${v === 0 ? "text-muted-foreground/40" : "font-semibold"}`}>{v}</td>;
                      })}
                      <td className="px-2 py-1 text-right tabular-nums font-bold">{tot}</td>
                      <td className="px-2 py-1">{i === 0 && <SituacaoBadge dias={l.diasRuptura} lead={lead} />}</td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <Button variant="outline" size="sm" onClick={() => setVerConferencia((v) => !v)}>
        {verConferencia ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
        Conferir a conta por modelo e cor
      </Button>
      {verConferencia && (
        <div className="tbl-congelada max-h-[70vh] overflow-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">Modelo</th>
                <th className="px-2 py-2 text-left">Cor</th>
                <th className="px-2 py-2 text-right">Venda prevista/mês</th>
                <th className="px-2 py-2 text-right">Já vendido</th>
                <th className="px-2 py-2 text-right">Em estoque</th>
                <th className="px-2 py-2 text-right">Em produção</th>
                <th className="px-2 py-2 text-right">A produzir</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={`${l.modelo}|${l.cor}`} className="border-t">
                  <td className="px-2 py-1">{l.modelo}</td>
                  <td className="px-2 py-1"><CorChip cor={l.cor} /></td>
                  <td className="px-2 py-1 text-right tabular-nums">{l.vendaPrevistaMensal.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt(l.jaVendido)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt(l.emEstoque)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt(l.emProducao)}</td>
                  <td className="px-2 py-1 text-right tabular-nums font-bold">{fmt(l.aProduzir)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground space-y-1">
        <p><b>Vendido</b>: peça que já foi vendida e não tem no estoque — é o número negativo da aba Disponível do COP. É pedido de verdade, tamanho certo.</p>
        <p><b>Previsto</b>: média de venda da Olist nos últimos 12 meses, vezes os meses escolhidos, mais {cfg(config, "semanas_seguranca")} semanas de segurança. Já tira o que sobra no Disponível. É estimativa: confira antes de cortar tamanhos que vendem pouco.</p>
        <p>O número em cada tamanho é o que falta cortar. Peça em estoque e peça já em produção já foram descontadas.</p>
      </div>
    </div>
  );
}
