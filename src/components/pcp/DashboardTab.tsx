import { useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import {
  STATUS_GERAL_OPCOES, TIPOS_ESTAMPA,
  calcularEtapaAtual, statusPrazo, tipoIncluiDTF, tipoIncluiSilk,
} from "@/lib/pedidos";
import { useAppList } from "@/lib/app-lists";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pencil, Eye, ListChecks, AlertCircle, Palette, Printer, Brush, Package, ArrowUpDown,
} from "lucide-react";
import { addDiasUteis, diasUteisEntre } from "@/lib/dias-uteis";
import { useFeriados } from "@/hooks/use-feriados";
import { formatDateBR } from "@/lib/format";

interface Props {
  pedidos: Pedido[];
  loading: boolean;
  onEdit: (id: string) => void;
  onViewProgress: (id: string) => void;
}

type Etapa = "todas" | "ativas" | "arte" | "dtf" | "silk" | "acabamento" | "finalizados";

export function DashboardTab({ pedidos, loading, onEdit, onViewProgress }: Props) {
  const { feriados } = useFeriados();
  const { names: vendedores } = useAppList("vendedor");
  const [vendedor, setVendedor] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [tipo, setTipo] = useState<string>("todos");
  const [etapa, setEtapa] = useState<Etapa>("ativas");
  const [dataEntrega, setDataEntrega] = useState("");
  const [frete, setFrete] = useState("");
  const [search, setSearch] = useState("");
  const [sortDiasDir, setSortDiasDir] = useState<"asc" | "desc" | null>(null);
  const [sortEntregaDir, setSortEntregaDir] = useState<"asc" | "desc" | null>(null);

  function pedidoEmEtapa(p: Pedido, e: Etapa): boolean {
    // Pedidos finalizados nunca aparecem nos dashboards (vão para a aba Finalizados)
    if (e === "finalizados") return !!p.finalizado_em;
    if (p.finalizado_em) return false;
    if (e === "todas" || e === "ativas") return true;
    if (e === "arte") return p.status_arte !== "Arte Finalizada" && p.tipo_estampa !== "Lisa";
    if (e === "dtf") return tipoIncluiDTF(p.tipo_estampa) && p.dtf_estampado !== "Sim";
    if (e === "silk") return tipoIncluiSilk(p.tipo_estampa) && p.silk_feito !== "Sim";
    if (e === "acabamento") return (p.tipo_estampa === "Lisa" || p.status_arte === "Arte Finalizada")
      && (!tipoIncluiDTF(p.tipo_estampa) || p.dtf_estampado === "Sim")
      && (!tipoIncluiSilk(p.tipo_estampa) || p.silk_feito === "Sim")
      && p.embalado !== "Sim";
    return true;
  }

  const filtrados = useMemo(() => {
    const arr = pedidos.filter((p) => {
      if (!pedidoEmEtapa(p, etapa)) return false;
      if (vendedor !== "todos" && p.vendedor !== vendedor) return false;
      if (status !== "todos" && p.status_geral !== status) return false;
      if (tipo !== "todos" && p.tipo_estampa !== tipo) return false;
      if (dataEntrega && p.data_entrega !== dataEntrega) return false;
      if (frete && !String(p.frete ?? "").toLowerCase().includes(frete.toLowerCase())) return false;
      if (search && !`${p.pedido_olist} ${p.orcamento}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (sortDiasDir) {
      arr.sort((a, b) => {
        const da = a.data_entrega ? diasUteisEntre(new Date().toISOString().slice(0,10), a.data_entrega, feriados) ?? 9999 : 9999;
        const db = b.data_entrega ? diasUteisEntre(new Date().toISOString().slice(0,10), b.data_entrega, feriados) ?? 9999 : 9999;
        return sortDiasDir === "asc" ? da - db : db - da;
      });
    } else if (sortEntregaDir) {
      arr.sort((a, b) => {
        const da = a.data_entrega ?? "9999-12-31";
        const db = b.data_entrega ?? "9999-12-31";
        return sortEntregaDir === "asc" ? da.localeCompare(db) : db.localeCompare(da);
      });
    }
    return arr;
  }, [pedidos, vendedor, status, tipo, etapa, dataEntrega, frete, search, sortDiasDir, sortEntregaDir, feriados]);

  const stats = useMemo(() => {
    const ativos = pedidos.filter((p) => !p.finalizado_em);
    return {
      total: ativos.length,
      atrasados: ativos.filter((p) => statusPrazo(p) === "atrasado").length,
      arte: ativos.filter((p) => p.tipo_estampa !== "Lisa" && p.status_arte !== "Arte Finalizada").length,
      dtf: ativos.filter((p) => tipoIncluiDTF(p.tipo_estampa) && p.dtf_estampado !== "Sim").length,
      silk: ativos.filter((p) => tipoIncluiSilk(p.tipo_estampa) && p.silk_feito !== "Sim").length,
      acabamento: ativos.filter((p) => (p.tipo_estampa === "Lisa" || p.status_arte === "Arte Finalizada")
        && (!tipoIncluiDTF(p.tipo_estampa) || p.dtf_estampado === "Sim")
        && (!tipoIncluiSilk(p.tipo_estampa) || p.silk_feito === "Sim")
        && p.embalado !== "Sim").length,
    };
  }, [pedidos]);

  function toggleSortDias() {
    setSortEntregaDir(null);
    setSortDiasDir((d) => d === null ? "asc" : d === "asc" ? "desc" : null);
  }
  function toggleSortEntrega() {
    setSortDiasDir(null);
    setSortEntregaDir((d) => d === null ? "asc" : d === "asc" ? "desc" : null);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total ativos" value={stats.total} icon={<ListChecks className="h-4 w-4" />} onClick={() => setEtapa("ativas")} active={etapa === "ativas"} />
        <StatCard label="Atrasados" value={stats.atrasados} icon={<AlertCircle className="h-4 w-4" />} accent="destructive" onClick={() => setEtapa("ativas")} />
        <StatCard label="Arte" value={stats.arte} icon={<Palette className="h-4 w-4" />} accent="info" onClick={() => setEtapa("arte")} active={etapa === "arte"} />
        <StatCard label="DTF" value={stats.dtf} icon={<Printer className="h-4 w-4" />} accent="info" onClick={() => setEtapa("dtf")} active={etapa === "dtf"} />
        <StatCard label="Silk" value={stats.silk} icon={<Brush className="h-4 w-4" />} accent="info" onClick={() => setEtapa("silk")} active={etapa === "silk"} />
        <StatCard label="Acabamento" value={stats.acabamento} icon={<Package className="h-4 w-4" />} accent="info" onClick={() => setEtapa("acabamento")} active={etapa === "acabamento"} />
      </div>

      <Card>
        <CardHeader><CardTitle>Pedidos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Input placeholder="Buscar pedido/orçamento..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={vendedor} onValueChange={setVendedor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos vendedores</SelectItem>
                {vendedores.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                {STATUS_GERAL_OPCOES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos tipos</SelectItem>
                {TIPOS_ESTAMPA.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={etapa} onValueChange={(v) => setEtapa(v as Etapa)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativas">Todas (menos finalizados)</SelectItem>
                <SelectItem value="arte">Aguardando Arte</SelectItem>
                <SelectItem value="dtf">Aguardando DTF</SelectItem>
                <SelectItem value="silk">Aguardando Silk</SelectItem>
                <SelectItem value="acabamento">Aguardando Acabamento</SelectItem>
              </SelectContent>
            </Select>
            <DateInputBR value={dataEntrega} onChange={(v) => setDataEntrega(v ?? "")} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input placeholder="Filtrar por frete..." value={frete} onChange={(e) => setFrete(e.target.value)} />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Orçamento</TableHead>
                  <TableHead>QTD</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[140px]">% Conclusão</TableHead>
                  <TableHead>Frete</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={toggleSortDias}>
                    <span className="inline-flex items-center gap-1">Dias <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                  <TableHead>Saída Juff</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={toggleSortEntrega}>
                    <span className="inline-flex items-center gap-1">Data Entrega <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={14} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtrados.length === 0 ? (
                  <TableRow><TableCell colSpan={14} className="text-center py-8 text-muted-foreground">Nenhum pedido.</TableCell></TableRow>
                ) : (
                  filtrados.map((p) => {
                    const { etapa: et, percentual, cor } = calcularEtapaAtual(p);
                    const prazo = statusPrazo(p);
                    const dias = p.data_entrega ? diasUteisEntre(new Date().toISOString().slice(0,10), p.data_entrega, feriados) : null;
                    return (
                      <TableRow key={p.id}>
                        <TableCell><Badge className={etapaCorClass(cor)} variant="outline">{et}</Badge></TableCell>
                        <TableCell className="font-medium">{p.pedido_olist}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{p.orcamento}</TableCell>
                        <TableCell>{p.qtd}</TableCell>
                        <TableCell>{p.vendedor}</TableCell>
                        <TableCell><Badge variant="outline">{p.tipo_estampa}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={p.status_geral === "Completo" ? "default" : "secondary"}>{p.status_geral}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={percentual} className="h-2 w-20" />
                            <span className="text-xs tabular-nums">{percentual}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{p.frete ?? "—"}</TableCell>
                        <TableCell className="text-xs tabular-nums">{dias ?? "—"}</TableCell>
                        <TableCell>
                          <span className={prazoClass(prazo)}>{prazoLabel(prazo)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => onEdit(p.id)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => onViewProgress(p.id)} title="Ver progresso">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDateBR(p.saida_juff)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDateBR(p.data_entrega)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon, accent, onClick, active }: { label: string; value: number; icon: React.ReactNode; accent?: "info" | "success" | "destructive"; onClick?: () => void; active?: boolean }) {
  const accentClass =
    accent === "info" ? "text-info" :
    accent === "success" ? "text-success" :
    accent === "destructive" ? "text-destructive" :
    "text-primary";
  return (
    <Card onClick={onClick} className={`cursor-pointer transition ${active ? "ring-2 ring-primary" : "hover:bg-accent/30"}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
            <div className={`text-3xl font-bold tabular-nums mt-1 ${accentClass}`}>{value}</div>
          </div>
          <div className={`p-2 rounded-md bg-muted ${accentClass}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function etapaCorClass(cor: "green" | "yellow" | "red" | "gray" | "blue") {
  switch (cor) {
    case "green": return "bg-success/15 text-success border-success/30";
    case "yellow": return "bg-warning/15 text-warning-foreground border-warning/30";
    case "red": return "bg-destructive/15 text-destructive border-destructive/30";
    case "blue": return "bg-info/15 text-info border-info/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function prazoClass(s: "ok" | "aviso" | "atrasado" | "neutro") {
  switch (s) {
    case "ok": return "text-success font-medium";
    case "aviso": return "text-warning-foreground font-medium";
    case "atrasado": return "text-destructive font-medium";
    default: return "text-muted-foreground";
  }
}

function prazoLabel(s: "ok" | "aviso" | "atrasado" | "neutro") {
  switch (s) {
    case "ok": return "🟢 No prazo";
    case "aviso": return "🟡 Aviso";
    case "atrasado": return "🔴 Atrasado";
    default: return "—";
  }
}
