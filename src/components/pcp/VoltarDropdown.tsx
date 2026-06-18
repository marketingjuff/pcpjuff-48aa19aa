import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Undo2 } from "lucide-react";

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
  onVoltar: (destino: VoltarDestino) => void | Promise<void>;
  disabled?: boolean;
}

export function VoltarDropdown({ destinos, onVoltar, disabled }: Props) {
  const [sel, setSel] = useState<VoltarDestino>(destinos[0] ?? "arte");
  if (destinos.length === 0) return null;
  return (
    <div className="inline-flex items-center gap-1">
      <Select value={sel} onValueChange={(v) => setSel(v as VoltarDestino)} disabled={disabled}>
        <SelectTrigger className="h-9 w-[170px] bg-[#cf0e0e] text-white border-[#cf0e0e] hover:bg-[#b00b0b]">
          <SelectValue placeholder="Voltar para..." />
        </SelectTrigger>
        <SelectContent>
          {destinos.map((d) => (
            <SelectItem key={d} value={d}>Voltar para {LABEL[d]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        onClick={() => onVoltar(sel)}
        className="bg-[#cf0e0e] hover:bg-[#b00b0b] text-white h-9"
      >
        <Undo2 className="h-4 w-4 mr-1" /> OK
      </Button>
    </div>
  );
}
