import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Undo2 } from "lucide-react";
import { useColorSettings } from "@/hooks/use-color-settings";
import { RefacaoDialog, type RefacaoFormPayload } from "./RefacaoDialog";
import { episodioAberto, type Pedido } from "@/lib/pedidos";

export type VoltarDestino = "dados" | "arte" | "dtf" | "silk" | "acabamento";

const LABEL: Record<VoltarDestino, string> = {
  dados: "Input de Produção",
  arte: "Arte",
  dtf: "DTF",
  silk: "Silk",
  acabamento: "Acabamento",
};

interface Props {
  destinos: VoltarDestino[];
  pedido: Pedido | null;
  /**
   * Callback do Refazer. `payload` é null quando o pedido já tem um
   * episódio aberto (apenas atualiza o destino do episódio).
   */
  onVoltar: (destino: VoltarDestino, payload: RefacaoFormPayload | null) => void | Promise<void>;
  disabled?: boolean;
}

export function VoltarDropdown({ destinos, pedido, onVoltar, disabled }: Props) {
  const [sel, setSel] = useState<VoltarDestino>(destinos[0] ?? "arte");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { btnStyle } = useColorSettings();
  if (destinos.length === 0) return null;
  const style = btnStyle("voltar");
  const aberto = pedido ? episodioAberto(pedido) : null;

  function handleClick() {
    if (!pedido) return;
    if (aberto) {
      onVoltar(sel, null);
      return;
    }
    setDialogOpen(true);
  }

  return (
    <>
      <div className="inline-flex items-center gap-1">
        <Select value={sel} onValueChange={(v) => setSel(v as VoltarDestino)} disabled={disabled}>
          <SelectTrigger className="h-9 w-[170px]" style={style}>
            <SelectValue placeholder="Refazer para..." />
          </SelectTrigger>
          <SelectContent>
            {destinos.map((d) => (
              <SelectItem key={d} value={d}>Refazer para {LABEL[d]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={handleClick}
          className="h-9"
          style={style}
        >
          <Undo2 className="h-4 w-4 mr-1" /> Refazer pedido
        </Button>
      </div>

      <RefacaoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        destinoLabel={LABEL[sel]}
        tipoEstampa={pedido?.tipo_estampa}
        onConfirm={(payload) => {
          setDialogOpen(false);
          onVoltar(sel, payload);
        }}
      />
    </>
  );
}
