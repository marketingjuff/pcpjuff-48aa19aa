import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInputBR } from "@/components/ui/date-input";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Pedido } from "@/lib/pedidos";
import { formatDateBR } from "@/lib/format";
import { useFeriados } from "@/hooks/use-feriados";
import { inicioAcabamentoDoPedido, temSegundaOuQuinta, proximaSegundaOuQuinta } from "@/lib/pcp-monitor";
import { tipoIncluiDTF, tipoIncluiSilk } from "@/lib/pedidos";

export type ConflitoTipo = "prazo" | "video" | null;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pedido: Pedido | null;
  /** datas propostas (já com o arrasto aplicado) */
  proposta: Partial<Pedido> | null;
  conflito: ConflitoTipo;
  onSave: (p: Partial<Pedido> & { id: string }) => void;
  onCancel: () => void;
}

export function EditarDatasDialog({ open, onOpenChange, pedido, proposta, conflito, onSave, onCancel }: Props) {
  const { feriados } = useFeriados();
  const [form, setForm] = useState<Partial<Pedido>>({});

  useEffect(() => {
    if (!open || !pedido) return;
    setForm({
      dias_secagem: pedido.dias_secagem,
      arte_data: pedido.arte_data,
      inicio_estamparia: pedido.inicio_estamparia,
      termino_estamparia: pedido.termino_estamparia,
      termino_acabamento: pedido.termino_acabamento,
      ...(proposta ?? {}),
    });
  }, [open, pedido, proposta]);

  const merged = useMemo(() => ({ ...(pedido ?? {}), ...form }) as Pedido, [pedido, form]);
  const inicioAcab = useMemo(() => inicioAcabamentoDoPedido(merged, feriados), [merged, feriados]);

  const precisaVideo =
    !!pedido?.necessita_captacao_video &&
    (tipoIncluiSilk(merged.tipo_estampa ?? null) || tipoIncluiDTF(merged.tipo_estampa ?? null));
  const semJanelaVideo =
    precisaVideo && !temSegundaOuQuinta(merged.inicio_estamparia, merged.termino_estamparia);
  const estouraPrazo =
    !!merged.termino_acabamento && !!merged.saida_juff && merged.termino_acabamento > merged.saida_juff;

  function set<K extends keyof Pedido>(k: K, v: Pedido[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function encaixarVideo() {
    if (!merged.inicio_estamparia) return;
    const alvo = proximaSegundaOuQuinta(merged.inicio_estamparia);
    set("inicio_estamparia", alvo as any);
    if (merged.termino_estamparia && merged.termino_estamparia < alvo) {
      set("termino_estamparia", alvo as any);
    }
  }

  function salvar() {
    if (!pedido) return;
    if (merged.inicio_estamparia && merged.termino_estamparia && merged.termino_estamparia < merged.inicio_estamparia) {
      toast.error("Término da estamparia não pode ser antes do início.");
      return;
    }
    if (merged.arte_data && merged.inicio_estamparia && merged.arte_data > merged.inicio_estamparia) {
      toast.error("A Arte precisa acontecer até o início da estamparia.");
      return;
    }
    if (inicioAcab && merged.termino_acabamento && merged.termino_acabamento < inicioAcab) {
      toast.error("Término do acabamento não pode ser antes do início calculado.");
      return;
    }
    onSave({
      id: pedido.id,
      dias_secagem: form.dias_secagem ?? null,
      arte_data: form.arte_data ?? null,
      inicio_estamparia: form.inicio_estamparia ?? null,
      termino_estamparia: form.termino_estamparia ?? null,
      termino_acabamento: form.termino_acabamento ?? null,
      inicio_acabamento: inicioAcab,
    } as any);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v) onCancel(); onOpenChange(v); }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar datas do pedido {pedido?.pedido_olist ?? ""}</DialogTitle>
        </DialogHeader>

        {(conflito || estouraPrazo || semJanelaVideo) && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[12.5px] text-amber-900">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              {(conflito === "prazo" || estouraPrazo) && (
                <div>O término do acabamento passa da Saída Juff ({formatDateBR(merged.saida_juff)}).</div>
              )}
              {(conflito === "video" || semJanelaVideo) && (
                <div>
                  Este pedido tem captação de vídeo e a estamparia não cai em nenhuma segunda ou quinta.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Dias de Secagem</Label>
            <Input
              type="number"
              min={0}
              value={String(form.dias_secagem ?? "")}
              onChange={(e) => set("dias_secagem", (e.target.value === "" ? null : Number(e.target.value)) as any)}
            />
          </div>
          <div className="space-y-1">
            <Label>Arte</Label>
            <DateInputBR value={form.arte_data ?? null} onChange={(v) => set("arte_data", v as any)} />
          </div>
          <div className="space-y-1">
            <Label>Início Estamparia</Label>
            <DateInputBR value={form.inicio_estamparia ?? null} onChange={(v) => set("inicio_estamparia", v as any)} />
          </div>
          <div className="space-y-1">
            <Label>Término Estamparia</Label>
            <DateInputBR value={form.termino_estamparia ?? null} onChange={(v) => set("termino_estamparia", v as any)} />
          </div>
          <div className="space-y-1">
            <Label>Início de Acabamento</Label>
            <Input readOnly disabled value={formatDateBR(inicioAcab)} className="bg-muted text-muted-foreground" />
            <p className="text-[10.5px] text-muted-foreground">calculada</p>
          </div>
          <div className="space-y-1">
            <Label>Término Acabamento</Label>
            <DateInputBR value={form.termino_acabamento ?? null} onChange={(v) => set("termino_acabamento", v as any)} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Saída Juff</Label>
            <Input readOnly disabled value={formatDateBR(merged.saida_juff)} className="bg-muted text-muted-foreground" />
            <p className="text-[10.5px] text-muted-foreground">
              calculada — só muda pela data de entrega, no Input do Vendedor
            </p>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {semJanelaVideo && merged.inicio_estamparia && (
            <Button variant="outline" onClick={encaixarVideo}>
              Encaixar na próxima segunda/quinta ({formatDateBR(proximaSegundaOuQuinta(merged.inicio_estamparia))})
            </Button>
          )}
          <Button variant="outline" onClick={() => { onCancel(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={salvar}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
