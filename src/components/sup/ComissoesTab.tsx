import { useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calculator } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-role";
import { useSupPedidoItens, useSupPedidos } from "@/components/sup/PedidosCompraTab";
import {
  addDias, calcTotaisPedido, competenciaDe, competenciaLabel, fmtDataBR, fmtMoeda, n,
  type SupComissao, type SupComissionado, type SupConfig, type SupPedidoItem,
} from "@/lib/sup";

const STATUS_LABEL: Record<SupComissao["status"], string> = {
  a_apurar: "A apurar",
  a_pagar: "A pagar",
  paga: "Paga",
};
const STATUS_CLASSE: Record<SupComissao["status"], string> = {
  a_apurar: "bg-muted text-muted-foreground",
  a_pagar: "bg-amber-100 text-amber-900",
  paga: "bg-emerald-100 text-emerald-900",
};

function competenciaAtual() {
  return new Date().toISOString().slice(0, 7);
}

export function ComissoesTab() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [comp, setComp] = usePersistedState("sup:comissoes:competencia", competenciaAtual());
  const [ajusteAlvo, setAjusteAlvo] = useState<SupComissao | null>(null);
  const [ajusteValor, setAjusteValor] = useState("");
  const [ajusteMotivo, setAjusteMotivo] = useState("");

  const { data: pedidos = [] } = useSupPedidos();
  const { data: itens = [] } = useSupPedidoItens();

  const { data: config } = useQuery({
    queryKey: ["sup-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sup_config").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return (data ?? null) as SupConfig | null;
    },
  });

  const { data: comissionados = [] } = useQuery({
    queryKey: ["sup-comissionados"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sup_comissionados").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as SupComissionado[];
    },
  });

  const { data: comissoes = [], isLoading } = useQuery({
    queryKey: ["sup-comissoes", comp],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sup_comissoes")
        .select("*")
        .eq("competencia", comp);
      if (error) throw error;
      return (data ?? []) as SupComissao[];
    },
  });

  const { data: contestados = [] } = useQuery({
    queryKey: ["sup-precos-contestados"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sup_preco_historico")
        .select("id")
        .eq("status_revisao", "contestada");
      if (error) throw error;
      return ((data ?? []) as { id: string }[]).map((r) => r.id);
    },
  });

  const carencia = config?.dias_carencia_recebimento ?? 0;
  const hoje = new Date().toISOString().slice(0, 10);

  const itensPorPedido = useMemo(() => {
    const m = new Map<string, SupPedidoItem[]>();
    for (const i of itens) {
      const arr = m.get(i.pedido_id) ?? [];
      arr.push(i);
      m.set(i.pedido_id, arr);
    }
    return m;
  }, [itens]);

  /** Pedidos elegíveis da competência selecionada. */
  const elegiveis = useMemo(() => {
    const contest = new Set(contestados);
    return pedidos
      .filter((p) => p.status !== "cancelado" && !!p.comissionado_id && !!p.data_recebimento_total)
      .map((p) => {
        const elegivelEm = addDias(p.data_recebimento_total!, carencia);
        const its = (itensPorPedido.get(p.id) ?? []).filter(
          (i) => !(i.preco_historico_id && contest.has(i.preco_historico_id)),
        );
        const t = calcTotaisPedido(its, {
          desconto_global_tipo: p.desconto_global_tipo,
          desconto_global_valor: p.desconto_global_valor,
          frete_valor: p.frete_valor,
          comissao_percentual: p.comissao_percentual,
        });
        return { p, elegivelEm, economia: t.economia_total, comissao: t.comissao_prevista };
      })
      .filter((r) => competenciaDe(r.elegivelEm) === comp && r.elegivelEm <= hoje && r.economia > 0);
  }, [pedidos, itensPorPedido, contestados, carencia, comp, hoje]);

  const previsto = useMemo(() => {
    const m = new Map<string, { economia: number; comissao: number; pedidos: string[] }>();
    for (const r of elegiveis) {
      const key = r.p.comissionado_id!;
      const cur = m.get(key) ?? { economia: 0, comissao: 0, pedidos: [] };
      cur.economia += r.economia;
      cur.comissao += r.comissao;
      cur.pedidos.push(r.p.id);
      m.set(key, cur);
    }
    return m;
  }, [elegiveis]);

  const apurar = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      for (const [comissionado_id, agg] of previsto) {
        const existente = comissoes.find((c) => c.comissionado_id === comissionado_id);
        if (existente?.status === "paga") continue;
        const percentual = agg.economia > 0 ? (agg.comissao / agg.economia) * 100 : 0;
        let comissaoId = existente?.id ?? null;
        const payload = {
          competencia: comp,
          comissionado_id,
          economia_total: agg.economia,
          percentual_aplicado: percentual,
          valor_comissao: agg.comissao,
          status: existente?.status === "a_pagar" ? "a_pagar" : "a_apurar",
        };
        if (comissaoId) {
          const { error } = await (supabase as any).from("sup_comissoes").update(payload).eq("id", comissaoId);
          if (error) throw error;
        } else {
          const { data, error } = await (supabase as any)
            .from("sup_comissoes")
            .insert({ ...payload, apurado_por: u.user?.id ?? null })
            .select("id")
            .single();
          if (error) throw error;
          comissaoId = data.id as string;
        }
        const { error: eDel } = await (supabase as any).from("sup_comissao_itens").delete().eq("comissao_id", comissaoId);
        if (eDel) throw eDel;
        const rows = elegiveis
          .filter((r) => r.p.comissionado_id === comissionado_id)
          .map((r) => ({ comissao_id: comissaoId, pedido_id: r.p.id, economia: r.economia }));
        if (rows.length > 0) {
          const { error } = await (supabase as any).from("sup_comissao_itens").insert(rows);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-comissoes", comp] });
      toast.success("Competência apurada.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao apurar."),
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ c, status }: { c: SupComissao; status: SupComissao["status"] }) => {
      const { data: u } = await supabase.auth.getUser();
      const patch: Record<string, unknown> = { status };
      if (status === "a_pagar") { patch.liberado_por = u.user?.id ?? null; patch.liberado_em = new Date().toISOString(); }
      if (status === "paga") { patch.pago_por = u.user?.id ?? null; patch.pago_em = new Date().toISOString(); }
      const { error } = await (supabase as any).from("sup_comissoes").update(patch).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-comissoes", comp] });
      toast.success("Status da comissão atualizado.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar status."),
  });

  const salvarAjuste = useMutation({
    mutationFn: async () => {
      if (!ajusteAlvo) return;
      const valor = Number(String(ajusteValor).replace(",", "."));
      if (!Number.isFinite(valor)) throw new Error("Informe um valor de ajuste válido.");
      if (!ajusteMotivo.trim()) throw new Error("Informe o motivo do ajuste.");
      const { error } = await (supabase as any)
        .from("sup_comissoes")
        .update({ ajuste_valor: valor, ajuste_motivo: ajusteMotivo.trim() })
        .eq("id", ajusteAlvo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-comissoes", comp] });
      toast.success("Ajuste registrado.");
      setAjusteAlvo(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar ajuste."),
  });

  const nome = (id: string) => comissionados.find((c) => c.id === id)?.nome ?? "—";
  const numeroPc = (id: string) => pedidos.find((p) => p.id === id)?.numero ?? "—";

  const competenciasOpcoes = useMemo(() => {
    const set = new Set<string>([competenciaAtual(), comp]);
    for (const p of pedidos) {
      if (p.data_recebimento_total) set.add(competenciaDe(addDias(p.data_recebimento_total, carencia)));
    }
    return [...set].sort().reverse();
  }, [pedidos, carencia, comp]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-48">
          <Label className="text-xs">Competência</Label>
          <Select value={comp} onValueChange={setComp}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {competenciasOpcoes.map((c) => <SelectItem key={c} value={c}>{competenciaLabel(c)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground pb-2">
          Carência de {carencia} dia(s) após o recebimento total. Preços contestados não geram comissão.
        </div>
        {isAdmin && (
          <div className="ml-auto">
            <Button className="h-9 bg-teal-600 hover:bg-teal-700 text-white" disabled={apurar.isPending} onClick={() => apurar.mutate()}>
              <Calculator className="h-4 w-4 mr-1" /> Apurar competência
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider bg-muted/40">Comissões apuradas</div>
        <table className="w-full text-[13px]">
          <thead className="bg-muted/20">
            <tr className="text-xs">
              <th className="p-1.5 text-left">Comissionado</th>
              <th className="p-1.5 text-right">Economia</th>
              <th className="p-1.5 text-center">%</th>
              <th className="p-1.5 text-right">Comissão</th>
              <th className="p-1.5 text-right">Ajuste</th>
              <th className="p-1.5 text-right">A pagar</th>
              <th className="p-1.5 text-center">Status</th>
              <th className="p-1.5 text-right w-64"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>
            ) : comissoes.length === 0 ? (
              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Nada apurado nesta competência.</td></tr>
            ) : comissoes.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-1.5 font-medium">{nome(c.comissionado_id)}</td>
                <td className="p-1.5 text-right tabular-nums">{fmtMoeda(c.economia_total)}</td>
                <td className="p-1.5 text-center tabular-nums">{n(c.percentual_aplicado).toFixed(2)}%</td>
                <td className="p-1.5 text-right font-semibold tabular-nums">{fmtMoeda(c.valor_comissao)}</td>
                <td className="p-1.5 text-right tabular-nums">{n(c.ajuste_valor) === 0 ? "—" : fmtMoeda(c.ajuste_valor)}</td>
                <td className="p-1.5 text-right font-semibold tabular-nums text-teal-800">{fmtMoeda(n(c.valor_comissao) + n(c.ajuste_valor))}</td>
                <td className="p-1.5 text-center">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${STATUS_CLASSE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                </td>
                <td className="p-1.5 text-right space-x-1">
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="outline" className="h-7"
                        onClick={() => { setAjusteAlvo(c); setAjusteValor(String(c.ajuste_valor ?? "")); setAjusteMotivo(c.ajuste_motivo ?? ""); }}>
                        Ajuste
                      </Button>
                      {c.status === "a_apurar" && (
                        <Button size="sm" variant="secondary" className="h-7" onClick={() => mudarStatus.mutate({ c, status: "a_pagar" })}>Liberar</Button>
                      )}
                      {c.status === "a_pagar" && (
                        <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => mudarStatus.mutate({ c, status: "paga" })}>
                          Marcar paga
                        </Button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider bg-muted/40">
          Pedidos elegíveis em {competenciaLabel(comp)} ({elegiveis.length})
        </div>
        <div className="max-h-[42vh] overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-muted/20">
              <tr className="text-xs">
                <th className="p-1.5 text-left">Nº PC</th>
                <th className="p-1.5 text-left">Comissionado</th>
                <th className="p-1.5 text-center">Recebido em</th>
                <th className="p-1.5 text-center">Elegível em</th>
                <th className="p-1.5 text-right">Economia</th>
                <th className="p-1.5 text-right">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {elegiveis.length === 0 ? (
                <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">Nenhum pedido elegível.</td></tr>
              ) : elegiveis.map((r) => (
                <tr key={r.p.id} className="border-t">
                  <td className="p-1.5 font-semibold tabular-nums">{numeroPc(r.p.id)}</td>
                  <td className="p-1.5">{nome(r.p.comissionado_id!)}</td>
                  <td className="p-1.5 text-center tabular-nums">{fmtDataBR(r.p.data_recebimento_total)}</td>
                  <td className="p-1.5 text-center tabular-nums">{fmtDataBR(r.elegivelEm)}</td>
                  <td className="p-1.5 text-right tabular-nums">{fmtMoeda(r.economia)}</td>
                  <td className="p-1.5 text-right font-semibold tabular-nums">{fmtMoeda(r.comissao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!ajusteAlvo} onOpenChange={(v) => { if (!v) setAjusteAlvo(null); }}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader><DialogTitle>Ajuste / estorno de comissão</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Use valor negativo para estornar comissão de pedido cancelado após o pagamento.
            </div>
            <div>
              <Label className="text-xs">Valor do ajuste (R$)</Label>
              <Input value={ajusteValor} onChange={(e) => setAjusteValor(e.target.value)} className="h-9" placeholder="-150,00" />
            </div>
            <div>
              <Label className="text-xs">Motivo *</Label>
              <Textarea value={ajusteMotivo} onChange={(e) => setAjusteMotivo(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAjusteAlvo(null)}>Cancelar</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={salvarAjuste.isPending} onClick={() => salvarAjuste.mutate()}>
              Salvar ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
