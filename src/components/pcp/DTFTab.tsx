import { pedidoAtivoNasAreas, sortByDataSaidaJuffAsc } from "@/lib/pedidos";
import { useEffect, useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { SIM_NAO_PROCESSO, modeloIncluiDTF, visivelEmDTF } from "@/lib/pedidos";
import { useAppList } from "@/lib/app-lists";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Download } from "lucide-react";
import { ReadOnlyField, FormField, EmptyState, EtapaTopoBanner, EtapaBadgeFromPedido, StatusPecasBadge, StatusPecasChip, PedidoMobileCard, Chip, useSort, cmpDate, cmpNum, SortableTh, Th, rowAlertBgClass, ETAPA_FILTRO_OPCOES, matchEtapaFiltro } from "./shared";
import { useDirtyTracker, useRegisterSave, useDirtyForm } from "./dirty-form-context";
import { useFeriados } from "@/hooks/use-feriados";

import { formatDateBR } from "@/lib/format";

interface Props {
  pedidos: Pedido[];
  selected: Pedido | null;
  onSelect: (id: string | null) => void;
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  saving: boolean;
  active?: boolean;
}

export function DTFTab({ pedidos, selected, onSelect, onSave, saving, active = true }: Props) {
  const [form, setForm] = useState<Partial<Pedido>>({});
  const { isDirty } = useDirtyForm();
  const { names: operadoresDTF } = useAppList("dtf");
  const { feriados } = useFeriados();
  const sort = useSort<"qtd"|"exec"|"saida"|"entrega">();
  useEffect(() => {
    if (!selected) { setForm({}); return; }
    if (!isDirty) setForm(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  useDirtyTracker(form, selected ?? {}, active && !!selected);
  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }
  function setEstampado(v: string) {
    setForm((f) => ({
      ...f,
      dtf_estampado: v,
      ...(v !== "Sim" ? { dtf_data_executada: null, quem_bateu_dtf: null } : {}),
    }));
  }
  function setDataExec(v: string | null | undefined) {
    setForm((f) => ({
      ...f,
      dtf_data_executada: v ?? null,
      ...(!v ? { quem_bateu_dtf: null } : {}),
    }));
  }
  function handleSave() {
    if (!selected) return;
    onSave({
      id: selected.id,
      dtf_estampado: form.dtf_estampado ?? null,
      dtf_data_executada: form.dtf_data_executada ?? null,
      quem_bateu_dtf: form.quem_bateu_dtf ?? null,
      dtf_observacao: form.dtf_observacao ?? null,
    });
  }
  useRegisterSave(handleSave, active);

  async function baixarLayout(path: string) {
    const { baixarLayoutPDF } = await import("./shared");
    baixarLayoutPDF(path);
  }

  const atrasado = selected?.termino_estamparia && form.dtf_data_executada &&
    new Date(form.dtf_data_executada) > new Date(selected.termino_estamparia);

  const statusColor = form.dtf_estampado === "Sim" && !atrasado
    ? "bg-success/15 text-success border-success/30"
    : form.dtf_estampado === "Sim" && atrasado
    ? "bg-warning/15 text-warning-foreground border-warning/30"
    : "bg-muted text-muted-foreground border-border";

  // Dashboard filters
  const [fOrc, setFOrc] = useState("");
  const [fPed, setFPed] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [fImpresso, setFImpresso] = useState("todos");
  const [fEstampado, setFEstampado] = useState("todos");
  const [fEtapa, setFEtapa] = useState("ativas");

  const dashboardPedidos = useMemo(() => sortByDataSaidaJuffAsc(pedidos.filter((p) => {
    if (!matchEtapaFiltro(p, fEtapa)) return false;
    if (!visivelEmDTF(p)) return false;
    if (fOrc && !String(p.orcamento ?? "").toLowerCase().includes(fOrc.toLowerCase())) return false;
    if (fPed && !String(p.pedido_olist ?? "").toLowerCase().includes(fPed.toLowerCase())) return false;
    if (fStatus !== "todos" && p.status_pecas !== fStatus) return false;
    if (fImpresso !== "todos" && (p.dtf_impresso ?? "") !== fImpresso) return false;
    if (fEstampado !== "todos" && (p.dtf_estampado ?? "") !== fEstampado) return false;
    return true;
  })), [pedidos, fEtapa, fOrc, fPed, fStatus, fImpresso, fEstampado]);


  return (
    <div className="space-y-3">
      {selected ? (
        !modeloIncluiDTF(selected.tipo_estampa) ? (
          <EmptyState>Este pedido não inclui DTF (modelo: {selected.tipo_estampa}).</EmptyState>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base sm:text-lg truncate">DTF — {selected.pedido_olist}</CardTitle>
              <Badge variant="outline" className={statusColor}>
                {form.dtf_estampado === "Sim" ? (atrasado ? "Atrasado" : "Concluído") : "Em andamento"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
            <EtapaTopoBanner pedido={selected} tab="dtf" />
            {selected.status_pecas !== "completo" && selected.arte_data && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/30">
                <span className="font-semibold">Pedido Incompleto</span> — Status de Peças ainda está "incompleto".
              </div>
            )}

              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <ReadOnlyField label="Pedido" value={selected.pedido_olist} />
                <ReadOnlyField label="Orçamento" value={selected.orcamento} />
                <ReadOnlyField label="QTD" value={selected.qtd} />
                <ReadOnlyField label="Status de Peças" value={selected.status_pecas} />
                <ReadOnlyField label="DTF Impresso? (Arte)" value={selected.dtf_impresso ?? "Pendente"} />
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
                <ReadOnlyField label="Início estamparia" value={formatDateBR(selected.inicio_estamparia)} />
                <ReadOnlyField label="Término estamparia" value={formatDateBR(selected.termino_estamparia)} />
                <ReadOnlyField label="Saída Juff" value={formatDateBR(selected.saida_juff)} />
              </div>
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 pt-3 border-t">
                <FormField label="DTF Estampado?">
                  <Select value={form.dtf_estampado ?? ""} onValueChange={setEstampado}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField label={`DTF Estampado Executado${form.dtf_estampado === "Sim" ? " *" : ""}`}>
                  <DateInputBR disabled={form.dtf_estampado !== "Sim"} value={form.dtf_data_executada} onChange={setDataExec} />
                </FormField>
                <FormField label="Quem bateu o DTF?">
                  <Select value={form.quem_bateu_dtf ?? ""} onValueChange={(v) => set("quem_bateu_dtf", v)} disabled={!form.dtf_data_executada}>
                    <SelectTrigger><SelectValue placeholder={!form.dtf_data_executada ? "Preencha a data primeiro" : "Selecione..."} /></SelectTrigger>
                    <SelectContent>{operadoresDTF.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <div className="sm:col-span-2 lg:col-span-4">
                  <FormField label="Observações do DTF">
                    <Textarea value={form.dtf_observacao ?? ""} onChange={(e) => set("dtf_observacao", e.target.value)} rows={2} />
                  </FormField>
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto"><Save className="h-4 w-4 mr-1" />Atualizar DTF</Button>
            </CardContent>
          </Card>
        )
      ) : (
        <EmptyState>Selecione um pedido DTF no dashboard abaixo.</EmptyState>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Dashboard — DTF</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-6">
            <Select value={fEtapa} onValueChange={setFEtapa}>
              <SelectTrigger><SelectValue placeholder="Etapa" /></SelectTrigger>
              <SelectContent>
                {ETAPA_FILTRO_OPCOES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Orçamento" value={fOrc} onChange={(e) => setFOrc(e.target.value)} />
            <Input placeholder="Pedido" value={fPed} onChange={(e) => setFPed(e.target.value)} />
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="incompleto">Incompleto</SelectItem>
                <SelectItem value="completo">Completo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fImpresso} onValueChange={setFImpresso}>
              <SelectTrigger><SelectValue placeholder="DTF Impresso" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">DTF Impresso (todos)</SelectItem>
                <SelectItem value="Sim">Sim</SelectItem>
                <SelectItem value="Não">Não</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fEstampado} onValueChange={setFEstampado}>
              <SelectTrigger><SelectValue placeholder="DTF Estampado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">DTF Estampado (todos)</SelectItem>
                {SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden rounded-md border divide-y">
            {dashboardPedidos.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido DTF disponível.</div>
            ) : dashboardPedidos.map((p) => (
              <PedidoMobileCard key={p.id} pedido={p} active={selected?.id === p.id} onClick={() => onSelect(p.id)}>
                <Chip label="Tipo" value={p.tipo_estampa} />
                <Chip label="QTD" value={p.qtd} />
                <StatusPecasChip pedido={p} />
                <Chip label="Impresso" value={p.dtf_impresso} />
                <Chip label="Estampado" value={p.dtf_estampado} />
                <Chip label="Entrega" value={formatDateBR(p.data_entrega) || "—"} />
              </PedidoMobileCard>
            ))}
          </div>
          <div className="hidden md:block rounded-lg border border-border/60 bg-card overflow-x-auto shadow-xs [&_th]:text-center [&_td]:text-center">
            <table className="w-full text-sm" style={{ fontFamily: '"Google Sans Flex", Arial, sans-serif', fontStretch: 'condensed' }}>
              <thead>
                <tr>
                  <Th>ETAPA</Th>
                  <Th>PEDIDO</Th>
                  <Th>ORÇAMENTO</Th>
                  <Th>TIPO</Th>
                  <SortableTh label="QTD" active={sort.key === "qtd"} onClick={() => sort.toggle("qtd")} />
                  <Th>STATUS DAS PEÇAS</Th>
                  <Th>DTF IMPRESSO</Th>
                  <Th>DTF ESTAMPADO</Th>
                  <SortableTh label="DATA EXEC" active={sort.key === "exec"} onClick={() => sort.toggle("exec")} />
                  <Th>QUEM BATEU</Th>
                  <SortableTh label="SAÍDA JUFF" active={sort.key === "saida"} onClick={() => sort.toggle("saida")} />
                  <SortableTh label="ENTREGA" active={sort.key === "entrega"} onClick={() => sort.toggle("entrega")} />
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let lista = dashboardPedidos;
                  if (sort.key) {
                    lista = [...lista].sort((a, b) => {
                      switch (sort.key) {
                        case "qtd": return cmpNum(a.qtd, b.qtd, sort.dir);
                        case "exec": return cmpDate(a.dtf_data_executada, b.dtf_data_executada, sort.dir);
                        case "saida": return cmpDate(a.saida_juff, b.saida_juff, sort.dir);
                        case "entrega": return cmpDate(a.data_entrega, b.data_entrega, sort.dir);
                      }
                      return 0;
                    });
                  }
                  return lista.map((p) => {
                    const bg = rowAlertBgClass(p, feriados);
                    return (
                      <tr key={p.id} onClick={() => onSelect(p.id)} className={`border-t cursor-pointer hover:bg-accent ${bg} ${selected?.id === p.id ? "bg-accent" : ""}`}>
                        <td className="px-1.5 py-0.5"><EtapaBadgeFromPedido pedido={p} /></td>
                        <td className="px-1.5 py-0.5 font-medium">{p.pedido_olist}</td>
                        <td className="px-1.5 py-0.5 text-left">{p.orcamento}</td>
                        <td className="px-1.5 py-0.5"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                        <td className="px-1.5 py-0.5">{p.qtd ?? "—"}</td>
                        <td className="px-1.5 py-0.5"><StatusPecasBadge pedido={p} /></td>
                        <td className="px-1.5 py-0.5">{p.dtf_impresso ?? "—"}</td>
                        <td className="px-1.5 py-0.5">{p.dtf_estampado ?? "—"}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.dtf_data_executada)}</td>
                        <td className="px-1.5 py-0.5">{p.quem_bateu_dtf ?? "—"}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.saida_juff)}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.data_entrega)}</td>
                      </tr>
                    );
                  });
                })()}
                {dashboardPedidos.length === 0 && (
                  <tr><td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido DTF disponível.</td></tr>
                )}


              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
