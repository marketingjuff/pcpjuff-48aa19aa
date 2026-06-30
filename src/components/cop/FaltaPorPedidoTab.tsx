import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import type { Pedido, PecaSolicitada } from "@/lib/pedidos";
import type { Cop } from "@/lib/cop";
import { rotuloCop, colunasTamanhos } from "@/lib/cop";
import { dataUrgencia, addDiasUteis } from "@/lib/cop-saldos";
import { BaixaCopDialog, type ItemFalta } from "./BaixaCopDialog";
import { useCopColorSettings } from "@/hooks/use-cop-color-settings";

type GrupoFalta = {
  modelo: string;
  cor: string;
  porTamanho: Map<string, { idx: number; ps: PecaSolicitada; falta: number }>;
  faltaTotal: number;
};

type LinhaFalta = {
  pedido: Pedido;
  grupos: GrupoFalta[];
  faltaTotal: number;
  ancora: string | null;
  limite: string | null;
  inicioEstamparia: string | null;
};

function fmtBR(d: string | null | undefined): string {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

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
  const [historico, setHistorico] = useState<Pedido | null>(null);

  const linhas: LinhaFalta[] = useMemo(() => {
    const arr: LinhaFalta[] = [];
    for (const p of pedidos) {
      const itens = (p.pecas_solicitadas ?? []).map((ps, idx) => ({
        idx, ps,
        falta: Math.max(0, (Number(ps.qtd) || 0) - (Number(ps.qtd_enviada) || 0)),
      })).filter((x) => x.falta > 0);
      if (itens.length === 0) continue;
      if (busca) {
        const orc = String(p.orcamento ?? "").toLowerCase();
        const ped = String((p as any).pedido_olist ?? "").toLowerCase();
        if (!orc.includes(busca.toLowerCase()) && !ped.includes(busca.toLowerCase())) continue;
      }
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
      const inicioEstamparia = (p as any).inicio_estamparia ?? ancora ?? null;
      arr.push({ pedido: p, grupos, faltaTotal, ancora, limite, inicioEstamparia });
    }
    arr.sort((a, b) => {
      const da = a.ancora ?? "9999-12-31";
      const db = b.ancora ?? "9999-12-31";
      return da.localeCompare(db);
    });
    return arr;
  }, [pedidos, busca]);

  // Colunas fixas: PP P M G GG EXG EXXG + extras alfabéticos
  const tamanhosColunas = useMemo(() => {
    const set = new Set<string>();
    for (const l of linhas) for (const g of l.grupos) for (const t of g.porTamanho.keys()) set.add(t);
    return colunasTamanhos(set);
  }, [linhas]);

  // Flatten: 1 linha por (pedido, modelo, cor)
  type Row = LinhaFalta & { grupo: GrupoFalta; primeira: boolean; rowSpan: number };
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const l of linhas) {
      const total = l.grupos.length;
      l.grupos.forEach((g, i) => out.push({ ...l, grupo: g, primeira: i === 0, rowSpan: total }));
    }
    return out;
  }, [linhas]);

  const [baixa, setBaixa] = useState<{ pedido: Pedido; grupo: GrupoFalta } | null>(null);

  const baixar = useMutation({
    mutationFn: async ({
      pedido, observacao, baixas,
    }: { pedido: Pedido; observacao: string; baixas: { idx: number; tamanho: string; qtd: number }[] }) => {
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
          observacao: observacao || null,
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
        const ord = colunasTamanhos([a[0], b[0]]);
        return ord.indexOf(a[0]) - ord.indexOf(b[0]);
      })
      .map(([tam, info]) => ({ idx: info.idx, tamanho: tam, falta: info.falta }));
  }, [baixa]);

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Falta por Pedido</h2>
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
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px]">
              <tr>
                <th className="px-2 py-1 text-left">Início Estamparia</th>
                <th className="px-2 py-1 text-left">Orçamento</th>
                <th className="px-2 py-1 text-left">Modelo</th>
                <th className="px-2 py-1 text-left">Cor</th>
                {tamanhosColunas.map((t) => (
                  <th key={t} className="px-2 py-1 text-center">{t}</th>
                ))}
                <th className="px-2 py-1 text-right">Total Geral</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const hex = corHex(r.grupo.cor); const fg = corTextoSobre(hex);
                const atrasado = !!(r.limite && r.limite < hoje);
                const prev = i > 0 ? rows[i - 1] : null;
                const novaData = r.primeira && (!prev || prev.ancora !== r.ancora);
                const trBorder = novaData ? "border-t-4 border-muted-foreground/40" : "border-t";
                const trPad = novaData ? "pt-1" : "";
                return (
                  <tr
                    key={`${r.pedido.id}|${r.grupo.modelo}|${r.grupo.cor}`}
                    className={`${trBorder} ${trPad} hover:bg-accent/40 cursor-pointer leading-tight`}
                    onClick={() => setHistorico(r.pedido)}
                  >
                    {r.primeira ? (
                      <>
                        <td className={`px-2 py-0.5 align-middle whitespace-nowrap ${atrasado ? "text-red-700 font-semibold" : ""}`} rowSpan={r.rowSpan}>
                          {fmtBR(r.inicioEstamparia)}
                        </td>
                        <td className="px-2 py-0.5 align-middle font-mono whitespace-nowrap" rowSpan={r.rowSpan}>
                          {r.pedido.orcamento ?? "—"}
                          {(r.pedido as any).pedido_olist && (
                            <span className="text-[10px] text-muted-foreground ml-1">(Olist {(r.pedido as any).pedido_olist})</span>
                          )}
                        </td>
                      </>
                    ) : null}
                    <td className="px-2 py-0.5 whitespace-nowrap">{r.grupo.modelo}</td>
                    <td className="px-2 py-0.5">
                      <span className="inline-block px-1.5 py-0 rounded text-[10px]" style={{ backgroundColor: hex, color: fg }}>{r.grupo.cor}</span>
                    </td>
                    {tamanhosColunas.map((t) => {
                      const info = r.grupo.porTamanho.get(t);
                      return (
                        <td key={t} className="px-2 py-0.5 text-center tabular-nums">
                          {info ? <span className="text-amber-700 font-semibold">-{info.falta}</span> : <span className="text-muted-foreground/40">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-2 py-0.5 text-right tabular-nums text-amber-700 font-semibold">-{r.grupo.faltaTotal}</td>
                    <td className="px-2 py-0.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" className="h-6 px-2 text-[11px]" style={btnStyle("dar_baixa")} onClick={() => setBaixa({ pedido: r.pedido, grupo: r.grupo })}>
                        Dar baixa
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

          </table>
        </div>
      )}

      {baixa && (
        <BaixaCopDialog
          open={!!baixa}
          onOpenChange={(o) => !o && setBaixa(null)}
          modelo={baixa.grupo.modelo}
          cor={baixa.grupo.cor}
          orcamento={baixa.pedido.orcamento ?? null}
          itens={itensDialog}
          onConfirm={async (observacao, baixas) => {
            await baixar.mutateAsync({ pedido: baixa.pedido, observacao, baixas });
          }}
        />
      )}

      <Dialog open={!!historico} onOpenChange={(o) => !o && setHistorico(null)}>
        <DialogContent className="max-w-[720px]">
          <DialogHeader>
            <DialogTitle>
              Histórico de baixas — Orçamento <span className="font-mono">{historico?.orcamento ?? "—"}</span>
            </DialogTitle>
          </DialogHeader>
          {historico && (historico.pecas_completadas_log?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma baixa registrada ainda.</div>
          ) : historico ? (
            <div className="rounded-md border overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Data/Hora</th>
                    <th className="p-2 text-left">Modelo</th>
                    <th className="p-2 text-left">Cor</th>
                    <th className="p-2 text-left">Tam.</th>
                    <th className="p-2 text-right">Qtd</th>
                    <th className="p-2 text-left">COP</th>
                    <th className="p-2 text-left">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(historico.pecas_completadas_log ?? [])].sort((a, b) => b.em.localeCompare(a.em)).map((log, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-mono text-xs">{new Date(log.em).toLocaleString("pt-BR")}</td>
                      <td className="p-2">{log.modelo}</td>
                      <td className="p-2">{log.cor}</td>
                      <td className="p-2">{log.tamanho}</td>
                      <td className="p-2 text-right tabular-nums">{log.qtd}</td>
                      <td className="p-2 font-mono">{log.cop_numero != null ? rotuloCop(log.cop_numero, log.cop_letra ?? null) : "—"}</td>
                      <td className="p-2 text-xs text-muted-foreground">{log.observacao ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
