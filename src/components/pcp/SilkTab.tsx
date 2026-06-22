import { pedidoAtivoNasAreas, sortByDataSaidaJuffAsc } from "@/lib/pedidos";
import { useEffect, useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { SIM_NAO_PROCESSO, modeloIncluiSilk, visivelEmSilk } from "@/lib/pedidos";
import { useAppList } from "@/lib/app-lists";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Download } from "lucide-react";
import { ReadOnlyField, FormField, EmptyState, EtapaTopoBanner, EtapaBadgeFromPedido, StatusPecasBadge, StatusPecasChip, PedidoMobileCard, Chip, useSort, cmpDate, cmpNum, SortableTh, Th, rowAlertBgClass, linhaAtrasoClasse, ETAPA_FILTRO_OPCOES, matchEtapaFiltro, UpdateButton } from "./shared";
import { ObservacoesOutrosSetores } from "./ObservacoesOutrosSetores";
import { MultiSelectPeople } from "./MultiSelectPeople";
import { VoltarDropdown } from "./VoltarDropdown";
import { RefacaoBadge } from "./RefacaoBadge";
import { todayISO } from "@/lib/dias-uteis";

import { useDirtyTracker, useRegisterSave, useDirtyForm } from "./dirty-form-context";
import { useFeriados } from "@/hooks/use-feriados";

import { formatDateBR } from "@/lib/format";

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
}

export function SilkTab({ pedidos, selected, onSelect, onSave, saving, active = true, onNavigate, canManage = false }: Props) {
  const readOnly = isReadOnly("silk", selected, canManage);

  const [form, setForm] = useState<Partial<Pedido>>({});
  const { isDirty } = useDirtyForm();
  const { names: operadoresSilk } = useAppList("silk");
  const { names: opRevelacao } = useAppList("revelacao_silk");
  const { feriados } = useFeriados();
  const sort = useSort<"pedido"|"qtd"|"silk"|"saida"|"entrega"|"iniEst"|"fimEst"|"iniAcab">();
  useEffect(() => {
    if (!selected) { setForm({}); return; }
    if (!isDirty) setForm(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  useDirtyTracker(form, selected ?? {}, active && !!selected);
  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  // A4: ao marcar "Sim" preenche a data automática (editável). "Não" limpa.
  function setTelaGravada(v: string) {
    setForm((f) => {
      const curData = (f as any).tela_gravada_data ?? null; // não existe coluna específica; mantemos lógica original
      return { ...f, tela_gravada: v };
    });
  }
  function setSilkFeito(v: string) {
    setForm((f) => {
      const curData = (f.silk_data_executada ?? selected?.silk_data_executada) ?? null;
      const nextData = v === "Sim" ? (curData ?? todayISO()) : null;
      return {
        ...f,
        silk_feito: v,
        silk_data_executada: nextData,
        ...(v !== "Sim" ? { quem_bateu_silk: null } : {}),
      };
    });
  }
  function setDataExec(v: string | null | undefined) {
    setForm((f) => ({
      ...f,
      silk_data_executada: v ?? null,
      ...(!v ? { quem_bateu_silk: null } : {}),
    }));
  }
  function handleSave() {
    if (!selected) return;
    if (readOnly) return;
    const pick = <K extends keyof Pedido>(k: K) =>
      (form[k] !== undefined ? form[k] : (selected as any)[k]) ?? null;
    onSave({
      id: selected.id,
      tela_gravada: pick("tela_gravada"),
      quem_revelou_tela: pick("quem_revelou_tela"),
      silk_feito: pick("silk_feito"),
      silk_data_executada: pick("silk_data_executada"),
      quem_bateu_silk: pick("quem_bateu_silk"),
      silk_observacao: pick("silk_observacao"),
    });
  }
  useRegisterSave(handleSave, active);

  async function handleVoltar(
    destino: "dados" | "arte" | "dtf" | "silk" | "acabamento",
    payload: import("./RefacaoDialog").RefacaoFormPayload | null,
  ) {
    if (!selected) return;
    const { montarRefacoesAposRefazer } = await import("./refacao-helpers");
    const refacoes = await montarRefacoesAposRefazer(selected, destino, payload);
    onSave({
      id: selected.id,
      refacoes,
      silk_feito: null,
      silk_data_executada: null,
      quem_bateu_silk: null,
    } as any);
    if (onNavigate) onNavigate(destino);
  }

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
  const [fEtapa, setFEtapa] = useState("ativas");

  const dashboardPedidos = useMemo(() => sortByDataSaidaJuffAsc(pedidos.filter((p) => {
    if (!matchEtapaFiltro(p, fEtapa)) return false;
    if (!visivelEmSilk(p)) return false;
    if (fOrc && !String(p.orcamento ?? "").toLowerCase().includes(fOrc.toLowerCase())) return false;
    if (fPed && !String(p.pedido_olist ?? "").toLowerCase().includes(fPed.toLowerCase())) return false;
    if (fStatus !== "todos" && p.status_pecas !== fStatus) return false;
    if (fTela !== "todos" && (p.tela_gravada ?? "") !== fTela) return false;
    if (fSilk !== "todos" && (p.silk_feito ?? "") !== fSilk) return false;
    return true;
  })), [pedidos, fEtapa, fOrc, fPed, fStatus, fTela, fSilk]);


  return (
    <div className="space-y-3">
      {selected ? (
        !modeloIncluiSilk(selected.tipo_estampa) ? (
          <EmptyState>Este pedido não inclui Silk (modelo: {selected.tipo_estampa}).</EmptyState>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base sm:text-lg truncate">Silk Screen — {selected.pedido_olist}</CardTitle>
              <div className="flex items-center gap-2">
                <RefacaoBadge pedido={selected} />
                <Badge variant="outline" className={statusColor}>
                  {form.silk_feito === "Sim" ? (atrasado ? "Atrasado" : "Concluído") : "Em andamento"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <EtapaTopoBanner pedido={selected} tab="silk" />
              {selected.status_pecas !== "completo" && selected.arte_data && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/30">
                  <span className="font-semibold">Pedido Incompleto</span> — Status de Peças ainda está "incompleto".
                </div>
              )}

              {/* Linha 1 */}
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <ReadOnlyField label="Pedido" value={selected.pedido_olist} />
                <ReadOnlyField label="Orçamento" value={selected.orcamento} />
                <ReadOnlyField label="QTD" value={selected.qtd} />
                <ReadOnlyField label="Status de Peças" value={selected.status_pecas} />
              </div>
              {/* Linha 2 */}
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
                <ReadOnlyField label="Fotolito Impresso" value={selected.fotolito_impresso ?? "Pendente"} />
                <ReadOnlyField label="Início Estamparia" value={formatDateBR(selected.inicio_estamparia)} />
                <ReadOnlyField label="Término Estamparia" value={formatDateBR(selected.termino_estamparia)} />
                <ReadOnlyField label="Início Acabamento" value={formatDateBR(selected.inicio_acabamento)} />
                <ReadOnlyField label="Nº Batidas Silk" value={selected.n_batidas_silk ?? "—"} />
              </div>

              {readOnly && (
                <div className="text-xs text-muted-foreground bg-muted/50 border rounded-md px-3 py-2">
                  Esta etapa já foi concluída para este pedido. Visualização somente leitura.
                </div>
              )}
              <fieldset disabled={readOnly} className="contents disabled:opacity-60">
              {/* A10 — Execuções em duas linhas */}
              <div className="pt-3 border-t space-y-2">
                {/* Linha 1: Tela gravada / Data / Quem revelou */}
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField label="Tela gravada?">
                    <Select value={form.tela_gravada ?? ""} onValueChange={setTelaGravada}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Quem revelou a tela?">
                    <Select value={form.quem_revelou_tela ?? ""} onValueChange={(v) => set("quem_revelou_tela", v)} disabled={form.tela_gravada !== "Sim"}>
                      <SelectTrigger><SelectValue placeholder={form.tela_gravada !== "Sim" ? "Marque tela gravada primeiro" : "Selecione..."} /></SelectTrigger>
                      <SelectContent>{opRevelacao.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <div />
                </div>
                {/* Linha 2: Silk feito / Data / Quem bateu */}
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField label="Silk feito?">
                    <Select value={form.silk_feito ?? ""} onValueChange={setSilkFeito} disabled={silkBloqueado}>
                      <SelectTrigger><SelectValue placeholder={silkBloqueado ? "Tela precisa estar gravada" : "Selecione..."} /></SelectTrigger>
                      <SelectContent>{SIM_NAO_PROCESSO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <FormField label={`Data da execução${form.silk_feito === "Sim" ? " *" : ""}`}>
                    <DateInputBR disabled={form.silk_feito !== "Sim"} value={form.silk_data_executada} onChange={setDataExec} />
                  </FormField>
                  <FormField label="Quem bateu o Silk? (múltiplos)">
                    <MultiSelectPeople
                      value={form.quem_bateu_silk}
                      options={operadoresSilk}
                      onChange={(v) => set("quem_bateu_silk", v)}
                      disabled={!form.silk_data_executada}
                      placeholder={!form.silk_data_executada ? "Preencha a data primeiro" : "Selecione..."}
                    />
                  </FormField>
                </div>
              </div>

              <div className="pt-3 border-t">
                <FormField label="Observações do Silk">
                  <Textarea value={form.silk_observacao ?? ""} onChange={(e) => set("silk_observacao", e.target.value)} rows={2} />
                </FormField>
                <ObservacoesOutrosSetores pedido={selected} setorAtual="silk" />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t">
                <div className="flex flex-wrap gap-2 sm:justify-start items-center">
                  {selected.layout_url && (
                    <Button variant="outline" size="sm" onClick={() => baixarLayout(selected.layout_url!)}>
                      <Download className="h-4 w-4 mr-1" /> Baixar layout
                    </Button>
                  )}
                  <UpdateButton onClick={handleSave} disabled={saving}>Atualizar Silk</UpdateButton>
                </div>
                <VoltarDropdown pedido={selected} destinos={["dados", "arte"]} onVoltar={handleVoltar} />
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <EmptyState>Selecione um pedido Silk no dashboard abaixo.</EmptyState>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Dashboard — Silk</CardTitle></CardHeader>
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
          <div className="md:hidden rounded-md border divide-y">
            {dashboardPedidos.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido Silk disponível.</div>
            ) : dashboardPedidos.map((p) => (
              <PedidoMobileCard key={p.id} pedido={p} active={selected?.id === p.id} onClick={() => onSelect(p.id)}>
                <Chip label="Tipo" value={p.tipo_estampa} />
                <Chip label="QTD" value={p.qtd} />
                <StatusPecasChip pedido={p} />
                <Chip label="Tela" value={p.tela_gravada} />
                <Chip label="Silk" value={p.silk_feito} />
                <Chip label="Entrega" value={formatDateBR(p.data_entrega) || "—"} />
              </PedidoMobileCard>
            ))}
          </div>
          {/* A11 — colunas */}
          <div className="hidden md:block rounded-lg border border-border/60 bg-card overflow-x-auto shadow-xs [&_th]:text-center [&_td]:text-center">
            <table className="w-full text-sm" style={{ fontFamily: '"Google Sans Flex", Arial, sans-serif', fontStretch: 'condensed' }}>
              <thead>
                <tr>
                  <Th>ETAPA</Th>
                  <SortableTh label="PEDIDO" active={sort.key === "pedido"} onClick={() => sort.toggle("pedido")} />
                  <Th>ORÇAMENTO</Th>
                  <Th>VENDEDOR</Th>
                  <SortableTh label="QTD" active={sort.key === "qtd"} onClick={() => sort.toggle("qtd")} />
                  <Th>ESTAMPA</Th>
                  <Th>STATUS DAS PEÇAS</Th>
                  <Th>FOTOLITO</Th>
                  <Th>TELA</Th>
                  <Th>SILK FEITO</Th>
                  <SortableTh label="INÍCIO ESTAMPARIA" active={sort.key === "iniEst"} onClick={() => sort.toggle("iniEst")} />
                  <SortableTh label="TÉRMINO ESTAMPARIA" active={sort.key === "fimEst"} onClick={() => sort.toggle("fimEst")} />
                  <SortableTh label="INÍCIO ACABAMENTO" active={sort.key === "iniAcab"} onClick={() => sort.toggle("iniAcab")} />
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
                        case "silk": return cmpDate(a.silk_data_executada, b.silk_data_executada, sort.dir);
                        case "saida": return cmpDate(a.saida_juff, b.saida_juff, sort.dir);
                        case "entrega": return cmpDate(a.data_entrega, b.data_entrega, sort.dir);
                        case "iniEst": return cmpDate(a.inicio_estamparia, b.inicio_estamparia, sort.dir);
                        case "fimEst": return cmpDate(a.termino_estamparia, b.termino_estamparia, sort.dir);
                        case "iniAcab": return cmpDate(a.inicio_acabamento, b.inicio_acabamento, sort.dir);
                      }
                      return 0;
                    });
                  }
                  return lista.map((p) => {
                    const bg = linhaAtrasoClasse(p, "silk") || rowAlertBgClass(p, feriados);
                    return (
                      <tr key={p.id} onClick={() => onSelect(p.id)} className={`border-t cursor-pointer hover:bg-accent ${bg} ${selected?.id === p.id ? "bg-accent" : ""}`}>
                        <td className="px-1.5 py-0.5"><EtapaBadgeFromPedido pedido={p} /></td>
                        <td className="px-1.5 py-0.5 font-medium">{p.pedido_olist}</td>
                        <td className="px-1.5 py-0.5 !text-left">{p.orcamento}</td>
                        <td className="px-1.5 py-0.5">{p.vendedor ?? "—"}</td>
                        <td className="px-1.5 py-0.5">{p.qtd ?? "—"}</td>
                        <td className="px-1.5 py-0.5"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                        <td className="px-1.5 py-0.5"><StatusPecasBadge pedido={p} /></td>
                        <td className="px-1.5 py-0.5">{p.fotolito_impresso ?? "—"}</td>
                        <td className="px-1.5 py-0.5">{p.tela_gravada ?? "—"}</td>
                        <td className="px-1.5 py-0.5">{p.silk_feito ?? "—"}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.inicio_estamparia)}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.termino_estamparia)}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.inicio_acabamento)}</td>
                      </tr>
                    );
                  });
                })()}
                {dashboardPedidos.length === 0 && (
                  <tr><td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido Silk disponível.</td></tr>
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
