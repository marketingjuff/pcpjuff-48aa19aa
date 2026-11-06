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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, ChevronDown, ChevronRight, ClipboardPaste, Copy, Lock } from "lucide-react";
import { CorChip } from "@/components/plan/NecessidadeTab";
import { REFACAO_TAMANHOS } from "@/lib/pedidos";
import { useMyRoles } from "@/hooks/use-role";
import { podeEditarPlan } from "@/lib/plan-permissoes";
import { TABLE_WRAPPER_CLASS, TH_CLASS, TD_CLASS, BADGE_SM_CLASS } from "@/components/shared/table-styles";
import {
  cfg, itensSobDemandaDaCor, montarEstoqueMinimo, usePlanConfig, usePlanCoresForaDeLinha, usePlanLeadTimePorModelo, usePlanMinimos,
  usePlanVendaHistorica, useSalvarMinimo, useSalvarMinimosEmLote, useSalvarSobDemanda, type LinhaEstoqueMinimo,
  type MinimoParaSalvar,
} from "@/lib/plan";

import { FiltroModeloCor, useFiltroModeloCor } from "./FiltroModeloCor";
import { filtrarModeloCor, usePlanCatalogoModelos, rotuloClassificacao } from "@/lib/plan";

type PadraoMinimo = { modelo: string; cor: string; valores: Map<string, number> };

function copiarValores(linhas: LinhaEstoqueMinimo[]) {
  return new Map(linhas.filter((l) => l.adotado !== null).map((l) => [l.tamanho, l.adotado as number]));
}

export function itensDaColagem(linhas: LinhaEstoqueMinimo[], valores: Map<string, number>, substituir: boolean): MinimoParaSalvar[] {
  return linhas.flatMap((l) => {
    if (l.classificacao && l.classificacao !== "normal") return [];
    const minimo = valores.get(l.tamanho);
    if (minimo === undefined || minimo === l.adotado) return [];
    if (!substituir && l.adotado !== null) return [];
    return [{ modelo: l.modelo, cor: l.cor, tamanho: l.tamanho, minimo, sugerido: l.sugerido, sobDemanda: l.sobDemanda }];
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

function moverComTab(atual: HTMLInputElement, paraTras: boolean) {
  const todos = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-adotado]:not([disabled])'));
  const i = todos.indexOf(atual);
  if (i === -1) return false;
  const prox = paraTras ? todos[i - 1] : todos[i + 1];
  if (!prox) return false;
  prox.focus();
  prox.select();
  return true;
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
      data-adotado=""
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setTxt(e.target.value.replace(/\D/g, "").slice(0, 5))}
      onBlur={salvar}
      onKeyDown={(e) => {
        if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); return; }
        if (e.key === "Tab") {
          const ok = moverComTab(e.currentTarget, e.shiftKey);
          if (ok) e.preventDefault();
        }
      }}
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
  const podeEditar = podeEditarPlan((useMyRoles().data ?? []).map((r) => r.role));
  const catalogoQ = usePlanCatalogoModelos();
  const filtroQ = useFiltroModeloCor("estoque_minimo");
  const [foraAbertos, setForaAbertos] = useState<Set<string>>(new Set());
  const venda = usePlanVendaHistorica();
  const lead = usePlanLeadTimePorModelo();
  const { data: config, isLoading: cfgLoading } = usePlanConfig();
  const { cores: foraLinha } = usePlanCoresForaDeLinha();
  const minimos = usePlanMinimos();
  const salvarUm = useSalvarMinimo();
  const salvarLote = useSalvarMinimosEmLote();
  const salvarSobDemanda = useSalvarSobDemanda();
  const [busca, setBusca] = useState("");
  const [soDefasados, setSoDefasados] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState<{ modelo: string; linhas: LinhaEstoqueMinimo[] } | null>(null);
  const [padrao, setPadrao] = useState<PadraoMinimo | null>(null);
  const [dlgAberto, setDlgAberto] = useState(false);
  const [substituir, setSubstituir] = useState(true);
  const [buscaDlg, setBuscaDlg] = useState("");
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [dlgAbertos, setDlgAbertos] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);

  const limiar = cfg(config, "limiar_alerta_minimo_pct") || 10;
  const semanas = cfg(config, "semanas_seguranca");

  const linhas = useMemo(() => {
    if (!venda.data || !minimos.data) return [];
    return montarEstoqueMinimo({
      catalogo: catalogoQ.catalogo, mediaMensal: venda.data.mediaMensal, tamanhos: REFACAO_TAMANHOS, leadTime: lead.data, config,
      coresForaDeLinha: foraLinha, minimosAdotados: minimos.data, limiarPct: limiar,
    });
  }, [venda.data, minimos.data, lead.data, config, foraLinha, limiar, catalogoQ.catalogo]);

  const totalDefasados = linhas.filter((l) => l.defasado).length;

  const blocos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const m = new Map<string, LinhaEstoqueMinimo[]>();
    for (const l of filtrarModeloCor(linhas, filtroQ.filtro)) {
      if (soDefasados && !l.defasado) continue;
      if (q && !l.modelo.toLowerCase().includes(q) && !l.cor.toLowerCase().includes(q)) continue;
      const arr = m.get(l.modelo) ?? [];
      arr.push(l);
      m.set(l.modelo, arr);
    }
    return Array.from(m, ([modelo, ls]) => ({ modelo, linhas: ls }));
  }, [linhas, busca, soDefasados, filtroQ.filtro]);

  const gravar = async (l: LinhaEstoqueMinimo, minimo: number) => {
    if (!podeEditar || catalogoQ.isLoading || catalogoQ.error) return;
    setErro(null);
    try { await salvarUm.mutateAsync({ modelo: l.modelo, cor: l.cor, tamanho: l.tamanho, minimo, sugerido: l.sugerido, sobDemanda: l.sobDemanda }); }
    catch (e: any) { setErro(`Não foi possível salvar ${l.modelo} ${l.cor} ${l.tamanho}: ${e?.message ?? "erro"}`); }
  };

  const alternarSobDemanda = async (l: LinhaEstoqueMinimo) => {
    if (!podeEditar || salvarSobDemanda.isPending || l.classificacao !== "normal") return;
    setErro(null);
    try {
      await salvarSobDemanda.mutateAsync({ modelo: l.modelo, cor: l.cor, tamanho: l.tamanho, sugerido: l.sugerido, sobDemanda: !l.sobDemanda });
    } catch (e: unknown) {
      const mensagem = e && typeof e === "object" && "message" in e ? String(e.message) : "erro";
      setErro(`Não foi possível salvar Sob demanda em ${l.modelo} ${l.cor} ${l.tamanho}: ${mensagem}`);
    }
  };

  const aceitarTodas = async () => {
    if (!confirmar || !podeEditar || salvarLote.isPending) return;
    setErro(null);
    try {
      const chaves = new Set(confirmar.linhas.map(l => `${l.modelo}|${l.cor}|${l.tamanho}`));
      await salvarLote.mutateAsync(linhas.filter(l => chaves.has(`${l.modelo}|${l.cor}|${l.tamanho}`) && l.classificacao === "normal" && !l.sobDemanda && l.sugerido > 0).map((l) => ({ modelo: l.modelo, cor: l.cor, tamanho: l.tamanho, minimo: l.sugerido, sugerido: l.sugerido, sobDemanda: l.sobDemanda })));
    } catch (e: any) { setErro(`Não foi possível salvar o modelo ${confirmar.modelo}: ${e?.message ?? "erro"}`); }
    setConfirmar(null);
  };

  const alternarSobDemandaDaCor = async (modelo: string, cor: string) => {
    if (!podeEditar || salvarSobDemanda.isPending || salvarUm.isPending || salvarLote.isPending) return;
    if (linhas.some(l => l.modelo === modelo && l.cor === cor && l.classificacao !== "normal")) return;
    setErro(null);
    try {
      await salvarSobDemanda.mutateAsync(itensSobDemandaDaCor(linhas, modelo, cor));
    } catch (e: unknown) {
      const mensagem = e && typeof e === "object" && "message" in e ? String(e.message) : "erro";
      setErro(`Não foi possível salvar Sob demanda em ${modelo} ${cor}: ${mensagem}`);
    }
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

  const chave = (m: string, c: string) => `${m}|${c}`;

  // Todos os modelos/cores, sem os filtros da tela
  const porModeloCor = useMemo(() => {
    const m = new Map<string, Map<string, LinhaEstoqueMinimo[]>>();
    for (const l of linhas) {
      if (l.classificacao !== "normal") continue;
      const mc = m.get(l.modelo) ?? new Map<string, LinhaEstoqueMinimo[]>();
      const a = mc.get(l.cor) ?? []; a.push(l); mc.set(l.cor, a); m.set(l.modelo, mc);
    }
    return m;
  }, [linhas]);

  const gruposDlg = useMemo(() => {
    const q = buscaDlg.trim().toLowerCase();
    return Array.from(porModeloCor, ([modelo, mc]) => {
      const cores = Array.from(mc.keys()).filter((c) => !q || modelo.toLowerCase().includes(q) || c.toLowerCase().includes(q));
      return { modelo, cores, total: mc.size };
    }).filter((g) => g.cores.length);
  }, [porModeloCor, buscaDlg]);

  const itensColagem = useMemo(() => {
    if (!padrao) return [];
    const out: MinimoParaSalvar[] = [];
    for (const k of selecao) {
      const [m, c] = k.split("|");
      const ls = porModeloCor.get(m)?.get(c);
      if (ls) out.push(...itensDaColagem(ls, padrao.valores, substituir));
    }
    return out;
  }, [padrao, selecao, porModeloCor, substituir]);

  const resumo = {
    linhas: itensColagem.length,
    cores: new Set(itensColagem.map((i) => chave(i.modelo, i.cor))).size,
    modelos: new Set(itensColagem.map((i) => i.modelo)).size,
  };

  const alternarCor = (k: string, v: boolean) => setSelecao((s) => { const n = new Set(s); v ? n.add(k) : n.delete(k); return n; });
  const alternarModelo = (modelo: string, cores: string[], v: boolean) =>
    setSelecao((s) => { const n = new Set(s); for (const c of cores) v ? n.add(chave(modelo, c)) : n.delete(chave(modelo, c)); return n; });

  const quantosMudam = (ls: LinhaEstoqueMinimo[]) => (padrao ? itensDaColagem(ls, padrao.valores, substituir).length : 0);

  const colarEmCor = async (ls: LinhaEstoqueMinimo[]) => {
    if (!podeEditar || !padrao || salvarLote.isPending) return;
    const itens = itensDaColagem(ls, padrao.valores, substituir);
    if (!itens.length) return;
    setErro(null);
    try {
      await salvarLote.mutateAsync(itens);
    } catch (e: unknown) {
      const mensagem = e && typeof e === "object" && "message" in e ? String(e.message) : "erro";
      setErro(`Não foi possível colar o padrão em ${ls[0]?.modelo} ${ls[0]?.cor}: ${mensagem}`);
    }
  };

  const colarPadrao = async () => {
    if (!podeEditar || !padrao || !itensColagem.length) return;
    setErro(null);
    try {
      await salvarLote.mutateAsync(itensColagem);
      setDlgAberto(false);
      setSelecao(new Set());
    } catch (e: unknown) {
      const mensagem = e && typeof e === "object" && "message" in e ? String(e.message) : "erro";
      setErro(`Não foi possível colar o padrão: ${mensagem}`);
    }
  };

  const carregando = venda.isLoading || minimos.isLoading || lead.isLoading || cfgLoading || catalogoQ.isLoading;
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

      <FiltroModeloCor {...filtroQ} modelos={Object.keys(catalogoQ.catalogo)} />
      {catalogoQ.error && <p className="text-sm text-destructive">Não foi possível ler o catálogo: {catalogoQ.error.message}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Input type="text" placeholder="Buscar modelo ou cor" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={soDefasados} onCheckedChange={setSoDefasados} /> Mostrar só os defasados
        </label>
      </div>

      {podeEditar && padrao && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span>Padrão copiado de {padrao.modelo} {padrao.cor}, {padrao.valores.size} tamanhos</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); setBuscaDlg(""); setDlgAberto(true); }}>Colar em...</Button>
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setPadrao(null); }}>Limpar</Button>
          </div>
        </div>
      )}

      {erro && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{erro}</p>}
      {carregando && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!carregando && blocos.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma peça para mostrar.</p>}

      {blocos.map(({ modelo, linhas: ls }) => {
        const aberto = abertos.has(modelo);
        const def = ls.filter((l) => l.defasado).length;
        const paraAceitar = ls.filter((l) => !l.sobDemanda && l.sugerido > 0 && l.adotado !== l.sugerido);
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
                </div>
              )}
            </div>
            {aberto && (() => {
              const grupos = Array.from(porCor);
              const emLinha = grupos.filter(([, lc]) => lc[0]?.classificacao === "normal");
              const fora = grupos.filter(([, lc]) => lc[0]?.classificacao !== "normal");
              const renderCor = ([cor, lc]: [string, LinhaEstoqueMinimo[]]) => (
              <Fragment key={cor}>
                <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-muted/40 border-t">
                  <span className="text-xs font-semibold whitespace-nowrap">{modelo}</span>
                  <CorChip cor={cor} />
                  {lc[0]?.classificacao !== "normal" && <Badge variant="outline">{rotuloClassificacao(lc[0]?.classificacao ?? "ausente")}</Badge>}
                  {lc[0]?.classificacao === "geral" ? <span className="text-xs text-muted-foreground">Esta cor está fora de linha para a Juff inteira, mude em Parâmetros</span> : lc[0]?.classificacao !== "normal" && podeEditar ? (
                    <Button size="sm" variant="outline" disabled={catalogoQ.promover.isPending || !!catalogoQ.error} onClick={() => {
                      void catalogoQ.promover.mutateAsync({ catalogo: catalogoQ.catalogo, modelo, cor, globais: foraLinha }).catch((e: unknown) => setErro(e instanceof Error ? e.message : "Não foi possível mudar a cor."));
                    }}>Tirar de fora de linha</Button>
                  ) : null}
                  {podeEditar && lc[0]?.classificacao === "normal" && (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant={padrao?.modelo === modelo && padrao?.cor === cor ? "secondary" : "ghost"}
                        className="h-6 px-1.5 gap-1 text-[11px]" title="Copiar padrão desta cor" aria-label="Copiar padrão desta cor"
                        onClick={(e) => { e.stopPropagation(); copiarPadrao(modelo, cor, lc); }}>
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </Button>
                      {padrao && (
                        <Button size="sm" variant="outline"
                          className="h-6 px-1.5 gap-1 text-[11px]"
                          title={`Colar o padrão de ${padrao.modelo} ${padrao.cor} nesta cor`}
                          aria-label="Colar padrão nesta cor"
                          disabled={!quantosMudam(lc) || salvarLote.isPending}
                          onClick={(e) => { e.stopPropagation(); void colarEmCor(lc); }}>
                          <ClipboardPaste className="h-3.5 w-3.5" /> Colar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                        aria-label={`Alternar Sob demanda para todos os tamanhos de ${modelo} ${cor}`}
                        title="Aplicar a todos os tamanhos desta cor"
                        disabled={salvarSobDemanda.isPending || salvarUm.isPending || salvarLote.isPending}
                        onClick={(e) => { e.stopPropagation(); void alternarSobDemandaDaCor(modelo, cor); }}>
                        {linhas.filter((l) => l.modelo === modelo && l.cor === cor).every((l) => l.sobDemanda) ? "Voltar ao normal" : "Sob demanda"}
                      </Button>
                    </div>
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
                                {l.sobDemanda ? (
                                  <Badge variant="secondary" className={BADGE_SM_CLASS}>Sob demanda</Badge>
                                ) : l.defasado ? (
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
                                {podeEditar && !l.sobDemanda && l.adotado !== l.sugerido && (
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                                    onClick={(e) => { e.stopPropagation(); void gravar(l, l.sugerido); }}>
                                    Aceitar {fmt(l.sugerido)}
                                  </Button>
                                )}
                                {podeEditar && l.classificacao === "normal" && (
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                                    disabled={salvarSobDemanda.isPending || salvarUm.isPending || salvarLote.isPending}
                                    onClick={(e) => { e.stopPropagation(); void alternarSobDemanda(l); }}>
                                    {l.sobDemanda ? "Voltar ao normal" : "Sob demanda"}
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
              );
              return <>
                {emLinha.map(renderCor)}
                {fora.length > 0 && <div className="border-t p-3">
                  <Button size="sm" variant="outline" aria-expanded={foraAbertos.has(modelo)} onClick={() => setForaAbertos(prev => { const novo = new Set(prev); novo.has(modelo) ? novo.delete(modelo) : novo.add(modelo); return novo; })}>
                    {foraAbertos.has(modelo) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}Ver cores fora de linha ({fora.length})
                  </Button>
                </div>}
                {foraAbertos.has(modelo) && fora.map(renderCor)}
              </>;
            })()}
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
      <Dialog open={dlgAberto && !!padrao && podeEditar} onOpenChange={setDlgAberto}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Colar o padrão de {padrao?.modelo} {padrao?.cor}</DialogTitle>
          </DialogHeader>
          {padrao && (
            <div className="overflow-x-auto">
              <table className="text-xs tabular-nums border">
                <tbody>
                  <tr>{REFACAO_TAMANHOS.filter((t) => padrao.valores.has(t)).map((t) => <th key={t} className="border px-2 py-1 font-medium bg-muted/40">{t}</th>)}</tr>
                  <tr>{REFACAO_TAMANHOS.filter((t) => padrao.valores.has(t)).map((t) => <td key={t} className="border px-2 py-1 text-center">{fmt(padrao.valores.get(t) ?? 0)}</td>)}</tr>
                </tbody>
              </table>
            </div>
          )}
          <div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={substituir} onCheckedChange={setSubstituir} /> Substituir mínimos já definidos
            </label>
            <p className="mt-1 text-xs text-muted-foreground">Tamanho que não existe no modelo de destino é ignorado, e tamanho que está no destino mas não está no padrão não muda.</p>
          </div>
          <Input type="text" placeholder="Buscar modelo ou cor" value={buscaDlg} onChange={(e) => setBuscaDlg(e.target.value)} />
          <div className="flex-1 overflow-y-auto rounded-md border min-h-[120px]">
            {gruposDlg.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nada encontrado.</p>}
            {gruposDlg.map(({ modelo, cores, total }) => {
              const marcadas = cores.filter((c) => selecao.has(chave(modelo, c))).length;
              const estado = marcadas === 0 ? false : marcadas === cores.length ? true : "indeterminate";
              const ab = dlgAbertos.has(modelo);
              return (
                <div key={modelo} className="border-b last:border-b-0">
                  <div className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setDlgAbertos((s) => { const n = new Set(s); n.has(modelo) ? n.delete(modelo) : n.add(modelo); return n; }); }}>
                    <Checkbox checked={estado} onClick={(e) => e.stopPropagation()}
                      onCheckedChange={(v) => alternarModelo(modelo, cores, v === true)} aria-label={`Marcar ${modelo}`} />
                    <span className="font-medium text-sm">{modelo}</span>
                    <span className="text-xs text-muted-foreground">{total} cores</span>
                    <span className="ml-auto">{ab ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                  </div>
                  {ab && cores.map((cor) => {
                    const k = chave(modelo, cor);
                    const n = padrao ? itensDaColagem(porModeloCor.get(modelo)?.get(cor) ?? [], padrao.valores, substituir).length : 0;
                    return (
                      <label key={cor} className={`flex items-center gap-2 pl-9 pr-3 py-1.5 cursor-pointer ${n === 0 ? "opacity-60" : ""}`}
                        onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selecao.has(k)} onCheckedChange={(v) => alternarCor(k, v === true)} />
                        <span className="text-xs font-medium whitespace-nowrap">{modelo}</span>
                        <CorChip cor={cor} />
                        {padrao?.modelo === modelo && padrao?.cor === cor && <Badge variant="outline" className={BADGE_SM_CLASS}>origem</Badge>}
                        <span className="text-[11px] text-muted-foreground">{n === 0 ? "nada a mudar" : `${n} ${n === 1 ? "tamanho muda" : "tamanhos mudam"}`}</span>
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <DialogFooter className="sm:justify-between items-center gap-2">
            <span className="text-xs text-muted-foreground">{resumo.linhas} linhas, {resumo.cores} cores, {resumo.modelos} modelos</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={(e) => { e.stopPropagation(); setDlgAberto(false); }}>Cancelar</Button>
              <Button disabled={!itensColagem.length || salvarLote.isPending} onClick={(e) => { e.stopPropagation(); void colarPadrao(); }}>Colar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
