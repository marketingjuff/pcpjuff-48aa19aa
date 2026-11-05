import { Fragment, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { REFACAO_TAMANHOS } from "@/lib/pedidos";
import {
  aplicarPausas, cfg, montarNecessidade, usePlanMinimos, usePlanConfig, usePlanCoresForaDeLinha, usePlanPausas, usePlanSaldoReal, usePlanVendaHistorica,
  type LinhaComPausa, type LinhaNecessidade, type PlanPausa,
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
  const minimosQ = usePlanMinimos();
  const minimos = minimosQ.error ? undefined : minimosQ.data;
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
      minimosAdotados: minimos,
    });
  }, [venda.data, saldo.data, horizonte, config, coresForaDeLinha.cores, coresForaDeLinha.isLoading, coresForaDeLinha.error, minimos]);
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
    isLoading: lc || saldo.isLoading || venda.isLoading || coresForaDeLinha.isLoading || minimosQ.isLoading,
    error: (coresForaDeLinha.error ?? venda.error) as Error | null,
  };
}

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

function SituacaoBadge({ dias, lead }: { dias: number; lead: number }) {
  if (dias < lead) return <Badge className="bg-red-600 text-white hover:bg-red-600">Crítico · {Number.isFinite(dias) ? `${Math.round(dias)} d` : "—"}</Badge>;
  if (dias < lead * 2) return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Atenção · {Math.round(dias)} d</Badge>;
  return <Badge className="bg-green-600 text-white hover:bg-green-600">Coberto{Number.isFinite(dias) ? ` · ${Math.round(dias)} d` : ""}</Badge>;
}

const fmtDataCurta = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
const fmtData = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

function somarDias(dias: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Pausar = ReturnType<typeof usePlanPausas>["pausar"];

function PausaPopover({ modelo, cor, pausar }: { modelo: string; cor: string; pausar: Pausar }) {
  const [open, setOpen] = useState(false);
  const [escolha, setEscolha] = useState<number | "sob_demanda" | null>(null);
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const confirmar = async () => {
    setErro(null);
    if (escolha === null) { setErro("Escolha um prazo ou sob demanda."); return; }
    try {
      await pausar.mutateAsync(escolha === "sob_demanda"
        ? { modelo, cor, tipo: "sob_demanda", ate: null, observacao: obs }
        : { modelo, cor, tipo: "adiado", ate: somarDias(escolha), observacao: obs });
      setOpen(false); setEscolha(null); setObs("");
    } catch (e: any) {
      setErro(e?.message ?? "Não foi possível salvar.");
    }
  };
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setErro(null); }}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Adiar ${modelo} ${cor}`} title="Adiar ou marcar sob demanda">
          <Clock className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div className="text-sm font-semibold">{modelo} · {cor}</div>
        <div className="grid grid-cols-4 gap-1">
          {[15, 30, 60, 90].map((d) => (
            <Button key={d} size="sm" variant={escolha === d ? "default" : "outline"} onClick={() => setEscolha(d)}>{d} dias</Button>
          ))}
        </div>
        <Button size="sm" className="w-full" variant={escolha === "sob_demanda" ? "secondary" : "outline"} onClick={() => setEscolha("sob_demanda")}>
          Sob demanda, sem prazo
        </Button>
        {typeof escolha === "number" && <p className="text-xs text-muted-foreground">Volta para a lista em {fmtData(somarDias(escolha))}.</p>}
        <Input placeholder="Motivo, opcional" value={obs} onChange={(e) => setObs(e.target.value)} />
        {erro && <p className="text-xs text-destructive">{erro}</p>}
        <Button size="sm" className="w-full" onClick={confirmar} disabled={pausar.isPending}>
          {pausar.isPending ? "Salvando…" : "Confirmar"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function BlocoPausadas({ titulo, linhas, retomar }: { titulo: string; linhas: LinhaComPausa[]; retomar: ReturnType<typeof usePlanPausas>["retomar"] }) {
  const [aberto, setAberto] = useState(false);
  if (linhas.length === 0) return null;
  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={() => setAberto((v) => !v)}>
        {aberto ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
        {titulo} ({linhas.length})
      </Button>
      {aberto && (
        <div className="rounded-md border bg-card overflow-auto">
          <table className="w-full text-sm">
            <thead><tr>
              <th className="px-2 py-2 text-left">Modelo</th>
              <th className="px-2 py-2 text-left">Cor</th>
              <th className="px-2 py-2 text-right">Sugestão sem pausa</th>
              <th className="px-2 py-2 text-left">Até</th>
              <th className="px-2 py-2 text-left">Observação</th>
              <th className="px-2 py-2" />
            </tr></thead>
            <tbody>{linhas.map((l) => (
              <tr key={`${l.modelo}|${l.cor}`} className="border-t">
                <td className="px-2 py-1">{l.modelo}</td>
                <td className="px-2 py-1"><CorChip cor={l.cor} /></td>
                <td className="px-2 py-1 text-right tabular-nums">{fmt(l.aProduzirSemPausa)} pç</td>
                <td className="px-2 py-1">{l.pausa?.tipo === "adiado" ? fmtData(l.pausa.ate) : "—"}</td>
                <td className="px-2 py-1 text-muted-foreground">{l.pausa?.observacao ?? ""}</td>
                <td className="px-2 py-1 text-right">
                  <Button size="sm" variant="outline" disabled={retomar.isPending} onClick={() => l.pausa && retomar.mutate(l.pausa.id)}>Retomar agora</Button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function tituloSelo(p: PlanPausa | null) {
  if (!p) return "";
  return p.tipo === "adiado" ? `Previsão adiada até ${fmtDataCurta(p.ate)}` : "Previsão suspensa, produto sob demanda";
}

export function NecessidadeTab() {
  const { linhas: linhasCruas, linhasForaDeLinha, config, naoMapeados, coresNaoReconhecidas, isLoading: carregandoLinhas, error } = usePlanLinhas("corte");
  const pausasQ = usePlanPausas();
  const isLoading = carregandoLinhas || pausasQ.isLoading;
  const { ativas: linhas, pausadas } = useMemo(() => {
    if (pausasQ.error) {
      return { ativas: linhasCruas.map((l) => ({ ...l, pausa: null, previsaoSuspensa: false, aProduzirSemPausa: l.aProduzir })) as LinhaComPausa[], pausadas: [] as LinhaComPausa[] };
    }
    return aplicarPausas({ linhas: linhasCruas, pausas: pausasQ.pausas, tamanhos: REFACAO_TAMANHOS });
  }, [linhasCruas, pausasQ.pausas, pausasQ.error]);
  const adiados = pausadas.filter((l) => l.pausa?.tipo === "adiado");
  const sobDemanda = pausadas.filter((l) => l.pausa?.tipo === "sob_demanda");
  const pecasFora = pausadas.reduce((s, l) => s + l.aProduzirSemPausa, 0)
    + linhas.reduce((s, l) => s + (l.previsaoSuspensa ? l.aProduzirSemPausa - l.aProduzir : 0), 0);
  const linhasFora = pausadas.length + linhas.filter((l) => l.previsaoSuspensa).length;
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
      {!isLoading && linhasFora > 0 && (
        <p className="text-xs text-muted-foreground">{fmt(pecasFora)} peças fora deste total, em {linhasFora} linhas adiadas ou sob demanda.</p>
      )}
      {pausasQ.error && <div className="rounded border border-destructive p-3 text-sm text-destructive">Não foi possível ler as linhas adiadas: {pausasQ.error.message}. Todas as linhas estão aparecendo com a sugestão cheia.</div>}

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
              <th className="px-2 py-2"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={REFACAO_TAMANHOS.length + 7} className="p-4 text-muted-foreground">Calculando…</td></tr>}
            {!isLoading && linhas.length === 0 && <tr><td colSpan={REFACAO_TAMANHOS.length + 7} className="p-4 text-muted-foreground">{error ? "Planejamento indisponível." : "Nada a produzir no horizonte."}</td></tr>}
            {linhas.map((l, index) => (
              <Fragment key={`${l.modelo}|${l.cor}`}>
              <tr className={index % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                <td rowSpan={3} className="border-b px-2 py-1 align-top whitespace-nowrap font-semibold">
                  {l.modelo}
                  {l.porMinimo > 0 && <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0" title="Parte desta sugestão existe para não ficar abaixo do estoque mínimo adotado">piso do mínimo</Badge>}
                  {l.previsaoSuspensa && <Badge className="ml-2 bg-amber-500 text-white hover:bg-amber-500" title={tituloSelo(l.pausa)}>Só pedido vendido</Badge>}
                </td>
                <td rowSpan={3} className="border-b px-2 py-1 align-top"><CorChip cor={l.cor} /></td>
                <td className="px-2 py-1 text-xs text-muted-foreground whitespace-nowrap">Pronto em estoque</td>
                {REFACAO_TAMANHOS.map((t) => (
                  <td key={t} className="px-2 py-1 text-right text-xs text-muted-foreground tabular-nums">{l.prontoPorTam[t] ?? 0}</td>
                ))}
                <td rowSpan={3} className="border-b px-2 py-1 align-top text-right tabular-nums font-bold">{l.aProduzir}</td>
                <td rowSpan={3} className="border-b px-2 py-1 align-top text-right tabular-nums">{fmt(l.jaVendido)}</td>
                <td rowSpan={3} className="border-b px-2 py-1 align-top"><SituacaoBadge dias={l.diasRuptura} lead={lead} /></td>
                <td rowSpan={3} className="border-b px-1 py-1 align-top"><PausaPopover modelo={l.modelo} cor={l.cor} pausar={pausasQ.pausar} /></td>
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
                    <td key={t} className={`px-2 py-1 text-right tabular-nums align-top ${firme > 0 ? "bg-amber-50" : ""} ${v === 0 ? "text-muted-foreground/40" : (l.porMinimoPorTam[t] ?? 0) > 0 ? "font-extrabold" : "font-semibold"}`}>
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

      <div className="flex flex-col gap-2">
        <BlocoPausadas titulo="Adiados" linhas={adiados} retomar={pausasQ.retomar} />
        <BlocoPausadas titulo="Sob demanda" linhas={sobDemanda} retomar={pausasQ.retomar} />
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
