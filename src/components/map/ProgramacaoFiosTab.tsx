import { Fragment, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInputBR } from "@/components/ui/date-input";
import { ChevronDown, ChevronRight, Plus, CheckCircle2, RotateCcw, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useMapData, useKgPorPeca, fmtDateBR, podeFinalizar, prodCode,
  patchProducao, sumPecasEntregas,
  calcStatusFio, calcStatusMalharia, calcStatusTinturaria,
  type MapProducao, type MapEntregaMalharia, type MapProgramacaoTinturaria,
} from "@/lib/map";

import { MalhariaBlock } from "./MalhariaBlock";
import { TinturariaBlock } from "./TinturariaBlock";
import { NovoProdDialog } from "./NovoProdDialog";
import { InlineInput } from "./InlineInput";

interface Props { finalizado: boolean; }

export function MapFiosTable({ finalizado }: Props) {
  const qc = useQueryClient();
  const { producoes, entregas, programacoes, invalidateAll } = useMapData(finalizado);
  const { kgPorPeca } = useKgPorPeca();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<MapProducao | null>(null);

  // Filtros
  const [fData, setFData] = useState<string>("");
  const [fEmpresa, setFEmpresa] = useState<string>("__all__");
  const [fFornecedor, setFFornecedor] = useState<string>("__all__");
  const [fNota, setFNota] = useState<string>("");
  const [fStatus, setFStatus] = useState<string>("__all__");

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`map-${finalizado ? "fin" : "prog"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "map_producoes" }, () => {
        qc.invalidateQueries({ queryKey: ["map", "producoes"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "map_malharia_entregas" }, () => {
        qc.invalidateQueries({ queryKey: ["map", "entregas"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "map_tinturaria_programacoes" }, () => {
        qc.invalidateQueries({ queryKey: ["map", "programacoes"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, finalizado]);

  const prodsAll = producoes.data ?? [];
  const entregasAll = entregas.data ?? [];
  const progsAll = programacoes.data ?? [];

  const fornecedoresOpts = useMemo(() => {
    const s = new Set<string>();
    for (const p of prodsAll) if (p.fornecedor) s.add(p.fornecedor);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [prodsAll]);

  const prods = useMemo(() => {
    const notaQ = fNota.trim().toLowerCase();
    return prodsAll.filter((p) => {
      if (fData && p.data_pedido !== fData) return false;
      if (fEmpresa !== "__all__" && p.faturar_para !== fEmpresa) return false;
      if (fFornecedor !== "__all__" && p.fornecedor !== fFornecedor) return false;
      if (notaQ && !(p.nota_fiscal ?? "").toLowerCase().includes(notaQ)) return false;
      if (!finalizado && fStatus !== "__all__" && calcStatusFio(p) !== fStatus) return false;
      return true;
    });
  }, [prodsAll, fData, fEmpresa, fFornecedor, fNota, fStatus, finalizado]);

  const byProdEntregas = useMemo(() => {
    const m = new Map<string, MapEntregaMalharia[]>();
    for (const e of entregasAll) {
      const arr = m.get(e.producao_id) ?? [];
      arr.push(e); m.set(e.producao_id, arr);
    }
    return m;
  }, [entregasAll]);
  const byProdProgs = useMemo(() => {
    const m = new Map<string, MapProgramacaoTinturaria[]>();
    for (const p of progsAll) {
      const arr = m.get(p.producao_id) ?? [];
      arr.push(p); m.set(p.producao_id, arr);
    }
    return m;
  }, [progsAll]);

  // Grupos por data_pedido — ascendente; dentro do grupo, numero ascendente
  const grupos = useMemo(() => {
    const g = new Map<string, MapProducao[]>();
    for (const p of prods) {
      const arr = g.get(p.data_pedido) ?? [];
      arr.push(p); g.set(p.data_pedido, arr);
    }
    for (const arr of g.values()) {
      arr.sort((a, b) => Number(a.numero) - Number(b.numero));
    }
    return Array.from(g.entries()).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }, [prods]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function expandAll() { setExpanded(new Set(prods.map((p) => p.id))); }
  function collapseAll() { setExpanded(new Set()); }

  const totalProds = prods.length;
  const totalAguardando = prods.filter((p) => calcStatusFio(p) === "aguardando_faturamento").length;
  const totalEntregues = prods.filter((p) => calcStatusFio(p) === "entregue").length;


  async function commitProd(prod: MapProducao, field: keyof MapProducao, raw: string | null) {
    try {
      const patch: any = {};
      if (field === "kg_solicitados") {
        patch[field] = raw == null || raw === "" ? null : Number(raw);
      } else {
        patch[field] = raw;
      }
      await patchProducao(prod.id, patch);
      invalidateAll();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
  }


  async function finalizar(prod: MapProducao) {
    const { data: u } = await supabase.auth.getUser();
    try {
      await patchProducao(prod.id, {
        finalizado: true,
        finalizado_em: new Date().toISOString(),
        finalizado_por: u.user?.id ?? null,
      } as any);
      invalidateAll();
      toast.success(`${prodCode(prod.numero)} finalizado.`);
    } catch (e: any) { toast.error(e?.message ?? "Erro."); }
  }

  async function reabrir(prod: MapProducao) {
    try {
      await patchProducao(prod.id, { finalizado: false, finalizado_em: null, finalizado_por: null } as any);
      invalidateAll();
      toast.success(`${prodCode(prod.numero)} reaberto.`);
    } catch (e: any) { toast.error(e?.message ?? "Erro."); }
  }

  async function excluirProd(prod: MapProducao) {
    if (!window.confirm(`Excluir ${prodCode(prod.numero)}? Esta ação apaga também suas entregas e programações.`)) return;
    const { error } = await (supabase as any).from("map_producoes").delete().eq("id", prod.id);
    if (error) { toast.error(error.message); return; }
    invalidateAll();
    toast.success(`${prodCode(prod.numero)} excluído.`);
  }

  function openNovo() { setEditingProd(null); setDlgOpen(true); }
  function openEditar(p: MapProducao) { setEditingProd(p); setDlgOpen(true); }

  const hasFilters =
    !!fData || fEmpresa !== "__all__" || fFornecedor !== "__all__" || !!fNota.trim() || fStatus !== "__all__";
  function limparFiltros() {
    setFData(""); setFEmpresa("__all__"); setFFornecedor("__all__"); setFNota(""); setFStatus("__all__");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-1">
          {!finalizado && (
            <Button size="sm" className="h-7 bg-yellow-500 hover:bg-yellow-600 text-white" onClick={openNovo}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo pedido
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={expandAll}>Expandir tudo</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={collapseAll}>Recolher tudo</Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Prods: <b className="text-foreground tabular-nums">{totalProds}</b></span>
          {!finalizado && (
            <>
              <span>· Aguardando: <b className="text-foreground tabular-nums">{totalAguardando}</b></span>
              <span>· Entregues: <b className="text-foreground tabular-nums">{totalEntregues}</b></span>
            </>
          )}
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-2">
        <div className="min-w-[150px]">
          <Label className="text-[11px] text-muted-foreground">Data do pedido</Label>
          <DateInputBR value={fData || null} onChange={(v) => setFData(v ?? "")} />
        </div>
        <div className="min-w-[140px]">
          <Label className="text-[11px] text-muted-foreground">Empresa</Label>
          <Select value={fEmpresa} onValueChange={setFEmpresa}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="Juff">Juff</SelectItem>
              <SelectItem value="Joke">Joke</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Label className="text-[11px] text-muted-foreground">Fornecedor</Label>
          <Select value={fFornecedor} onValueChange={setFFornecedor}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {fornecedoresOpts.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Label className="text-[11px] text-muted-foreground">Nota fiscal</Label>
          <Input className="h-9" placeholder="Contém…" value={fNota} onChange={(e) => setFNota(e.target.value)} />
        </div>
        {!finalizado && (
          <div className="min-w-[180px]">
            <Label className="text-[11px] text-muted-foreground">Status</Label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="aguardando_faturamento">Aguardando faturamento</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={limparFiltros}>
            <X className="h-3.5 w-3.5 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {producoes.isLoading ? (
        <div className="text-sm text-muted-foreground p-4">Carregando…</div>
      ) : prods.length === 0 ? (
        <div className="text-sm text-muted-foreground p-6 text-center rounded-md border border-dashed">
          {finalizado ? "Nenhum Prod finalizado." : hasFilters ? "Nenhum Prod para os filtros aplicados." : "Nenhum Prod. Clique em Novo pedido para começar."}
        </div>
      ) : grupos.map(([data, lista]) => (
        <div key={data} className="rounded-md border overflow-hidden">
          <div className="bg-yellow-100/70 px-3 py-2 text-[25px] font-semibold leading-tight">
            Pedido em {fmtDateBR(data)} · {lista.length} Prod{lista.length > 1 ? "s" : ""}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-[12.5px] table-fixed">
              <colgroup>
                <col style={{ width: "3%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>
              <thead className="bg-muted/40 text-[11.5px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-1.5 whitespace-nowrap"></th>
                  <th className="p-1.5 text-left whitespace-nowrap">Prod</th>
                  <th className="p-1.5 text-center whitespace-nowrap">Empresa</th>
                  <th className="p-1.5 text-center whitespace-nowrap">Kg solicitados</th>
                  <th className="p-1.5 text-center whitespace-nowrap">Fornecedor</th>
                  <th className="p-1.5 text-center whitespace-nowrap">Data pagamento</th>
                  <th className="p-1.5 text-center whitespace-nowrap">Status</th>
                  <th className="p-1.5 text-center whitespace-nowrap">Nota fiscal</th>
                  <th className="p-1.5 text-center whitespace-nowrap">Data faturam.</th>
                  <th className="p-1.5 text-right whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((prod) => {
                  const isOpen = expanded.has(prod.id);
                  const es = byProdEntregas.get(prod.id) ?? [];
                  const ps = byProdProgs.get(prod.id) ?? [];
                  const canFinalize = !finalizado && podeFinalizar(prod, es, ps);
                  return (
                    <Fragment key={prod.id}>
                      <tr className="border-t hover:bg-yellow-50/50">
                        <td className="p-1.5 align-top">
                          <button type="button" onClick={() => toggle(prod.id)} className="p-0.5">
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                        <td className="p-1.5 text-left font-semibold tabular-nums">{prodCode(prod.numero)}</td>
                        <td className="p-1.5 text-center">{prod.faturar_para}</td>
                        <td className="p-1.5 text-center tabular-nums">{Number(prod.kg_solicitados).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                        <td className="p-1.5 text-center">{prod.fornecedor}</td>
                        <td className="p-1.5 text-center">
                          <div className="flex justify-center">
                            <InlineInput type="date" value={prod.data_pagamento} onCommit={(v) => commitProd(prod, "data_pagamento", v)} disabled={finalizado} className="w-[140px] pr-1" />
                          </div>
                        </td>
                        <td className="p-1.5 text-center">
                          {prod.status === "entregue" ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Entregue</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Aguardando fat.</Badge>
                          )}
                        </td>
                        <td className="p-1.5 text-center">
                          <div className="flex justify-center">
                            <InlineInput value={prod.nota_fiscal} onCommit={(v) => commitProd(prod, "nota_fiscal", v)} disabled={finalizado} className="w-[110px]" />
                          </div>
                        </td>
                        <td className="p-1.5 text-center">
                          <div className="flex justify-center">
                            <InlineInput type="date" value={prod.data_faturamento} onCommit={(v) => commitProd(prod, "data_faturamento", v)} disabled={finalizado} className="w-[140px] pr-1" />
                          </div>
                        </td>
                        <td className="p-1.5 text-right space-x-1 whitespace-nowrap">
                          {finalizado ? (
                            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => reabrir(prod)}>
                              <RotateCcw className="h-3 w-3 mr-1" /> Reabrir
                            </Button>
                          ) : (
                            <>
                              {canFinalize && (
                                <Button size="sm" className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => finalizar(prod)}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Finalizar
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => openEditar(prod)}>
                                <Pencil className="h-3 w-3 mr-1" /> Editar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={() => excluirProd(prod)}>Excluir</Button>
                            </>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-t bg-yellow-50/30">
                          <td></td>
                          <td colSpan={9} className="p-2 space-y-2">
                            <MalhariaBlock
                              producao={prod}
                              entregas={es}
                              kgPorPeca={kgPorPeca}
                              onChanged={invalidateAll}
                              readOnly={finalizado}
                            />
                            <TinturariaBlock
                              producaoId={prod.id}
                              programacoes={ps}
                              pecasRecebidasMalharia={sumPecasEntregas(es)}
                              kgPorPeca={kgPorPeca}
                              onChanged={invalidateAll}
                              readOnly={finalizado}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <NovoProdDialog
        open={dlgOpen}
        onOpenChange={(v) => { setDlgOpen(v); if (!v) setEditingProd(null); }}
        producoes={prodsAll}
        producao={editingProd}
        onCreated={invalidateAll}
      />
    </div>
  );
}

export function ProgramacaoFiosTab() { return <MapFiosTable finalizado={false} />; }
export function FiosFinalizadosTab() { return <MapFiosTable finalizado={true} />; }
