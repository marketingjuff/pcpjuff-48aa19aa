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
import { ReadOnlyField, FormField, EmptyState, EtapaTopoBanner, EtapaBadgeFromPedido, StatusPecasBadge, StatusPecasChip, QtdTotal, PedidoMobileCard, Chip, useSort, cmpDate, cmpNum, SortableTh, Th, rowAlertBgClass, linhaAtrasoClasse, ETAPA_FILTRO_OPCOES_DTF, matchEtapaFiltro, UpdateButton, OrcamentoTitle } from "./shared";
import { ObservacoesOutrosSetores } from "./ObservacoesOutrosSetores";
import { MultiSelectPeople, parsePeople } from "./MultiSelectPeople";
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

export function DTFTab({ pedidos, selected, onSelect, onSave, saving, active = true, onNavigate, canManage = false }: Props) {
  const readOnly = isReadOnly("dtf", selected, canManage);

  const [form, setForm] = useState<Partial<Pedido>>({});
  const { isDirty } = useDirtyForm();
  const { names: operadoresDTF } = useAppList("dtf");
  const { feriados } = useFeriados();
  const sort = useSort<"pedido"|"qtd"|"exec"|"saida"|"entrega"|"iniEst"|"fimEst"|"iniAcab">();
  useEffect(() => {
    if (!selected) { setForm({}); return; }
    if (!isDirty) setForm(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  useDirtyTracker(form, selected ?? {}, active && !!selected);
  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }
  function setEstampado(v: string) {
    setForm((f) => {
      const curData = (f.dtf_data_executada ?? selected?.dtf_data_executada) ?? null;
      const nextData = v === "Sim" ? (curData ?? todayISO()) : null;
      return {
        ...f,
        dtf_estampado: v,
        dtf_data_executada: nextData,
        ...(v !== "Sim" ? { quem_bateu_dtf: null, dtf_pessoas_qtd: null } : {}),
      };
    });
  }
  function setDataExec(v: string | null | undefined) {
    setForm((f) => ({
      ...f,
      dtf_data_executada: v ?? null,
      ...(!v ? { quem_bateu_dtf: null, dtf_pessoas_qtd: null } : {}),
    }));
  }
  function setQuemBateu(next: string | null) {
    setForm((f) => {
      const pessoas = parsePeople(next);
      // Mantém apenas qtds das pessoas atuais
      const prev = (f.dtf_pessoas_qtd ?? selected?.dtf_pessoas_qtd ?? {}) as Record<string, number>;
      const limpo: Record<string, number> = {};
      pessoas.forEach((p) => { if (prev[p] !== undefined) limpo[p] = prev[p]; });
      return { ...f, quem_bateu_dtf: next, dtf_pessoas_qtd: pessoas.length > 0 ? limpo : null };
    });
  }
  function setPessoaQtd(nome: string, qtd: number | null) {
    setForm((f) => {
      const prev = { ...(f.dtf_pessoas_qtd ?? selected?.dtf_pessoas_qtd ?? {}) } as Record<string, number>;
      if (qtd === null || isNaN(qtd as any)) delete prev[nome];
      else prev[nome] = qtd;
      return { ...f, dtf_pessoas_qtd: prev };
    });
  }
  function handleSave() {
    if (!selected) return;
    if (readOnly) return;
    const pick = <K extends keyof Pedido>(k: K) =>
      (form[k] !== undefined ? form[k] : (selected as any)[k]) ?? null;
    onSave({
      id: selected.id,
      dtf_estampado: pick("dtf_estampado"),
      dtf_data_executada: pick("dtf_data_executada"),
      quem_bateu_dtf: pick("quem_bateu_dtf"),
      dtf_pessoas_qtd: pick("dtf_pessoas_qtd"),
      dtf_observacao: pick("dtf_observacao"),
    });
  }
  useRegisterSave(handleSave, active);

  async function handleVoltar(
    destino: "dados" | "arte" | "dtf" | "silk" | "acabamento",
    payload: import("./RefacaoDialog").RefacaoFormPayload | null,
  ) {
    if (!selected) return;
    const { montarRefacoesAposRefazer, camposAlimpar } = await import("./refacao-helpers");
    const { refacoes, observacoes_pedido } = await montarRefacoesAposRefazer(selected, destino, payload);
    onSave({
      id: selected.id,
      refacoes,
      ...camposAlimpar(selected, destino),
      ...(observacoes_pedido !== undefined ? { observacoes_pedido } : {}),
    } as any);
    if (onNavigate) onNavigate(destino);
  }


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
    if (fImpresso !== "todos") {
      const pronto = p.dtf_impresso === "Sim" && p.dtf_cortado === "Sim" ? "Sim" : "Não";
      if (pronto !== fImpresso) return false;
    }
    if (fEstampado !== "todos" && (p.dtf_estampado ?? "") !== fEstampado) return false;
    return true;
  })), [pedidos, fEtapa, fOrc, fPed, fStatus, fImpresso, fEstampado]);

  const pessoasSelecionadas = parsePeople(form.quem_bateu_dtf);
  const prontoEstampar = selected?.dtf_impresso === "Sim" && selected?.dtf_cortado === "Sim" ? "Sim" : "Não";

  return (
    <div className="space-y-3">
      {selected ? (
        <>
        <OrcamentoTitle orcamento={selected.orcamento} />
        {!modeloIncluiDTF(selected.tipo_estampa) ? (
          <EmptyState>Este pedido não inclui DTF (modelo: {selected.tipo_estampa}).</EmptyState>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base sm:text-lg truncate">DTF — {selected.pedido_olist}</CardTitle>
              <div className="flex items-center gap-2">
                <RefacaoBadge pedido={selected} />
                <Badge variant="outline" className={statusColor}>
                  {form.dtf_estampado === "Sim" ? (atrasado ? "Atrasado" : "Concluído") : "Em andamento"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
            <EtapaTopoBanner pedido={selected} tab="dtf" />
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
                <ReadOnlyField label="Pedido pronto para estampar?" value={prontoEstampar} />
                <ReadOnlyField label="Início Estamparia" value={formatDateBR(selected.inicio_estamparia)} />
                <ReadOnlyField label="Término Estamparia" value={formatDateBR(selected.termino_estamparia)} />
                <ReadOnlyField label="Início Acabamento" value={formatDateBR(selected.inicio_acabamento)} />
                <ReadOnlyField label="Nº Batidas DTF" value={selected.n_batidas_dtf ?? "—"} />
              </div>

              {readOnly && (
                <div className="text-xs text-muted-foreground bg-muted/50 border rounded-md px-3 py-2">
                  Esta etapa não está disponível para edição agora (ainda não foi liberada ou já foi concluída). Visualização somente leitura.
                </div>
              )}
              {/* Edição */}
              <fieldset disabled={readOnly} className="contents disabled:opacity-60">
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
                <FormField label="Quem bateu o DTF? (múltiplos)">
                  <MultiSelectPeople
                    value={form.quem_bateu_dtf}
                    options={operadoresDTF}
                    onChange={setQuemBateu}
                    disabled={!form.dtf_data_executada}
                    placeholder={!form.dtf_data_executada ? "Preencha a data primeiro" : "Selecione..."}
                  />
                </FormField>
                <div className="sm:col-span-2 lg:col-span-4">
                  <FormField label="Observações do DTF">
                    <Textarea value={form.dtf_observacao ?? ""} onChange={(e) => set("dtf_observacao", e.target.value)} rows={2} />
                  </FormField>
                  <ObservacoesOutrosSetores pedido={selected} setorAtual="dtf" />
                </div>
              </div>

              {/* A5 — qtd por pessoa quando >1 pessoa */}
              {pessoasSelecionadas.length > 1 && (
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 pt-2">
                  {pessoasSelecionadas.map((nome) => {
                    const qtd = (form.dtf_pessoas_qtd ?? {})[nome] ?? "";
                    return (
                      <FormField key={nome} label={`Qtd peças — ${nome}`}>
                        <Input
                          type="number"
                          min="0"
                          value={qtd}
                          onChange={(e) => setPessoaQtd(nome, e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </FormField>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t">
                <div className="flex flex-wrap gap-2 sm:justify-start items-center">
                  {selected.layout_url && (
                    <Button variant="outline" size="sm" onClick={() => baixarLayout(selected.layout_url!)}>
                      <Download className="h-4 w-4 mr-1" /> Baixar layout
                    </Button>
                  )}
                  {!readOnly && <UpdateButton onClick={handleSave} disabled={saving}>Atualizar DTF</UpdateButton>}
                </div>
                {!readOnly && <VoltarDropdown pedido={selected} destinos={["dados", "arte"]} onVoltar={handleVoltar} />}
              </div>
              </fieldset>
            </CardContent>
          </Card>
        )}
        </>
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
                {ETAPA_FILTRO_OPCOES_DTF.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
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
              <SelectTrigger><SelectValue placeholder="DTF Liberado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">DTF Liberado (todos)</SelectItem>
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
                <Chip label="QTD" value={<QtdTotal pedido={p} />} />
                <StatusPecasChip pedido={p} />
                <Chip label="Pronto" value={p.dtf_impresso === "Sim" && p.dtf_cortado === "Sim" ? "Sim" : "Não"} />
                <Chip label="Estampado" value={p.dtf_estampado} />
                <Chip label="Entrega" value={formatDateBR(p.data_entrega) || "—"} />
              </PedidoMobileCard>
            ))}
          </div>

          {/* A8 — colunas: ETAPA / PEDIDO / ORÇAMENTO / VENDEDOR / QTD / ESTAMPA / STATUS PEÇAS / DTF PRONTO / DTF ESTAMPADO / INÍCIO EST / TÉRMINO EST / INÍCIO ACAB */}
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
                  <Th>DTF PRONTO</Th>
                  <Th>DTF ESTAMPADO</Th>
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
                        case "exec": return cmpDate(a.dtf_data_executada, b.dtf_data_executada, sort.dir);
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
                    const bg = linhaAtrasoClasse(p, "dtf") || rowAlertBgClass(p, feriados);
                    const pronto = p.dtf_impresso === "Sim" && p.dtf_cortado === "Sim" ? "Sim" : "Não";
                    return (
                      <tr key={p.id} onClick={() => onSelect(p.id)} className={`border-t cursor-pointer hover:bg-accent ${bg} ${selected?.id === p.id ? "bg-accent" : ""}`}>
                        <td className="px-1.5 py-0.5"><EtapaBadgeFromPedido pedido={p} /></td>
                        <td className="px-1.5 py-0.5 font-medium">{p.pedido_olist}</td>
                        <td className="px-1.5 py-0.5 !text-left">{p.orcamento}</td>
                        <td className="px-1.5 py-0.5">{p.vendedor ?? "—"}</td>
                        <td className="px-1.5 py-0.5"><QtdTotal pedido={p} /></td>
                        <td className="px-1.5 py-0.5"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                        <td className="px-1.5 py-0.5"><StatusPecasBadge pedido={p} /></td>
                        <td className="px-1.5 py-0.5">{pronto}</td>
                        <td className="px-1.5 py-0.5">{p.dtf_estampado ?? "—"}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.inicio_estamparia)}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.termino_estamparia)}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.inicio_acabamento)}</td>
                      </tr>
                    );
                  });
                })()}
                {dashboardPedidos.length === 0 && (
                  <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido DTF disponível.</td></tr>
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
