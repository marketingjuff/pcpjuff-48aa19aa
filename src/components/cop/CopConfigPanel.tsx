import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { REFACAO_MODELOS } from "@/lib/pedidos";
import type { Oficina } from "@/lib/cop";
import {
  useCopColorSettings, DEFAULT_COP_COLOR_SETTINGS,
  COP_ETAPAS_CONFIGURAVEIS, type CopColorSettings, type CopBotaoKey,
} from "@/hooks/use-cop-color-settings";

/* -------------------- Painel COP -------------------- */
export function CopConfigPanel() {
  return (
    <div className="space-y-6">
      <OficinasCard />
      <CoresCopCard />
      <AcessoCard />
    </div>
  );
}

/* -------------------- Oficinas -------------------- */
function OficinasCard() {
  const qc = useQueryClient();
  const { data: oficinas = [], isLoading } = useQuery({
    queryKey: ["oficinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oficinas" as any).select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Oficina[];
    },
  });
  const [editing, setEditing] = useState<Oficina | "new" | null>(null);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("oficinas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["oficinas"] }); toast.success("Oficina removida."); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Oficinas</CardTitle>
        <Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4 mr-1" />Nova oficina</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ/CPF</TableHead>
              <TableHead>CEP</TableHead>
              <TableHead className="text-right">Frete</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}>Carregando…</TableCell></TableRow>
            ) : oficinas.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-muted-foreground">Nenhuma oficina.</TableCell></TableRow>
            ) : oficinas.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.nome}</TableCell>
                <TableCell>{o.cnpj_cpf ?? "—"}</TableCell>
                <TableCell>{o.cep ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(o.valor_frete || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(o)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(o.id)} title="Remover">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {editing && (
        <OficinaDialog
          oficina={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["oficinas"] }); }}
        />
      )}
    </Card>
  );
}

function OficinaDialog({ oficina, onClose, onSaved }: { oficina: Oficina | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !oficina;
  const [nome, setNome] = useState(oficina?.nome ?? "");
  const [cnpj, setCnpj] = useState(oficina?.cnpj_cpf ?? "");
  const [endereco, setEndereco] = useState(oficina?.endereco ?? "");
  const [cep, setCep] = useState(oficina?.cep ?? "");
  const [frete, setFrete] = useState<string>(String(oficina?.valor_frete ?? 0));
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const m of REFACAO_MODELOS) v[m] = oficina?.valores_por_modelo?.[m] != null ? String(oficina.valores_por_modelo[m]) : "";
    return v;
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!nome.trim()) { toast.error("Informe o nome."); return; }
    setSaving(true);
    const vpm: Record<string, number> = {};
    for (const m of REFACAO_MODELOS) {
      const n = Number(valores[m]);
      if (Number.isFinite(n) && n > 0) vpm[m] = n;
    }
    const payload: any = {
      nome: nome.trim(),
      cnpj_cpf: cnpj.trim() || null,
      endereco: endereco.trim() || null,
      cep: cep.trim() || null,
      valor_frete: Number(frete) || 0,
      valores_por_modelo: vpm,
    };
    const q = isNew
      ? supabase.from("oficinas" as any).insert(payload)
      : supabase.from("oficinas" as any).update(payload).eq("id", oficina!.id);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Oficina salva.");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[900px]">
        <DialogHeader><DialogTitle>{isNew ? "Nova oficina" : `Editar — ${oficina!.nome}`}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label>CNPJ / CPF</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
          <div><Label>CEP</Label><Input value={cep} onChange={(e) => setCep(e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Endereço completo</Label><Input value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
          <div><Label>Valor do frete (R$)</Label>
            <Input type="number" step="0.01" min="0" value={frete} onChange={(e) => setFrete(e.target.value)} />
          </div>
        </div>
        <div className="mt-2">
          <Label>Tabela de valor por peça por modelo</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
            {REFACAO_MODELOS.map((m) => (
              <div key={m} className="flex items-center gap-2">
                <div className="text-xs flex-1 truncate" title={m}>{m}</div>
                <Input
                  type="number" step="0.01" min="0"
                  className="h-8 w-24"
                  placeholder="R$"
                  value={valores[m] ?? ""}
                  onChange={(e) => setValores((v) => ({ ...v, [m]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Cores COP -------------------- */
function CoresCopCard() {
  const { settings, save } = useCopColorSettings();
  const [draft, setDraft] = useState<CopColorSettings>(settings);
  useEffect(() => { setDraft(settings); }, [settings]);

  function setEtapa(key: string, field: "bg" | "fg", value: string) {
    setDraft((d) => ({ ...d, etapas: { ...d.etapas, [key]: { ...d.etapas[key], [field]: value } } }));
  }
  function setBotao(key: CopBotaoKey, field: "bg" | "fg", value: string) {
    setDraft((d) => ({ ...d, botoes: { ...d.botoes, [key]: { ...d.botoes[key], [field]: value } } }));
  }
  async function handleSave() {
    try { await save.mutateAsync(draft); toast.success("Cores do COP salvas."); }
    catch (e: any) { toast.error(e?.message ?? "Falha ao salvar"); }
  }

  const BOTOES: { key: CopBotaoKey; label: string }[] = [
    { key: "atualizar", label: "Botão Salvar" },
    { key: "mandar_romaneio", label: "Botão Mandar pro Romaneio" },
    { key: "dividir_corte", label: "Botão Divisão de Corte" },
    { key: "voltar", label: "Botão Voltar" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Cores das etapas e botões do COP</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="text-sm font-medium mb-2">Botões</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BOTOES.map(({ key, label }) => {
              const pair = draft.botoes[key];
              return (
                <div key={key} className="rounded-md border p-3 space-y-2">
                  <div className="text-sm font-medium">{label}</div>
                  <button type="button" className="px-3 py-1.5 rounded-md text-sm font-medium border" style={{ backgroundColor: pair.bg, color: pair.fg, borderColor: pair.bg }}>Preview</button>
                  <div className="flex gap-2 text-xs">
                    <label className="flex items-center gap-1">Fundo
                      <input type="color" value={pair.bg} onChange={(e) => setBotao(key, "bg", e.target.value)} className="h-7 w-10 rounded border cursor-pointer" />
                    </label>
                    <label className="flex items-center gap-1">Fonte
                      <input type="color" value={pair.fg} onChange={(e) => setBotao(key, "fg", e.target.value)} className="h-7 w-10 rounded border cursor-pointer" />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Etapas</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COP_ETAPAS_CONFIGURAVEIS.map((etapa) => {
              const pair = draft.etapas[etapa] ?? { bg: "#f1f5f9", fg: "#475569" };
              return (
                <div key={etapa} className="rounded-md border p-3 space-y-2">
                  <div className="text-sm font-medium">{etapa}</div>
                  <span className="inline-block px-2 py-0.5 text-xs rounded-md border" style={{ backgroundColor: pair.bg, color: pair.fg, borderColor: `color-mix(in oklab, ${pair.fg} 35%, transparent)` }}>{etapa}</span>
                  <div className="flex gap-2 text-xs">
                    <label className="flex items-center gap-1">Fundo
                      <input type="color" value={pair.bg} onChange={(e) => setEtapa(etapa, "bg", e.target.value)} className="h-7 w-10 rounded border cursor-pointer" />
                    </label>
                    <label className="flex items-center gap-1">Fonte
                      <input type="color" value={pair.fg} onChange={(e) => setEtapa(etapa, "fg", e.target.value)} className="h-7 w-10 rounded border cursor-pointer" />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDraft(DEFAULT_COP_COLOR_SETTINGS)}>Restaurar padrão</Button>
          <Button onClick={handleSave} disabled={save.isPending}>Salvar cores</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------- Acesso -------------------- */
function AcessoCard() {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Controle de acesso ao COP</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        <p>Atualmente <span className="font-medium text-foreground">apenas administradores</span> têm acesso ao COP.</p>
        <p>Em breve: Gestores com a permissão de COP marcada também poderão acessar.</p>
      </CardContent>
    </Card>
  );
}
