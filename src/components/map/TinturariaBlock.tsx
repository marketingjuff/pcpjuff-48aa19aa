import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, AlertTriangle, Copy, PackageCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppList } from "@/lib/app-lists";
import type { MapProgramacaoTinturaria, MapEstoquePeca } from "@/lib/map";
import { patchProgramacao, sumPecasProgramadas, useCorAcabamentos, corComAcabamento, fmt, programacaoRecebimentoCompleto, corBase } from "@/lib/map";
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
  estoquePecas?: MapEstoquePeca[];
}

export function TinturariaBlock({ producaoId, programacoes, pecasRecebidasMalharia, kgPorPeca, onChanged, readOnly, estoquePecas = [] }: Props) {

  const { names: tinturarias } = useAppList("map_tinturaria");
  const { mapa: acabMapa } = useCorAcabamentos();
  const [adding, setAdding] = useState(false);

  const totalProgramado = sumPecasProgramadas(programacoes);
  const Y = pecasRecebidasMalharia;
  const X = totalProgramado;

  const totalPedidoKg = programacoes.reduce((s, p) => s + Number(p.kg_enviados ?? 0), 0);
  const totalPedidoPcs = programacoes.reduce((s, p) => s + Number(p.pecas ?? 0), 0);
  const totalEntregueKg = programacoes.reduce((s, p) => s + Number(p.kg_recebidos ?? 0), 0);
  const totalEntreguePcs = programacoes.reduce((s, p) => s + Number(p.pecas_recebidas ?? 0), 0);

  let counterClass = "text-muted-foreground";
  let icon = null;
  if (Y > 0) {
    if (X < Y) counterClass = "text-amber-700";
    else if (X === Y) counterClass = "text-emerald-700 font-semibold";
    else { counterClass = "text-red-700 font-semibold"; icon = <AlertTriangle className="h-3.5 w-3.5 inline-block ml-1" />; }
  }

  function pickDefaultTint(): string {
    if (tinturarias.length === 0) return "";
    const found = tinturarias.find((n) => n.toLowerCase() === "guararema");
    return found ?? tinturarias[0];
  }

  async function addProg() {
    const tint = pickDefaultTint();
    setAdding(true);
    const payload: any = { producao_id: producaoId };
    if (tint) payload.tinturaria = tint;
    const { error } = await (supabase as any)
      .from("map_tinturaria_programacoes")
      .insert(payload);
    setAdding(false);
    if (error) { toast.error(error.message); return; }
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

  async function dupProg(row: MapProgramacaoTinturaria) {
    const { error } = await (supabase as any)
      .from("map_tinturaria_programacoes")
      .insert({
        producao_id: producaoId,
        tinturaria: row.tinturaria,
        data_programacao: row.data_programacao,
        data_recebimento: row.data_recebimento,
        nota_fiscal_recebimento: row.nota_fiscal_recebimento,
        pecas: null,
        cor: null,
        kg_enviados: null,
        kg_recebidos: null,
        pecas_recebidas: null,
      });
    if (error) { toast.error(error.message); return; }
    toast.success("Programação duplicada.");
    onChanged();
  }

  async function commit(row: MapProgramacaoTinturaria, field: keyof MapProgramacaoTinturaria, raw: string | null) {
    try {
      const patch: any = {};
      if (field === "pecas" || field === "kg_enviados" || field === "kg_recebidos" || field === "pecas_recebidas") {
        patch[field] = raw === null || raw === "" ? null : Number(raw);
        // Kg env. recalcula SEMPRE quando peças mudam.
        if (field === "pecas") {
          const n = raw === null || raw === "" ? null : Number(raw);
          if (n == null) patch.kg_enviados = null;
          else if (kgPorPeca > 0) patch.kg_enviados = n * kgPorPeca;
        }
      } else {
        patch[field] = raw;
      }
      await patchProgramacao(row.id, patch);

      // Split automático: se a linha ficou completa no recebimento e chegou MENOS peças que as enviadas,
      // fecha esta com o que chegou e abre uma nova com o que faltou.
      const merged: any = { ...row, ...patch };
      const recebComplete =
        merged.kg_recebidos != null &&
        merged.pecas_recebidas != null &&
        !!merged.data_recebimento &&
        !!merged.nota_fiscal_recebimento;
      const enviadas = merged.pecas;
      const recebidas = merged.pecas_recebidas;
      const faltantes = enviadas != null && recebidas != null ? Number(enviadas) - Number(recebidas) : 0;
      if (recebComplete && enviadas != null && recebidas != null && faltantes > 0) {
        await patchProgramacao(row.id, {
          pecas: Number(recebidas),
          kg_enviados: kgPorPeca > 0 ? Number(recebidas) * kgPorPeca : merged.kg_enviados,
        });
        const baseCreated = row.created_at ? new Date(row.created_at).getTime() : Date.now();
        const { error } = await (supabase as any).from("map_tinturaria_programacoes").insert({
          producao_id: producaoId,
          tinturaria: row.tinturaria,
          data_programacao: row.data_programacao,
          cor: row.cor,
          pecas: faltantes,
          kg_enviados: kgPorPeca > 0 ? faltantes * kgPorPeca : null,
          kg_recebidos: null,
          pecas_recebidas: null,
          data_recebimento: null,
          nota_fiscal_recebimento: null,
          created_at: new Date(baseCreated + 1).toISOString(),
        });
        if (error) { toast.error(error.message); return; }
        toast.success(`Split: ${recebidas} recebidas · ${faltantes} pendente(s).`);
      }

      onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
  }

  const saldoPcs = totalEntreguePcs - totalPedidoPcs;
  const saldoKg = totalEntregueKg - totalPedidoKg;
  const saldoClass = (v: number) => v > 0 ? "text-blue-600" : v < 0 ? "text-red-600" : "text-muted-foreground";

  return (
    <div className="rounded-md border bg-white/70 p-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm space-x-3">
          <span className="text-muted-foreground font-medium">Tinturaria</span>
          <span className={`${counterClass}`}>
            Programadas: <span className="tabular-nums">{X}</span> / <span className="tabular-nums">{Y}</span>{icon}
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">
            Pedido <b className="tabular-nums text-foreground">{fmt(totalPedidoKg, { decimals: 2 })} kg</b> / <b className="tabular-nums text-foreground">{totalPedidoPcs}</b> pcs
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">
            Entregue <b className="tabular-nums text-foreground">{fmt(totalEntregueKg, { decimals: 2 })} kg</b> / <b className="tabular-nums text-foreground">{totalEntreguePcs}</b> pcs
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">
            Saldo <b className={`tabular-nums ${saldoClass(saldoKg)}`}>{saldoKg > 0 ? "+" : ""}{fmt(saldoKg, { decimals: 2 })}</b> kg / <b className={`tabular-nums ${saldoClass(saldoPcs)}`}>{saldoPcs > 0 ? "+" : ""}{saldoPcs}</b> pcs
          </span>
        </div>
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={addProg}
            disabled={adding || tinturarias.length === 0}
            title={tinturarias.length === 0 ? "Cadastre uma tinturaria em Configurações" : ""}
          >
            <Plus className="h-3 w-3 mr-1" /> Programação
          </Button>
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
              <th className="p-1.5 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {programacoes.length === 0 ? (
              <tr><td colSpan={10} className="p-2 text-center text-muted-foreground">Sem programação.</td></tr>
            ) : programacoes.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-1 font-medium">
                  <TinturariaSelect
                    value={p.tinturaria}
                    options={tinturarias}
                    disabled={readOnly}
                    onChange={(v) => commit(p, "tinturaria", v)}
                  />
                </td>
                <td className="p-1"><InlineInput type="date" value={p.data_programacao} onCommit={(v) => commit(p, "data_programacao", v)} disabled={readOnly} /></td>
                <td className="p-1"><InlineInput type="number" step="1" min="0" value={p.pecas} onCommit={(v) => commit(p, "pecas", v)} disabled={readOnly} /></td>
                <td className="p-1"><CorSelect value={p.cor} mapa={acabMapa} disabled={readOnly} onChange={(v) => commit(p, "cor", v)} /></td>
                <td className="p-1"><InlineInput type="number" step="0.01" min="0" value={p.kg_enviados} onCommit={(v) => commit(p, "kg_enviados", v)} disabled={readOnly} /></td>
                <td className="p-1"><InlineInput type="number" step="0.01" min="0" value={p.kg_recebidos} onCommit={(v) => commit(p, "kg_recebidos", v)} disabled={readOnly} /></td>
                <td className="p-1"><InlineInput type="number" step="1" min="0" value={p.pecas_recebidas} onCommit={(v) => commit(p, "pecas_recebidas", v)} disabled={readOnly} /></td>
                <td className="p-1"><InlineInput type="date" value={p.data_recebimento} onCommit={(v) => commit(p, "data_recebimento", v)} disabled={readOnly} /></td>
              <td className="p-1"><InlineInput value={p.nota_fiscal_recebimento} onCommit={(v) => commit(p, "nota_fiscal_recebimento", v)} disabled={readOnly} /></td>
                <td className="p-1 text-right whitespace-nowrap">
                  <ReceiptDot row={p} programacoes={programacoes} estoquePecas={estoquePecas} />
                  {!readOnly && (
                    <>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => dupProg(p)} title="Duplicar">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => delProg(p.id)} title="Remover">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </>
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

function TinturariaSelect({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const isLegado = !!value && !options.includes(value);
  const current = value || "__none__";
  return (
    <Select value={current} disabled={disabled} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
      <SelectTrigger className="h-7 w-[140px] text-xs font-semibold">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">—</SelectItem>
        {isLegado && (
          <SelectItem value={value} className="italic text-muted-foreground">
            {value} (legado)
          </SelectItem>
        )}
        {options.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
