import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFeriados } from "@/hooks/use-feriados";
import type { Cop, Oficina } from "@/lib/cop";
import { useEstoquePecas } from "@/lib/map";
import { periodoAnterior, periodoDoPreset, type PresetPeriodo } from "@/lib/kpi-pcp";
import {
  calcularTudo,
  opcoesFiltro,
  variacao,
  type ItemRanking,
  type KpiCopMapFiltro,
  type Metrica,
  type Tempo,
} from "@/lib/kpi-cop-map";
import { ChipCor, KpiCopMapDrill, type ColunasCop, type DrillCopSpec } from "@/components/kpi/KpiCopMapDrill";

const CHAVE = "kpi:copmap:filtros";
type Abrir = (d: DrillCopSpec) => void;

type Faixa = "corte" | "tecido" | "costura" | "dinheiro" | "ponta";
const COR: Record<Faixa, { borda: string; faixa: string; texto: string }> = {
  corte: { borda: "border-emerald-500", faixa: "bg-emerald-500/10", texto: "text-emerald-700" },
  tecido: { borda: "border-amber-400", faixa: "bg-amber-400/10", texto: "text-amber-700" },
  costura: { borda: "border-green-800", faixa: "bg-green-800/10", texto: "text-green-900" },
  dinheiro: { borda: "border-teal-500", faixa: "bg-teal-500/10", texto: "text-teal-700" },
  ponta: { borda: "border-slate-400", faixa: "bg-slate-400/10", texto: "text-slate-700" },
};

const COL_PECAS: ColunasCop = { oficina: true, modelo: true, cor: true, tamanho: true, qtd: true, fim: true, nota: true };
const COL_COP: ColunasCop = { oficina: true, qtd: true, fim: true, nota: true };
const COL_TEMPO: ColunasCop = { oficina: true, qtd: true, inicio: true, fim: true, dias: true };
const COL_METROS: ColunasCop = { oficina: true, modelo: true, cor: true, qtd: true, metros: true, inicio: true, nota: true };
const COL_VALOR: ColunasCop = { oficina: true, qtd: true, valor: true, inicio: true, fim: true, nota: true };

function Bloco({ titulo, apoio, faixa, children }: { titulo: string; apoio: string; faixa: Faixa; children: React.ReactNode }) {
  const c = COR[faixa];
  return (
    <section className={`space-y-3 rounded-xl border-l-4 ${c.borda} ${c.faixa} p-3 sm:p-4`}>
      <div>
        <h2 className={`font-display text-lg font-semibold tracking-tight ${c.texto}`}>{titulo}</h2>
        <p className="text-xs text-muted-foreground">{apoio}</p>
      </div>
      {children}
    </section>
  );
}

function Rodape({ data }: { data: string }) {
  return <p className="mt-2 border-t pt-1 text-[10px] text-muted-foreground">Data usada: {data}</p>;
}

function Kpi({
  titulo, apoio, m, data, abrir, colunas, variacao: v, selo, extra,
}: {
  titulo: string; apoio: string; m: Metrica; data: string; abrir: Abrir; colunas: ColunasCop;
  variacao?: number | null; selo?: string; extra?: string;
}) {
  const vazio = m.valor == null || m.linhas.length === 0;
  return (
    <Card
      className={`h-full ${vazio ? "" : "cursor-pointer transition hover:ring-2 hover:ring-primary/40"}`}
      onClick={vazio ? undefined : () => abrir({ titulo, apoio, linhas: m.linhas, colunas, total: m.total })}
      role={vazio ? undefined : "button"}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          {titulo}
          {selo && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent-foreground">{selo}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className={`font-display text-2xl font-semibold tabular-nums ${vazio ? "" : "underline decoration-dotted underline-offset-4"}`}>
            {vazio ? (m.valor === 0 ? "0" : "—") : m.texto}
          </span>
          {!vazio && v != null && (
            <span className={`text-xs font-semibold tabular-nums ${v >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {v >= 0 ? "+" : ""}{v.toFixed(1).replace(".", ",")}% vs. período anterior
            </span>
          )}
        </div>
        {extra && <p className="mt-1 text-xs font-medium">{extra}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{apoio}</p>
        <Rodape data={data} />
      </CardContent>
    </Card>
  );
}

function KpiTempo({ titulo, apoio, t, data, abrir }: { titulo: string; apoio: string; t: Tempo; data: string; abrir: Abrir }) {
  return (
    <Kpi titulo={titulo} apoio={apoio} m={t} data={data} abrir={abrir} colunas={COL_TEMPO}
      extra={t.valor == null ? undefined : `Metade dos casos ficou abaixo disso. 8 em cada 10 casos ficaram até ${t.textoP80}.`} />
  );
}

function Ranking({
  titulo, apoio, itens, data, abrir, colunas, cor, coluna = "Peças", selo, rodapeExtra,
}: {
  titulo: string; apoio: string; itens: ItemRanking[]; data: string; abrir: Abrir; colunas: ColunasCop;
  cor?: boolean; coluna?: string; selo?: string; rodapeExtra?: string;
}) {
  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          {titulo}
          {selo && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent-foreground">{selo}</span>}
        </div>
        <p className="mb-2 text-xs text-muted-foreground">{apoio}</p>
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <div className="tbl-congelada max-h-[70vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead></TableHead><TableHead className="text-right">{coluna}</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((it) => (
                  <TableRow key={it.chave}>
                    <TableCell>{cor ? <ChipCor cor={it.chave} /> : it.chave}</TableCell>
                    <TableCell className="text-right">
                      <button type="button" className="tabular-nums underline decoration-dotted underline-offset-4 hover:text-primary"
                        onClick={() => abrir({ titulo: `${titulo} — ${it.chave}`, apoio, linhas: it.linhas, colunas, total: it.total })}>
                        {it.texto}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {rodapeExtra && <p className="mt-2 text-xs text-muted-foreground">{rodapeExtra}</p>}
        <Rodape data={data} />
      </CardContent>
    </Card>
  );
}

type Salvo = { preset: PresetPeriodo; de: string; ate: string; oficinaId: string; modelo: string; cor: string; comparar: boolean };

export function KpiCopMapTab() {
  const ini = periodoDoPreset("mes");
  const [s, setS] = useState<Salvo>({ preset: "mes", ...ini, oficinaId: "todos", modelo: "todos", cor: "todos", comparar: false });
  const [carregado, setCarregado] = useState(false);
  const [drill, setDrill] = useState<DrillCopSpec | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHAVE);
      if (raw) {
        const v = JSON.parse(raw) as Salvo;
        const per = v.preset !== "livre" ? periodoDoPreset(v.preset) : { de: v.de, ate: v.ate };
        setS({ ...v, ...per });
      }
    } catch { /* ignora */ }
    setCarregado(true);
  }, []);
  useEffect(() => {
    if (carregado) window.localStorage.setItem(CHAVE, JSON.stringify(s));
  }, [s, carregado]);

  const copsQ = useQuery({
    queryKey: ["cops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cops" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Cop[];
    },
  });
  const ofQ = useQuery({
    queryKey: ["oficinas-kpi-copmap"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oficinas" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Oficina[];
    },
  });
  const tecidoQ = useEstoquePecas();
  const { feriados } = useFeriados();

  const cops = copsQ.data ?? [];
  const oficinas = useMemo(() => [...(ofQ.data ?? [])].sort((a, b) => a.nome.localeCompare(b.nome)), [ofQ.data]);
  const tecido = tecidoQ.data ?? [];
  const opcoes = useMemo(() => opcoesFiltro(cops), [cops]);

  const filtro: KpiCopMapFiltro = { de: s.de, ate: s.ate, oficinaId: s.oficinaId, modelo: s.modelo, cor: s.cor };
  const r = useMemo(() => calcularTudo(cops, oficinas, tecido, feriados, filtro),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cops, oficinas, tecido, feriados, s.de, s.ate, s.oficinaId, s.modelo, s.cor]);
  const ant = useMemo(() => {
    if (!s.comparar) return null;
    const p = periodoAnterior(s.de, s.ate);
    return calcularTudo(cops, oficinas, tecido, feriados, { ...filtro, ...p });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.comparar, cops, oficinas, tecido, feriados, s.de, s.ate, s.oficinaId, s.modelo, s.cor]);
  const vr = (a: Metrica, b?: Metrica) => (ant && b ? variacao(a.valor, b.valor) : null);

  const abrir: Abrir = setDrill;
  const set = (p: Partial<Salvo>) => setS((x) => ({ ...x, ...p }));

  if (copsQ.isLoading || ofQ.isLoading || tecidoQ.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  const { corte, tecido: tc, costura, dinheiro, ponta } = r;
  const DT_CORTE = "dia em que o corte foi feito";
  const DT_TEC = "dia de cada corte lançado na peça de tecido";
  const DT_ENV = "dia em que o romaneio saiu para a oficina";
  const DT_REC = "dia de cada chegada da oficina";
  const DT_PER = "dia em que a perda foi lançada";
  const DT_PAG = "dia do pagamento — só oficinas de fora";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <Label>Período</Label>
            <Select value={s.preset} onValueChange={(v) => {
              const p = v as PresetPeriodo;
              set(p === "livre" ? { preset: p } : { preset: p, ...periodoDoPreset(p) });
            }}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês</SelectItem>
                <SelectItem value="mes_passado">Mês passado</SelectItem>
                <SelectItem value="90d">90 dias</SelectItem>
                <SelectItem value="ano">Ano</SelectItem>
                <SelectItem value="livre">Livre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>De</Label>
            <Input type="date" className="h-9 w-[150px]" value={s.de} onChange={(e) => set({ preset: "livre", de: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Até</Label>
            <Input type="date" className="h-9 w-[150px]" value={s.ate} onChange={(e) => set({ preset: "livre", ate: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Oficina</Label>
            <Select value={s.oficinaId} onValueChange={(v) => set({ oficinaId: v })}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {oficinas.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Modelo</Label>
            <Select value={s.modelo} onValueChange={(v) => set({ modelo: v })}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {opcoes.modelos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Cor</Label>
            <Select value={s.cor} onValueChange={(v) => set({ cor: v })}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {opcoes.cores.map((c) => <SelectItem key={c} value={c}><ChipCor cor={c} /></SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="flex h-9 items-center gap-2 text-sm">
            <Checkbox checked={s.comparar} onCheckedChange={(v) => set({ comparar: !!v })} />
            Comparar com o período anterior
          </label>
        </CardContent>
      </Card>

      <Bloco faixa="corte" titulo="Corte" apoio="O que a mesa de corte entregou no período.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi titulo="COPs cortados" apoio="Quantos COPs tiveram o corte feito." m={corte.copsCortados} data={DT_CORTE} abrir={abrir} colunas={COL_COP} variacao={vr(corte.copsCortados, ant?.corte.copsCortados)} />
          <Kpi titulo="Peças cortadas" apoio="Soma das peças desses COPs." m={corte.pecas} data={DT_CORTE} abrir={abrir} colunas={COL_PECAS} variacao={vr(corte.pecas, ant?.corte.pecas)} />
          <Kpi titulo="Peças por COP" apoio="Em média, quantas peças cada COP teve." m={corte.mediaPorCop} data={DT_CORTE} abrir={abrir} colunas={COL_COP} variacao={vr(corte.mediaPorCop, ant?.corte.mediaPorCop)} />
          <Kpi titulo="Cortes divididos" apoio="COPs cujo corte foi dividido em partes." m={corte.divididos} data={DT_CORTE} abrir={abrir} colunas={COL_COP} />
          <KpiTempo titulo="Do pedido de risco até o corte" apoio="Dias úteis entre pedir o risco e cortar." t={corte.tRisco} data={DT_CORTE} abrir={abrir} />
          <KpiTempo titulo="Corte parado esperando oficina" apoio="Dias úteis entre cortar e mandar o romaneio." t={corte.tParado} data={DT_CORTE} abrir={abrir} />
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Ranking titulo="Peças cortadas por modelo" apoio="Quais modelos mais passaram pelo corte." itens={corte.porModelo} data={DT_CORTE} abrir={abrir} colunas={COL_PECAS} />
          <Ranking titulo="Peças cortadas por cor" apoio="Quais cores mais passaram pelo corte." itens={corte.porCor} data={DT_CORTE} abrir={abrir} colunas={COL_PECAS} cor />
          <Ranking titulo="Peças cortadas por tamanho" apoio="Do menor para o maior tamanho." itens={corte.porTamanho} data={DT_CORTE} abrir={abrir} colunas={COL_PECAS} />
          <Ranking titulo="Quem cortou — peças" apoio="Peças cortadas por pessoa." itens={corte.quemPorPecas} data={DT_CORTE} abrir={abrir} colunas={COL_PECAS} />
          <Ranking titulo="Quem cortou — COPs" apoio="COPs cortados por pessoa." itens={corte.quemPorCops} data={DT_CORTE} abrir={abrir} colunas={COL_COP} coluna="COPs" />
          <Ranking titulo="Fila de corte agora" apoio={`Não depende do período. ${corte.filaTotal.texto} COPs esperando. Obs. mostra dias corridos desde o último passo.`}
            itens={corte.filaPorStatus} data="situação de hoje" abrir={abrir} colunas={{ oficina: true, qtd: true, inicio: true, dias: true, nota: true }} coluna="COPs" />
        </div>
      </Bloco>

      <Bloco faixa="tecido" titulo="Tecido" apoio="Quanto tecido o corte consumiu.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi titulo="Metros consumidos" apoio="Metros lançados nos cortes." m={tc.metros} data={DT_TEC} abrir={abrir} colunas={COL_METROS} variacao={vr(tc.metros, ant?.tecido.metros)} />
          <Kpi titulo="Rendimento" apoio="Metros gastos para cada peça cortada." m={tc.rendimento} data={DT_TEC} abrir={abrir} colunas={COL_METROS} variacao={vr(tc.rendimento, ant?.tecido.rendimento)} />
          <Kpi titulo="Peças de tecido abertas" apoio="Rolos que começaram a ser usados." m={tc.abertas} data="dia em que a peça de tecido foi aberta" abrir={abrir} colunas={{ cor: true, metros: true, inicio: true, nota: true }} />
          <Kpi titulo="Peças de tecido que acabaram" apoio="Rolos usados até o fim." m={tc.zeradas} data="dia do último corte na peça de tecido" abrir={abrir} colunas={{ cor: true, metros: true, inicio: true, nota: true }} />
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Ranking titulo="Metros por cor" apoio="Cor da peça de tecido." itens={tc.porCor} data={DT_TEC} abrir={abrir} colunas={COL_METROS} coluna="Metros" cor />
          <Ranking titulo="Metros por modelo" selo="estimativa" apoio="O tecido é lançado por COP, não por modelo; dividimos pela quantidade de peças de cada modelo." itens={tc.porModeloRateado} data={DT_TEC} abrir={abrir} colunas={COL_METROS} coluna="Metros" />
          <Ranking titulo="Metros por modelo" selo="número exato" apoio="Só COPs com um único modelo." itens={tc.porModeloExato} data={DT_TEC} abrir={abrir} colunas={COL_METROS} coluna="Metros" />
          <Ranking titulo="Rendimento por modelo" selo="estimativa" apoio="Metros por peça de cada modelo." itens={tc.rendPorModelo} data={DT_TEC} abrir={abrir} colunas={COL_METROS} coluna="m/peça" />
        </div>
      </Bloco>

      <Bloco faixa="costura" titulo="Costura" apoio="O que foi e voltou das oficinas, contando também a costura dentro de casa.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi titulo="Peças enviadas" apoio="Peças que saíram para as oficinas." m={costura.enviadas} data={DT_ENV} abrir={abrir} colunas={{ ...COL_PECAS, fim: false, inicio: true }} variacao={vr(costura.enviadas, ant?.costura.enviadas)} />
          <Kpi titulo="Peças recebidas" apoio="Cada chegada conta no dia dela." m={costura.recebidas} data={DT_REC} abrir={abrir} colunas={COL_PECAS} variacao={vr(costura.recebidas, ant?.costura.recebidas)} />
          <Kpi titulo="Faltando chegar" apoio="Romaneios que saíram no período e ainda não voltaram inteiros." m={costura.divergencia} data={DT_ENV} abrir={abrir} colunas={{ oficina: true, qtd: true, inicio: true, nota: true }} />
          <Kpi titulo="Peças perdidas" apoio="Perdas lançadas; correções e perdas desfeitas já descontadas." m={costura.perdas} data={DT_PER} abrir={abrir} colunas={COL_PECAS} variacao={vr(costura.perdas, ant?.costura.perdas)} />
          <KpiTempo titulo="Tempo na oficina" apoio="Dias úteis da saída até a última chegada." t={costura.tempo} data="dia da última chegada" abrir={abrir} />
          <Kpi titulo="Costurado dentro de casa" apoio="Peças recebidas da oficina da Juff." m={costura.interna} data={DT_REC} abrir={abrir} colunas={COL_PECAS} variacao={vr(costura.interna, ant?.costura.interna)} />
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Ranking titulo="Peças recebidas por oficina" apoio="Quem mais devolveu peças prontas." itens={costura.porOficina} data={DT_REC} abrir={abrir} colunas={COL_PECAS} />
          <Ranking titulo="Modelos mais costurados" apoio="Pelas peças recebidas." itens={costura.porModelo} data={DT_REC} abrir={abrir} colunas={COL_PECAS} />
          <Ranking titulo="Cores mais costuradas" apoio="Pelas peças recebidas." itens={costura.porCor} data={DT_REC} abrir={abrir} colunas={COL_PECAS} cor />
          <Ranking titulo="Tamanhos costurados" apoio="Do menor para o maior." itens={costura.porTamanho} data={DT_REC} abrir={abrir} colunas={COL_PECAS} />
          <Ranking titulo="Tempo na oficina por oficina" apoio="Metade dos romaneios de cada oficina voltou até esse tempo." itens={costura.tempoPorOficina} data="dia da última chegada" abrir={abrir} colunas={COL_TEMPO} coluna="Dias úteis" />
          <Ranking titulo="Perdas por oficina" apoio="Peças perdidas em cada oficina." itens={costura.perdasPorOficina} data={DT_PER} abrir={abrir} colunas={COL_PECAS} />
          <Ranking titulo="Perdas por motivo" apoio="Por que as peças foram perdidas." itens={costura.perdasPorMotivo} data={DT_PER} abrir={abrir} colunas={COL_PECAS} />
          <Ranking titulo="Perdas por modelo, cor e tamanho" apoio="Qual peça mais se perde." itens={costura.perdasPorPeca} data={DT_PER} abrir={abrir} colunas={COL_PECAS} />
        </div>
      </Bloco>

      <Bloco faixa="dinheiro" titulo="Dinheiro" apoio="Pagamentos às oficinas de fora. A oficina da Juff não entra aqui.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi titulo="Valor pago" apoio="Soma paga às oficinas." m={dinheiro.valor} data={DT_PAG} abrir={abrir} colunas={COL_VALOR} variacao={vr(dinheiro.valor, ant?.dinheiro.valor)} />
          <Kpi titulo="Custo por peça" apoio="Valor pago dividido pelas peças recebidas desses COPs." m={dinheiro.custoPorPeca} data={DT_PAG} abrir={abrir} colunas={COL_VALOR} variacao={vr(dinheiro.custoPorPeca, ant?.dinheiro.custoPorPeca)} />
          <Kpi titulo="Fretes" apoio="Quantidade de fretes vezes o valor do frete da oficina." m={dinheiro.fretes} data={DT_PAG} abrir={abrir} colunas={COL_VALOR} variacao={vr(dinheiro.fretes, ant?.dinheiro.fretes)} />
          <Kpi titulo="Liberado e ainda não pago" apoio="Não depende do período: o que está esperando pagamento hoje." m={dinheiro.liberado} data="situação de hoje — só oficinas de fora" abrir={abrir} colunas={COL_VALOR} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Ranking titulo="Valor por oficina" apoio="Quanto cada oficina recebeu." itens={dinheiro.porOficina} data={DT_PAG} abrir={abrir} colunas={COL_VALOR} coluna="Valor" />
          <Ranking titulo="Custo médio por modelo" apoio="Pelo valor cadastrado de cada oficina." itens={dinheiro.custoPorModelo} data={DT_PAG} abrir={abrir}
            colunas={{ oficina: true, modelo: true, cor: true, tamanho: true, qtd: true, valor: true, nota: true }} coluna="Por peça"
            rodapeExtra={dinheiro.semValorPecas > 0 ? `Ficaram fora da conta ${dinheiro.semValorPecas.toLocaleString("pt-BR")} peças sem valor cadastrado na oficina: ${dinheiro.semValorTexto}.` : undefined} />
        </div>
      </Bloco>

      <Bloco faixa="ponta" titulo="Ponta a ponta" apoio="Do pedido de risco até a peça pronta de volta.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiTempo titulo="Tempo total" apoio="Dias úteis do pedido de risco até a chegada final, só de COPs que voltaram inteiros no período." t={ponta.tempoTotal} data="dia da chegada final" abrir={abrir} />
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-semibold text-muted-foreground">Caminho do período</div>
            <p className="text-xs text-muted-foreground">Do tecido cortado até as peças que voltaram ou se perderam.</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {ponta.funil.map((it, i) => (
                <button key={it.chave} type="button" className="rounded-md border bg-background p-3 text-left hover:ring-2 hover:ring-primary/40"
                  onClick={() => abrir({ titulo: it.chave, apoio: "Mesmo número do card do bloco correspondente.", linhas: it.linhas, colunas: i === 0 ? COL_METROS : COL_PECAS, total: it.total })}>
                  <div className="text-xs text-muted-foreground">{it.chave}</div>
                  <div className="font-display text-xl font-semibold tabular-nums underline decoration-dotted underline-offset-4">{it.texto}</div>
                </button>
              ))}
            </div>
            <Rodape data="cada número usa a data do seu bloco" />
          </CardContent>
        </Card>
      </Bloco>

      <KpiCopMapDrill spec={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
