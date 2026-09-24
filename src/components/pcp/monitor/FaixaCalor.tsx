import { formatDateBR } from "@/lib/format";
import { ETAPAS, agruparPorSemana, type Etapa, type ResultadoEtapa } from "@/lib/pcp-monitor";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Cor fixa por etapa, usada no Gantt, na faixa de calor e na legenda. */
export const ETAPA_COR: Record<Etapa, string> = {
  arte: "bg-sky-500",
  dtf: "bg-indigo-500",
  silk: "bg-fuchsia-500",
  acabamento: "bg-emerald-500",
};

/** Versão clara (etapa pendente). */
export const ETAPA_COR_CLARA: Record<Etapa, string> = {
  arte: "bg-sky-500/20",
  dtf: "bg-indigo-500/20",
  silk: "bg-fuchsia-500/20",
  acabamento: "bg-emerald-500/20",
};

/** Contorno na cor da etapa (etapa pendente). */
export const ETAPA_COR_BORDA: Record<Etapa, string> = {
  arte: "border-sky-500",
  dtf: "border-indigo-500",
  silk: "border-fuchsia-500",
  acabamento: "border-emerald-500",
};

/** Largura da coluna fixa de identificação do pedido. */
export const COL_ID = 150;
/** Altura total da régua de datas (linha de mês + linha de dia/semana). */
export const REGUA_H = 44;

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export type Coluna = { key: string; dias: string[] };

export function colunasDaGrade(dias: string[], zoom: "semana" | "dia"): Coluna[] {
  return zoom === "dia"
    ? dias.map((d) => ({ key: d, dias: [d] }))
    : agruparPorSemana(dias).map((s) => ({ key: s.semana, dias: s.dias }));
}

function rotuloColuna(c: Coluna, zoom: "semana" | "dia"): { l1: string; l2: string } {
  const ini = c.dias[0]!;
  const fim = c.dias[c.dias.length - 1]!;
  if (zoom === "dia") {
    const d = new Date(ini + "T00:00:00");
    return { l1: DOW[d.getDay()]!, l2: String(d.getDate()) };
  }
  const a = new Date(ini + "T00:00:00");
  const b = new Date(fim + "T00:00:00");
  return { l1: `${a.getDate()}–${b.getDate()}`, l2: MESES[b.getMonth()]! };
}

interface ReguaProps {
  dias: string[];
  zoom: "semana" | "dia";
  colWidth: number;
  hoje: string;
  /** true = dia útil; falso pinta a coluna de cinza (sáb/dom/feriado) */
  diaUtil: (d: string) => boolean;
}

/** Régua de datas fixa no topo da área de rolagem. */
export function ReguaDatas({ dias, zoom, colWidth, hoje, diaUtil }: ReguaProps) {
  const colunas = colunasDaGrade(dias, zoom);

  // agrupamento de meses na linha de cima
  const meses: { key: string; label: string; width: number }[] = [];
  for (const c of colunas) {
    const d = new Date(c.dias[c.dias.length - 1]! + "T00:00:00");
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = `${MESES[d.getMonth()]!.toUpperCase()} ${d.getFullYear()}`;
    const w = colWidth * c.dias.length;
    const last = meses[meses.length - 1];
    if (last && last.key === key) last.width += w;
    else meses.push({ key, label, width: w });
  }

  return (
    <div className="sticky top-0 z-30 bg-card" style={{ height: REGUA_H }}>
      <div className="flex border-b">
        <div
          className="sticky left-0 z-10 shrink-0 border-r bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ width: COL_ID, height: 18 }}
        >
          Pedido
        </div>
        <div className="flex">
          {meses.map((m) => (
            <div
              key={m.key}
              style={{ width: m.width, height: 18 }}
              className="overflow-hidden border-r-2 border-border px-1 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {m.label}
            </div>
          ))}
        </div>
      </div>
      <div className="flex border-b">
        <div className="sticky left-0 z-10 shrink-0 border-r bg-card" style={{ width: COL_ID, height: 26 }} />
        <div className="flex">
          {colunas.map((c) => {
            const contemHoje = c.dias.includes(hoje);
            const { l1, l2 } = rotuloColuna(c, zoom);
            const naoUtil = zoom === "dia" && !diaUtil(c.dias[0]!);
            const domingo = zoom === "dia" && new Date(c.dias[0]! + "T00:00:00").getDay() === 0;
            return (
              <div
                key={c.key}
                title={
                  c.dias.length > 1
                    ? `${formatDateBR(c.dias[0]!)} a ${formatDateBR(c.dias[c.dias.length - 1]!)}`
                    : formatDateBR(c.dias[0]!) + (naoUtil ? " · dia não útil" : "")
                }
                style={{ width: colWidth * c.dias.length, height: 26 }}
                className={`flex flex-col items-center justify-center overflow-hidden leading-none ${
                  domingo || zoom === "semana" ? "border-r-2 border-border" : "border-r border-border/60"
                } ${contemHoje ? "bg-rose-500/10" : naoUtil ? "bg-muted" : ""}`}
              >
                <span className={`text-[8.5px] ${naoUtil ? "text-muted-foreground/60" : "text-muted-foreground"}`}>{l1}</span>
                <span
                  className={`text-[9.5px] tabular-nums ${
                    contemHoje ? "font-bold text-rose-600" : naoUtil ? "text-muted-foreground/60" : "font-medium"
                  }`}
                >
                  {l2}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


interface Props {
  dias: string[];
  zoom: "semana" | "dia";
  resultados: Record<Etapa, ResultadoEtapa>;
  compacta: boolean;
  onToggleCompacta: () => void;
  colWidth: number;
  hoje: string;
  /** true = dia útil; dia não útil fica cinza e vazio */
  diaUtil: (d: string) => boolean;
  /** clique no número: abre a lista de pedidos que compõem a soma */
  onAbrirCelula?: (info: { etapa: Etapa; ini: string; fim: string; pedidoIds: string[] }) => void;
}

const fmtNum = (n: number) => n.toLocaleString("pt-BR");

export function FaixaCalor({ dias, zoom, resultados, compacta, onToggleCompacta, colWidth, hoje, diaUtil, onAbrirCelula }: Props) {
  const colunas = colunasDaGrade(dias, zoom);

  return (
    <div className="sticky z-20 border-b bg-card" style={{ top: REGUA_H }}>
      <div className="sticky left-0 flex items-center justify-between bg-card px-2 py-0.5" style={{ width: COL_ID + 240 }}>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Peças programadas por dia
        </div>
        <Button variant="ghost" size="sm" className="h-6" onClick={onToggleCompacta}>
          {compacta ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          <span className="ml-1 text-[10px]">{compacta ? "Expandir" : "Recolher"}</span>
        </Button>
      </div>
      {!compacta && (
        <div>
          {ETAPAS.map((e) => {
            const res = resultados[e.key];
            return (
              <div key={e.key} className="flex items-center border-t">
                <div
                  className="sticky left-0 z-10 shrink-0 border-r bg-card px-2 py-0.5 text-[11px] font-medium"
                  style={{ width: COL_ID }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-sm ${ETAPA_COR[e.key]}`} />
                    {e.label}
                  </span>
                </div>
                <div className="flex">
                  {colunas.map((c) => {
                    const naoUtil = zoom === "dia" && !diaUtil(c.dias[0]!);
                    let pecas = 0;
                    let nPed = 0;
                    const ids: string[] = [];
                    for (const d of c.dias) {
                      const dc = res?.porDia.get(d);
                      if (dc) {
                        pecas += dc.carga;
                        nPed += dc.pedidos;
                        ids.push(...dc.pedidoIds);
                      }
                    }
                    const contemHoje = c.dias.includes(hoje);
                    const ini = c.dias[0]!;
                    const fim = c.dias[c.dias.length - 1]!;
                    let titulo: string;
                    if (naoUtil) titulo = `${formatDateBR(ini)} · dia não útil — não se produz`;
                    else if (zoom === "semana")
                      titulo = `${formatDateBR(ini)} a ${formatDateBR(fim)} · ${e.label} — ${fmtNum(pecas)} peças`;
                    else {
                      const dd = new Date(ini + "T00:00:00");
                      titulo = `${DOW[dd.getDay()]} ${formatDateBR(ini)} · ${e.label} — ${fmtNum(pecas)} peças em ${nPed} pedido(s)`;
                    }
                    const w = colWidth * c.dias.length;
                    const texto = fmtNum(pecas);
                    const fonte = w < texto.length * 6 + 4 ? "text-[7.5px]" : "text-[9.5px]";
                    return (
                      <div
                        key={c.key}
                        title={titulo}
                        style={{ width: w }}
                        className={`relative flex h-6 items-center justify-center overflow-hidden border-r border-border/60 leading-none ${
                          naoUtil ? "bg-muted" : "bg-muted/30"
                        } ${contemHoje ? "ring-1 ring-inset ring-rose-500" : ""}`}
                      >
                        {!naoUtil && pecas > 0 && (
                          <button
                            type="button"
                            onClick={() => onAbrirCelula?.({ etapa: e.key, ini, fim, pedidoIds: ids })}
                            className={`${fonte} h-full w-full cursor-pointer font-semibold tabular-nums text-foreground/85 hover:bg-foreground/10 hover:underline`}
                          >
                            {texto}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
