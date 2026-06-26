import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import type { Pedido, PecaSolicitada } from "@/lib/pedidos";
import type { Cop } from "@/lib/cop";
import { rotuloCop } from "@/lib/cop";
import { dataUrgencia, addDiasUteis } from "@/lib/cop-saldos";
import { BaixaCopDialog, type ItemFalta } from "./BaixaCopDialog";
import { useCopColorSettings } from "@/hooks/use-cop-color-settings";

const TAMANHOS_PADRAO = ["PP", "P", "M", "G", "GG", "EXG", "EXXG"];

type GrupoFalta = {
  modelo: string;
  cor: string;
  // idx no array pedido.pecas_solicitadas e falta por tamanho
  porTamanho: Map<string, { idx: number; ps: PecaSolicitada; falta: number }>;
  faltaTotal: number;
};

type LinhaFalta = {
  pedido: Pedido;
  grupos: GrupoFalta[];
  faltaTotal: number;
  ancora: string | null;
  limite: string | null;
};

export function FaltaPorPedidoTab() {
  const qc = useQueryClient();
  const { btnStyle } = useCopColorSettings();

  const { data: cops = [] } = useQuery({
    queryKey: ["cops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cops" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Cop[];
    },
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-falta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos" as any).select("*")
        .eq("status_pecas", "incompleto");
      if (error) throw error;
      return (data ?? []) as unknown as Pedido[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("falta-pedido")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => qc.invalidateQueries({ queryKey: ["pedidos-falta"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "cops" }, () => qc.invalidateQueries({ queryKey: ["cops"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const [busca, setBusca] = useState("");

  const linhas: LinhaFalta[] = useMemo(() => {
    const arr: LinhaFalta[] = [];
    for (const p of pedidos) {
      const itens = (p.pecas_solicitadas ?? []).map((ps, idx) => ({
        idx,
        ps,
        falta: Math.max(0, (Number(ps.qtd) || 0) - (Number(ps.qtd_enviada) || 0)),
      })).filter((x) => x.falta > 0);
      if (itens.length === 0) continue;
      if (busca) {
        const orc = String(p.orcamento ?? "").toLowerCase();
        const ped = String((p as any).pedido_olist ?? "").toLowerCase();
        if (!orc.includes(busca.toLowerCase()) && !ped.includes(busca.toLowerCase())) continue;
      }

      // Agrupar por modelo+cor
      const mapa = new Map<string, GrupoFalta>();
      for (const it of itens) {
        const k = `${it.ps.modelo}|${it.ps.cor}`;
        let g = mapa.get(k);
        if (!g) { g = { modelo: it.ps.modelo, cor: it.ps.cor, porTamanho: new Map(), faltaTotal: 0 }; mapa.set(k, g); }
        g.porTamanho.set(it.ps.tamanho, { idx: it.idx, ps: it.ps, falta: it.falta });
        g.faltaTotal += it.falta;
      }
      const grupos = Array.from(mapa.values());
      const faltaTotal = grupos.reduce((s, g) => s + g.faltaTotal, 0);
      const ancora = dataUrgencia(p);
      const limite = ancora ? addDiasUteis(ancora, -2) : null;
      arr.push({ pedido: p, grupos, faltaTotal, ancora, limite });
    }
    arr.sort((a, b) => {
      const da = a.ancora ?? "9999-12-31";
      const db = b.ancora ?? "9999-12-31";
      return da.localeCompare(db);
    });
    return arr;
  }, [pedidos, busca]);

  // Tamanhos presentes globalmente (para colunas dinâmicas, na ordem padrão + extras)
  const tamanhosColunas = useMemo(() => {
    const set = new Set<string>();
    for (const l of linhas) for (const g of l.grupos) for (const t of g.porTamanho.keys()) set.add(t);
    const ord = TAMANHOS_PADRAO.filter((t) => set.has(t));
    const extras = Array.from(set).filter((t) => !TAMANHOS_PADRAO.includes(t)).sort();
    return [...ord, ...extras];
  }, [linhas]);

  // Baixa dialog
  const [baixa, setBaixa] = useState<{ pedido: Pedido; grupo: GrupoFalta } | null>(null);

  const baixar = useMutation({
    mutationFn: async ({
      pedido, copId, baixas,
    }: { pedido: Pedido; copId: string; baixas: { idx: number; tamanho: string; qtd: number }[] }) => {
      const cop = cops.find((c) => c.id === copId);
      if (!cop) throw new Error("COP não encontrado.");
      const arr = ((pedido.pecas_solicitadas as PecaSolicitada[] | null) ?? []).slice();
      const { data: ses } = await supabase.auth.getUser();
      const novoLog: any[] = [...((pedido.pecas_completadas_log ?? []) as any[])];

      for (const b of baixas) {
        if (b.qtd <= 0) continue;
        const linha = { ...(arr[b.idx] as PecaSolicitada) };
        const novaEnviada = Math.min(linha.qtd, (Number(linha.qtd_enviada) || 0) + b.qtd);
        arr[b.idx] = { ...linha, qtd_enviada: novaEnviada };
        novoLog.push({
          modelo: linha.modelo, cor: linha.cor, tamanho: linha.tamanho, qtd: b.qtd,
          em: new Date().toISOString(),
          por: ses.user?.id ?? null,
          cop_id: cop.id, cop_numero: cop.numero, cop_letra: cop.letra ?? null,
        });
      }

      const { error } = await supabase
        .from("pedidos" as any)
        .update({ pecas_solicitadas: arr as any, pecas_completadas_log: novoLog as any })
        .eq("id", pedido.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos-falta"] });
      qc.invalidateQueries({ queryKey: ["pedidos-cop-saldos"] });
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      toast.success("Baixa registrada.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro na baixa."),
  });

  const itensDialog: ItemFalta[] = useMemo(() => {
    if (!baixa) return [];
    return Array.from(baixa.grupo.porTamanho.entries())
      .sort((a, b) => {
        const ia = TAMANHOS_PADRAO.indexOf(a[0]); const ib = TAMANHOS_PADRAO.indexOf(b[0]);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      })
      .map(([tam, info]) => ({ idx: info.idx, tamanho: tam, falta: info.falta }));
  }, [baixa]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => {
            qc.invalidateQueries({ queryKey: ["pedidos-falta"] });
            qc.invalidateQueries({ queryKey: ["cops"] });
          }} title="Recarregar"><RefreshCw className="h-4 w-4" /></Button>
          <Input
            placeholder="Buscar orçamento/pedido Olist..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-9 w-[260px]"
          />
        </div>
        <div className="text-xs text-muted-foreground">{linhas.length} pedidos · ordenados por urgência</div>
      </div>

      {linhas.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">Nenhum pedido com peças faltantes.</CardContent></Card>
      ) : linhas.map((l) => {
        const atrasado = !!(l.limite && l.limite < new Date().toISOString().slice(0, 10));
        return (
          <Card key={l.pedido.id} className="border-l-4" style={{ borderLeftColor: atrasado ? "#dc2626" : "#0ea5e9" }}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <CardTitle className="text-base">
                  Orç. <span className="font-mono">{l.pedido.orcamento ?? "—"}</span>
                  {" · Pedido Olist "}<span className="font-mono text-sm">{(l.pedido as any).pedido_olist ?? "—"}</span>
                </CardTitle>
                <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                  <span>Início estamparia/acabamento: <b>{l.ancora ?? "—"}</b></span>
                  <span>Limite de recebimento (-2 dias úteis): <b className={atrasado ? "text-red-700" : ""}>{l.limite ?? "—"}</b></span>
                  <span>Falta total: <b className="text-amber-700 tabular-nums">{l.faltaTotal}</b></span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs">
                    <tr>
                      <th className="p-2 text-left">Modelo</th>
                      <th className="p-2 text-left">Cor</th>
                      {tamanhosColunas.map((t) => (
                        <th key={t} className="p-2 text-center">{t}</th>
                      ))}
                      <th className="p-2 text-right">Falta total</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.grupos.map((g) => {
                      const hex = corHex(g.cor); const fg = corTextoSobre(hex);
                      return (
                        <tr key={`${g.modelo}|${g.cor}`} className="border-t">
                          <td className="p-2">{g.modelo}</td>
                          <td className="p-2">
                            <span className="inline-block px-2 py-0.5 rounded text-xs" style={{ backgroundColor: hex, color: fg }}>{g.cor}</span>
                          </td>
                          {tamanhosColunas.map((t) => {
                            const info = g.porTamanho.get(t);
                            return (
                              <td key={t} className="p-2 text-center tabular-nums">
                                {info ? <span className="text-amber-700 font-semibold">{info.falta}</span> : <span className="text-muted-foreground/40">—</span>}
                              </td>
                            );
                          })}
                          <td className="p-2 text-right tabular-nums text-amber-700 font-semibold">{g.faltaTotal}</td>
                          <td className="p-2 text-right">
                            <Button size="sm" style={btnStyle("dar_baixa")} onClick={() => setBaixa({ pedido: l.pedido, grupo: g })}>
                              Dar baixa
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {(l.pedido.pecas_completadas_log?.length ?? 0) > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Histórico de baixas pelo COP ({l.pedido.pecas_completadas_log!.length})</summary>
                  <ul className="mt-1 space-y-0.5">
                    {l.pedido.pecas_completadas_log!.map((log, i) => (
                      <li key={i}>
                        <span className="font-mono">{new Date(log.em).toLocaleString("pt-BR")}</span>
                        {" — "}{log.qtd}× {log.modelo} · {log.cor} · {log.tamanho}
                        {" (COP "}<b>{rotuloCop(log.cop_numero, log.cop_letra)}</b>{")"}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>
        );
      })}

      {baixa && (
        <BaixaCopDialog
          open={!!baixa}
          onOpenChange={(o) => !o && setBaixa(null)}
          modelo={baixa.grupo.modelo}
          cor={baixa.grupo.cor}
          itens={itensDialog}
          cops={cops}
          onConfirm={async (copId, baixas) => {
            await baixar.mutateAsync({ pedido: baixa.pedido, copId, baixas });
          }}
        />
      )}
    </div>
  );
}
