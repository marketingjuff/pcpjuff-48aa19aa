import { useRef, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { tipoIncluiDTF, tipoIncluiSilk } from "@/lib/pedidos";
import { formatDateBR } from "@/lib/format";
import { AlertTriangle, Video, Flag } from "lucide-react";
import { useFeriados } from "@/hooks/use-feriados";
import { inicioAcabamentoDoPedido, type Etapa, type ResultadoEtapa } from "@/lib/pcp-monitor";
import { COL_ID, ETAPA_COR } from "./FaixaCalor";

interface Props {
  pedidos: Pedido[];
  dias: string[];
  colWidth: number;
  zoom: "semana" | "dia";
  resultados: Record<Etapa, ResultadoEtapa>;
  podeArrastar: boolean;
  hoje: string;
  onAbrir: (p: Pedido) => void;
  /** offset em dias úteis (positivo = futuro) */
  onArrastar: (p: Pedido, offsetDiasUteis: number) => void;
  etapaTravada: (p: Pedido) => string | null;
}

const ROW_H = 34;

export function GanttPedidos({
  pedidos, dias, colWidth, zoom, resultados, podeArrastar, hoje, onAbrir, onArrastar, etapaTravada,
}: Props) {
  const { feriados } = useFeriados();
  const idx = new Map(dias.map((d, i) => [d, i]));
  const total = dias.length * colWidth;
  const [drag, setDrag] = useState<{ id: string; dx: number } | null>(null);
  const startX = useRef(0);
  const passo = zoom === "semana" ? 5 : 1;

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
    const passos = Math.round(drag.dx / (colWidth * passo));
    setDrag(null);
    if (passos !== 0) onArrastar(p, passos * passo);
  }

  return (
    <div>
      {pedidos.map((p, i) => {
        const incluiDTF = tipoIncluiDTF(p.tipo_estampa ?? null);
        const incluiSilk = tipoIncluiSilk(p.tipo_estampa ?? null);
        const qtd = Number(p.qtd ?? 0);
        const arte = pos(p.arte_data);
        const estIni = pos(p.inicio_estamparia);
        const estFim = pos(p.termino_estamparia ?? p.inicio_estamparia);
        const iniAcab = p.inicio_acabamento ?? inicioAcabamentoDoPedido(p, feriados);
        const acIni = pos(iniAcab);
        const acFim = pos(p.termino_acabamento ?? iniAcab);
        const saida = pos(p.saida_juff);
        const travada = etapaTravada(p);
        const vazou = (["arte", "dtf", "silk", "acabamento"] as Etapa[]).some((e) => resultados[e]?.pedidosVazados.has(p.id));
        const dx = drag?.id === p.id ? drag.dx : 0;
        const zebra = i % 2 === 1 ? "bg-muted/25" : "bg-card";

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
                  {vazou && <AlertTriangle className="h-3 w-3 shrink-0 text-rose-600" />}
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
                    const sexta = new Date(d + "T00:00:00").getDay() === 5;
                    return (
                      <div
                        key={d}
                        style={{ width: colWidth }}
                        className={`${
                          d === hoje
                            ? "border-r-2 border-rose-500 bg-rose-500/10"
                            : sexta
                              ? "border-r-2 border-border/70"
                              : "border-r border-border/50"
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="absolute inset-0" style={{ transform: `translateX(${dx}px)` }}>
                  {arte !== null && (
                    <div
                      title={`Arte · ${formatDateBR(p.arte_data)}`}
                      className={`absolute h-2.5 w-2.5 rotate-45 ${ETAPA_COR.arte}`}
                      style={{ left: arte * colWidth + colWidth / 2 - 5, top: 4 }}
                    />
                  )}
                  {estIni !== null && estFim !== null && (
                    <div
                      title={`Estamparia${incluiDTF && incluiSilk ? " (DTF+Silk)" : incluiDTF ? " (DTF)" : incluiSilk ? " (Silk)" : ""} · ${formatDateBR(p.inicio_estamparia)} a ${formatDateBR(p.termino_estamparia ?? p.inicio_estamparia)} · ${qtd} pçs`}
                      className="absolute flex h-3 overflow-hidden rounded-sm"
                      style={{ left: estIni * colWidth + 1, width: Math.max(colWidth - 2, (estFim - estIni + 1) * colWidth - 2), top: 11 }}
                    >
                      {incluiDTF && <div className={`flex-1 ${ETAPA_COR.dtf}`} />}
                      {incluiSilk && <div className={`flex-1 ${ETAPA_COR.silk}`} />}
                      {!incluiDTF && !incluiSilk && <div className="flex-1 bg-slate-400" />}
                    </div>
                  )}
                  {acIni !== null && acFim !== null && (
                    <div
                      title={`Acabamento · ${formatDateBR(iniAcab)} a ${formatDateBR(p.termino_acabamento ?? iniAcab)} · ${qtd} pçs`}
                      className={`absolute h-2.5 rounded-sm ${ETAPA_COR.acabamento}`}
                      style={{ left: acIni * colWidth + 1, width: Math.max(colWidth - 2, (acFim - acIni + 1) * colWidth - 2), top: 22 }}
                    />
                  )}
                  {saida !== null && (
                    <Flag
                      title={`Saída Juff · ${formatDateBR(p.saida_juff)}`}
                      className="absolute h-3 w-3 text-rose-600"
                      style={{ left: saida * colWidth + colWidth / 2 - 6, top: 21 }}
                    />
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
