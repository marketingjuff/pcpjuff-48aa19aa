import { useEffect, useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import {
  VENDEDORES, STATUS_GERAL_OPCOES, TIPOS_ESTAMPA, SIM_NAO, UFS,
  calcularEtapaAtual, tipoIncluiDTF, tipoIncluiSilk,
} from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Save, X, Upload, FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDiasUteis, diasUteisEntre } from "@/lib/dias-uteis";
import { useFeriados } from "@/hooks/use-feriados";
import { formatDateBR } from "@/lib/format";
import { EtapaBadgeFromPedido } from "./shared";
import { useDirtyTracker, useRegisterSave, useDirtyForm } from "./dirty-form-context";

interface Props {
  pedidos: Pedido[];
  selected: Pedido | null;
  onSelect: (id: string | null) => void;
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  onDelete: (id: string) => void;
  saving: boolean;
}

const empty: Partial<Pedido> = {
  pedido_olist: "",
  orcamento: "",
  qtd: null,
  vendedor: "Wander",
  tipo_estampa: "",
  status_geral: "",
  entrada_pedido: new Date().toISOString().slice(0, 10),
  necessita_vetorizacao: false,
};

export function DadosInTab({ pedidos, selected, onSelect, onSave, onDelete, saving }: Props) {
  const [form, setForm] = useState<Partial<Pedido>>(empty);
  const [uploading, setUploading] = useState(false);
  const { feriados } = useFeriados();
  const { isDirty } = useDirtyForm();

  useEffect(() => {
    if (!isDirty) setForm(selected ?? empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  useDirtyTracker(form, selected ?? empty);

  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  function setTipoEstampa(v: string) {
    setForm((f) => {
      const next: Partial<Pedido> = { ...f, tipo_estampa: v };
      if (!tipoIncluiDTF(v)) {
        next.dtf_impresso = null;
        next.dtf_executado = null;
        next.dtf_estampado = null;
        next.dtf_data_executada = null;
        next.quem_bateu_dtf = null;
        next.dtf_observacao = null;
      }
      if (!tipoIncluiSilk(v)) {
        next.fotolito_impresso = null;
        next.fotolito_executado = null;
        next.tela_gravada = null;
        next.silk_feito = null;
        next.silk_data_executada = null;
        next.quem_bateu_silk = null;
        next.silk_observacao = null;
      }
      if (v === "Lisa") next.status_arte = null;
      return next;
    });
  }

  // Cálculos automáticos
  const tempoFreteNum = Number(form.tempo_frete ?? 0) || 0;
  const saidaJuffCalc = useMemo(() => {
    if (!form.data_entrega || !tempoFreteNum) return null;
    return addDiasUteis(form.data_entrega, -tempoFreteNum, feriados);
  }, [form.data_entrega, tempoFreteNum, feriados]);
  const tempoProducaoCalc = useMemo(() => {
    if (!form.entrada_pedido || !saidaJuffCalc) return null;
    return diasUteisEntre(form.entrada_pedido, saidaJuffCalc, feriados);
  }, [form.entrada_pedido, saidaJuffCalc, feriados]);

  function doSave() {
    if (!form.pedido_olist || !form.orcamento || !form.qtd || !form.vendedor || !form.tipo_estampa || !form.entrada_pedido) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    onSave({
      ...form,
      saida_juff: saidaJuffCalc ?? form.saida_juff ?? null,
      tempo_producao: tempoProducaoCalc ?? form.tempo_producao ?? null,
    });
  }
  function handleSave(e: React.FormEvent) { e.preventDefault(); doSave(); }
  useRegisterSave(doSave);

  function handleNew() { onSelect(null); setForm(empty); }

  async function handleUpload(file: File) {
    if (file.type !== "application/pdf") { toast.error("Apenas PDF."); return; }
    if (file.size > 30 * 1024 * 1024) { toast.error("Máx. 30MB."); return; }
    setUploading(true);
    try {
      const path = `${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("layouts").upload(path, file, { contentType: "application/pdf" });
      if (error) throw error;
      set("layout_url", path);
      // Persiste imediatamente se o pedido já existe, para não perder ao trocar de aba
      if (selected?.id) {
        const { error: updErr } = await supabase.from("pedidos").update({ layout_url: path }).eq("id", selected.id);
        if (updErr) throw updErr;
      }
      toast.success("Layout enviado.");
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally { setUploading(false); }
  }

  async function baixarLayout(path: string) {
    const { baixarLayoutPDF } = await import("./shared");
    baixarLayoutPDF(path);
  }


  return (
    <div className="space-y-6">
      {/* Orçamento em destaque */}
      <Card className="border-primary/30">
        <CardContent className="py-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Orçamento Comercial</div>
            <div className="text-4xl font-bold tabular-nums">{form.orcamento || "—"}</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>
            {selected && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive"><Trash2 className="h-4 w-4 mr-1" />Deletar</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => selected && onDelete(selected.id)}>Deletar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {selected && <PedidoStatusInline pedido={selected} />}



      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-2">
        {/* Vendedor */}
        <Card className="border-l-4 border-l-green-500 bg-green-50/40 dark:bg-green-950/10">
          <CardHeader><CardTitle className="text-base text-green-700 dark:text-green-400">Input do Vendedor</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Pedido Olist *"><Input value={form.pedido_olist ?? ""} onChange={(e) => set("pedido_olist", e.target.value)} required /></Field>
            <Field label="Orçamento Comercial *"><Input value={form.orcamento ?? ""} onChange={(e) => set("orcamento", e.target.value)} required /></Field>
            <Field label="Quantas peças *"><Input value={form.qtd ?? ""} onChange={(e) => set("qtd", e.target.value)} required /></Field>
            <Field label="Vendedor *">
              <Select value={form.vendedor ?? ""} onValueChange={(v) => set("vendedor", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VENDEDORES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Frete (transportadora)"><Input value={form.frete ?? ""} onChange={(e) => set("frete", e.target.value)} /></Field>
            <Field label="Tempo de frete (dias úteis)"><Input type="number" min="0" value={form.tempo_frete ?? ""} onChange={(e) => set("tempo_frete", e.target.value)} /></Field>
            <Field label="UF de Entrega">
              <Select value={form.uf_entrega ?? ""} onValueChange={(v) => set("uf_entrega", v)}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UFS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Entrada do pedido *">
              <DateInputBR value={form.entrada_pedido} onChange={(v) => set("entrada_pedido", v ?? "")} required />
            </Field>
            <Field label="Data de Entrega">
              <DateInputBR value={form.data_entrega} onChange={(v) => set("data_entrega", v)} />
            </Field>
            <Field label="É necessário vetorização?">
              <Select value={form.necessita_vetorizacao ? "Sim" : "Não"} onValueChange={(v) => set("necessita_vetorizacao", v === "Sim")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SIM_NAO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Layout (PDF até 30MB)">
                <div className="flex items-center gap-2">
                  <Input type="file" accept="application/pdf" disabled={uploading}
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                  {form.layout_url && (
                    <Button type="button" variant="outline" size="sm" onClick={() => baixarLayout(form.layout_url!)}>
                      <Download className="h-4 w-4 mr-1" /> Baixar layout
                    </Button>
                  )}
                </div>
                {form.layout_url && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{form.layout_url.replace(/^[0-9a-f-]{36}-/i, "")}</span>
                  </div>
                )}
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Observações do vendedor">
                <Textarea rows={3} value={form.obs_vendedor ?? ""} onChange={(e) => set("obs_vendedor", e.target.value)} />
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* Produção */}
        <Card className="border-l-4 border-l-blue-500 bg-blue-50/40 dark:bg-blue-950/10">
          <CardHeader><CardTitle className="text-base text-blue-700 dark:text-blue-400">Input de Produção</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Status Geral *">
              <Select value={form.status_geral ?? ""} onValueChange={(v) => set("status_geral", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{STATUS_GERAL_OPCOES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Tipo de Estampa *">
              <Select value={form.tipo_estampa ?? ""} onValueChange={(v) => set("tipo_estampa", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{TIPOS_ESTAMPA.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Arte (limite)">
              <DateInputBR value={form.arte_data} onChange={(v) => set("arte_data", v)} />
            </Field>
            <Field label="Início Estamparia">
              <DateInputBR value={form.inicio_estamparia} onChange={(v) => set("inicio_estamparia", v)} />
            </Field>
            <Field label="Término Estamparia">
              <DateInputBR value={form.termino_estamparia} onChange={(v) => set("termino_estamparia", v)} />
            </Field>
            <Field label="Acabamento">
              <DateInputBR value={form.acabamento_data} onChange={(v) => set("acabamento_data", v)} />
            </Field>
            <Field label="Saída Juff (calculado)">
              <div className="px-3 py-2 rounded-md bg-muted/50 border text-sm font-medium">{saidaJuffCalc ? formatDateBR(saidaJuffCalc) : "—"}</div>
            </Field>
            <Field label="Tempo de produção (dias úteis)">
              <div className="px-3 py-2 rounded-md bg-muted/50 border text-sm font-medium">{tempoProducaoCalc ?? "—"}</div>
            </Field>
            <div className="md:col-span-2">
              <Field label="Observações de produção">
                <Textarea rows={3} value={form.observacoes_pedido ?? ""} onChange={(e) => set("observacoes_pedido", e.target.value)} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 flex gap-2">
          <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-1" />{selected ? "Atualizar" : "Salvar"}</Button>
          {selected && (
            <Button type="button" variant="outline" onClick={handleNew}><X className="h-4 w-4 mr-1" />Cancelar edição</Button>
          )}
        </div>
      </form>

      {/* Dashboard Dados In — esconde finalizados */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dashboard — Dados In</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                {["Etapa","Pedido","Orçamento","QTD","Vendedor","Frete","Tempo Frete","Status","Estampa","Entrada","Arte","Início Estamp.","Término Estamp.","Acabamento","Tempo Prod.","Dias","Saída Juff","Data Entrega"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pedidos.filter((p) => !p.finalizado_em).map((p) => {
                const dias = p.data_entrega ? diasUteisEntre(new Date().toISOString().slice(0,10), p.data_entrega, feriados) : null;
                return (
                  <tr key={p.id}
                    onClick={() => onSelect(p.id)}
                    className={`border-t cursor-pointer hover:bg-accent ${selected?.id === p.id ? "bg-accent" : ""}`}>
                    <td className="px-3 py-2"><EtapaBadgeFromPedido pedido={p} /></td>
                    <td className="px-3 py-2 font-medium">{p.pedido_olist}</td>
                    <td className="px-3 py-2">{p.orcamento}</td>
                    <td className="px-3 py-2">{p.qtd}</td>
                    <td className="px-3 py-2">{p.vendedor}</td>
                    <td className="px-3 py-2">{p.frete ?? "—"}</td>
                    <td className="px-3 py-2">{p.tempo_frete ?? "—"}</td>
                    <td className="px-3 py-2"><Badge variant={p.status_geral === "Completo" ? "default" : "secondary"}>{p.status_geral}</Badge></td>
                    <td className="px-3 py-2"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.entrada_pedido)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.arte_data)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.inicio_estamparia)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.termino_estamparia)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.acabamento_data)}</td>
                    <td className="px-3 py-2">{p.tempo_producao ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{dias ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.saida_juff)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.data_entrega)}</td>
                  </tr>
                );
              })}
              {pedidos.filter((p) => !p.finalizado_em).length === 0 && (
                <tr><td colSpan={18} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido ativo.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function PedidoStatusInline({ pedido }: { pedido: Pedido }) {
  const { etapa, cor } = calcularEtapaAtual(pedido);
  const aguardando = cor === "yellow" || cor === "blue" || cor === "gray";
  const finalizado = !!pedido.finalizado_em;
  const bg = finalizado
    ? "bg-success/10 border-success/30 text-success"
    : aguardando
    ? "bg-warning/15 border-warning/30 text-warning-foreground"
    : "bg-info/10 border-info/30 text-info";
  const label = finalizado
    ? "Pedido finalizado"
    : aguardando
    ? `Aguardando etapa: ${etapa}`
    : `Etapa atual: ${etapa}`;
  return (
    <div className={`flex items-center gap-2 p-3 rounded-md border text-sm ${bg}`}>
      <span className="font-medium">{label}</span>
    </div>
  );
}



function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}
