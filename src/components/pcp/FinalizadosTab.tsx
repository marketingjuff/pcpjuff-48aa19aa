import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Pedido } from "@/lib/pedidos";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RotateCcw, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/format";
import { PedidoMobileCard, Chip, QtdTotal, useSort, cmpDate, cmpNum, SortableTh, Th, ReadOnlyField } from "./shared";
import { ObservacoesOutrosSetores } from "./ObservacoesOutrosSetores";


interface Props {
  pedidos: Pedido[];
  onReabrir: (id: string) => void;
}

export function FinalizadosTab({ pedidos, onReabrir }: Props) {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();

  const [search, setSearch] = useState("");
  const [periodo, setPeriodo] = useState<string>("tudo");
  const [de, setDe] = useState<string>("");
  const [ate, setAte] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const sort = useSort<"pedido"|"qtd"|"saida"|"data_saida"|"fin">();
  const [historico, setHistorico] = useState<Pedido | null>(null);


  const finalizados = useMemo(() => {
    const hoje = new Date();
    const arr = pedidos.filter((p) => {
      if (!p.finalizado_em) return false;
      if (search && !`${p.pedido_olist} ${p.orcamento}`.toLowerCase().includes(search.toLowerCase())) return false;
      const fin = new Date(p.finalizado_em);
      if (periodo === "7d" && (hoje.getTime() - fin.getTime()) > 7 * 86400000) return false;
      if (periodo === "30d" && (hoje.getTime() - fin.getTime()) > 30 * 86400000) return false;
      if (periodo === "custom") {
        if (de && fin < new Date(de + "T00:00:00")) return false;
        if (ate && fin > new Date(ate + "T23:59:59")) return false;
      }
      return true;
    });
    if (sort.key) {
      arr.sort((a, b) => {
        switch (sort.key) {
          case "pedido": return cmpPedido(a, b, sort.dir);
          case "qtd": return cmpNum(a.qtd, b.qtd, sort.dir);
          case "saida": return cmpDate(a.saida_juff, b.saida_juff, sort.dir);
          case "data_saida": return cmpDate(a.data_saida_juff, b.data_saida_juff, sort.dir);
          case "fin": return cmpDate(a.finalizado_em?.slice(0,10), b.finalizado_em?.slice(0,10), sort.dir);
        }
        return 0;
      });
    } else {
      arr.sort((a, b) => (b.finalizado_em ?? "").localeCompare(a.finalizado_em ?? ""));
    }
    return arr;
  }, [pedidos, search, periodo, de, ate, sort.key, sort.dir]);


  const visibleIds = useMemo(() => finalizados.map((p) => p.id), [finalizados]);
  const selectedVisibleCount = useMemo(
    () => visibleIds.filter((id) => selectedIds.has(id)).length,
    [visibleIds, selectedIds],
  );
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) visibleIds.forEach((id) => next.add(id));
      else visibleIds.forEach((id) => next.delete(id));
      return next;
    });
  }

  async function handleConfirmDelete() {
    const ids = visibleIds.filter((id) => selectedIds.has(id));
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      const layoutPaths = pedidos
        .filter((p) => ids.includes(p.id))
        .map((p) => p.layout_url)
        .filter((p): p is string => typeof p === "string" && p.length > 0);

      if (layoutPaths.length > 0) {
        const { error: sErr } = await supabase.storage.from("layouts").remove(layoutPaths);
        if (sErr) {
          // Não interrompe a exclusão dos pedidos, apenas avisa.
          toast.warning(`Alguns arquivos de layout não foram removidos: ${sErr.message}`);
        }
      }

      const { error } = await supabase.from("pedidos").delete().in("id", ids);
      if (error) throw error;

      setSelectedIds(new Set());
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      toast.success(`${ids.length} ${ids.length === 1 ? "pedido excluído" : "pedidos excluídos"} com sucesso.`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao excluir pedidos.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>Pedidos finalizados ({finalizados.length})</CardTitle>
          {isAdmin && selectedVisibleCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir Selecionados ({selectedVisibleCount})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {historico && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4" /> Histórico — {historico.pedido_olist}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setHistorico(null)}>Fechar</Button>
            </div>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
              <ReadOnlyField label="Pedido" value={historico.pedido_olist} />
              <ReadOnlyField label="Orçamento" value={historico.orcamento} />
              <ReadOnlyField label="Tipo de Estampa" value={historico.tipo_estampa} />
              <ReadOnlyField label="QTD" value={historico.qtd} />
              <ReadOnlyField label="Vendedor" value={historico.vendedor} />
              <ReadOnlyField label="Status de Peças" value={historico.status_pecas} />
            </div>
            <div className="border-t pt-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Datas de processo</div>
              <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
                <ReadOnlyField label="Entrada do pedido" value={formatDateBR(historico.entrada_pedido)} />
                <ReadOnlyField label="Limite da Arte" value={formatDateBR(historico.arte_data)} />
                <ReadOnlyField label="Início estamparia" value={formatDateBR(historico.inicio_estamparia)} />
                <ReadOnlyField label="Término estamparia" value={formatDateBR(historico.termino_estamparia)} />
                <ReadOnlyField label="DTF executado" value={formatDateBR(historico.dtf_data_executada)} />
                <ReadOnlyField label="Silk executado" value={formatDateBR(historico.silk_data_executada)} />
                <ReadOnlyField label="Acabamento" value={formatDateBR(historico.acabamento_data)} />
                <ReadOnlyField label="Saída Juff (prazo)" value={formatDateBR(historico.saida_juff)} />
                <ReadOnlyField label="Saída Juff (real)" value={formatDateBR(historico.data_saida_juff)} />
                <ReadOnlyField label="Entrega" value={formatDateBR(historico.data_entrega)} />
                <ReadOnlyField label="Finalizado em" value={formatDateBR(historico.finalizado_em?.slice(0,10))} />
              </div>
            </div>
            <div className="border-t pt-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Observações</div>
              <ObservacoesOutrosSetores
                pedido={historico}
                setorAtual={"__none__" as any}
              />
            </div>
          </div>
        )}
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          <Input placeholder="Buscar pedido ou orçamento..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tudo">Tudo</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {periodo === "custom" && (
            <>
              <DateInputBR value={de} onChange={(v) => setDe(v ?? "")} />
              <DateInputBR value={ate} onChange={(v) => setAte(v ?? "")} />
            </>
          )}
        </div>
        {/* Mobile cards */}
        <div className="md:hidden rounded-md border divide-y">
          {finalizados.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido finalizado.</div>
          ) : finalizados.map((p) => (
            <div key={p.id} className={`p-3 ${selectedIds.has(p.id) ? "bg-accent" : ""}`}>
              <div className="flex items-start gap-2">
                {isAdmin && (
                  <Checkbox
                    checked={selectedIds.has(p.id)}
                    onCheckedChange={(c) => toggleOne(p.id, c === true)}
                    aria-label={`Selecionar pedido ${p.pedido_olist}`}
                    className="mt-1"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{p.pedido_olist}</div>
                    <Badge variant="outline" className="shrink-0">{p.tipo_estampa}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.orcamento}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Chip label="QTD" value={<QtdTotal pedido={p} />} />
                    <Chip label="Vend" value={p.vendedor} />
                    <Chip label="Resp" value={p.responsavel_acabamento} />
                    <Chip label="Finalizado" value={formatDateBR(p.finalizado_em?.slice(0,10)) || "—"} />
                  </div>
                  <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={() => onReabrir(p.id)} className="w-full">
                      <RotateCcw className="h-3 w-3 mr-1" /> Reabrir
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:block rounded-lg border border-border/60 bg-card overflow-x-auto shadow-xs [&_th]:text-center [&_td]:text-center">
          <table className="w-full text-sm" style={{ fontFamily: '"Google Sans Flex", Arial, sans-serif', fontStretch: 'condensed' }}>
            <thead>
              <tr>
                {isAdmin && (
                  <th className="h-7 px-1.5 text-left text-[11px] uppercase whitespace-nowrap font-bold text-muted-foreground w-10">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                      onCheckedChange={(c) => toggleAllVisible(c === true)}
                      aria-label="Selecionar todos visíveis"
                    />
                  </th>
                )}
                <SortableTh label="PEDIDO" active={sort.key === "pedido"} onClick={() => sort.toggle("pedido")} />
                <Th>ORÇAMENTO</Th>
                <SortableTh label="QTD" active={sort.key === "qtd"} onClick={() => sort.toggle("qtd")} />
                <Th>VENDEDOR</Th>
                <Th>TIPO</Th>
                <SortableTh label="SAÍDA JUFF" active={sort.key === "saida"} onClick={() => sort.toggle("saida")} />
                <SortableTh label="DATA SAÍDA" active={sort.key === "data_saida"} onClick={() => sort.toggle("data_saida")} />
                <Th>RESPONSÁVEL</Th>
                <SortableTh label="FINALIZADO EM" active={sort.key === "fin"} onClick={() => sort.toggle("fin")} />
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {finalizados.length === 0 ? (
                <tr><td colSpan={isAdmin ? 11 : 10} className="text-center py-8 text-muted-foreground">Nenhum pedido finalizado.</td></tr>
              ) : (
                finalizados.map((p) => (
                  <tr key={p.id} className="border-t cursor-pointer hover:bg-accent" onClick={() => setHistorico(p)}>
                    {isAdmin && (
                      <td className="px-1.5 py-0.5 w-10" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={(c) => toggleOne(p.id, c === true)}
                          aria-label={`Selecionar pedido ${p.pedido_olist}`}
                        />
                      </td>
                    )}
                    <td className="px-1.5 py-0.5 font-medium">{p.pedido_olist}</td>
                    <td className="px-1.5 py-0.5 max-w-[200px] truncate !text-left">{p.orcamento}</td>
                    <td className="px-1.5 py-0.5"><QtdTotal pedido={p} /></td>
                    <td className="px-1.5 py-0.5">{p.vendedor}</td>
                    <td className="px-1.5 py-0.5"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                    <td className="px-1.5 py-0.5 text-xs whitespace-nowrap">{formatDateBR(p.saida_juff)}</td>
                    <td className="px-1.5 py-0.5 text-xs whitespace-nowrap">{formatDateBR(p.data_saida_juff)}</td>
                    <td className="px-1.5 py-0.5 text-xs">{p.responsavel_acabamento ?? "—"}</td>
                    <td className="px-1.5 py-0.5 text-xs whitespace-nowrap">{formatDateBR(p.finalizado_em?.slice(0,10))}</td>
                    <td className="px-1.5 py-0.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => onReabrir(p.id)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Reabrir
                      </Button>

                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir {selectedVisibleCount}{" "}
              {selectedVisibleCount === 1 ? "pedido permanentemente" : "pedidos permanentemente"}.
              Essa ação não pode ser desfeita. Confirmar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo…" : "Confirmar Exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Card>
  );
}

function cmpPedido(a: Pedido, b: Pedido, dir: "asc" | "desc") {
  const na = Number(a.pedido_olist);
  const nb = Number(b.pedido_olist);
  const aBad = !Number.isFinite(na);
  const bBad = !Number.isFinite(nb);
  if (aBad && bBad) return 0;
  if (aBad) return 1;
  if (bBad) return -1;
  return dir === "asc" ? na - nb : nb - na;
}

