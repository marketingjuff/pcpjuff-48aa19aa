import { Fragment, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Plus, CheckCircle2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useMapData, useKgPorPeca, fmtDateBR, podeFinalizar,
  patchProducao, sumPecasEntregas,
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
  const [dlgNovo, setDlgNovo] = useState(false);

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

  const prods = producoes.data ?? [];
  const entregasAll = entregas.data ?? [];
  const progsAll = programacoes.data ?? [];

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

  // Agrupamento por data_pedido (na aba finalizados, agrupa por data_pedido também, mas ordem por finalizado_em já vem da query)
  const grupos = useMemo(() => {
    const g = new Map<string, MapProducao[]>();
    for (const p of prods) {
      const arr = g.get(p.data_pedido) ?? [];
      arr.push(p); g.set(p.data_pedido, arr);
    }
    return Array.from(g.entries()).sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
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
  const totalAguardando = prods.filter((p) => p.status === "aguardando_faturamento").length;
  const totalEntregues = prods.filter((p) => p.status === "entregue").length;

  async function commitProd(prod: MapProducao, field: keyof MapProducao, raw: string | null) {
    try {
      const patch: any = {};
      if (field === "kg_solicitados") {
        patch[field] = raw == null || raw === "" ? null : Number(raw);
      } else {
        patch[field] = raw;
      }
      // Regra: setar nota_fiscal muda status -> entregue automaticamente
      if (field === "nota_fiscal" && raw && raw.trim() !== "") {
        patch.status = "entregue";
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
      toast.success(`Prod ${prod.numero} finalizado.`);
    } catch (e: any) { toast.error(e?.message ?? "Erro."); }
  }

  async function reabrir(prod: MapProducao) {
    try {
      await patchProducao(prod.id, { finalizado: false, finalizado_em: null, finalizado_por: null } as any);
      invalidateAll();
      toast.success(`Prod ${prod.numero} reaberto.`);
    } catch (e: any) { toast.error(e?.message ?? "Erro."); }
  }

  async function excluirProd(prod: MapProducao) {
    if (!window.confirm(`Excluir Prod ${prod.numero}? Esta ação apaga também suas entregas e programações.`)) return;
    const { error } = await (supabase as any).from("map_producoes").delete().eq("id", prod.id);
    if (error) { toast.error(error.message); return; }
    invalidateAll();
    toast.success("Prod excluído.");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Prods: <b className="text-foreground tabular-nums">{totalProds}</b></span>
          {!finalizado && (
            <>
              <span>· Aguardando: <b className="text-foreground tabular-nums">{totalAguardando}</b></span>
              <span>· Entregues: <b className="text-foreground tabular-nums">{totalEntregues}</b></span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={expandAll}>Expandir tudo</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={collapseAll}>Recolher tudo</Button>
          {!finalizado && (
            <Button size="sm" className="h-7 bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => setDlgNovo(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo pedido
            </Button>
          )}
        </div>
      </div>

      {producoes.isLoading ? (
        <div className="text-sm text-muted-foreground p-4">Carregando…</div>
      ) : prods.length === 0 ? (
        <div className="text-sm text-muted-foreground p-6 text-center rounded-md border border-dashed">
          {finalizado ? "Nenhum Prod finalizado." : "Nenhum Prod. Clique em Novo pedido para começar."}
        </div>
      ) : grupos.map(([data, lista]) => (
        <div key={data} className="rounded-md border overflow-hidden">
          <div className="bg-yellow-100/70 px-2 py-1 text-[12.5px] font-semibold">
            Pedido em {fmtDateBR(data)} · {lista.length} Prod{lista.length > 1 ? "s" : ""}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-muted/40 text-[11.5px] uppercase tracking-wide text-muted-foreground">
                <tr className="text-left">
                  <th className="p-1.5 w-6"></th>
                  <th className="p-1.5">Prod</th>
                  <th className="p-1.5">Faturar</th>
                  <th className="p-1.5">Kg sol.</th>
                  <th className="p-1.5">Fornecedor</th>
                  <th className="p-1.5">Status</th>
                  <th className="p-1.5">NF</th>
                  <th className="p-1.5">Fat.</th>
                  <th className="p-1.5">Pagto.</th>
                  <th className="p-1.5 text-right"></th>
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
                        <td className="p-1 align-top">
                          <button type="button" onClick={() => toggle(prod.id)} className="p-0.5">
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                        <td className="p-1 font-semibold tabular-nums">{prod.numero}</td>
                        <td className="p-1">{prod.faturar_para}</td>
                        <td className="p-1 tabular-nums">{Number(prod.kg_solicitados).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                        <td className="p-1">{prod.fornecedor}</td>
                        <td className="p-1">
                          {prod.status === "entregue" ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Entregue</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Aguardando fat.</Badge>
                          )}
                        </td>
                        <td className="p-1 w-28">
                          <InlineInput value={prod.nota_fiscal} onCommit={(v) => commitProd(prod, "nota_fiscal", v)} disabled={finalizado} />
                        </td>
                        <td className="p-1 w-32">
                          <InlineInput type="date" value={prod.data_faturamento} onCommit={(v) => commitProd(prod, "data_faturamento", v)} disabled={finalizado} />
                        </td>
                        <td className="p-1 w-32">
                          <InlineInput type="date" value={prod.data_pagamento} onCommit={(v) => commitProd(prod, "data_pagamento", v)} disabled={finalizado} />
                        </td>
                        <td className="p-1 text-right space-x-1 whitespace-nowrap">
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

      <NovoProdDialog open={dlgNovo} onOpenChange={setDlgNovo} producoes={prods} onCreated={invalidateAll} />
    </div>
  );
}

export function ProgramacaoFiosTab() { return <MapFiosTable finalizado={false} />; }
export function FiosFinalizadosTab() { return <MapFiosTable finalizado={true} />; }
