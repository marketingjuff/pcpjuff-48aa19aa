import { useRef, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { tipoIncluiDTF, tipoIncluiSilk } from "@/lib/pedidos";
import { formatDateBR } from "@/lib/format";
import { AlertTriangle, Video, Flag } from "lucide-react";
import { useFeriados } from "@/hooks/use-feriados";
import { inicioAcabamentoDoPedido, type Etapa, type ResultadoEtapa } from "@/lib/pcp-monitor";

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
    <div className="divide-y">
      {pedidos.map((p) => {
        const incluiDTF = tipoIncluiDTF(p.tipo_estampa ?? null);
        const incluiSilk = tipoIncluiSilk(p.tipo_estampa ?? null);
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

        return (
          <div key={p.id} className="relative hover:bg-accent/40">
            <div className="flex">
              <button
                onClick={() => onAbrir(p)}
                className="w-[150px] shrink-0 px-2 py-1.5 text-left text-[11.5px] leading-tight"
              >
                <div className="font-semibold truncate">#{p.pedido_olist ?? "—"}</div>
                <div className="text-muted-foreground truncate">
                  {p.orcamento ?? "—"} · {p.qtd ?? 0} pçs
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="truncate">{p.tipo_estampa ?? "—"}</span>
                  {p.necessita_captacao_video && <Video className="h-3 w-3 text-violet-600" />}
                  {vazou && <AlertTriangle className="h-3 w-3 text-rose-600" />}
                </div>
              </button>
              <div
                className={`relative ${podeArrastar && !travada ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
                style={{ width: total, height: 46 }}
                title={travada ? `Etapa já executada: ${travada}` : undefined}
                onPointerDown={(e) => onPointerDown(e, p)}
                onPointerMove={(e) => onPointerMove(e, p)}
                onPointerUp={() => onPointerUp(p)}
                onPointerCancel={() => setDrag(null)}
              >
                {/* grade */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {dias.map((d) => (
                    <div
                      key={d}
                      style={{ width: colWidth }}
                      className={`border-r ${d === hoje ? "border-rose-500 border-r-2" : "border-border/40"}`}
                    />
                  ))}
                </div>
                <div className="absolute inset-0" style={{ transform: `translateX(${dx}px)` }}>
                  {arte !== null && (
                    <div
                      title={`Arte · ${formatDateBR(p.arte_data)}`}
                      className="absolute h-3 w-3 rotate-45 bg-sky-500"
                      style={{ left: arte * colWidth + colWidth / 2 - 6, top: 6 }}
                    />
                  )}
                  {estIni !== null && estFim !== null && (
                    <div
                      title={`Estamparia · ${formatDateBR(p.inicio_estamparia)} → ${formatDateBR(p.termino_estamparia)}`}
                      className="absolute h-3.5 rounded-sm overflow-hidden flex"
                      style={{ left: estIni * colWidth + 1, width: Math.max(colWidth - 2, (estFim - estIni + 1) * colWidth - 2), top: 14 }}
                    >
                      {incluiDTF && <div className="flex-1 bg-indigo-500" />}
                      {incluiSilk && <div className="flex-1 bg-fuchsia-500" />}
                      {!incluiDTF && !incluiSilk && <div className="flex-1 bg-slate-400" />}
                    </div>
                  )}
                  {acIni !== null && acFim !== null && (
                    <div
                      title={`Acabamento · ${formatDateBR(iniAcab)} → ${formatDateBR(p.termino_acabamento)}`}
                      className="absolute h-3 rounded-sm bg-emerald-500"
                      style={{ left: acIni * colWidth + 1, width: Math.max(colWidth - 2, (acFim - acIni + 1) * colWidth - 2), top: 30 }}
                    />
                  )}
                  {saida !== null && (
                    <Flag
                      className="absolute h-3.5 w-3.5 text-rose-600"
                      style={{ left: saida * colWidth + colWidth / 2 - 7, top: 28 }}
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
