import { useMemo, useState, useEffect, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, ChevronRight, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import type { Pedido, PecaSolicitada } from "@/lib/pedidos";
import { REFACAO_MODELOS, REFACAO_CORES } from "@/lib/pedidos";
import type { Cop, Oficina } from "@/lib/cop";
import { rotuloCop, colunasTamanhos } from "@/lib/cop";
import { dataUrgencia, addDiasUteis } from "@/lib/cop-saldos";
import { BaixaCopDialog, type ItemFalta } from "./BaixaCopDialog";
import { FaltaPecaPopup } from "./FaltaPecaPopup";
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

  const { data: oficinas = [] } = useQuery({
    queryKey: ["oficinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oficinas" as any).select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Oficina[];
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
  const [modeloFiltro, setModeloFiltro] = useState("todos");
  const [corFiltro, setCorFiltro] = useState("todas");
  const [historico, setHistorico] = useState<Pedido | null>(null);
  const [popupPeca, setPopupPeca] = useState<{ modelo: string; cor: string; tamanho: string } | null>(null);


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
      arr.push({ pedido: p, grupos, faltaTotal, ancora });
    }
    arr.sort((a, b) => {
      const da = a.ancora ?? "9999-12-31";
      const db = b.ancora ?? "9999-12-31";
      return da.localeCompare(db);
    });
    return arr;
  }, [pedidos, busca]);

  const tamanhosColunas = useMemo(() => {
    const set = new Set<string>();
    for (const l of linhas) for (const g of l.grupos) for (const t of g.porTamanho.keys()) set.add(t);
    return colunasTamanhos(set);
  }, [linhas]);

  type PedidoRow = LinhaFalta & { grupo: GrupoFalta; primeira: boolean; rowSpan: number };
  type DateGroup = {
    key: string;
    ancora: string | null;
    linhas: LinhaFalta[];
    rows: PedidoRow[];
    subtotais: Record<string, number>;
    total: number;
  };

  const dateGroups: DateGroup[] = useMemo(() => {
    const map = new Map<string, LinhaFalta[]>();
    for (const l of linhas) {
      const k = l.ancora ?? "sem-data";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(l);
    }
    const out: DateGroup[] = [];
    for (const [k, ls] of map) {
      const rs: PedidoRow[] = [];
      for (const l of ls) {
        const total = l.grupos.length;
        l.grupos.forEach((g, i) => rs.push({ ...l, grupo: g, primeira: i === 0, rowSpan: total }));
      }
      const subtotais: Record<string, number> = {};
      let total = 0;
      for (const l of ls) {
        for (const g of l.grupos) {
          for (const [t, info] of g.porTamanho) {
            subtotais[t] = (subtotais[t] ?? 0) + info.falta;
            total += info.falta;
          }
        }
      }
      out.push({ key: k, ancora: ls[0]?.ancora ?? null, linhas: ls, rows: rs, subtotais, total });
    }
    return out;
  }, [linhas]);

  const allGroupKeys = useMemo(() => dateGroups.map((g) => g.key), [dateGroups]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const k of allGroupKeys) if (!prev.has(k)) next.add(k);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGroupKeys.join("|")]);
  const toggle = (k: string) => setExpanded((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const expandirTudo = () => setExpanded(new Set(allGroupKeys));
  const recolherTudo = () => setExpanded(new Set());


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
          <Button variant="outline" size="sm" onClick={expandirTudo}>Expandir tudo</Button>
          <Button variant="outline" size="sm" onClick={recolherTudo}>Recolher tudo</Button>
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
        <div className="rounded-md border overflow-auto max-h-[70vh] tbl-congelada">
          <table className="text-[12.5px] leading-[1.2]" style={{ borderCollapse: "collapse", tableLayout: "fixed", minWidth: "100%" }}>
            <colgroup>
              <col style={{ width: 210 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 70 }} />
              {tamanhosColunas.map((t) => (
                <col key={t} style={{ width: 48 }} />
              ))}
              <col style={{ width: 44 }} />
              <col style={{ width: 52 }} />
            </colgroup>
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="px-1 py-2 text-left whitespace-nowrap">Orçamento</th>
                <th className="px-1 py-2 text-left whitespace-nowrap">Modelo</th>
                <th className="px-1 py-2 text-left whitespace-nowrap">Cor</th>
                {tamanhosColunas.map((t) => (
                  <th key={t} className="px-1 py-2 text-center whitespace-nowrap">{t}</th>
                ))}
                <th className="px-1 py-2 text-right whitespace-nowrap">Tot.</th>
                <th className="px-1 py-2 whitespace-nowrap"> </th>
              </tr>
            </thead>
            <tbody>
              {dateGroups.map((grp) => {
                const isExp = expanded.has(grp.key);
                const atrasadoGrp = !!(grp.ancora && addDiasUteis(grp.ancora, -2) < hoje);
                return (
                  <Fragment key={grp.key}>
                    <tr key={`sub:${grp.key}`} className="border-t bg-muted/60 font-semibold leading-tight">
                      <td className="px-1 py-1.5 text-left" colSpan={3}>
                        <button
                          onClick={() => toggle(grp.key)}
                          className="inline-flex items-center gap-1 text-foreground hover:text-primary text-xs"
                        >
                          {isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className={atrasadoGrp ? "text-red-700" : ""}>
                            {fmtBR(grp.ancora)} - Total - {grp.linhas.length} Pedidos
                          </span>
                        </button>
                      </td>
                      {tamanhosColunas.map((t) => (
                        <td key={t} className="px-1 py-1.5 text-center tabular-nums text-amber-700 text-xs">
                          {grp.subtotais[t] ? `-${grp.subtotais[t]}` : "–"}
                        </td>
                      ))}
                      <td className="px-1 py-1.5 text-right tabular-nums text-amber-700 text-xs">-{grp.total}</td>
                      <td className="px-1 py-1.5"> </td>
                    </tr>
                    {isExp && grp.rows.map((r) => {
                      const hex = corHex(r.grupo.cor); const fg = corTextoSobre(hex);
                      return (
                        <tr
                          key={`${r.pedido.id}|${r.grupo.modelo}|${r.grupo.cor}`}
                          className="border-t hover:bg-accent/40 cursor-pointer leading-tight"
                          onClick={() => setHistorico(r.pedido)}
                        >
                          {r.primeira ? (
                            <td className="px-1 py-1 align-middle break-words text-xs" rowSpan={r.rowSpan}>
                              <div>{r.pedido.orcamento ?? "—"}</div>
                              {(r.pedido as any).pedido_olist && (
                                <div className="text-[10px] text-muted-foreground">Olist {(r.pedido as any).pedido_olist}</div>
                              )}
                            </td>
                          ) : null}
                          <td className="px-1 py-1 whitespace-nowrap">{r.grupo.modelo}</td>
                          <td className="px-1 py-1">
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: hex, color: fg }}>{r.grupo.cor}</span>
                          </td>
                          {tamanhosColunas.map((t) => {
                            const info = r.grupo.porTamanho.get(t);
                            return (
                              <td key={t} className="px-1 py-1 text-center tabular-nums">
                                {info ? (
                                  <button
                                    type="button"
                                    className="text-amber-700 font-semibold hover:underline text-xs"
                                    onClick={(e) => { e.stopPropagation(); setPopupPeca({ modelo: r.grupo.modelo, cor: r.grupo.cor, tamanho: t }); }}
                                    title="Ver romaneios e pedidos com esta peça"
                                  >
                                    -{info.falta}
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-1 py-1 text-right tabular-nums text-amber-700 font-semibold text-xs">-{r.grupo.faltaTotal}</td>
                          <td className="px-1 py-0 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" className="h-6 px-2 text-xs" style={btnStyle("dar_baixa")} onClick={() => setBaixa({ pedido: r.pedido, grupo: r.grupo })}>
                              Baixa
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
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
              <table className="w-full text-[12.5px] leading-[1.2]">
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

      {popupPeca && (
        <FaltaPecaPopup
          open={!!popupPeca}
          onOpenChange={(o) => !o && setPopupPeca(null)}
          modelo={popupPeca.modelo}
          cor={popupPeca.cor}
          tamanho={popupPeca.tamanho}
          pedidos={pedidos}
          cops={cops}
          oficinas={oficinas}
        />
      )}
    </div>
  );
}
