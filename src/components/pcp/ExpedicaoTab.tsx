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
import { ReadOnlyField, EmptyState, FormField, PedidoMobileCard, Chip, Th, rowAlertBgClass, linhaAtrasoClasse, TH_RAW_CLASS, ETAPA_FILTRO_OPCOES, matchEtapaFiltro } from "./shared";
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
  const [sortKey, setSortKey] = useState<"saida_juff" | "data_entrega" | null>(null);
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
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    } else {
      list = [...list].sort((a, b) => (a.data_saida_juff ?? "9999-12-31").localeCompare(b.data_saida_juff ?? "9999-12-31"));
    }
    return list;
  }, [pedidos, fEtapa, fPed, fOrc, fUF, fForma, sortKey, sortAsc]);

  function toggleSort(k: "saida_juff" | "data_entrega") {
    if (sortKey !== k) { setSortKey(k); setSortAsc(true); }
    else if (sortAsc) setSortAsc(false);
    else { setSortKey(null); }
  }

  return (
    <div className="space-y-3">
      {selected && selected.expedicao_entrou_em && !selected.finalizado_em ? (
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

            <div className="border-t pt-4 grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {itensParaForma(form.forma_pagamento ?? selected.forma_pagamento).map((key) => {
                const val = form[key];
                return (
                  <FormField key={key} label={ITEM_LABEL[key]}>
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
                    {key === "exp_despachado" && form.exp_despachado === true && (
                      <div className="mt-1">
                        <div className="text-[11px] text-muted-foreground mb-0.5">Despachado em</div>
                        <DateInputBR
                          value={form.exp_despachado_em ?? ""}
                          onChange={(v) => set("exp_despachado_em", v ?? null)}
                        />
                      </div>
                    )}
                    {key === "exp_frete_solicitado" && form.exp_frete_solicitado === true && (
                      <div className="mt-1">
                        <div className="text-[11px] text-muted-foreground mb-0.5">Frete solicitado em</div>
                        <DateInputBR
                          value={form.exp_frete_solicitado_em ?? ""}
                          onChange={(v) => set("exp_frete_solicitado_em", v ?? null)}
                        />
                      </div>
                    )}
                  </FormField>
                );
              })}
              <div className="sm:col-span-2 lg:col-span-4">
                <FormField label="Observações da Expedição">
                  <Textarea
                    rows={3}
                    value={form.exp_observacoes ?? ""}
                    onChange={(e) => set("exp_observacoes", e.target.value)}
                  />
                </FormField>
                <ObservacoesOutrosSetores pedido={selected} setorAtual="expedicao" />
              </div>

            </div>

            {todosCompletos(selected, form) && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-success/10 text-success text-sm border border-success/30">
                <CheckCircle2 className="h-4 w-4" /> Todos os itens marcados como "Sim". Clique em "Finalizar Pedido" para concluir.
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSave} disabled={saving} variant="outline" className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-1" /> Atualizar Expedição
              </Button>
              <Button onClick={marcarTudoSim} disabled={saving} variant="outline" className="w-full sm:w-auto">
                Marcar tudo como "Sim"
              </Button>
              <Button
                onClick={handleFinalizar}
                disabled={saving}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Flag className="h-4 w-4 mr-1" /> Finalizar Pedido
              </Button>
              <VoltarDropdown
                destinos={["dados", "arte", "dtf", "silk", "acabamento"]}
                onVoltar={(destino) => {
                  onSave({
                    id: selected.id,
                    reaberto: true,
                    expedicao_entrou_em: null,
                    embalado: null,
                  } as any);
                  if (onNavigate) onNavigate(destino);
                }}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState>Selecione um pedido no dashboard abaixo.</EmptyState>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Dashboard — Expedição</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
            <Select value={fEtapa} onValueChange={setFEtapa}>
              <SelectTrigger><SelectValue placeholder="Etapa" /></SelectTrigger>
              <SelectContent>
                {ETAPA_FILTRO_OPCOES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
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
                <Button
                  size="sm"
                  disabled={selectedIds.size === 0 || saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    onFinalizarMany(Array.from(selectedIds));
                    setSelectedIds(new Set());
                  }}
                >
                  <Flag className="h-4 w-4 mr-1" /> Finalizar selecionados
                </Button>
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
                      onClick={(e) => { e.stopPropagation(); toggleId(p.id); }}
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
                        checked={dashboardPedidos.length > 0 && dashboardPedidos.every((p) => selectedIds.has(p.id))}
                        onCheckedChange={(v) => {
                          if (v) setSelectedIds(new Set(dashboardPedidos.map((p) => p.id)));
                          else setSelectedIds(new Set());
                        }}
                        aria-label="Selecionar todos visíveis"
                      />
                    </th>
                  )}
                  <Th>PENDÊNCIAS</Th>
                  <Th>PEDIDO</Th>
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
                          onClick={(e) => { e.stopPropagation(); toggleId(p.id); }}
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
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido na expedição.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
