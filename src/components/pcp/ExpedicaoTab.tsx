import { useMemo, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, CheckCircle2, ArrowUp, ArrowDown } from "lucide-react";
import { ReadOnlyField, EmptyState, FormField, PedidoMobileCard, Chip } from "./shared";
import { formatDateBR } from "@/lib/format";

interface Props {
  pedidos: Pedido[];
  selected: Pedido | null;
  onSelect: (id: string | null) => void;
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  saving: boolean;
}

type ItemKey =
  | "exp_cobranca_pagamento"
  | "exp_pagamento"
  | "nf_emitida"
  | "exp_etiqueta"
  | "exp_frete_solicitado"
  | "exp_despachado";

const ITEM_LABEL: Record<ItemKey, string> = {
  exp_cobranca_pagamento: "Cobrança do pagamento",
  exp_pagamento: "Pagamento",
  nf_emitida: "Nota Fiscal Emitida",
  exp_etiqueta: "Etiqueta",
  exp_frete_solicitado: "Frete Solicitado",
  exp_despachado: "Despachado",
};

function itensParaForma(forma: string | null | undefined): ItemKey[] {
  if (forma === "50%/50%") {
    return ["exp_cobranca_pagamento", "exp_pagamento", "nf_emitida", "exp_etiqueta", "exp_frete_solicitado", "exp_despachado"];
  }
  // Cartão, À vista, Boleto OU forma vazia
  return ["nf_emitida", "exp_etiqueta", "exp_frete_solicitado", "exp_despachado"];
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

export function ExpedicaoTab({ pedidos, selected, onSelect, onSave, saving }: Props) {
  const expedicaoPedidos = useMemo(
    () => pedidos.filter((p) => p.expedicao_entrou_em && !p.finalizado_em),
    [pedidos],
  );

  const [form, setForm] = useState<Partial<Pedido>>({});
  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  // Carrega form quando selected muda
  useMemo(() => { setForm(selected ?? {}); }, [selected]);

  function toggleItem(key: ItemKey, val: boolean) {
    setForm((f) => {
      const next: any = { ...f, [key]: val };
      if (key === "exp_despachado") {
        next.exp_despachado_em = val ? new Date().toISOString().slice(0, 10) : null;
      }
      return next;
    });
  }

  function handleSave() {
    if (!selected) return;
    const payload: any = {
      id: selected.id,
      exp_cobranca_pagamento: form.exp_cobranca_pagamento ?? null,
      exp_pagamento: form.exp_pagamento ?? null,
      nf_emitida: form.nf_emitida ?? null,
      exp_etiqueta: form.exp_etiqueta ?? null,
      exp_frete_solicitado: form.exp_frete_solicitado ?? null,
      exp_despachado: form.exp_despachado ?? null,
      exp_despachado_em: form.exp_despachado_em ?? null,
      exp_observacoes: form.exp_observacoes ?? null,
    };
    // Se tudo completo, finaliza (data de finalização = agora)
    if (todosCompletos(selected, form)) {
      payload.finalizado_em = new Date().toISOString();
    }
    onSave(payload);
  }

  function marcarTudoSim() {
    if (!selected) return;
    const itens = itensParaForma(form.forma_pagamento ?? selected.forma_pagamento);
    const upd: any = { ...form };
    itens.forEach((k) => { upd[k] = true; });
    upd.exp_despachado_em = upd.exp_despachado_em ?? new Date().toISOString().slice(0, 10);
    setForm(upd);
  }

  // Dashboard
  const [sortKey, setSortKey] = useState<"saida_juff" | "data_entrega" | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [fPed, setFPed] = useState("");
  const [fOrc, setFOrc] = useState("");
  const [fUF, setFUF] = useState("");
  const [fForma, setFForma] = useState("todos");

  const dashboardPedidos = useMemo(() => {
    let list = expedicaoPedidos.filter((p) => {
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
  }, [expedicaoPedidos, fPed, fOrc, fUF, fForma, sortKey, sortAsc]);

  function toggleSort(k: "saida_juff" | "data_entrega") {
    if (sortKey !== k) { setSortKey(k); setSortAsc(true); }
    else if (sortAsc) setSortAsc(false);
    else { setSortKey(null); }
  }

  return (
    <div className="space-y-6">
      {selected && selected.expedicao_entrou_em && !selected.finalizado_em ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base sm:text-lg truncate">Expedição — {selected.pedido_olist}</CardTitle>
            <Badge variant="outline" className="bg-pink-500/15 text-pink-700 border-pink-500/30 dark:text-pink-300">
              Expedição
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
              <ReadOnlyField label="Pedido" value={selected.pedido_olist} />
              <ReadOnlyField label="Orçamento" value={selected.orcamento} />
              <ReadOnlyField label="Frete" value={selected.frete ?? "—"} />
              <ReadOnlyField label="UF" value={selected.uf_entrega ?? "—"} />
              <ReadOnlyField label="Data da entrega" value={formatDateBR(selected.data_entrega)} />
              <ReadOnlyField label="Saída Juff" value={formatDateBR(selected.saida_juff)} />
              <ReadOnlyField label="Forma de pagamento" value={selected.forma_pagamento ?? "—"} />
              <ReadOnlyField label="NF Emitida (espelho)" value={form.nf_emitida === true ? "Sim" : form.nf_emitida === false ? "Não" : "—"} />
            </div>

            <div className="border-t pt-4 grid gap-4 grid-cols-1 sm:grid-cols-2">
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
                      <div className="text-xs text-muted-foreground mt-1">
                        Despachado em: {formatDateBR(form.exp_despachado_em)}
                      </div>
                    )}
                  </FormField>
                );
              })}
              <div className="sm:col-span-2">
                <FormField label="Observações da Expedição">
                  <Textarea
                    rows={3}
                    value={form.exp_observacoes ?? ""}
                    onChange={(e) => set("exp_observacoes", e.target.value)}
                  />
                </FormField>
              </div>
            </div>

            {todosCompletos(selected, form) && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-success/10 text-success text-sm border border-success/30">
                <CheckCircle2 className="h-4 w-4" /> Ao salvar, este pedido será finalizado.
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-1" /> Atualizar Expedição
              </Button>
              <Button variant="outline" onClick={marcarTudoSim} disabled={saving} className="w-full sm:w-auto">
                Marcar tudo como "Sim"
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState>Selecione um pedido no dashboard abaixo.</EmptyState>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Dashboard — Expedição</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            <Input placeholder="Pedido" value={fPed} onChange={(e) => setFPed(e.target.value)} />
            <Input placeholder="Orçamento" value={fOrc} onChange={(e) => setFOrc(e.target.value)} />
            <Input placeholder="UF" value={fUF} onChange={(e) => setFUF(e.target.value)} />
            <Select value={fForma} onValueChange={setFForma}>
              <SelectTrigger><SelectValue placeholder="Forma de pagamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as formas</SelectItem>
                <SelectItem value="Cartão de crédito">Cartão de crédito</SelectItem>
                <SelectItem value="50%/50%">50%/50%</SelectItem>
                <SelectItem value="Boleto">Boleto</SelectItem>
                <SelectItem value="À vista">À vista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden rounded-md border divide-y">
            {dashboardPedidos.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido na expedição.</div>
            ) : dashboardPedidos.map((p) => {
              const pend = pendenciasDoPedido(p);
              return (
                <PedidoMobileCard key={p.id} pedido={p} active={selected?.id === p.id} onClick={() => onSelect(p.id)}>
                  <Chip label="UF" value={p.uf_entrega} />
                  <Chip label="Pgto" value={p.forma_pagamento} />
                  <Chip label="Saída" value={formatDateBR(p.saida_juff) || "—"} />
                  <Chip label="Entrega" value={formatDateBR(p.data_entrega) || "—"} />
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${pend.length === 0 ? "text-success border-success/40" : "text-warning-foreground border-warning/40 bg-warning/15"}`}>
                    {pend.length === 0 ? "Sem pendências" : `${pend.length} pendência${pend.length > 1 ? "s" : ""}`}
                  </span>
                </PedidoMobileCard>
              );
            })}
          </div>
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Pendências</th>
                  <th className="px-3 py-2 text-left">Pedido</th>
                  <th className="px-3 py-2 text-left">Orçamento</th>
                  <th className="px-3 py-2 text-left">UF</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">
                    <button onClick={() => toggleSort("saida_juff")} className="inline-flex items-center gap-1 hover:underline">
                      Saída Juff
                      {sortKey === "saida_juff" && (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">
                    <button onClick={() => toggleSort("data_entrega")} className="inline-flex items-center gap-1 hover:underline">
                      Data da entrega
                      {sortKey === "data_entrega" && (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">Forma de pagamento</th>
                </tr>
              </thead>
              <tbody>
                {dashboardPedidos.map((p) => {
                  const pend = pendenciasDoPedido(p);
                  return (
                    <tr key={p.id}
                      onClick={() => onSelect(p.id)}
                      className={`border-t cursor-pointer hover:bg-accent ${selected?.id === p.id ? "bg-accent" : ""}`}>
                      <td className="px-3 py-2 text-xs">
                        {pend.length === 0
                          ? <span className="text-success">Sem pendências</span>
                          : <span className="text-warning-foreground">{pend.join(", ")}</span>}
                      </td>
                      <td className="px-3 py-2 font-medium">{p.pedido_olist}</td>
                      <td className="px-3 py-2">{p.orcamento}</td>
                      <td className="px-3 py-2">{p.uf_entrega ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.saida_juff)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.data_entrega)}</td>
                      <td className="px-3 py-2">{p.forma_pagamento ?? "—"}</td>
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
