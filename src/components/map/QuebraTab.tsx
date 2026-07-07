import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  useMapData, useKgPorPeca, prodCode, calcQuebra, sumKgEntregas, patchProducao,
  type MapProducao, type MapEntregaMalharia,
} from "@/lib/map";
import { BaixaQuebraDialog } from "./BaixaQuebraDialog";

type Filtro = "pendente" | "conciliada" | "todas";

export function QuebraTab() {
  const { producoes, entregas, invalidateAll } = useMapData(false);
  const { kgPorPeca } = useKgPorPeca();
  const [filtro, setFiltro] = useState<Filtro>("pendente");
  const [dlg, setDlg] = useState<{ prod: MapProducao; kg: number; pecas: number } | null>(null);

  const byProdEntregas = useMemo(() => {
    const m = new Map<string, MapEntregaMalharia[]>();
    for (const e of entregas.data ?? []) {
      const arr = m.get(e.producao_id) ?? [];
      arr.push(e);
      m.set(e.producao_id, arr);
    }
    return m;
  }, [entregas.data]);

  const linhas = useMemo(() => {
    const rows = (producoes.data ?? []).map((p) => {
      const es = byProdEntregas.get(p.id) ?? [];
      const kg = calcQuebra(p, es);
      const pecas = kgPorPeca > 0 ? kg / kgPorPeca : 0;
      return { prod: p, es, kg, pecas };
    });
    return rows.filter((r) => {
      if (filtro === "todas") return true;
      const conc = !!r.prod.quebra_conciliada;
      return filtro === "conciliada" ? conc : !conc;
    });
  }, [producoes.data, byProdEntregas, kgPorPeca, filtro]);

  async function desfazer(prod: MapProducao) {
    try {
      await patchProducao(prod.id, {
        quebra_conciliada: false,
        quebra_conciliacao_obs: null,
        quebra_conciliada_em: null,
        quebra_conciliada_por: null,
      });
      invalidateAll();
      toast.success("Baixa desfeita.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao desfazer.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Filtro:</span>
        <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="conciliada">Conciliada</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{linhas.length} PROD(s)</span>
      </div>

      <div className="overflow-auto rounded-lg border border-border/60 bg-card">
        <table className="w-full text-xs">
          <thead className="bg-yellow-100/60 text-left">
            <tr>
              <th className="p-2">Prod</th>
              <th className="p-2 text-center">Empresa</th>
              <th className="p-2">Fornecedor</th>
              <th className="p-2 text-right">Kg solicitados</th>
              <th className="p-2 text-right">Kg recebidos</th>
              <th className="p-2 text-right">Quebra (kg)</th>
              <th className="p-2 text-center">Status</th>
              <th className="p-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Sem registros.</td></tr>
            )}
            {linhas.map(({ prod, es, kg }, i) => (
              <tr key={prod.id} className={`border-t ${i % 2 ? "bg-muted/20" : ""}`}>
                <td className="p-2 font-semibold tabular-nums">{prodCode(prod.numero)}</td>
                <td className="p-2 text-center font-bold">{prod.faturar_para}</td>
                <td className="p-2">{prod.fornecedor}</td>
                <td className="p-2 text-right tabular-nums">{Number(prod.kg_solicitados).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                <td className="p-2 text-right tabular-nums">{sumKgEntregas(es).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                <td className="p-2 text-right tabular-nums">{kg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                <td className="p-2 text-center">
                  {prod.quebra_conciliada
                    ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Conciliada</Badge>
                    : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>}
                </td>
                <td className="p-2 text-right">
                  {prod.quebra_conciliada ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => desfazer(prod)}>Desfazer baixa</Button>
                  ) : (
                    <Button size="sm" className="h-7 text-xs" onClick={() => setDlg({ prod, kg, pecas: kgPorPeca > 0 ? kg / kgPorPeca : 0 })}>
                      Dar baixa
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dlg && (
        <BaixaQuebraDialog
          open={!!dlg}
          onOpenChange={(v) => !v && setDlg(null)}
          producaoId={dlg.prod.id}
          quebraKg={dlg.kg}
          quebraPecas={dlg.pecas}
          onDone={() => { invalidateAll(); setDlg(null); }}
        />
      )}
    </div>
  );
}
