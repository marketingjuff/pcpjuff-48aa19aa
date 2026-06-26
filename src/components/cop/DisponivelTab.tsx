import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, AlertCircle } from "lucide-react";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { REFACAO_MODELOS, REFACAO_TAMANHOS, type Pedido } from "@/lib/pedidos";
import { calcularEtapaAtual } from "@/lib/pedidos";
import type { Cop } from "@/lib/cop";
import {
  pkKey, calcEmProducao, calcFaltantes, calcDisponivel, pedidosDoItem,
} from "@/lib/cop-saldos";

export function DisponivelTab() {
  const qc = useQueryClient();

  const { data: cops = [] } = useQuery({
    queryKey: ["cops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cops" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Cop[];
    },
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-cop-saldos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pedidos" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Pedido[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("cop-saldos")
      .on("postgres_changes", { event: "*", schema: "public", table: "cops" }, () => qc.invalidateQueries({ queryKey: ["cops"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => qc.invalidateQueries({ queryKey: ["pedidos-cop-saldos"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const producao = useMemo(() => calcEmProducao(cops), [cops]);
  const faltantes = useMemo(() => calcFaltantes(pedidos), [pedidos]);
  const disponivel = useMemo(() => calcDisponivel(producao, faltantes), [producao, faltantes]);

  // Lista de cores presentes (alfabética), opcionalmente filtrada
  const coresDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const k of disponivel.keys()) {
      const [, cor] = k.split("|");
      if (cor) set.add(cor);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [disponivel]);

  const [corFiltro, setCorFiltro] = useState<string>("todas");
  const [apenasFaltando, setApenasFaltando] = useState<boolean>(false);

  // Linhas (modelo, cor) a renderizar
  const linhas = useMemo(() => {
    const out: { modelo: string; cor: string }[] = [];
    for (const modelo of REFACAO_MODELOS) {
      const coresDoModelo = coresDisponiveis.filter((cor) => {
        if (corFiltro !== "todas" && cor !== corFiltro) return false;
        // se "apenas faltando" → manter só se alguma célula < 0
        if (apenasFaltando) {
          const algumNeg = REFACAO_TAMANHOS.some((t) => (disponivel.get(pkKey(modelo, cor, t)) ?? 0) < 0);
          if (!algumNeg) return false;
        }
        // só mostrar combinações que aparecem em produção ou em faltantes
        const algumPresente = REFACAO_TAMANHOS.some((t) => disponivel.has(pkKey(modelo, cor, t)));
        return algumPresente;
      });
      for (const cor of coresDoModelo) out.push({ modelo, cor });
    }
    return out;
  }, [coresDisponiveis, corFiltro, apenasFaltando, disponivel]);

  // Popup
  const [popup, setPopup] = useState<{ modelo: string; cor: string; tamanho: string } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => {
            qc.invalidateQueries({ queryKey: ["cops"] });
            qc.invalidateQueries({ queryKey: ["pedidos-cop-saldos"] });
          }} title="Recarregar"><RefreshCw className="h-4 w-4" /></Button>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Cor:</Label>
            <Select value={corFiltro} onValueChange={setCorFiltro}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {coresDisponiveis.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant={apenasFaltando ? "default" : "outline"}
            onClick={() => setApenasFaltando((v) => !v)}
          >
            <AlertCircle className="h-4 w-4 mr-1" />
            {apenasFaltando ? "Mostrando: faltando" : "Tudo o que está faltando"}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">{linhas.length} linhas</div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Disponível por Modelo · Cor</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="p-2 text-left min-w-[160px]">Modelo</th>
                <th className="p-2 text-left min-w-[140px]">Cor</th>
                {REFACAO_TAMANHOS.map((t) => (
                  <th key={t} className="p-2 text-center w-[70px]">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr><td colSpan={REFACAO_TAMANHOS.length + 2} className="p-4 text-center text-muted-foreground">Sem dados.</td></tr>
              ) : linhas.map((l, i) => {
                const hex = corHex(l.cor); const fg = corTextoSobre(hex);
                return (
                  <tr key={i} className="border-t hover:bg-accent/30">
                    <td className="p-2 font-medium">{l.modelo}</td>
                    <td className="p-2">
                      <span className="inline-block px-2 py-0.5 rounded text-xs" style={{ backgroundColor: hex, color: fg }}>{l.cor}</span>
                    </td>
                    {REFACAO_TAMANHOS.map((t) => {
                      const v = disponivel.get(pkKey(l.modelo, l.cor, t)) ?? 0;
                      const prod = producao.get(pkKey(l.modelo, l.cor, t)) ?? 0;
                      const falt = faltantes.get(pkKey(l.modelo, l.cor, t)) ?? 0;
                      const presente = prod > 0 || falt > 0;
                      const color = !presente ? "text-muted-foreground"
                                  : v < 0 ? "text-red-700 font-bold"
                                  : v === 0 ? "text-amber-700 font-semibold"
                                  : "text-green-700 font-semibold";
                      return (
                        <td key={t} className="p-1 text-center">
                          <button
                            type="button"
                            className={`w-full rounded px-2 py-1 tabular-nums hover:bg-accent/60 ${color}`}
                            onClick={() => presente && setPopup({ modelo: l.modelo, cor: l.cor, tamanho: t })}
                            disabled={!presente}
                            title={presente ? `Produção ${prod} · Faltantes ${falt}` : "Sem registro"}
                          >
                            {presente ? v : "—"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!popup} onOpenChange={(o) => !o && setPopup(null)}>
        <DialogContent className="max-w-[900px]">
          {popup && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {popup.modelo} · <span style={{ backgroundColor: corHex(popup.cor), color: corTextoSobre(corHex(popup.cor)) }} className="px-2 py-0.5 rounded">{popup.cor}</span> · {popup.tamanho}
                </DialogTitle>
              </DialogHeader>
              {(() => {
                const lista = pedidosDoItem(pedidos, popup.modelo, popup.cor, popup.tamanho);
                const prod = producao.get(pkKey(popup.modelo, popup.cor, popup.tamanho)) ?? 0;
                const falt = faltantes.get(pkKey(popup.modelo, popup.cor, popup.tamanho)) ?? 0;
                return (
                  <>
                    <div className="text-xs flex gap-4">
                      <span>Produção: <b className="tabular-nums text-green-700">{prod}</b></span>
                      <span>Faltantes: <b className="tabular-nums text-amber-700">{falt}</b></span>
                      <span>Saldo: <b className={`tabular-nums ${(prod - falt) < 0 ? "text-red-700" : "text-green-700"}`}>{prod - falt}</b></span>
                    </div>
                    <div className="rounded-md border overflow-x-auto max-h-[55vh]">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs sticky top-0">
                          <tr>
                            <th className="p-2 text-left">Orçamento</th>
                            <th className="p-2 text-left">Pedido Olist</th>
                            <th className="p-2 text-right">Qtd item</th>
                            <th className="p-2 text-right">Enviado</th>
                            <th className="p-2 text-right">Falta</th>
                            <th className="p-2 text-left">Status PCP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lista.length === 0 ? (
                            <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">Nenhum pedido pede este item.</td></tr>
                          ) : lista.map(({ pedido, pecaSolic }, idx) => {
                            const etapa = calcularEtapaAtual(pedido);
                            const falta = Math.max(0, (Number(pecaSolic.qtd) || 0) - (Number(pecaSolic.qtd_enviada) || 0));
                            return (
                              <tr key={idx} className="border-t">
                                <td className="p-2 font-mono">{pedido.orcamento ?? "—"}</td>
                                <td className="p-2">{(pedido as any).cliente ?? "—"}</td>
                                <td className="p-2 text-right tabular-nums">{pecaSolic.qtd}</td>
                                <td className="p-2 text-right tabular-nums">{pecaSolic.qtd_enviada}</td>
                                <td className={`p-2 text-right tabular-nums ${falta > 0 ? "text-amber-700 font-semibold" : "text-green-700"}`}>{falta}</td>
                                <td className="p-2 text-xs">{etapa.etapa}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
