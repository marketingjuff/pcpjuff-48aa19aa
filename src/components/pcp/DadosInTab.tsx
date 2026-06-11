import { useEffect, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { VENDEDORES, STATUS_OPCOES, MODELOS_ESTAMPA } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Copy, Trash2, Save, X } from "lucide-react";

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
  frete: "",
  tempo_frete: "",
  status: "Aberto",
  tipo_estampa: "DTF",
  entrada_pedido: new Date().toISOString().slice(0, 10),
};

export function DadosInTab({ pedidos, selected, onSelect, onSave, onDelete, saving }: Props) {
  const [form, setForm] = useState<Partial<Pedido>>(empty);

  useEffect(() => { setForm(selected ?? empty); }, [selected]);

  function set<K extends keyof Pedido>(k: K, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.pedido_olist || !form.orcamento || !form.qtd || !form.vendedor || !form.tipo_estampa || !form.entrada_pedido) return;
    onSave(form);
  }

  function handleNew() {
    onSelect(null);
    setForm(empty);
  }

  function handleDuplicate() {
    if (!selected) return;
    const { id, created_at, updated_at, user_id, ...rest } = selected;
    onSelect(null);
    setForm({ ...rest, pedido_olist: rest.pedido_olist + " (cópia)" });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{selected ? "Editar pedido" : "Novo pedido"}</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>
            {selected && (
              <>
                <Button size="sm" variant="outline" onClick={handleDuplicate}><Copy className="h-4 w-4 mr-1" />Duplicar</Button>
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
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
            <Field label="Pedido Olist *"><Input value={form.pedido_olist ?? ""} onChange={(e) => set("pedido_olist", e.target.value)} required /></Field>
            <Field label="Orçamento Comercial *"><Input value={form.orcamento ?? ""} onChange={(e) => set("orcamento", e.target.value)} required /></Field>
            <Field label="QTD peças *"><Input value={form.qtd ?? ""} onChange={(e) => set("qtd", e.target.value)} required /></Field>
            <Field label="Vendedor *">
              <Select value={form.vendedor ?? ""} onValueChange={(v) => set("vendedor", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VENDEDORES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Frete"><Input value={form.frete ?? ""} onChange={(e) => set("frete", e.target.value)} /></Field>
            <Field label="Tempo de frete *"><Input value={form.tempo_frete ?? ""} onChange={(e) => set("tempo_frete", e.target.value)} /></Field>
            <Field label="Status *">
              <Select value={form.status_geral ?? ""} onValueChange={(v) => set("status_geral", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPCOES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Modelo de estampa *">
              <Select value={form.tipo_estampa ?? ""} onValueChange={(v) => set("tipo_estampa", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MODELOS_ESTAMPA.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Entrada pedido *"><Input type="date" value={form.entrada_pedido ?? ""} onChange={(e) => set("entrada_pedido", e.target.value)} required /></Field>
            <Field label="Arte (limite)"><Input type="date" value={form.arte_data ?? ""} onChange={(e) => set("arte_data", e.target.value || null)} /></Field>
            <Field label="Início estamparia"><Input type="date" value={form.inicio_estamparia ?? ""} onChange={(e) => set("inicio_estamparia", e.target.value || null)} /></Field>
            <Field label="Término estamparia"><Input type="date" value={form.termino_estamparia ?? ""} onChange={(e) => set("termino_estamparia", e.target.value || null)} /></Field>
            <Field label="Acabamento (previsto)"><Input type="date" value={form.acabamento_data ?? ""} onChange={(e) => set("acabamento_data", e.target.value || null)} /></Field>
            <Field label="Saída Juff"><Input type="date" value={form.saida_juff ?? ""} onChange={(e) => set("saida_juff", e.target.value || null)} /></Field>
            <div className="md:col-span-2 flex gap-2 pt-2">
              <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-1" />{selected ? "Atualizar" : "Salvar"}</Button>
              {selected && (
                <Button type="button" variant="outline" onClick={handleNew}><X className="h-4 w-4 mr-1" />Cancelar edição</Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pedidos ({pedidos.length})</CardTitle></CardHeader>
        <CardContent className="p-0 max-h-[600px] overflow-y-auto">
          <ul className="divide-y">
            {pedidos.map((p) => (
              <li key={p.id} onClick={() => onSelect(p.id)}
                className={`cursor-pointer px-4 py-3 hover:bg-accent transition-colors ${selected?.id === p.id ? "bg-accent" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{p.pedido_olist}</span>
                  <Badge variant={p.status_geral === "Completo" ? "default" : "secondary"} className="text-xs">{p.status_geral}</Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">{p.orcamento}</div>
                <div className="text-xs text-muted-foreground mt-1">{p.tipo_estampa} · {p.qtd} pç · {p.vendedor}</div>
              </li>
            ))}
            {pedidos.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum pedido. Crie o primeiro.</li>
            )}
          </ul>
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
