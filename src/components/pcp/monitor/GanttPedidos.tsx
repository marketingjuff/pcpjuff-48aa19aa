import { useRef, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { tipoIncluiDTF, tipoIncluiSilk } from "@/lib/pedidos";
import { formatDateBR } from "@/lib/format";
import { AlertTriangle, Video, Flag, CornerDownRight } from "lucide-react";
import { useFeriados } from "@/hooks/use-feriados";
import { inicioAcabamentoDoPedido, type Etapa, type ResultadoEtapa } from "@/lib/pcp-monitor";
import { COL_ID, ETAPA_COR, ETAPA_COR_BORDA, ETAPA_COR_CLARA } from "./FaixaCalor";

interface Props {
  pedidos: Pedido[];
  dias: string[];
  colWidth: number;
  zoom: "semana" | "dia";
  resultados: Record<Etapa, ResultadoEtapa>;
  podeArrastar: boolean;
  hoje: string;
  /** true = dia útil; dia não útil recebe fundo cinza na grade */
  diaUtil: (d: string) => boolean;
  onAbrir: (p: Pedido) => void;
  /** offset em dias úteis (positivo = futuro) */
  onArrastar: (p: Pedido, offsetDiasUteis: number) => void;
  etapaTravada: (p: Pedido) => string | null;
  /** etapas atrasadas (regra de `isAtrasadoSetor`) com texto do motivo */
  atrasos: (p: Pedido) => { etapa: Etapa; texto: string }[];
  /** etapa já concluída pelos campos de execução */
  concluida: (p: Pedido, etapa: Etapa) => boolean;
}

const ROW_H = 34;

export function GanttPedidos({
  pedidos, dias, colWidth, zoom, resultados, podeArrastar, hoje, diaUtil, onAbrir, onArrastar, etapaTravada,
  atrasos, concluida,
}: Props) {
  const { feriados } = useFeriados();
  const idx = new Map(dias.map((d, i) => [d, i]));
  const total = dias.length * colWidth;
  const [drag, setDrag] = useState<{ id: string; dx: number } | null>(null);
  const startX = useRef(0);
  // no zoom Semana uma coluna visual = 7 dias corridos, mas o deslocamento
  // de datas continua em dias úteis (1 semana = 5 dias úteis)
  const passoCol = zoom === "semana" ? 7 : 1;
  const passoDias = zoom === "semana" ? 5 : 1;



  function pos(dia: string | null | undefined): number | null {
    if (!dia) return null;
    if (idx.has(dia)) return idx.get(dia)!;
    // fora da janela: ancora no limite
    if (dia < dias[0]!) return 0;
    if (dia > dias[dias.length - 1]!) return dias.length - 1;
    // fim de semana/feriado: pega o próximo dia da grade
    for (let i = 0; i < dias.length; i++) if (dias[i]! >= dia) return i;
    return null;
  }

  function onPointerDown(e: React.PointerEvent, p: Pedido) {
    if (!podeArrastar || etapaTravada(p)) return;
    startX.current = e.clientX;
    setDrag({ id: p.id, dx: 0 });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent, p: Pedido) {
    if (!drag || drag.id !== p.id) return;
    setDrag({ id: p.id, dx: e.clientX - startX.current });
  }
  function onPointerUp(p: Pedido) {
    if (!drag || drag.id !== p.id) return;
    const passos = Math.round(drag.dx / (colWidth * passoCol));
    setDrag(null);
    if (passos !== 0) onArrastar(p, passos * passoDias);

  }

  return (
    <div>
      {pedidos.map((p, i) => {
        const incluiDTF = tipoIncluiDTF(p.tipo_estampa ?? null);
        const incluiSilk = tipoIncluiSilk(p.tipo_estampa ?? null);
        const qtd = Number(p.qtd ?? 0);
        const entrada = pos(p.entrada_pedido);
        const arte = pos(p.arte_data);
        const arteIni =
          p.entrada_pedido && p.arte_data && p.entrada_pedido <= p.arte_data ? pos(p.entrada_pedido) : null;
        const estIni = pos(p.inicio_estamparia);
        const estFim = pos(p.termino_estamparia ?? p.inicio_estamparia);
        const iniAcab = p.inicio_acabamento ?? inicioAcabamentoDoPedido(p, feriados);
        const acIni = pos(iniAcab);
        const acFim = pos(p.termino_acabamento ?? iniAcab);
        const saida = pos(p.saida_juff);
        const travada = etapaTravada(p);
        const vazou = (["arte", "dtf", "silk", "acabamento"] as Etapa[]).some((e) => resultados[e]?.pedidosVazados.has(p.id));
        const lista = atrasos(p);
        const atrasadas = new Set(lista.map((a) => a.etapa));
        const tituloAtraso = lista.map((a) => a.texto).join("\n");
        const dx = drag?.id === p.id ? drag.dx : 0;
        const zebra = i % 2 === 1 ? "bg-surface-muted" : "bg-card";

        const arteOk = concluida(p, "arte");
        const dtfOk = concluida(p, "dtf");
        const silkOk = concluida(p, "silk");
        const acabOk = concluida(p, "acabamento");
        const estOk = (incluiDTF ? dtfOk : true) && (incluiSilk ? silkOk : true);
        const estAtrasada = atrasadas.has("dtf") || atrasadas.has("silk");

        return (
          <div key={p.id} className={`relative border-b ${zebra} hover:bg-accent/40`}>
            <div className="flex">
              <button
                onClick={() => onAbrir(p)}
                className={`sticky left-0 z-10 shrink-0 border-r px-2 text-left text-[10.5px] leading-tight ${zebra}`}
                style={{ width: COL_ID, height: ROW_H }}
              >
                <div className="flex items-center gap-1">
                  <span className="truncate font-semibold">#{p.pedido_olist ?? "—"}</span>
                  <span className="text-muted-foreground tabular-nums">{qtd} pçs</span>
                  {p.necessita_captacao_video && <Video className="h-3 w-3 shrink-0 text-violet-600" />}
                  {lista.length > 0 && (
                    <span title={tituloAtraso} className="shrink-0">
                      <AlertTriangle className="h-3 w-3 text-rose-600" />
                    </span>
                  )}
                  {vazou && (
                    <span
                      title="Não cabe na capacidade: parte da carga escorregou para depois do término planejado"
                      className="shrink-0"
                    >
                      <CornerDownRight className="h-3 w-3 text-amber-600" />
                    </span>
                  )}
                </div>
                <div className="truncate text-[9.5px] text-muted-foreground">
                  {p.orcamento ?? "—"} · {p.tipo_estampa ?? "—"}
                </div>
              </button>
              <div
                className={`relative ${podeArrastar && !travada ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
                style={{ width: total, height: ROW_H }}
                title={travada ? `Etapa já executada: ${travada}` : undefined}
                onPointerDown={(e) => onPointerDown(e, p)}
                onPointerMove={(e) => onPointerMove(e, p)}
                onPointerUp={() => onPointerUp(p)}
                onPointerCancel={() => setDrag(null)}
              >
                {/* grade */}
                <div className="pointer-events-none absolute inset-0 flex">
                  {dias.map((d) => {
                    const domingo = new Date(d + "T00:00:00").getDay() === 0;
                    const naoUtil = !diaUtil(d);
                    return (
                      <div
                        key={d}
                        style={{ width: colWidth }}
                        className={`${
                          d === hoje
                            ? "border-r-2 border-rose-500 bg-rose-500/10"
                            : domingo
                              ? "border-r-2 border-border/70"
                              : "border-r border-border/50"
                        } ${d !== hoje && naoUtil ? "bg-muted/70" : ""}`}
                      />
                    );

                  })}
                </div>
                <div className="absolute inset-0" style={{ transform: `translateX(${dx}px)` }}>
                  {entrada !== null && (
                    <span
                      title={`Entrada do pedido · ${formatDateBR(p.entrada_pedido)}`}
                      className="absolute"
                      style={{ left: entrada * colWidth + colWidth / 2 - 6, top: 1 }}
                    >
                      <Flag className="h-3 w-3 text-emerald-600" />
                    </span>
                  )}
                  {arte !== null && arteIni !== null ? (
                    <div
                      title={`Arte · janela ${formatDateBR(p.entrada_pedido)} até o limite ${formatDateBR(p.arte_data)} · ${arteOk ? "Concluída" : "Pendente"}${atrasadas.has("arte") ? " · ATRASADA" : ""}`}
                      className={`absolute flex h-2.5 items-center justify-end rounded-sm ${
                        arteOk ? ETAPA_COR.arte : `${ETAPA_COR_CLARA.arte} border ${ETAPA_COR_BORDA.arte}`
                      }`}
                      style={{
                        left: arteIni * colWidth + 1,
                        width: Math.max(colWidth - 2, (arte - arteIni + 1) * colWidth - 2),
                        top: 3,
                      }}
                    >
                      <span className={`mr-0 h-2.5 w-[3px] rounded-r-sm ${ETAPA_COR.arte}`} />
                      {arteOk && <span className="ml-0.5 mr-0.5 text-[7px] font-bold leading-none text-white">✓</span>}
                      {atrasadas.has("arte") && (
                        <AlertTriangle className="ml-0.5 mr-0.5 h-2 w-2 shrink-0 text-rose-600" />
                      )}
                    </div>
                  ) : (
                    arte !== null && (
                      <div
                        title={`Arte (limite) · ${formatDateBR(p.arte_data)} · ${arteOk ? "Concluída" : "Pendente"}`}
                        className={`absolute h-2.5 w-2.5 rotate-45 ${
                          arteOk ? ETAPA_COR.arte : `${ETAPA_COR_CLARA.arte} border ${ETAPA_COR_BORDA.arte}`
                        }`}
                        style={{ left: arte * colWidth + colWidth / 2 - 5, top: 3 }}
                      />
                    )
                  )}
                  {estIni !== null && estFim !== null && (
                    <div
                      title={`Estamparia${incluiDTF && incluiSilk ? " (DTF+Silk)" : incluiDTF ? " (DTF)" : incluiSilk ? " (Silk)" : ""} · ${formatDateBR(p.inicio_estamparia)} a ${formatDateBR(p.termino_estamparia ?? p.inicio_estamparia)} · ${qtd} pçs · ${estOk ? "Concluída" : "Pendente"}${estAtrasada ? " · ATRASADA" : ""}`}
                      className="absolute flex h-3 items-center overflow-hidden rounded-sm"
                      style={{ left: estIni * colWidth + 1, width: Math.max(colWidth - 2, (estFim - estIni + 1) * colWidth - 2), top: 12 }}
                    >
                      {incluiDTF && (
                        <div
                          className={`h-full flex-1 ${dtfOk ? ETAPA_COR.dtf : `${ETAPA_COR_CLARA.dtf} border ${ETAPA_COR_BORDA.dtf}`}`}
                        />
                      )}
                      {incluiSilk && (
                        <div
                          className={`h-full flex-1 ${silkOk ? ETAPA_COR.silk : `${ETAPA_COR_CLARA.silk} border ${ETAPA_COR_BORDA.silk}`}`}
                        />
                      )}
                      {!incluiDTF && !incluiSilk && <div className="h-full flex-1 bg-slate-400" />}
                      {estOk && (
                        <span className="absolute right-0.5 text-[7px] font-bold leading-none text-white">✓</span>
                      )}
                      {estAtrasada && (
                        <AlertTriangle className="absolute right-0.5 h-2 w-2 text-rose-600" />
                      )}
                    </div>
                  )}
                  {acIni !== null && acFim !== null && (
                    <div
                      title={`Acabamento · ${formatDateBR(iniAcab)} a ${formatDateBR(p.termino_acabamento ?? iniAcab)} · ${qtd} pçs · ${acabOk ? "Concluída" : "Pendente"}${atrasadas.has("acabamento") ? " · ATRASADA" : ""}`}
                      className={`absolute flex h-2.5 items-center justify-end rounded-sm ${
                        acabOk ? ETAPA_COR.acabamento : `${ETAPA_COR_CLARA.acabamento} border ${ETAPA_COR_BORDA.acabamento}`
                      }`}
                      style={{ left: acIni * colWidth + 1, width: Math.max(colWidth - 2, (acFim - acIni + 1) * colWidth - 2), top: 24 }}
                    >
                      {acabOk && <span className="mr-0.5 text-[7px] font-bold leading-none text-white">✓</span>}
                      {atrasadas.has("acabamento") && (
                        <AlertTriangle className="mr-0.5 h-2 w-2 shrink-0 text-rose-600" />
                      )}
                    </div>
                  )}
                  {saida !== null && (
                    <span
                      title={`Saída Juff · ${formatDateBR(p.saida_juff)}`}
                      className="absolute"
                      style={{ left: saida * colWidth + colWidth / 2 - 6, top: 23 }}
                    >
                      <Flag className="h-3 w-3 text-rose-600" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {pedidos.length === 0 && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Nenhum pedido com datas de produção na janela.
        </div>
      )}
    </div>
  );
}
