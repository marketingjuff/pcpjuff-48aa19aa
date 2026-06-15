import { pedidoAtivoNasAreas } from "@/lib/pedidos";
import { useEffect, useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import {
  SIM_NAO, STATUS_ARTE_OPCOES, tipoIncluiDTF, tipoIncluiSilk, visivelEmArte,
} from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, AlertTriangle, Download } from "lucide-react";
import { ReadOnlyField, FormField, EmptyState, EtapaTopoBanner, EtapaBadgeFromPedido, StatusPecasBadge, StatusPecasChip, PedidoMobileCard, Chip } from "./shared";
import { useDirtyTracker, useRegisterSave, useDirtyForm } from "./dirty-form-context";
import { formatDateBR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


interface Props {
  pedidos: Pedido[];
  selected: Pedido | null;
  onSelect: (id: string | null) => void;
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  saving: boolean;
  active?: boolean;
}

export function ArteTab({ pedidos, selected, onSelect, onSave, saving, active = true }: Props) {
  const [form, setForm] = useState<Partial<Pedido>>({});
  const { isDirty } = useDirtyForm();
  useEffect(() => {
    if (!selected) { setForm({}); return; }
    if (!isDirty) setForm(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  useDirtyTracker(form, selected ?? {}, active && !!selected);

  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  // Reset de data quando muda Sim → Não
  function setImpresso(field: "dtf_impresso" | "fotolito_impresso", dataField: "dtf_executado" | "fotolito_executado", v: string) {
    setForm((f) => ({
      ...f,
      [field]: v,
      ...(v === "Não" ? { [dataField]: null } : {}),
    }));
  }

  function handleSave() {
    if (!selected) return;
    onSave({
      id: selected.id,
      status_arte: form.status_arte ?? null,
      dtf_impresso: form.dtf_impresso ?? null,
      dtf_executado: form.dtf_executado ?? null,
      fotolito_impresso: form.fotolito_impresso ?? null,
      fotolito_executado: form.fotolito_executado ?? null,
      vetorizacao_executada: form.vetorizacao_executada ?? null,
      arte_observacao: form.arte_observacao ?? null,
    });
  }
  useRegisterSave(handleSave, active);

  async function baixarLayout(path: string) {
    const { baixarLayoutPDF } = await import("./shared");
    baixarLayoutPDF(path);
  }


  const showDTF = selected && tipoIncluiDTF(selected.tipo_estampa);
  const showSilk = selected && tipoIncluiSilk(selected.tipo_estampa);
  const arteAtrasada = selected?.arte_data && new Date(selected.arte_data) < new Date() && form.status_arte !== "Arte Finalizada";

  return (
    <div className="space-y-6">
      {selected ? (
        <Card>
          <CardHeader><CardTitle>Arte — {selected.pedido_olist}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <EtapaTopoBanner pedido={selected} tab="arte" />

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
              <ReadOnlyField label="Pedido" value={selected.pedido_olist} />
              <ReadOnlyField label="Orçamento" value={selected.orcamento} />
              <ReadOnlyField label="Tipo de estampa" value={selected.tipo_estampa} />
              <ReadOnlyField label="Entrada" value={formatDateBR(selected.entrada_pedido)} />
              <ReadOnlyField label="Saída Juff" value={formatDateBR(selected.saida_juff)} />
              <ReadOnlyField label="Data de Entrega" value={formatDateBR(selected.data_entrega)} />
              <ReadOnlyField label="UF" value={selected.uf_entrega ?? "—"} />
              <ReadOnlyField label="Vetorização?" value={selected.necessita_vetorizacao ? "Sim" : "Não"} />
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
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 pt-4 border-t">
              {/* Vetorização (espelho) */}
              {selected.necessita_vetorizacao && (
                <FormField label="Vetorização executada?">
                  <Select value={form.vetorizacao_executada ? "Sim" : "Não"} onValueChange={(v) => set("vetorizacao_executada", v === "Sim")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SIM_NAO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
              )}

              {showDTF && (
                <>
                  <FormField label="DTF Impresso">
                    <Select value={form.dtf_impresso ?? ""} onValueChange={(v) => setImpresso("dtf_impresso","dtf_executado", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{SIM_NAO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <FormField label={`DTF Impresso Executado${form.dtf_impresso === "Sim" ? " *" : ""}`}>
                    <DateInputBR disabled={form.dtf_impresso !== "Sim"}
                      value={form.dtf_executado}
                      onChange={(v) => set("dtf_executado", v)} />
                  </FormField>
                </>
              )}

              {showSilk && (
                <>
                  <FormField label="Fotolito Impresso">
                    <Select value={form.fotolito_impresso ?? ""} onValueChange={(v) => setImpresso("fotolito_impresso","fotolito_executado", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{SIM_NAO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <FormField label={`Fotolito Executado${form.fotolito_impresso === "Sim" ? " *" : ""}`}>
                    <DateInputBR disabled={form.fotolito_impresso !== "Sim"}
                      value={form.fotolito_executado}
                      onChange={(v) => set("fotolito_executado", v)} />
                  </FormField>
                </>
              )}

              <FormField label="Status da Arte">
                <Select value={form.status_arte ?? ""} onValueChange={(v) => set("status_arte", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{STATUS_ARTE_OPCOES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>

              <div className="sm:col-span-2">
                <FormField label="Observações da Arte">
                  <Textarea value={form.arte_observacao ?? ""} onChange={(e) => set("arte_observacao", e.target.value)} rows={2} />
                </FormField>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" />Atualizar Arte</Button>
          </CardContent>
        </Card>
      ) : (
        <EmptyState>Selecione um pedido no Dashboard abaixo.</EmptyState>
      )}

      {/* Dashboard da Arte */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dashboard — Arte</CardTitle></CardHeader>
        <CardContent className="p-0">
          {/* Mobile */}
          <div className="md:hidden divide-y">
            {(() => {
              const visiveis = pedidos.filter((p) => visivelEmArte(p) && pedidoAtivoNasAreas(p));
              if (visiveis.length === 0) return <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido em aberto.</div>;
              return visiveis.map((p) => (
                <PedidoMobileCard key={p.id} pedido={p} active={selected?.id === p.id} onClick={() => onSelect(p.id)}>
                  <Chip label="Tipo" value={p.tipo_estampa} />
                  <Chip label="QTD" value={p.qtd} />
                  <StatusPecasChip pedido={p} />
                  <Chip label="Arte" value={p.status_arte} />
                  <Chip label="Entrega" value={formatDateBR(p.data_entrega) || "—"} />
                </PedidoMobileCard>
              ));
            })()}
          </div>
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                {["Etapa","Orçamento","Pedido","Tipo","QTD","Status de Peças","Status Arte","Frete","UF","Saída Juff","Data Entrega"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const visiveis = pedidos.filter((p) => visivelEmArte(p) && pedidoAtivoNasAreas(p));
                if (visiveis.length === 0) {
                  return <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido em aberto.</td></tr>;
                }
                return visiveis.map((p) => {
                  return (
                    <tr key={p.id}
                      onClick={() => onSelect(p.id)}
                      className={`border-t cursor-pointer hover:bg-accent ${selected?.id === p.id ? "bg-accent" : ""}`}>
                      <td className="px-3 py-2"><EtapaBadgeFromPedido pedido={p} /></td>
                      <td className="px-3 py-2 font-medium">{p.orcamento}</td>
                      <td className="px-3 py-2">{p.pedido_olist}</td>
                      <td className="px-3 py-2"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                      <td className="px-3 py-2">{p.qtd ?? "—"}</td>
                      <td className="px-3 py-2"><StatusPecasBadge pedido={p} /></td>
                      <td className="px-3 py-2">{p.status_arte ?? "—"}</td>
                      <td className="px-3 py-2">{p.frete ?? "—"}</td>
                      <td className="px-3 py-2">{p.uf_entrega ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.saida_juff)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.data_entrega)}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
