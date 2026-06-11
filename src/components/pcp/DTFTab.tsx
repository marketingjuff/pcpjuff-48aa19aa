import { useEffect, useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { SIM_NAO_PROCESSO, modeloIncluiDTF, QUEM_BATEU_DTF, visivelEmDTF } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Download } from "lucide-react";
import { ReadOnlyField, FormField, EmptyState, EtapaTopoBanner, EtapaBadgeFromPedido } from "./shared";
import { useDirtyTracker, useRegisterSave } from "./dirty-form-context";

import { formatDateBR } from "@/lib/format";

interface Props {
  pedidos: Pedido[];
  selected: Pedido | null;
  onSelect: (id: string | null) => void;
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  saving: boolean;
}

export function DTFTab({ pedidos, selected, onSelect, onSave, saving }: Props) {
  const [form, setForm] = useState<Partial<Pedido>>({});
  useEffect(() => { if (selected) setForm(selected); else setForm({}); }, [selected?.id]);
  useDirtyTracker(form, selected ?? {}, !!selected);
  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }
  function setEstampado(v: string) {
    setForm((f) => ({ ...f, dtf_estampado: v, ...(v !== "Sim" ? { dtf_data_executada: null } : {}) }));
  }
  function handleSave() { if (!selected) return; onSave({ ...form, id: selected.id }); }
  useRegisterSave(handleSave);

  async function baixarLayout(path: string) {
    const { baixarLayoutPDF } = await import("./shared");
    baixarLayoutPDF(path);
  }

  const atrasado = selected?.termino_estamparia && form.dtf_data_executada &&
    new Date(form.dtf_data_executada) > new Date(selected.termino_estamparia);

  const statusColor = form.dtf_estampado === "Sim" && !atrasado
    ? "bg-success/15 text-success border-success/30"
    : form.dtf_estampado === "Sim" && atrasado
    ? "bg-warning/15 text-warning-foreground border-warning/30"
    : "bg-muted text-muted-foreground border-border";

  // Dashboard filters
  const [fOrc, setFOrc] = useState("");
  const [fPed, setFPed] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [fImpresso, setFImpresso] = useState("todos");
  const [fEstampado, setFEstampado] = useState("todos");

  const dashboardPedidos = useMemo(() => pedidos.filter((p) => {
    if (p.finalizado_em) return false;
    if (!visivelEmDTF(p)) return false;
    if (fOrc && !String(p.orcamento ?? "").toLowerCase().includes(fOrc.toLowerCase())) return false;
    if (fPed && !String(p.pedido_olist ?? "").toLowerCase().includes(fPed.toLowerCase())) return false;
    if (fStatus !== "todos" && p.status_geral !== fStatus) return false;
    if (fImpresso !== "todos" && (p.dtf_impresso ?? "") !== fImpresso) return false;
    if (fEstampado !== "todos" && (p.dtf_estampado ?? "") !== fEstampado) return false;
    return true;
  }), [pedidos, fOrc, fPed, fStatus, fImpresso, fEstampado]);


  return (
    <div className="space-y-6">
      {selected ? (
        !modeloIncluiDTF(selected.tipo_estampa) ? (
          <EmptyState>Este pedido não inclui DTF (modelo: {selected.tipo_estampa}).</EmptyState>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>DTF — {selected.pedido_olist}</CardTitle>
              <Badge variant="outline" className={statusColor}>
                {form.dtf_estampado === "Sim" ? (atrasado ? "Atrasado" : "Concluído") : "Em andamento"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
            <EtapaTopoBanner pedido={selected} tab="dtf" />

              <div className="grid gap-4 md:grid-cols-2">
                <ReadOnlyField label="Pedido" value={selected.pedido_olist} />
                <ReadOnlyField label="Orçamento" value={selected.orcamento} />
                <ReadOnlyField label="QTD" value={selected.qtd} />
                <ReadOnlyField label="Status" value={selected.status_geral} />
                <ReadOnlyField label="DTF Impresso? (Arte)" value={selected.dtf_impresso ?? "Pendente"} />
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Layout</div>
                  {selected.layout_url ? (
                    <div className="space-y-1">
                      <Button variant="outline" size="sm" onClick={() => baixarLayout(selected.layout_url!)}>
                        <Download className="h-4 w-4 mr-1" /> Baixar layout
                      </Button>
                      <div className="text-xs text-muted-foreground truncate">{selected.layout_url.replace(/^[0-9a-f-]{36}-/i, "")}</div>
                    </div>
                  ) : <div className="text-sm text-muted-foreground">Sem layout</div>}
                </div>
                <ReadOnlyField label="Início estamparia" value={formatDateBR(selected.inicio_estamparia)} />
                <ReadOnlyField label="Término estamparia" value={formatDateBR(selected.termino_estamparia)} />
                <ReadOnlyField label="Saída Juff" value={formatDateBR(selected.saida_juff)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                <FormField label="DTF Estampado?">
                  <Select value={form.dtf_estampado ?? ""} onValueChange={setEstampado}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField label={`DTF Estampado Executado${form.dtf_estampado === "Sim" ? " *" : ""}`}>
                  <DateInputBR disabled={form.dtf_estampado !== "Sim"} value={form.dtf_data_executada} onChange={(v) => set("dtf_data_executada", v)} />
                </FormField>
                <FormField label="Quem bateu o DTF?">
                  <Select value={form.quem_bateu_dtf ?? ""} onValueChange={(v) => set("quem_bateu_dtf", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{QUEM_BATEU_DTF.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <div className="md:col-span-2">
                  <FormField label="Observações do DTF">
                    <Textarea value={form.dtf_observacao ?? ""} onChange={(e) => set("dtf_observacao", e.target.value)} rows={2} />
                  </FormField>
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" />Salvar</Button>
            </CardContent>
          </Card>
        )
      ) : (
        <EmptyState>Selecione um pedido DTF no dashboard abaixo.</EmptyState>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Dashboard — DTF</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-5">
            <Input placeholder="Orçamento" value={fOrc} onChange={(e) => setFOrc(e.target.value)} />
            <Input placeholder="Pedido" value={fPed} onChange={(e) => setFPed(e.target.value)} />
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="Aberto">Aberto</SelectItem>
                <SelectItem value="Completo">Completo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fImpresso} onValueChange={setFImpresso}>
              <SelectTrigger><SelectValue placeholder="DTF Impresso" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">DTF Impresso (todos)</SelectItem>
                <SelectItem value="Sim">Sim</SelectItem>
                <SelectItem value="Não">Não</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fEstampado} onValueChange={setFEstampado}>
              <SelectTrigger><SelectValue placeholder="DTF Estampado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">DTF Estampado (todos)</SelectItem>
                {SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  {["Etapa","Orçamento","Pedido","Tipo","DTF Impresso","DTF Estampado","Data Exec","Quem bateu","Saída Juff","Data Entrega"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboardPedidos.map((p) => {
                  return (
                    <tr key={p.id} onClick={() => onSelect(p.id)} className={`border-t cursor-pointer hover:bg-accent ${selected?.id === p.id ? "bg-accent" : ""}`}>
                      <td className="px-3 py-2"><EtapaBadgeFromPedido pedido={p} /></td>
                      <td className="px-3 py-2 font-medium">{p.orcamento}</td>
                      <td className="px-3 py-2">{p.pedido_olist}</td>
                      <td className="px-3 py-2"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                      <td className="px-3 py-2">{p.dtf_impresso ?? "—"}</td>
                      <td className="px-3 py-2">{p.dtf_estampado ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.dtf_data_executada)}</td>
                      <td className="px-3 py-2">{p.quem_bateu_dtf ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.saida_juff)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.data_entrega)}</td>
                    </tr>
                  );
                })}
                {dashboardPedidos.length === 0 && (
                  <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido DTF disponível.</td></tr>
                )}

              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
