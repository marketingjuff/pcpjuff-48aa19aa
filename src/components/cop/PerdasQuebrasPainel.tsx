import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import type { PerdaConsolidada } from "@/lib/perdas-consolidado";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";

const NI = "Não informado";

type Props = {
  perdas: PerdaConsolidada[];
  motivoDe: (p: PerdaConsolidada) => string | null;
  onAbrirDetalhe: (p: PerdaConsolidada) => void;
};

type Def = { titulo: string; chave: (p: PerdaConsolidada) => string | null | undefined; excluirVazio?: boolean; porCor?: boolean };

function fmtDataBR(iso: string) {
  const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = onlyDate ? new Date(iso + "T00:00:00") : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function OrigemBadge({ p }: { p: PerdaConsolidada }) {
  if (p.origem === "pcp") return <Badge className="bg-blue-600 hover:bg-blue-600">PCP</Badge>;
  if (p.origem === "cop") return <Badge className="bg-green-600 hover:bg-green-600">COP</Badge>;
  return <Badge variant="secondary">Manual</Badge>;
}

function grupoDe(def: Def, p: PerdaConsolidada): string | null {
  const v = def.chave(p);
  if (v == null || v === "") return def.excluirVazio ? null : NI;
  return v;
}

const CORES_CLARAS = new Set(["branco", "areia", "verde agua", "amarelo"]);
const normCor = (c: string) => c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function MiniCard({ def, perdas, onBarra }: { def: Def; perdas: PerdaConsolidada[]; onBarra: (nome: string) => void }) {
  const { dados, total, semOficina } = useMemo(() => {
    const m = new Map<string, number>();
    let sem = 0;
    for (const p of perdas) {
      const g = grupoDe(def, p);
      if (g == null) { sem += p.qtd; continue; }
      m.set(g, (m.get(g) ?? 0) + p.qtd);
    }
    const arr = Array.from(m, ([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd);
    return { dados: arr, total: arr.reduce((s, x) => s + x.qtd, 0), semOficina: sem };
  }, [def, perdas]);

  const altura = Math.max(120, dados.length * 30 + 16);
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-sm font-medium">{def.titulo}</div>
        <div className="text-xs text-muted-foreground tabular-nums">{total} peças</div>
      </div>
      {perdas.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Sem dados para os filtros atuais.</div>
      ) : def.excluirVazio && dados.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Nenhuma perda com oficina no filtro atual.</div>
      ) : (
        <>
          <div style={{ height: altura }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados} layout="vertical" margin={{ left: 0, right: 56, top: 4, bottom: 4 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="nome" width={170} fontSize={11} interval={0} axisLine={false} tickLine={false} tickFormatter={(v: string) => (v.length > 28 ? v.slice(0, 27) + "…" : v)} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} formatter={(v: number) => [`${v} peças`, ""]} separator="" />
                <Bar dataKey="qtd" barSize={16} radius={[0, 4, 4, 0]} className="cursor-pointer" onClick={(d: { nome?: string; payload?: { nome: string } }) => onBarra(d.payload?.nome ?? d.nome ?? "")}>
                  {dados.map((d) => {
                    const fill = def.porCor ? corHex(d.nome) : d.nome === "Não informado" ? "#9ca3af" : "#16a34a";
                    const claro = def.porCor && CORES_CLARAS.has(normCor(d.nome));
                    return <Cell key={d.nome} fill={fill} stroke={claro ? "#d1d5db" : undefined} strokeWidth={claro ? 1 : 0} className="cursor-pointer" />;
                  })}
                  <LabelList dataKey="qtd" position="right" fontSize={11} fill="hsl(var(--foreground))" className="tabular-nums" formatter={(v: number) => `${v} · ${total ? Math.round((v / total) * 100) : 0}%`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {def.excluirVazio && semOficina > 0 && (
            <div className="text-xs text-muted-foreground mt-1">{semOficina} peças sem oficina não entram neste gráfico.</div>
          )}
        </>
      )}
    </div>
  );
}

export function PerdasQuebrasPainel({ perdas, motivoDe, onAbrirDetalhe }: Props) {
  const defs = useMemo<Def[]>(() => [
    { titulo: "Por área do erro", chave: (p) => p.area_erro ?? (p.erro_producao ? "Produção" : null) },
    { titulo: "Por motivo", chave: (p) => motivoDe(p) },
    { titulo: "Por área que identificou", chave: (p) => p.area_identificou },
    { titulo: "Por modelo", chave: (p) => p.modelo },
    { titulo: "Por cor", chave: (p) => p.cor, porCor: true },
    { titulo: "Por oficina", chave: (p) => p.oficina_nome, excluirVazio: true },
    { titulo: "Por destino", chave: (p) => p.destino },
  ], [motivoDe]);

  const [popup, setPopup] = useState<{ titulo: string; itens: PerdaConsolidada[] } | null>(null);

  const abrir = (def: Def, nome: string) => {
    const itens = perdas
      .filter((p) => grupoDe(def, p) === nome)
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
    setPopup({ titulo: `${def.titulo} · ${nome}`, itens });
  };

  const totalPopup = popup?.itens.reduce((s, p) => s + p.qtd, 0) ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Onde estamos perdendo</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {defs.map((d) => <MiniCard key={d.titulo} def={d} perdas={perdas} onBarra={(nome) => abrir(d, nome)} />)}
      </CardContent>

      <Dialog open={!!popup} onOpenChange={(v) => !v && setPopup(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{popup?.titulo}</DialogTitle>
            <DialogDescription>{totalPopup} peças em {popup?.itens.length ?? 0} lançamentos</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead><TableHead>Origem</TableHead><TableHead>Identificação</TableHead>
                  <TableHead>Modelo</TableHead><TableHead>Cor</TableHead><TableHead>Tam.</TableHead>
                  <TableHead className="text-right">Qtd</TableHead><TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {popup?.itens.map((p) => {
                  const hex = corHex(p.cor); const fg = corTextoSobre(hex);
                  return (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-accent/40" onClick={() => onAbrirDetalhe(p)}>
                      <TableCell className="text-sm tabular-nums">{fmtDataBR(p.data)}</TableCell>
                      <TableCell><OrigemBadge p={p} /></TableCell>
                      <TableCell className="text-sm">{p.identificacao ?? "—"}</TableCell>
                      <TableCell className="text-sm">{p.modelo}</TableCell>
                      <TableCell><span style={{ backgroundColor: hex, color: fg }} className="inline-block px-1.5 py-0.5 rounded text-xs">{p.cor}</span></TableCell>
                      <TableCell className="text-sm">{p.tamanho}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{p.qtd}</TableCell>
                      <TableCell className="text-sm">{motivoDe(p) ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
