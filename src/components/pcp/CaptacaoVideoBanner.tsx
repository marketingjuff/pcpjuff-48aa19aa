import { Button } from "@/components/ui/button";
import { AlertTriangle, Video } from "lucide-react";

interface Props {
  /** true quando o aviso deve aparecer (pedido pede vídeo e ainda não foi captado) */
  mostrar: boolean;
  soLeitura?: boolean;
  onCaptado: () => void;
}

/** Aviso vermelho para chamar o marketing. Em modo leitura o botão fica desabilitado. */
export function CaptacaoVideoBanner({ mostrar, soLeitura = false, onCaptado }: Props) {
  if (!mostrar) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border-4 border-red-600 bg-red-100 p-4">
      <AlertTriangle className="h-7 w-7 text-red-700 shrink-0" />
      <div className="flex-1 min-w-[240px]">
        <div className="text-base sm:text-lg font-bold uppercase tracking-wide text-red-800">
          Chamar o marketing para fazer o vídeo desta produção
        </div>
        <div className="text-[12px] text-red-700">O cliente pediu vídeo da estamparia sendo feita.</div>
      </div>
      <Button
        variant="destructive"
        disabled={soLeitura}
        title={soLeitura ? "Somente leitura" : undefined}
        onClick={onCaptado}
      >
        <Video className="h-4 w-4 mr-1" />Vídeo captado
      </Button>
    </div>
  );
}
