import { pedidoAtivoNasAreas, sortByDataSaidaJuffAsc, calcularEtapaAtual } from "@/lib/pedidos";
import { useEffect, useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { SIM_NAO_PROCESSO, modeloIncluiDTF, modeloIncluiSilk, visivelEmAcabamento, acabamentoCompleto } from "@/lib/pedidos";
import { useAppList } from "@/lib/app-lists";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, CheckCircle2, Download, FilterX } from "lucide-react";
import { ReadOnlyField, FormField, EmptyState, EtapaTopoBanner, EtapaBadgeFromPedido, StatusPecasBadge, StatusPecasChip, QtdTotal, PedidoMobileCard, Chip, useSort, cmpDate, cmpNum, cmpText, SortableTh, Th, rowAlertBgClass, linhaAtrasoClasse, ETAPA_FILTRO_OPCOES_ACABAMENTO, matchEtapaFiltro, UpdateButton, OrcamentoTitle } from "./shared";
import { ObservacoesOutrosSetores } from "./ObservacoesOutrosSetores";
import { RefacaoViewerButton } from "./RefacaoViewerButton";

import { useDirtyTracker, useRegisterSave, useDirtyForm } from "./dirty-form-context";
import { formatDateBR } from "@/lib/format";
import { useFeriados } from "@/hooks/use-feriados";
import { MultiSelectPeople } from "./MultiSelectPeople";
import { VoltarDropdown } from "./VoltarDropdown";
import { RefacaoBadge } from "./RefacaoBadge";
import { CorrecaoEtapaBadge } from "./CorrecaoEtapaBadge";
import { CorrigirEtapaButton } from "./CorrigirEtapaButton";
import { todayISO } from "@/lib/dias-uteis";


import { isReadOnly } from "./edicao-policy";

interface Props {
  pedidos: Pedido[];
  selected: Pedido | null;
  onSelect: (id: string | null) => void;
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  saving: boolean;
  active?: boolean;
  onNavigate?: (tab: string) => void;
  canManage?: boolean;
  soLeitura?: boolean;
}

export function AcabamentoTab({ pedidos, selected, onSelect, onSave, saving, active = true, onNavigate, canManage = false, soLeitura = false }: Props) {
  const readOnly = isReadOnly("acabamento", selected, canManage, soLeitura);

  const [form, setForm] = useState<Partial<Pedido>>({});
  const { isDirty } = useDirtyForm();
  const { names: responsaveis } = useAppList("acabamento");
  const { feriados } = useFeriados();
  const sort = useSort<"pedido"|"qtd"|"inicio"|"termino"|"saida"|"etapa"|"orcamento"|"tipo"|"statusPecas"|"dtfEst"|"silkEst"|"respAcab"|"entrega"|"frete">();
  useEffect(() => {
    if (!selected) { setForm({}); return; }
    if (!isDirty) setForm(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  useDirtyTracker(form, selected ?? {}, active && !!selected);
  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  function setEmbalado(v: string) {
    setForm((f) => {
      const curData = (f.data_saida_juff ?? selected?.data_saida_juff) ?? null;
      const nextData = v === "Sim" ? (curData ?? todayISO()) : null;
      return {
        ...f,
        embalado: v,
        data_saida_juff: nextData,
        ...(v !== "Sim" ? { responsavel_conferencia: null } : {}),
      };
    });
  }
  function setDataSaida(v: string | null | undefined) {
    setForm((f) => ({
      ...f,
      data_saida_juff: v ?? null,
    }));
  }

  const temDTF = selected && modeloIncluiDTF(selected.tipo_estampa);
  const temSilk = selected && modeloIncluiSilk(selected.tipo_estampa);
  const dtfOk = !temDTF || selected?.dtf_estampado === "Sim";
  const silkOk = !temSilk || selected?.silk_feito === "Sim";
  const podeFinalizar = dtfOk && silkOk && form.embalado === "Sim" && !!form.data_saida_juff && !!form.responsavel_acabamento;

  function handleSave() {
    if (!selected) return;
    if (readOnly) return;
    const pick = <K extends keyof Pedido>(k: K) =>
      (form[k] !== undefined ? form[k] : (selected as any)[k]) ?? null;
    const embalado = pick("embalado");
    const payload: any = {
      id: selected.id,
      embalado,
      responsavel_acabamento: pick("responsavel_acabamento"),
      responsavel_conferencia: pick("responsavel_conferencia"),
      data_saida_juff: pick("data_saida_juff"),
      acabamento_observacao: pick("acabamento_observacao" as any),
    };
    // 3A: ao marcar EMBALADO=Sim + Data da Embalagem + Responsável, envia automaticamente para Expedição.
    if (embalado === "Sim" && !!payload.data_saida_juff && !!payload.responsavel_acabamento && !selected.expedicao_entrou_em) {
      payload.expedicao_entrou_em = new Date().toISOString();
    }
    onSave(payload);
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
  const [fEtapa, setFEtapa] = useState("acabamento");

  const dashboardPedidos = useMemo(() => sortByDataSaidaJuffAsc(pedidos.filter((p) => {
    if (!matchEtapaFiltro(p, fEtapa)) return false;
    if (!visivelEmAcabamento(p)) return false;
    if (fOrc && !String(p.orcamento ?? "").toLowerCase().includes(fOrc.toLowerCase())) return false;
    if (fPed && !String(p.pedido_olist ?? "").toLowerCase().includes(fPed.toLowerCase())) return false;
    if (fDtf !== "todos" && (p.dtf_estampado ?? "") !== fDtf) return false;
    if (fSilk !== "todos" && (p.silk_feito ?? "") !== fSilk) return false;
    return true;
  })), [pedidos, fEtapa, fOrc, fPed, fDtf, fSilk]);

  const enviadoParaExpedicao = !!selected?.expedicao_entrou_em;

  return (
    <div className="space-y-3">
      {selected ? (
        <>
        <OrcamentoTitle orcamento={selected.orcamento} />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base sm:text-lg truncate">Acabamento — {selected.pedido_olist}</CardTitle>
            <div className="flex items-center gap-2">
              <RefacaoBadge pedido={selected} />
              <CorrecaoEtapaBadge pedido={selected} />
              <Badge variant="outline" className={status.color}>{status.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <EtapaTopoBanner pedido={selected} tab="acabamento" />
            {podeFinalizar && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-success/10 text-success text-sm border border-success/30">
                <CheckCircle2 className="h-4 w-4" /> Pronto para Expedição. Ao clicar em <strong className="mx-1">Salvar Acabamento</strong>, o pedido vai automaticamente para a Expedição.
              </div>
            )}
            {selected.status_pecas !== "completo" && selected.arte_data && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/30">
                <CheckCircle2 className="h-4 w-4" /> <span className="font-semibold">Pedido Incompleto</span> — Status de Peças ainda está "incompleto".
              </div>
            )}

            <div className="grid gap-2 grid-cols-1 sm:grid-cols-3 lg:grid-cols-7">
              <ReadOnlyField label="Pedido" value={selected.pedido_olist} />
              <ReadOnlyField label="Orçamento" value={selected.orcamento} />
              <ReadOnlyField label="Vendedor" value={selected.vendedor} />
              <ReadOnlyField label="Tipo de Estampa" value={selected.tipo_estampa} />
              <ReadOnlyField label="Status de Peças" value={selected.status_pecas} />
              <ReadOnlyField label="DTF Estampado?" value={temDTF ? (selected.dtf_estampado ?? "—") : "N/A"} />
              <ReadOnlyField label="Silk Estampado?" value={temSilk ? (selected.silk_feito ?? "—") : "N/A"} />
            </div>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-3 lg:grid-cols-7">
              <ReadOnlyField label="Estampador DTF" value={temDTF ? ((selected as any).quem_bateu_dtf ?? "—") : "N/A"} />
              <ReadOnlyField label="Estampador Silk" value={temSilk ? ((selected as any).quem_bateu_silk ?? "—") : "N/A"} />
              <ReadOnlyField label="Início de Acabamento" value={formatDateBR(selected.inicio_acabamento)} />
              <ReadOnlyField label="Término de Acabamento" value={formatDateBR(selected.termino_acabamento)} />
              <ReadOnlyField label="Saída Juff (prazo)" value={formatDateBR(selected.saida_juff)} />
              <ReadOnlyField label="Data de Entrega" value={formatDateBR((selected as any).data_entrega)} />
              <ReadOnlyField label="Tipo de Frete" value={(selected as any).frete ?? "—"} />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Layout</div>
              {selected.layout_url ? (
                <div className="space-y-1">
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => baixarLayout(selected.layout_url!)}>
                      <Download className="h-4 w-4 mr-1" /> Baixar layout
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{selected.layout_url.replace(/^[0-9a-f-]{36}-/i, "")}</div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Sem layout</div>
              )}
            </div>
            {readOnly && (
              <div className="text-xs text-muted-foreground bg-muted/50 border rounded-md px-3 py-2">
                Esta etapa não está disponível para edição agora (ainda não foi liberada ou já foi concluída). Visualização somente leitura.
              </div>
            )}
            <fieldset disabled={readOnly} className="contents disabled:opacity-60">
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 pt-3 border-t">
              <FormField label="Responsável pelo Acabamento (múltiplos)">
                <MultiSelectPeople
                  value={form.responsavel_acabamento}
                  options={responsaveis}
                  onChange={(v) => set("responsavel_acabamento", v)}
                  placeholder="Selecione..."
                />
              </FormField>
              <FormField label="EMBALADO?">
                <Select value={form.embalado ?? ""} onValueChange={setEmbalado}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{SIM_NAO_PROCESSO.slice(0, 2).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <FormField label={`Data da Embalagem${form.embalado === "Sim" ? " *" : ""}`}>
                <DateInputBR disabled={form.embalado !== "Sim"} value={form.data_saida_juff} onChange={setDataSaida} />
              </FormField>
              <div className="sm:col-span-2 lg:col-span-4">
                <FormField label="Observações do Acabamento">
                  <Textarea className="uppercase" value={(form as any).acabamento_observacao ?? ""} onChange={(e) => set("acabamento_observacao" as any, e.target.value as any)} rows={3} />
                </FormField>
                <ObservacoesOutrosSetores pedido={selected} setorAtual="acabamento" />
              </div>

            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex flex-wrap gap-2 sm:justify-start items-center">
                {form.embalado === "Sim" && !enviadoParaExpedicao && (
                  <span className="text-xs text-muted-foreground self-center">
                    Ao salvar com EMBALADO=Sim, o pedido vai automaticamente para Expedição.
                  </span>
                )}
                {enviadoParaExpedicao && (
                  <Badge variant="outline" className="bg-pink-500/15 text-pink-700 border-pink-500/30 dark:text-pink-300 self-center">
                    Enviado para Expedição
                  </Badge>
                )}
                {!readOnly && (
                  <UpdateButton onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                    {enviadoParaExpedicao ? "Salvar Acabamento" : "Salvar"}
                  </UpdateButton>
                )}
                <RefacaoViewerButton pedido={selected} />
              </div>
            </div>
            </fieldset>
            <div className="flex justify-end gap-2 flex-wrap">
              {canManage && !soLeitura && !selected.finalizado_em && acabamentoCompleto(selected) && (() => {
                const tipo = selected.tipo_estampa;
                if (tipo === "DTF+Silk") {
                  return (
                    <>
                      <CorrigirEtapaButton
                        pedido={selected}
                        destino="dtf"
                        abaOrigem="acabamento"
                        label="Corrigir → voltar pro DTF"
                        onSave={onSave}
                        onCorrigido={(d) => { if (onNavigate) onNavigate(d); }}
                      />
                      <CorrigirEtapaButton
                        pedido={selected}
                        destino="silk"
                        abaOrigem="acabamento"
                        label="Corrigir → voltar pro Silk"
                        onSave={onSave}
                        onCorrigido={(d) => { if (onNavigate) onNavigate(d); }}
                      />
                    </>
                  );
                }
                const dest: "dados" | "dtf" | "silk" =
                  tipo === "Lisa" ? "dados"
                  : modeloIncluiDTF(tipo) ? "dtf"
                  : modeloIncluiSilk(tipo) ? "silk"
                  : "dados";
                return (
                  <CorrigirEtapaButton
                    pedido={selected}
                    destino={dest}
                    abaOrigem="acabamento"
                    onSave={onSave}
                    onCorrigido={(d) => { if (onNavigate) onNavigate(d); }}
                  />
                );
              })()}
              <AcabamentoVoltar selected={selected} onSave={onSave} onNavigate={onNavigate} />
            </div>

          </CardContent>
        </Card>
        </>
      ) : (
        <EmptyState>Selecione um pedido no dashboard abaixo.</EmptyState>
      )}

      <Card>
        <CardHeader className="pb-2"><div className="flex items-baseline justify-between gap-2"><CardTitle className="text-base">Dashboard — Acabamento</CardTitle><span className="text-xs text-muted-foreground tabular-nums">{dashboardPedidos.length} {dashboardPedidos.length === 1 ? "registro" : "registros"}</span></div></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
            <Select value={fEtapa} onValueChange={setFEtapa}>
              <SelectTrigger><SelectValue placeholder="Etapa" /></SelectTrigger>
              <SelectContent>
                {ETAPA_FILTRO_OPCOES_ACABAMENTO.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
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
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { setFOrc(""); setFPed(""); setFDtf("todos"); setFSilk("todos"); setFEtapa("acabamento"); }}>
              <FilterX className="h-4 w-4 mr-1" /> Limpar Filtros
            </Button>
          </div>
          <div className="md:hidden rounded-md border divide-y">

            {dashboardPedidos.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido pronto para acabamento.</div>
            ) : dashboardPedidos.map((p) => (
              <PedidoMobileCard key={p.id} pedido={p} active={selected?.id === p.id} onClick={() => onSelect(p.id)}>
                <Chip label="Tipo" value={p.tipo_estampa} />
                <Chip label="QTD" value={<QtdTotal pedido={p} />} />
                <StatusPecasChip pedido={p} />
                <Chip label="Resp. Acab." value={p.responsavel_acabamento || "—"} />
                <Chip label="DTF" value={modeloIncluiDTF(p.tipo_estampa) ? (p.dtf_estampado ?? "—") : "N/A"} />
                <Chip label="Silk" value={modeloIncluiSilk(p.tipo_estampa) ? (p.silk_feito ?? "—") : "N/A"} />
                <Chip label="Início Acab." value={formatDateBR(p.inicio_acabamento) || "—"} />
                <Chip label="Término Acab." value={formatDateBR(p.termino_acabamento) || "—"} />
                <Chip label="Saída Juff" value={formatDateBR(p.saida_juff) || "—"} />
                <Chip label="Entrega" value={formatDateBR((p as any).data_entrega) || "—"} />
                <Chip label="Frete" value={(p as any).frete || "—"} />
              </PedidoMobileCard>
            ))}
          </div>
          <div className="hidden md:block rounded-lg border border-border/60 bg-card overflow-auto max-h-[70vh] tbl-congelada [--tbl-congelada-bg:var(--color-card)] shadow-xs [&_th]:text-center [&_td]:text-center">
            <table className="w-full text-sm" style={{ fontFamily: '"Google Sans Flex", Arial, sans-serif', fontStretch: 'condensed' }}>
              <thead>
                <tr>
                  <SortableTh label="ETAPA" active={sort.key === "etapa"} onClick={() => sort.toggle("etapa")} />
                  <SortableTh label="PEDIDO" active={sort.key === "pedido"} onClick={() => sort.toggle("pedido")} />
                  <SortableTh label="ORÇAMENTO" active={sort.key === "orcamento"} onClick={() => sort.toggle("orcamento")} />
                  <SortableTh label="TIPO" active={sort.key === "tipo"} onClick={() => sort.toggle("tipo")} />
                  <SortableTh label="QTD" active={sort.key === "qtd"} onClick={() => sort.toggle("qtd")} />
                  <SortableTh label="STATUS DAS PEÇAS" active={sort.key === "statusPecas"} onClick={() => sort.toggle("statusPecas")} />
                  <SortableTh label="RESP. ACAB." active={sort.key === "respAcab"} onClick={() => sort.toggle("respAcab")} />
                  <SortableTh label="DTF EST." active={sort.key === "dtfEst"} onClick={() => sort.toggle("dtfEst")} />
                  <SortableTh label="SILK EST." active={sort.key === "silkEst"} onClick={() => sort.toggle("silkEst")} />
                  <SortableTh label="INÍCIO ACAB." active={sort.key === "inicio"} onClick={() => sort.toggle("inicio")} />
                  <SortableTh label="TÉRMINO ACAB." active={sort.key === "termino"} onClick={() => sort.toggle("termino")} />
                  <SortableTh label="SAÍDA JUFF" active={sort.key === "saida"} onClick={() => sort.toggle("saida")} />
                  <SortableTh label="ENTREGA" active={sort.key === "entrega"} onClick={() => sort.toggle("entrega")} />
                  <SortableTh label="FRETE" active={sort.key === "frete"} onClick={() => sort.toggle("frete")} />
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let lista = dashboardPedidos;
                  if (sort.key) {
                    lista = [...lista].sort((a, b) => {
                      switch (sort.key) {
                        case "pedido": return cmpPedido(a, b, sort.dir);
                        case "qtd": return cmpNum(a.qtd, b.qtd, sort.dir);
                        case "inicio": return cmpDate(a.inicio_acabamento, b.inicio_acabamento, sort.dir);
                        case "termino": return cmpDate(a.termino_acabamento, b.termino_acabamento, sort.dir);
                        case "saida": return cmpDate(a.saida_juff, b.saida_juff, sort.dir);
                        case "etapa": return cmpText(calcularEtapaAtual(a).etapa, calcularEtapaAtual(b).etapa, sort.dir);
                        case "orcamento": return cmpText(a.orcamento, b.orcamento, sort.dir);
                        case "tipo": return cmpText(a.tipo_estampa, b.tipo_estampa, sort.dir);
                        case "statusPecas": return cmpText(a.status_pecas, b.status_pecas, sort.dir);
                        case "dtfEst": return cmpText(modeloIncluiDTF(a.tipo_estampa) ? (a.dtf_estampado ?? "") : "N/A", modeloIncluiDTF(b.tipo_estampa) ? (b.dtf_estampado ?? "") : "N/A", sort.dir);
                        case "silkEst": return cmpText(modeloIncluiSilk(a.tipo_estampa) ? (a.silk_feito ?? "") : "N/A", modeloIncluiSilk(b.tipo_estampa) ? (b.silk_feito ?? "") : "N/A", sort.dir);
                        case "respAcab": return cmpText(a.responsavel_acabamento, b.responsavel_acabamento, sort.dir);
                        case "entrega": return cmpDate((a as any).data_entrega, (b as any).data_entrega, sort.dir);
                        case "frete": return cmpText((a as any).frete, (b as any).frete, sort.dir);
                      }
                      return 0;
                    });
                  }
                  return lista.map((p) => {
                    const bg = linhaAtrasoClasse(p, "acabamento") || rowAlertBgClass(p, feriados);
                    return (
                      <tr key={p.id} onClick={() => onSelect(p.id)} className={`border-t cursor-pointer hover:bg-accent ${bg} ${selected?.id === p.id ? "bg-accent" : ""}`}>
                        <td className="px-1.5 py-0.5"><EtapaBadgeFromPedido pedido={p} /></td>
                        <td className="px-1.5 py-0.5 font-medium">{p.pedido_olist}</td>
                        <td className="px-1.5 py-0.5 !text-left">{p.orcamento}</td>
                        <td className="px-1.5 py-0.5"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                        <td className="px-1.5 py-0.5"><QtdTotal pedido={p} /></td>
                        <td className="px-1.5 py-0.5"><StatusPecasBadge pedido={p} /></td>
                        <td className="px-1.5 py-0.5">{p.responsavel_acabamento || "—"}</td>
                        <td className="px-1.5 py-0.5">{modeloIncluiDTF(p.tipo_estampa) ? (p.dtf_estampado ?? "—") : "N/A"}</td>
                        <td className="px-1.5 py-0.5">{modeloIncluiSilk(p.tipo_estampa) ? (p.silk_feito ?? "—") : "N/A"}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.inicio_acabamento)}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.termino_acabamento)}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.saida_juff)}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR((p as any).data_entrega) || "—"}</td>
                        <td className="px-1.5 py-0.5">{(p as any).frete ?? "—"}</td>
                      </tr>
                    );
                  });
                })()}
                {dashboardPedidos.length === 0 && (
                  <tr><td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido pronto para acabamento.</td></tr>
                )}


              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function cmpPedido(a: Pedido, b: Pedido, dir: "asc" | "desc") {
  const na = Number(a.pedido_olist);
  const nb = Number(b.pedido_olist);
  const aBad = !Number.isFinite(na);
  const bBad = !Number.isFinite(nb);
  if (aBad && bBad) return 0;
  if (aBad) return 1;
  if (bBad) return -1;
  return dir === "asc" ? na - nb : nb - na;
}

function AcabamentoVoltar({ selected, onSave, onNavigate }: { selected: Pedido; onSave: (p: any) => void; onNavigate?: (tab: string) => void }) {
  const isLisa = selected.tipo_estampa === "Lisa";
  const destinos: ("dados" | "arte" | "dtf" | "silk")[] = ["dados"];
  if (!isLisa) {
    destinos.push("arte");
    if (modeloIncluiDTF(selected.tipo_estampa)) destinos.push("dtf");
    if (modeloIncluiSilk(selected.tipo_estampa)) destinos.push("silk");
  }
  async function handle(
    destino: "dados" | "arte" | "dtf" | "silk" | "acabamento",
    payload: import("./RefacaoDialog").RefacaoFormPayload | null,
  ) {
    const { montarRefacoesAposRefazer, camposAlimpar } = await import("./refacao-helpers");
    const { refacoes } = await montarRefacoesAposRefazer(selected, destino, payload);
    onSave({
      id: selected.id,
      refacoes,
      ...camposAlimpar(selected, destino),
    } as any);
    if (onNavigate) onNavigate(destino);
  }

  return <VoltarDropdown pedido={selected} destinos={destinos} onVoltar={handle} />;
}


