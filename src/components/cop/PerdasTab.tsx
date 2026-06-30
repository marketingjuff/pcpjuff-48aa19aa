import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { REFACAO_MODELOS, REFACAO_CORES, REFACAO_TAMANHOS } from "@/lib/pedidos";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import type { Cop, CopPerdaRegistro, CopPerdaLinha, Oficina } from "@/lib/cop";
import { formatCopNumero } from "@/lib/cop";
import { useIsAdmin } from "@/hooks/use-role";

export function PerdasTab() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();

  const { data: oficinas = [] } = useQuery({
    queryKey: ["oficinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oficinas" as any).select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Oficina[];
    },
  });

  const { data: perdas = [] } = useQuery({
    queryKey: ["cop_perdas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cop_perdas" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CopPerdaRegistro[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("cop-perdas")
      .on("postgres_changes", { event: "*", schema: "public", table: "cop_perdas" }, () => qc.invalidateQueries({ queryKey: ["cop_perdas"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const [form, setForm] = useState({
    oficina_id: "",
    etiqueta: "",
    modelo: "",
    cor: "",
    tamanho: "",
    qtd: 1,
    motivo: "",
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.modelo || !form.cor || !form.tamanho || form.qtd <= 0) {
        throw new Error("Preencha modelo, cor, tamanho e quantidade.");
      }
      const { data: ses } = await supabase.auth.getUser();
      const { error } = await supabase.from("cop_perdas" as any).insert({
        oficina_id: form.oficina_id || null,
        etiqueta: form.etiqueta || null,
        modelo: form.modelo,
        cor: form.cor,
        tamanho: form.tamanho,
        qtd: form.qtd,
        motivo: form.motivo || null,
        registrado_por: ses.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perda registrada.");
      setForm({ oficina_id: "", etiqueta: "", modelo: "", cor: "", tamanho: "", qtd: 1, motivo: "" });
      qc.invalidateQueries({ queryKey: ["cop_perdas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro."),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cop_perdas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["cop_perdas"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro."),
  });

  const ofiNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of oficinas) m.set(o.id, o.nome);
    return m;
  }, [oficinas]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Registrar perda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            <div className="md:col-span-2">
              <Label>Oficina</Label>
              <Select value={form.oficina_id} onValueChange={(v) => setForm((f) => ({ ...f, oficina_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {oficinas.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Etiqueta</Label>
              <Input value={form.etiqueta} onChange={(e) => setForm((f) => ({ ...f, etiqueta: e.target.value }))} />
            </div>
            <div>
              <Label>Modelo</Label>
              <Select value={form.modelo} onValueChange={(v) => setForm((f) => ({ ...f, modelo: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{REFACAO_MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor</Label>
              <Select value={form.cor} onValueChange={(v) => setForm((f) => ({ ...f, cor: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {REFACAO_CORES.map((c) => {
                    const fg = corTextoSobre(c.hex);
                    return <SelectItem key={c.nome} value={c.nome} style={{ backgroundColor: c.hex, color: fg }}>{c.nome}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tamanho</Label>
              <Select value={form.tamanho} onValueChange={(v) => setForm((f) => ({ ...f, tamanho: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{REFACAO_TAMANHOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Qtd</Label>
              <Input type="number" min={1} value={form.qtd} onChange={(e) => setForm((f) => ({ ...f, qtd: Math.max(1, Math.floor(Number(e.target.value) || 1)) }))} />
            </div>
            <div className="md:col-span-7">
              <Label>Motivo</Label>
              <Textarea rows={2} className="uppercase" value={form.motivo} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} />
            </div>
            <div className="md:col-span-7 flex justify-end">
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}><Plus className="h-4 w-4 mr-1" /> Registrar perda</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Apenas registro: não altera saldo Disponível.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Histórico de perdas</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-left">Oficina</th>
                  <th className="p-2 text-left">Etiqueta</th>
                  <th className="p-2 text-left">Modelo</th>
                  <th className="p-2 text-left">Cor</th>
                  <th className="p-2 text-center">Tam.</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2 text-left">Motivo</th>
                  {isAdmin && <th className="p-2"></th>}
                </tr>
              </thead>
              <tbody>
                {perdas.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 9 : 8} className="p-3 text-center text-muted-foreground">Sem registros.</td></tr>
                ) : perdas.map((p) => {
                  const hex = corHex(p.cor); const fg = corTextoSobre(hex);
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="p-2 text-xs">{new Date(p.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2">{p.oficina_id ? (ofiNome.get(p.oficina_id) ?? "—") : "—"}</td>
                      <td className="p-2 font-mono text-xs">{p.etiqueta ?? "—"}</td>
                      <td className="p-2">{p.modelo}</td>
                      <td className="p-2"><span className="inline-block px-2 py-0.5 rounded text-xs" style={{ backgroundColor: hex, color: fg }}>{p.cor}</span></td>
                      <td className="p-2 text-center">{p.tamanho}</td>
                      <td className="p-2 text-right tabular-nums">{p.qtd}</td>
                      <td className="p-2 text-xs">{p.motivo ?? "—"}</td>
                      {isAdmin && (
                        <td className="p-2 text-right">
                          <Button size="icon" variant="ghost" onClick={() => remover.mutate(p.id)} title="Remover">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
