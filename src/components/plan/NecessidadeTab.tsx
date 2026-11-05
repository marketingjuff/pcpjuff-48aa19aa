import { Fragment, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { REFACAO_TAMANHOS } from "@/lib/pedidos";
import {
  cfg, montarNecessidade, usePlanConfig, usePlanCoresForaDeLinha, usePlanSaldoReal, usePlanVendaHistorica,
  type LinhaNecessidade,
} from "@/lib/plan";

const HORIZONTES_SUPRIMENTO = [3, 5, 6] as const;
const HORIZONTES_CORTE = [1, 2, 3] as const;
const LS_HORIZONTE_SUPRIMENTO = "plan:horizonte";
const LS_HORIZONTE_CORTE = "plan:horizonte-corte";

function useHorizonteGenerico(
  opcoes: readonly number[], lsKey: string, evento: string, chaveCfg: string,
): [number, (h: number) => void] {
  const { data: config } = usePlanConfig();
  const padrao = cfg(config, chaveCfg);
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const ler = () => {
      const s = Number(window.localStorage.getItem(lsKey));
      setH(opcoes.includes(s) ? s : null);
    };
    ler();
    window.addEventListener(evento, ler);
    return () => window.removeEventListener(evento, ler);
  }, [opcoes, lsKey, evento]);
  const set = (v: number) => {
    window.localStorage.setItem(lsKey, String(v));
    setH(v);
    window.dispatchEvent(new Event(evento));
  };
  return [h ?? padrao, set];
}

/** Horizonte da sugestão de corte (aba O que produzir). */
export function useHorizonteCorte() {
  return useHorizonteGenerico(HORIZONTES_CORTE, LS_HORIZONTE_CORTE, "plan-horizonte-corte", "horizonte_corte_meses_padrao");
}

/** Horizonte de suprimento (aba Tinturaria). */
export function useHorizonteSuprimento() {
  return useHorizonteGenerico(HORIZONTES_SUPRIMENTO, LS_HORIZONTE_SUPRIMENTO, "plan-horizonte", "horizonte_meses_padrao");
}

function SeletorHorizonte({ rotulo, opcoes, h, setH }: { rotulo: string; opcoes: readonly number[]; h: number; setH: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      {opcoes.map((v) => (
        <Button key={v} size="sm" variant={h === v ? "default" : "outline"} onClick={() => setH(v)}>
          {v} {v === 1 ? "mês" : "meses"}
        </Button>
      ))}
    </div>
  );
}

export function HorizonteCorteSelect() {
  const [h, setH] = useHorizonteCorte();
  return <SeletorHorizonte rotulo="Cobrir corte por:" opcoes={HORIZONTES_CORTE} h={h} setH={setH} />;
}

export function HorizonteSuprimentoSelect() {
  const [h, setH] = useHorizonteSuprimento();
  return <SeletorHorizonte rotulo="Cobrir suprimento por:" opcoes={HORIZONTES_SUPRIMENTO} h={h} setH={setH} />;
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

export function usePlanLinhas(escopo: "corte" | "suprimento" = "corte") {
  const { data: config, isLoading: lc } = usePlanConfig();
  const [hCorte] = useHorizonteCorte();
  const [hSuprimento] = useHorizonteSuprimento();
  const horizonte = escopo === "corte" ? hCorte : hSuprimento;
  const saldo = usePlanSaldoReal();
  const venda = usePlanVendaHistorica();
  const coresForaDeLinha = usePlanCoresForaDeLinha();
  const todasLinhas = useMemo(() => {
    if (!venda.data || coresForaDeLinha.isLoading || coresForaDeLinha.error) return [] as LinhaNecessidade[];
    return montarNecessidade({
      tamanhos: REFACAO_TAMANHOS,
      saldoReal: saldo.data.saldoReal,
      prontoFisico: saldo.data.prontoFisico,
      emProducao: saldo.data.emProducao,
      mediaMensal: venda.data.mediaMensal,
      horizonteMeses: horizonte,
      semanasSeguranca: cfg(config, "semanas_seguranca"),
      coresForaDeLinha: coresForaDeLinha.cores,
    });
  }, [venda.data, saldo.data, horizonte, config, coresForaDeLinha.cores, coresForaDeLinha.isLoading, coresForaDeLinha.error]);
  const linhas = todasLinhas.filter((l) => !l.foraDeLinha);
  const linhasForaDeLinha = todasLinhas.filter((l) => l.foraDeLinha);
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
    linhas, linhasForaDeLinha, config, horizonte,
    naoMapeados,
    coresNaoReconhecidas,
    isLoading: lc || saldo.isLoading || venda.isLoading || coresForaDeLinha.isLoading,
    error: (coresForaDeLinha.error ?? venda.error) as Error | null,
  };
}

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

function SituacaoBadge({ dias, lead }: { dias: number; lead: number }) {
  if (dias < lead) return <Badge className="bg-red-600 text-white hover:bg-red-600">Crítico · {Number.isFinite(dias) ? `${Math.round(dias)} d` : "—"}</Badge>;
  if (dias < lead * 2) return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Atenção · {Math.round(dias)} d</Badge>;
  return <Badge className="bg-green-600 text-white hover:bg-green-600">Coberto{Number.isFinite(dias) ? ` · ${Math.round(dias)} d` : ""}</Badge>;
}

export function NecessidadeTab() {
  const { linhas, linhasForaDeLinha, config, naoMapeados, coresNaoReconhecidas, isLoading, error } = usePlanLinhas("corte");
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
        <div className="flex flex-col items-end gap-1">
          <HorizonteCorteSelect />
          <p className="text-xs text-muted-foreground">Horizonte curto porque cortar é rápido quando já existe tecido tingido. Quem decide tingir é a aba Tinturaria, que tem horizonte próprio.</p>
        </div>
      </div>

      {error && <div className="rounded border border-destructive p-3 text-sm text-destructive">Erro ao ler dados do planejamento: {error.message}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Demanda do período", totais.demanda],
          ["Peça pronta em estoque", totais.estoque],
          ["Já em produção", totais.producao],
          ["Falta produzir", totais.falta],
        ].map(([l, v]) => (
          <Card key={l as string}>
            <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">{l}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{error ? "—" : isLoading ? "…" : `${fmt(v as number)} pç`}</CardContent>
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

      {coresFora.length > 0 && (
        <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            {coresFora.length} cor(es) não reconhecida(s) — {fmt(coresFora.reduce((s, x) => s + x[1], 0))} peças ficaram fora dos totais.
          </div>
          <ul className="mt-2 max-h-40 overflow-auto grid sm:grid-cols-2 gap-x-6 text-amber-900">
            {coresFora.map(([c, q]) => <li key={c}>{c} — {fmt(q)} pç</li>)}
          </ul>
        </div>
      )}

      <div className="tbl-congelada max-h-[70vh] overflow-auto rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left">Modelo</th>
              <th className="px-2 py-2 text-left">Cor</th>
              <th className="px-2 py-2 text-left">Indicador</th>
              {REFACAO_TAMANHOS.map((t) => <th key={t} className="px-2 py-2 text-right">{t}</th>)}
              <th className="px-2 py-2 text-right">Total</th>
              <th className="px-2 py-2 text-right">Já vendido</th>
              <th className="px-2 py-2 text-left">Situação</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={REFACAO_TAMANHOS.length + 6} className="p-4 text-muted-foreground">Calculando…</td></tr>}
            {!isLoading && linhas.length === 0 && <tr><td colSpan={REFACAO_TAMANHOS.length + 6} className="p-4 text-muted-foreground">{error ? "Planejamento indisponível." : "Nada a produzir no horizonte."}</td></tr>}
            {linhas.map((l, index) => (
              <Fragment key={`${l.modelo}|${l.cor}`}>
              <tr className={index % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                <td rowSpan={3} className="border-b px-2 py-1 align-top whitespace-nowrap font-semibold">{l.modelo}</td>
                <td rowSpan={3} className="border-b px-2 py-1 align-top"><CorChip cor={l.cor} /></td>
                <td className="px-2 py-1 text-xs text-muted-foreground whitespace-nowrap">Pronto em estoque</td>
                {REFACAO_TAMANHOS.map((t) => (
                  <td key={t} className="px-2 py-1 text-right text-xs text-muted-foreground tabular-nums">{l.prontoPorTam[t] ?? 0}</td>
                ))}
                <td rowSpan={3} className="border-b px-2 py-1 align-top text-right tabular-nums font-bold">{l.aProduzir}</td>
                <td rowSpan={3} className="border-b px-2 py-1 align-top text-right tabular-nums">{fmt(l.jaVendido)}</td>
                <td rowSpan={3} className="border-b px-2 py-1 align-top"><SituacaoBadge dias={l.diasRuptura} lead={lead} /></td>
              </tr>
              <tr className={index % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                <td className="px-2 py-1 text-xs text-muted-foreground whitespace-nowrap">Em produção</td>
                {REFACAO_TAMANHOS.map((t) => (
                  <td key={t} className="px-2 py-1 text-right text-xs text-muted-foreground tabular-nums">{l.producaoPorTam[t] ?? 0}</td>
                ))}
              </tr>
              <tr className={`border-b ${index % 2 === 0 ? "bg-card" : "bg-muted/30"}`}>
                <td className="px-2 py-1 font-semibold whitespace-nowrap">Sugestão de corte</td>
                {REFACAO_TAMANHOS.map((t) => {
                  const v = l.aProduzirPorTam[t] ?? 0;
                  const firme = l.firmePorTam[t] ?? 0;
                  return (
                    <td key={t} className={`px-2 py-1 text-right tabular-nums align-top ${firme > 0 ? "bg-amber-50" : ""} ${v === 0 ? "text-muted-foreground/40" : "font-semibold"}`}>
                      {v}
                      {firme > 0 && <div className="text-[11px] font-normal text-amber-800">{firme} em falta</div>}
                    </td>
                  );
                })}
              </tr>
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
                <th className="px-2 py-2 text-right">
                  Em produção
                  <div className="text-[10px] font-normal text-muted-foreground normal-case">informativo — já está dentro do saldo, não desconta de novo</div>
                </th>
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

      {linhasForaDeLinha.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Cores fora de linha</h3>
          <p className="text-sm text-muted-foreground">Estas cores não entram no planejamento nem na sugestão de tingimento. Elas continuam no sistema e continuam vendendo até o estoque acabar. Para ativar de novo, vá em Parâmetros.</p>
          <div className="tbl-congelada max-h-[70vh] overflow-auto rounded-md border bg-card">
            <table className="w-full text-sm">
              <thead><tr>
                <th className="px-2 py-2 text-left">Modelo</th>
                <th className="px-2 py-2 text-left">Cor</th>
                <th className="px-2 py-2 text-right">Venda prevista/mês</th>
                <th className="px-2 py-2 text-right">Já vendido</th>
                <th className="px-2 py-2 text-right">Em estoque</th>
                <th className="px-2 py-2 text-right">Em produção<div className="text-[10px] font-normal text-muted-foreground normal-case">informativo — já está dentro do saldo, não desconta de novo</div></th>
                <th className="px-2 py-2 text-right">A produzir</th>
              </tr></thead>
              <tbody>{linhasForaDeLinha.map((l) => (
                <tr key={`${l.modelo}|${l.cor}`} className="border-t">
                  <td className="px-2 py-1">{l.modelo}</td>
                  <td className="px-2 py-1"><div className="flex flex-wrap items-center gap-2"><CorChip cor={l.cor} /><Badge variant="outline">Cor fora de linha</Badge></div></td>
                  <td className="px-2 py-1 text-right tabular-nums">{l.vendaPrevistaMensal.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt(l.jaVendido)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt(l.emEstoque)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt(l.emProducao)}</td>
                  <td className="px-2 py-1 text-right tabular-nums font-bold">{fmt(l.aProduzir)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground space-y-1">
        <p><b>Em falta</b> (fundo destacado na célula): peça já vendida e sem estoque — é o saldo real negativo. É pedido de verdade, tamanho certo.</p>
        <p><b>Previsto</b>: média de venda da Olist nos últimos 12 meses, vezes os meses escolhidos, mais {cfg(config, "semanas_seguranca")} semanas de segurança, descontando o que já existe no estoque (Saldo Real, igual à aba do COP). É estimativa: confira antes de cortar tamanhos que vendem pouco.</p>
        <p>O número da linha Sugestão de corte é o que falta cortar, somando o que já foi vendido e está em falta com o previsto para o horizonte. Peça pronta e peça em produção já estão descontadas, não precisa descontar de novo.</p>
      </div>
    </div>
  );
}
