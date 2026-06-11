import type { Pedido } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calcularEtapaAtual } from "@/lib/pedidos";

interface Props {
  pedidos: Pedido[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter?: (p: Pedido) => boolean;
}

export function PedidoSelector({ pedidos, selectedId, onSelect, filter }: Props) {
  const filtered = filter ? pedidos.filter(filter) : pedidos;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Pedidos ({filtered.length})</CardTitle></CardHeader>
      <CardContent className="p-0 max-h-[600px] overflow-y-auto">
        <ul className="divide-y">
          {filtered.map((p) => {
            const { etapa } = calcularEtapaAtual(p);
            return (
              <li
                key={p.id}
                onClick={() => onSelect(p.id)}
                className={`cursor-pointer px-4 py-3 hover:bg-accent transition-colors ${selectedId === p.id ? "bg-accent" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{p.pedido_olist}</span>
                  <Badge variant="outline" className="text-xs">{p.tipo_estampa}</Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">{p.orcamento}</div>
                <div className="text-xs text-muted-foreground mt-1">{etapa}</div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum pedido aplicável a esta etapa.
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm font-medium px-3 py-2 rounded-md bg-muted/50 border border-dashed">{value || "—"}</div>
    </div>
  );
}

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium">{label}</div>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-16 text-center text-sm text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}
