import { formatDateBR } from "@/lib/format";
import { ETAPAS, NIVEL_BG, agruparPorSemana, nivelDoDia, type Etapa, type ResultadoEtapa } from "@/lib/pcp-monitor";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  dias: string[];
  zoom: "semana" | "dia";
  resultados: Record<Etapa, ResultadoEtapa>;
  compacta: boolean;
  onToggleCompacta: () => void;
  colWidth: number;
  hoje: string;
}

export function FaixaCalor({ dias, zoom, resultados, compacta, onToggleCompacta, colWidth, hoje }: Props) {
  const colunas = zoom === "dia" ? dias.map((d) => ({ key: d, dias: [d] })) : agruparPorSemana(dias).map((s) => ({ key: s.semana, dias: s.dias }));
  const etapas = compacta ? [ETAPAS[0]!] : ETAPAS;

  return (
    <div className="sticky top-[52px] z-20 border-b bg-card">
      <div className="flex items-center justify-between px-2 py-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Faixa de calor {compacta ? "(recolhida)" : "por etapa"}
        </div>
        <Button variant="ghost" size="sm" onClick={onToggleCompacta}>
          {compacta ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          <span className="ml-1 text-[11px]">{compacta ? "Expandir" : "Recolher"}</span>
        </Button>
      </div>
      <div className="overflow-hidden">
        {etapas.map((e) => {
          const res = resultados[e.key];
          return (
            <div key={e.key} className="flex items-center border-t">
              <div className="w-[150px] shrink-0 px-2 py-1 text-[11.5px] font-medium">{compacta ? "Todas as etapas" : e.label}</div>
              <div className="flex">
                {colunas.map((c) => {
                  const alvo = compacta ? ETAPAS : [e];
                  let pior = 0;
                  let limite = 0;
                  let titulo: string[] = [];
                  for (const et of alvo) {
                    const r = compacta ? resultados[et.key] : res;
                    for (const d of c.dias) {
                      const dc = r?.porDia.get(d);
                      const nv = nivelDoDia(dc);
                      const peso = nv === "estouro" ? 3 : nv === "atencao" ? 2 : nv === "ok" ? 1 : 0;
                      if (peso >= 2) limite++;
                      if (peso > pior) pior = peso;
                      if (dc && dc.carga > 0) {
                        titulo.push(`${formatDateBR(d)} · ${et.label}: ${dc.carga}/${dc.tetoEfetivo}`);
                      }
                    }
                  }
                  const nivel = pior === 3 ? "estouro" : pior === 2 ? "atencao" : pior === 1 ? "ok" : "vazio";
                  const contemHoje = c.dias.includes(hoje);
                  return (
                    <div
                      key={c.key}
                      title={titulo.slice(0, 8).join("\n") || formatDateBR(c.dias[0]!)}
                      style={{ width: colWidth * c.dias.length }}
                      className={`h-6 border-r border-white/60 ${NIVEL_BG[nivel]} ${contemHoje ? "ring-1 ring-inset ring-rose-500" : ""} flex items-center justify-center`}
                    >
                      {zoom === "semana" && limite > 0 && (
                        <span className="text-[9.5px] font-semibold tabular-nums text-foreground/70">{limite}/{c.dias.length}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
