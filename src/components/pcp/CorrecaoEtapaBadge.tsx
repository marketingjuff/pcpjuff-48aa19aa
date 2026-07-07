import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { CorrecaoEtapa, Pedido } from "@/lib/pedidos";
import { resolveNome, useProfilesMap } from "@/hooks/use-profiles-map";

function fmtBR(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export function CorrecaoEtapaBadge({ pedido }: { pedido: Pedido }) {
  const historico: CorrecaoEtapa[] = Array.isArray(pedido.correcoes_etapa)
    ? pedido.correcoes_etapa
    : [];
  const profiles = useProfilesMap();
  if (historico.length === 0) return null;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Badge
          variant="outline"
          className="bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300 cursor-help"
        >
          {historico.length} {historico.length === 1 ? "correção" : "correções"} de etapa
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent className="w-96 text-xs space-y-2">
        <div className="font-semibold text-sm">Histórico de correções</div>
        <ol className="space-y-2 list-decimal list-inside">
          {historico.map((c, i) => {
            const nome = resolveNome(profiles, c.usuario_id);
            return (
              <li key={i} className="space-y-0.5">
                <div>
                  <span className="text-muted-foreground">{fmtBR(c.data)}</span> — <strong>{nome}</strong>
                </div>
                <div>
                  <span className="uppercase text-[10px] tracking-wide text-muted-foreground">de</span>{" "}
                  {c.etapa_anterior}{" "}
                  <span className="uppercase text-[10px] tracking-wide text-muted-foreground">→</span>{" "}
                  {c.etapa_nova_apos_correcao}
                </div>
                {c.observacao && (
                  <div className="text-muted-foreground italic">"{c.observacao}"</div>
                )}
              </li>
            );
          })}
        </ol>
      </HoverCardContent>
    </HoverCard>
  );
}
