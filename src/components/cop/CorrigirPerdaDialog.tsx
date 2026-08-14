import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppList } from "@/lib/app-lists";
import { MOTIVOS_PERDA_PADRAO, type Oficina } from "@/lib/cop";
import type { PerdaConsolidada } from "@/lib/perdas-consolidado";
import { CorChip } from "@/components/shared/cor-chip";

export function CorrigirPerdaDialog({
  perda, open, onOpenChange,
}: {
  perda: PerdaConsolidada | null; // origem === 'pcp'
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [qtd, setQtd] = useState<string>("1");
  const [motivoNovo, setMotivoNovo] = useState<string>("");
  const [oficinaId, setOficinaId] = useState<string>("");
  const [berco, setBerco] = useState<string>("");
  const [destino, setDestino] = useState<string>("");
  const [observacao, setObservacao] = useState<string>("");

  const { items: motivosItems } = useAppList("motivo_perda");
  const motivos = motivosItems.length ? motivosItems.map((i) => i.nome) : MOTIVOS_PERDA_PADRAO;
  const { items: destinosItems } = useAppList("destino_perda" as any);

  const { data: oficinas = [] } = useQuery({
    queryKey: ["oficinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oficinas" as any).select("id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Pick<Oficina, "id" | "nome">[];
    },
  });

  function reset() {
    setQtd(String(perda?.qtd ?? 1)); setMotivoNovo(""); setOficinaId(""); setBerco(""); setDestino(""); setObservacao("");
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!perda || perda.fonte.kind !== "pcp") throw new Error("Origem inválida.");
      const q = Number(qtd);
      if (!Number.isFinite(q) || q <= 0) throw new Error("Quantidade inválida.");
      if (q > perda.qtd) throw new Error(`Quantidade máxima: ${perda.qtd}.`);
      if (!motivoNovo) throw new Error("Selecione o motivo novo.");
      if (!observacao.trim()) throw new Error("Observação é obrigatória.");
      const { data: userData } = await supabase.auth.getUser();
      const payload = {
        pedido_id: perda.fonte.pedidoId,
        refacao_data: perda.fonte.refacaoData,
        refacao_idx: perda.fonte.refacaoIdx,
        modelo: perda.modelo, cor: perda.cor, tamanho: perda.tamanho,
        qtd: q,
        motivo_original: perda.motivo ?? null,
        area_erro_original: perda.erro_producao ? "Produção" : (perda.area_erro ?? null),
        motivo_novo: motivoNovo,
        oficina_id: oficinaId || null,
        berco: berco.trim() || null,
        destino: destino || null,
        observacao: observacao.trim(),
        usuario_id: userData.user?.id ?? null,
      };
      const { error } = await (supabase as any).from("perdas_reclassificacoes").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perda reclassificada.");
      qc.invalidateQueries({ queryKey: ["perdas-cons-reclass"] });
      qc.invalidateQueries({ queryKey: ["perdas-reclass-pedido", perda?.fonte.kind === "pcp" ? perda.fonte.pedidoId : undefined] });
      reset(); onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao reclassificar."),
  });

  if (!perda) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader><DialogTitle>Corrigir perda (reclassificar)</DialogTitle></DialogHeader>
        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
          <div><span className="text-muted-foreground">Pedido:</span> <span className="font-medium">{perda.identificacao ?? "—"}</span></div>
          <div><span className="text-muted-foreground">Item:</span> <span className="font-medium">{perda.modelo} · <CorChip cor={perda.cor} /> · {perda.tamanho}</span></div>
          <div><span className="text-muted-foreground">Motivo original:</span> {perda.motivo ?? "—"}</div>
          <div><span className="text-muted-foreground">Área original:</span> {perda.erro_producao ? "Produção" : (perda.area_erro ?? "—")}</div>
          <div><span className="text-muted-foreground">Restante:</span> <span className="font-semibold tabular-nums">{perda.qtd}</span> peça(s)</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Quantidade a reclassificar (máx {perda.qtd})</Label><Input type="number" min="1" max={perda.qtd} value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
          <div>
            <Label>Motivo novo *</Label>
            <Select value={motivoNovo} onValueChange={setMotivoNovo}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>{motivos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Oficina (opcional)</Label>
            <Select value={oficinaId || "__none__"} onValueChange={(v) => setOficinaId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {oficinas.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Berço (opcional)</Label><Input value={berco} onChange={(e) => setBerco(e.target.value)} /></div>
          <div>
            <Label>Destino (opcional)</Label>
            <Select value={destino || "__none__"} onValueChange={(v) => setDestino(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {destinosItems.map((d) => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Observação *</Label>
            <Textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Explique por que a origem/motivo foi alterado." />
          </div>
        </div>
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 flex gap-2 items-start">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          Reclassificação é <strong>irreversível</strong>. O episódio de refação do PCP <strong>não</strong> será alterado; apenas a exibição no Controle de Perdas passa a mostrar a nova origem.
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvar.isPending}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Confirmar reclassificação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
