import { useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { VENDEDORES, STATUS_OPCOES, MODELOS_ESTAMPA, calcularEtapaAtual, statusPrazo, diasAte } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Eye, ListChecks, Activity, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  pedidos: Pedido[];
  loading: boolean;
  onEdit: (id: string) => void;
  onViewProgress: (id: string) => void;
}

export function DashboardTab({ pedidos, loading, onEdit, onViewProgress }: Props) {
  const [vendedor, setVendedor] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [modelo, setModelo] = useState<string>("todos");
  const [search, setSearch] = useState("");

  const filtrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (vendedor !== "todos" && p.vendedor !== vendedor) return false;
      if (status !== "todos" && p.status !== status) return false;
      if (modelo !== "todos" && p.modelo_estampa !== modelo) return false;
      if (search && !`${p.pedido_olist} ${p.orcamento}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [pedidos, vendedor, status, modelo, search]);

  const stats = useMemo(() => {
    const total = pedidos.length;
    const abertos = pedidos.filter((p) => p.status === "Aberto").length;
    const completos = pedidos.filter((p) => p.status === "Completo").length;
    const atrasados = pedidos.filter((p) => statusPrazo(p) === "atrasado" && p.embalado !== "Sim").length;
    return { total, abertos, completos, atrasados };
  }, [pedidos]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={<ListChecks className="h-4 w-4" />} />
        <StatCard label="Abertos" value={stats.abertos} icon={<Activity className="h-4 w-4" />} accent="info" />
        <StatCard label="Completos" value={stats.completos} icon={<CheckCircle2 className="h-4 w-4" />} accent="success" />
        <StatCard label="Atrasados" value={stats.atrasados} icon={<AlertCircle className="h-4 w-4" />} accent="destructive" />
      </div>

      <Card>
        <CardHeader><CardTitle>Pedidos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Input placeholder="Buscar pedido ou orçamento..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={vendedor} onValueChange={setVendedor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos vendedores</SelectItem>
                {VENDEDORES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                {STATUS_OPCOES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={modelo} onValueChange={setModelo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos modelos</SelectItem>
                {MODELOS_ESTAMPA.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Orçamento</TableHead>
                  <TableHead>QTD</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[140px]">% Conclusão</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtrados.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Nenhum pedido.</TableCell></TableRow>
                ) : (
                  filtrados.map((p) => {
                    const { etapa, percentual, cor } = calcularEtapaAtual(p);
                    const prazo = statusPrazo(p);
                    const dias = diasAte(p.saida_juff);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.pedido_olist}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{p.orcamento}</TableCell>
                        <TableCell>{p.qtd}</TableCell>
                        <TableCell>{p.vendedor}</TableCell>
                        <TableCell><Badge variant="outline">{p.modelo_estampa}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={p.status === "Completo" ? "default" : "secondary"}>{p.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={percentual} className="h-2 w-20" />
                            <span className="text-xs tabular-nums">{percentual}%</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge className={etapaCorClass(cor)} variant="outline">{etapa}</Badge></TableCell>
                        <TableCell className="text-xs">{p.saida_juff ?? "—"}</TableCell>
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

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: "info" | "success" | "destructive" }) {
  const accentClass =
    accent === "info" ? "text-info" :
    accent === "success" ? "text-success" :
    accent === "destructive" ? "text-destructive" :
    "text-primary";
  return (
    <Card>
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
