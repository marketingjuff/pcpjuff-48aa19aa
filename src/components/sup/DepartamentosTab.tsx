import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { SupDepartamento } from "@/lib/sup";

export function useSupDepartamentos() {
  return useQuery({
    queryKey: ["sup-departamentos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sup_departamentos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as SupDepartamento[];
    },
  });
}

export function DepartamentosTab() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useSupDepartamentos();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<SupDepartamento>>({ nome: "", ativo: true });
  const [excluir, setExcluir] = useState<SupDepartamento | null>(null);

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("sup_departamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-departamentos"] });
      toast.success("Departamento excluído.");
      setExcluir(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir."),
  });


  const salvar = useMutation({
    mutationFn: async (f: Partial<SupDepartamento>) => {
      const nome = (f.nome ?? "").trim();
      if (!nome) throw new Error("Informe o nome do departamento.");
      const payload = { nome, ativo: f.ativo ?? true };
      if (f.id) {
        const { error } = await (supabase as any).from("sup_departamentos").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await (supabase as any)
          .from("sup_departamentos")
          .insert({ ...payload, created_by: u.user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-departamentos"] });
      toast.success("Departamento salvo.");
      setOpen(false);
    },
    onError: (e: any) =>
      toast.error(
        String(e.message ?? "").includes("duplicate") || String(e.code ?? "") === "23505"
          ? "Já existe um departamento com esse nome."
          : (e.message ?? "Erro ao salvar."),
      ),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Departamentos</h3>
          <p className="text-xs text-muted-foreground">Lista usada no cadastro de produtos do SUP.</p>
        </div>
        <Button
          className="h-9 bg-teal-600 hover:bg-teal-700 text-white"
          onClick={() => { setForm({ nome: "", ativo: true }); setOpen(true); }}
        >
          <Plus className="h-4 w-4 mr-1" /> Novo departamento
        </Button>
      </div>

      <div className="rounded-md border bg-card overflow-auto max-h-[60vh]">
        <table className="w-full text-[13px] tbl-congelada">
          <thead className="bg-muted/40">
            <tr className="text-xs">
              <th className="p-1.5 font-medium text-left">Departamento</th>
              <th className="p-1.5 font-medium">Situação</th>
              <th className="p-1.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Nenhum departamento cadastrado.</td></tr>
            ) : rows.map((d) => (
              <tr key={d.id} className="border-t hover:bg-muted/20">
                <td className="p-1.5 font-medium">{d.nome}</td>
                <td className="p-1.5 text-center">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${d.ativo ? "bg-teal-100 text-teal-900" : "bg-muted text-muted-foreground"}`}>
                    {d.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="p-1.5 text-center">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setForm({ ...d }); setOpen(true); }} title="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader><DialogTitle>{form.id ? "Editar departamento" : "Novo departamento"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={form.nome ?? ""} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Situação</Label>
              <Select value={form.ativo === false ? "inativo" : "ativo"} onValueChange={(v) => setForm((f) => ({ ...f, ativo: v === "ativo" }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={salvar.isPending} onClick={() => salvar.mutate(form)}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
