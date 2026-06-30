import { useMemo, useState, useEffect } from "react";
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
import { RefreshCw, Check, X, Trash2, AlertTriangle } from "lucide-react";
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
  const fretes = Number(oficina.valor_frete ?? 0) * Math.max(1, Number(cop.num_fretes) || 1);
  return Math.max(0, pecas + fretes);
}

function isPagamentoAtrasado(cop: Cop, feriados: Set<string>): boolean {
  if (cop.pagamento_status !== "liberado" || !cop.pagamento_liberado_em) return false;
  const limiteISO = addDiasUteis(new Date(cop.pagamento_liberado_em), 5, feriados);
  const hojeISO = new Date().toISOString().slice(0, 10);
  return hojeISO > limiteISO;
}

const STATUS_ELEGIVEIS = ["Romaneio Completo", "Aguardando Pagamento", "Finalizado"];

export function PagamentoOficinasTab({ selectedId = null, onSelect }: { selectedId?: string | null; onSelect?: (id: string | null) => void } = {}) {
  const setSelectedId = (id: string | null) => onSelect?.(id);
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

  const [filtro, setFiltro] = useState<string>("todos_pagaveis");
  const lista = useMemo(() => {
    return cops.filter((c) => {
      if (!STATUS_ELEGIVEIS.includes(c.status) && c.pagamento_status === "nao_pago") return false;
      if (filtro === "nao_pago") return c.pagamento_status === "nao_pago";
      if (filtro === "liberado") return c.pagamento_status === "liberado";
      if (filtro === "pago") return c.pagamento_status === "pago";
      if (filtro === "atrasado") return isPagamentoAtrasado(c, feriados);
      return true;
    });
  }, [cops, filtro, feriados]);

  const selected = useMemo(() => cops.find((c) => c.id === selectedId) ?? null, [cops, selectedId]);
  const selectedOfi = useMemo(() => oficinas.find((o) => o.id === selected?.oficina_id) ?? null, [oficinas, selected]);

  const [obsPag, setObsPag] = useState<string>("");
  const [numFretes, setNumFretes] = useState<number>(1);
  useEffect(() => {
    if (!selected) { setObsPag(""); setNumFretes(1); return; }
    setObsPag(selected.observacoes_pagamento ?? "");
    setNumFretes(Math.max(1, Math.floor(Number(selected.num_fretes) || 1)));
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
        num_fretes: Math.max(1, Math.floor(Number(numFretes) || 1)),
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
        num_fretes: Math.max(1, Math.floor(Number(numFretes) || 1)),
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
                COP {rotuloCop(selected.numero, selected.letra)} ·{" "}
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
              <table className="w-full text-sm">
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
                      <tr key={i} className="border-t">
                        <td className="p-2">{g.modelo}</td>
                        <td className="p-2"><span className="inline-block px-2 py-0.5 rounded text-xs" style={{ backgroundColor: hex, color: fg }}>{g.cor}</span></td>
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
                            type="number" min={1}
                            className="h-7 w-16 text-right"
                            value={numFretes}
                            onChange={(e) => setNumFretes(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
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
              {selected.pagamento_status === "liberado" && canManageCop && (
                <Button style={btnStyle("marcar_pago")} onClick={() => marcar.mutate({ pago: true })} disabled={marcar.isPending}>
                  <Check className="h-4 w-4 mr-1" /> Marcar como Pago
                </Button>
              )}
              {selected.pagamento_status === "pago" && canManageCop && (
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
                {selected.pagamento_liberado_em && <div>Liberado em {new Date(selected.pagamento_liberado_em).toLocaleString("pt-BR")} · valor snapshot {fmtMoney(Number(selected.pagamento_valor_calculado ?? 0))}</div>}
                {selected.pagamento_pago_em && <div>Pago em {new Date(selected.pagamento_pago_em).toLocaleString("pt-BR")}</div>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">COPs elegíveis para pagamento</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="p-2 text-left">COP</th>
                  <th className="p-2 text-left">Oficina</th>
                  <th className="p-2 text-center">Peças</th>
                  <th className="p-2 text-left">Status COP</th>
                  <th className="p-2 text-left">Pagamento</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 ? (
                  <tr><td colSpan={7} className="p-3 text-center text-muted-foreground">Nenhum COP no filtro atual.</td></tr>
                ) : lista.map((c) => {
                  const ofi = oficinas.find((o) => o.id === c.oficina_id) ?? null;
                  const v = calcValor(c, ofi);
                  const atras = isPagamentoAtrasado(c, feriados);
                  return (
                    <tr key={c.id} className={`border-t cursor-pointer hover:bg-accent/40 ${c.id === selectedId ? "bg-accent/50" : ""}`} onClick={() => setSelectedId(c.id)}>
                      <td className="p-2 font-semibold tabular-nums">{rotuloCop(c.numero, c.letra)}</td>
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
    </div>
  );
}
