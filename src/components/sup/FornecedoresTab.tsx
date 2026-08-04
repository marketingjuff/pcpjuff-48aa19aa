import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";
import { SortTh, useTableSort } from "@/components/shared/sortable";
import { SUP_CONDICOES_PAGAMENTO, type SupFornecedor } from "@/lib/sup";

const VAZIO: Partial<SupFornecedor> = { ativo: true };

export function useSupFornecedores() {
  return useQuery({
    queryKey: ["sup-fornecedores"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sup_fornecedores")
        .select("*")
        .order("razao_social");
      if (error) throw error;
      return (data ?? []) as SupFornecedor[];
    },
  });
}

export function FornecedoresTab() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useSupFornecedores();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "ativos" | "inativos">("ativos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<SupFornecedor>>(VAZIO);

  const filtradas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return rows.filter((f) => {
      if (filtro === "ativos" && !f.ativo) return false;
      if (filtro === "inativos" && f.ativo) return false;
      if (!b) return true;
      return [f.razao_social, f.nome_fantasia, f.documento, f.categoria]
        .some((v) => (v ?? "").toLowerCase().includes(b));
    });
  }, [rows, busca, filtro]);

  const { rows: ordenadas, sortKey, sortDir, toggle } = useTableSort(filtradas, {
    razao_social: (r) => r.razao_social,
    nome_fantasia: (r) => r.nome_fantasia,
    documento: (r) => r.documento,
    categoria: (r) => r.categoria,
    cidade: (r) => r.cidade,
    ativo: (r) => (r.ativo ? 1 : 0),
  }, { key: "razao_social" });

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
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await (supabase as any)
          .from("sup_fornecedores")
          .insert({ ...payload, created_by: u.user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-fornecedores"] });
      toast.success("Fornecedor salvo.");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar."),
  });

  function novo() { setForm(VAZIO); setOpen(true); }
  function editar(f: SupFornecedor) { setForm({ ...f }); setOpen(true); }
  function set<K extends keyof SupFornecedor>(k: K, v: SupFornecedor[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-64">
          <Label className="text-xs">Busca</Label>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou documento" className="h-9" />
        </div>
        <div className="w-40">
          <Label className="text-xs">Situação</Label>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as any)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Button onClick={novo} className="h-9 bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="h-4 w-4 mr-1" /> Novo fornecedor
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-auto max-h-[70vh]">
        <table className="w-full text-[13px] tbl-congelada">
          <thead className="bg-muted/40">
            <tr className="text-xs">
              <SortTh label="Razão social" sortKey="razao_social" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
              <SortTh label="Nome fantasia" sortKey="nome_fantasia" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
              <SortTh label="Documento" sortKey="documento" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
              <SortTh label="Categoria" sortKey="categoria" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
              <SortTh label="Cidade/UF" sortKey="cidade" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
              <th className="p-1.5 font-medium text-left">Contato</th>
              <SortTh label="Situação" sortKey="ativo" current={sortKey} dir={sortDir} onSort={toggle} />
              <th className="p-1.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>
            ) : ordenadas.length === 0 ? (
              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Nenhum fornecedor.</td></tr>
            ) : ordenadas.map((f) => (
              <tr key={f.id} className="border-t hover:bg-muted/20">
                <td className="p-1.5 font-medium">{f.razao_social}</td>
                <td className="p-1.5">{f.nome_fantasia ?? "—"}</td>
                <td className="p-1.5">{f.documento ?? "—"}</td>
                <td className="p-1.5">{f.categoria ?? "—"}</td>
                <td className="p-1.5">{[f.cidade, f.uf].filter(Boolean).join(" / ") || "—"}</td>
                <td className="p-1.5">{[f.contato_nome, f.contato_telefone].filter(Boolean).join(" · ") || "—"}</td>
                <td className="p-1.5 text-center">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${f.ativo ? "bg-teal-100 text-teal-900" : "bg-muted text-muted-foreground"}`}>
                    {f.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="p-1.5 text-center">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editar(f)} title="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
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
              <Label className="text-xs">Categoria</Label>
              <Input value={form.categoria ?? ""} onChange={(e) => set("categoria", e.target.value)} className="h-9" placeholder="Tintas, limpeza, papelaria…" />
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
