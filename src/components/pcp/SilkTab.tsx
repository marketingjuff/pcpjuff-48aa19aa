import { useEffect, useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { SIM_NAO_PROCESSO, modeloIncluiSilk, QUEM_BATEU_SILK, calcularEtapaAtual, visivelEmSilk, silkCompleto, silkAlgumPreenchido, statusEtapa } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, AlertTriangle, Info, Download } from "lucide-react";
import { ReadOnlyField, FormField, EmptyState, EtapaStatusBanner, EtapaBadge } from "./shared";

import { formatDateBR } from "@/lib/format";

interface Props {
  pedidos: Pedido[];
  selected: Pedido | null;
  onSelect: (id: string | null) => void;
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  saving: boolean;
}

export function SilkTab({ pedidos, selected, onSelect, onSave, saving }: Props) {
  const [form, setForm] = useState<Partial<Pedido>>({});
  useEffect(() => { if (selected) setForm(selected); }, [selected?.id]);
  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }
  function setSilkFeito(v: string) {
    setForm((f) => ({ ...f, silk_feito: v, ...(v !== "Sim" ? { silk_data_executada: null } : {}) }));
  }
  function handleSave() { if (!selected) return; onSave({ ...form, id: selected.id }); }

  async function baixarLayout(path: string) {
    const { baixarLayoutPDF } = await import("./shared");
    baixarLayoutPDF(path);
  }

  const atrasado = selected?.termino_estamparia && form.silk_data_executada &&
    new Date(form.silk_data_executada) > new Date(selected.termino_estamparia);

  const statusColor = form.silk_feito === "Sim" && !atrasado
    ? "bg-success/15 text-success border-success/30"
    : form.silk_feito === "Sim" && atrasado
    ? "bg-warning/15 text-warning-foreground border-warning/30"
    : "bg-muted text-muted-foreground border-border";

  const silkBloqueado = form.tela_gravada !== "Sim";

  const [fOrc, setFOrc] = useState("");
  const [fPed, setFPed] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [fTela, setFTela] = useState("todos");
  const [fSilk, setFSilk] = useState("todos");

  const dashboardPedidos = useMemo(() => pedidos.filter((p) => {
    if (p.finalizado_em) return false;
    if (!visivelEmSilk(p)) return false;
    if (fOrc && !String(p.orcamento ?? "").toLowerCase().includes(fOrc.toLowerCase())) return false;
    if (fPed && !String(p.pedido_olist ?? "").toLowerCase().includes(fPed.toLowerCase())) return false;
    if (fStatus !== "todos" && p.status_geral !== fStatus) return false;
    if (fTela !== "todos" && (p.tela_gravada ?? "") !== fTela) return false;
    if (fSilk !== "todos" && (p.silk_feito ?? "") !== fSilk) return false;
    return true;
  }), [pedidos, fOrc, fPed, fStatus, fTela, fSilk]);


  return (
    <div className="space-y-6">
      {selected ? (
        !modeloIncluiSilk(selected.tipo_estampa) ? (
          <EmptyState>Este pedido não inclui Silk (modelo: {selected.tipo_estampa}).</EmptyState>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Silk Screen — {selected.pedido_olist}</CardTitle>
              <Badge variant="outline" className={statusColor}>
                {form.silk_feito === "Sim" ? (atrasado ? "Atrasado" : "Concluído") : "Em andamento"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
            <EtapaStatusBanner
              pendencias={[
                selected.fotolito_impresso !== "Sim" && "Arte ainda não liberou o fotolito",
                form.tela_gravada !== "Sim" && "Tela ainda não foi gravada",
              ].filter(Boolean) as string[]}
              atrasado={!!atrasado}
              atrasadoMsg="Data executada após o limite de estamparia."
            />

              <div className="grid gap-4 md:grid-cols-2">
                <ReadOnlyField label="Pedido" value={selected.pedido_olist} />
                <ReadOnlyField label="Orçamento" value={selected.orcamento} />
                <ReadOnlyField label="QTD" value={selected.qtd} />
                <ReadOnlyField label="Status" value={selected.status_geral} />
                <ReadOnlyField label="Fotolito Impresso? (Arte)" value={selected.fotolito_impresso ?? "Pendente"} />
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Layout</div>
                  {selected.layout_url ? (
                    <Button variant="outline" size="sm" onClick={() => baixarLayout(selected.layout_url!)}>
                      <Download className="h-4 w-4 mr-1" /> Baixar layout
                    </Button>
                  ) : <div className="text-sm text-muted-foreground">Sem layout</div>}
                </div>
                <ReadOnlyField label="Início estamparia" value={formatDateBR(selected.inicio_estamparia)} />
                <ReadOnlyField label="Limite estamparia" value={formatDateBR(selected.termino_estamparia)} />
                <ReadOnlyField label="Saída Juff" value={formatDateBR(selected.saida_juff)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                <FormField label="Tela gravada?">
                  <Select value={form.tela_gravada ?? ""} onValueChange={(v) => set("tela_gravada", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField label="Silk feito?">
                  <Select value={form.silk_feito ?? ""} onValueChange={setSilkFeito} disabled={silkBloqueado}>
                    <SelectTrigger><SelectValue placeholder={silkBloqueado ? "Tela precisa estar gravada" : "Selecione..."} /></SelectTrigger>
                    <SelectContent>{SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField label={`Data Executada de Silk${form.silk_feito === "Sim" ? " *" : ""}`}>
                  <DateInputBR disabled={form.silk_feito !== "Sim"} value={form.silk_data_executada} onChange={(v) => set("silk_data_executada", v)} />
                </FormField>
                <FormField label="Quem bateu o Silk?">
                  <Select value={form.quem_bateu_silk ?? ""} onValueChange={(v) => set("quem_bateu_silk", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{QUEM_BATEU_SILK.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <div className="md:col-span-2">
                  <FormField label="Observações do Silk">
                    <Textarea value={form.silk_observacao ?? ""} onChange={(e) => set("silk_observacao", e.target.value)} rows={2} />
                  </FormField>
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" />Salvar</Button>
            </CardContent>
          </Card>
        )
      ) : (
        <EmptyState>Selecione um pedido Silk no dashboard abaixo.</EmptyState>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Dashboard — Silk</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-5">
            <Input placeholder="Orçamento" value={fOrc} onChange={(e) => setFOrc(e.target.value)} />
            <Input placeholder="Pedido" value={fPed} onChange={(e) => setFPed(e.target.value)} />
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="Aberto">Aberto</SelectItem>
                <SelectItem value="Completo">Completo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fTela} onValueChange={setFTela}>
              <SelectTrigger><SelectValue placeholder="Tela Gravada" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Tela Gravada (todos)</SelectItem>
                {SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fSilk} onValueChange={setFSilk}>
              <SelectTrigger><SelectValue placeholder="Silk Feito" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Silk Feito (todos)</SelectItem>
                {SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  {["Status","Orçamento","Pedido","Tipo","Fotolito","Tela Gravada","Silk Feito","Data Silk","Quem bateu","Etapa"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboardPedidos.map((p) => {
                  const { etapa } = calcularEtapaAtual(p);
                  const st = statusEtapa(silkCompleto(p), silkAlgumPreenchido(p));
                  return (
                    <tr key={p.id} onClick={() => onSelect(p.id)} className={`border-t cursor-pointer hover:bg-accent ${selected?.id === p.id ? "bg-accent" : ""}`}>
                      <td className="px-3 py-2"><EtapaBadge status={st} labels={{ pendente: "Silk Pendente", andamento: "Silk em Andamento", concluido: "Silk Concluído" }} /></td>
                      <td className="px-3 py-2 font-medium">{p.orcamento}</td>
                      <td className="px-3 py-2">{p.pedido_olist}</td>
                      <td className="px-3 py-2"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                      <td className="px-3 py-2">{p.fotolito_impresso ?? "—"}</td>
                      <td className="px-3 py-2">{p.tela_gravada ?? "—"}</td>
                      <td className="px-3 py-2">{p.silk_feito ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.silk_data_executada)}</td>
                      <td className="px-3 py-2">{p.quem_bateu_silk ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{etapa}</td>
                    </tr>
                  );
                })}
                {dashboardPedidos.length === 0 && (
                  <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido Silk disponível (depende da Arte concluída).</td></tr>
                )}

              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
