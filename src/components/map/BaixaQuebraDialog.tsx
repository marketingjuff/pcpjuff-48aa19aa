import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  producaoId: string;
  quebraKg: number;
  quebraPecas: number;
  onDone: () => void;
}

export function BaixaQuebraDialog({ open, onOpenChange, producaoId, quebraKg, quebraPecas, onDone }: Props) {
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from("map_producoes")
      .update({
        quebra_conciliada: true,
        quebra_conciliacao_obs: obs.trim() || null,
        quebra_conciliada_em: new Date().toISOString(),
        quebra_conciliada_por: u.user?.id ?? null,
      })
      .eq("id", producaoId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Quebra conciliada.");
    onDone();
    onOpenChange(false);
    setObs("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader><DialogTitle>Dar baixa na quebra</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm">
            Quebra atual: <b className="tabular-nums">{quebraKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg</b>
            {" "}(~<span className="tabular-nums">{quebraPecas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span> peças).
          </div>
          <div>
            <Textarea rows={4} placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving}>Confirmar baixa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
