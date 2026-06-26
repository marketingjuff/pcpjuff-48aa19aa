import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import type { Pedido, PecaSolicitada } from "@/lib/pedidos";
import type { Cop } from "@/lib/cop";
import { rotuloCop } from "@/lib/cop";
import { dataUrgencia, addDiasUteis } from "@/lib/cop-saldos";
import { BaixaCopDialog } from "./BaixaCopDialog";
import { useCopColorSettings } from "@/hooks/use-cop-color-settings";

type LinhaFalta = {
  pedido: Pedido;
  itens: { idx: number; ps: PecaSolicitada; falta: number }[];
  faltaTotal: number;
  ancora: string | null; // data início estamparia/acabamento
  limite: string | null; // ancora -2 dias uteis
};

export function FaltaPorPedidoTab() {
  const qc = useQueryClient();
  const { btnStyle } = useCopColorSettings();

  const { data: cops = [] } = useQuery({
    queryKey: ["cops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cops" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Cop[];
    },
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-falta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos" as any).select("*")
        .eq("status_pecas", "incompleto");
      if (error) throw error;
      return (data ?? []) as unknown as Pedido[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("falta-pedido")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => qc.invalidateQueries({ queryKey: ["pedidos-falta"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "cops" }, () => qc.invalidateQueries({ queryKey: ["cops"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const [busca, setBusca] = useState("");

  const linhas: LinhaFalta[] = useMemo(() => {
    const arr: LinhaFalta[] = [];
    for (const p of pedidos) {
      const itens = (p.pecas_solicitadas ?? []).map((ps, idx) => ({
        idx,
        ps,
        falta: Math.max(0, (Number(ps.qtd) || 0) - (Number(ps.qtd_enviada) || 0)),
      })).filter((x) => x.falta > 0);
      if (itens.length === 0) continue;
      if (busca) {
        const orc = String(p.orcamento ?? "").toLowerCase();
        const ped = String((p as any).pedido_olist ?? "").toLowerCase();
        if (!orc.includes(busca.toLowerCase()) && !ped.includes(busca.toLowerCase())) continue;
      }
      const faltaTotal = itens.reduce((s, x) => s + x.falta, 0);
      const ancora = dataUrgencia(p);
      const limite = ancora ? addDiasUteis(ancora, -2) : null;
      arr.push({ pedido: p, itens, faltaTotal, ancora, limite });
    }
    arr.sort((a, b) => {
      const da = a.ancora ?? "9999-12-31";
      const db = b.ancora ?? "9999-12-31";
      return da.localeCompare(db);
    });
    return arr;
  }, [pedidos, busca]);

  // Baixa dialog
  const [baixa, setBaixa] = useState<{
    pedido: Pedido; idx: number; ps: PecaSolicitada; falta: number;
  } | null>(null);

  const baixar = useMutation({
    mutationFn: async ({ pedido, idx, copId, qtd }: { pedido: Pedido; idx: number; copId: string; qtd: number }) => {
      const cop = cops.find((c) => c.id === copId);
      if (!cop) throw new Error("COP não encontrado.");
      const arr = ((pedido.pecas_solicitadas as PecaSolicitada[] | null) ?? []).slice();
      const linha = { ...(arr[idx] as PecaSolicitada) };
      const novaEnviada = Math.min(linha.qtd, (Number(linha.qtd_enviada) || 0) + qtd);
      arr[idx] = { ...linha, qtd_enviada: novaEnviada };

      const { data: ses } = await supabase.auth.getUser();
      const novoLog = [
        ...((pedido.pecas_completadas_log ?? []) as any[]),
        {
          modelo: linha.modelo, cor: linha.cor, tamanho: linha.tamanho, qtd,
          em: new Date().toISOString(),
          por: ses.user?.id ?? null,
          cop_id: cop.id, cop_numero: cop.numero, cop_letra: cop.letra ?? null,
        },
      ];

      const { error } = await supabase
        .from("pedidos" as any)
        .update({ pecas_solicitadas: arr as any, pecas_completadas_log: novoLog as any })
        .eq("id", pedido.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos-falta"] });
      qc.invalidateQueries({ queryKey: ["pedidos-cop-saldos"] });
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      toast.success("Baixa registrada.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro na baixa."),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => {
            qc.invalidateQueries({ queryKey: ["pedidos-falta"] });
            qc.invalidateQueries({ queryKey: ["cops"] });
          }} title="Recarregar"><RefreshCw className="h-4 w-4" /></Button>
          <Input
            placeholder="Buscar orçamento/pedido Olist..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-9 w-[260px]"
          />
        </div>
        <div className="text-xs text-muted-foreground">{linhas.length} pedidos · ordenados por urgência</div>
      </div>

      {linhas.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">Nenhum pedido com peças faltantes.</CardContent></Card>
      ) : linhas.map((l) => (
        <Card key={l.pedido.id} className="border-l-4" style={{ borderLeftColor: (l.limite && l.limite < new Date().toISOString().slice(0,10)) ? "#dc2626" : "#0ea5e9" }}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <CardTitle className="text-base">
                Orç. <span className="font-mono">{l.pedido.orcamento ?? "—"}</span>
                {" · "}<span className="font-normal text-sm">{(l.pedido as any).cliente ?? "—"}</span>
              </CardTitle>
              <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                <span>Início estamparia/acabamento: <b>{l.ancora ?? "—"}</b></span>
                <span>Limite de recebimento (-2 dias úteis): <b className={l.limite && l.limite < new Date().toISOString().slice(0,10) ? "text-red-700" : ""}>{l.limite ?? "—"}</b></span>
                <span>Falta total: <b className="text-amber-700 tabular-nums">{l.faltaTotal}</b></span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="p-2 text-left">Modelo</th>
                    <th className="p-2 text-left">Cor</th>
                    <th className="p-2 text-center">Tamanho</th>
                    <th className="p-2 text-right">Qtd</th>
                    <th className="p-2 text-right">Enviado</th>
                    <th className="p-2 text-right">Falta</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {l.itens.map(({ idx, ps, falta }) => {
                    const hex = corHex(ps.cor); const fg = corTextoSobre(hex);
                    return (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{ps.modelo}</td>
                        <td className="p-2"><span className="inline-block px-2 py-0.5 rounded text-xs" style={{ backgroundColor: hex, color: fg }}>{ps.cor}</span></td>
                        <td className="p-2 text-center">{ps.tamanho}</td>
                        <td className="p-2 text-right tabular-nums">{ps.qtd}</td>
                        <td className="p-2 text-right tabular-nums">{ps.qtd_enviada}</td>
                        <td className="p-2 text-right tabular-nums text-amber-700 font-semibold">{falta}</td>
                        <td className="p-2 text-right">
                          <Button size="sm" style={btnStyle("dar_baixa")} onClick={() => setBaixa({ pedido: l.pedido, idx, ps, falta })}>
                            Dar baixa
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(l.pedido.pecas_completadas_log?.length ?? 0) > 0 && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Histórico de baixas pelo COP ({l.pedido.pecas_completadas_log!.length})</summary>
                <ul className="mt-1 space-y-0.5">
                  {l.pedido.pecas_completadas_log!.map((log, i) => (
                    <li key={i}>
                      <span className="font-mono">{new Date(log.em).toLocaleString("pt-BR")}</span>
                      {" — "}{log.qtd}× {log.modelo} · {log.cor} · {log.tamanho}
                      {" (COP "}<b>{rotuloCop(log.cop_numero, log.cop_letra)}</b>{")"}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      ))}

      {baixa && (
        <BaixaCopDialog
          open={!!baixa}
          onOpenChange={(o) => !o && setBaixa(null)}
          modelo={baixa.ps.modelo}
          cor={baixa.ps.cor}
          tamanho={baixa.ps.tamanho}
          faltaMax={baixa.falta}
          cops={cops}
          onConfirm={async (copId, qtd) => {
            await baixar.mutateAsync({ pedido: baixa.pedido, idx: baixa.idx, copId, qtd });
          }}
        />
      )}
    </div>
  );
}
