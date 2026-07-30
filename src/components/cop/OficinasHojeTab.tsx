import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronRight, ChevronDown } from "lucide-react";
import { type Cop, type Oficina } from "@/lib/cop";
import {
  arvoreProducaoHoje,
  tamanhosVisiveis,
  subtotaisPorTamanho,
  totaisGeraisPorTamanho,
  OFICINA_EM_CORTE,
  type NoOficina,
} from "@/lib/cop-oficinas";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { useTableSort, SortTh, type SortDir } from "@/components/shared/sortable";

const NUM = (n: number) => (n > 0 ? n : "–");

type Row =
  | {
      kind: "cor";
      key: string;
      groupId: string;
      oficinaNome: string;
      copId: string;
      copRotulo: string;
      modelo: string;
      cor: string;
      porTamanho: Record<string, number>;
      total: number;
    }
  | {
      kind: "subtotal";
      key: string;
      groupId: string;
      nome: string;
      porTamanho: Record<string, number>;
      total: number;
      expanded: boolean;
      isEmCorte: boolean;
    };

export function OficinasHojeTab() {
  const qc = useQueryClient();

  const { data: cops = [], isLoading } = useQuery({
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

  useEffect(() => {
    const ch = supabase
      .channel("cops-oficinas-hoje")
      .on("postgres_changes", { event: "*", schema: "public", table: "cops" }, () =>
        qc.invalidateQueries({ queryKey: ["cops"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const gruposBase = useMemo<NoOficina[]>(() => arvoreProducaoHoje(cops, oficinas), [cops, oficinas]);
  const tamanhos = useMemo(() => tamanhosVisiveis(gruposBase), [gruposBase]);

  const { sortKey, sortDir, toggle: toggleSort } = useTableSort(gruposBase, {});

  function copSortValue(c: NoOficina["cops"][number], key: string): string | number {
    if (key === "cop") return c.rotulo;
    if (key === "modelo") return c.modelos[0]?.modelo ?? "";
    if (key === "cor") return c.modelos[0]?.cores[0]?.cor ?? "";
    if (key === "total") return c.total;
    return c.modelos.reduce((s, m) => s + m.cores.reduce((s2, cor) => s2 + (cor.porTamanho[key] ?? 0), 0), 0);
  }

  const grupos = useMemo<NoOficina[]>(() => {
    if (!sortKey) return gruposBase;
    const mult = sortDir === "asc" ? 1 : -1;
    if (sortKey === "oficina") {
      return [...gruposBase].sort((a, b) => a.oficina.nome.localeCompare(b.oficina.nome, "pt-BR") * mult);
    }
    return gruposBase.map((g) => ({
      ...g,
      cops: [...g.cops].sort((a, b) => {
        const va = copSortValue(a, sortKey);
        const vb = copSortValue(b, sortKey);
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * mult;
        return String(va).localeCompare(String(vb), "pt-BR", { numeric: true, sensitivity: "base" }) * mult;
      }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gruposBase, sortKey, sortDir]);

  const allGroupKeys = useMemo(() => grupos.map((g) => g.oficina.id), [grupos]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Seed: começa tudo expandido quando lista muda
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const k of allGroupKeys) if (!prev.has(k)) next.add(k);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGroupKeys.join("|")]);

  const toggle = (k: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };

  const expandirTudo = () => setExpanded(new Set(allGroupKeys));
  const recolherTudo = () => setExpanded(new Set());

  const rows: Row[] = useMemo(() => {
    const r: Row[] = [];
    for (const g of grupos) {
      const gid = g.oficina.id;
      const isEmCorte = gid === OFICINA_EM_CORTE.id;
      const isExp = expanded.has(gid);
      if (isExp) {
        for (const c of g.cops) {
          for (const m of c.modelos) {
            for (const cor of m.cores) {
              r.push({
                kind: "cor",
                key: `cor:${gid}/${c.cop.id}/${m.modelo}/${cor.cor}`,
                groupId: gid,
                oficinaNome: g.oficina.nome,
                copId: c.cop.id,
                copRotulo: c.rotulo,
                modelo: m.modelo,
                cor: cor.cor,
                porTamanho: cor.porTamanho,
                total: cor.total,
              });
            }
          }
        }
      }
      r.push({
        kind: "subtotal",
        key: `sub:${gid}`,
        groupId: gid,
        nome: g.oficina.nome,
        porTamanho: subtotaisPorTamanho(g, tamanhos),
        total: g.total,
        expanded: isExp,
        isEmCorte,
      });
    }
    return r;
  }, [grupos, expanded, tamanhos]);

  const totaisGerais = useMemo(() => totaisGeraisPorTamanho(grupos, tamanhos), [grupos, tamanhos]);
  const totalGeral = useMemo(() => grupos.reduce((s, g) => s + g.total, 0), [grupos]);
  const totalRomaneios = useMemo(() => grupos.reduce((s, g) => s + g.cops.length, 0), [grupos]);
  const numOficinas = grupos.filter((g) => g.oficina.id !== OFICINA_EM_CORTE.id).length;

  // Supressão visual: comparar com linha de cor anterior no mesmo grupo
  let prevGroup = "";
  let prevCop = "";
  let prevModelo = "";
  let copIdx = -1;
  let lastCopKey = "";


  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Oficinas Hoje</h2>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => qc.invalidateQueries({ queryKey: ["cops"] })}
            title="Recarregar"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={expandirTudo}>
            Expandir tudo
          </Button>
          <Button variant="outline" size="sm" onClick={recolherTudo}>
            Recolher tudo
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {numOficinas} oficinas · {totalRomaneios} romaneios · {totalGeral} peças
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : grupos.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground text-center">
            Nenhuma oficina com romaneio ativo no momento.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-auto max-h-[75vh]">
          <table className="text-[12.5px] leading-[1.2] border-collapse w-max min-w-full">
            <thead className="bg-muted/50 text-xs sticky top-0 z-20">
              <tr>
                <SortTh label="Oficina" sortKey="oficina" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-left border-r w-[160px] min-w-[160px]" />
                <SortTh label="COP" sortKey="cop" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-left border-r w-[90px] min-w-[90px]" />
                <SortTh label="Modelo" sortKey="modelo" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-left border-r w-[140px] min-w-[140px]" />
                <SortTh label="Cor" sortKey="cor" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-left border-r w-[120px] min-w-[120px]" />
                {tamanhos.map((t) => (
                  <SortTh key={t} label={t} sortKey={t} current={sortKey} dir={sortDir} onSort={toggleSort} className="w-11 min-w-[2.75rem] text-right" />
                ))}
                <SortTh label="Total" sortKey="total" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right border-l w-[80px] min-w-[80px]" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                if (row.kind === "subtotal") {
                  prevGroup = "";
                  prevCop = "";
                  prevModelo = "";
                  lastCopKey = "";
                  return (
                    <tr key={row.key} className="border-t bg-muted/60 font-semibold">

                      <td className="p-1.5 border-r" colSpan={4}>
                        <button
                          onClick={() => toggle(row.groupId)}
                          className="inline-flex items-center gap-1 text-foreground hover:text-primary"
                        >
                          {row.expanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          <span>Total {row.nome}</span>
                          {row.isEmCorte && (
                            <span
                              className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
                            >
                              não enviado
                            </span>
                          )}
                        </button>
                      </td>
                      {tamanhos.map((t) => (
                        <td
                          key={t}
                          className="w-11 min-w-[2.75rem] p-1.5 text-right tabular-nums"
                        >
                          {NUM(row.porTamanho[t] ?? 0)}
                        </td>
                      ))}
                      <td className="p-1.5 text-right tabular-nums border-l">{row.total}</td>
                    </tr>
                  );
                }

                // linha de cor — supressão
                const showOf = row.groupId !== prevGroup;
                const showCop = showOf || row.copId !== prevCop;
                const showMod = showCop || row.modelo !== prevModelo;
                prevGroup = row.groupId;
                prevCop = row.copId;
                prevModelo = row.modelo;

                const hex = corHex(row.cor);
                const fg = corTextoSobre(hex);
                const isEmCorte = row.groupId === OFICINA_EM_CORTE.id;

                const copKey = `${row.groupId}|${row.copId}`;
                if (copKey !== lastCopKey) { copIdx++; lastCopKey = copKey; }
                const zebra = copIdx % 2 === 1;

                return (
                  <tr key={row.key} className={`border-t hover:bg-accent/30 ${zebra ? "bg-muted/80" : ""}`}>

                    <td className="p-1.5 border-r truncate">
                      {showOf ? (
                        <span className="font-medium">
                          {row.oficinaNome}
                          {isEmCorte && (
                            <span
                              className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
                            >
                              não enviado
                            </span>
                          )}
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="p-1.5 border-r truncate tabular-nums">
                      {showCop ? row.copRotulo : ""}
                    </td>
                    <td className="p-1.5 border-r truncate">{showMod ? row.modelo : ""}</td>
                    <td className="p-1.5 border-r truncate">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs align-middle font-bold"
                        style={{ backgroundColor: hex, color: fg }}
                      >
                        {row.cor}
                      </span>
                    </td>
                    {tamanhos.map((t) => (
                      <td
                        key={t}
                        className="w-11 min-w-[2.75rem] p-1.5 text-right tabular-nums text-muted-foreground"
                      >
                        {NUM(row.porTamanho[t] ?? 0)}
                      </td>
                    ))}
                    <td className="p-1.5 text-right tabular-nums font-semibold border-l">
                      {row.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr
                style={{
                  backgroundColor: "#9FE1CB",
                  color: "#04342C",
                  borderTop: "1.5px solid #1D9E75",
                }}
              >
                <td className="p-1.5 font-bold" colSpan={4}>
                  Total geral
                </td>
                {tamanhos.map((t) => (
                  <td
                    key={t}
                    className="w-11 min-w-[2.75rem] p-1.5 text-right tabular-nums font-semibold"
                  >
                    {NUM(totaisGerais[t] ?? 0)}
                  </td>
                ))}
                <td
                  className="p-1.5 text-right tabular-nums font-bold border-l"
                  style={{ backgroundColor: "#5DCAA5" }}
                >
                  {totalGeral}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
