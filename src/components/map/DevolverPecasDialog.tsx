import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAppList } from "@/lib/app-lists";
import { corBase, patchEstoquePeca, type HistoricoCorrecaoEvento, type MapEstoquePeca } from "@/lib/map";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pecas: MapEstoquePeca[];
  onDone: () => void;
}

export function DevolverPecasDialog({ open, onOpenChange, pecas, onDone }: Props) {
  const { names: motivos } = useAppList("map_motivo_devolucao");
  const [data, setData] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [nf, setNf] = useState<string>("");
  const [motivoPorPeca, setMotivoPorPeca] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setData(new Date().toISOString().slice(0, 10));
      setNf("");
      setMotivoPorPeca({});
    }
  }, [open]);

  const podeConfirmar = useMemo(
    () => pecas.length > 0 && !!data && pecas.every((p) => (motivoPorPeca[p.id] ?? "").trim() !== ""),
    [pecas, data, motivoPorPeca],
  );

  async function confirmar() {
    if (!podeConfirmar) return;
    setSaving(true);
    try {
      for (const p of pecas) {
        const motivo = motivoPorPeca[p.id];
        const evento: HistoricoCorrecaoEvento = {
          tipo: "devolucao",
          em: new Date().toISOString(),
          motivo,
          data_devolucao: data,
          nf_devolucao: nf.trim() || null,
          numero_peca_antigo: p.numero_peca ?? null,
          nota_fiscal_antiga: p.nota_fiscal ?? null,
          cor_antiga: p.cor ?? null,
          data_entrada_antiga: p.data_entrada ?? null,
        };
        const historico = [...(Array.isArray(p.historico_correcoes) ? p.historico_correcoes : []), evento];
        await patchEstoquePeca(p.id, {
          status: "Devolvida",
          devolucao_motivo: motivo,
          devolucao_data: data,
          devolucao_nf: nf.trim() || null,
          historico_correcoes: historico,
        } as any);
      }
      toast.success(`${pecas.length} peça(s) devolvida(s).`);
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao registrar devolução.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader><DialogTitle>Devolver peças</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Data da devolução</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">NF de devolução (opcional)</Label>
            <Input value={nf} onChange={(e) => setNf(e.target.value)} placeholder="Pode preencher depois" />
          </div>
        </div>

        <div className="mt-1 max-h-[45vh] overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-2">Peça</th>
                <th className="p-2 w-[220px]">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {pecas.map((p, i) => (
                <tr key={p.id} className={`border-t ${i % 2 ? "bg-muted/20" : ""}`}>
                  <td className="p-2">
                    <span className="font-semibold tabular-nums">{p.ne != null ? `NE${p.ne}` : "—"}</span>
                    {" · "}
                    {p.numero_peca ?? "—"}
                    {" · "}
                    {corBase(p.cor) || "—"}
                  </td>
                  <td className="p-2">
                    <Select
                      value={motivoPorPeca[p.id] ?? ""}
                      onValueChange={(v) => setMotivoPorPeca((s) => ({ ...s, [p.id]: v }))}
                    >
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {motivos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!podeConfirmar || saving}>Confirmar devolução</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
