import { Fragment, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { CorChip } from "@/components/plan/NecessidadeTab";
import { REFACAO_TAMANHOS } from "@/lib/pedidos";
import { useIsAdmin, useMyRoles } from "@/hooks/use-role";
import { TABLE_WRAPPER_CLASS, TH_CLASS, TD_CLASS, BADGE_SM_CLASS } from "@/components/shared/table-styles";
import {
  cfg, montarEstoqueMinimo, usePlanConfig, usePlanCoresForaDeLinha, usePlanLeadTimePorModelo, usePlanMinimos,
  usePlanVendaHistorica, useSalvarMinimo, useSalvarMinimosEmLote, type LinhaEstoqueMinimo,
  type MinimoParaSalvar,
} from "@/lib/plan";

type PadraoMinimo = { modelo: string; cor: string; valores: Map<string, number> };
type ColagemMinimo = { modelo: string; origem: PadraoMinimo; itens: MinimoParaSalvar[]; cores: number };

function copiarValores(linhas: LinhaEstoqueMinimo[]) {
  return new Map(linhas.filter((l) => l.adotado !== null).map((l) => [l.tamanho, l.adotado as number]));
}

function montarColagem(linhas: LinhaEstoqueMinimo[], valores: Map<string, number>): MinimoParaSalvar[] {
  return linhas.flatMap((l) => {
    const minimo = valores.get(l.tamanho);
    if (minimo === undefined || minimo === l.adotado) return [];
    return [{ modelo: l.modelo, cor: l.cor, tamanho: l.tamanho, minimo, sugerido: l.sugerido }];
  });
}

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const fmtMedia = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function textoOrigem(l: LinhaEstoqueMinimo) {
  if (l.origemLead === "modelo") return `medido em ${l.amostraLead} produções deste modelo`;
  if (l.origemLead === "geral") return "medido na média geral das produções, este modelo ainda tem pouco histórico";
  return "ainda sem histórico suficiente, usando o parâmetro padrão";
}

function DetalheConta({ l, semanas }: { l: LinhaEstoqueMinimo; semanas: number }) {
  const linhas: [string, string, string][] = [
    ["Média de venda por mês", `${fmtMedia(l.mediaMensal)} peças`, "média dos últimos 12 meses na Olist"],
    ["Tempo de reposição", `${fmt(l.leadDias)} dias`, textoOrigem(l)],
    ["Consumo até a peça chegar", `${fmt(l.consumo)} peças`, `${fmtMedia(l.mediaMensal)} por mês dividido por 30, vezes ${fmt(l.leadDias)} dias`],
    ["Folga de segurança", `${fmt(l.folga)} peças`, `${fmtMedia(semanas)} semanas de venda`],
    ["Mínimo sugerido", `${fmt(l.sugerido)} peças`, ""],
  ];
  return (
    <table className="w-full text-xs">
      <tbody>
        {linhas.map(([a, b, c], i) => (
          <tr key={a} className={i === linhas.length - 1 ? "border-t font-semibold" : ""}>
            <td className="py-1 pr-3 whitespace-nowrap">{a}</td>
            <td className="py-1 pr-3 text-right tabular-nums whitespace-nowrap">{b}</td>
            <td className="py-1 text-muted-foreground">{c}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CampoAdotado({ l, podeEditar, onSalvar }: { l: LinhaEstoqueMinimo; podeEditar: boolean; onSalvar: (n: number) => Promise<void> }) {
  const inicial = l.adotado === null ? "" : String(l.adotado);
  const [txt, setTxt] = useState(inicial);
  useEffect(() => setTxt(inicial), [inicial]);
  const salvar = async () => {
    if (txt === inicial || txt === "") { setTxt(inicial); return; }
    await onSalvar(Number(txt));
  };
  return (
    <div className="flex items-center gap-1 justify-end">
      <Input
      type="text" inputMode="numeric" maxLength={5} value={txt} disabled={!podeEditar}
      placeholder={String(l.sugerido)}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setTxt(e.target.value.replace(/\D/g, "").slice(0, 5))}
      onBlur={salvar}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="h-6 w-16 text-right text-[11px] tabular-nums px-1.5"
      />
      {podeEditar && txt !== inicial && txt !== "" && (
        <Button size="sm" variant="outline" className="h-6 px-1.5 text-[11px]"
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onClick={(e) => { e.stopPropagation(); void salvar(); }}>
          OK
        </Button>
      )}
    </div>
  );
}

export function EstoqueMinimoTab() {
  const isAdmin = useIsAdmin();
  const isGestor = useMyRoles().data?.some((r) => r.role === "gestor") ?? false;
  const podeEditar = isAdmin || isGestor;
  const venda = usePlanVendaHistorica();
  const lead = usePlanLeadTimePorModelo();
  const { data: config, isLoading: cfgLoading } = usePlanConfig();
  const { cores: foraLinha } = usePlanCoresForaDeLinha();
  const minimos = usePlanMinimos();
  const salvarUm = useSalvarMinimo();
  const salvarLote = useSalvarMinimosEmLote();
  const [busca, setBusca] = useState("");
  const [soDefasados, setSoDefasados] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState<{ modelo: string; linhas: LinhaEstoqueMinimo[] } | null>(null);
  const [padrao, setPadrao] = useState<PadraoMinimo | null>(null);
  const [confirmarColagem, setConfirmarColagem] = useState<ColagemMinimo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const limiar = cfg(config, "limiar_alerta_minimo_pct") || 10;
  const semanas = cfg(config, "semanas_seguranca");

  const linhas = useMemo(() => {
    if (!venda.data || !minimos.data) return [];
    return montarEstoqueMinimo({
      mediaMensal: venda.data.mediaMensal, tamanhos: REFACAO_TAMANHOS, leadTime: lead.data, config,
      coresForaDeLinha: foraLinha, minimosAdotados: minimos.data, limiarPct: limiar,
    });
  }, [venda.data, minimos.data, lead.data, config, foraLinha, limiar]);

  const totalDefasados = linhas.filter((l) => l.defasado).length;

  const blocos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const m = new Map<string, LinhaEstoqueMinimo[]>();
    for (const l of linhas) {
      if (soDefasados && !l.defasado) continue;
      if (q && !l.modelo.toLowerCase().includes(q) && !l.cor.toLowerCase().includes(q)) continue;
      const arr = m.get(l.modelo) ?? [];
      arr.push(l);
      m.set(l.modelo, arr);
    }
    return Array.from(m, ([modelo, ls]) => ({ modelo, linhas: ls }));
  }, [linhas, busca, soDefasados]);

  const gravar = async (l: LinhaEstoqueMinimo, minimo: number) => {
    setErro(null);
    try { await salvarUm.mutateAsync({ modelo: l.modelo, cor: l.cor, tamanho: l.tamanho, minimo, sugerido: l.sugerido }); }
    catch (e: any) { setErro(`Não foi possível salvar ${l.modelo} ${l.cor} ${l.tamanho}: ${e?.message ?? "erro"}`); }
  };

  const aceitarTodas = async () => {
    if (!confirmar) return;
    setErro(null);
    try {
      await salvarLote.mutateAsync(confirmar.linhas.map((l) => ({ modelo: l.modelo, cor: l.cor, tamanho: l.tamanho, minimo: l.sugerido, sugerido: l.sugerido })));
    } catch (e: any) { setErro(`Não foi possível salvar o modelo ${confirmar.modelo}: ${e?.message ?? "erro"}`); }
    setConfirmar(null);
  };

  const copiarPadrao = (modelo: string, cor: string, ls: LinhaEstoqueMinimo[]) => {
    if (!podeEditar) return;
    const valores = copiarValores(ls);
    if (!valores.size) {
      setErro("Essa cor ainda não tem nenhum mínimo adotado para copiar.");
      return;
    }
    setErro(null);
    setPadrao({ modelo, cor, valores });
  };

  const prepararColagem = (modelo: string, ls: LinhaEstoqueMinimo[]) => {
    if (!podeEditar || !padrao) return;
    const itens = montarColagem(ls, padrao.valores);
    setConfirmarColagem({ modelo, origem: padrao, itens, cores: new Set(itens.map((i) => i.cor)).size });
  };

  const colarPadrao = async () => {
    if (!podeEditar || !confirmarColagem) return;
    setErro(null);
    try {
      if (confirmarColagem.itens.length) await salvarLote.mutateAsync(confirmarColagem.itens);
    } catch (e: unknown) {
      const mensagem = e && typeof e === "object" && "message" in e ? String(e.message) : "erro";
      setErro(`Não foi possível colar o padrão no modelo ${confirmarColagem.modelo}: ${mensagem}`);
    }
    setConfirmarColagem(null);
  };

  const carregando = venda.isLoading || minimos.isLoading || lead.isLoading || cfgLoading;
  const toggle = (m: string) => setAbertos((s) => { const n = new Set(s); n.has(m) ? n.delete(m) : n.add(m); return n; });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">Estoque mínimo</p>
          <p className="text-sm text-muted-foreground">Quanto de cada peça precisa estar sempre em casa. O sistema sugere, você confirma ou corrige.</p>
        </div>
        {totalDefasados > 0 && <Badge variant="destructive">{totalDefasados} defasados</Badge>}
      </div>

      {!podeEditar && (
        <div className="flex items-center gap-2 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <Lock className="h-4 w-4" /> Somente leitura: só admin ou gestor pode alterar o estoque mínimo.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input type="text" placeholder="Buscar modelo ou cor" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={soDefasados} onCheckedChange={setSoDefasados} /> Mostrar só os defasados
        </label>
      </div>

      {podeEditar && padrao && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span>Padrão copiado de {padrao.modelo} {padrao.cor}, {padrao.valores.size} tamanhos</span>
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setPadrao(null); }}>Limpar</Button>
        </div>
      )}

      {erro && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{erro}</p>}
      {carregando && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!carregando && blocos.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma peça para mostrar.</p>}

      {blocos.map(({ modelo, linhas: ls }) => {
        const aberto = abertos.has(modelo);
        const def = ls.filter((l) => l.defasado).length;
        const paraAceitar = ls.filter((l) => l.adotado !== l.sugerido);
        const porCor = new Map<string, LinhaEstoqueMinimo[]>();
        for (const l of ls) { const a = porCor.get(l.cor) ?? []; a.push(l); porCor.set(l.cor, a); }
        return (
          <Card key={modelo} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 cursor-pointer" onClick={() => toggle(modelo)}>
              <div className="flex flex-wrap items-center gap-2">
                {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-semibold">{modelo}</span>
                <span className="text-xs text-muted-foreground">{ls.length} combinações</span>
                {def > 0 && <Badge variant="destructive" className={BADGE_SM_CLASS}>{def} defasados</Badge>}
              </div>
              {podeEditar && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" disabled={!paraAceitar.length}
                    onClick={(e) => { e.stopPropagation(); setConfirmar({ modelo, linhas: paraAceitar }); }}>
                    Aceitar todas deste modelo
                  </Button>
                  <Button size="sm" variant="outline" disabled={!padrao || salvarLote.isPending}
                    onClick={(e) => { e.stopPropagation(); prepararColagem(modelo, ls); }}>
                    Colar padrão aqui
                  </Button>
                </div>
              )}
            </div>
            {aberto && Array.from(porCor, ([cor, lc]) => (
              <Fragment key={cor}>
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-muted/40 border-t">
                  <CorChip cor={cor} />
                  {podeEditar && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                      onClick={(e) => { e.stopPropagation(); copiarPadrao(modelo, cor, lc); }}>
                      Copiar padrão
                    </Button>
                  )}
                </div>
                <div className={`${TABLE_WRAPPER_CLASS} rounded-none border-x-0`}>
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className={TH_CLASS} />
                        <th className={TH_CLASS} />
                        <th colSpan={2} className="px-1.5 pt-1 text-[12px] font-normal text-muted-foreground text-center border-x">Quantidade mínima que deve sempre ter em estoque</th>
                        <th className={TH_CLASS} />
                        <th className={TH_CLASS} />
                      </tr>
                      <tr className="border-b">
                        <th className={`${TH_CLASS} text-left`}>Tam.</th>
                        <th className={`${TH_CLASS} text-right`}>Média por mês<br /><span className="text-[11px] font-normal text-muted-foreground">últimos 12 meses</span></th>
                        <th className={`${TH_CLASS} text-right border-l`}>Sugerido</th>
                        <th className={`${TH_CLASS} text-right border-r`}>Adotado</th>
                        <th className={`${TH_CLASS} text-left`}>Situação</th>
                        <th className={TH_CLASS} />
                      </tr>
                    </thead>
                    <tbody>
                      {lc.map((l) => (
                        <Popover key={l.tamanho}>
                          <PopoverTrigger asChild>
                            <tr className={`cursor-pointer border-b last:border-b-0 hover:bg-muted/40 ${l.defasado ? "bg-destructive/10" : ""}`}>
                              <td className={`${TD_CLASS} text-left font-medium align-middle`}>{l.tamanho}</td>
                              <td className={`${TD_CLASS} text-right tabular-nums align-middle`}>{fmtMedia(l.mediaMensal)}</td>
                              <td className={`${TD_CLASS} text-right tabular-nums border-l align-middle`}>{fmt(l.sugerido)}</td>
                              <td className={`${TD_CLASS} text-right border-r align-middle`}>
                                <CampoAdotado l={l} podeEditar={podeEditar} onSalvar={(n) => gravar(l, n)} />
                              </td>
                              <td className={`${TD_CLASS} text-left align-middle`}>
                                {l.defasado ? (
                                  <span className="inline-flex items-center gap-1 text-destructive">
                                    <AlertTriangle className="h-3 w-3" /> A venda subiu desde que esse mínimo foi definido
                                  </span>
                                ) : l.adotado !== null ? (
                                  <Badge variant="secondary" className={BADGE_SM_CLASS}>Adotado</Badge>
                                ) : (
                                  <Badge variant="outline" className={BADGE_SM_CLASS}>Nunca definido</Badge>
                                )}
                              </td>
                              <td className={`${TD_CLASS} text-right align-middle`}>
                                {podeEditar && l.adotado !== l.sugerido && (
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                                    onClick={(e) => { e.stopPropagation(); void gravar(l, l.sugerido); }}>
                                    Aceitar {fmt(l.sugerido)}
                                  </Button>
                                )}
                              </td>
                            </tr>
                          </PopoverTrigger>
                          <PopoverContent className="w-[520px] max-w-[95vw]" align="start">
                            <p className="mb-2 text-sm font-semibold">{l.modelo} · {l.cor} · {l.tamanho}</p>
                            <DetalheConta l={l} semanas={semanas} />
                          </PopoverContent>
                        </Popover>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Fragment>
            ))}
          </Card>
        );
      })}

      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aceitar todas as sugestões de {confirmar?.modelo}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar?.linhas.length} linhas vão passar a ter o mínimo adotado igual ao sugerido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={aceitarTodas}>Aceitar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!confirmarColagem} onOpenChange={(o) => !o && setConfirmarColagem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Colar o padrão de {confirmarColagem?.origem.modelo} {confirmarColagem?.origem.cor} em {confirmarColagem?.modelo}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmarColagem?.itens.length} linhas vão passar a ter o mínimo adotado igual ao padrão copiado, em {confirmarColagem?.cores} cores. Tamanhos que não estão no padrão não mudam.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.stopPropagation(); void colarPadrao(); }} disabled={salvarLote.isPending}>Colar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
