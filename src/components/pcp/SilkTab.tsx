import { useEffect, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { SIM_NAO_PROCESSO, modeloIncluiSilk, diasAte } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, AlertTriangle, Info } from "lucide-react";
import { PedidoSelector, ReadOnlyField, FormField, EmptyState } from "./shared";

interface Props {
  pedidos: Pedido[];
  selected: Pedido | null;
  onSelect: (id: string | null) => void;
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  saving: boolean;
}

export function SilkTab({ pedidos, selected, onSelect, onSave, saving }: Props) {
  const [form, setForm] = useState<Partial<Pedido>>({});
  useEffect(() => { if (selected) setForm(selected); }, [selected]);
  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }
  function handleSave() { if (!selected) return; onSave({ ...form, id: selected.id }); }

  const dias = selected ? diasAte(selected.termino_estamparia) : null;
  const atrasado = selected?.termino_estamparia && form.silk_data_executada &&
    new Date(form.silk_data_executada) > new Date(selected.termino_estamparia);

  const statusColor = form.silk_feito === "Sim" && !atrasado
    ? "bg-success/15 text-success border-success/30"
    : form.silk_feito === "Sim" && atrasado
    ? "bg-warning/15 text-warning-foreground border-warning/30"
    : "bg-muted text-muted-foreground border-border";

  const silkBloqueado = form.tela_gravada !== "Sim";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {selected ? (
        !modeloIncluiSilk(selected.modelo_estampa) ? (
          <EmptyState>Este pedido não inclui Silk (modelo: {selected.modelo_estampa}).</EmptyState>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Silk Screen — {selected.pedido_olist}</CardTitle>
              <Badge variant="outline" className={statusColor}>
                {form.silk_feito === "Sim" ? (atrasado ? "Atrasado" : "Concluído") : "Em andamento"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selected.fotolito_executado && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-warning/15 text-sm border border-warning/30">
                  <Info className="h-4 w-4" /> Arte ainda não liberou fotolito.
                </div>
              )}
              {atrasado && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/30">
                  <AlertTriangle className="h-4 w-4" /> Data executada após o limite de estamparia.
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <ReadOnlyField label="Pedido" value={selected.pedido_olist} />
                <ReadOnlyField label="Orçamento" value={selected.orcamento} />
                <ReadOnlyField label="QTD" value={selected.qtd} />
                <ReadOnlyField label="Status" value={selected.status} />
                <ReadOnlyField label="Início estamparia" value={selected.inicio_estamparia} />
                <ReadOnlyField label="Limite estamparia" value={
                  <>{selected.termino_estamparia}{dias !== null && <span className="text-xs ml-2 opacity-70">({dias} dias)</span>}</>
                } />
                <ReadOnlyField label="Fotolito impresso? (Arte)" value={selected.fotolito_executado ?? "Pendente"} />
                <ReadOnlyField label="Saída Juff" value={selected.saida_juff} />
              </div>
              <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                <FormField label="Tela gravada?">
                  <Select value={form.tela_gravada ?? ""} onValueChange={(v) => set("tela_gravada", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField label="Silk feito?">
                  <Select value={form.silk_feito ?? ""} onValueChange={(v) => set("silk_feito", v)} disabled={silkBloqueado}>
                    <SelectTrigger><SelectValue placeholder={silkBloqueado ? "Tela precisa estar gravada" : "Selecione..."} /></SelectTrigger>
                    <SelectContent>{SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField label={`Data Executada${form.silk_feito === "Sim" ? " *" : ""}`}>
                  <Input type="date" value={form.silk_data_executada ?? ""} onChange={(e) => set("silk_data_executada", e.target.value || null)} />
                </FormField>
                <div className="md:col-span-2">
                  <FormField label="Observação">
                    <Textarea value={form.silk_observacao ?? ""} onChange={(e) => set("silk_observacao", e.target.value)} rows={2} />
                  </FormField>
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" />Salvar</Button>
            </CardContent>
          </Card>
        )
      ) : (
        <EmptyState>Selecione um pedido Silk na lista ao lado.</EmptyState>
      )}
      <PedidoSelector pedidos={pedidos} selectedId={selected?.id ?? null} onSelect={onSelect} filter={(p) => modeloIncluiSilk(p.modelo_estampa)} />
    </div>
  );
}
