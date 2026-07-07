import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppList } from "@/lib/app-lists";
import type { MapProducao, MapEntregaMalharia } from "@/lib/map";
import { calcQuebra, patchEntrega, patchProducao, sumKgEntregas } from "@/lib/map";
import { InlineInput } from "./InlineInput";
import { BaixaQuebraDialog } from "./BaixaQuebraDialog";

interface Props {
  producao: MapProducao;
  entregas: MapEntregaMalharia[];
  kgPorPeca: number;
  onChanged: () => void;
  readOnly?: boolean;
}

export function MalhariaBlock({ producao, entregas, kgPorPeca, onChanged, readOnly }: Props) {
  const [dlgBaixa, setDlgBaixa] = useState(false);
  const [adding, setAdding] = useState(false);

  const quebraKg = calcQuebra(producao, entregas);
  const quebraPecas = kgPorPeca > 0 ? quebraKg / kgPorPeca : 0;
  const totalKg = sumKgEntregas(entregas);

  async function addEntrega() {
    setAdding(true);
    const { error } = await (supabase as any)
      .from("map_malharia_entregas")
      .insert({ producao_id: producao.id });
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    onChanged();
  }

  async function delEntrega(id: string) {
    const { error } = await (supabase as any)
      .from("map_malharia_entregas")
      .delete()
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  }

  async function commit(id: string, field: keyof MapEntregaMalharia, raw: string | null) {
    try {
      let value: any = raw;
      if (field === "kg" || field === "pecas") {
        value = raw === null || raw === "" ? null : Number(raw);
      }
      await patchEntrega(id, { [field]: value } as any);
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
  }

  return (
    <div className="rounded-md border bg-white/70 p-2 space-y-1">
      <div className="flex items-center justify-between">
        <div className="text-xs">
          <span className="text-muted-foreground">Malharia: </span>
          <b>{producao.malharia ?? "—"}</b>
          <span className="ml-3 text-muted-foreground">Total recebido: </span>
          <b className="tabular-nums">{totalKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg</b>
        </div>
        {!readOnly && (
          <Button size="sm" variant="outline" className="h-7" onClick={addEntrega} disabled={adding}>
            <Plus className="h-3 w-3 mr-1" /> Entrega
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-[12.5px] table-fixed">
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "6%" }} />
          </colgroup>
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="p-1.5 font-medium">Data recebimento</th>
              <th className="p-1.5 font-medium">Kg</th>
              <th className="p-1.5 font-medium">Peças</th>
              <th className="p-1.5 font-medium">NF 1</th>
              <th className="p-1.5 font-medium">NF cobertura</th>
              <th className="p-1.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {entregas.length === 0 ? (
              <tr><td colSpan={6} className="p-2 text-center text-muted-foreground">Sem entregas.</td></tr>
            ) : entregas.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-1"><InlineInput type="date" value={e.data_recebimento} onCommit={(v) => commit(e.id, "data_recebimento", v)} disabled={readOnly} /></td>
                <td className="p-1"><InlineInput type="number" step="0.01" min="0" value={e.kg} onCommit={(v) => commit(e.id, "kg", v)} disabled={readOnly} /></td>
                <td className="p-1"><InlineInput type="number" step="1" min="0" value={e.pecas} onCommit={(v) => commit(e.id, "pecas", v)} disabled={readOnly} /></td>
                <td className="p-1"><InlineInput value={e.nota_fiscal_1} onCommit={(v) => commit(e.id, "nota_fiscal_1", v)} disabled={readOnly} /></td>
                <td className="p-1"><InlineInput value={e.nota_cobertura} onCommit={(v) => commit(e.id, "nota_cobertura", v)} disabled={readOnly} /></td>
                <td className="p-1 text-right">
                  {!readOnly && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => delEntrega(e.id)} title="Remover">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-1 pt-1 text-xs">
        <div className="text-muted-foreground">
          Quebra: <b className="tabular-nums text-foreground">{quebraKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg</b>
          {" "}(~<span className="tabular-nums">{quebraPecas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span> peças)
          {producao.quebra_conciliada && <Badge variant="outline" className="ml-2 bg-emerald-50 text-emerald-700 border-emerald-200">Conciliada</Badge>}
        </div>
        {!readOnly && (
          producao.quebra_conciliada ? (
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={async () => {
              try { await patchProducao(producao.id, { quebra_conciliada: false, quebra_conciliacao_obs: null, quebra_conciliada_em: null, quebra_conciliada_por: null }); onChanged(); toast.success("Baixa desfeita."); }
              catch (err: any) { toast.error(err?.message ?? "Erro."); }
            }}>Desfazer baixa</Button>
          ) : (
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setDlgBaixa(true)}>Dar baixa</Button>
          )
        )}
      </div>

      {producao.quebra_conciliada && producao.quebra_conciliacao_obs && (
        <div className="text-[11px] text-muted-foreground px-1 italic">Obs: {producao.quebra_conciliacao_obs}</div>
      )}

      <BaixaQuebraDialog
        open={dlgBaixa}
        onOpenChange={setDlgBaixa}
        producaoId={producao.id}
        quebraKg={quebraKg}
        quebraPecas={quebraPecas}
        onDone={onChanged}
      />
    </div>
  );
}
