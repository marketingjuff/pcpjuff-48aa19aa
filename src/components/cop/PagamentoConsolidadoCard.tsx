import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Layers } from "lucide-react";
import { toast } from "sonner";
import type { Cop, Oficina } from "@/lib/cop";
import { rotuloCop } from "@/lib/cop";
import { useIsAdmin } from "@/hooks/use-role";
import { useFeriados } from "@/hooks/use-feriados";
import { isPagamentoAtrasado } from "@/components/cop/PagamentoOficinasTab";
import { useTableSort, SortTh } from "@/components/shared/sortable";

function fmtMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function PagamentoConsolidadoCard() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const { feriados } = useFeriados();

  const { data: cops = [] } = useQuery({
    queryKey: ["cops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cops" as any).select("*").order("numero", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Cop[];
    },
    enabled: isAdmin,
  });
  const { data: oficinas = [] } = useQuery({
    queryKey: ["oficinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oficinas" as any).select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Oficina[];
    },
    enabled: isAdmin,
  });

  const liberadosPorOficina = useMemo(() => {
    const map = new Map<string, Cop[]>();
    for (const c of cops) {
      if (c.pagamento_status !== "liberado" || !c.oficina_id) continue;
      const arr = map.get(c.oficina_id) ?? [];
      arr.push(c);
      map.set(c.oficina_id, arr);
    }
    return map;
  }, [cops]);

  const oficinasElegiveis = useMemo(() => {
    return oficinas
      .filter((o) => liberadosPorOficina.has(o.id))
      .map((o) => {
        const lista = liberadosPorOficina.get(o.id) ?? [];
        const soma = lista.reduce((s, c) => s + Number(c.pagamento_valor_calculado ?? 0), 0);
        return { oficina: o, qtd: lista.length, soma };
      })
      .sort((a, b) => a.oficina.nome.localeCompare(b.oficina.nome));
  }, [oficinas, liberadosPorOficina]);

  const [oficinaId, setOficinaId] = useState<string>("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [obs, setObs] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const copsDaOficina = useMemo(() => {
    if (!oficinaId) return [] as Cop[];
    return (liberadosPorOficina.get(oficinaId) ?? []).slice().sort(
      (a, b) => (a.numero - b.numero) || (a.letra ?? "").localeCompare(b.letra ?? ""),
    );
  }, [oficinaId, liberadosPorOficina]);

  const copsDaOficinaSort = useTableSort(copsDaOficina, {
    cop: (c) => c.numero,
    liberado_em: (c) => c.pagamento_liberado_em ?? "",
    status: (c) => (isPagamentoAtrasado(c, feriados) ? 1 : 0),
    valor: (c) => Number(c.pagamento_valor_calculado ?? 0),
  });

  // Pré-selecionar todos ao trocar de oficina
  useEffect(() => {
    setSelecionados(new Set(copsDaOficina.map((c) => c.id)));
    setObs("");
  }, [oficinaId]); // eslint-disable-line

  // Se a oficina escolhida deixar de ter liberados (após pagamento), limpa
  useEffect(() => {
    if (oficinaId && !liberadosPorOficina.has(oficinaId)) {
      setOficinaId("");
    }
  }, [liberadosPorOficina, oficinaId]);

  const selecionadosArr = useMemo(
    () => copsDaOficina.filter((c) => selecionados.has(c.id)),
    [copsDaOficina, selecionados],
  );
  const total = useMemo(
    () => selecionadosArr.reduce((s, c) => s + Number(c.pagamento_valor_calculado ?? 0), 0),
    [selecionadosArr],
  );

  const pagar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("pagar_consolidado_oficina", {
        _oficina_id: oficinaId,
        _cop_ids: selecionadosArr.map((c) => c.id),
        _observacao: obs || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selecionadosArr.length} COPs pagos em lote.`);
      setConfirmOpen(false);
      setObs("");
      qc.invalidateQueries({ queryKey: ["cops"] });
      qc.invalidateQueries({ queryKey: ["pagamentos_consolidados"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao pagar consolidado."),
  });

  if (!isAdmin) return null;

  return (
    <Card className="border-blue-300/60 bg-blue-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4 text-blue-700" />
          Pagamento Consolidado por Oficina (Admin)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {oficinasElegiveis.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma oficina com COPs Liberados no momento.</div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[280px]">
                <Label className="text-xs">Oficina</Label>
                <Select value={oficinaId} onValueChange={setOficinaId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Escolha uma oficina..." /></SelectTrigger>
                  <SelectContent>
                    {oficinasElegiveis.map((o) => (
                      <SelectItem key={o.oficina.id} value={o.oficina.id}>
                        {o.oficina.nome} ({o.qtd} liberados · {fmtMoney(o.soma)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {oficinaId && (
              <>
                <div className="rounded-md border overflow-x-auto bg-background">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs">
                      <tr>
                        <th className="p-2 text-center w-10"></th>
                        <SortTh label="COP" sortKey="cop" current={copsDaOficinaSort.sortKey} dir={copsDaOficinaSort.sortDir} onSort={copsDaOficinaSort.toggle} className="text-left" />
                        <SortTh label="Liberado em" sortKey="liberado_em" current={copsDaOficinaSort.sortKey} dir={copsDaOficinaSort.sortDir} onSort={copsDaOficinaSort.toggle} className="text-left" />
                        <SortTh label="Status" sortKey="status" current={copsDaOficinaSort.sortKey} dir={copsDaOficinaSort.sortDir} onSort={copsDaOficinaSort.toggle} className="text-left" />
                        <SortTh label="Valor" sortKey="valor" current={copsDaOficinaSort.sortKey} dir={copsDaOficinaSort.sortDir} onSort={copsDaOficinaSort.toggle} className="text-right" />
                      </tr>
                    </thead>
                    <tbody>
                      {copsDaOficinaSort.rows.map((c) => {
                        const atras = isPagamentoAtrasado(c, feriados);
                        const checked = selecionados.has(c.id);
                        return (
                          <tr key={c.id} className="border-t">
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  setSelecionados((prev) => {
                                    const n = new Set(prev);
                                    if (v) n.add(c.id); else n.delete(c.id);
                                    return n;
                                  });
                                }}
                              />
                            </td>
                            <td className="p-2 font-semibold tabular-nums">{rotuloCop(c.numero, c.letra, !!c.refacao_perda_origem_id)}</td>
                            <td className="p-2 tabular-nums">{fmtDate(c.pagamento_liberado_em)}</td>
                            <td className="p-2">
                              {atras ? (
                                <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                                  <AlertTriangle className="h-3 w-3" /> Atrasado
                                </span>
                              ) : (
                                <span className="text-xs text-blue-700">Liberado</span>
                              )}
                            </td>
                            <td className="p-2 text-right tabular-nums">{fmtMoney(Number(c.pagamento_valor_calculado ?? 0))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-muted/30">
                      <tr>
                        <td colSpan={4} className="p-2 text-right"><b>Total selecionado</b></td>
                        <td className="p-2 text-right tabular-nums"><b>{fmtMoney(total)}</b></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div>
                  <Label className="text-xs">Observação (opcional)</Label>
                  <Textarea
                    value={obs}
                    onChange={(e) => setObs((e.target as HTMLTextAreaElement).value)}
                    placeholder="EX.: PIX ENVIADO EM 02/07 — COMPROVANTE Nº 123"
                    rows={2}
                    className="uppercase"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={selecionadosArr.length === 0 || pagar.isPending}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Pagar selecionados (Admin)
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pagamento consolidado?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>
                  Os {selecionadosArr.length} COP(s) abaixo serão marcados como <b>Pagos/Finalizados</b> de uma só vez.
                  Esta ação não pode ser desfeita em lote (só individualmente).
                </div>
                <ul className="list-disc pl-5 max-h-40 overflow-auto">
                  {selecionadosArr.map((c) => (
                    <li key={c.id} className="tabular-nums">
                      COP {rotuloCop(c.numero, c.letra, !!c.refacao_perda_origem_id)} — {fmtMoney(Number(c.pagamento_valor_calculado ?? 0))}
                    </li>
                  ))}
                </ul>
                <div className="pt-1"><b>Total: {fmtMoney(total)}</b></div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pagar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-700"
              disabled={pagar.isPending}
              onClick={(e) => { e.preventDefault(); pagar.mutate(); }}
            >
              {pagar.isPending ? "Pagando..." : "Confirmar pagamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
