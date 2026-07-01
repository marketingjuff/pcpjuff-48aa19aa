import { useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import type { Pedido } from "@/lib/pedidos";
import { calcularEtapaAtual } from "@/lib/pedidos";
import type { Cop, Oficina } from "@/lib/cop";
import { rotuloRomaneio } from "@/lib/cop";
import { copAtivoEmOficina } from "@/lib/cop-oficinas";
import { dataUrgencia } from "@/lib/cop-saldos";

function fmtBR(d: string | null | undefined): string {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modelo: string;
  cor: string;
  tamanho: string;
  pedidos: Pedido[];
  cops: Cop[];
  oficinas: Oficina[];
}

export function FaltaPecaPopup({ open, onOpenChange, modelo, cor, tamanho, pedidos, cops, oficinas }: Props) {
  const hex = corHex(cor);
  const fg = corTextoSobre(hex);

  const oficinaMap = useMemo(() => {
    const m = new Map<string, Oficina>();
    for (const o of oficinas) m.set(o.id, o);
    return m;
  }, [oficinas]);

  // Romaneios ativos com a peça
  const romaneios = useMemo(() => {
    const out: { cop: Cop; qtd: number; recebido: number; saldo: number; rotulo: string; oficinaNome: string }[] = [];
    for (const c of cops) {
      if (!copAtivoEmOficina(c)) continue;
      const qtd = (c.pecas ?? []).filter((p) => p.modelo === modelo && p.cor === cor && p.tamanho === tamanho)
        .reduce((s, p) => s + (Number(p.qtd) || 0), 0);
      if (qtd <= 0) continue;
      const recebido = (c.pecas_recebidas ?? []).filter((p) => p.modelo === modelo && p.cor === cor && p.tamanho === tamanho)
        .reduce((s, p) => s + (Number(p.qtd_recebida) || 0), 0);
      const saldo = qtd - recebido;
      out.push({
        cop: c,
        qtd,
        recebido,
        saldo,
        rotulo: rotuloRomaneio(c, cops),
        oficinaNome: c.oficina_id ? (oficinaMap.get(c.oficina_id)?.nome ?? "—") : "—",
      });
    }
    out.sort((a, b) => a.rotulo.localeCompare(b.rotulo));
    return out;
  }, [cops, oficinaMap, modelo, cor, tamanho]);

  // Pedidos com falta dessa peça
  const pedidosLista = useMemo(() => {
    const out: { pedido: Pedido; falta: number; ancora: string | null; etapa: string }[] = [];
    for (const p of pedidos) {
      const falta = (p.pecas_solicitadas ?? [])
        .filter((ps) => ps.modelo === modelo && ps.cor === cor && ps.tamanho === tamanho)
        .reduce((s, ps) => s + Math.max(0, (Number(ps.qtd) || 0) - (Number(ps.qtd_enviada) || 0)), 0);
      if (falta <= 0) continue;
      out.push({
        pedido: p,
        falta,
        ancora: dataUrgencia(p),
        etapa: calcularEtapaAtual(p).etapa,
      });
    }
    out.sort((a, b) => (a.ancora ?? "9999-12-31").localeCompare(b.ancora ?? "9999-12-31"));
    return out;
  }, [pedidos, modelo, cor, tamanho]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[960px]">
        <DialogHeader>
          <DialogTitle>
            {modelo} ·{" "}
            <span className="inline-block px-2 py-0.5 rounded text-xs align-middle" style={{ backgroundColor: hex, color: fg }}>{cor}</span>
            {" "}· {tamanho}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Esquerda — Romaneios */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Romaneios em oficina ({romaneios.length})</div>
            {romaneios.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">Nenhum romaneio ativo com essa peça.</div>
            ) : (
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {romaneios.map((r) => (
                  <a
                    key={r.cop.id}
                    href={`/cop?tab=romaneio&copId=${r.cop.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <Card className="hover:bg-accent/40 transition-colors cursor-pointer">
                      <CardContent className="p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold">{r.rotulo}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-muted">{r.cop.status}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Oficina: <b className="text-foreground">{r.oficinaNome}</b></div>
                        <div className="text-xs text-muted-foreground">Saída: {fmtBR(r.cop.data_saida_oficina)}</div>
                        <div className="text-xs flex gap-3">
                          <span>Qtd: <b className="tabular-nums">{r.qtd}</b></span>
                          <span>Recebido: <b className="tabular-nums">{r.recebido}</b></span>
                          <span>Saldo: <b className={`tabular-nums ${r.saldo > 0 ? "text-green-700" : "text-muted-foreground"}`}>{r.saldo}</b></span>
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Direita — Pedidos */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Pedidos com falta ({pedidosLista.length})</div>
            {pedidosLista.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">Nenhum pedido pede essa peça.</div>
            ) : (
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {pedidosLista.map(({ pedido, falta, ancora, etapa }) => (
                  <a
                    key={pedido.id}
                    href={`/?tab=dados&pedidoId=${pedido.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <Card className="hover:bg-accent/40 transition-colors cursor-pointer">
                      <CardContent className="p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold">{pedido.orcamento ?? "—"}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-muted">{etapa}</span>
                        </div>
                        {(pedido as any).pedido_olist && (
                          <div className="text-xs text-muted-foreground">Olist: <span className="font-mono text-foreground">{(pedido as any).pedido_olist}</span></div>
                        )}
                        {(pedido as any).responsavel && (
                          <div className="text-xs text-muted-foreground">Responsável: <span className="text-foreground">{(pedido as any).responsavel}</span></div>
                        )}
                        <div className="text-xs text-muted-foreground">Data urgência: {fmtBR(ancora)}</div>
                        <div className="text-xs">
                          Falta: <b className="text-amber-700 tabular-nums">-{falta}</b>
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
