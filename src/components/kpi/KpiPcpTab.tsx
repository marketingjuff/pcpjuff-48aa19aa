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
  estamparia,
  filtrarPedidos,
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
  type KpiFiltro,
  type PresetPeriodo,
} from "@/lib/kpi-pcp";

const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Kpi({
  titulo,
  apoio,
  valor,
  vazio,
  variacao,
}: {
  titulo: string;
  apoio: string;
  valor: string | null;
  vazio?: string;
  variacao?: number | null;
}) {
  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <div className="text-sm font-semibold text-muted-foreground">{titulo}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tabular-nums">{valor ?? "—"}</span>
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

function Bloco({ titulo, apoio, children }: { titulo: string; apoio?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{titulo}</h2>
        {apoio && <p className="text-xs text-muted-foreground">{apoio}</p>}
      </div>
      {children}
    </section>
  );
}

const CAMPOS_PESSOA: { campo: CampoPessoa; titulo: string; batidas: boolean }[] = [
  { campo: "quem_bateu_silk", titulo: "Quem mais bateu Silk", batidas: true },
  { campo: "quem_bateu_dtf", titulo: "Quem mais bateu DTF", batidas: true },
  { campo: "quem_cortou_dtf", titulo: "Quem cortou DTF", batidas: false },
  { campo: "quem_revelou_tela", titulo: "Quem revelou tela", batidas: false },
  { campo: "responsavel_acabamento", titulo: "Quem fez o acabamento", batidas: false },
  { campo: "responsavel_conferencia", titulo: "Quem conferiu", batidas: false },
];

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
  const porDia = useMemo(() => pecasPorPessoaPorDia(regs, feriados), [regs, feriados]);

  const variacao = (atual: number | null, ant: number | null | undefined): number | null => {
    if (!comparar || atual == null || ant == null || ant === 0) return null;
    return ((atual - ant) / ant) * 100;
  };

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

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

      {/* Bloco 1 */}
      <Bloco titulo="Resumo do período">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi
            titulo="Quantidade de pedidos"
            apoio="Pedidos que ficaram prontos no período."
            valor={nf.format(resumo.pedidosFinalizados)}
            variacao={variacao(resumo.pedidosFinalizados, resumoAnt?.pedidosFinalizados)}
          />
          <Kpi
            titulo="Peças produzidas"
            apoio="Total de peças desses pedidos."
            valor={nf.format(resumo.pecasProduzidas)}
            variacao={variacao(resumo.pecasProduzidas, resumoAnt?.pecasProduzidas)}
          />
          <Kpi
            titulo="Tempo médio do pedido"
            apoio="Da entrada do pedido até ele sair da Juff, em dias úteis."
            valor={resumo.tempoMedio == null ? null : `${nf1.format(resumo.tempoMedio)} dias`}
            vazio="Nenhum pedido do período tem entrada e saída registradas."
            variacao={variacao(resumo.tempoMedio, resumoAnt?.tempoMedio)}
          />
          <Kpi
            titulo="Entregas no prazo"
            apoio="De cada 100 pedidos, quantos saíram até a data combinada."
            valor={resumo.percNoPrazo == null ? null : `${nf1.format(resumo.percNoPrazo)}%`}
            vazio="Nenhum pedido do período tem data combinada e saída registradas."
            variacao={variacao(resumo.percNoPrazo, resumoAnt?.percNoPrazo)}
          />
          <Kpi
            titulo="Atraso médio"
            apoio="Quando atrasa, atrasa em média esse tanto de dias úteis."
            valor={resumo.atrasoMedio == null ? null : `${nf1.format(resumo.atrasoMedio)} dias`}
            vazio="Nenhum pedido saiu fora do prazo no período."
            variacao={variacao(resumo.atrasoMedio, resumoAnt?.atrasoMedio)}
          />
          <Kpi
            titulo="Pedidos que precisaram refazer peça"
            apoio="Pedidos em que alguma peça teve que ser feita de novo."
            valor={resumo.percComRefacao == null ? null : `${nf1.format(resumo.percComRefacao)}%`}
            vazio="Nenhum pedido no período."
            variacao={variacao(resumo.percComRefacao, resumoAnt?.percComRefacao)}
          />
        </div>
      </Bloco>

      {/* Bloco 2 */}
      <Bloco titulo="Estamparia: quanto foi batido">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi titulo="Batidas de Silk no período" apoio="Soma das batidas registradas no Silk." valor={nf.format(est.batidasSilk)} />
          <Kpi titulo="Batidas de DTF no período" apoio="Soma das batidas registradas no DTF." valor={nf.format(est.batidasDtf)} />
          <Kpi
            titulo="Batidas por peça (Silk)"
            apoio="Quanto mais alto, mais trabalhoso foi cada peça. Serve para comparar meses com a mesma quantidade de peças mas trabalho diferente."
            valor={est.batidasPorPecaSilk == null ? null : nf2.format(est.batidasPorPecaSilk)}
            vazio="Nenhuma peça de Silk no período."
          />
          <Kpi
            titulo="Batidas por peça (DTF)"
            apoio="Quanto mais alto, mais trabalhoso foi cada peça. Serve para comparar meses com a mesma quantidade de peças mas trabalho diferente."
            valor={est.batidasPorPecaDtf == null ? null : nf2.format(est.batidasPorPecaDtf)}
            vazio="Nenhuma peça de DTF no período."
          />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Peças por tipo de estampa</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Tipo</TableHead><TableHead className="text-right">Pedidos</TableHead><TableHead className="text-right">Peças</TableHead><TableHead className="text-right">%</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {est.porTipo.map((t) => (
                    <TableRow key={t.tipo}>
                      <TableCell>{t.tipo}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{nf.format(t.pedidos)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{nf.format(t.pecas)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{nf1.format(t.perc)}%</TableCell>
                    </TableRow>
                  ))}
                  {est.porTipo.length === 0 && <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">Nenhum pedido no período.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Batidas mês a mês</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Silk</TableHead><TableHead className="text-right">DTF</TableHead><TableHead className="text-right">Peças</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {est.porMes.map((m) => (
                    <TableRow key={m.mes}>
                      <TableCell>{m.mes}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{nf.format(m.silk)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{nf.format(m.dtf)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{nf.format(m.pecas)}</TableCell>
                    </TableRow>
                  ))}
                  {est.porMes.length === 0 && <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">Nenhum pedido no período.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </Bloco>

      {/* Bloco 3 */}
      <Bloco titulo="Quem fez o quê">
        <div className="grid gap-3 lg:grid-cols-2">
          {CAMPOS_PESSOA.map(({ campo, titulo, batidas }) => {
            const linhas = porPessoa(regs, campo);
            return (
              <Card key={campo}>
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
                                  <span className="block text-[11px] text-muted-foreground">
                                    Batidas divididas igualmente entre quem bateu o pedido.
                                  </span>
                                )
                              : l.estimado && (
                                  <span className="block text-[11px] text-muted-foreground">
                                    Número dividido igualmente — o pedido não registrou quanto cada um fez.
                                  </span>
                                )}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{nf.format(l.pedidos)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {nf.format(batidas ? l.batidas : l.pecas)}
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
          })}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Peças por pessoa por dia</CardTitle>
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
                  {porDia.map((l) => (
                    <TableRow key={l.pessoa}>
                      <TableCell>{l.pessoa}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{nf.format(l.pecas)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{nf.format(l.dias)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{nf1.format(l.media)}</TableCell>
                    </TableRow>
                  ))}
                  {porDia.length === 0 && <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">Sem registro no período.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </Bloco>

      {/* Bloco 4 */}
      <Bloco
        titulo="Planejado vs. Real"
        apoio="Compara o prazo planejado no Input de Produção com o que a produção levou de fato. Pedidos com refação ficam de fora."
      >
        <p className={tempos.cobertura.perc < 50 ? "text-xs text-amber-600" : "text-xs text-muted-foreground"}>
          {nf.format(tempos.cobertura.elegiveis)} de {nf.format(tempos.cobertura.total)} pedidos do período têm a cadeia de
          datas completa e sem refação ({nf1.format(tempos.cobertura.perc)}%).
          {tempos.cobertura.perc < 50 &&
            " Com essa cobertura, os números abaixo são indicativos — vale conferir se as datas estão sendo preenchidas na hora."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Kpi
            titulo="Onde sobra mais prazo"
            apoio="Etapa onde o planejamento é mais folgado que a execução. É por aqui que dá pra apertar."
            valor={tempos.maiorFolga}
            vazio="Sem dados suficientes no período."
          />
          <Kpi
            titulo="Etapa mais demorada"
            apoio="Maior tempo real médio. É o gargalo de verdade."
            valor={tempos.gargalo}
            vazio="Sem dados suficientes no período."
          />
        </div>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Planejado vs. real por etapa</CardTitle></CardHeader>
          <CardContent>
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
                {tempos.etapas.map((e) => {
                  const esconde = e.amostraPequena;
                  const dia = (v: number | null) => (esconde || v == null ? "—" : `${nf1.format(v)} d`);
                  const dif =
                    esconde || e.diferenca == null
                      ? "—"
                      : `${e.diferenca >= 0 ? "+" : "−"}${nf1.format(Math.abs(e.diferenca))} d`;
                  const difCor =
                    esconde || e.diferenca == null ? "" : e.diferenca >= 0 ? "text-emerald-600" : "text-red-600";
                  return (
                    <TableRow key={e.etapa}>
                      <TableCell>{e.etapa}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{dia(e.planejadoMedio)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{dia(e.realMedio)}</TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${difCor}`}>{dif}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {esconde || e.realP80 == null ? "—" : `${nf.format(Math.ceil(e.realP80))} d`}
                      </TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${esconde ? "text-muted-foreground" : ""}`}>
                        {nf.format(e.n)}
                        {esconde && " (poucos)"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">
              "Espera no Dados In" é o tempo entre a entrada do pedido e o primeiro salvamento do Input de Produção, quando
              o pedido realmente chega na Arte. Esse tempo saiu de dentro da Arte. Não tem planejado, por isso Planejado e
              Diferença aparecem como "—". Pedidos anteriores ao registro automático dessa data não entram na conta.
            </p>
          </CardContent>
        </Card>

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
                      <TableCell className="text-right font-semibold tabular-nums">{nf.format(m.pedidos)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{m.medio == null ? "—" : nf1.format(m.medio)}</TableCell>
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
                  {tempos.faixas.map((f) => (
                    <TableRow key={f.faixa}>
                      <TableCell>{f.faixa}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{nf.format(f.pedidos)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{nf1.format(f.perc)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </Bloco>

      {/* Bloco 5 */}
      <Bloco titulo="Situação de agora" apoio="Isso aqui é a foto de hoje, não depende do período escolhido.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {agora.filas.map((f) => (
            <Kpi key={f.rotulo} titulo={`Pedidos parados — ${f.rotulo}`} apoio="Pedidos abertos nessa fila agora." valor={nf.format(f.pedidos)} />
          ))}
          <Kpi titulo="Pedidos atrasados" apoio="A data combinada já passou e o pedido não saiu." valor={nf.format(agora.atrasados.length)} />
          <Kpi titulo="Pedidos vencendo" apoio="Faltam até 3 dias úteis para a data combinada." valor={nf.format(agora.vencendo.length)} />
          <Kpi
            titulo="Há quanto tempo os pedidos estão na casa"
            apoio="Se esse número sobe, a fila está crescendo."
            valor={agora.idadeMedia == null ? null : `${nf1.format(agora.idadeMedia)} dias`}
            vazio="Nenhum pedido aberto com data de entrada."
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Um pedido DTF+Silk aparece nas duas filas, em DTF e em Silk.
        </p>
      </Bloco>

      {/* Bloco 6 */}
      <Bloco titulo="Erros e retrabalho">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi
            titulo="Peças refeitas"
            apoio={erros.percRefeitas == null ? "Peças que tiveram que ser feitas de novo." : `${nf1.format(erros.percRefeitas)}% das peças produzidas.`}
            valor={nf.format(erros.pecasRefeitas)}
          />
          <Kpi
            titulo="Peças perdidas"
            apoio={erros.percPerdidas == null ? "Peças que foram perdidas no processo." : `${nf1.format(erros.percPerdidas)}% das peças produzidas.`}
            valor={nf.format(erros.pecasPerdidas)}
          />
          <Kpi titulo="Pedidos reabertos" apoio="Pedidos que voltaram depois de finalizados." valor={nf.format(erros.reabertos)} />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Onde o erro aconteceu</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Área</TableHead><TableHead className="text-right">Ocorrências</TableHead><TableHead className="text-right">Peças refeitas</TableHead><TableHead className="text-right">Perdidas</TableHead></TableRow></TableHeader>
                <TableBody>
                  {erros.porArea.map((a) => (
                    <TableRow key={a.area}>
                      <TableCell>{a.area}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{nf.format(a.episodios)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{nf.format(a.pecas)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{nf.format(a.perdidas)}</TableCell>
                    </TableRow>
                  ))}
                  {erros.porArea.length === 0 && <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">Nenhuma refação no período.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Correções feitas depois</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Aba</TableHead><TableHead className="text-right">Correções</TableHead></TableRow></TableHeader>
                <TableBody>
                  {erros.correcoesPorAba.map((c) => (
                    <TableRow key={c.aba}>
                      <TableCell>{c.aba}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{nf.format(c.qtd)}</TableCell>
                    </TableRow>
                  ))}
                  {erros.correcoesPorAba.length === 0 && <TableRow><TableCell colSpan={2} className="text-sm text-muted-foreground">Nenhuma correção no período.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </Bloco>

      {/* Bloco 7 */}
      <Bloco titulo="A data que a gente promete">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            titulo="Pedidos que tiveram a data de entrega adiada"
            apoio="Mostra se a data que a gente promete no começo é a data que a gente cumpre no fim."
            valor={promessa.percAdiados == null ? null : `${nf1.format(promessa.percAdiados)}%`}
            vazio="Nenhum pedido do período tem data combinada."
          />
          <Kpi
            titulo="Dias que a data foi empurrada"
            apoio="Média de dias úteis entre a primeira data prometida e a data atual."
            valor={promessa.diasEmpurradosMedio == null ? null : `${nf1.format(promessa.diasEmpurradosMedio)} dias`}
            vazio="Nenhuma data foi adiada no período."
          />
          <Kpi
            titulo="Entraram × Saíram"
            apoio="Se entra mais do que sai por vários períodos seguidos, a fila está aumentando."
            valor={`${nf.format(promessa.entraram)} × ${nf.format(promessa.sairam)}`}
          />
          <Kpi
            titulo="Tempo médio de secagem"
            apoio="Dias registrados de secagem nos pedidos do período."
            valor={promessa.secagemMedia == null ? null : `${nf1.format(promessa.secagemMedia)} dias`}
            vazio="Nenhum pedido do período registrou secagem."
          />
        </div>
      </Bloco>
    </div>
  );
}
