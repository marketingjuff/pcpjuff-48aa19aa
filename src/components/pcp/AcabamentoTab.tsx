import { pedidoAtivoNasAreas, sortByDataSaidaJuffAsc } from "@/lib/pedidos";
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
import { ReadOnlyField, FormField, EmptyState, EtapaTopoBanner, EtapaBadgeFromPedido, StatusPecasBadge, StatusPecasChip, PedidoMobileCard, Chip, useSort, cmpDate, cmpNum, SortableTh, Th, rowAlertBgClass, linhaAtrasoClasse, ETAPA_FILTRO_OPCOES, matchEtapaFiltro } from "./shared";
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
  onNavigate?: (tab: string) => void;
}

export function AcabamentoTab({ pedidos, selected, onSelect, onSave, saving, active = true, onNavigate }: Props) {

  const [form, setForm] = useState<Partial<Pedido>>({});
  const { isDirty } = useDirtyForm();
  const { names: responsaveis } = useAppList("acabamento");
  const { feriados } = useFeriados();
  const sort = useSort<"qtd"|"saida"|"entrega">();
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
    const embalado = form.embalado ?? null;
    const payload: any = {
      id: selected.id,
      embalado,
      responsavel_acabamento: form.responsavel_acabamento ?? null,
      responsavel_conferencia: form.responsavel_conferencia ?? null,
      data_saida_juff: form.data_saida_juff ?? null,
      observacoes_pedido: form.observacoes_pedido ?? null,
    };
    // 3A: ao marcar EMBALADO=Sim, envia automaticamente para Expedição.
    if (embalado === "Sim" && !selected.expedicao_entrou_em) {
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
  const [fEtapa, setFEtapa] = useState("ativas");

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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base sm:text-lg truncate">Acabamento — {selected.pedido_olist}</CardTitle>
            <Badge variant="outline" className={status.color}>{status.label}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <EtapaTopoBanner pedido={selected} tab="acabamento" />
            {podeFinalizar && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-success/10 text-success text-sm border border-success/30">
                <CheckCircle2 className="h-4 w-4" /> Pronto para Expedição. Clique em "Enviar para Expedição" abaixo.
              </div>
            )}
            {selected.status_pecas !== "completo" && selected.arte_data && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/30">
                <CheckCircle2 className="h-4 w-4" /> <span className="font-semibold">Pedido Incompleto</span> — Status de Peças ainda está "incompleto".
              </div>
            )}

            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <ReadOnlyField label="Pedido" value={selected.pedido_olist} />
              <ReadOnlyField label="Orçamento" value={selected.orcamento} />
              <ReadOnlyField label="Tipo de Estampa" value={selected.tipo_estampa} />
              <ReadOnlyField label="Status de Peças" value={selected.status_pecas} />
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
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 pt-3 border-t">
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
              <div className="sm:col-span-2 lg:col-span-4">
                <FormField label="Observações do Acabamento">
                  <Textarea value={form.observacoes_pedido ?? ""} onChange={(e) => set("observacoes_pedido", e.target.value)} rows={3} />
                </FormField>
                <ObservacoesOutrosSetores pedido={selected} setorAtual="acabamento" />
              </div>

            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-1" />
                {enviadoParaExpedicao ? "Atualizar Acabamento" : "Atualizar"}
              </Button>
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
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState>Selecione um pedido no dashboard abaixo.</EmptyState>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Dashboard — Acabamento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
            <Select value={fEtapa} onValueChange={setFEtapa}>
              <SelectTrigger><SelectValue placeholder="Etapa" /></SelectTrigger>
              <SelectContent>
                {ETAPA_FILTRO_OPCOES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
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
          <div className="md:hidden rounded-md border divide-y">
            {dashboardPedidos.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido pronto para acabamento.</div>
            ) : dashboardPedidos.map((p) => (
              <PedidoMobileCard key={p.id} pedido={p} active={selected?.id === p.id} onClick={() => onSelect(p.id)}>
                <Chip label="Tipo" value={p.tipo_estampa} />
                <Chip label="QTD" value={p.qtd} />
                <StatusPecasChip pedido={p} />
                <Chip label="DTF" value={modeloIncluiDTF(p.tipo_estampa) ? (p.dtf_estampado ?? "—") : "N/A"} />
                <Chip label="Silk" value={modeloIncluiSilk(p.tipo_estampa) ? (p.silk_feito ?? "—") : "N/A"} />
                <Chip label="Embalado" value={p.embalado} />
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
                  <Th>DTF EST.</Th>
                  <Th>SILK EST.</Th>
                  <Th>EMBALADO</Th>
                  <Th>RESPONSÁVEL</Th>
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
                        case "saida": return cmpDate(a.saida_juff, b.saida_juff, sort.dir);
                        case "entrega": return cmpDate(a.data_entrega, b.data_entrega, sort.dir);
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
                        <td className="px-1.5 py-0.5 text-left">{p.orcamento}</td>
                        <td className="px-1.5 py-0.5"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                        <td className="px-1.5 py-0.5">{p.qtd ?? "—"}</td>
                        <td className="px-1.5 py-0.5"><StatusPecasBadge pedido={p} /></td>
                        <td className="px-1.5 py-0.5">{modeloIncluiDTF(p.tipo_estampa) ? (p.dtf_estampado ?? "—") : "N/A"}</td>
                        <td className="px-1.5 py-0.5">{modeloIncluiSilk(p.tipo_estampa) ? (p.silk_feito ?? "—") : "N/A"}</td>
                        <td className="px-1.5 py-0.5">{p.embalado ?? "—"}</td>
                        <td className="px-1.5 py-0.5">{p.responsavel_acabamento ?? "—"}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.saida_juff)}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.data_entrega)}</td>
                      </tr>
                    );
                  });
                })()}
                {dashboardPedidos.length === 0 && (
                  <tr><td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido pronto para acabamento.</td></tr>
                )}


              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
