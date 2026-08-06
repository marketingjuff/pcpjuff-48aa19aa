import { useEffect, useMemo, useRef, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { TIPOS_ESTAMPA, isAtrasadoSetor, tipoIncluiDTF, tipoIncluiSilk } from "@/lib/pedidos";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Settings, CalendarDays, Flag, Video, AlertTriangle, CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/format";
import { useFeriados } from "@/hooks/use-feriados";
import { useIsAdmin } from "@/hooks/use-role";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useCapacidade } from "@/hooks/use-capacidade";
import { addDiasUteis, isDiaUtil, todayISO } from "@/lib/dias-uteis";
import {
  ETAPAS, diasCorridosDaJanela, janelaMonitor, simularEtapa, inicioAcabamentoDoPedido,
  temSegundaOuQuinta, type Etapa, type ResultadoEtapa,
} from "@/lib/pcp-monitor";

import { COL_ID, ETAPA_COR, ETAPA_COR_BORDA, ETAPA_COR_CLARA, FaixaCalor, ReguaDatas } from "./FaixaCalor";
import { GanttPedidos } from "./GanttPedidos";
import { CapacidadeDialog } from "./CapacidadeDialog";
import { EditarDatasDialog, type ConflitoTipo } from "./EditarDatasDialog";

interface Props {
  pedidos: Pedido[];
  onSave: (p: Partial<Pedido> & { id: string }) => void;
  onNavigate?: (tab: string, pedidoId: string) => void;
  soLeitura?: boolean;
}

export function MonitorPcpTab({ pedidos, onSave, onNavigate, soLeitura = false }: Props) {
  const { feriados } = useFeriados();
  const isAdmin = useIsAdmin();
  const { tetos } = useCapacidade();
  const hoje = todayISO();

  const [zoom, setZoom] = usePersistedState<"semana" | "dia">("pcp:monitor:zoom", "dia");
  const [compacta, setCompacta] = usePersistedState<boolean>("pcp:monitor:faixaCompacta", false);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<string>("todos");
  const [soAtrasados, setSoAtrasados] = useState(false);
  const [capOpen, setCapOpen] = useState(false);
  const [detalhe, setDetalhe] = useState<Pedido | null>(null);
  const [edicao, setEdicao] = useState<{ pedido: Pedido; proposta: Partial<Pedido> | null; conflito: ConflitoTipo } | null>(null);

  const { de, ate } = useMemo(() => janelaMonitor(), []);
  // eixo de exibição: todos os dias corridos (sáb/dom/feriado aparecem em cinza)
  const dias = useMemo(() => diasCorridosDaJanela(de, ate), [de, ate]);
  const diaUtil = useMemo(() => (d: string) => isDiaUtil(new Date(d + "T00:00:00"), feriados), [feriados]);
  const colWidth = zoom === "dia" ? 52 : 9;


  const scrollRef = useRef<HTMLDivElement | null>(null);

  // posição de rolagem que deixa "hoje" logo no início da área visível
  function offsetHoje(el: HTMLDivElement) {
    const i = dias.indexOf(hoje);
    if (i < 0) return null;
    // mantém 2 colunas de contexto antes do dia vigente
    const pad = zoom === "dia" ? 2 : 6;
    return Math.max(0, (i - pad) * colWidth);
  }

  function irParaHoje() {
    const el = scrollRef.current;
    if (!el) return;
    const left = offsetHoje(el);
    if (left === null) return;
    el.scrollTo({ left, behavior: "smooth" });
  }

  // sempre que a janela/zoom mudar, reposiciona no dia vigente.
  // A aba pode estar montada escondida (forceMount): nesse caso a largura é 0 e
  // definir scrollLeft não tem efeito, então esperamos o container aparecer.
  useEffect(() => {
    if (dias.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    let feito = false;
    const aplica = () => {
      if (feito || el.clientWidth === 0) return;
      const left = offsetHoje(el);
      if (left === null) return;
      el.scrollLeft = left;
      if (el.scrollLeft > 0 || left === 0) feito = true;
    };
    aplica();
    const ro = new ResizeObserver(() => aplica());
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias, colWidth, hoje, zoom]);




  const naJanela = useMemo(() => {
    return pedidos.filter((p) => {
      if (p.finalizado_em) return false;
      const iniAcab = p.inicio_acabamento ?? inicioAcabamentoDoPedido(p, feriados);
      const datas = [p.arte_data, p.inicio_estamparia, iniAcab].filter(Boolean) as string[];
      if (datas.length === 0) return false;
      return datas.some((d) => d >= de && d <= ate);
    });
  }, [pedidos, feriados, de, ate]);

  const resultados = useMemo(() => {
    const out = {} as Record<Etapa, ResultadoEtapa>;
    for (const e of ETAPAS) out[e.key] = simularEtapa(naJanela, e.key, tetos[e.key], feriados);
    return out;
  }, [naJanela, tetos, feriados]);

  /** Etapas atrasadas pela regra oficial (`isAtrasadoSetor`): data-limite no passado e etapa não concluída. */
  function atrasos(p: Pedido): { etapa: Etapa; texto: string }[] {
    const out: { etapa: Etapa; texto: string }[] = [];
    if (isAtrasadoSetor(p, "arte"))
      out.push({ etapa: "arte", texto: `Arte atrasada — limite era ${formatDateBR(p.arte_data)} e não foi finalizada` });
    if (isAtrasadoSetor(p, "dtf"))
      out.push({ etapa: "dtf", texto: `DTF atrasado — início era ${formatDateBR(p.inicio_estamparia)} e ainda não foi estampado` });
    if (isAtrasadoSetor(p, "silk"))
      out.push({ etapa: "silk", texto: `Silk atrasado — início era ${formatDateBR(p.inicio_estamparia)} e ainda não foi batido` });
    if (isAtrasadoSetor(p, "acabamento"))
      out.push({ etapa: "acabamento", texto: `Acabamento atrasado — saída era ${formatDateBR(p.saida_juff)} e não foi embalado` });
    return out;
  }

  /** Etapa concluída pelos campos de execução. */
  function concluida(p: Pedido, etapa: Etapa): boolean {
    if (etapa === "arte") return p.status_arte === "Arte Finalizada";
    if (etapa === "dtf") return p.dtf_estampado === "Sim";
    if (etapa === "silk") return p.silk_feito === "Sim";
    return p.embalado === "Sim";
  }

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return naJanela
      .filter((p) => {
        if (tipo !== "todos" && p.tipo_estampa !== tipo) return false;
        if (q) {
          const alvo = `${p.pedido_olist ?? ""} ${p.orcamento ?? ""} ${p.vendedor ?? ""}`.toLowerCase();
          if (!alvo.includes(q)) return false;
        }
        if (soAtrasados) {
          const atrasado = (["arte", "dtf", "silk", "acabamento"] as const).some((s) => isAtrasadoSetor(p, s));
          if (!atrasado) return false;
        }
        return true;
      })
      .sort((a, b) => (a.saida_juff ?? "9999-12-31").localeCompare(b.saida_juff ?? "9999-12-31"));
  }, [naJanela, busca, tipo, soAtrasados]);

  /** Etapa já executada bloqueia o arrasto da linha. */
  function etapaTravada(p: Pedido): string | null {
    if (p.status_arte === "Finalizado" || p.status_arte === "Finalizada") return "Arte";
    if (tipoIncluiDTF(p.tipo_estampa ?? null) && p.dtf_estampado === "Sim") return "DTF";
    if (tipoIncluiSilk(p.tipo_estampa ?? null) && p.silk_feito === "Sim") return "Silk";
    if (p.embalado === "Sim") return "Acabamento";
    return null;
  }

  function arrastar(p: Pedido, offset: number) {
    if (soLeitura) return;
    const travada = etapaTravada(p);
    if (travada) { toast.error(`Não é possível mover: ${travada} já foi executada.`); return; }
    const mv = (d: string | null | undefined) => (d ? addDiasUteis(d, offset, feriados) : null);
    const proposta: Partial<Pedido> = {
      arte_data: mv(p.arte_data),
      inicio_estamparia: mv(p.inicio_estamparia),
      termino_estamparia: mv(p.termino_estamparia),
      termino_acabamento: mv(p.termino_acabamento),
    } as any;
    const merged = { ...p, ...proposta } as Pedido;
    const novoIniAcab = inicioAcabamentoDoPedido(merged, feriados);

    const estouraPrazo = !!merged.termino_acabamento && !!p.saida_juff && merged.termino_acabamento > p.saida_juff;
    const precisaVideo =
      !!p.necessita_captacao_video &&
      (tipoIncluiSilk(p.tipo_estampa ?? null) || tipoIncluiDTF(p.tipo_estampa ?? null));
    const semJanela = precisaVideo && !temSegundaOuQuinta(merged.inicio_estamparia, merged.termino_estamparia);

    if (estouraPrazo || semJanela) {
      setEdicao({ pedido: p, proposta, conflito: estouraPrazo ? "prazo" : "video" });
      return;
    }
    onSave({ id: p.id, ...proposta, inicio_acabamento: novoIniAcab } as any);
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-2.5 flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar por pedido, orçamento ou vendedor"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-8 w-[260px]"
          />
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os modelos</SelectItem>
              {TIPOS_ESTAMPA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant={soAtrasados ? "default" : "outline"} onClick={() => setSoAtrasados((v) => !v)}>
            Só atrasados
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Select value={zoom} onValueChange={(v) => setZoom(v as any)}>
              <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semana">Semana</SelectItem>
                <SelectItem value="dia">Dia</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={irParaHoje}>
              <CalendarDays className="h-4 w-4 mr-1" />Hoje
            </Button>
            {isAdmin && (
              <Button size="sm" variant="ghost" onClick={() => setCapOpen(true)} aria-label="Capacidade">
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Flag className="h-3 w-3 text-emerald-600" />Entrada do pedido</span>
            <span className="flex items-center gap-1"><span className={`h-2 w-4 rounded-sm ${ETAPA_COR.arte} inline-block`} />Arte (barra até o limite)</span>
            <span className="flex items-center gap-1"><span className={`h-2 w-4 rounded-sm ${ETAPA_COR.dtf} inline-block`} />DTF</span>
            <span className="flex items-center gap-1"><span className={`h-2 w-4 rounded-sm ${ETAPA_COR.silk} inline-block`} />Silk</span>
            <span className="flex items-center gap-1"><span className={`h-2 w-4 rounded-sm ${ETAPA_COR.acabamento} inline-block`} />Acabamento</span>
            <span className="flex items-center gap-1"><Flag className="h-3 w-3 text-rose-600" />Saída Juff</span>
            <span className="flex items-center gap-1">
              <span className={`h-2 w-4 rounded-sm ${ETAPA_COR.acabamento} inline-block`} />sólida = concluída
              <span className={`ml-1 h-2 w-4 rounded-sm border ${ETAPA_COR_BORDA.acabamento} ${ETAPA_COR_CLARA.acabamento} inline-block`} />clara = pendente
            </span>
            <span className="flex items-center gap-1"><Video className="h-3 w-3 text-violet-600" />captação de vídeo</span>
            <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-rose-600" />etapa atrasada</span>
            <span className="flex items-center gap-1"><CornerDownRight className="h-3 w-3 text-amber-600" />não cabe na capacidade</span>
          </div>
          <div className="w-full flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-200 inline-block" />até 80%</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-200 inline-block" />até 100%</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-rose-300 inline-block" />acima do teto</span>
            <span>·</span>
            <span>{linhas.length} pedido(s) · {formatDateBR(de)} a {formatDateBR(ate)}</span>
            {soLeitura && <Badge variant="outline">Somente leitura</Badge>}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div id="monitor-scroll" ref={scrollRef} className="overflow-auto max-h-[74vh]">
          <div style={{ width: COL_ID + dias.length * colWidth }}>
            <ReguaDatas dias={dias} zoom={zoom} colWidth={colWidth} hoje={hoje} diaUtil={diaUtil} />
            <FaixaCalor
              dias={dias}
              zoom={zoom}
              resultados={resultados}
              compacta={compacta}
              onToggleCompacta={() => setCompacta((v) => !v)}
              colWidth={colWidth}
              hoje={hoje}
              diaUtil={diaUtil}
            />
            <GanttPedidos
              pedidos={linhas}
              dias={dias}
              colWidth={colWidth}
              zoom={zoom}
              resultados={resultados}
              podeArrastar={!soLeitura}
              hoje={hoje}
              diaUtil={diaUtil}
              onAbrir={setDetalhe}
              onArrastar={arrastar}
              etapaTravada={etapaTravada}
              atrasos={atrasos}
              concluida={concluida}
            />

          </div>
        </div>
      </Card>


      <Sheet open={!!detalhe} onOpenChange={(v) => !v && setDetalhe(null)}>
        <SheetContent side="right" className="w-[360px]">
          <SheetHeader><SheetTitle>Pedido {detalhe?.pedido_olist ?? ""}</SheetTitle></SheetHeader>
          {detalhe && (
            <div className="mt-4 space-y-2 text-[12.5px]">
              <Linha k="Orçamento" v={detalhe.orcamento ?? "—"} />
              <Linha k="Vendedor" v={detalhe.vendedor ?? "—"} />
              <Linha k="Modelo" v={detalhe.tipo_estampa ?? "—"} />
              <Linha k="Qtd" v={String(detalhe.qtd ?? 0)} />
              <Linha k="Arte" v={formatDateBR(detalhe.arte_data)} />
              <Linha k="Estamparia" v={`${formatDateBR(detalhe.inicio_estamparia)} → ${formatDateBR(detalhe.termino_estamparia)}`} />
              <Linha
                k="Acabamento"
                v={`${formatDateBR(detalhe.inicio_acabamento ?? inicioAcabamentoDoPedido(detalhe, feriados))} → ${formatDateBR(detalhe.termino_acabamento)}`}
              />
              <Linha k="Saída Juff" v={formatDateBR(detalhe.saida_juff)} />
              <Linha k="Captação de vídeo" v={detalhe.necessita_captacao_video ? "Sim" : "Não"} />
              <div className="flex flex-wrap gap-2 pt-2">
                {!soLeitura && (
                  <Button size="sm" onClick={() => { setEdicao({ pedido: detalhe, proposta: null, conflito: null }); setDetalhe(null); }}>
                    Editar datas
                  </Button>
                )}
                {onNavigate && (
                  <Button size="sm" variant="outline" onClick={() => { onNavigate("dados", detalhe.id); setDetalhe(null); }}>
                    Abrir no Dados In
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CapacidadeDialog open={capOpen} onOpenChange={setCapOpen} tetos={tetos} />

      <EditarDatasDialog
        open={!!edicao}
        onOpenChange={(v) => { if (!v) setEdicao(null); }}
        pedido={edicao?.pedido ?? null}
        proposta={edicao?.proposta ?? null}
        conflito={edicao?.conflito ?? null}
        onSave={(p) => { onSave(p); setEdicao(null); }}
        onCancel={() => setEdicao(null)}
      />
    </div>
  );
}

function Linha({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b pb-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}
