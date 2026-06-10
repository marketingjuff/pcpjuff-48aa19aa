import { useEffect, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { SIM_NAO_PROCESSO, PEDIDO_OK_OPCOES, modeloIncluiDTF, modeloIncluiSilk } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Save, AlertTriangle } from "lucide-react";
import { PedidoSelector, ReadOnlyField, FormField, EmptyState } from "./shared";

interface Props {
  pedidos: Pedido[];
  selected: Pedido | null;
  onSelect: (id: string | null) => void;
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  saving: boolean;
}

export function ArteTab({ pedidos, selected, onSelect, onSave, saving }: Props) {
  const [form, setForm] = useState<Partial<Pedido>>({});
  useEffect(() => { if (selected) setForm(selected); }, [selected]);
  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }
  function handleSave() { if (!selected) return; onSave({ ...form, id: selected.id }); }

  const showDTF = selected && modeloIncluiDTF(selected.modelo_estampa);
  const showSilk = selected && modeloIncluiSilk(selected.modelo_estampa);
  const arteAtrasada = selected?.arte_data && new Date(selected.arte_data) < new Date() && form.pedido_ok !== "OK";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {selected ? (
        <Card>
          <CardHeader><CardTitle>Arte — {selected.pedido_olist}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {arteAtrasada && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/30">
                <AlertTriangle className="h-4 w-4" /> Arte ultrapassou a data limite ({selected.arte_data}) e não está OK.
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Pedido" value={selected.pedido_olist} />
              <ReadOnlyField label="Orçamento" value={selected.orcamento} />
              <ReadOnlyField label="Status" value={selected.status} />
              <ReadOnlyField label="Modelo de estampa" value={selected.modelo_estampa} />
              <ReadOnlyField label="Entrada pedido" value={selected.entrada_pedido} />
              <ReadOnlyField label="Entrega arte (limite)" value={selected.arte_data} />
            </div>
            <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
              <div className="md:col-span-2">
                <FormField label="Qual estampa (descrição)">
                  <Textarea value={form.qual_estampa ?? ""} onChange={(e) => set("qual_estampa", e.target.value)} rows={2} />
                </FormField>
              </div>
              {showDTF && (
                <>
                  <FormField label="DTF Impresso">
                    <Select value={form.dtf_impresso ?? ""} onValueChange={(v) => set("dtf_impresso", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <FormField label={`DTF Executado${form.dtf_impresso === "Sim" ? " *" : ""}`}>
                    <Input type="date" value={form.dtf_executado ?? ""} onChange={(e) => set("dtf_executado", e.target.value || null)} />
                  </FormField>
                </>
              )}
              {showSilk && (
                <>
                  <FormField label="FOTOLITO Impresso">
                    <Select value={form.fotolito_impresso ?? ""} onValueChange={(v) => set("fotolito_impresso", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <FormField label={`FOTOLITO Executado${form.fotolito_impresso === "Sim" ? " *" : ""}`}>
                    <Input type="date" value={form.fotolito_executado ?? ""} onChange={(e) => set("fotolito_executado", e.target.value || null)} />
                  </FormField>
                </>
              )}
              <FormField label="Pedido OK">
                <Select value={form.pedido_ok ?? ""} onValueChange={(v) => set("pedido_ok", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{PEDIDO_OK_OPCOES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <div className="md:col-span-2">
                <FormField label="Observação">
                  <Textarea value={form.arte_observacao ?? ""} onChange={(e) => set("arte_observacao", e.target.value)} rows={2} />
                </FormField>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" />Salvar</Button>
          </CardContent>
        </Card>
      ) : (
        <EmptyState>Selecione um pedido na lista ao lado para preencher a arte.</EmptyState>
      )}
      <PedidoSelector pedidos={pedidos} selectedId={selected?.id ?? null} onSelect={onSelect} />
    </div>
  );
}
