import { useEffect, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { OK_OPCOES, SIM_NAO_PROCESSO, RESPONSAVEIS, modeloIncluiDTF, modeloIncluiSilk } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, AlertTriangle, Ban } from "lucide-react";
import { PedidoSelector, ReadOnlyField, FormField, EmptyState } from "./shared";

interface Props {
  pedidos: Pedido[];
  selected: Pedido | null;
  onSelect: (id: string | null) => void;
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  saving: boolean;
}

export function AcabamentoTab({ pedidos, selected, onSelect, onSave, saving }: Props) {
  const [form, setForm] = useState<Partial<Pedido>>({});
  useEffect(() => { if (selected) setForm(selected); }, [selected]);
  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }
  function handleSave() { if (!selected) return; onSave({ ...form, id: selected.id }); }

  const temDTF = selected && modeloIncluiDTF(selected.tipo_estampa);
  const temSilk = selected && modeloIncluiSilk(selected.tipo_estampa);
  const dtfDisponivel = selected?.dtf_estampado === "Sim";
  const silkDisponivel = selected?.silk_feito === "Sim";

  const rejeitado = form.dtf_ok === "Não" || form.silk_ok === "Não";
  const atrasado = selected?.saida_juff && form.data_saida_juff &&
    new Date(form.data_saida_juff) > new Date(selected.saida_juff);

  const status = rejeitado
    ? { label: "Rejeitado", color: "bg-destructive/15 text-destructive border-destructive/30" }
    : form.embalado === "Sim" && atrasado
    ? { label: "Saiu atrasado", color: "bg-warning/15 text-warning-foreground border-warning/30" }
    : form.embalado === "Sim"
    ? { label: "Embalado", color: "bg-success/15 text-success border-success/30" }
    : { label: "Pendente", color: "bg-muted text-muted-foreground border-border" };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {selected ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Acabamento — {selected.pedido_olist}</CardTitle>
            <Badge variant="outline" className={status.color}>{status.label}</Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            {rejeitado && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/30">
                <Ban className="h-4 w-4" /> Produto rejeitado — revisar antes de liberar saída.
              </div>
            )}
            {atrasado && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-warning/15 text-sm border border-warning/30">
                <AlertTriangle className="h-4 w-4" /> Saída ocorrida após o prazo previsto.
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Pedido" value={selected.pedido_olist} />
              <ReadOnlyField label="Orçamento" value={selected.orcamento} />
              <ReadOnlyField label="Modelo" value={selected.tipo_estampa} />
              <ReadOnlyField label="Status" value={selected.status_geral} />
              <ReadOnlyField label="Acabamento previsto" value={selected.acabamento_data} />
              <ReadOnlyField label="Saída Juff (prazo)" value={selected.saida_juff} />
              <ReadOnlyField label="DTF Estampado?" value={selected.dtf_estampado ?? "—"} />
              <ReadOnlyField label="Silk feito?" value={selected.silk_feito ?? "—"} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
              <FormField label="DTF ok?">
                <Select value={form.dtf_ok ?? ""} onValueChange={(v) => set("dtf_ok", v)} disabled={!temDTF || !dtfDisponivel}>
                  <SelectTrigger><SelectValue placeholder={!temDTF || !dtfDisponivel ? "N/A" : "Selecione..."} /></SelectTrigger>
                  <SelectContent>{OK_OPCOES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <FormField label="Silk OK?">
                <Select value={form.silk_ok ?? ""} onValueChange={(v) => set("silk_ok", v)} disabled={!temSilk || !silkDisponivel}>
                  <SelectTrigger><SelectValue placeholder={!temSilk || !silkDisponivel ? "N/A" : "Selecione..."} /></SelectTrigger>
                  <SelectContent>{OK_OPCOES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <FormField label="EMBALADO?">
                <Select value={form.embalado ?? ""} onValueChange={(v) => set("embalado", v)} disabled={rejeitado}>
                  <SelectTrigger><SelectValue placeholder={rejeitado ? "Bloqueado — revisar" : "Selecione..."} /></SelectTrigger>
                  <SelectContent>{SIM_NAO_PROCESSO.slice(0, 2).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <FormField label="Responsável Conferência">
                <Select value={form.responsavel_conferencia ?? ""} onValueChange={(v) => set("responsavel_conferencia", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{RESPONSAVEIS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <FormField label={`Data Saída Juff${form.embalado === "Sim" ? " *" : ""}`}>
                <Input type="date" value={form.data_saida_juff ?? ""} onChange={(e) => set("data_saida_juff", e.target.value || null)} />
              </FormField>
              <div className="md:col-span-2">
                <FormField label="Observações do pedido">
                  <Textarea value={form.observacoes_pedido ?? ""} onChange={(e) => set("observacoes_pedido", e.target.value)} rows={3} />
                </FormField>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" />Salvar</Button>
          </CardContent>
        </Card>
      ) : (
        <EmptyState>Selecione um pedido na lista ao lado.</EmptyState>
      )}
      <PedidoSelector pedidos={pedidos} selectedId={selected?.id ?? null} onSelect={onSelect} />
    </div>
  );
}
