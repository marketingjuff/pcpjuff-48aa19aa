import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { tipoIncluiDTF } from "@/lib/pedidos";

export type RefacaoFormPayload = {
  pecas_refazer: number;
  perda_pecas: number;
  perda_adesivos: number;
  pecas_extras?: number;
  motivo: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinoLabel: string;
  destino: "dados" | "arte" | "dtf" | "silk" | "acabamento";
  tipoEstampa: string | null | undefined;
  onConfirm: (payload: RefacaoFormPayload) => void;
}

export function RefacaoDialog({ open, onOpenChange, destinoLabel, destino, tipoEstampa, onConfirm }: Props) {
  const mostraAdesivos = tipoIncluiDTF(tipoEstampa);
  const mostraExtras = destino === "dados";
  const [pecasRefazer, setPecasRefazer] = useState<string>("");
  const [houvePerdaPecas, setHouvePerdaPecas] = useState<"sim" | "nao" | "">("");
  const [perdaPecas, setPerdaPecas] = useState<string>("");
  const [houvePerdaAdesivos, setHouvePerdaAdesivos] = useState<"sim" | "nao" | "">("");
  const [perdaAdesivos, setPerdaAdesivos] = useState<string>("");
  const [pecasExtras, setPecasExtras] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    if (open) {
      setPecasRefazer("");
      setHouvePerdaPecas("");
      setPerdaPecas("");
      setHouvePerdaAdesivos("");
      setPerdaAdesivos("");
      setPecasExtras("");
      setMotivo("");
      setErr("");
    }
  }, [open]);

  function confirmar() {
    const nPecas = Number(pecasRefazer);
    if (!Number.isFinite(nPecas) || nPecas < 1) {
      setErr("Informe quantas peças serão refeitas (mínimo 1).");
      return;
    }
    if (houvePerdaPecas === "") {
      setErr("Informe se houve perda de peças.");
      return;
    }
    let nPerdaPecas = 0;
    if (houvePerdaPecas === "sim") {
      nPerdaPecas = Number(perdaPecas);
      if (!Number.isFinite(nPerdaPecas) || nPerdaPecas < 1) {
        setErr("Informe quantas peças foram perdidas.");
        return;
      }
    }
    let nPerdaAdesivos = 0;
    if (mostraAdesivos) {
      if (houvePerdaAdesivos === "") {
        setErr("Informe se houve perda de adesivos.");
        return;
      }
      if (houvePerdaAdesivos === "sim") {
        nPerdaAdesivos = Number(perdaAdesivos);
        if (!Number.isFinite(nPerdaAdesivos) || nPerdaAdesivos < 1) {
          setErr("Informe quantos adesivos foram perdidos.");
          return;
        }
      }
    }
    if (!motivo.trim()) {
      setErr("O motivo é obrigatório.");
      return;
    }
    onConfirm({
      pecas_refazer: nPecas,
      perda_pecas: nPerdaPecas,
      perda_adesivos: nPerdaAdesivos,
      motivo: motivo.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Refazer pedido</DialogTitle>
          <DialogDescription>
            Destino: <strong>{destinoLabel}</strong>. Registre os dados da refação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Quantas peças serão refeitas? *</Label>
            <Input
              type="number"
              min="1"
              value={pecasRefazer}
              onChange={(e) => setPecasRefazer(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Houve perda de peças? *</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={houvePerdaPecas === "sim" ? "default" : "outline"} onClick={() => setHouvePerdaPecas("sim")}>Sim</Button>
                <Button type="button" size="sm" variant={houvePerdaPecas === "nao" ? "default" : "outline"} onClick={() => { setHouvePerdaPecas("nao"); setPerdaPecas(""); }}>Não</Button>
              </div>
            </div>
            {houvePerdaPecas === "sim" && (
              <div className="space-y-1">
                <Label>Quantas peças perdidas? *</Label>
                <Input
                  type="number"
                  min="1"
                  value={perdaPecas}
                  onChange={(e) => setPerdaPecas(e.target.value)}
                />
              </div>
            )}
          </div>

          {mostraAdesivos && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Houve perda de adesivos? *</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={houvePerdaAdesivos === "sim" ? "default" : "outline"} onClick={() => setHouvePerdaAdesivos("sim")}>Sim</Button>
                  <Button type="button" size="sm" variant={houvePerdaAdesivos === "nao" ? "default" : "outline"} onClick={() => { setHouvePerdaAdesivos("nao"); setPerdaAdesivos(""); }}>Não</Button>
                </div>
              </div>
              {houvePerdaAdesivos === "sim" && (
                <div className="space-y-1">
                  <Label>Quantos adesivos perdidos? *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={perdaAdesivos}
                    onChange={(e) => setPerdaAdesivos(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label>Motivo *</Label>
            <Textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da refação"
            />
          </div>

          {err && <div className="text-sm text-destructive">{err}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar}>Confirmar refação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
