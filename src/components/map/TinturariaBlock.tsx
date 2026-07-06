import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppList } from "@/lib/app-lists";
import type { MapProgramacaoTinturaria } from "@/lib/map";
import { patchProgramacao, sumPecasProgramadas, useCorAcabamentos, corComAcabamento } from "@/lib/map";
import { REFACAO_CORES } from "@/lib/pedidos";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { InlineInput } from "./InlineInput";

const COR_NULA = "__none__";

interface Props {
  producaoId: string;
  programacoes: MapProgramacaoTinturaria[];
  pecasRecebidasMalharia: number;
  kgPorPeca: number;
  onChanged: () => void;
  readOnly?: boolean;
}

export function TinturariaBlock({ producaoId, programacoes, pecasRecebidasMalharia, kgPorPeca, onChanged, readOnly }: Props) {
  const { names: tinturarias } = useAppList("map_tinturaria");
  const { mapa: acabMapa } = useCorAcabamentos();
  const [addingTint, setAddingTint] = useState<string>("");

  const totalProgramado = sumPecasProgramadas(programacoes);
  const Y = pecasRecebidasMalharia;
  const X = totalProgramado;

  let counterClass = "text-muted-foreground";
  let icon = null;
  if (Y > 0) {
    if (X < Y) counterClass = "text-amber-700";
    else if (X === Y) counterClass = "text-emerald-700 font-semibold";
    else { counterClass = "text-red-700 font-semibold"; icon = <AlertTriangle className="h-3.5 w-3.5 inline-block ml-1" />; }
  }

  async function addProg(tint: string) {
    if (!tint) { toast.error("Escolha a tinturaria."); return; }
    const { error } = await (supabase as any)
      .from("map_tinturaria_programacoes")
      .insert({ producao_id: producaoId, tinturaria: tint });
    if (error) { toast.error(error.message); return; }
    setAddingTint("");
    onChanged();
  }

  async function delProg(id: string) {
    const { error } = await (supabase as any)
      .from("map_tinturaria_programacoes")
      .delete()
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  }

  async function commit(row: MapProgramacaoTinturaria, field: keyof MapProgramacaoTinturaria, raw: string | null) {
    try {
      const patch: any = {};
      if (field === "pecas" || field === "kg_enviados" || field === "kg_recebidos" || field === "pecas_recebidas") {
        patch[field] = raw === null || raw === "" ? null : Number(raw);
        // Auto-preenche kg_enviados quando pecas é alterado e kg_enviados está vazio
        if (field === "pecas" && (row.kg_enviados == null)) {
          const n = raw === null || raw === "" ? null : Number(raw);
          if (n != null && kgPorPeca > 0) patch.kg_enviados = n * kgPorPeca;
        }
      } else {
        patch[field] = raw;
      }
      await patchProgramacao(row.id, patch);
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
  }

  return (
    <div className="rounded-md border bg-white/70 p-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs">
          <span className="text-muted-foreground">Tinturaria</span>
          <span className={`ml-3 ${counterClass}`}>
            Programadas: <span className="tabular-nums">{X}</span> / <span className="tabular-nums">{Y}</span>{icon}
          </span>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <Select value={addingTint} onValueChange={setAddingTint}>
              <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Selecionar tinturaria" /></SelectTrigger>
              <SelectContent>
                {tinturarias.length === 0 ? (
                  <SelectItem value="__none__" disabled>Nenhuma cadastrada</SelectItem>
                ) : tinturarias.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-7" onClick={() => addProg(addingTint)} disabled={!addingTint}>
              <Plus className="h-3 w-3 mr-1" /> Programação
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="p-1.5 font-medium">Tinturaria</th>
              <th className="p-1.5 font-medium">Data prog.</th>
              <th className="p-1.5 font-medium">Peças</th>
              <th className="p-1.5 font-medium">Cor</th>
              <th className="p-1.5 font-medium">Kg env.</th>
              <th className="p-1.5 font-medium">Kg rec.</th>
              <th className="p-1.5 font-medium">Peças rec.</th>
              <th className="p-1.5 font-medium">Data rec.</th>
              <th className="p-1.5 font-medium">NF rec.</th>
              <th className="p-1.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {programacoes.length === 0 ? (
              <tr><td colSpan={10} className="p-2 text-center text-muted-foreground">Sem programação.</td></tr>
            ) : programacoes.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-1 font-medium">{p.tinturaria}</td>
                <td className="p-1"><InlineInput type="date" value={p.data_programacao} onCommit={(v) => commit(p, "data_programacao", v)} disabled={readOnly} /></td>
                <td className="p-1"><InlineInput type="number" step="1" min="0" value={p.pecas} onCommit={(v) => commit(p, "pecas", v)} disabled={readOnly} /></td>
                <td className="p-1"><CorSelect value={p.cor} mapa={acabMapa} disabled={readOnly} onChange={(v) => commit(p, "cor", v)} /></td>
                <td className="p-1"><InlineInput type="number" step="0.01" min="0" value={p.kg_enviados} onCommit={(v) => commit(p, "kg_enviados", v)} disabled={readOnly} /></td>
                <td className="p-1"><InlineInput type="number" step="0.01" min="0" value={p.kg_recebidos} onCommit={(v) => commit(p, "kg_recebidos", v)} disabled={readOnly} /></td>
                <td className="p-1"><InlineInput type="number" step="1" min="0" value={p.pecas_recebidas} onCommit={(v) => commit(p, "pecas_recebidas", v)} disabled={readOnly} /></td>
                <td className="p-1"><InlineInput type="date" value={p.data_recebimento} onCommit={(v) => commit(p, "data_recebimento", v)} disabled={readOnly} /></td>
              <td className="p-1"><InlineInput value={p.nota_fiscal_recebimento} onCommit={(v) => commit(p, "nota_fiscal_recebimento", v)} disabled={readOnly} /></td>
                <td className="p-1 text-right">
                  {!readOnly && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => delProg(p.id)} title="Remover">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CorSelect({
  value,
  mapa,
  disabled,
  onChange,
}: {
  value: string | null;
  mapa: Record<string, string>;
  disabled?: boolean;
  onChange: (v: string | null) => void;
}) {
  const current = value ?? COR_NULA;
  const opcoesCombinadas = REFACAO_CORES.map((c) => ({
    ...c,
    label: corComAcabamento(c.nome, mapa),
  }));
  const isLegado = value != null && !opcoesCombinadas.some((o) => o.label === value);

  // Base cor name (antes do sufixo "-ACABx") para descobrir o hex do valor atual.
  const baseNome = value ? value.split("-")[0] : "";
  const hexAtual = value ? corHex(baseNome) : "";
  const fgAtual = hexAtual ? corTextoSobre(hexAtual) : "";
  const triggerStyle = value
    ? {
        backgroundColor: hexAtual,
        color: fgAtual,
        borderColor: fgAtual === "#ffffff" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)",
      }
    : undefined;

  return (
    <Select
      value={current}
      disabled={disabled}
      onValueChange={(v) => onChange(v === COR_NULA ? null : v)}
    >
      <SelectTrigger
        className="h-7 text-[12.5px] px-1.5 font-semibold w-[140px]"
        style={triggerStyle}
      >
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={COR_NULA}>—</SelectItem>
        {isLegado && (
          <SelectItem value={value!} className="italic text-muted-foreground">
            {value} (legado)
          </SelectItem>
        )}
        {opcoesCombinadas.map((o) => {
          const f = corTextoSobre(o.hex);
          return (
            <SelectItem
              key={o.nome}
              value={o.label}
              style={{ backgroundColor: o.hex, color: f }}
              className="my-0.5 rounded-sm font-semibold focus:opacity-90"
            >
              {o.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
