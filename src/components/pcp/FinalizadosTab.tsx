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
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/format";

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

  const finalizados = useMemo(() => {
    const hoje = new Date();
    return pedidos.filter((p) => {
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
    }).sort((a, b) => (b.finalizado_em ?? "").localeCompare(a.finalizado_em ?? ""));
  }, [pedidos, search, periodo, de, ate]);

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
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-4">
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
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                {isAdmin && (
                  <th className="px-3 py-2 text-left w-10">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                      onCheckedChange={(c) => toggleAllVisible(c === true)}
                      aria-label="Selecionar todos visíveis"
                    />
                  </th>
                )}
                {["Pedido","Orçamento","QTD","Vendedor","Tipo","Saída Juff","Data Saída","Responsável","Finalizado em",""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {finalizados.length === 0 ? (
                <tr><td colSpan={isAdmin ? 11 : 10} className="text-center py-8 text-muted-foreground">Nenhum pedido finalizado.</td></tr>
              ) : (
                finalizados.map((p) => (
                  <tr key={p.id} className="border-t">
                    {isAdmin && (
                      <td className="px-3 py-2 w-10">
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={(c) => toggleOne(p.id, c === true)}
                          aria-label={`Selecionar pedido ${p.pedido_olist}`}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 font-medium">{p.pedido_olist}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate">{p.orcamento}</td>
                    <td className="px-3 py-2">{p.qtd}</td>
                    <td className="px-3 py-2">{p.vendedor}</td>
                    <td className="px-3 py-2"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDateBR(p.saida_juff)}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDateBR(p.data_saida_juff)}</td>
                    <td className="px-3 py-2 text-xs">{p.responsavel_acabamento ?? "—"}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDateBR(p.finalizado_em?.slice(0,10))}</td>
                    <td className="px-3 py-2 text-right">
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
