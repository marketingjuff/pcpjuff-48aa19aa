import { useEffect, useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { SIM_NAO_PROCESSO, modeloIncluiDTF, modeloIncluiSilk, visivelEmAcabamento } from "@/lib/pedidos";
import { useAppList } from "@/lib/app-lists";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, CheckCircle2, Download } from "lucide-react";
import { ReadOnlyField, FormField, EmptyState, EtapaTopoBanner, EtapaBadgeFromPedido } from "./shared";
import { useDirtyTracker, useRegisterSave, useDirtyForm } from "./dirty-form-context";
import { formatDateBR } from "@/lib/format";


interface Props {
  pedidos: Pedido[];
  selected: Pedido | null;
  onSelect: (id: string | null) => void;
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  saving: boolean;
  active?: boolean;
}

export function AcabamentoTab({ pedidos, selected, onSelect, onSave, saving, active = true }: Props) {
  const [form, setForm] = useState<Partial<Pedido>>({});
  const { isDirty } = useDirtyForm();
  const { names: responsaveis } = useAppList("acabamento");
  useEffect(() => {
    if (!selected) { setForm({}); return; }
    if (!isDirty) setForm(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  useDirtyTracker(form, selected ?? {}, active && !!selected);
  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  function setEmbalado(v: string) {
    setForm((f) => ({
      ...f,
      embalado: v,
      ...(v !== "Sim" ? { data_saida_juff: null, responsavel_acabamento: null, responsavel_conferencia: null } : {}),
    }));
  }
  function setDataSaida(v: string | null | undefined) {
    setForm((f) => ({
      ...f,
      data_saida_juff: v ?? null,
      ...(!v ? { responsavel_acabamento: null } : {}),
    }));
  }

  const temDTF = selected && modeloIncluiDTF(selected.tipo_estampa);
  const temSilk = selected && modeloIncluiSilk(selected.tipo_estampa);
  const dtfOk = !temDTF || selected?.dtf_estampado === "Sim";
  const silkOk = !temSilk || selected?.silk_feito === "Sim";
  const podeFinalizar = dtfOk && silkOk && form.embalado === "Sim" && !!form.data_saida_juff && !!form.responsavel_acabamento;

  function handleSave() {
    if (!selected) return;
    const payload: Partial<Pedido> & { id: string } = {
      id: selected.id,
      embalado: form.embalado ?? null,
      responsavel_acabamento: form.responsavel_acabamento ?? null,
      responsavel_conferencia: form.responsavel_conferencia ?? null,
      data_saida_juff: form.data_saida_juff ?? null,
      observacoes_pedido: form.observacoes_pedido ?? null,
    };
    onSave(payload);
  }

  function enviarParaExpedicao() {
    if (!selected) return;
    if (!podeFinalizar) {
      // Mesmo assim deixamos enviar manualmente — Acabamento decide.
    }
    onSave({
      id: selected.id,
      embalado: form.embalado ?? selected.embalado ?? null,
      responsavel_acabamento: form.responsavel_acabamento ?? selected.responsavel_acabamento ?? null,
      responsavel_conferencia: form.responsavel_conferencia ?? selected.responsavel_conferencia ?? null,
      data_saida_juff: form.data_saida_juff ?? selected.data_saida_juff ?? null,
      observacoes_pedido: form.observacoes_pedido ?? selected.observacoes_pedido ?? null,
      expedicao_entrou_em: new Date().toISOString(),
    } as any);
  }
  useRegisterSave(handleSave, active);

  async function baixarLayout(path: string) {
    const { baixarLayoutPDF } = await import("./shared");
    baixarLayoutPDF(path);
  }

  const atrasado = selected?.saida_juff && form.data_saida_juff && new Date(form.data_saida_juff) > new Date(selected.saida_juff);

  const status = form.embalado === "Sim" && atrasado
    ? { label: "Saiu atrasado", color: "bg-warning/15 text-warning-foreground border-warning/30" }
    : form.embalado === "Sim"
    ? { label: "Embalado", color: "bg-success/15 text-success border-success/30" }
    : { label: "Pendente", color: "bg-muted text-muted-foreground border-border" };

  // Dashboard
  const [fOrc, setFOrc] = useState("");
  const [fPed, setFPed] = useState("");
  const [fDtf, setFDtf] = useState("todos");
  const [fSilk, setFSilk] = useState("todos");

  const dashboardPedidos = useMemo(() => pedidos.filter((p) => {
    if (p.finalizado_em) return false;
    if (p.expedicao_entrou_em) return false;
    if (!visivelEmAcabamento(p)) return false;
    if (fOrc && !String(p.orcamento ?? "").toLowerCase().includes(fOrc.toLowerCase())) return false;
    if (fPed && !String(p.pedido_olist ?? "").toLowerCase().includes(fPed.toLowerCase())) return false;
    if (fDtf !== "todos" && (p.dtf_estampado ?? "") !== fDtf) return false;
    if (fSilk !== "todos" && (p.silk_feito ?? "") !== fSilk) return false;
    return true;
  }), [pedidos, fOrc, fPed, fDtf, fSilk]);


  return (
    <div className="space-y-6">
      {selected ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Acabamento — {selected.pedido_olist}</CardTitle>
            <Badge variant="outline" className={status.color}>{status.label}</Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <EtapaTopoBanner pedido={selected} tab="acabamento" />
            {podeFinalizar && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-success/10 text-success text-sm border border-success/30">
                <CheckCircle2 className="h-4 w-4" /> Pronto para Expedição. Clique em "Enviar para Expedição" abaixo.
              </div>
            )}
            {selected.status_geral !== "completo" && selected.arte_data && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/30">
                <CheckCircle2 className="h-4 w-4" /> <span className="font-semibold">Pedido Incompleto</span> — Status do pedido ainda está "aberto".
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Pedido" value={selected.pedido_olist} />
              <ReadOnlyField label="Orçamento" value={selected.orcamento} />
              <ReadOnlyField label="Tipo de Estampa" value={selected.tipo_estampa} />
              <ReadOnlyField label="Status" value={selected.status_geral} />
              <ReadOnlyField label="Data de Entrega" value={formatDateBR(selected.data_entrega)} />
              <ReadOnlyField label="Saída Juff (prazo)" value={formatDateBR(selected.saida_juff)} />
              <ReadOnlyField label="DTF Estampado?" value={temDTF ? (selected.dtf_estampado ?? "—") : "N/A"} />
              <ReadOnlyField label="Silk Estampado?" value={temSilk ? (selected.silk_feito ?? "—") : "N/A"} />
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Layout</div>
                {selected.layout_url ? (
                  <div className="space-y-1">
                    <Button variant="outline" size="sm" onClick={() => baixarLayout(selected.layout_url!)}>
                      <Download className="h-4 w-4 mr-1" /> Baixar layout
                    </Button>
                    <div className="text-xs text-muted-foreground truncate">{selected.layout_url.replace(/^[0-9a-f-]{36}-/i, "")}</div>
                  </div>
                ) : <div className="text-sm text-muted-foreground">Sem layout</div>}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
              <FormField label="EMBALADO?">
                <Select value={form.embalado ?? ""} onValueChange={setEmbalado}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{SIM_NAO_PROCESSO.slice(0, 2).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <FormField label={`Data Saída Juff${form.embalado === "Sim" ? " *" : ""}`}>
                <DateInputBR disabled={form.embalado !== "Sim"} value={form.data_saida_juff} onChange={setDataSaida} />
              </FormField>
              <FormField label="Responsável pelo Acabamento">
                <Select value={form.responsavel_acabamento ?? ""} onValueChange={(v) => set("responsavel_acabamento", v)} disabled={!form.data_saida_juff}>
                  <SelectTrigger><SelectValue placeholder={!form.data_saida_juff ? "Preencha a data primeiro" : "Selecione..."} /></SelectTrigger>
                  <SelectContent>{responsaveis.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <div className="md:col-span-2">
                <FormField label="Observações do Acabamento">
                  <Textarea value={form.observacoes_pedido ?? ""} onChange={(e) => set("observacoes_pedido", e.target.value)} rows={3} />
                </FormField>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" />Salvar</Button>
          </CardContent>
        </Card>
      ) : (
        <EmptyState>Selecione um pedido no dashboard abaixo.</EmptyState>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Dashboard — Acabamento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <Input placeholder="Orçamento" value={fOrc} onChange={(e) => setFOrc(e.target.value)} />
            <Input placeholder="Pedido" value={fPed} onChange={(e) => setFPed(e.target.value)} />
            <Select value={fDtf} onValueChange={setFDtf}>
              <SelectTrigger><SelectValue placeholder="DTF Estampado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">DTF Estampado (todos)</SelectItem>
                {SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fSilk} onValueChange={setFSilk}>
              <SelectTrigger><SelectValue placeholder="Silk Estampado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Silk Estampado (todos)</SelectItem>
                {SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  {["Etapa","Orçamento","Pedido","Tipo","DTF Est.","Silk Est.","Embalado","Responsável","Saída Juff","Data Entrega"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboardPedidos.map((p) => {
                  return (
                    <tr key={p.id} onClick={() => onSelect(p.id)} className={`border-t cursor-pointer hover:bg-accent ${selected?.id === p.id ? "bg-accent" : ""}`}>
                      <td className="px-3 py-2"><EtapaBadgeFromPedido pedido={p} /></td>
                      <td className="px-3 py-2 font-medium">{p.orcamento}</td>
                      <td className="px-3 py-2">{p.pedido_olist}</td>
                      <td className="px-3 py-2"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                      <td className="px-3 py-2">{modeloIncluiDTF(p.tipo_estampa) ? (p.dtf_estampado ?? "—") : "N/A"}</td>
                      <td className="px-3 py-2">{modeloIncluiSilk(p.tipo_estampa) ? (p.silk_feito ?? "—") : "N/A"}</td>
                      <td className="px-3 py-2">{p.embalado ?? "—"}</td>
                      <td className="px-3 py-2">{p.responsavel_acabamento ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.saida_juff)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.data_entrega)}</td>
                    </tr>
                  );
                })}
                {dashboardPedidos.length === 0 && (
                  <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido pronto para acabamento.</td></tr>
                )}

              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
