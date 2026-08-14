import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { patchEstoquePeca, type HistoricoCorrecaoEvento, type MapEstoquePeca } from "@/lib/map";
import { CorChip } from "@/components/shared/cor-chip";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  peca: MapEstoquePeca;
  onDone: () => void;
}

export function ReceberPecaCorrigidaDialog({ open, onOpenChange, peca, onDone }: Props) {
  const [numero, setNumero] = useState("");
  const [nf, setNf] = useState("");
  const [dataEntrada, setDataEntrada] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNumero("");
      setNf("");
      setDataEntrada(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  const titulo = peca.correcao_tipo === "retrabalhar" ? "Receber peça retrabalhada" : "Receber peça retingida";
  const valido = numero.trim() !== "" && nf.trim() !== "" && dataEntrada !== "";

  async function confirmar() {
    if (!valido) return;
    setSaving(true);
    try {
      const evento: HistoricoCorrecaoEvento = {
        tipo: "retorno",
        em: new Date().toISOString(),
        correcao: peca.correcao_tipo ?? undefined,
        numero_peca_antigo: peca.numero_peca ?? null,
        nota_fiscal_antiga: peca.nota_fiscal ?? null,
        cor_antiga: peca.cor ?? null,
        data_entrada_antiga: peca.data_entrada ?? null,
        numero_peca_novo: numero.trim(),
        nota_fiscal_nova: nf.trim(),
        data_entrada_nova: dataEntrada,
      };
      const historico = [...(Array.isArray(peca.historico_correcoes) ? peca.historico_correcoes : []), evento];
      await patchEstoquePeca(peca.id, {
        numero_peca: numero.trim(),
        nota_fiscal: nf.trim(),
        data_entrada: dataEntrada,
        cor: peca.cor_nova ?? peca.cor ?? null,
        status: "Fechada",
        data_abertura: null,
        devolucao_motivo: null,
        devolucao_data: null,
        devolucao_nf: null,
        correcao_tipo: null,
        correcao_status: null,
        cor_nova: null,
        historico_correcoes: historico,
      } as any);
      toast.success("Peça recebida e devolvida ao estoque.");
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao receber peça.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Novo nº da peça</Label>
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Nova NF</Label>
            <Input value={nf} onChange={(e) => setNf(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Nova data de entrada</Label>
            <Input type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} />
          </div>
          <div className="col-span-2 text-[11px] text-muted-foreground">
            Cor ao voltar: <CorChip cor={peca.cor_nova ?? peca.cor} /> · metragem e largura mantidas.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!valido || saving}>Receber</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
