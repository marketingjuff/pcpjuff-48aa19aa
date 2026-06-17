import { pedidoAtivoNasAreas, sortByDataSaidaJuffAsc } from "@/lib/pedidos";
import { useEffect, useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import {
  SIM_NAO, STATUS_ARTE_OPCOES, VETOR_OPCOES,
  tipoIncluiDTF, tipoIncluiSilk, visivelEmArte,
  dtfFinalizadoLabel, fotolitoFinalizadoLabel,
  TIPOS_ESTAMPA,
} from "@/lib/pedidos";
import { useAppList } from "@/lib/app-lists";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Download } from "lucide-react";
import { toast } from "sonner";

import {
  ReadOnlyField, FormField, EmptyState, EtapaTopoBanner, EtapaBadgeFromPedido,
  StatusPecasBadge, StatusPecasChip, PedidoMobileCard, Chip,
  useSort, cmpDate, cmpNum, SortableTh, Th, rowAlertBgClass, linhaAtrasoClasse,
  ETAPA_FILTRO_OPCOES, matchEtapaFiltro,
} from "./shared";
import { ObservacoesOutrosSetores } from "./ObservacoesOutrosSetores";

import { useDirtyTracker, useRegisterSave, useDirtyForm } from "./dirty-form-context";
import { formatDateBR } from "@/lib/format";
import { useFeriados } from "@/hooks/use-feriados";


interface Props {
  pedidos: Pedido[];
  selected: Pedido | null;
  onSelect: (id: string | null) => void;
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  saving: boolean;
  active?: boolean;
}

export function ArteTab({ pedidos, selected, onSelect, onSave, saving, active = true }: Props) {
  const [form, setForm] = useState<Partial<Pedido>>({});
  const { isDirty } = useDirtyForm();
  const { feriados } = useFeriados();
  const sort = useSort<"qtd"|"entrada"|"limite"|"saida">();
  const { names: statusArteCustom } = useAppList("status_arte");

  const statusArteOpcoes = statusArteCustom.length ? statusArteCustom : [...STATUS_ARTE_OPCOES];

  useEffect(() => {
    if (!selected) { setForm({}); return; }
    if (!isDirty) {
      // Pré-preenche campos vazios conforme regras quando o pedido é aberto em Arte.
      const inclDTF = tipoIncluiDTF(selected.tipo_estampa);
      const inclSilk = tipoIncluiSilk(selected.tipo_estampa);
      const isLisa = selected.tipo_estampa === "Lisa";
      const isEmpty = (v: any) => v === null || v === undefined || v === "";
      const next: Partial<Pedido> = { ...selected };
      if (inclDTF && selected.necessita_vetorizacao && isEmpty(selected.vetorizacao_dtf)) next.vetorizacao_dtf = "Não";
      if (inclDTF && isEmpty(selected.dtf_impresso)) next.dtf_impresso = "Não";
      if (inclDTF && isEmpty(selected.dtf_cortado)) next.dtf_cortado = "Não";
      if (inclSilk && selected.necessita_vetorizacao && isEmpty(selected.vetorizacao_silk)) next.vetorizacao_silk = "Não";
      if (inclSilk && isEmpty(selected.fotolito_impresso)) next.fotolito_impresso = "Não";
      if (!isLisa && isEmpty(selected.status_arte)) next.status_arte = "Em andamento";
      setForm(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useDirtyTracker(form, selected ?? {}, active && !!selected);

  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  // Sim → Não: limpa a data correspondente
  function setSimNaoComData(field: keyof Pedido, dataField: keyof Pedido, v: string) {
    setForm((f) => ({
      ...f,
      [field]: v,
      ...(v !== "Sim" ? { [dataField]: null } : {}),
    }));
  }

  function handleSave() {
    if (!selected) return;
    // Validações: Sim + sem data é inválido
    if (form.dtf_impresso === "Sim" && !form.dtf_executado) {
      toast.error('DTF Impresso = "Sim" exige a data de impressão.');
      return;
    }
    if (form.dtf_cortado === "Sim" && !form.dtf_cortado_data) {
      toast.error('DTF Cortado = "Sim" exige a data de corte.');
      return;
    }
    if (form.fotolito_impresso === "Sim" && !form.fotolito_executado) {
      toast.error('Fotolito Impresso = "Sim" exige a Data de Impressão do Fotolito.');
      return;
    }
    onSave({
      id: selected.id,
      status_arte: form.status_arte ?? null,
      dtf_impresso: form.dtf_impresso ?? null,
      dtf_executado: form.dtf_executado ?? null,
      dtf_cortado: form.dtf_cortado ?? null,
      dtf_cortado_data: form.dtf_cortado_data ?? null,
      fotolito_impresso: form.fotolito_impresso ?? null,
      fotolito_executado: form.fotolito_executado ?? null,
      vetorizacao_dtf: form.vetorizacao_dtf ?? null,
      vetorizacao_silk: form.vetorizacao_silk ?? null,
      arte_observacao: form.arte_observacao ?? null,
    });
  }
  useRegisterSave(handleSave, active);

  async function baixarLayout(path: string) {
    const { baixarLayoutPDF } = await import("./shared");
    await baixarLayoutPDF(path);
  }

  const showDTF = !!selected && tipoIncluiDTF(selected.tipo_estampa);
  const showSilk = !!selected && tipoIncluiSilk(selected.tipo_estampa);
  const showVetorDTF = !!selected && selected.necessita_vetorizacao && showDTF;
  const showVetorSilk = !!selected && selected.necessita_vetorizacao && showSilk;


  // Filtros do dashboard
  const [fEtapa, setFEtapa] = useState<string>("ativas");
  const [fSearch, setFSearch] = useState("");
  const [fTipo, setFTipo] = useState<string>("todos");
  const [fDtf, setFDtf] = useState<string>("todos");
  const [fFoto, setFFoto] = useState<string>("todos");
  const [fStatusArte, setFStatusArte] = useState<string>("todos");

  const dashboardRows = useMemo(() => {
    let arr = pedidos.filter((p) => visivelEmArte(p) && matchEtapaFiltro(p, fEtapa));
    if (fSearch) {
      const s = fSearch.toLowerCase();
      arr = arr.filter((p) => `${p.pedido_olist ?? ""} ${p.orcamento ?? ""}`.toLowerCase().includes(s));
    }
    if (fTipo !== "todos") arr = arr.filter((p) => p.tipo_estampa === fTipo);
    if (fDtf !== "todos") arr = arr.filter((p) => dtfFinalizadoLabel(p) === fDtf);
    if (fFoto !== "todos") arr = arr.filter((p) => fotolitoFinalizadoLabel(p) === fFoto);
    if (fStatusArte !== "todos") arr = arr.filter((p) => (p.status_arte ?? "") === fStatusArte);
    arr = sortByDataSaidaJuffAsc(arr);
    if (sort.key) {
      arr = [...arr].sort((a, b) => {
        switch (sort.key) {
          case "qtd": return cmpNum(a.qtd, b.qtd, sort.dir);
          case "entrada": return cmpDate(a.entrada_pedido, b.entrada_pedido, sort.dir);
          case "limite": return cmpDate(a.arte_data, b.arte_data, sort.dir);
          case "saida": return cmpDate(a.saida_juff, b.saida_juff, sort.dir);
        }
        return 0;
      });
    }
    return arr;
  }, [pedidos, fEtapa, fSearch, fTipo, fDtf, fFoto, fStatusArte, sort.key, sort.dir]);

  return (
    <div className="space-y-3">
      {selected ? (
        <Card>
          <CardHeader><CardTitle>Arte — {selected.pedido_olist}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <EtapaTopoBanner pedido={selected} tab="arte" />

            {/* Parte de cima — somente leitura */}
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <ReadOnlyField label="Pedido" value={selected.pedido_olist} />
              <ReadOnlyField label="Orçamento" value={selected.orcamento} />
              <ReadOnlyField label="Tipo de Estampa" value={selected.tipo_estampa} />
              <ReadOnlyField label="Vetorização" value={selected.necessita_vetorizacao ? "Sim" : "Não"} />
              <ReadOnlyField label="Data Limite da Arte" value={formatDateBR(selected.arte_data)} />
              <ReadOnlyField label="Início Est." value={formatDateBR(selected.inicio_estamparia)} />
              <ReadOnlyField label="Saída Juff" value={formatDateBR(selected.saida_juff)} />
              <ReadOnlyField label="STATUS DTF" value={dtfFinalizadoLabel(selected)} />
              <ReadOnlyField label="STATUS FOTOLITO" value={fotolitoFinalizadoLabel(selected)} />
            </div>


            {/* Layout / baixar */}
            <div className="pt-3 border-t flex items-center gap-3">
              {selected.layout_url ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => baixarLayout(selected.layout_url!)}>
                    <Download className="h-4 w-4 mr-1" /> Baixar layout
                  </Button>
                  <div className="text-xs text-muted-foreground truncate">{selected.layout_url.replace(/^[0-9a-f-]{36}-/i, "")}</div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Sem layout enviado pelo vendedor.</div>
              )}
            </div>

            {/* Parte de baixo — editável; sempre visível */}
            <div className="space-y-2 pt-3 border-t">
                {/* Linha DTF (quando inclui DTF) */}
                {showDTF && (
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
                    {showVetorDTF && (
                      <FormField label="Vetorização de DTF Realizada">
                        <Select value={form.vetorizacao_dtf ?? ""} onValueChange={(v) => set("vetorizacao_dtf", v)}>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>{VETOR_OPCOES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormField>
                    )}

                    <FormField label="DTF Impresso">
                      <Select value={form.dtf_impresso ?? ""} onValueChange={(v) => setSimNaoComData("dtf_impresso", "dtf_executado", v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>{SIM_NAO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>
                    {form.dtf_impresso === "Sim" && (
                      <FormField label="Data DTF Impresso">
                        <DateInputBR value={form.dtf_executado} onChange={(v) => set("dtf_executado", v)} />
                      </FormField>
                    )}
                    <FormField label="DTF Cortado">
                      <Select value={form.dtf_cortado ?? ""} onValueChange={(v) => setSimNaoComData("dtf_cortado", "dtf_cortado_data", v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>{SIM_NAO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>
                    {form.dtf_cortado === "Sim" && (
                      <FormField label="Data DTF Cortado">
                        <DateInputBR value={form.dtf_cortado_data} onChange={(v) => set("dtf_cortado_data", v)} />
                      </FormField>
                    )}
                  </div>
                )}

                {/* Linha Silk (quando inclui Silk) */}
                {showSilk && (
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {showVetorSilk && (
                      <FormField label="Vetorização de Silk Realizada">
                        <Select value={form.vetorizacao_silk ?? ""} onValueChange={(v) => set("vetorizacao_silk", v)}>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>{VETOR_OPCOES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormField>
                    )}

                    <FormField label="Fotolito Impresso">
                      <Select value={form.fotolito_impresso ?? ""} onValueChange={(v) => setSimNaoComData("fotolito_impresso", "fotolito_executado", v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>{SIM_NAO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>
                    {form.fotolito_impresso === "Sim" && (
                      <FormField label="Data de Impressão do Fotolito">
                        <DateInputBR value={form.fotolito_executado ?? null} onChange={(v) => set("fotolito_executado", v)} />
                      </FormField>
                    )}
                  </div>
                )}

                {/* Status da Arte */}
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <FormField label="Status da Arte">
                    <Select value={form.status_arte ?? ""} onValueChange={(v) => set("status_arte", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{statusArteOpcoes.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <FormField label="Observações da Arte">
                      <Textarea value={form.arte_observacao ?? ""} onChange={(e) => set("arte_observacao", e.target.value)} rows={2} />
                    </FormField>
                    <ObservacoesOutrosSetores pedido={selected} setorAtual="arte" />
                  </div>

                </div>

                <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" />Atualizar Arte</Button>
              </div>

          </CardContent>
        </Card>
      ) : (
        <EmptyState>Selecione um pedido no Dashboard abaixo.</EmptyState>
      )}

      {/* Dashboard da Arte */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dashboard — Arte</CardTitle></CardHeader>
        <CardContent className="p-3 space-y-2">
          {/* Filtros */}
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-0.5">
              <label className="text-xs text-muted-foreground font-medium">Etapa</label>
              <Select value={fEtapa} onValueChange={setFEtapa}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ETAPA_FILTRO_OPCOES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <label className="text-xs text-muted-foreground font-medium">Pedido / Orçamento</label>
              <Input className="h-8" placeholder="Buscar..." value={fSearch} onChange={(e) => setFSearch(e.target.value)} />
            </div>
            <div className="space-y-0.5">
              <label className="text-xs text-muted-foreground font-medium">Tipo de Estampa</label>
              <Select value={fTipo} onValueChange={setFTipo}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {TIPOS_ESTAMPA.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <label className="text-xs text-muted-foreground font-medium">STATUS DTF</label>
              <Select value={fDtf} onValueChange={setFDtf}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Aguardando impressão">Aguardando impressão</SelectItem>
                  <SelectItem value="Aguardando corte">Aguardando corte</SelectItem>
                  <SelectItem value="Finalizado">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <label className="text-xs text-muted-foreground font-medium">STATUS FOTOLITO</label>
              <Select value={fFoto} onValueChange={setFFoto}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Aguardando impressão">Aguardando impressão</SelectItem>
                  <SelectItem value="Aguardando data">Aguardando data</SelectItem>
                  <SelectItem value="Finalizado">Finalizado</SelectItem>

                </SelectContent>
              </Select>
            </div>

            <div className="space-y-0.5">
              <label className="text-xs text-muted-foreground font-medium">Status da Arte</label>
              <Select value={fStatusArte} onValueChange={setFStatusArte}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {statusArteOpcoes.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y">
            {dashboardRows.length === 0
              ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido.</div>
              : dashboardRows.map((p) => (
                  <PedidoMobileCard key={p.id} pedido={p} active={selected?.id === p.id} onClick={() => onSelect(p.id)}>
                    <Chip label="Estampa" value={p.tipo_estampa} />
                    <Chip label="QTD" value={p.qtd} />
                    <StatusPecasChip pedido={p} />
                    <Chip label="DTF Final." value={dtfFinalizadoLabel(p)} />
                    <Chip label="Fotolito" value={fotolitoFinalizadoLabel(p)} />
                    <Chip label="Status Arte" value={p.status_arte} />
                  </PedidoMobileCard>
                ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block rounded-lg border border-border/60 bg-card overflow-x-auto shadow-xs [&_th]:text-center [&_td]:text-center">
            <table className="w-full text-sm" style={{ fontFamily: '"Google Sans Flex", Arial, sans-serif', fontStretch: 'condensed' }}>
              <thead>
                <tr>
                  <Th>ETAPA</Th>
                  <Th>PEDIDO</Th>
                  <Th>ORÇAMENTO</Th>
                  <Th>VENDEDOR</Th>
                  <SortableTh label="QTD" active={sort.key === "qtd"} onClick={() => sort.toggle("qtd")} />
                  <Th>ESTAMPA</Th>
                  <Th>STATUS DAS PEÇAS</Th>
                  <Th>STATUS DTF</Th>
                  <Th>STATUS FOTOLITO</Th>
                  <Th>STATUS DA ARTE</Th>
                  <SortableTh label="DATA LIMITE" active={sort.key === "limite"} onClick={() => sort.toggle("limite")} />
                  <Th>INÍCIO EST.</Th>
                  <SortableTh label="SAÍDA JUFF" active={sort.key === "saida"} onClick={() => sort.toggle("saida")} />
                </tr>
              </thead>

              <tbody>
                {dashboardRows.length === 0 ? (
                  <tr><td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido.</td></tr>
                ) : dashboardRows.map((p) => {
                  const bg = linhaAtrasoClasse(p, "arte") || rowAlertBgClass(p, feriados);
                  return (
                    <tr key={p.id}
                      onClick={() => onSelect(p.id)}
                      className={`border-t cursor-pointer hover:bg-accent ${bg} ${selected?.id === p.id ? "bg-accent" : ""}`}>
                      <td className="px-1.5 py-0.5"><EtapaBadgeFromPedido pedido={p} /></td>
                      <td className="px-1.5 py-0.5 font-medium">{p.pedido_olist}</td>
                      <td className="px-1.5 py-0.5 text-left">{p.orcamento}</td>
                      <td className="px-1.5 py-0.5">{p.vendedor ?? "—"}</td>
                      <td className="px-1.5 py-0.5 tabular-nums">{p.qtd ?? "—"}</td>
                      <td className="px-1.5 py-0.5"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                      <td className="px-1.5 py-0.5"><StatusPecasBadge pedido={p} /></td>
                      <td className="px-1.5 py-0.5 whitespace-nowrap">{dtfFinalizadoLabel(p)}</td>
                      <td className="px-1.5 py-0.5 whitespace-nowrap">{fotolitoFinalizadoLabel(p)}</td>
                      <td className="px-1.5 py-0.5">{p.status_arte ?? "—"}</td>
                      <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.arte_data)}</td>
                      <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.inicio_estamparia)}</td>
                      <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.saida_juff)}</td>

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
