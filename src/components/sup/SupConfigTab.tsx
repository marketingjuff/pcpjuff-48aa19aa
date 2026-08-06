import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus } from "lucide-react";
import type { SupComissao, SupComissionado, SupConfig } from "@/lib/sup";
import { VariacoesConfig } from "@/components/sup/VariacoesConfig";

type Profile = { id: string; nome: string | null; email: string };

export function SupConfigTab() {
  const qc = useQueryClient();
  const [percentual, setPercentual] = useState("");
  const [carencia, setCarencia] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<SupComissionado>>({ ativo: true, percentual: 0 });

  const { data: config } = useQuery({
    queryKey: ["sup-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sup_config").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return (data ?? null) as SupConfig | null;
    },
  });

  useEffect(() => {
    if (!config) return;
    setPercentual(String(config.percentual_padrao ?? 0));
    setCarencia(String(config.dias_carencia_recebimento ?? 0));
  }, [config]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["sup-profiles"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("profiles").select("id, nome, email").order("nome");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const { data: comissionados = [] } = useQuery({
    queryKey: ["sup-comissionados"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sup_comissionados").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as SupComissionado[];
    },
  });

  const salvarConfig = useMutation({
    mutationFn: async () => {
      const p = Number(String(percentual).replace(",", "."));
      const c = Number(carencia);
      if (!Number.isFinite(p) || p < 0 || p > 100) throw new Error("Percentual padrão deve estar entre 0 e 100.");
      if (!Number.isInteger(c) || c < 0) throw new Error("Dias de carência deve ser um número inteiro não negativo.");
      const { data: u } = await supabase.auth.getUser();
      const payload = { percentual_padrao: p, dias_carencia_recebimento: c, updated_by: u.user?.id ?? null };
      if (config?.id) {
        const { error } = await (supabase as any).from("sup_config").update(payload).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("sup_config").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-config"] });
      toast.success("Configurações salvas.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar configurações."),
  });

  const salvarComissionado = useMutation({
    mutationFn: async (f: Partial<SupComissionado>) => {
      if (!f.user_id) throw new Error("Selecione o usuário.");
      if (!f.nome?.trim()) throw new Error("Informe o nome do comissionado.");
      const payload = {
        user_id: f.user_id,
        nome: f.nome.trim(),
        percentual: Number(f.percentual ?? 0),
        ativo: f.ativo ?? true,
      };
      if (f.id) {
        const { error } = await (supabase as any).from("sup_comissionados").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("sup_comissionados").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-comissionados"] });
      toast.success("Comissionado salvo.");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar comissionado."),
  });

  const nomeUsuario = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p ? (p.nome ?? p.email) : "—";
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-md border bg-card p-3 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider">Regras de comissão</div>
        <div>
          <Label className="text-xs">Percentual padrão sobre a economia (%)</Label>
          <Input value={percentual} onChange={(e) => setPercentual(e.target.value)} className="h-9 w-40" />
        </div>
        <div>
          <Label className="text-xs">Dias de carência após o recebimento total</Label>
          <Input type="number" min={0} value={carencia} onChange={(e) => setCarencia(e.target.value)} className="h-9 w-40" />
          <p className="text-[11px] text-muted-foreground mt-1">
            A comissão só entra na competência depois desse prazo, contado da data de recebimento total do pedido.
          </p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={salvarConfig.isPending} onClick={() => salvarConfig.mutate()}>
          Salvar configurações
        </Button>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <div className="px-3 py-2 bg-muted/40 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider">Comissionados</span>
          <Button size="sm" variant="outline" className="h-7"
            onClick={() => { setForm({ ativo: true, percentual: config?.percentual_padrao ?? 0 }); setOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
          </Button>
        </div>
        <table className="w-full text-[13px]">
          <thead className="bg-muted/20">
            <tr className="text-xs">
              <th className="p-1.5 text-left">Nome</th>
              <th className="p-1.5 text-left">Usuário</th>
              <th className="p-1.5 text-center">%</th>
              <th className="p-1.5 text-center">Situação</th>
              <th className="p-1.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {comissionados.length === 0 ? (
              <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Nenhum comissionado.</td></tr>
            ) : comissionados.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-1.5 font-medium">{c.nome}</td>
                <td className="p-1.5">{nomeUsuario(c.user_id)}</td>
                <td className="p-1.5 text-center tabular-nums">{Number(c.percentual).toFixed(2)}%</td>
                <td className="p-1.5 text-center">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${c.ativo ? "bg-teal-100 text-teal-900" : "bg-muted text-muted-foreground"}`}>
                    {c.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="p-1.5 text-center">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setForm({ ...c }); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader><DialogTitle>{form.id ? "Editar comissionado" : "Novo comissionado"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Usuário *</Label>
              <Select value={form.user_id ?? ""} onValueChange={(v) => {
                const p = profiles.find((x) => x.id === v);
                setForm((f) => ({ ...f, user_id: v, nome: f.nome || (p?.nome ?? p?.email ?? "") }));
              }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome ?? p.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Nome exibido *</Label>
              <Input value={form.nome ?? ""} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Percentual (%)</Label>
              <Input type="number" step="0.01" min={0} max={100} value={form.percentual ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, percentual: Number(e.target.value) }))} className="h-9 w-32" />
            </div>
            <div>
              <Label className="text-xs">Situação</Label>
              <Select value={form.ativo === false ? "inativo" : "ativo"} onValueChange={(v) => setForm((f) => ({ ...f, ativo: v === "ativo" }))}>
                <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={salvarComissionado.isPending} onClick={() => salvarComissionado.mutate(form)}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export type { SupComissao };
