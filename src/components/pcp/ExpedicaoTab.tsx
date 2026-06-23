import { useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { useAppList } from "@/lib/app-lists";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, CheckCircle2, ArrowUp, ArrowDown, ArrowUpDown, Flag } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ReadOnlyField, EmptyState, FormField, PedidoMobileCard, Chip, Th, rowAlertBgClass, linhaAtrasoClasse, TH_RAW_CLASS, ETAPA_FILTRO_OPCOES_EXPEDICAO, matchEtapaFiltro, UpdateButton, FinalizarButton, OrcamentoTitle } from "./shared";
import { ObservacoesOutrosSetores } from "./ObservacoesOutrosSetores";
import { VoltarDropdown } from "./VoltarDropdown";
import { DateInputBR } from "@/components/ui/date-input";

import { formatDateBR } from "@/lib/format";
import { useFeriados } from "@/hooks/use-feriados";

interface Props {
  pedidos: Pedido[];
  selected: Pedido | null;
  onSelect: (id: string | null) => void;
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  saving: boolean;
  onNavigate?: (tab: string) => void;
  onFinalizarMany?: (ids: string[]) => void;
}

type ItemKey =
  | "exp_cobranca_pagamento"
  | "exp_pagamento"
  | "exp_etiqueta"
  | "exp_frete_solicitado"
  | "exp_despachado";

const ITEM_LABEL: Record<ItemKey, string> = {
  exp_cobranca_pagamento: "Cobrança do pagamento",
  exp_pagamento: "Pagamento",
  exp_etiqueta: "Etiqueta",
  exp_frete_solicitado: "Frete Solicitado",
  exp_despachado: "Despachado",
};

function itensParaForma(forma: string | null | undefined): ItemKey[] {
  if (forma === "50%/50%") {
    return ["exp_cobranca_pagamento", "exp_pagamento", "exp_etiqueta", "exp_frete_solicitado", "exp_despachado"];
  }
  return ["exp_etiqueta", "exp_frete_solicitado", "exp_despachado"];
}

function pendenciasDoPedido(p: Pedido): string[] {
  const itens = itensParaForma(p.forma_pagamento);
  return itens.filter((k) => p[k] !== true).map((k) => ITEM_LABEL[k]);
}

function todosCompletos(p: Pedido, form: Partial<Pedido>): boolean {
  const itens = itensParaForma(form.forma_pagamento ?? p.forma_pagamento);
  return itens.every((k) => {
    const v = form[k] !== undefined ? form[k] : p[k];
    return v === true;
  });
}

export function ExpedicaoTab({ pedidos, selected, onSelect, onSave, saving, onNavigate, onFinalizarMany }: Props) {
  const { feriados } = useFeriados();
  const { names: formasPagamento } = useAppList("pagamento");
  const expedicaoPedidos = useMemo(
    () => pedidos.filter((p) => p.expedicao_entrou_em && !p.finalizado_em),
    [pedidos],
  );

  const [form, setForm] = useState<Partial<Pedido>>({});
  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  useMemo(() => { setForm(selected ?? {}); }, [selected]);

  function toggleItem(key: ItemKey, val: boolean) {
    setForm((f) => {
      const next: any = { ...f, [key]: val };
      const hoje = new Date().toISOString().slice(0, 10);
      if (key === "exp_despachado") {
        next.exp_despachado_em = val ? (f.exp_despachado_em ?? hoje) : null;
      }
      if (key === "exp_frete_solicitado") {
        next.exp_frete_solicitado_em = val ? (f.exp_frete_solicitado_em ?? hoje) : null;
      }
      return next;
    });
  }

  function handleSave() {
    if (!selected) return;
    // 3B: Salvar não finaliza mais o pedido — apenas atualiza os campos da Expedição.
    onSave({
      id: selected.id,
      exp_cobranca_pagamento: form.exp_cobranca_pagamento ?? null,
      exp_pagamento: form.exp_pagamento ?? null,
      exp_etiqueta: form.exp_etiqueta ?? null,
      exp_frete_solicitado: form.exp_frete_solicitado ?? null,
      exp_despachado: form.exp_despachado ?? null,
      exp_despachado_em: form.exp_despachado_em ?? null,
      exp_frete_solicitado_em: form.exp_frete_solicitado_em ?? null,
      exp_observacoes: form.exp_observacoes ?? null,
    });
  }

  function handleFinalizar() {
    if (!selected) return;
    onSave({
      id: selected.id,
      exp_cobranca_pagamento: form.exp_cobranca_pagamento ?? null,
      exp_pagamento: form.exp_pagamento ?? null,
      exp_etiqueta: form.exp_etiqueta ?? null,
      exp_frete_solicitado: form.exp_frete_solicitado ?? null,
      exp_despachado: form.exp_despachado ?? null,
      exp_despachado_em: form.exp_despachado_em ?? null,
      exp_frete_solicitado_em: form.exp_frete_solicitado_em ?? null,
      exp_observacoes: form.exp_observacoes ?? null,
      finalizado_em: new Date().toISOString(),
      reaberto: false,
    });
  }

  function marcarTudoSim() {
    if (!selected) return;
    const itens = itensParaForma(form.forma_pagamento ?? selected.forma_pagamento);
    const upd: any = { ...form };
    const hoje = new Date().toISOString().slice(0, 10);
    itens.forEach((k) => { upd[k] = true; });
    upd.exp_despachado_em = upd.exp_despachado_em ?? hoje;
    upd.exp_frete_solicitado_em = upd.exp_frete_solicitado_em ?? hoje;
    setForm(upd);
  }

  // Dashboard
  const [sortKey, setSortKey] = useState<"pedido" | "saida_juff" | "data_entrega" | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [fPed, setFPed] = useState("");
  const [fOrc, setFOrc] = useState("");
  const [fUF, setFUF] = useState("");
  const [fForma, setFForma] = useState("todos");
  const [fEtapa, setFEtapa] = useState("expedicao");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const dashboardPedidos = useMemo(() => {
    let list = pedidos.filter((p) => {
      if (!matchEtapaFiltro(p, fEtapa)) return false;
      if (fPed && !String(p.pedido_olist ?? "").toLowerCase().includes(fPed.toLowerCase())) return false;
      if (fOrc && !String(p.orcamento ?? "").toLowerCase().includes(fOrc.toLowerCase())) return false;
      if (fUF && (p.uf_entrega ?? "").toUpperCase() !== fUF.toUpperCase()) return false;
      if (fForma !== "todos" && (p.forma_pagamento ?? "") !== fForma) return false;
      return true;
    });
    if (sortKey === "pedido") {
      list = [...list].sort((a, b) => {
        const na = Number(a.pedido_olist);
        const nb = Number(b.pedido_olist);
        const aBad = !Number.isFinite(na);
        const bBad = !Number.isFinite(nb);
        if (aBad && bBad) return 0;
        if (aBad) return 1;
        if (bBad) return -1;
        return sortAsc ? na - nb : nb - na;
      });
    } else if (sortKey) {
      list = [...list].sort((a, b) => {
        const av = (a as any)[sortKey] ?? "";
        const bv = (b as any)[sortKey] ?? "";
        return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    } else {
      list = [...list].sort((a, b) => (a.data_saida_juff ?? "9999-12-31").localeCompare(b.data_saida_juff ?? "9999-12-31"));
    }
    return list;
  }, [pedidos, fEtapa, fPed, fOrc, fUF, fForma, sortKey, sortAsc]);

  function toggleSort(k: "pedido" | "saida_juff" | "data_entrega") {
    if (sortKey !== k) { setSortKey(k); setSortAsc(true); }
    else if (sortAsc) setSortAsc(false);
    else { setSortKey(null); }
  }

  return (
    <div className="space-y-3">
      {selected && selected.expedicao_entrou_em && !selected.finalizado_em ? (
        <>
        <OrcamentoTitle orcamento={selected.orcamento} />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base sm:text-lg truncate">Expedição — {selected.pedido_olist}</CardTitle>
            <Badge variant="outline" className="bg-pink-500/15 text-pink-700 border-pink-500/30 dark:text-pink-300">
              Expedição
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <ReadOnlyField label="Pedido" value={selected.pedido_olist} />
              <ReadOnlyField label="Orçamento" value={selected.orcamento} />
              <ReadOnlyField label="Frete" value={selected.frete ?? "—"} />
              <ReadOnlyField label="UF" value={selected.uf_entrega ?? "—"} />
              <ReadOnlyField label="Data da entrega" value={formatDateBR(selected.data_entrega)} />
              <ReadOnlyField label="Saída Juff" value={formatDateBR(selected.saida_juff)} />
              <ReadOnlyField label="Forma de pagamento" value={selected.forma_pagamento ?? "—"} />
              <ReadOnlyField label="Nota Fiscal" value={selected.nf_emitida ?? "—"} />
            </div>

            {(() => {
              const itens = itensParaForma(form.forma_pagamento ?? selected.forma_pagamento);
              const simples: ItemKey[] = (["exp_cobranca_pagamento", "exp_pagamento", "exp_etiqueta"] as ItemKey[]).filter((k) => itens.includes(k));
              const comData: ItemKey[] = (["exp_frete_solicitado", "exp_despachado"] as ItemKey[]).filter((k) => itens.includes(k));
              const renderStatus = (key: ItemKey) => {
                const val = form[key];
                return (
                  <Select
                    value={val === true ? "Sim" : val === false ? "Não" : ""}
                    onValueChange={(v) => toggleItem(key, v === "Sim")}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sim">Sim</SelectItem>
                      <SelectItem value="Não">Não</SelectItem>
                    </SelectContent>
                  </Select>
                );
              };
              return (
                <>
                  {simples.length > 0 && (
                    <div className="border-t pt-4 grid gap-2 grid-cols-1 sm:grid-cols-3">
                      {simples.map((key) => (
                        <FormField key={key} label={ITEM_LABEL[key]}>
                          {renderStatus(key)}
                        </FormField>
                      ))}
                    </div>
                  )}
                  {comData.length > 0 && (
                    <div className={`grid gap-3 grid-cols-1 sm:grid-cols-2 ${simples.length === 0 ? "border-t pt-4" : ""}`}>
                      {comData.map((key) => {
                        const dateKey = (key === "exp_despachado" ? "exp_despachado_em" : "exp_frete_solicitado_em") as "exp_despachado_em" | "exp_frete_solicitado_em";
                        const dateLabel = key === "exp_despachado" ? "Despachado em" : "Frete solicitado em";
                        return (
                          <div key={key} className="grid grid-cols-2 gap-2">
                            <FormField label={ITEM_LABEL[key]}>
                              {renderStatus(key)}
                            </FormField>
                            <FormField label={dateLabel}>
                              <DateInputBR
                                value={(form[dateKey] as string | null | undefined) ?? ""}
                                onChange={(v) => set(dateKey, v ?? null)}
                              />
                            </FormField>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div>
                    <FormField label="Observações da Expedição">
                      <Textarea
                        rows={3}
                        value={form.exp_observacoes ?? ""}
                        onChange={(e) => set("exp_observacoes", e.target.value)}
                      />
                    </FormField>
                    <ObservacoesOutrosSetores pedido={selected} setorAtual="expedicao" />
                  </div>
                </>
              );
            })()}

            {todosCompletos(selected, form) && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-success/10 text-success text-sm border border-success/30">
                <CheckCircle2 className="h-4 w-4" /> Todos os itens marcados como "Sim". Clique em "Finalizar Pedido" para concluir.
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex gap-2 flex-wrap sm:justify-start">
                <Button onClick={marcarTudoSim} disabled={saving} variant="outline" className="w-full sm:w-auto">
                  Marcar tudo como "Sim"
                </Button>
                <UpdateButton onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                  Atualizar Expedição
                </UpdateButton>
                <RefacaoViewerButton pedido={selected} />
                <FinalizarButton
                  onClick={handleFinalizar}
                  disabled={saving || !todosCompletos(selected, form)}
                  title={!todosCompletos(selected, form) ? "Finalize todas as pendências da expedição antes de concluir o pedido" : undefined}
                  className="w-full sm:w-auto"
                >
                  Finalizar Pedido
                </FinalizarButton>
              </div>
              <VoltarDropdown
                pedido={selected}
                destinos={["dados", "arte", "dtf", "silk", "acabamento"]}
                onVoltar={async (destino, payload) => {
                  const { montarRefacoesAposRefazer, camposAlimpar } = await import("./refacao-helpers");
                  const { refacoes } = await montarRefacoesAposRefazer(selected, destino, payload);
                  onSave({
                    id: selected.id,
                    refacoes,
                    ...camposAlimpar(selected, destino),
                  } as any);
                  if (onNavigate) onNavigate(destino);
                }}

              />
            </div>
          </CardContent>
        </Card>
        </>
      ) : (
        <EmptyState>Selecione um pedido no dashboard abaixo.</EmptyState>
      )}

      <Card>
        <CardHeader className="pb-2"><div className="flex items-baseline justify-between gap-2"><CardTitle className="text-base">Dashboard — Expedição</CardTitle><span className="text-xs text-muted-foreground tabular-nums">{dashboardPedidos.length} {dashboardPedidos.length === 1 ? "registro" : "registros"}</span></div></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
            <Select value={fEtapa} onValueChange={setFEtapa}>
              <SelectTrigger><SelectValue placeholder="Etapa" /></SelectTrigger>
              <SelectContent>
                {ETAPA_FILTRO_OPCOES_EXPEDICAO.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Pedido" value={fPed} onChange={(e) => setFPed(e.target.value)} />
            <Input placeholder="Orçamento" value={fOrc} onChange={(e) => setFOrc(e.target.value)} />
            <Input placeholder="UF" value={fUF} onChange={(e) => setFUF(e.target.value)} />
            <Select value={fForma} onValueChange={setFForma}>
              <SelectTrigger><SelectValue placeholder="Forma de pagamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as formas</SelectItem>
                {formasPagamento.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Barra de ações em lote */}
          {onFinalizarMany && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2">
              <div className="text-xs text-muted-foreground">
                {selectedIds.size === 0
                  ? "Selecione pedidos sem pendências para finalizar em lote."
                  : `${selectedIds.size} pedido${selectedIds.size > 1 ? "s" : ""} selecionado${selectedIds.size > 1 ? "s" : ""}.`}
              </div>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
                    Limpar seleção
                  </Button>
                )}
                <FinalizarButton
                  size="sm"
                  disabled={selectedIds.size === 0 || saving}
                  onClick={() => {
                    onFinalizarMany(Array.from(selectedIds));
                    setSelectedIds(new Set());
                  }}
                >
                  Finalizar selecionados
                </FinalizarButton>
              </div>
            </div>
          )}

          {/* Mobile cards */}
          <div className="md:hidden rounded-md border divide-y">
            {dashboardPedidos.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido na expedição.</div>
            ) : dashboardPedidos.map((p) => {
              const pend = pendenciasDoPedido(p);
              return (
                <div key={p.id} className="relative">
                  {onFinalizarMany && (
                    <div
                      className="absolute top-2 left-2 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleId(p.id)} />
                    </div>
                  )}
                  <PedidoMobileCard pedido={p} active={selected?.id === p.id} onClick={() => onSelect(p.id)}>
                    <Chip label="UF" value={p.uf_entrega} />
                    <Chip label="Pgto" value={p.forma_pagamento} />
                    <Chip label="Saída" value={formatDateBR(p.saida_juff) || "—"} />
                    <Chip label="Entrega" value={formatDateBR(p.data_entrega) || "—"} />
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${pend.length === 0 ? "text-success border-success/40" : "text-warning-foreground border-warning/40 bg-warning/15"}`}>
                      {pend.length === 0 ? "Sem pendências" : `${pend.length} pendência${pend.length > 1 ? "s" : ""}`}
                    </span>
                  </PedidoMobileCard>
                </div>
              );
            })}
          </div>
          <div className="hidden md:block rounded-lg border border-border/60 bg-card overflow-x-auto shadow-xs [&_th]:text-center [&_td]:text-center">
            <table className="w-full text-sm" style={{ fontFamily: '"Google Sans Flex", Arial, sans-serif', fontStretch: 'condensed' }}>
              <thead>
                <tr>
                  {onFinalizarMany && (
                    <th className={`${TH_RAW_CLASS} w-8`}>
                      <Checkbox
                        checked={
                          dashboardPedidos.length > 0 && dashboardPedidos.every((p) => selectedIds.has(p.id))
                            ? true
                            : dashboardPedidos.some((p) => selectedIds.has(p.id))
                            ? "indeterminate"
                            : false
                        }
                        onCheckedChange={(v) => {
                          if (v) setSelectedIds(new Set(dashboardPedidos.map((p) => p.id)));
                          else setSelectedIds(new Set());
                        }}
                        aria-label="Selecionar todos visíveis"
                      />
                    </th>
                  )}
                  <Th>PENDÊNCIAS</Th>
                  <th className={`${TH_RAW_CLASS} cursor-pointer select-none`} onClick={() => toggleSort("pedido")}>
                    <span className="inline-flex items-center gap-1">
                      PEDIDO
                      {sortKey === "pedido"
                        ? (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                        : <ArrowUpDown className="h-3 w-3 opacity-50" />}
                    </span>
                  </th>
                  <Th>ORÇAMENTO</Th>
                  <Th>UF</Th>
                  <th className={`${TH_RAW_CLASS} cursor-pointer select-none`} onClick={() => toggleSort("saida_juff")}>
                    <span className="inline-flex items-center gap-1">
                      SAÍDA JUFF
                      {sortKey === "saida_juff"
                        ? (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                        : <ArrowUpDown className="h-3 w-3 opacity-50" />}
                    </span>
                  </th>
                  <th className={`${TH_RAW_CLASS} cursor-pointer select-none`} onClick={() => toggleSort("data_entrega")}>
                    <span className="inline-flex items-center gap-1">
                      ENTREGA
                      {sortKey === "data_entrega"
                        ? (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                        : <ArrowUpDown className="h-3 w-3 opacity-50" />}
                    </span>
                  </th>
                  <Th>FORMA DE PAGAMENTO</Th>
                </tr>
              </thead>
              <tbody>
                {dashboardPedidos.map((p) => {
                  const pend = pendenciasDoPedido(p);
                  const bg = linhaAtrasoClasse(p, "expedicao") || rowAlertBgClass(p, feriados);
                  return (
                    <tr key={p.id}
                      onClick={() => onSelect(p.id)}
                      className={`border-t cursor-pointer hover:bg-accent ${bg} ${selected?.id === p.id ? "bg-accent" : ""}`}>
                      {onFinalizarMany && (
                        <td
                          className="px-1.5 py-0.5 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleId(p.id)} />
                        </td>
                      )}
                      <td className="px-1.5 py-0.5 text-xs">
                        {pend.length === 0
                          ? <span className="text-success">Sem pendências</span>
                          : <span className="text-warning-foreground">{pend.join(", ")}</span>}
                      </td>
                      <td className="px-1.5 py-0.5 font-medium">{p.pedido_olist}</td>
                      <td className="px-1.5 py-0.5 !text-left">{p.orcamento}</td>
                      <td className="px-1.5 py-0.5">{p.uf_entrega ?? "—"}</td>
                      <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.saida_juff)}</td>
                      <td className="px-1.5 py-0.5 whitespace-nowrap">{formatDateBR(p.data_entrega)}</td>
                      <td className="px-1.5 py-0.5">{p.forma_pagamento ?? "—"}</td>
                    </tr>
                  );
                })}
                {dashboardPedidos.length === 0 && (
                  <tr><td colSpan={onFinalizarMany ? 8 : 7} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido na expedição.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
