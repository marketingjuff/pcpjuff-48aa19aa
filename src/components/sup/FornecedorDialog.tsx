import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SUP_CONDICOES_PAGAMENTO, type SupFornecedor } from "@/lib/sup";

const VAZIO: Partial<SupFornecedor> = { ativo: true };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fornecedor?: SupFornecedor | null;
  onSaved?: (id: string | null) => void;
};

export function FornecedorDialog({ open, onOpenChange, fornecedor, onSaved }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<SupFornecedor>>(VAZIO);

  useEffect(() => {
    if (open) setForm(fornecedor ? { ...fornecedor } : { ...VAZIO });
  }, [open, fornecedor]);

  const salvar = useMutation({
    mutationFn: async (f: Partial<SupFornecedor>) => {
      if (!f.razao_social?.trim()) throw new Error("Informe a razão social.");
      const payload = {
        razao_social: f.razao_social.trim(),
        nome_fantasia: f.nome_fantasia || null,
        documento: f.documento || null,
        categoria: f.categoria || null,
        contato_nome: f.contato_nome || null,
        contato_telefone: f.contato_telefone || null,
        contato_email: f.contato_email || null,
        cidade: f.cidade || null,
        uf: f.uf ? f.uf.toUpperCase().slice(0, 2) : null,
        condicao_pagamento_padrao: f.condicao_pagamento_padrao || null,
        prazo_entrega_padrao_dias: f.prazo_entrega_padrao_dias ?? null,
        ativo: f.ativo ?? true,
        observacoes: f.observacoes || null,
      };
      if (f.id) {
        const { error } = await (supabase as any).from("sup_fornecedores").update(payload).eq("id", f.id);
        if (error) throw error;
        return f.id as string;
      }
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("sup_fornecedores")
        .insert({ ...payload, created_by: u.user?.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      return (data?.id as string | undefined) ?? null;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["sup-fornecedores"] });
      toast.success("Fornecedor salvo.");
      onOpenChange(false);
      onSaved?.(id ?? null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar."),
  });

  function set<K extends keyof SupFornecedor>(k: K, v: SupFornecedor[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[820px]">
        <DialogHeader><DialogTitle>{form.id ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">Razão social *</Label>
            <Input value={form.razao_social ?? ""} onChange={(e) => set("razao_social", e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Nome fantasia</Label>
            <Input value={form.nome_fantasia ?? ""} onChange={(e) => set("nome_fantasia", e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">CNPJ / CPF</Label>
            <Input value={form.documento ?? ""} onChange={(e) => set("documento", e.target.value)} className="h-9" />
          </div>
          <div>

            <Label className="text-xs">Contato — nome</Label>
            <Input value={form.contato_nome ?? ""} onChange={(e) => set("contato_nome", e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Contato — telefone</Label>
            <Input value={form.contato_telefone ?? ""} onChange={(e) => set("contato_telefone", e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Contato — e-mail</Label>
            <Input value={form.contato_email ?? ""} onChange={(e) => set("contato_email", e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Cidade</Label>
            <Input value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">UF</Label>
            <Input value={form.uf ?? ""} maxLength={2} onChange={(e) => set("uf", e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Condição de pagamento padrão</Label>
            <Select value={form.condicao_pagamento_padrao ?? ""} onValueChange={(v) => set("condicao_pagamento_padrao", v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {SUP_CONDICOES_PAGAMENTO.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Prazo de entrega padrão (dias)</Label>
            <Input
              type="number" min={0}
              value={form.prazo_entrega_padrao_dias ?? ""}
              onChange={(e) => set("prazo_entrega_padrao_dias", e.target.value === "" ? null : Number(e.target.value))}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Situação</Label>
            <Select value={form.ativo === false ? "inativo" : "ativo"} onValueChange={(v) => set("ativo", v === "ativo")}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={salvar.isPending} onClick={() => salvar.mutate(form)}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
