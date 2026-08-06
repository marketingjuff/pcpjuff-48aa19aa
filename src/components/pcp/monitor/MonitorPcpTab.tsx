import { useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { TIPOS_ESTAMPA, tipoIncluiDTF, tipoIncluiSilk } from "@/lib/pedidos";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Settings, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/format";
import { useFeriados } from "@/hooks/use-feriados";
import { useIsAdmin } from "@/hooks/use-role";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useCapacidade } from "@/hooks/use-capacidade";
import { addDiasUteis, todayISO } from "@/lib/dias-uteis";
import {
  ETAPAS, diasDaJanela, janelaMonitor, simularEtapa, inicioAcabamentoDoPedido,
  temSegundaOuQuinta, type Etapa, type ResultadoEtapa,
} from "@/lib/pcp-monitor";
import { FaixaCalor } from "./FaixaCalor";
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

  const [zoom, setZoom] = usePersistedState<"semana" | "dia">("pcp:monitor:zoom", "semana");
  const [compacta, setCompacta] = usePersistedState<boolean>("pcp:monitor:faixaCompacta", false);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<string>("todos");
  const [soAtrasados, setSoAtrasados] = useState(false);
  const [capOpen, setCapOpen] = useState(false);
  const [detalhe, setDetalhe] = useState<Pedido | null>(null);
  const [edicao, setEdicao] = useState<{ pedido: Pedido; proposta: Partial<Pedido> | null; conflito: ConflitoTipo } | null>(null);

  const { de, ate } = useMemo(() => janelaMonitor(), []);
  const dias = useMemo(() => diasDaJanela(de, ate, feriados), [de, ate, feriados]);
  const colWidth = zoom === "dia" ? 22 : 9;

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
          const atrasado =
            (!!p.termino_acabamento && !!p.saida_juff && p.termino_acabamento > p.saida_juff) ||
            (["arte", "dtf", "silk", "acabamento"] as Etapa[]).some((e) => resultados[e]?.pedidosVazados.has(p.id));
          if (!atrasado) return false;
        }
        return true;
      })
      .sort((a, b) => (a.saida_juff ?? "9999-12-31").localeCompare(b.saida_juff ?? "9999-12-31"));
  }, [naJanela, busca, tipo, soAtrasados, resultados]);

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
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const el = document.getElementById("monitor-scroll");
                const i = dias.indexOf(hoje);
                if (el && i >= 0) el.scrollTo({ left: Math.max(0, i * colWidth - 200), behavior: "smooth" });
              }}
            >
              <CalendarDays className="h-4 w-4 mr-1" />Hoje
            </Button>
            {isAdmin && (
              <Button size="sm" variant="ghost" onClick={() => setCapOpen(true)} aria-label="Capacidade">
                <Settings className="h-4 w-4" />
              </Button>
            )}
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
        <div id="monitor-scroll" className="overflow-auto max-h-[74vh]">
          <div style={{ width: 150 + dias.length * colWidth }}>
            <FaixaCalor
              dias={dias}
              zoom={zoom}
              resultados={resultados}
              compacta={compacta}
              onToggleCompacta={() => setCompacta((v) => !v)}
              colWidth={colWidth}
              hoje={hoje}
            />
            <GanttPedidos
              pedidos={linhas}
              dias={dias}
              colWidth={colWidth}
              zoom={zoom}
              resultados={resultados}
              podeArrastar={!soLeitura}
              hoje={hoje}
              onAbrir={setDetalhe}
              onArrastar={arrastar}
              etapaTravada={etapaTravada}
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
