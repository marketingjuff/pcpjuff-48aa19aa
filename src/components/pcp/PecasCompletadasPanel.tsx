import type { Pedido } from "@/lib/pedidos";
import { rotuloCop } from "@/lib/cop";

interface Props { pedido: Pedido | null }

export function PecasCompletadasPanel({ pedido }: Props) {
  type LogItem = NonNullable<Pedido["pecas_completadas_log"]>[number];
  const raw = pedido?.pecas_completadas_log as unknown;
  const log: LogItem[] = Array.isArray(raw) ? (raw as LogItem[]) : [];
  if (!pedido || log.length === 0) return null;
  return (
    <div className="mt-2 rounded-md border bg-emerald-50/50 border-emerald-200 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-emerald-900 mb-1">
        Peças completadas pelo COP ({log.length})
      </div>
      <ul className="text-xs space-y-0.5">
        {log.slice().reverse().map((l, i) => (
          <li key={i} className="text-emerald-900">
            <span className="font-mono">{new Date(l.em).toLocaleString("pt-BR")}</span>
            {" — "}<b>{l.qtd}×</b> {l.modelo} · {l.cor} · {l.tamanho}
            {l.cop_numero != null && (
              <> {" "}<span className="text-emerald-700">(COP {rotuloCop(l.cop_numero, l.cop_letra ?? null)})</span></>
            )}
            {l.observacao && <> {" — "}<i className="text-emerald-700">{l.observacao}</i></>}
          </li>
        ))}
      </ul>
    </div>
  );
}
