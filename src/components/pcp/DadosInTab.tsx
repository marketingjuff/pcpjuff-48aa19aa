import { useEffect, useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import {
  VENDEDORES, STATUS_GERAL_OPCOES, TIPOS_ESTAMPA, SIM_NAO, UFS,
  calcularEtapaAtual,
} from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Save, X, Upload, FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDiasUteis, diasUteisEntre } from "@/lib/dias-uteis";
import { useFeriados } from "@/hooks/use-feriados";
import { formatDateBR } from "@/lib/format";

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
  qtd: "",
  vendedor: "Wander",
  tipo_estampa: "DTF",
  status_geral: "Aberto",
  entrada_pedido: new Date().toISOString().slice(0, 10),
  necessita_vetorizacao: false,
};

export function DadosInTab({ pedidos, selected, onSelect, onSave, onDelete, saving }: Props) {
  const [form, setForm] = useState<Partial<Pedido>>(empty);
  const [uploading, setUploading] = useState(false);
  const { feriados } = useFeriados();

  useEffect(() => { setForm(selected ?? empty); }, [selected]);

  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

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

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
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
      toast.success("Layout enviado.");
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally { setUploading(false); }
  }

  async function abrirLayout(path: string) {
    const { data, error } = await supabase.storage.from("layouts").createSignedUrl(path, 3600);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
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

      <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-2">
        {/* Vendedor */}
        <Card className="border-l-4 border-l-green-500 bg-green-50/40 dark:bg-green-950/10">
          <CardHeader><CardTitle className="text-base text-green-700 dark:text-green-400">Input do Vendedor</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Orçamento *"><Input value={form.orcamento ?? ""} onChange={(e) => set("orcamento", e.target.value)} required /></Field>
            <Field label="Pedido Olist *"><Input value={form.pedido_olist ?? ""} onChange={(e) => set("pedido_olist", e.target.value)} required /></Field>
            <Field label="QTD peças *"><Input value={form.qtd ?? ""} onChange={(e) => set("qtd", e.target.value)} required /></Field>
            <Field label="Vendedor *">
              <Select value={form.vendedor ?? ""} onValueChange={(v) => set("vendedor", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VENDEDORES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Tipo de estampa *">
              <Select value={form.tipo_estampa ?? ""} onValueChange={(v) => set("tipo_estampa", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_ESTAMPA.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Data de Entrega">
              <Input type="date" value={form.data_entrega ?? ""} onChange={(e) => set("data_entrega", e.target.value || null)} />
            </Field>
            <Field label="UF de entrega">
              <Select value={form.uf_entrega ?? ""} onValueChange={(v) => set("uf_entrega", v)}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UFS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Necessita vetorização?">
              <Select value={form.necessita_vetorizacao ? "Sim" : "Não"} onValueChange={(v) => set("necessita_vetorizacao", v === "Sim")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SIM_NAO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Layout (PDF)">
                <div className="flex items-center gap-2">
                  <Input type="file" accept="application/pdf" disabled={uploading}
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                  {form.layout_url && (
                    <Button type="button" variant="outline" size="sm" onClick={() => abrirLayout(form.layout_url!)}>
                      <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                    </Button>
                  )}
                </div>
                {form.layout_url && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Arquivo anexado
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
            <Field label="Frete (transportadora)"><Input value={form.frete ?? ""} onChange={(e) => set("frete", e.target.value)} /></Field>
            <Field label="Tempo de frete (dias úteis)"><Input type="number" min="0" value={form.tempo_frete ?? ""} onChange={(e) => set("tempo_frete", e.target.value)} /></Field>
            <Field label="Status Geral *">
              <Select value={form.status_geral ?? ""} onValueChange={(v) => set("status_geral", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_GERAL_OPCOES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Entrada do pedido *">
              <Input type="date" value={form.entrada_pedido ?? ""} onChange={(e) => set("entrada_pedido", e.target.value)} required />
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

      {/* Dashboard Dados In */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dashboard — Dados In ({pedidos.length})</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                {["Orçamento","Pedido Olist","QTD","Vendedor","Tipo","UF","Entrada","Entrega","Saída Juff","Tempo Prod","Status","Etapa"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => {
                const { etapa } = calcularEtapaAtual(p);
                return (
                  <tr key={p.id}
                    onClick={() => onSelect(p.id)}
                    className={`border-t cursor-pointer hover:bg-accent ${selected?.id === p.id ? "bg-accent" : ""}`}>
                    <td className="px-3 py-2 font-medium">{p.orcamento}</td>
                    <td className="px-3 py-2">{p.pedido_olist}</td>
                    <td className="px-3 py-2">{p.qtd}</td>
                    <td className="px-3 py-2">{p.vendedor}</td>
                    <td className="px-3 py-2"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                    <td className="px-3 py-2">{p.uf_entrega ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.entrada_pedido)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.data_entrega)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.saida_juff)}</td>
                    <td className="px-3 py-2">{p.tempo_producao ?? "—"}</td>
                    <td className="px-3 py-2"><Badge variant={p.status_geral === "Completo" ? "default" : "secondary"}>{p.status_geral}</Badge></td>
                    <td className="px-3 py-2 text-xs">{etapa}</td>
                  </tr>
                );
              })}
              {pedidos.length === 0 && (
                <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
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
