import { Badge } from "@/components/ui/badge";
import { temEpisodioAberto, type Pedido } from "@/lib/pedidos";

export function RefacaoBadge({ pedido }: { pedido: Pedido }) {
  if (!temEpisodioAberto(pedido)) return null;
  return (
    <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/40">
      Em refação
    </Badge>
  );
}
