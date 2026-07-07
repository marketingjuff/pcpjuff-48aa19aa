import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMapData, prodCode, fmtDateBR, type MapProducao } from "@/lib/map";

type Filtro = "em_andamento" | "finalizada" | "todas";

interface Devolucao {
  id: string;
  producao_id: string;
  nota_fiscal: string;
  cor: string;
  pecas: number;
  kg: number;
  faturado_para: string;
  data_devolucao: string;
  obs: string | null;
  status: "em_andamento" | "finalizada";
  created_at: string;
  created_by: string | null;
  finalizada_em: string | null;
  finalizada_por: string | null;
}

export function DevolucoesTab() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("em_andamento");

  const { producoes: prodProg } = useMapData(false);
  const { producoes: prodFin } = useMapData(true);
  const prodMap = useMemo(() => {
    const m = new Map<string, MapProducao>();
    for (const p of prodProg.data ?? []) m.set(p.id, p);
    for (const p of prodFin.data ?? []) m.set(p.id, p);
    return m;
  }, [prodProg.data, prodFin.data]);

  const q = useQuery({
    queryKey: ["map", "devolucoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("map_devolucoes")
        .select("*")
        .order("data_devolucao", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Devolucao[];
    },
  });

  const linhas = useMemo(() => {
    const rows = q.data ?? [];
    if (filtro === "todas") return rows;
    return rows.filter((r) => r.status === filtro);
  }, [q.data, filtro]);

  async function alterarStatus(row: Devolucao, novo: "em_andamento" | "finalizada") {
    const { data: u } = await supabase.auth.getUser();
    const patch =
      novo === "finalizada"
        ? { status: "finalizada", finalizada_em: new Date().toISOString(), finalizada_por: u.user?.id ?? null }
        : { status: "em_andamento", finalizada_em: null, finalizada_por: null };
    const { error } = await (supabase as any).from("map_devolucoes").update(patch).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["map", "devolucoes"] });
    toast.success(novo === "finalizada" ? "Devolução finalizada." : "Devolução reaberta.");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Filtro:</span>
        <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="finalizada">Finalizadas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{linhas.length} devolução(ões)</span>
      </div>

      <div className="overflow-auto rounded-lg border border-border/60 bg-card">
        <table className="w-full text-xs">
          <thead className="bg-yellow-100/60 text-left">
            <tr>
              <th className="p-2">Prod</th>
              <th className="p-2">NF</th>
              <th className="p-2">Cor</th>
              <th className="p-2 text-right">Peças</th>
              <th className="p-2 text-right">Kg</th>
              <th className="p-2 text-center">Faturado para</th>
              <th className="p-2 text-center">Data</th>
              <th className="p-2">Obs</th>
              <th className="p-2 text-center">Status</th>
              <th className="p-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!q.isLoading && linhas.length === 0 && (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Sem devoluções.</td></tr>
            )}
            {linhas.map((r, i) => {
              const p = prodMap.get(r.producao_id);
              return (
                <tr key={r.id} className={`border-t ${i % 2 ? "bg-muted/20" : ""}`}>
                  <td className="p-2 font-semibold tabular-nums">{p ? prodCode(p.numero) : "—"}</td>
                  <td className="p-2">{r.nota_fiscal}</td>
                  <td className="p-2">{r.cor}</td>
                  <td className="p-2 text-right tabular-nums">{Number(r.pecas).toLocaleString("pt-BR")}</td>
                  <td className="p-2 text-right tabular-nums">{Number(r.kg).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                  <td className="p-2 text-center font-bold">{r.faturado_para}</td>
                  <td className="p-2 text-center">{fmtDateBR(r.data_devolucao)}</td>
                  <td className="p-2 max-w-[240px] truncate" title={r.obs ?? ""}>{r.obs ?? "—"}</td>
                  <td className="p-2 text-center">
                    {r.status === "finalizada"
                      ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Finalizada</Badge>
                      : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Em andamento</Badge>}
                  </td>
                  <td className="p-2 text-right">
                    {r.status === "em_andamento" ? (
                      <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => alterarStatus(r, "finalizada")}>Finalizar</Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => alterarStatus(r, "em_andamento")}>Reabrir</Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
