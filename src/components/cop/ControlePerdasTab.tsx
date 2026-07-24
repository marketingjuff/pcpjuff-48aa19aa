import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, History as HistoryIcon } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { usePerdasConsolidadas, type PerdaConsolidada } from "@/lib/perdas-consolidado";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { useIsAdmin } from "@/hooks/use-role";
import { PerdaDetalheDialog } from "./PerdaDetalheDialog";
import { CorrigirPerdaDialog } from "./CorrigirPerdaDialog";
import { RegistrarPerdaManualDialog } from "./RegistrarPerdaManualDialog";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function ano(d: string) { return new Date(d).getFullYear(); }
function mes(d: string) { return new Date(d).getMonth(); }
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
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant="secondary">Manual</Badge>
      {p.reclassificada && <span title="Reclassificada — origem PCP"><HistoryIcon className="h-3.5 w-3.5 text-amber-700" aria-label="Reclassificada — origem PCP" /></span>}
    </span>
  );
}

export function ControlePerdasTab() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const { perdas, isLoading, oficinas } = usePerdasConsolidadas();

  const anosDisp = useMemo(() => {
    const s = new Set<number>();
    for (const p of perdas) s.add(ano(p.data));
    const arr = Array.from(s).sort((a, b) => b - a);
    const atual = new Date().getFullYear();
    if (!arr.includes(atual)) arr.unshift(atual);
    return arr;
  }, [perdas]);

  const [filtroAno, setFiltroAno] = useState<number>(new Date().getFullYear());
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [filtroOrigem, setFiltroOrigem] = useState<string>("todas");
  const [filtroMotivo, setFiltroMotivo] = useState<string>("todos");
  const [filtroOficina, setFiltroOficina] = useState<string>("todas");
  const [busca, setBusca] = useState<string>("");

  const [detalhe, setDetalhe] = useState<PerdaConsolidada | null>(null);
  const [corrigir, setCorrigir] = useState<PerdaConsolidada | null>(null);
  const [novoManual, setNovoManual] = useState(false);

  const motivos = useMemo(() => {
    const s = new Set<string>();
    for (const p of perdas) if (p.motivo) s.add(p.motivo);
    return Array.from(s).sort();
  }, [perdas]);

  const filtradas = useMemo(() => {
    return perdas.filter((p) => {
      if (ano(p.data) !== filtroAno) return false;
      if (filtroMes !== "todos" && String(mes(p.data)) !== filtroMes) return false;
      if (filtroOrigem !== "todas" && p.origem !== filtroOrigem) return false;
      if (filtroMotivo !== "todos" && (p.motivo ?? "") !== filtroMotivo) return false;
      if (filtroOficina !== "todas" && (p.oficina_id ?? "") !== filtroOficina) return false;
      if (busca.trim()) {
        const q = busca.trim().toLowerCase();
        const hay = `${p.modelo} ${p.cor} ${p.identificacao ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [perdas, filtroAno, filtroMes, filtroOrigem, filtroMotivo, filtroOficina, busca]);

  const totalPecas = filtradas.reduce((s, p) => s + p.qtd, 0);
  const totalPorOrigem = { pcp: 0, cop: 0, manual: 0 } as Record<PerdaConsolidada["origem"], number>;
  const totalPorMotivo = new Map<string, number>();
  for (const p of filtradas) {
    totalPorOrigem[p.origem] += p.qtd;
    if (p.motivo) totalPorMotivo.set(p.motivo, (totalPorMotivo.get(p.motivo) ?? 0) + p.qtd);
  }
  const motivoTop = Array.from(totalPorMotivo.entries()).sort((a, b) => b[1] - a[1])[0];

  const grafico = useMemo(() => {
    const arr = MESES.map((label, idx) => ({ mes: label, mesIdx: idx, qtd: 0 }));
    for (const p of filtradas) arr[mes(p.data)].qtd += p.qtd;
    return arr;
  }, [filtradas]);

  const excluirManual = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("perdas_manuais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Perda manual removida."); qc.invalidateQueries({ queryKey: ["perdas-cons-manuais"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover."),
  });

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Ano</div>
            <Select value={String(filtroAno)} onValueChange={(v) => setFiltroAno(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{anosDisp.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Mês</div>
            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {MESES.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Origem</div>
            <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="pcp">PCP</SelectItem>
                <SelectItem value="cop">COP</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Motivo</div>
            <Select value={filtroMotivo} onValueChange={setFiltroMotivo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {motivos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Oficina</div>
            <Select value={filtroOficina} onValueChange={setFiltroOficina}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {oficinas.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Busca</div>
            <Input placeholder="Modelo, cor, pedido…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Total de peças perdidas</div><div className="text-2xl font-semibold tabular-nums">{totalPecas}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Por origem</div><div className="text-sm flex gap-2 mt-1"><Badge className="bg-blue-600 hover:bg-blue-600">PCP {totalPorOrigem.pcp}</Badge><Badge className="bg-green-600 hover:bg-green-600">COP {totalPorOrigem.cop}</Badge><Badge variant="secondary">Manual {totalPorOrigem.manual}</Badge></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Motivo com mais perdas</div><div className="text-sm font-semibold mt-1">{motivoTop ? `${motivoTop[0]} — ${motivoTop[1]}` : "—"}</div></CardContent></Card>
        <Card className="flex items-center justify-center"><Button onClick={() => setNovoManual(true)}><Plus className="h-4 w-4 mr-1" /> Registrar perda manual</Button></Card>
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Perdas por mês — {filtroAno}</CardTitle></CardHeader>
        <CardContent style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={grafico}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="qtd" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Perdas consolidadas ({filtradas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto tbl-congelada [&>div]:max-h-[70vh] [&>div]:overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origem</TableHead>
                  <TableHead>Área do erro</TableHead>
                  <TableHead>Identificação</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Berço</TableHead>
                  <TableHead>Oficina</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Tam.</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={14}>Carregando…</TableCell></TableRow>
                ) : filtradas.length === 0 ? (
                  <TableRow><TableCell colSpan={14} className="text-muted-foreground">Nenhuma perda para os filtros atuais.</TableCell></TableRow>
                ) : filtradas.map((p) => {
                  const hex = corHex(p.cor); const fg = corTextoSobre(hex);
                  const areaErro = p.origem === "pcp" ? (p.erro_producao ? "Produção" : (p.area_erro ?? "—")) : "—";
                  return (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-accent/40" onClick={() => setDetalhe(p)}>
                      <TableCell><OrigemBadge p={p} /></TableCell>
                      <TableCell className="text-sm">{areaErro}</TableCell>
                      <TableCell className="text-sm">{p.identificacao ?? "—"}</TableCell>
                      <TableCell className="text-sm tabular-nums">{fmtDataBR(p.data)}</TableCell>
                      <TableCell className="text-sm">{p.motivo ?? "—"}</TableCell>
                      <TableCell className="text-sm">{p.destino ?? "—"}</TableCell>
                      <TableCell className="text-sm">{p.berco ?? "—"}</TableCell>
                      <TableCell className="text-sm">{p.oficina_nome ?? "—"}</TableCell>
                      <TableCell className="text-sm">{p.modelo}</TableCell>
                      <TableCell><span style={{ backgroundColor: hex, color: fg }} className="inline-block px-1.5 py-0.5 rounded text-xs">{p.cor}</span></TableCell>
                      <TableCell className="text-sm">{p.tamanho}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{p.qtd}</TableCell>
                      <TableCell className="text-sm">{p.responsavel ?? "—"}</TableCell>
                      <TableCell className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {isAdmin && p.origem === "pcp" && (
                          <Button size="sm" variant="outline" onClick={() => setCorrigir(p)} title="Corrigir perda (reclassificar)">
                            <Pencil className="h-3.5 w-3.5 mr-1" />Corrigir
                          </Button>
                        )}
                        {isAdmin && p.fonte.kind === "manual" && (
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir esta perda manual?")) excluirManual.mutate(p.fonte.kind === "manual" ? p.fonte.id : ""); }} title="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PerdaDetalheDialog perda={detalhe} open={!!detalhe} onOpenChange={(v) => !v && setDetalhe(null)} />
      <CorrigirPerdaDialog perda={corrigir} open={!!corrigir} onOpenChange={(v) => !v && setCorrigir(null)} />
      <RegistrarPerdaManualDialog open={novoManual} onOpenChange={setNovoManual} />
    </div>
  );
}
