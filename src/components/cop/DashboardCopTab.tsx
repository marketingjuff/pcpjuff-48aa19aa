import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { useCopColorSettings } from "@/hooks/use-cop-color-settings";
import { COP_STATUS_LIST, totalPecasCop, rotuloCop, rotuloRomaneio, type Cop, type CopUrgencia } from "@/lib/cop";
import { REFACAO_TAMANHOS, cmpModeloCor, type Pedido } from "@/lib/pedidos";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { calcEmProducao, calcFaltantes, calcRecebido, calcPerdas, calcDisponivel, pkKey, dataUrgencia, addDiasUteis } from "@/lib/cop-saldos";
import { formatDateBR } from "@/lib/format";
import { useTableSort, SortTh } from "@/components/shared/sortable";

export function DashboardCopTab() {
  const qc = useQueryClient();
  const { etapaStyle } = useCopColorSettings();

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
  const { data: oficinas = [] } = useQuery({
    queryKey: ["oficinas-dash"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oficinas" as any).select("id, nome");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; nome: string }[];
    },
  });

  const oficinaNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of oficinas) m.set(o.id, o.nome);
    return m;
  }, [oficinas]);


  useEffect(() => {
    const ch = supabase
      .channel("cop-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "cops" }, () => qc.invalidateQueries({ queryKey: ["cops"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => qc.invalidateQueries({ queryKey: ["pedidos-cop-saldos"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const contagemStatus = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of COP_STATUS_LIST) m[s] = 0;
    for (const c of cops) m[c.status] = (m[c.status] ?? 0) + 1;
    return m;
  }, [cops]);

  const totalProducao = useMemo(() => {
    return cops.reduce((s, c) => {
      if (c.status === "Aguardando Risco" || c.status === "Aguardando Corte") return s;
      return s + totalPecasCop(c.pecas);
    }, 0);
  }, [cops]);

  const producao = useMemo(() => calcEmProducao(cops), [cops]);
  const faltantes = useMemo(() => calcFaltantes(pedidos), [pedidos]);
  const recebido = useMemo(() => calcRecebido(cops), [cops]);
  const perdas = useMemo(() => calcPerdas(cops), [cops]);
  const disponivel = useMemo(() => calcDisponivel(producao, faltantes, recebido, perdas), [producao, faltantes, recebido, perdas]);

  const saldoGeral = useMemo(() => {
    let s = 0;
    for (const v of disponivel.values()) s += v;
    return s;
  }, [disponivel]);

  const topNegativos = useMemo(() => {
    const arr = Array.from(disponivel.entries())
      .map(([k, v]) => ({ k, v }))
      .filter((x) => x.v < 0)
      .sort((a, b) => a.v - b.v)
      .slice(0, 5);
    return arr.map((x) => {
      const [modelo, cor, tamanho] = x.k.split("|");
      return { modelo, cor, tamanho, saldo: x.v };
    });
  }, [disponivel]);

  const urgentes = useMemo(() => {
    const incompletos = pedidos.filter((p) => p.status_pecas === "incompleto");
    return incompletos
      .map((p) => ({ p, ancora: dataUrgencia(p) }))
      .filter((x) => !!x.ancora)
      .sort((a, b) => (a.ancora! > b.ancora! ? 1 : -1))
      .slice(0, 10);
  }, [pedidos]);

  const topNegSort = useTableSort(topNegativos, {
    item: (x) => `${x.modelo} ${x.cor} ${x.tamanho}`,
    saldo: (x) => x.saldo,
  });

  const urgentesSort = useTableSort(urgentes, {
    orcamento: (x) => x.p.orcamento ?? "",
    pedido: (x) => (x.p as any).pedido_olist ?? "",
    limite: (x) => (x.ancora ? addDiasUteis(x.ancora, -2) : null),
    inicio: (x) => x.ancora ?? null,
  });

  type LinhaConsol = { modelo: string; cor: string; todos: boolean; tamanhos: Map<string, number> };
  type CopUrg = { cop: Cop; ultimaEm: string; qtdPedidos: number; linhas: LinhaConsol[] };

  const romaneiosComUrgencia = useMemo<CopUrg[]>(() => {
    const tamIdx = (t: string) => {
      const i = (REFACAO_TAMANHOS as readonly string[]).indexOf(t);
      return i === -1 ? 999 : i;
    };
    const ativos = cops.filter((c) => c.status !== "Finalizado" && (c.urgencias?.length ?? 0) > 0);
    const out: CopUrg[] = ativos.map((c) => {
      const urgs = (c.urgencias ?? []) as CopUrgencia[];
      let ultimaEm = "";
      for (const u of urgs) if (u.em && u.em > ultimaEm) ultimaEm = u.em;
      const mapa = new Map<string, LinhaConsol>();
      for (const u of urgs) {
        for (const l of u.linhas ?? []) {
          const modelo = String(l.modelo).toUpperCase();
          const cor = String(l.cor).toUpperCase();
          const k = `${modelo}|${cor}`;
          let linha = mapa.get(k);
          if (!linha) { linha = { modelo, cor, todos: false, tamanhos: new Map() }; mapa.set(k, linha); }
          if (!l.tamanhos || l.tamanhos.length === 0) {
            linha.todos = true;
          } else {
            for (const t of l.tamanhos) {
              const tam = String(t.tamanho);
              const qtd = Number(t.qtd) || 0;
              if (qtd > 0) linha.tamanhos.set(tam, (linha.tamanhos.get(tam) ?? 0) + qtd);
            }
          }
        }
      }
      const linhas = Array.from(mapa.values()).sort(cmpModeloCor);
      // ordena tamanhos de cada linha
      for (const l of linhas) {
        const entries = Array.from(l.tamanhos.entries()).sort((a, b) => tamIdx(a[0]) - tamIdx(b[0]));
        l.tamanhos = new Map(entries);
      }
      return { cop: c, ultimaEm, qtdPedidos: urgs.length, linhas };
    });
    out.sort((a, b) => (a.ultimaEm > b.ultimaEm ? -1 : a.ultimaEm < b.ultimaEm ? 1 : 0));
    return out;
  }, [cops]);

  const formatDDMM = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  };


  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Dashboard COP</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">COPs ativos</div>
          <div className="text-3xl font-bold tabular-nums">{cops.filter((c) => c.status !== "Finalizado").length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Peças em produção</div>
          <div className="text-3xl font-bold tabular-nums text-green-700">{totalProducao}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Total Geral</div>
          <div className={`text-3xl font-bold tabular-nums ${saldoGeral < 0 ? "text-red-700" : "text-green-700"}`}>{saldoGeral}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Pedidos pendentes</div>
          <div className="text-3xl font-bold tabular-nums">{pedidos.filter((p) => p.status_pecas === "incompleto").length}</div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">COPs por status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {COP_STATUS_LIST.map((s) => (
              <div key={s} className="flex items-center justify-between text-sm">
                <span className="px-2 py-0.5 rounded text-xs border" style={etapaStyle(s)}>{s}</span>
                <span className="tabular-nums font-semibold">{contagemStatus[s] ?? 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top urgências (saldo negativo)</CardTitle></CardHeader>
          <CardContent>
            {topNegativos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tudo coberto.</p>
            ) : (
              <table className="w-full text-[12.5px] leading-[1.2]">
                <thead className="text-xs text-muted-foreground"><tr>
                  <SortTh label="Item" sortKey="item" current={topNegSort.sortKey} dir={topNegSort.sortDir} onSort={topNegSort.toggle} className="text-left" />
                  <SortTh label="Saldo" sortKey="saldo" current={topNegSort.sortKey} dir={topNegSort.sortDir} onSort={topNegSort.toggle} className="text-right" />
                </tr></thead>
                <tbody>
                  {topNegSort.rows.map((x, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-1">{x.modelo} · {x.cor} · {x.tamanho}</td>
                      <td className="p-1 text-right text-red-700 font-bold tabular-nums">{x.saldo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Romaneios com urgência</CardTitle></CardHeader>
        <CardContent>
          {romaneiosComUrgencia.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma urgência ativa.</p>
          ) : (
            <ul className="divide-y">
              {romaneiosComUrgencia.map(({ cop, ultimaEm, qtdPedidos, linhas }) => (
                <li key={cop.id} className="py-2 space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <Flame className="h-3.5 w-3.5 text-red-600 shrink-0" />
                    <span className="font-bold tabular-nums">{rotuloRomaneio(cop, cops)}</span>
                    <span className="text-muted-foreground">· {oficinaNome.get(cop.oficina_id ?? "") ?? "—"}</span>
                    <span
                      className="inline-flex items-center rounded bg-red-100 text-red-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      title={`${qtdPedidos} pedido(s) de urgência`}
                    >
                      URGÊNCIA{qtdPedidos > 1 ? ` ×${qtdPedidos}` : ""}
                    </span>
                    <span className="ml-auto text-muted-foreground tabular-nums">{formatDDMM(ultimaEm)}</span>
                  </div>
                  <div className="pl-5 space-y-0.5">
                    {linhas.map((l, i) => {
                      const hex = corHex(l.cor); const fg = corTextoSobre(hex);
                      const tamsTxt = l.todos
                        ? "todos os tamanhos"
                        : Array.from(l.tamanhos.entries()).map(([t, q]) => `${t}:${q}`).join(" · ");
                      return (
                        <div key={i} className="flex items-center gap-2 text-[12.5px] leading-[1.2] flex-wrap">
                          <span className="font-bold">{l.modelo}</span>
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold"
                            style={{ backgroundColor: hex, color: fg }}
                          >
                            {l.cor}
                          </span>
                          <span className="text-muted-foreground tabular-nums">{tamsTxt || "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Pedidos mais urgentes</CardTitle></CardHeader>
        <CardContent>
          {urgentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem urgências por data conhecida.</p>
          ) : (
            <table className="w-full text-[12.5px] leading-[1.2]">
              <thead className="text-xs text-muted-foreground"><tr>
                <SortTh label="Orçamento" sortKey="orcamento" current={urgentesSort.sortKey} dir={urgentesSort.sortDir} onSort={urgentesSort.toggle} className="text-left" />
                <SortTh label="Pedido Olist" sortKey="pedido" current={urgentesSort.sortKey} dir={urgentesSort.sortDir} onSort={urgentesSort.toggle} className="text-left" />
                <SortTh label="Limite (-2 d.ú.)" sortKey="limite" current={urgentesSort.sortKey} dir={urgentesSort.sortDir} onSort={urgentesSort.toggle} className="text-left" />
                <SortTh label="Início estamp./acab." sortKey="inicio" current={urgentesSort.sortKey} dir={urgentesSort.sortDir} onSort={urgentesSort.toggle} className="text-left" />
              </tr></thead>
              <tbody>
                {urgentesSort.rows.map(({ p, ancora }) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-1 font-mono">{p.orcamento ?? "—"}</td>
                    <td className="p-1 font-mono">{(p as any).pedido_olist ?? "—"}</td>
                    <td className="p-1 tabular-nums whitespace-nowrap">{ancora ? formatDateBR(addDiasUteis(ancora, -2)) : "—"}</td>
                    <td className="p-1 tabular-nums whitespace-nowrap">{formatDateBR(ancora) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Para usar rotuloCop no futuro caso seja necessário no dashboard */}
      <div className="hidden">{rotuloCop(0, null)}</div>
    </div>
  );
}
