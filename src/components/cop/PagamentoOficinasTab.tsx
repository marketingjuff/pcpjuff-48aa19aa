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
import { RefreshCw, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { Cop, CopPeca, CopConferenciaItem, Oficina } from "@/lib/cop";
import {
  rotuloCop, formatCopNumero, totalPecasCop, getRecebida,
} from "@/lib/cop";
import { useCopColorSettings } from "@/hooks/use-cop-color-settings";
import { useIsAdmin, useHasRole } from "@/hooks/use-role";

function fmtMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Cria conferencia a partir das peças recebidas (cada linha vira qtd_conferida). */
function inicializarConferencia(pecas: CopPeca[], recebidas: { modelo: string; cor: string; tamanho: string; qtd_recebida: number }[]): CopConferenciaItem[] {
  return pecas.map((p) => ({
    modelo: p.modelo, cor: p.cor, tamanho: p.tamanho,
    qtd_conferida: Math.min(p.qtd, getRecebida(recebidas, p.modelo, p.cor, p.tamanho)),
  }));
}

function calcValor(cop: Cop, oficina: Oficina | null, conferencia: CopConferenciaItem[]): number {
  if (!oficina) return 0;
  const pecas = conferencia.reduce((s, c) => {
    const v = Number((oficina.valores_por_modelo ?? {})[c.modelo] ?? 0);
    return s + v * (Number(c.qtd_conferida) || 0);
  }, 0);
  const fretes = Number(oficina.valor_frete ?? 0) * Math.max(1, Number(cop.num_fretes) || 1);
  return Math.max(0, pecas + fretes);
}

const STATUS_ELEGIVEIS = ["Romaneio Completo", "Aguardando Pagamento", "Finalizado"];

export function PagamentoOficinasTab() {
  const qc = useQueryClient();
  const { btnStyle } = useCopColorSettings();
  const isAdmin = useIsAdmin();
  const isGestor = useHasRole("gestor" as any);
  const podeLiberar = isAdmin || isGestor;

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
      // todos_pagaveis: tudo que está elegível
      return true;
    });
  }, [cops, filtro]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => cops.find((c) => c.id === selectedId) ?? null, [cops, selectedId]);
  const selectedOfi = useMemo(() => oficinas.find((o) => o.id === selected?.oficina_id) ?? null, [oficinas, selected]);

  // editor da conferência (com fallback a partir dos recebidos)
  const [conf, setConf] = useState<CopConferenciaItem[]>([]);
  const [obsPag, setObsPag] = useState<string>("");
  useEffect(() => {
    if (!selected) { setConf([]); setObsPag(""); return; }
    if ((selected.conferencia ?? []).length > 0) setConf(selected.conferencia);
    else setConf(inicializarConferencia(selected.pecas ?? [], selected.pecas_recebidas ?? []));
    setObsPag(selected.observacoes_pagamento ?? "");
  }, [selectedId]); // eslint-disable-line

  const valor = useMemo(() => selected ? calcValor(selected, selectedOfi, conf) : 0, [selected, selectedOfi, conf]);

  const salvarConferencia = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const { error } = await supabase.from("cops" as any).update({
        conferencia: conf as any,
        observacoes_pagamento: (obsPag || "").toUpperCase() || null,
      }).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Conferência atualizada."); qc.invalidateQueries({ queryKey: ["cops"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar."),
  });

  const liberar = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      // Salva conferência primeiro
      const { error: e1 } = await supabase.from("cops" as any).update({
        conferencia: conf as any,
        observacoes_pagamento: (obsPag || "").toUpperCase() || null,
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
              <CardTitle className="text-base">
                COP {rotuloCop(selected.numero, selected.letra)} ·{" "}
                <span className="font-normal text-sm">{selectedOfi?.nome ?? "—"}</span>
                {selected.letra && <span className="ml-2 text-xs text-amber-700">(Pagamento parcial — letra {selected.letra})</span>}
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
                    <th className="p-2 text-center">Tamanho</th>
                    <th className="p-2 text-right">Solic.</th>
                    <th className="p-2 text-right">Recebido</th>
                    <th className="p-2 text-right">Conferida</th>
                    <th className="p-2 text-right">Valor/un</th>
                    <th className="p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.pecas ?? []).map((p, i) => {
                    const recv = getRecebida(selected.pecas_recebidas ?? [], p.modelo, p.cor, p.tamanho);
                    const cIdx = conf.findIndex((c) => c.modelo === p.modelo && c.cor === p.cor && c.tamanho === p.tamanho);
                    const qConf = cIdx >= 0 ? conf[cIdx].qtd_conferida : 0;
                    const valUn = Number((selectedOfi?.valores_por_modelo ?? {})[p.modelo] ?? 0);
                    return (
                      <tr key={i} className="border-t">
                        <td className="p-2">{p.modelo}</td>
                        <td className="p-2">{p.cor}</td>
                        <td className="p-2 text-center">{p.tamanho}</td>
                        <td className="p-2 text-right tabular-nums">{p.qtd}</td>
                        <td className="p-2 text-right tabular-nums">{recv}</td>
                        <td className="p-2 text-right">
                          {selected.pagamento_status === "pago" ? (
                            <span className="tabular-nums">{qConf}</span>
                          ) : (
                            <Input
                              type="number" min={0} max={p.qtd}
                              className="h-7 w-20 ml-auto text-right"
                              value={qConf}
                              onChange={(e) => {
                                const v = Math.max(0, Math.min(p.qtd, Math.floor(Number(e.target.value) || 0)));
                                setConf((cs) => {
                                  const next = cs.slice();
                                  if (cIdx >= 0) next[cIdx] = { ...next[cIdx], qtd_conferida: v };
                                  else next.push({ modelo: p.modelo, cor: p.cor, tamanho: p.tamanho, qtd_conferida: v });
                                  return next;
                                });
                              }}
                            />
                          )}
                        </td>
                        <td className="p-2 text-right tabular-nums">{fmtMoney(valUn)}</td>
                        <td className="p-2 text-right tabular-nums">{fmtMoney(valUn * qConf)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr>
                    <td colSpan={6} className="p-2 text-right">Frete ({selected.num_fretes ?? 1}× {fmtMoney(Number(selectedOfi?.valor_frete ?? 0))})</td>
                    <td colSpan={2} className="p-2 text-right tabular-nums">{fmtMoney(Number(selectedOfi?.valor_frete ?? 0) * (selected.num_fretes ?? 1))}</td>
                  </tr>
                  <tr>
                    <td colSpan={7} className="p-2 text-right"><b>Total</b></td>
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
                <Button variant="outline" onClick={() => salvarConferencia.mutate()} disabled={salvarConferencia.isPending}>
                  Salvar conferência
                </Button>
              )}
              {selected.pagamento_status === "nao_pago" && podeLiberar && (
                <Button style={btnStyle("liberar_pagamento")} onClick={() => liberar.mutate()} disabled={liberar.isPending || valor <= 0}>
                  <Check className="h-4 w-4 mr-1" /> Liberar pagamento (Gestor)
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
                  const conferencia = (c.conferencia ?? []).length > 0
                    ? c.conferencia
                    : inicializarConferencia(c.pecas ?? [], c.pecas_recebidas ?? []);
                  const v = calcValor(c, ofi, conferencia);
                  return (
                    <tr key={c.id} className={`border-t cursor-pointer hover:bg-accent/40 ${c.id === selectedId ? "bg-accent/50" : ""}`} onClick={() => setSelectedId(c.id)}>
                      <td className="p-2 font-semibold tabular-nums">{rotuloCop(c.numero, c.letra)}</td>
                      <td className="p-2">{ofi?.nome ?? "—"}</td>
                      <td className="p-2 text-center tabular-nums">{totalPecasCop(c.pecas)}</td>
                      <td className="p-2 text-xs">{c.status}</td>
                      <td className="p-2 text-xs">
                        {c.pagamento_status === "pago" ? <span className="text-green-700">Pago</span>
                          : c.pagamento_status === "liberado" ? <span className="text-blue-700">Liberado</span>
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
    </div>
  );
}
