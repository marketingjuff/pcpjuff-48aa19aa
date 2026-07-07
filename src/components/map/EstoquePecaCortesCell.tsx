import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { MapEstoquePeca, MapEstoqueCorte } from "@/lib/map";
import { corBase, patchEstoquePeca } from "@/lib/map";
import { rotuloCop } from "@/lib/cop";
import type { Cop } from "@/lib/cop";

interface Props {
  peca: MapEstoquePeca;
  copsAtivos: Cop[];
  onChanged: () => void;
}

export function EstoquePecaCortesCell({ peca, copsAtivos, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [copId, setCopId] = useState<string>("");
  const [metros, setMetros] = useState<string>("");
  const cortes = peca.cortes ?? [];

  const base = corBase(peca.cor).toLowerCase();
  const opcoes = copsAtivos.filter((c) =>
    (c.pecas ?? []).some((pc) => corBase(pc.cor).toLowerCase() === base),
  );

  async function addCorte() {
    const cop = opcoes.find((c) => c.id === copId);
    const m = Number(metros);
    if (!cop || !Number.isFinite(m) || m <= 0) {
      toast.error("Selecione um COP e informe metros válidos.");
      return;
    }
    const novo: MapEstoqueCorte = {
      cop_id: cop.id,
      cop_numero: cop.numero,
      letra: cop.letra,
      metros: m,
      data: new Date().toISOString().slice(0, 10),
    };
    const novosCortes = [...cortes, novo];
    const somaCortes = novosCortes.reduce((s, c) => s + Number(c.metros ?? 0), 0);
    const alt = peca.alt_inicial != null ? Number(peca.alt_inicial) : null;
    const patch: Partial<MapEstoquePeca> = { cortes: novosCortes };
    if (alt != null && alt - somaCortes <= 0) {
      patch.status = "100% utilizada";
    }
    try {
      await patchEstoquePeca(peca.id, patch);
      setOpen(false);
      setCopId("");
      setMetros("");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar corte.");
    }
  }

  async function removerCorte(idx: number) {
    if (!confirm("Remover este corte?")) return;
    const novosCortes = cortes.filter((_, i) => i !== idx);
    try {
      await patchEstoquePeca(peca.id, { cortes: novosCortes });
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao remover.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {cortes.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-sm bg-muted/70 px-1.5 py-0.5 text-[11.5px] tabular-nums"
          title={c.data ? `Data: ${c.data}` : undefined}
        >
          COP {rotuloCop(c.cop_numero, c.letra)} · {c.metros}m
          <button
            type="button"
            onClick={() => removerCorte(i)}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Remover corte"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="icon" variant="ghost" className="h-6 w-6" title="Adicionar corte">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2 space-y-2" align="start">
          <div className="text-xs font-medium">Novo corte</div>
          <Select value={copId} onValueChange={setCopId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecionar COP…" />
            </SelectTrigger>
            <SelectContent>
              {opcoes.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Nenhum COP em andamento com essa cor.
                </div>
              ) : (
                opcoes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    COP {rotuloCop(c.numero, c.letra)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Metros"
            value={metros}
            onChange={(e) => setMetros(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="h-7" onClick={addCorte}>
              Adicionar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
