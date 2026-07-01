import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronRight, ChevronDown } from "lucide-react";
import { type Cop, type Oficina } from "@/lib/cop";
import { arvoreOficinasHoje, TAMANHOS_PIVOT, type NoOficina } from "@/lib/cop-oficinas";

type Row =
  | { kind: "of"; key: string; node: NoOficina; expanded: boolean }
  | { kind: "cop"; key: string; ofId: string; copId: string; rotulo: string; total: number; expanded: boolean }
  | { kind: "mod"; key: string; ofId: string; copId: string; modelo: string; total: number; expanded: boolean }
  | { kind: "cor"; key: string; cor: string; porTamanho: Record<string, number>; total: number };

const NUM = (n: number) => (n > 0 ? n : "–");

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
      .on("postgres_changes", { event: "*", schema: "public", table: "cops" }, () => qc.invalidateQueries({ queryKey: ["cops"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const arvore = useMemo(() => arvoreOficinasHoje(cops, oficinas), [cops, oficinas]);

  // Todas as chaves possíveis
  const allKeys = useMemo(() => {
    const ofs: string[] = [];
    const cps: string[] = [];
    const mds: string[] = [];
    for (const o of arvore) {
      ofs.push(`of:${o.oficina.id}`);
      for (const c of o.cops) {
        cps.push(`cop:${o.oficina.id}/${c.cop.id}`);
        for (const m of c.modelos) {
          mds.push(`mod:${o.oficina.id}/${c.cop.id}/${m.modelo}`);
        }
      }
    }
    return { ofs, cps, mds, all: [...ofs, ...cps, ...mds] };
  }, [arvore]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Semear: oficinas expandidas quando a lista de oficinas mudar
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const k of allKeys.ofs) if (!prev.has(k)) next.add(k);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allKeys.ofs.join("|")]);

  const toggle = (k: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  };

  const expandirTudo = () => setExpanded(new Set(allKeys.all));
  const recolherTudo = () => setExpanded(new Set());

  const rows: Row[] = useMemo(() => {
    const r: Row[] = [];
    for (const o of arvore) {
      const kOf = `of:${o.oficina.id}`;
      const eOf = expanded.has(kOf);
      r.push({ kind: "of", key: kOf, node: o, expanded: eOf });
      if (!eOf) continue;
      for (const c of o.cops) {
        const kCop = `cop:${o.oficina.id}/${c.cop.id}`;
        const eCop = expanded.has(kCop);
        r.push({ kind: "cop", key: kCop, ofId: o.oficina.id, copId: c.cop.id, rotulo: c.rotulo, total: c.total, expanded: eCop });
        if (!eCop) continue;
        for (const m of c.modelos) {
          const kMod = `mod:${o.oficina.id}/${c.cop.id}/${m.modelo}`;
          const eMod = expanded.has(kMod);
          r.push({ kind: "mod", key: kMod, ofId: o.oficina.id, copId: c.cop.id, modelo: m.modelo, total: m.total, expanded: eMod });
          if (!eMod) continue;
          for (const cor of m.cores) {
            r.push({
              kind: "cor",
              key: `cor:${o.oficina.id}/${c.cop.id}/${m.modelo}/${cor.cor}`,
              cor: cor.cor,
              porTamanho: cor.porTamanho,
              total: cor.total,
            });
          }
        }
      }
    }
    return r;
  }, [arvore, expanded]);

  const totalGeral = useMemo(() => arvore.reduce((s, g) => s + g.total, 0), [arvore]);
  const totalRomaneios = useMemo(() => arvore.reduce((s, g) => s + g.cops.length, 0), [arvore]);

  // Estilos sticky reutilizáveis
  const stickyBg = "bg-background";
  const parentBg = "bg-muted/20";
  const thBg = "bg-muted/40";
  // left offsets (px): 0, 200, 340, 480
  const colL: Record<number, string> = {
    0: "sticky left-0 z-10",
    1: "sticky left-[200px] z-10",
    2: "sticky left-[340px] z-10",
    3: "sticky left-[480px] z-10",
  };
  const colWidths: Record<number, string> = {
    0: "w-[200px] min-w-[200px]",
    1: "w-[140px] min-w-[140px]",
    2: "w-[140px] min-w-[140px]",
    3: "w-[140px] min-w-[140px]",
  };

  const Chevron = ({ open, onClick }: { open: boolean; onClick: () => void }) => (
    <button onClick={onClick} className="inline-flex items-center justify-center h-4 w-4 mr-1 align-middle text-muted-foreground hover:text-foreground">
      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
    </button>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Oficinas Hoje</h2>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ["cops"] })} title="Recarregar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={expandirTudo}>Expandir tudo</Button>
          <Button variant="outline" size="sm" onClick={recolherTudo}>Recolher tudo</Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {arvore.length} oficinas · {totalRomaneios} romaneios · {totalGeral} peças
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : arvore.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">Nenhuma oficina com romaneio ativo no momento.</CardContent></Card>
      ) : (
        <div className="rounded-md border overflow-auto max-h-[75vh]">
          <table className="text-sm border-collapse w-max min-w-full">
            <thead className={`${thBg} text-xs sticky top-0 z-30`}>
              <tr>
                <th className={`${colL[0]} ${colWidths[0]} ${thBg} p-2 text-left border-r`}>Oficina</th>
                <th className={`${colL[1]} ${colWidths[1]} ${thBg} p-2 text-left border-r`}>COP</th>
                <th className={`${colL[2]} ${colWidths[2]} ${thBg} p-2 text-left border-r`}>Modelo</th>
                <th className={`${colL[3]} ${colWidths[3]} ${thBg} p-2 text-left border-r`}>Cor</th>
                {TAMANHOS_PIVOT.map((t) => (
                  <th key={t} className="w-12 min-w-[3rem] p-2 text-right">{t}</th>
                ))}
                <th className={`sticky right-0 z-30 ${thBg} p-2 text-right border-l w-[110px] min-w-[110px]`}>Total Geral</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isParent = row.kind !== "cor";
                const bg = isParent ? parentBg : stickyBg;
                return (
                  <tr key={row.key} className={`border-t ${isParent ? parentBg : ""} hover:bg-accent/30`}>
                    {/* Oficina */}
                    <td className={`${colL[0]} ${colWidths[0]} ${bg} p-2 border-r truncate`}>
                      {row.kind === "of" && (
                        <span className="font-semibold">
                          <Chevron open={row.expanded} onClick={() => toggle(row.key)} />
                          {row.node.oficina.nome}
                        </span>
                      )}
                    </td>
                    {/* COP */}
                    <td className={`${colL[1]} ${colWidths[1]} ${bg} p-2 border-r truncate`}>
                      {row.kind === "cop" && (
                        <span className="font-semibold tabular-nums">
                          <Chevron open={row.expanded} onClick={() => toggle(row.key)} />
                          {row.rotulo}
                        </span>
                      )}
                    </td>
                    {/* Modelo */}
                    <td className={`${colL[2]} ${colWidths[2]} ${bg} p-2 border-r truncate`}>
                      {row.kind === "mod" && (
                        <span className="font-medium">
                          <Chevron open={row.expanded} onClick={() => toggle(row.key)} />
                          {row.modelo}
                        </span>
                      )}
                    </td>
                    {/* Cor */}
                    <td className={`${colL[3]} ${colWidths[3]} ${bg} p-2 border-r truncate`}>
                      {row.kind === "cor" && <span>{row.cor}</span>}
                    </td>
                    {/* Tamanhos */}
                    {TAMANHOS_PIVOT.map((t) => (
                      <td key={t} className="w-12 min-w-[3rem] p-2 text-right tabular-nums text-muted-foreground">
                        {row.kind === "cor" ? NUM(row.porTamanho[t] ?? 0) : ""}
                      </td>
                    ))}
                    {/* Total Geral */}
                    <td className={`sticky right-0 ${bg} p-2 text-right tabular-nums font-semibold border-l w-[110px] min-w-[110px]`}>
                      {row.kind === "of" ? row.node.total :
                       row.kind === "cop" ? row.total :
                       row.kind === "mod" ? row.total :
                       row.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
