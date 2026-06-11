import { useEffect, useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import {
  SIM_NAO, STATUS_ARTE_OPCOES, tipoIncluiDTF, tipoIncluiSilk,
  calcularEtapaAtual, visivelEmArte, arteCompleta, arteAlgumPreenchido, statusEtapa,
} from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, AlertTriangle, Download } from "lucide-react";
import { ReadOnlyField, FormField, EmptyState, EtapaStatusBanner, EtapaBadge } from "./shared";
import { formatDateBR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


interface Props {
  pedidos: Pedido[];
  selected: Pedido | null;
  onSelect: (id: string | null) => void;
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  saving: boolean;
}

export function ArteTab({ pedidos, selected, onSelect, onSave, saving }: Props) {
  const [form, setForm] = useState<Partial<Pedido>>({});
  useEffect(() => { if (selected) setForm(selected); }, [selected?.id]);

  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  // Reset de data quando muda Sim → Não
  function setImpresso(field: "dtf_impresso" | "fotolito_impresso", dataField: "dtf_executado" | "fotolito_executado", v: string) {
    setForm((f) => ({
      ...f,
      [field]: v,
      ...(v === "Não" ? { [dataField]: null } : {}),
    }));
  }

  function handleSave() { if (!selected) return; onSave({ ...form, id: selected.id }); }

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
            <EtapaStatusBanner
              pendencias={[
                !selected.entrada_pedido && "Entrada do pedido (Dados In)",
                !selected.tipo_estampa && "Tipo de estampa (Dados In)",
                !selected.qtd && "Quantidade (Dados In)",
                !selected.data_entrega && "Data de entrega (Dados In)",
                !selected.arte_data && "Prazo de arte (Dados In)",
              ].filter(Boolean) as string[]}
              atrasado={!!arteAtrasada}
              atrasadoMsg={`Arte ultrapassou a data limite (${formatDateBR(selected.arte_data)}).`}
            />

            <div className="grid gap-4 md:grid-cols-3">
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
                  <Button variant="outline" size="sm" onClick={() => baixarLayout(selected.layout_url!)}>
                    <Download className="h-4 w-4 mr-1" /> Baixar PDF
                  </Button>
                ) : <div className="text-sm text-muted-foreground">Sem layout</div>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
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

              <div className="md:col-span-2">
                <FormField label="Observações da Arte">
                  <Textarea value={form.arte_observacao ?? ""} onChange={(e) => set("arte_observacao", e.target.value)} rows={2} />
                </FormField>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" />Salvar</Button>
          </CardContent>
        </Card>
      ) : (
        <EmptyState>Selecione um pedido no Dashboard abaixo.</EmptyState>
      )}

      {/* Dashboard da Arte */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dashboard — Arte</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                {["Status","Orçamento","Pedido","Tipo","Status Arte","Frete","UF","Entrega","Etapa"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const visiveis = pedidos.filter((p) => visivelEmArte(p) && !p.finalizado_em);
                if (visiveis.length === 0) {
                  return <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido com Dados In completos.</td></tr>;
                }
                return visiveis.map((p) => {
                  const { etapa } = calcularEtapaAtual(p);
                  const st = statusEtapa(arteCompleta(p), arteAlgumPreenchido(p));
                  return (
                    <tr key={p.id}
                      onClick={() => onSelect(p.id)}
                      className={`border-t cursor-pointer hover:bg-accent ${selected?.id === p.id ? "bg-accent" : ""}`}>
                      <td className="px-3 py-2"><EtapaBadge status={st} labels={{ pendente: "Arte Pendente", andamento: "Arte em Andamento", concluido: "Arte Concluída" }} /></td>
                      <td className="px-3 py-2 font-medium">{p.orcamento}</td>
                      <td className="px-3 py-2">{p.pedido_olist}</td>
                      <td className="px-3 py-2"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                      <td className="px-3 py-2">{p.status_arte ?? "—"}</td>
                      <td className="px-3 py-2">{p.frete ?? "—"}</td>
                      <td className="px-3 py-2">{p.uf_entrega ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.data_entrega)}</td>
                      <td className="px-3 py-2 text-xs">{etapa}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </CardContent>
      </Card>

    </div>
  );
}
