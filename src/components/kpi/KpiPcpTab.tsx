import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFeriados } from "@/hooks/use-feriados";
import { TIPOS_ESTAMPA, VENDEDORES, type Pedido } from "@/lib/pedidos";
import {
  detalhePessoa,
  detalhePorDia,
  estamparia,
  filtrarPedidos,
  linhaPedido,
  pecasPorPessoaPorDia,
  periodoAnterior,
  periodoDoPreset,
  pessoasDoPedido,
  porPessoa,
  promessaDeData,
  resumoPeriodo,
  retrabalho,
  situacaoAgora,
  tempoBloco,
  type CampoPessoa,
  type DrillLinha,
  type EtapaTempo,
  type Feriados,
  type KpiFiltro,
  type PresetPeriodo,
} from "@/lib/kpi-pcp";
import { KpiPcpDrill, type DrillSpec } from "@/components/kpi/KpiPcpDrill";

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Abrir = (d: DrillSpec) => void;

/* Totais do pop-up — mesma conta e mesmo formato do card. */
const soma = (l: DrillLinha[], k: "pecas" | "batidas" | "valor") => l.reduce((s, x) => s + (Number(x[k]) || 0), 0);
const tPedidos = (l: DrillLinha[]) => `${nf.format(l.length)} pedidos`;
const tPecas = (l: DrillLinha[]) => `${nf.format(soma(l, "pecas"))} peças em ${nf.format(l.length)} pedidos`;
const tBatidas = (l: DrillLinha[]) => `${nf.format(soma(l, "batidas"))} batidas em ${nf.format(l.length)} pedidos`;
const tMediaDias = (l: DrillLinha[]) =>
  l.length ? `${nf1.format(l.reduce((s, x) => s + (x.dias ?? 0), 0) / l.length)} dias (média de ${nf.format(l.length)} pedidos)` : "—";
const tPerc = (l: DrillLinha[], rotulo: string) => {
  const ok = l.filter((x) => x.ok).length;
  return l.length ? `${nf1.format((ok / l.length) * 100)}% — ${nf.format(ok)} de ${nf.format(l.length)} ${rotulo}` : "—";
};

type EtapaCor = "geral" | "arte" | "dtf" | "silk" | "acabamento" | "expedicao";
const COR: Record<EtapaCor, { borda: string; faixa: string; texto: string }> = {
  geral: { borda: "border-etapa-geral", faixa: "bg-etapa-geral/10", texto: "text-etapa-geral" },
  arte: { borda: "border-etapa-arte", faixa: "bg-etapa-arte/10", texto: "text-etapa-arte" },
  dtf: { borda: "border-etapa-dtf", faixa: "bg-etapa-dtf/10", texto: "text-etapa-dtf" },
  silk: { borda: "border-etapa-silk", faixa: "bg-etapa-silk/10", texto: "text-etapa-silk" },
  acabamento: { borda: "border-etapa-acabamento", faixa: "bg-etapa-acabamento/10", texto: "text-etapa-acabamento" },
  expedicao: { borda: "border-etapa-expedicao", faixa: "bg-etapa-expedicao/10", texto: "text-etapa-expedicao" },
};

function Kpi({
  titulo,
  apoio,
  valor,
  vazio,
  variacao,
  onClick,
}: {
  titulo: string;
  apoio: string;
  valor: string | null;
  vazio?: string;
  variacao?: number | null;
  onClick?: () => void;
}) {
  const clicavel = !!onClick && valor != null;
  return (
    <Card
      className={`h-full ${clicavel ? "cursor-pointer transition hover:ring-2 hover:ring-primary/40" : ""}`}
      onClick={clicavel ? onClick : undefined}
      role={clicavel ? "button" : undefined}
      title={clicavel ? "Clique para ver os pedidos" : undefined}
    >
      <CardContent className="p-4">
        <div className="text-sm font-semibold text-muted-foreground">{titulo}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className={`font-display text-2xl font-semibold tabular-nums ${clicavel ? "underline decoration-dotted underline-offset-4" : ""}`}>{valor ?? "—"}</span>
          {valor != null && variacao != null && (
            <span className={`text-xs font-semibold tabular-nums ${variacao >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {variacao >= 0 ? "+" : ""}
              {nf1.format(variacao)}% vs. período anterior
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{valor == null && vazio ? vazio : apoio}</p>
      </CardContent>
    </Card>
  );
}

/** Número clicável dentro de tabela. */
function Num({ children, onClick, className = "" }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  if (!onClick) return <span className={className}>{children}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tabular-nums underline decoration-dotted underline-offset-4 hover:text-primary ${className}`}
      title="Clique para ver os pedidos"
    >
      {children}
    </button>
  );
}

function Bloco({ titulo, apoio, etapa = "geral", children }: { titulo: string; apoio?: string; etapa?: EtapaCor; children: React.ReactNode }) {
  const c = COR[etapa];
  return (
    <section className={`space-y-3 rounded-xl border-l-4 ${c.borda} ${c.faixa} p-3 sm:p-4`}>
      <div>
        <h2 className={`font-display text-lg font-semibold tracking-tight ${c.texto}`}>{titulo}</h2>
        {apoio && <p className="text-xs text-muted-foreground">{apoio}</p>}
      </div>
      {children}
    </section>
  );
}

function Sub({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{titulo}</h3>
      {children}
    </div>
  );
}

const CAMPOS_PESSOA: Record<CampoPessoa, { titulo: string; batidas: boolean }> = {
  quem_bateu_silk: { titulo: "Quem mais bateu Silk", batidas: true },
  quem_bateu_dtf: { titulo: "Quem mais bateu DTF", batidas: true },
  quem_cortou_dtf: { titulo: "Quem cortou DTF", batidas: false },
  quem_revelou_tela: { titulo: "Quem revelou tela", batidas: false },
  responsavel_acabamento: { titulo: "Quem fez o acabamento", batidas: false },
  responsavel_conferencia: { titulo: "Quem conferiu", batidas: false },
};

function CardPessoa({ regs, campo, feriados, abrir }: { regs: Pedido[]; campo: CampoPessoa; feriados: Feriados; abrir: Abrir }) {
  const { titulo, batidas } = CAMPOS_PESSOA[campo];
  const linhas = porPessoa(regs, campo);
  const abrirPessoa = (nome: string, modo: "pedidos" | "valor") => {
    const l = detalhePessoa(regs, campo, nome, feriados);
    abrir({
      titulo: `${titulo} — ${nome}`,
      linhas: l,
      colunas: { batidas: batidas ? "Batidas da pessoa" : undefined, datas: true, dias: true },
      total: modo === "pedidos" ? tPedidos(l) : batidas ? tBatidas(l) : tPecas(l),
      apoio: "Pedidos dessa pessoa nessa etapa. Quando mais de uma pessoa trabalhou no pedido, a linha mostra \"dividido\".",
    });
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pessoa</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">{batidas ? "Batidas" : "Peças"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={l.pessoa}>
                <TableCell>
                  {l.pessoa}
                  {batidas
                    ? l.batidasEstimadas && (
                        <span className="block text-[11px] text-muted-foreground">Batidas divididas igualmente entre quem bateu o pedido.</span>
                      )
                    : l.estimado && (
                        <span className="block text-[11px] text-muted-foreground">Número dividido igualmente — o pedido não registrou quanto cada um fez.</span>
                      )}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  <Num onClick={() => abrirPessoa(l.pessoa, "pedidos")}>{nf.format(l.pedidos)}</Num>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  <Num onClick={() => abrirPessoa(l.pessoa, "valor")}>{nf.format(batidas ? l.batidas : l.pecas)}</Num>
                </TableCell>
              </TableRow>
            ))}
            {linhas.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-sm text-muted-foreground">Sem registro no período.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CardPorDia({ regs, feriados, abrir, campos, titulo = "Peças por pessoa por dia" }: { regs: Pedido[]; feriados: Feriados; abrir: Abrir; campos?: CampoPessoa[]; titulo?: string }) {
  const linhas = pecasPorPessoaPorDia(regs, feriados, campos);
  const ab = (nome: string, modo: "pecas" | "dias" | "media") => {
    const l = detalhePorDia(regs, nome, campos);
    const dias = new Set(l.map((x) => x.fim).filter(Boolean)).size;
    const pecas = soma(l, "pecas");
    abrir({
      titulo: `${titulo} — ${nome}`,
      linhas: l,
      colunas: { datas: true },
      total:
        modo === "pecas"
          ? `${nf.format(pecas)} peças`
          : modo === "dias"
            ? `${nf.format(dias)} dias com pedido`
            : `${nf1.format(dias ? pecas / dias : 0)} peças por dia (${nf.format(pecas)} peças em ${nf.format(dias)} dias)`,
      apoio: "O dia de cada pedido é a data de saída (ou de entrada, se ainda não saiu). Peças divididas igualmente entre quem trabalhou.",
    });
  };
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
        <p className="text-xs text-muted-foreground">
          Média de peças que cada pessoa entregou por dia útil trabalhado. Número aproximado: o sistema não registra jornada.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Pessoa</TableHead><TableHead className="text-right">Peças</TableHead><TableHead className="text-right">Dias</TableHead><TableHead className="text-right">Média/dia</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={l.pessoa}>
                <TableCell>{l.pessoa}</TableCell>
                <TableCell className="text-right font-semibold"><Num onClick={() => ab(l.pessoa, "pecas")}>{nf.format(l.pecas)}</Num></TableCell>
                <TableCell className="text-right font-semibold"><Num onClick={() => ab(l.pessoa, "dias")}>{nf.format(l.dias)}</Num></TableCell>
                <TableCell className="text-right font-semibold"><Num onClick={() => ab(l.pessoa, "media")}>{nf1.format(l.media)}</Num></TableCell>
              </TableRow>
            ))}
            {linhas.length === 0 && <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">Sem registro no período.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function abrirEtapaTempo(e: EtapaTempo, abrir: Abrir, modo: "real" | "plan" | "pedidos") {
  const l = e.linhas;
  const comPlan = l.filter((x) => x.valor != null);
  const real = l.length ? l.reduce((s, x) => s + (x.dias ?? 0), 0) / l.length : null;
  const plan = comPlan.length ? soma(comPlan, "valor") / comPlan.length : null;
  const partes = [
    modo === "pedidos" ? tPedidos(l) : null,
    real != null ? `Real médio ${nf1.format(real)} d` : null,
    plan != null ? `Planejado médio ${nf1.format(plan)} d` : null,
  ].filter(Boolean);
  abrir({
    titulo: `Planejado vs. real — ${e.etapa}`,
    linhas: l,
    colunas: { valor: "Planejado (d)", datas: true, dias: true },
    total: partes.join(" · ") || "—",
    apoio: "Início e fim são as datas reais da etapa. Dias úteis é o que levou de fato; Planejado é o prazo do Input de Produção.",
  });
}

function TabelaPvR({ etapas, abrir }: { etapas: EtapaTempo[]; abrir: Abrir }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Etapa</TableHead>
          <TableHead className="text-right">Planejado</TableHead>
          <TableHead className="text-right">Real</TableHead>
          <TableHead className="text-right">Diferença</TableHead>
          <TableHead className="text-right">Sugestão (P80)</TableHead>
          <TableHead className="text-right">Pedidos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {etapas.map((e) => {
          const esconde = e.amostraPequena;
          const dia = (v: number | null) => (esconde || v == null ? "—" : `${nf1.format(v)} d`);
          const dif = esconde || e.diferenca == null ? "—" : `${e.diferenca >= 0 ? "+" : "−"}${nf1.format(Math.abs(e.diferenca))} d`;
          const difCor = esconde || e.diferenca == null ? "" : e.diferenca >= 0 ? "text-emerald-600" : "text-red-600";
          const ab = (m: "real" | "plan" | "pedidos") => (e.n > 0 ? () => abrirEtapaTempo(e, abrir, m) : undefined);
          return (
            <TableRow key={e.etapa}>
              <TableCell>{e.etapa}</TableCell>
              <TableCell className="text-right font-semibold"><Num onClick={esconde ? undefined : ab("plan")}>{dia(e.planejadoMedio)}</Num></TableCell>
              <TableCell className="text-right font-semibold"><Num onClick={esconde ? undefined : ab("real")}>{dia(e.realMedio)}</Num></TableCell>
              <TableCell className={`text-right font-semibold tabular-nums ${difCor}`}>{dif}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {esconde || e.realP80 == null ? "—" : `${nf.format(Math.ceil(e.realP80))} d`}
              </TableCell>
              <TableCell className={`text-right font-semibold ${esconde ? "text-muted-foreground" : ""}`}>
                <Num onClick={ab("pedidos")}>{nf.format(e.n)}</Num>
                {esconde && " (poucos)"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

const areaEtapa = (area: string): string => {
  const a = area.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (a.includes("arte")) return "Arte";
  if (a.includes("dtf")) return "DTF";
  if (a.includes("silk")) return "Silk";
  if (a.includes("acab") || a.includes("confer")) return "Acabamento";
  if (a.includes("exped")) return "Expedição";
  return area;
};

export function KpiPcpTab() {
  const { feriados } = useFeriados();
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pedidos").select("*").order("entrada_pedido", { ascending: false });
      if (error) throw error;
      return data as unknown as Pedido[];
    },
  });

  const [preset, setPreset] = useState<PresetPeriodo>("mes");
  const inicial = periodoDoPreset("mes");
  const [de, setDe] = useState(inicial.de);
  const [ate, setAte] = useState(inicial.ate);
  const [comparar, setComparar] = useState(false);
  const [base, setBase] = useState<"entrada" | "saida" | "finalizado">("saida");
  const [vendedor, setVendedor] = useState("todos");
  const [tipoEstampa, setTipoEstampa] = useState("todos");
  const [pessoa, setPessoa] = useState("todos");

  function aplicarPreset(p: PresetPeriodo) {
    setPreset(p);
    if (p !== "livre") {
      const r = periodoDoPreset(p);
      setDe(r.de);
      setAte(r.ate);
    }
  }

  const pessoasDisponiveis = useMemo(
    () => [...new Set(pedidos.flatMap(pessoasDoPedido))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [pedidos],
  );

  const filtro: KpiFiltro = { de, ate, base, vendedor, tipoEstampa, pessoa };
  const regs = useMemo(() => filtrarPedidos(pedidos, filtro), [pedidos, de, ate, base, vendedor, tipoEstampa, pessoa]);
  const anterior = useMemo(() => {
    if (!comparar) return [] as Pedido[];
    const per = periodoAnterior(de, ate);
    return filtrarPedidos(pedidos, { ...filtro, de: per.de, ate: per.ate });
  }, [pedidos, comparar, de, ate, base, vendedor, tipoEstampa, pessoa]);

  const resumo = useMemo(() => resumoPeriodo(regs, feriados), [regs, feriados]);
  const resumoAnt = useMemo(() => (comparar ? resumoPeriodo(anterior, feriados) : null), [anterior, comparar, feriados]);
  const est = useMemo(() => estamparia(regs), [regs]);
  const tempos = useMemo(() => tempoBloco(regs, feriados), [regs, feriados]);
  const agora = useMemo(() => situacaoAgora(pedidos, feriados), [pedidos, feriados]);
  const erros = useMemo(() => retrabalho(regs, resumo.pecasProduzidas), [regs, resumo.pecasProduzidas]);
  const promessa = useMemo(() => promessaDeData(regs, feriados, de, ate), [regs, feriados, de, ate]);
  const [drill, setDrill] = useState<DrillSpec | null>(null);

  const variacao = (atual: number | null, ant: number | null | undefined): number | null => {
    if (!comparar || atual == null || ant == null || ant === 0) return null;
    return ((atual - ant) / ant) * 100;
  };

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  const abrir: Abrir = setDrill;

  /* ---------- helpers de etapa ---------- */
  const et = (nome: string) => tempos.etapas.filter((e) => e.etapa === nome);
  const errosDa = (etapa: string) => erros.porArea.filter((a) => areaEtapa(a.area) === etapa);
  const correcoesDa = (etapa: string) => erros.correcoesPorAba.filter((c) => c.aba === etapa);
  const filasDe = (rotulos: string[]) => agora.filas.filter((f) => rotulos.includes(f.rotulo));

  const abrirArea = (a: (typeof erros.porArea)[number], modo: "ocorr" | "refeitas" | "perdidas") =>
    abrir({
      titulo: `Onde o erro aconteceu — ${a.area}`,
      linhas: a.itens,
      colunas: { batidas: "Peças refeitas", valor: "Perdidas" },
      total:
        modo === "ocorr"
          ? `${nf.format(a.itens.length)} ocorrências`
          : modo === "refeitas"
            ? `${nf.format(soma(a.itens, "batidas"))} peças refeitas`
            : `${nf.format(soma(a.itens, "valor"))} peças perdidas`,
      apoio: "Cada linha é uma refação registrada no pedido.",
    });
  const abrirCorrecao = (c: (typeof erros.correcoesPorAba)[number]) =>
    abrir({ titulo: `Correções feitas depois — ${c.aba}`, linhas: c.itens, colunas: { valor: "Correções" }, total: `${nf.format(c.qtd)} correções` });

  const TabelaErros = ({ areas }: { areas: typeof erros.porArea }) => (
    <Table>
      <TableHeader><TableRow><TableHead>Área</TableHead><TableHead className="text-right">Ocorrências</TableHead><TableHead className="text-right">Peças refeitas</TableHead><TableHead className="text-right">Perdidas</TableHead></TableRow></TableHeader>
      <TableBody>
        {areas.map((a) => (
          <TableRow key={a.area}>
            <TableCell>{a.area}</TableCell>
            <TableCell className="text-right font-semibold"><Num onClick={() => abrirArea(a, "ocorr")}>{nf.format(a.episodios)}</Num></TableCell>
            <TableCell className="text-right font-semibold"><Num onClick={() => abrirArea(a, "refeitas")}>{nf.format(a.pecas)}</Num></TableCell>
            <TableCell className="text-right font-semibold"><Num onClick={() => abrirArea(a, "perdidas")}>{nf.format(a.perdidas)}</Num></TableCell>
          </TableRow>
        ))}
        {areas.length === 0 && <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">Nenhuma refação no período.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
  const TabelaCorrecoes = ({ itens }: { itens: typeof erros.correcoesPorAba }) => (
    <Table>
      <TableHeader><TableRow><TableHead>Aba</TableHead><TableHead className="text-right">Correções</TableHead></TableRow></TableHeader>
      <TableBody>
        {itens.map((c) => (
          <TableRow key={c.aba}>
            <TableCell>{c.aba}</TableCell>
            <TableCell className="text-right font-semibold"><Num onClick={() => abrirCorrecao(c)}>{nf.format(c.qtd)}</Num></TableCell>
          </TableRow>
        ))}
        {itens.length === 0 && <TableRow><TableCell colSpan={2} className="text-sm text-muted-foreground">Nenhuma correção no período.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );

  const ErrosEtapa = ({ etapa }: { etapa: string }) => (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Erros nessa área</CardTitle></CardHeader>
        <CardContent><TabelaErros areas={errosDa(etapa)} /></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Correções feitas depois nessa aba</CardTitle></CardHeader>
        <CardContent><TabelaCorrecoes itens={correcoesDa(etapa)} /></CardContent>
      </Card>
    </div>
  );

  const PvREtapa = ({ nomes }: { nomes: string[] }) => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Planejado vs. real</CardTitle></CardHeader>
      <CardContent><TabelaPvR etapas={nomes.flatMap(et)} abrir={abrir} /></CardContent>
    </Card>
  );

  const Filas = ({ rotulos }: { rotulos: string[] }) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {filasDe(rotulos).map((f) => (
        <Kpi
          key={f.rotulo}
          titulo={f.titulo ?? `Pedidos parados agora — ${f.rotulo}`}
          apoio={f.apoio ?? "Foto de hoje, não depende do período."}
          valor={nf.format(f.pedidos)}
          onClick={() => abrir({ titulo: f.titulo ?? `Pedidos parados — ${f.rotulo}`, linhas: f.itens, colunas: { datas: true }, total: tPedidos(f.itens), apoio: "Início = entrada do pedido · Fim = data combinada." })}
        />
      ))}
    </div>
  );

  /* ---------- estamparia por lado ---------- */
  const Estampa = ({ lado }: { lado: "DTF" | "Silk" }) => {
    const tiposLado = lado === "DTF" ? ["DTF", "DTF+Silk"] : ["Silk", "DTF+Silk"];
    const batidasDe = (p: Pedido) => Number(lado === "DTF" ? p.n_batidas_dtf : p.n_batidas_silk) || 0;
    const tipoDe = (p: Pedido) => (p.tipo_estampa ?? "—").trim() || "—";
    const linhasLado = (lista: Pedido[]) =>
      lista
        .filter((p) => batidasDe(p) > 0 || tiposLado.includes(tipoDe(p)))
        .map((p) => linhaPedido(p, { batidas: batidasDe(p), pecas: tiposLado.includes(tipoDe(p)) ? Number(p.qtd) || 0 : 0 }));
    const total = lado === "DTF" ? est.batidasDtf : est.batidasSilk;
    const razao = lado === "DTF" ? est.batidasPorPecaDtf : est.batidasPorPecaSilk;
    const totalPecas = est.porTipo.reduce((s, t) => s + t.pecas, 0);
    const abrirLado = (lista: Pedido[], titulo: string, modo: "batidas" | "pecas" | "razao") => {
      const l = linhasLado(lista);
      const b = soma(l, "batidas");
      const pc = soma(l, "pecas");
      abrir({
        titulo,
        linhas: l,
        colunas: { batidas: `Batidas ${lado}` },
        total:
          modo === "batidas"
            ? `${nf.format(b)} batidas`
            : modo === "pecas"
              ? `${nf.format(pc)} peças ${lado}`
              : `${pc ? nf2.format(b / pc) : "—"} batidas por peça (${nf.format(b)} batidas ÷ ${nf.format(pc)} peças)`,
        apoio: `Peças contam só em pedidos ${tiposLado.join(" ou ")}.`,
      });
    };
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <Kpi titulo={`Batidas de ${lado} no período`} apoio={`Soma das batidas registradas no ${lado}.`} valor={nf.format(total)} onClick={() => abrirLado(regs, `Batidas de ${lado}`, "batidas")} />
          <Kpi
            titulo={`Batidas por peça (${lado})`}
            apoio="Quanto mais alto, mais trabalhoso foi cada peça. Serve para comparar meses com a mesma quantidade de peças mas trabalho diferente."
            valor={razao == null ? null : nf2.format(razao)}
            vazio={`Nenhuma peça de ${lado} no período.`}
            onClick={() => abrirLado(regs, `Batidas por peça (${lado})`, "razao")}
          />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Peças de {lado} por tipo de estampa</CardTitle>
              <p className="text-xs text-muted-foreground">"DTF+Silk" aparece nos blocos DTF e Silk. O % é sobre todas as peças do período.</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead className="text-right">Pedidos</TableHead><TableHead className="text-right">Peças</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
                <TableBody>
                  {est.porTipo.filter((t) => tiposLado.includes(t.tipo)).map((t) => {
                    const ab = (m: "pedidos" | "pecas") => () => {
                      const l = regs.filter((p) => tipoDe(p) === t.tipo).map((p) => linhaPedido(p));
                      abrir({ titulo: `Pedidos ${t.tipo}`, linhas: l, total: m === "pedidos" ? tPedidos(l) : `${nf.format(soma(l, "pecas"))} peças (${nf1.format(totalPecas ? (soma(l, "pecas") / totalPecas) * 100 : 0)}% do período)` });
                    };
                    return (
                      <TableRow key={t.tipo}>
                        <TableCell>{t.tipo}</TableCell>
                        <TableCell className="text-right font-semibold"><Num onClick={ab("pedidos")}>{nf.format(t.pedidos)}</Num></TableCell>
                        <TableCell className="text-right font-semibold"><Num onClick={ab("pecas")}>{nf.format(t.pecas)}</Num></TableCell>
                        <TableCell className="text-right font-semibold"><Num onClick={ab("pecas")}>{nf1.format(t.perc)}%</Num></TableCell>
                      </TableRow>
                    );
                  })}
                  {!est.porTipo.some((t) => tiposLado.includes(t.tipo)) && <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">Nenhum pedido no período.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Batidas de {lado} mês a mês</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Batidas</TableHead><TableHead className="text-right">Peças {lado}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {est.porMes.map((m) => (
                    <TableRow key={m.mes}>
                      <TableCell>{m.mes}</TableCell>
                      <TableCell className="text-right font-semibold"><Num onClick={() => abrirLado(m.itens, `Batidas de ${lado} — ${m.mes}`, "batidas")}>{nf.format(lado === "DTF" ? m.dtf : m.silk)}</Num></TableCell>
                      <TableCell className="text-right font-semibold"><Num onClick={() => abrirLado(m.itens, `Peças ${lado} — ${m.mes}`, "pecas")}>{nf.format(lado === "DTF" ? m.pecasDtf : m.pecasSilk)}</Num></TableCell>
                    </TableRow>
                  ))}
                  {est.porMes.length === 0 && <TableRow><TableCell colSpan={3} className="text-sm text-muted-foreground">Nenhum pedido no período.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-8">
      {/* Filtros */}
      <div className="sticky top-[68px] z-40 -mx-3 sm:-mx-4 border-b bg-card px-3 sm:px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Label className="text-xs">Período</Label>
            <Select value={preset} onValueChange={(v) => aplicarPreset(v as PresetPeriodo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Este mês</SelectItem>
                <SelectItem value="mes_passado">Mês passado</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="ano">Este ano</SelectItem>
                <SelectItem value="livre">Livre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={de} onChange={(e) => { setDe(e.target.value); setPreset("livre"); }} className="w-[150px]" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={ate} onChange={(e) => { setAte(e.target.value); setPreset("livre"); }} className="w-[150px]" />
          </div>
          <div className="w-52">
            <Label className="text-xs">Contar pelo quê</Label>
            <Select value={base} onValueChange={(v) => setBase(v as "entrada" | "saida" | "finalizado")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Data de entrada do pedido</SelectItem>
                <SelectItem value="saida">Data de saída da Juff</SelectItem>
                <SelectItem value="finalizado">Data de finalização do pedido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Label className="text-xs">Vendedor</Label>
            <Select value={vendedor} onValueChange={setVendedor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {VENDEDORES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Label className="text-xs">Tipo de estampa</Label>
            <Select value={tipoEstampa} onValueChange={setTipoEstampa}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {TIPOS_ESTAMPA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Label className="text-xs">Pessoa</Label>
            <Select value={pessoa} onValueChange={setPessoa}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {pessoasDisponiveis.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Checkbox checked={comparar} onCheckedChange={(v) => setComparar(!!v)} />
            Comparar com o período anterior
          </label>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Entrada mostra o que chegou no período. Saída mostra o que saiu da Juff no período. Finalização mostra o que foi finalizado na produção no período.
        </p>
      </div>

      {/* ================= GERAL ================= */}
      <Bloco titulo="Geral" apoio="O que vale para o pedido inteiro, sem olhar etapa. Clique em qualquer número para ver os pedidos." etapa="geral">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi
            titulo="Quantidade de pedidos"
            apoio="Pedidos que ficaram prontos no período."
            valor={nf.format(resumo.pedidosFinalizados)}
            variacao={variacao(resumo.pedidosFinalizados, resumoAnt?.pedidosFinalizados)}
            onClick={() => abrir({ titulo: "Quantidade de pedidos", linhas: resumo.itens.finalizados, colunas: { datas: true }, total: tPedidos(resumo.itens.finalizados) })}
          />
          <Kpi
            titulo="Peças produzidas"
            apoio="Total de peças desses pedidos."
            valor={nf.format(resumo.pecasProduzidas)}
            variacao={variacao(resumo.pecasProduzidas, resumoAnt?.pecasProduzidas)}
            onClick={() => abrir({ titulo: "Peças produzidas", linhas: resumo.itens.finalizados, total: tPecas(resumo.itens.finalizados) })}
          />
          <Kpi
            titulo="Tempo médio do pedido"
            apoio="Da entrada do pedido até ele sair da Juff, em dias úteis."
            valor={resumo.tempoMedio == null ? null : `${nf1.format(resumo.tempoMedio)} dias`}
            vazio="Nenhum pedido do período tem entrada e saída registradas."
            variacao={variacao(resumo.tempoMedio, resumoAnt?.tempoMedio)}
            onClick={() => abrir({ titulo: "Tempo médio do pedido", linhas: resumo.itens.prazo, colunas: { datas: true, dias: true }, total: tMediaDias(resumo.itens.prazo), apoio: "Início = entrada · Fim = saída da Juff." })}
          />
          <Kpi
            titulo="Entregas no prazo"
            apoio="De cada 100 pedidos, quantos saíram até a data combinada."
            valor={resumo.percNoPrazo == null ? null : `${nf1.format(resumo.percNoPrazo)}%`}
            vazio="Nenhum pedido do período tem data combinada e saída registradas."
            variacao={variacao(resumo.percNoPrazo, resumoAnt?.percNoPrazo)}
            onClick={() => abrir({ titulo: "Entregas no prazo", linhas: resumo.itens.comData, colunas: { datas: true, dias: true }, total: tPerc(resumo.itens.comData, "saíram no prazo"), apoio: "Início = data combinada · Fim = saída da Juff · Dias = atraso." })}
          />
          <Kpi
            titulo="Atraso médio"
            apoio="Quando atrasa, atrasa em média esse tanto de dias úteis."
            valor={resumo.atrasoMedio == null ? null : `${nf1.format(resumo.atrasoMedio)} dias`}
            vazio="Nenhum pedido saiu fora do prazo no período."
            variacao={variacao(resumo.atrasoMedio, resumoAnt?.atrasoMedio)}
            onClick={() => abrir({ titulo: "Atraso médio", linhas: resumo.itens.atraso, colunas: { datas: true, dias: true }, total: tMediaDias(resumo.itens.atraso), apoio: "Início = data combinada · Fim = saída da Juff." })}
          />
          <Kpi
            titulo="Pedidos que precisaram refazer peça"
            apoio="Pedidos em que alguma peça teve que ser feita de novo."
            valor={resumo.percComRefacao == null ? null : `${nf1.format(resumo.percComRefacao)}%`}
            vazio="Nenhum pedido no período."
            variacao={variacao(resumo.percComRefacao, resumoAnt?.percComRefacao)}
            onClick={() => abrir({ titulo: "Pedidos que precisaram refazer peça", linhas: resumo.itens.todos, total: tPerc(resumo.itens.todos, "pedidos refizeram peça") })}
          />
        </div>

        <Sub titulo="A data que a gente promete">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              titulo="Pedidos que tiveram a data de entrega adiada"
              apoio="Mostra se a data que a gente promete no começo é a data que a gente cumpre no fim."
              valor={promessa.percAdiados == null ? null : `${nf1.format(promessa.percAdiados)}%`}
              vazio="Nenhum pedido do período tem data combinada."
              onClick={() => abrir({ titulo: "Pedidos com data adiada", linhas: promessa.itens.comData, colunas: { datas: true, dias: true }, total: tPerc(promessa.itens.comData, "pedidos adiados"), apoio: "Início = primeira data prometida · Fim = data atual." })}
            />
            <Kpi
              titulo="Dias que a data foi empurrada"
              apoio="Média de dias úteis entre a primeira data prometida e a data atual."
              valor={promessa.diasEmpurradosMedio == null ? null : `${nf1.format(promessa.diasEmpurradosMedio)} dias`}
              vazio="Nenhuma data foi adiada no período."
              onClick={() => abrir({ titulo: "Dias que a data foi empurrada", linhas: promessa.itens.adiados, colunas: { datas: true, dias: true }, total: tMediaDias(promessa.itens.adiados) })}
            />
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="text-sm font-semibold text-muted-foreground">Entraram × Saíram</div>
                <div className="mt-1 font-display text-2xl font-semibold">
                  <Num onClick={() => abrir({ titulo: "Entraram no período", linhas: promessa.itens.entraram, colunas: { datas: true }, total: tPedidos(promessa.itens.entraram) })}>{nf.format(promessa.entraram)}</Num>
                  {" × "}
                  <Num onClick={() => abrir({ titulo: "Saíram no período", linhas: promessa.itens.sairam, colunas: { datas: true }, total: tPedidos(promessa.itens.sairam) })}>{nf.format(promessa.sairam)}</Num>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Se entra mais do que sai por vários períodos seguidos, a fila está aumentando.</p>
              </CardContent>
            </Card>
            <Kpi
              titulo="Tempo médio de secagem"
              apoio="Dias registrados de secagem nos pedidos do período."
              valor={promessa.secagemMedia == null ? null : `${nf1.format(promessa.secagemMedia)} dias`}
              vazio="Nenhum pedido do período registrou secagem."
              onClick={() => abrir({ titulo: "Tempo de secagem", linhas: promessa.itens.secagem, colunas: { dias: true }, total: tMediaDias(promessa.itens.secagem) })}
            />
          </div>
        </Sub>

        <Sub titulo="Situação de agora — foto de hoje, não depende do período">
          <Filas rotulos={agora.filas.map((f) => f.rotulo)} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi titulo="Pedidos atrasados" apoio="A data combinada já passou e o pedido não saiu." valor={nf.format(agora.atrasados.length)}
              onClick={() => { const l = agora.atrasados.map((a) => a.linha); abrir({ titulo: "Pedidos atrasados", linhas: l, colunas: { datas: true, dias: true }, total: tPedidos(l), apoio: "Início = data combinada · Dias = atraso até hoje." }); }} />
            <Kpi titulo="Pedidos vencendo" apoio="Faltam até 3 dias úteis para a data combinada." valor={nf.format(agora.vencendo.length)}
              onClick={() => { const l = agora.vencendo.map((a) => a.linha); abrir({ titulo: "Pedidos vencendo", linhas: l, colunas: { datas: true, dias: true }, total: tPedidos(l), apoio: "Dias = quanto falta até a data combinada." }); }} />
            <Kpi
              titulo="Há quanto tempo os pedidos estão na casa"
              apoio="Se esse número sobe, a fila está crescendo."
              valor={agora.idadeMedia == null ? null : `${nf1.format(agora.idadeMedia)} dias`}
              vazio="Nenhum pedido aberto com data de entrada."
              onClick={() => abrir({ titulo: "Pedidos na casa", linhas: agora.idades, colunas: { datas: true, dias: true }, total: tMediaDias(agora.idades) })}
            />
          </div>
          <p className="text-xs text-muted-foreground">Um pedido DTF+Silk aparece nas duas filas, em DTF e em Silk.</p>
        </Sub>

        <Sub titulo="Tempo dos pedidos">
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Tempo médio do pedido mês a mês</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Pedidos</TableHead><TableHead className="text-right">Dias úteis</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {tempos.porMes.map((m) => (
                      <TableRow key={m.mes}>
                        <TableCell>{m.mes}</TableCell>
                        <TableCell className="text-right font-semibold"><Num onClick={() => abrir({ titulo: `Pedidos que saíram em ${m.mes}`, linhas: m.itens, colunas: { datas: true, dias: true }, total: tPedidos(m.itens) })}>{nf.format(m.pedidos)}</Num></TableCell>
                        <TableCell className="text-right font-semibold"><Num onClick={() => abrir({ titulo: `Tempo médio — ${m.mes}`, linhas: m.itens, colunas: { datas: true, dias: true }, total: tMediaDias(m.itens) })}>{m.medio == null ? "—" : nf1.format(m.medio)}</Num></TableCell>
                      </TableRow>
                    ))}
                    {tempos.porMes.length === 0 && <TableRow><TableCell colSpan={3} className="text-sm text-muted-foreground">Sem pedidos com saída no período.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Quanto tempo os pedidos levaram</CardTitle>
                <p className="text-xs text-muted-foreground">Mostra se tem pedido demorando muito mais que a média.</p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Faixa</TableHead><TableHead className="text-right">Pedidos</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {tempos.faixas.map((f) => {
                      const ab = () => abrir({ titulo: `Pedidos que levaram ${f.faixa.toLowerCase()}`, linhas: f.itens, colunas: { datas: true, dias: true }, total: `${tPedidos(f.itens)} (${nf1.format(f.perc)}%)` });
                      return (
                        <TableRow key={f.faixa}>
                          <TableCell>{f.faixa}</TableCell>
                          <TableCell className="text-right font-semibold"><Num onClick={ab}>{nf.format(f.pedidos)}</Num></TableCell>
                          <TableCell className="text-right font-semibold"><Num onClick={ab}>{nf1.format(f.perc)}%</Num></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </Sub>

        <Sub titulo="Planejado vs. Real — todas as etapas">
          <p className="text-xs text-muted-foreground">Compara o prazo planejado no Input de Produção com o que a produção levou de fato. Pedidos com refação ficam de fora.</p>
          <p className={tempos.cobertura.perc < 50 ? "text-xs text-amber-600" : "text-xs text-muted-foreground"}>
            {nf.format(tempos.cobertura.elegiveis)} de {nf.format(tempos.cobertura.total)} pedidos do período têm a cadeia de
            datas completa e sem refação ({nf1.format(tempos.cobertura.perc)}%).
            {tempos.cobertura.perc < 50 && " Com essa cobertura, os números abaixo são indicativos — vale conferir se as datas estão sendo preenchidas na hora."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Kpi titulo="Onde sobra mais prazo" apoio="Etapa onde o planejamento é mais folgado que a execução. É por aqui que dá pra apertar." valor={tempos.maiorFolga} vazio="Sem dados suficientes no período."
              onClick={() => { const e = tempos.etapas.find((x) => x.etapa === tempos.maiorFolga); if (e) abrirEtapaTempo(e, abrir, "pedidos"); }} />
            <Kpi titulo="Etapa mais demorada" apoio="Maior tempo real médio. É o gargalo de verdade." valor={tempos.gargalo} vazio="Sem dados suficientes no período."
              onClick={() => { const e = tempos.etapas.find((x) => x.etapa === tempos.gargalo); if (e) abrirEtapaTempo(e, abrir, "pedidos"); }} />
          </div>
          <Card>
            <CardContent className="pt-4">
              <TabelaPvR etapas={tempos.etapas} abrir={abrir} />
              <p className="mt-2 text-xs text-muted-foreground">
                "Espera no Dados In" é o tempo entre a entrada do pedido e o primeiro salvamento do Input de Produção, quando
                o pedido realmente chega na Arte. Esse tempo saiu de dentro da Arte. Não tem planejado, por isso Planejado e
                Diferença aparecem como "—". Pedidos anteriores ao registro automático dessa data não entram na conta.
              </p>
            </CardContent>
          </Card>
        </Sub>

        <Sub titulo="Erros e retrabalho — todas as áreas">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi titulo="Peças refeitas" apoio={erros.percRefeitas == null ? "Peças que tiveram que ser feitas de novo." : `${nf1.format(erros.percRefeitas)}% das peças produzidas.`} valor={nf.format(erros.pecasRefeitas)}
              onClick={() => abrir({ titulo: "Peças refeitas", linhas: erros.itensRefeitas, colunas: { batidas: "Peças refeitas", valor: "Perdidas" }, total: `${nf.format(soma(erros.itensRefeitas, "batidas"))} peças refeitas` })} />
            <Kpi titulo="Peças perdidas" apoio={erros.percPerdidas == null ? "Peças que foram perdidas no processo." : `${nf1.format(erros.percPerdidas)}% das peças produzidas.`} valor={nf.format(erros.pecasPerdidas)}
              onClick={() => abrir({ titulo: "Peças perdidas", linhas: erros.itensRefeitas.filter((x) => (x.valor ?? 0) > 0), colunas: { batidas: "Peças refeitas", valor: "Perdidas" }, total: `${nf.format(soma(erros.itensRefeitas, "valor"))} peças perdidas` })} />
            <Kpi titulo="Pedidos reabertos" apoio="Pedidos que voltaram depois de finalizados." valor={nf.format(erros.reabertos)}
              onClick={() => abrir({ titulo: "Pedidos reabertos", linhas: erros.itensReabertos, total: tPedidos(erros.itensReabertos) })} />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Onde o erro aconteceu</CardTitle></CardHeader>
              <CardContent><TabelaErros areas={erros.porArea} /></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Correções feitas depois</CardTitle></CardHeader>
              <CardContent><TabelaCorrecoes itens={erros.correcoesPorAba} /></CardContent>
            </Card>
          </div>
        </Sub>

        <CardPorDia regs={regs} feriados={feriados} abrir={abrir} titulo="Peças por pessoa por dia — todas as etapas" />
      </Bloco>

      {/* ================= ARTE ================= */}
      <Bloco titulo="Arte" etapa="arte">
        <Filas rotulos={["Esperando Arte"]} />
        <PvREtapa nomes={["Espera no Dados In", "Arte"]} />
        <div className="grid gap-3 lg:grid-cols-2">
          <CardPessoa regs={regs} campo="quem_revelou_tela" feriados={feriados} abrir={abrir} />
        </div>
        <ErrosEtapa etapa="Arte" />
      </Bloco>

      {/* ================= DTF ================= */}
      <Bloco titulo="DTF" etapa="dtf">
        <Filas rotulos={["Em DTF"]} />
        <Estampa lado="DTF" />
        <div className="grid gap-3 lg:grid-cols-2">
          <CardPessoa regs={regs} campo="quem_bateu_dtf" feriados={feriados} abrir={abrir} />
          <CardPessoa regs={regs} campo="quem_cortou_dtf" feriados={feriados} abrir={abrir} />
          <CardPorDia regs={regs} feriados={feriados} abrir={abrir} campos={["quem_bateu_dtf", "quem_cortou_dtf"]} titulo="Peças por pessoa por dia — DTF" />
        </div>
        <PvREtapa nomes={["Estamparia DTF"]} />
        <ErrosEtapa etapa="DTF" />
      </Bloco>

      {/* ================= SILK ================= */}
      <Bloco titulo="Silk" etapa="silk">
        <Filas rotulos={["Em Silk"]} />
        <Estampa lado="Silk" />
        <div className="grid gap-3 lg:grid-cols-2">
          <CardPessoa regs={regs} campo="quem_bateu_silk" feriados={feriados} abrir={abrir} />
          <CardPorDia regs={regs} feriados={feriados} abrir={abrir} campos={["quem_bateu_silk"]} titulo="Peças por pessoa por dia — Silk" />
        </div>
        <PvREtapa nomes={["Estamparia Silk"]} />
        <ErrosEtapa etapa="Silk" />
      </Bloco>

      {/* ================= ACABAMENTO ================= */}
      <Bloco titulo="Acabamento" etapa="acabamento">
        <Filas rotulos={["Em Acabamento"]} />
        <div className="grid gap-3 lg:grid-cols-2">
          <CardPessoa regs={regs} campo="responsavel_acabamento" feriados={feriados} abrir={abrir} />
          <CardPessoa regs={regs} campo="responsavel_conferencia" feriados={feriados} abrir={abrir} />
          <CardPorDia regs={regs} feriados={feriados} abrir={abrir} campos={["responsavel_acabamento", "responsavel_conferencia"]} titulo="Peças por pessoa por dia — Acabamento" />
        </div>
        <PvREtapa nomes={["Acabamento"]} />
        <ErrosEtapa etapa="Acabamento" />
      </Bloco>

      {/* ================= EXPEDIÇÃO ================= */}
      <Bloco titulo="Expedição" etapa="expedicao">
        <Filas rotulos={["Em Expedição", "Saiu para entrega", "Entregue"]} />
        <PvREtapa nomes={["Expedição"]} />
      </Bloco>

      <KpiPcpDrill spec={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
