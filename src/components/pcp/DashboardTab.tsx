import { pedidoAtivoNasAreas } from "@/lib/pedidos";
import { useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import {
  STATUS_PECAS_OPCOES, TIPOS_ESTAMPA,
  calcularEtapaAtual, statusPrazo, tipoIncluiDTF, tipoIncluiSilk,
} from "@/lib/pedidos";
import { useAppList } from "@/lib/app-lists";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ListChecks, AlertCircle, Palette, Printer, Brush, Package, Truck, ArrowUpDown,
} from "lucide-react";
import { diasUteisAteHoje } from "@/lib/dias-uteis";
import { useFeriados } from "@/hooks/use-feriados";
import { formatDateBR } from "@/lib/format";
import { etapaPaletteClass, StatusPecasBadge, StatusPecasChip, PedidoMobileCard, Chip } from "./shared";

interface Props {
  pedidos: Pedido[];
  loading: boolean;
  onEdit: (id: string) => void;
  onViewProgress: (id: string) => void;
}

type Etapa = "todas" | "ativas" | "arte" | "dtf" | "silk" | "acabamento" | "expedicao" | "finalizados";

function emExpedicao(p: Pedido) {
  return p.embalado === "Sim" && !p.finalizado_em;
}

export function DashboardTab({ pedidos, loading, onEdit }: Props) {
  const { feriados } = useFeriados();
  const { names: vendedores } = useAppList("vendedor");
  const [vendedor, setVendedor] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [tipo, setTipo] = useState<string>("todos");
  const [etapa, setEtapa] = useState<Etapa>("ativas");
  const [dataEntrega, setDataEntrega] = useState("");
  
  const [search, setSearch] = useState("");
  const [sortSaidaDir, setSortSaidaDir] = useState<"asc" | "desc" | null>("asc");
  const [sortEntregaDir, setSortEntregaDir] = useState<"asc" | "desc" | null>(null);
  const [sortDiasDir, setSortDiasDir] = useState<"asc" | "desc" | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  function pedidoEmEtapa(p: Pedido, e: Etapa): boolean {
    if (e === "finalizados") return !!p.finalizado_em;
    if (!pedidoAtivoNasAreas(p)) return false;
    if (e === "todas" || e === "ativas") return true;
    if (e === "arte") return p.status_arte !== "Arte Finalizada" && p.tipo_estampa !== "Lisa";
    if (e === "dtf") return tipoIncluiDTF(p.tipo_estampa) && p.dtf_estampado !== "Sim";
    if (e === "silk") return tipoIncluiSilk(p.tipo_estampa) && p.silk_feito !== "Sim";
    if (e === "acabamento") return (p.tipo_estampa === "Lisa" || p.status_arte === "Arte Finalizada")
      && (!tipoIncluiDTF(p.tipo_estampa) || p.dtf_estampado === "Sim")
      && (!tipoIncluiSilk(p.tipo_estampa) || p.silk_feito === "Sim")
      && p.embalado !== "Sim";
    if (e === "expedicao") return emExpedicao(p);
    return true;
  }

  const filtrados = useMemo(() => {
    const arr = pedidos.filter((p) => {
      if (!pedidoEmEtapa(p, etapa)) return false;
      if (vendedor !== "todos" && p.vendedor !== vendedor) return false;
      if (status !== "todos" && p.status_pecas !== status) return false;
      if (tipo !== "todos" && p.tipo_estampa !== tipo) return false;
      if (dataEntrega && p.data_entrega !== dataEntrega) return false;
      if (frete && !String(p.frete ?? "").toLowerCase().includes(frete.toLowerCase())) return false;
      if (search && !`${p.pedido_olist} ${p.orcamento}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (sortDiasDir) {
      arr.sort((a, b) => {
        const da = a.data_entrega ? (diasUteisAteHoje(a.data_entrega, feriados) ?? 9999) : 9999;
        const db = b.data_entrega ? (diasUteisAteHoje(b.data_entrega, feriados) ?? 9999) : 9999;
        return sortDiasDir === "asc" ? da - db : db - da;
      });
    } else if (sortSaidaDir) {
      arr.sort((a, b) => {
        const av = a.saida_juff ?? "9999-12-31";
        const bv = b.saida_juff ?? "9999-12-31";
        return sortSaidaDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    } else if (sortEntregaDir) {
      arr.sort((a, b) => {
        const da = a.data_entrega ?? "9999-12-31";
        const db = b.data_entrega ?? "9999-12-31";
        return sortEntregaDir === "asc" ? da.localeCompare(db) : db.localeCompare(da);
      });
    }
    return arr;
  }, [pedidos, vendedor, status, tipo, etapa, dataEntrega, frete, search, sortSaidaDir, sortEntregaDir, sortDiasDir, feriados]);

  const stats = useMemo(() => {
    const ativos = pedidos.filter((p) => pedidoAtivoNasAreas(p));
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
      expedicao: pedidos.filter((p) => emExpedicao(p)).length,
    };
  }, [pedidos]);

  function toggleSortSaida() {
    setSortEntregaDir(null);
    setSortDiasDir(null);
    setSortSaidaDir((d) => d === "asc" ? "desc" : "asc");
  }
  function toggleSortEntrega() {
    setSortSaidaDir(null);
    setSortDiasDir(null);
    setSortEntregaDir((d) => d === "asc" ? "desc" : "asc");
  }
  function toggleSortDias() {
    setSortSaidaDir(null);
    setSortEntregaDir(null);
    setSortDiasDir((d) => d === "asc" ? "desc" : "asc");
  }

  /** Cor de fundo da linha — baseada em saida_juff e dias úteis. */
  function rowBgClass(p: Pedido): string {
    if (p.embalado === "Sim") return "";
    if (!p.saida_juff) return "";
    const dias = diasUteisAteHoje(p.saida_juff, feriados);
    if (dias === null) return "";
    if (dias <= 0) return "bg-red-50 hover:bg-red-100/80";
    if (dias === 1) return "bg-yellow-50 hover:bg-yellow-100/80";
    return "";
  }

  /** Estamparia: prioriza campos dedicados; fallback nas datas executadas DTF/Silk. */
  function estampariaDatas(p: Pedido): { inicio: string | null; termino: string | null } {
    const datas = [p.dtf_data_executada, p.silk_data_executada].filter((d): d is string => !!d);
    const sorted = [...datas].sort();
    const inicio = p.inicio_estamparia ?? (sorted[0] ?? null);
    const termino = p.termino_estamparia ?? (sorted[sorted.length - 1] ?? null);
    return { inicio, termino };
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
        <StatCard label="Total ativos" value={stats.total} icon={<ListChecks className="h-4 w-4" />} onClick={() => setEtapa("ativas")} active={etapa === "ativas"} />
        <StatCard label="Atrasados" value={stats.atrasados} icon={<AlertCircle className="h-4 w-4" />} accent="destructive" onClick={() => setEtapa("ativas")} />
        <StatCard label="Arte" value={stats.arte} icon={<Palette className="h-4 w-4" />} accent="info" onClick={() => setEtapa("arte")} active={etapa === "arte"} />
        <StatCard label="DTF" value={stats.dtf} icon={<Printer className="h-4 w-4" />} accent="info" onClick={() => setEtapa("dtf")} active={etapa === "dtf"} />
        <StatCard label="Silk" value={stats.silk} icon={<Brush className="h-4 w-4" />} accent="info" onClick={() => setEtapa("silk")} active={etapa === "silk"} />
        <StatCard label="Acabamento" value={stats.acabamento} icon={<Package className="h-4 w-4" />} accent="info" onClick={() => setEtapa("acabamento")} active={etapa === "acabamento"} />
        <StatCard label="Expedição" value={stats.expedicao} icon={<Truck className="h-4 w-4" />} accent="info" onClick={() => setEtapa("expedicao")} active={etapa === "expedicao"} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-baseline justify-between gap-2">
            <CardTitle className="font-display text-base tracking-tight">Pedidos</CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {filtrados.length} {filtrados.length === 1 ? "registro" : "registros"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
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
                {STATUS_PECAS_OPCOES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
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
                <SelectItem value="expedicao">Em Expedição</SelectItem>
              </SelectContent>
            </Select>
            <DateInputBR value={dataEntrega} onChange={(v) => setDataEntrega(v ?? "")} />
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            <Input placeholder="Filtrar por frete..." value={frete} onChange={(e) => setFrete(e.target.value)} />
          </div>

          {/* Mobile: cards */}
          <div className="md:hidden rounded-md border divide-y">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : filtrados.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido.</div>
            ) : (
              filtrados.map((p) => (
                <PedidoMobileCard key={p.id} pedido={p} onClick={() => onEdit(p.id)}>
                  <Chip label="QTD" value={p.qtd} />
                  <Chip label="Vend" value={p.vendedor} />
                  <Chip label="Estampa" value={p.tipo_estampa} />
                  <StatusPecasChip pedido={p} />
                  <Chip label="Saída Juff" value={formatDateBR(p.saida_juff) || "—"} />
                  <Chip label="Entrega" value={formatDateBR(p.data_entrega) || "—"} />
                </PedidoMobileCard>
              ))
            )}
          </div>

          {/* Desktop: tabela compacta */}
          <div className="hidden md:block rounded-lg border border-border/60 bg-card overflow-x-auto shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-9 px-2 text-xs">Etapa</TableHead>
                  <TableHead className="h-9 px-2 text-xs">Pedido</TableHead>
                  <TableHead className="h-9 px-2 text-xs">Orçamento</TableHead>
                  <TableHead className="h-9 px-2 text-xs">Vendedor</TableHead>
                  <TableHead className="h-9 px-2 text-xs">QTD</TableHead>
                  <TableHead className="h-9 px-2 text-xs">Estampa</TableHead>
                  <TableHead className="h-9 px-2 text-xs">Status de Peças</TableHead>
                  <TableHead className="h-9 px-2 text-xs">Frete</TableHead>
                  <TableHead className="h-9 px-2 text-xs">UF</TableHead>
                  <TableHead className="h-9 px-2 text-xs whitespace-nowrap">Entrada</TableHead>
                  <TableHead className="h-9 px-2 text-xs whitespace-nowrap">Arte Limite</TableHead>
                  <TableHead className="h-9 px-2 text-xs whitespace-nowrap">Início Estamp.</TableHead>
                  <TableHead className="h-9 px-2 text-xs whitespace-nowrap">Térm. Estamp.</TableHead>
                  <TableHead className="h-9 px-2 text-xs cursor-pointer select-none whitespace-nowrap" onClick={toggleSortDias}>
                    <span className="inline-flex items-center gap-1">Dias <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="h-9 px-2 text-xs cursor-pointer select-none whitespace-nowrap" onClick={toggleSortSaida}>
                    <span className="inline-flex items-center gap-1">Saída Juff <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="h-9 px-2 text-xs cursor-pointer select-none whitespace-nowrap" onClick={toggleSortEntrega}>
                    <span className="inline-flex items-center gap-1">Data Entrega <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={16} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtrados.length === 0 ? (
                  <TableRow><TableCell colSpan={16} className="text-center py-8 text-muted-foreground">Nenhum pedido.</TableCell></TableRow>
                ) : (
                  filtrados.map((p) => {
                    const { inicio, termino } = estampariaDatas(p);
                    const bg = rowBgClass(p);
                    const isSelected = selectedRowId === p.id;
                    return (
                      <TableRow
                        key={p.id}
                        onClick={() => setSelectedRowId(p.id)}
                        onDoubleClick={() => onEdit(p.id)}
                        className={`cursor-pointer select-none transition-colors ${bg} ${isSelected ? "outline outline-2 -outline-offset-2 outline-primary/60" : ""}`}
                      >
                        <TableCell className="py-1.5 px-2 text-xs"><Badge variant="outline" className={`${etapaPaletteClass(calcularEtapaAtual(p).etapa)} text-[11px]`}>{calcularEtapaAtual(p).etapa}</Badge></TableCell>
                        <TableCell className="py-1.5 px-2 text-xs font-medium align-top">{p.pedido_olist}</TableCell>
                        <TableCell className="py-1.5 px-2 text-xs max-w-[220px] align-top">
                          <span className="block leading-snug line-clamp-2 break-words" title={p.orcamento ?? ""}>{p.orcamento}</span>
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-xs align-top">{p.vendedor}</TableCell>
                        <TableCell className="py-1.5 px-2 text-xs tabular-nums align-top">{p.qtd}</TableCell>
                        <TableCell className="py-1.5 px-2 text-xs align-top"><Badge variant="outline" className="text-[11px]">{p.tipo_estampa}</Badge></TableCell>
                        <TableCell className="py-1.5 px-2 text-xs align-top"><StatusPecasBadge pedido={p} /></TableCell>
                        <TableCell className="py-1.5 px-2 text-xs align-top">{p.frete ?? "—"}</TableCell>
                        <TableCell className="py-1.5 px-2 text-xs align-top">{p.uf_entrega ?? "—"}</TableCell>
                        <TableCell className="py-1.5 px-2 text-xs whitespace-nowrap align-top">{formatDateBR(p.entrada_pedido) || "—"}</TableCell>
                        <TableCell className="py-1.5 px-2 text-xs whitespace-nowrap align-top">{formatDateBR(p.arte_data) || "—"}</TableCell>
                        <TableCell className="py-1.5 px-2 text-xs whitespace-nowrap align-top">{formatDateBR(inicio) || "—"}</TableCell>
                        <TableCell className="py-1.5 px-2 text-xs whitespace-nowrap align-top">{formatDateBR(termino) || "—"}</TableCell>
                        <TableCell className="py-1.5 px-2 text-xs tabular-nums align-top">{p.data_entrega ? (diasUteisAteHoje(p.data_entrega, feriados) ?? "—") : "—"}</TableCell>
                        <TableCell className="py-1.5 px-2 text-xs whitespace-nowrap align-top">{formatDateBR(p.saida_juff) || "—"}</TableCell>
                        <TableCell className="py-1.5 px-2 text-xs whitespace-nowrap align-top">{formatDateBR(p.data_entrega) || "—"}</TableCell>
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
  const tone =
    accent === "destructive"
      ? { num: "text-destructive", icon: "bg-destructive/10 text-destructive ring-destructive/20" }
      : accent === "success"
      ? { num: "text-success", icon: "bg-success/10 text-success ring-success/20" }
      : accent === "info"
      ? { num: "text-info", icon: "bg-info/10 text-info ring-info/20" }
      : { num: "text-foreground", icon: "bg-primary-soft text-primary ring-primary/15" };
  return (
    <Card
      onClick={onClick}
      className={`group cursor-pointer transition-all duration-200 hover:-translate-y-px hover:shadow-sm ${
        active ? "ring-2 ring-primary/25 border-primary/40 shadow-sm" : ""
      }`}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground truncate">
              {label}
            </div>
            <div className={`font-display text-2xl sm:text-[1.6rem] font-semibold tabular-nums tracking-tight leading-none ${tone.num}`}>
              {value}
            </div>
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ${tone.icon} shrink-0 transition-transform group-hover:scale-105`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
