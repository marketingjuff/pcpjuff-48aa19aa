import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Check, X, Trash2, AlertTriangle, Undo2, ArrowLeft, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { Cop, CopPeca, Oficina, CopPerdaLinha } from "@/lib/cop";
import {
  rotuloCop, formatCopNumero, totalPecasCop, getRecebida,
} from "@/lib/cop";
import { useCopColorSettings } from "@/hooks/use-cop-color-settings";
import { useIsAdmin, useHasRole, useCanAccessCop } from "@/hooks/use-role";
import { useFeriados } from "@/hooks/use-feriados";
import { addDiasUteis } from "@/lib/dias-uteis";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { PagamentoConsolidadoCard } from "@/components/cop/PagamentoConsolidadoCard";
import { HistoricoPagamentosConsolidados } from "@/components/cop/HistoricoPagamentosConsolidados";

function fmtMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Soma por (modelo, cor) das quantidades pagáveis = Σ_tamanho max(0, recebido − perda). */
function calcQtdPagavelPorModeloCor(cop: Cop): Map<string, number> {
  const out = new Map<string, number>();
  const perdas = (cop.perdas as CopPerdaLinha[]) ?? [];
  const recv = cop.pecas_recebidas ?? [];
  const linhas = (cop.pecas ?? []) as CopPeca[];
  for (const p of linhas) {
    const r = getRecebida(recv, p.modelo, p.cor, p.tamanho);
    const pl = perdas.find((x) => x.modelo === p.modelo && x.cor === p.cor && x.tamanho === p.tamanho);
    const perd = Number(pl?.qtd ?? 0);
    const q = Math.max(0, r - perd);
    if (q <= 0) continue;
    const k = `${p.modelo}|${p.cor}`;
    out.set(k, (out.get(k) ?? 0) + q);
  }
  return out;
}

function calcValor(cop: Cop, oficina: Oficina | null): number {
  if (!oficina) return 0;
  const grupos = calcQtdPagavelPorModeloCor(cop);
  let pecas = 0;
  for (const [k, q] of grupos) {
    const modelo = k.split("|")[0];
    const v = Number((oficina.valores_por_modelo ?? {})[modelo] ?? 0);
    pecas += v * q;
  }
  const fretes = Number(oficina.valor_frete ?? 0) * Math.max(0, Math.floor(Number(cop.num_fretes) || 0));
  return Math.max(0, pecas + fretes);
}

export function isPagamentoAtrasado(cop: Cop, feriados: Set<string>): boolean {
  if (cop.pagamento_status !== "liberado" || !cop.pagamento_liberado_em) return false;
  const limiteISO = addDiasUteis(new Date(cop.pagamento_liberado_em), 5, feriados);
  const hojeISO = new Date().toISOString().slice(0, 10);
  return hojeISO > limiteISO;
}

const STATUS_ELEGIVEIS = ["Romaneio Completo", "Aguardando Pagamento", "Finalizado"];

export function PagamentoOficinasTab({ selectedId = null, onSelect, onChangeTab }: { selectedId?: string | null; onSelect?: (id: string | null) => void; onChangeTab?: (tab: string) => void } = {}) {
  const topRef = useRef<HTMLDivElement | null>(null);
  const setSelectedId = (id: string | null) => {
    onSelect?.(id);
    if (id && typeof window !== "undefined") {
      requestAnimationFrame(() => {
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };
  const qc = useQueryClient();
  const { btnStyle } = useCopColorSettings();
  const isAdmin = useIsAdmin();
  const isGestor = useHasRole("gestor" as any);
  const canManageCop = useCanAccessCop();
  const podeLiberar = isAdmin || isGestor;
  const { feriados } = useFeriados();

  const { data: cops = [] } = useQuery({
    queryKey: ["cops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cops" as any).select("*").order("numero", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Cop[];
    },
  });
  const { data: oficinas = [] } = useQuery({
    queryKey: ["oficinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oficinas" as any).select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Oficina[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("pag-cop")
      .on("postgres_changes", { event: "*", schema: "public", table: "cops" }, () => qc.invalidateQueries({ queryKey: ["cops"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const [filtro, setFiltro] = useState<string>("liberado");
  const [filtroCop, setFiltroCop] = useState<string>("");
  const [filtroOficina, setFiltroOficina] = useState<string>("todas");
  const [pageSize, setPageSize] = useState<number>(100);
  type SortKey = "cop" | "oficina" | "pecas" | "pagamento" | "liberacao" | "vencimento" | "valor";
  const [sortKey, setSortKey] = useState<SortKey>("cop");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };
  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="inline h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="inline h-3 w-3 ml-1" />
      : <ArrowDown className="inline h-3 w-3 ml-1" />;
  };

  const listaFiltrada = useMemo(() => {
    const q = filtroCop.trim().toLowerCase();
    return cops.filter((c) => {
      if (!STATUS_ELEGIVEIS.includes(c.status) && c.pagamento_status === "nao_pago") return false;
      if (filtro === "nao_pago" && c.pagamento_status !== "nao_pago") return false;
      if (filtro === "liberado" && c.pagamento_status !== "liberado") return false;
      if (filtro === "pago" && c.pagamento_status !== "pago") return false;
      if (filtro === "atrasado" && !isPagamentoAtrasado(c, feriados)) return false;
      if (filtroOficina !== "todas" && c.oficina_id !== filtroOficina) return false;
      if (q) {
        const label = rotuloCop(c.numero, c.letra, !!c.refacao_perda_origem_id).toLowerCase();
        if (!label.includes(q) && !String(c.numero).includes(q)) return false;
      }
      return true;
    });
  }, [cops, filtro, filtroOficina, filtroCop, feriados]);

  const lista = useMemo(() => {
    const arr = [...listaFiltrada];
    const dir = sortDir === "asc" ? 1 : -1;
    const pagRank: Record<string, number> = { nao_pago: 0, liberado: 1, pago: 2 };
    arr.sort((a, b) => {
      const ofa = oficinas.find((o) => o.id === a.oficina_id)?.nome ?? "";
      const ofb = oficinas.find((o) => o.id === b.oficina_id)?.nome ?? "";
      switch (sortKey) {
        case "cop": {
          const d = a.numero - b.numero;
          return d !== 0 ? d * dir : (a.letra ?? "").localeCompare(b.letra ?? "") * dir;
        }
        case "oficina": return ofa.localeCompare(ofb) * dir;
        case "pecas": return (totalPecasCop(a.pecas) - totalPecasCop(b.pecas)) * dir;
        case "pagamento": return ((pagRank[a.pagamento_status] ?? -1) - (pagRank[b.pagamento_status] ?? -1)) * dir;
        case "liberacao": {
          const av = a.pagamento_liberado_em ? new Date(a.pagamento_liberado_em).getTime() : 0;
          const bv = b.pagamento_liberado_em ? new Date(b.pagamento_liberado_em).getTime() : 0;
          return (av - bv) * dir;
        }
        case "vencimento": {
          const av = a.pagamento_liberado_em ? addDiasUteis(new Date(a.pagamento_liberado_em), 5, feriados) : "";
          const bv = b.pagamento_liberado_em ? addDiasUteis(new Date(b.pagamento_liberado_em), 5, feriados) : "";
          return av.localeCompare(bv) * dir;
        }
        case "valor": {
          const av = a.pagamento_valor_calculado != null ? Number(a.pagamento_valor_calculado) : calcValor(a, oficinas.find((o) => o.id === a.oficina_id) ?? null);
          const bv = b.pagamento_valor_calculado != null ? Number(b.pagamento_valor_calculado) : calcValor(b, oficinas.find((o) => o.id === b.oficina_id) ?? null);
          return (av - bv) * dir;
        }
      }
    });
    return arr.slice(0, pageSize);
  }, [listaFiltrada, sortKey, sortDir, oficinas, feriados, pageSize]);

  const oficinasComRegistros = useMemo(() => {
    const ids = new Set(cops.map((c) => c.oficina_id).filter(Boolean) as string[]);
    return oficinas.filter((o) => ids.has(o.id)).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [cops, oficinas]);

  const selected = useMemo(() => cops.find((c) => c.id === selectedId) ?? null, [cops, selectedId]);
  const selectedOfi = useMemo(() => oficinas.find((o) => o.id === selected?.oficina_id) ?? null, [oficinas, selected]);

  const [obsPag, setObsPag] = useState<string>("");
  const [numFretes, setNumFretes] = useState<number>(1);
  useEffect(() => {
    if (!selected) { setObsPag(""); setNumFretes(1); return; }
    setObsPag(selected.observacoes_pagamento ?? "");
    setNumFretes(Math.max(0, Math.floor(Number(selected.num_fretes ?? 1))));
  }, [selectedId]); // eslint-disable-line

  const selectedComFretes = useMemo(
    () => selected ? ({ ...selected, num_fretes: numFretes } as Cop) : null,
    [selected, numFretes],
  );
  const valor = useMemo(() => selectedComFretes ? calcValor(selectedComFretes, selectedOfi) : 0, [selectedComFretes, selectedOfi]);
  const atrasado = selected ? isPagamentoAtrasado(selected, feriados) : false;

  const grupos = useMemo(() => {
    if (!selected) return [] as Array<{ modelo: string; cor: string; qtd: number; valUn: number; subtotal: number }>;
    const map = calcQtdPagavelPorModeloCor(selected);
    const arr: Array<{ modelo: string; cor: string; qtd: number; valUn: number; subtotal: number }> = [];
    for (const [k, q] of map) {
      const [modelo, cor] = k.split("|");
      const valUn = Number((selectedOfi?.valores_por_modelo ?? {})[modelo] ?? 0);
      arr.push({ modelo, cor, qtd: q, valUn, subtotal: valUn * q });
    }
    arr.sort((a, b) => a.modelo.localeCompare(b.modelo) || a.cor.localeCompare(b.cor));
    return arr;
  }, [selected, selectedOfi]);

  const salvarObs = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const { error } = await supabase.from("cops" as any).update({
        observacoes_pagamento: (obsPag || "").toUpperCase() || null,
        num_fretes: Math.max(0, Math.floor(Number(numFretes) || 0)),
      }).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Salvo."); qc.invalidateQueries({ queryKey: ["cops"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar."),
  });

  const liberar = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const { error: e1 } = await supabase.from("cops" as any).update({
        observacoes_pagamento: (obsPag || "").toUpperCase() || null,
        num_fretes: Math.max(0, Math.floor(Number(numFretes) || 0)),
      }).eq("id", selected.id);
      if (e1) throw e1;
      const { error } = await (supabase as any).rpc("liberar_pagamento_cop", { _cop_id: selected.id, _valor: valor });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pagamento liberado."); qc.invalidateQueries({ queryKey: ["cops"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao liberar."),
  });

  const marcar = useMutation({
    mutationFn: async ({ pago }: { pago: boolean }) => {
      if (!selected) return;
      const { error } = await (supabase as any).rpc("marcar_pagamento_cop", { _cop_id: selected.id, _pago: pago });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status de pagamento atualizado."); qc.invalidateQueries({ queryKey: ["cops"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro."),
  });

  const editarPagamento = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const novoStatus = selected.status === "Aguardando Pagamento" ? "Romaneio Completo" : selected.status;
      const { error } = await supabase.from("cops" as any).update({
        pagamento_status: "nao_pago",
        pagamento_liberado_em: null,
        pagamento_liberado_por: null,
        pagamento_valor_calculado: null,
        observacoes_pagamento: null,
        status: novoStatus,
      } as any).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pagamento editado. Volta para Romaneio Completo."); qc.invalidateQueries({ queryKey: ["cops"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao editar pagamento."),
  });

  const [confirmApagar, setConfirmApagar] = useState(false);
  const apagarPagamento = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const novoStatus = selected.status === "Finalizado" || selected.status === "Aguardando Pagamento"
        ? "Romaneio Completo"
        : selected.status;
      const { error } = await supabase.from("cops" as any).update({
        pagamento_status: "nao_pago",
        pagamento_liberado_em: null,
        pagamento_liberado_por: null,
        pagamento_pago_em: null,
        pagamento_pago_por: null,
        pagamento_valor_calculado: null,
        status: novoStatus,
      } as any).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento apagado.");
      setConfirmApagar(false);
      qc.invalidateQueries({ queryKey: ["cops"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao apagar."),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Pagamentos</h2>
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ["cops"] })} title="Recarregar"><RefreshCw className="h-4 w-4" /></Button>
          <Label className="text-xs">Status pagamento:</Label>
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos_pagaveis">Todos elegíveis</SelectItem>
              <SelectItem value="nao_pago">Não pago</SelectItem>
              <SelectItem value="liberado">Liberado</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground">{lista.length} registros</div>
      </div>

      {selected && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <CardTitle className="text-base flex flex-wrap items-center gap-2">
                COP {rotuloCop(selected.numero, selected.letra, !!selected.refacao_perda_origem_id)} ·{" "}
                <span className="font-normal text-sm">{selectedOfi?.nome ?? "—"}</span>
                {selected.letra && <span className="ml-2 text-xs text-amber-700">(Pagamento parcial — letra {selected.letra})</span>}
                {atrasado && (
                  <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded">
                    <AlertTriangle className="h-3 w-3" /> Pagamento atrasado
                  </span>
                )}
              </CardTitle>
              <span className="text-xs">
                Status: <b className={
                  selected.pagamento_status === "pago" ? "text-green-700"
                  : selected.pagamento_status === "liberado" ? "text-blue-700"
                  : "text-muted-foreground"
                }>{selected.pagamento_status === "nao_pago" ? "Não pago" : selected.pagamento_status === "liberado" ? "Liberado" : "Pago"}</b>
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-[12.5px] leading-[1.2]">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="p-2 text-left">Modelo</th>
                    <th className="p-2 text-left">Cor</th>
                    <th className="p-2 text-right">Qtd (rec. − perdas)</th>
                    <th className="p-2 text-right">Valor/un</th>
                    <th className="p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.length === 0 ? (
                    <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Sem peças recebidas (descontadas perdas).</td></tr>
                  ) : grupos.map((g, i) => {
                    const hex = corHex(g.cor); const fg = corTextoSobre(hex);
                    return (
                      <tr key={i} className={`border-t ${i % 2 === 1 ? "bg-muted/80" : ""}`}>

                        <td className="p-2">{g.modelo}</td>
                        <td className="p-2"><span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: hex, color: fg }}>{g.cor}</span></td>
                        <td className="p-2 text-right tabular-nums">{g.qtd}</td>
                        <td className="p-2 text-right tabular-nums">{fmtMoney(g.valUn)}</td>
                        <td className="p-2 text-right tabular-nums">{fmtMoney(g.subtotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr>
                    <td colSpan={3} className="p-2 text-right">
                      <span className="inline-flex items-center gap-2 justify-end">
                        <span>Frete</span>
                        {selected.pagamento_status === "pago" ? (
                          <span className="tabular-nums">{numFretes}</span>
                        ) : (
                          <Input
                            type="number" min={0}
                            className="h-7 w-16 text-right"
                            value={numFretes}
                            onChange={(e) => setNumFretes(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                          />
                        )}
                        <span>× {fmtMoney(Number(selectedOfi?.valor_frete ?? 0))}</span>
                      </span>
                    </td>
                    <td colSpan={2} className="p-2 text-right tabular-nums">{fmtMoney(Number(selectedOfi?.valor_frete ?? 0) * numFretes)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="p-2 text-right"><b>Total</b></td>
                    <td className="p-2 text-right tabular-nums"><b>{fmtMoney(valor)}</b></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div>
              <Label className="text-xs">Observações do pagamento</Label>
              <Textarea
                value={obsPag}
                onChange={(e) => setObsPag((e.target as HTMLTextAreaElement).value)}
                placeholder="EX.: PAGAMENTO PARCIAL DEVIDO A..."
                rows={2}
                className="uppercase"
                disabled={selected.pagamento_status === "pago"}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-end">
              {onChangeTab && (
                <Button variant="outline" onClick={() => onChangeTab("romaneio")}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao Romaneio
                </Button>
              )}
              {selected.pagamento_status !== "pago" && (
                <Button variant="outline" onClick={() => salvarObs.mutate()} disabled={salvarObs.isPending}>
                  Salvar
                </Button>
              )}
              {selected.pagamento_status === "nao_pago" && podeLiberar && (
                <Button style={btnStyle("liberar_pagamento")} onClick={() => liberar.mutate()} disabled={liberar.isPending || valor <= 0}>
                  <Check className="h-4 w-4 mr-1" /> Liberar pagamento (Gestor)
                </Button>
              )}
              {selected.pagamento_status === "liberado" && (podeLiberar || isAdmin) && (
                <Button
                  variant="outline"
                  className="border-orange-400 text-orange-700 hover:bg-orange-50"
                  onClick={() => editarPagamento.mutate()}
                  disabled={editarPagamento.isPending}
                  title="Voltar para Romaneio Completo e limpar liberação"
                >
                  <Undo2 className="h-4 w-4 mr-1" /> Editar (voltar para Romaneio Completo)
                </Button>
              )}
              {selected.pagamento_status === "liberado" && isAdmin && (
                <Button style={btnStyle("marcar_pago")} onClick={() => marcar.mutate({ pago: true })} disabled={marcar.isPending}>
                  <Check className="h-4 w-4 mr-1" /> Marcar como Pago (Admin)
                </Button>
              )}
              {selected.pagamento_status === "pago" && isAdmin && (
                <Button variant="outline" onClick={() => marcar.mutate({ pago: false })} disabled={marcar.isPending}>
                  <X className="h-4 w-4 mr-1" /> Reverter para Liberado
                </Button>
              )}
              {isAdmin && selected.pagamento_status !== "nao_pago" && (
                <Button
                  variant="outline"
                  className="border-red-400 text-red-700 hover:bg-red-50"
                  onClick={() => setConfirmApagar(true)}
                  title="Apagar pagamento e voltar status para Romaneio Completo"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Apagar pagamento
                </Button>
              )}
            </div>

            {(selected.pagamento_liberado_em || selected.pagamento_pago_em) && (
              <div className="text-xs text-muted-foreground">
                {selected.pagamento_liberado_em && (() => {
                  const venc = addDiasUteis(new Date(selected.pagamento_liberado_em), 5, feriados);
                  return (
                    <div>
                      Liberado em {new Date(selected.pagamento_liberado_em).toLocaleString("pt-BR")} · valor snapshot {fmtMoney(Number(selected.pagamento_valor_calculado ?? 0))}
                      {" · "}
                      <span className={atrasado ? "text-red-600 font-semibold" : ""}>
                        Vencimento: {new Date(venc + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  );
                })()}
                {selected.pagamento_pago_em && <div>Pago em {new Date(selected.pagamento_pago_em).toLocaleString("pt-BR")}</div>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <PagamentoConsolidadoCard />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">COPs elegíveis para pagamento</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-[12.5px] leading-[1.2]">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="p-2 text-left">COP</th>
                  <th className="p-2 text-left">Oficina</th>
                  <th className="p-2 text-center">Peças</th>
                  <th className="p-2 text-left">Status COP</th>
                  <th className="p-2 text-left">Pagamento</th>
                  <th className="p-2 text-left">Liberação</th>
                  <th className="p-2 text-left">Vencimento</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 ? (
                  <tr><td colSpan={9} className="p-3 text-center text-muted-foreground">Nenhum COP no filtro atual.</td></tr>
                ) : lista.map((c, i) => {
                  const ofi = oficinas.find((o) => o.id === c.oficina_id) ?? null;
                  const v = calcValor(c, ofi);
                  const atras = isPagamentoAtrasado(c, feriados);
                  const libISO = c.pagamento_liberado_em ?? null;
                  const vencISO = libISO ? addDiasUteis(new Date(libISO), 5, feriados) : null;
                  const zebra = i % 2 === 1;
                  return (
                    <tr key={c.id} className={`border-t cursor-pointer hover:bg-accent/40 ${c.id === selectedId ? "bg-accent/50" : zebra ? "bg-muted/80" : ""}`} onClick={() => setSelectedId(c.id)}>

                      <td className="p-2 font-semibold tabular-nums">{rotuloCop(c.numero, c.letra, !!c.refacao_perda_origem_id)}</td>
                      <td className="p-2">{ofi?.nome ?? "—"}</td>
                      <td className="p-2 text-center tabular-nums">{totalPecasCop(c.pecas)}</td>
                      <td className="p-2 text-xs">{c.status}</td>
                      <td className="p-2 text-xs">
                        {c.pagamento_status === "pago" ? <span className="text-green-700">Pago</span>
                          : c.pagamento_status === "liberado" ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-blue-700">Liberado</span>
                              {atras && (
                                <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                                  <AlertTriangle className="h-3 w-3" /> Atrasado
                                </span>
                              )}
                            </span>
                          )
                          : <span className="text-muted-foreground">Não pago</span>}
                      </td>
                      <td className="p-2 text-xs tabular-nums">
                        {libISO ? new Date(libISO).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className={`p-2 text-xs tabular-nums ${atras ? "text-red-600 font-semibold" : ""}`}>
                        {vencISO ? new Date(vencISO + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">{fmtMoney(c.pagamento_valor_calculado != null ? Number(c.pagamento_valor_calculado) : v)}</td>
                      <td className="p-2 text-right">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedId(c.id); }}>Abrir</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmApagar} onOpenChange={setConfirmApagar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar pagamento deste COP?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove os registros de liberação/pagamento e devolve o COP ao status "Romaneio Completo". A conferência e o romaneio permanecem. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apagarPagamento.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={apagarPagamento.isPending}
              onClick={(e) => { e.preventDefault(); apagarPagamento.mutate(); }}
            >
              {apagarPagamento.isPending ? "Apagando..." : "Apagar pagamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HistoricoPagamentosConsolidados />
    </div>
  );
}
