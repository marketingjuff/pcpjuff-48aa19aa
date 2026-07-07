import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();
  const { producoes, entregas, invalidateAll } = useMapData(false);
  const { kgPorPeca } = useKgPorPeca();
  const [filtro, setFiltro] = useState<Filtro>("todas");
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

  const todasLinhas = useMemo(() => {
    return (producoes.data ?? []).map((p) => {
      const es = byProdEntregas.get(p.id) ?? [];
      const kg = calcQuebra(p, es);
      const pecas = kgPorPeca > 0 ? kg / kgPorPeca : 0;
      return { prod: p, es, kg, pecas };
    });
  }, [producoes.data, byProdEntregas, kgPorPeca]);

  const totais = useMemo(() => {
    let pendentes = 0, conciliadas = 0, kgTotal = 0;
    for (const r of todasLinhas) {
      if (r.prod.quebra_conciliada) conciliadas++; else pendentes++;
      kgTotal += r.kg;
    }
    return { pendentes, conciliadas, kgTotal };
  }, [todasLinhas]);

  const linhas = useMemo(() => todasLinhas.filter((r) => {
    if (filtro === "todas") return true;
    const conc = !!r.prod.quebra_conciliada;
    return filtro === "conciliada" ? conc : !conc;
  }), [todasLinhas, filtro]);

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

  function abrirProd(prod: MapProducao) {
    navigate({ to: "/map", search: { tab: "programacao", prodId: prod.id } });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-lg border bg-amber-50 border-amber-200 p-3">
          <div className="text-[11px] uppercase text-amber-800/80 font-medium tracking-wide">Pendentes</div>
          <div className="text-2xl font-semibold tabular-nums text-amber-900">{totais.pendentes}</div>
        </div>
        <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-3">
          <div className="text-[11px] uppercase text-emerald-800/80 font-medium tracking-wide">Conciliadas</div>
          <div className="text-2xl font-semibold tabular-nums text-emerald-900">{totais.conciliadas}</div>
        </div>
        <div className="rounded-lg border bg-yellow-100/60 border-yellow-300 p-3">
          <div className="text-[11px] uppercase text-yellow-900/70 font-medium tracking-wide">Quebra total</div>
          <div className="text-2xl font-semibold tabular-nums text-yellow-900">
            {totais.kgTotal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} <span className="text-sm font-medium">kg</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Filtro:</span>
        <div onClick={(e) => e.stopPropagation()}>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="conciliada">Conciliada</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
            {linhas.map(({ prod, es, kg }, i) => {
              const conc = !!prod.quebra_conciliada;
              const rowBg = conc ? "bg-emerald-50 hover:bg-emerald-100/70" : (i % 2 ? "bg-muted/20" : "");
              return (
                <tr
                  key={prod.id}
                  className={`border-t cursor-pointer ${rowBg}`}
                  onClick={() => abrirProd(prod)}
                  title="Abrir PROD"
                >
                  <td className="p-2 font-semibold tabular-nums">{prodCode(prod.numero)}</td>
                  <td className="p-2 text-center font-bold uppercase">{prod.faturar_para}</td>
                  <td className="p-2">{prod.fornecedor}</td>
                  <td className="p-2 text-right tabular-nums">{Number(prod.kg_solicitados).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                  <td className="p-2 text-right tabular-nums">{sumKgEntregas(es).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                  <td className="p-2 text-right tabular-nums">{kg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                  <td className="p-2 text-center">
                    {conc
                      ? <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">Conciliada</Badge>
                      : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>}
                  </td>
                  <td className="p-2 text-right" onClick={(e) => e.stopPropagation()}>
                    {conc ? (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => desfazer(prod)}>Desfazer baixa</Button>
                    ) : (
                      <Button size="sm" className="h-7 text-xs" onClick={() => setDlg({ prod, kg, pecas: kgPorPeca > 0 ? kg / kgPorPeca : 0 })}>
                        Dar baixa
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
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
