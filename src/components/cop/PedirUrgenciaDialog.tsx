import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Flame, Pencil, Plus, X } from "lucide-react";
import type { CopPeca, CopPecaRecebida, CopPerdaLinha, CopUrgenciaLinha, CopUrgenciaPedido } from "@/lib/cop";
import { getRecebida, getPerda, colunasTamanhos } from "@/lib/cop";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { cmpModeloCor, type PecaSolicitada } from "@/lib/pedidos";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rotulo: string;
  pecas: CopPeca[];
  recebidas: CopPecaRecebida[];
  perdas: CopPerdaLinha[];
  onConfirm: (obs: string, linhas: CopUrgenciaLinha[], pedidos: CopUrgenciaPedido[]) => void;
  disabled?: boolean;
};

type TamInfo = { tamanho: string; total: number; recebida: number; perda: number; pendente: number };
type Grupo = { modelo: string; cor: string; tamanhos: TamInfo[]; pendenteTotal: number };

function agruparPorModeloCor(
  pecas: CopPeca[],
  recebidas: CopPecaRecebida[],
  perdas: CopPerdaLinha[],
): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const p of pecas) {
    const k = `${p.modelo}|${p.cor}`;
    let g = map.get(k);
    if (!g) { g = { modelo: p.modelo, cor: p.cor, tamanhos: [], pendenteTotal: 0 }; map.set(k, g); }
    const total = Number(p.qtd) || 0;
    const rec = getRecebida(recebidas, p.modelo, p.cor, p.tamanho);
    const per = getPerda(perdas, p.modelo, p.cor, p.tamanho);
    const pend = Math.max(0, total - rec - per);
    g.tamanhos.push({ tamanho: p.tamanho, total, recebida: rec, perda: per, pendente: pend });
    g.pendenteTotal += pend;
  }
  return Array.from(map.values()).sort((a, b) => a.modelo.localeCompare(b.modelo) || a.cor.localeCompare(b.cor));
}

export function PedirUrgenciaDialog({ open, onOpenChange, rotulo, pecas, recebidas, perdas, onConfirm, disabled }: Props) {
  const cols = useMemo(() => colunasTamanhos(pecas.map((p) => p.tamanho)), [pecas]);
  const grupos = useMemo(() => agruparPorModeloCor(pecas, recebidas, perdas), [pecas, recebidas, perdas]);

  // qtds[`${modelo}|${cor}|${tamanho}`] = number
  const [qtds, setQtds] = useState<Record<string, number>>({});
  const [obs, setObs] = useState("");
  const [parcialEdit, setParcialEdit] = useState<string | null>(null);
  const [parcialVal, setParcialVal] = useState<string>("");
  const [pedidosSel, setPedidosSel] = useState<CopUrgenciaPedido[]>([]);

  useEffect(() => {
    if (!open) return;
    setQtds({});
    setObs("");
    setParcialEdit(null);
    setParcialVal("");
    setPedidosSel([]);
  }, [open]);

  // Modelo|Cor set do romaneio (usado para filtrar pedidos com peças faltantes compatíveis)
  const modelosCoresRomaneio = useMemo(() => {
    const s = new Set<string>();
    for (const p of pecas) s.add(`${String(p.modelo).toUpperCase()}|${String(p.cor).toUpperCase()}`);
    return s;
  }, [pecas]);

  const { data: pedidosIncompletos = [] } = useQuery({
    queryKey: ["pedidos-incompletos-urgencia"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos" as any)
        .select("id, orcamento, pedido_olist, pecas_solicitadas")
        .eq("status_pecas", "incompleto");
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        orcamento: string | null;
        pedido_olist: string | null;
        pecas_solicitadas: PecaSolicitada[] | null;
      }>;
    },
  });

  type PedidoMatch = {
    id: string;
    orcamento: string | null;
    pedido_olist: string | null;
    faltas: { modelo: string; cor: string; tamanho: string; falta: number }[];
  };

  const pedidosDisponiveis: PedidoMatch[] = useMemo(() => {
    const jaAdd = new Set(pedidosSel.map((p) => p.pedidoId));
    const out: PedidoMatch[] = [];
    for (const p of pedidosIncompletos) {
      if (jaAdd.has(p.id)) continue;
      const faltas: PedidoMatch["faltas"] = [];
      for (const ps of p.pecas_solicitadas ?? []) {
        const falta = Math.max(0, (Number(ps.qtd) || 0) - (Number(ps.qtd_enviada) || 0));
        if (falta <= 0) continue;
        const k = `${String(ps.modelo).toUpperCase()}|${String(ps.cor).toUpperCase()}`;
        if (modelosCoresRomaneio.has(k)) {
          faltas.push({ modelo: ps.modelo, cor: ps.cor, tamanho: ps.tamanho, falta });
        }
      }
      if (faltas.length > 0) out.push({ id: p.id, orcamento: p.orcamento, pedido_olist: p.pedido_olist, faltas });
    }
    out.sort((a, b) => String(a.orcamento ?? "").localeCompare(String(b.orcamento ?? "")));
    return out;
  }, [pedidosIncompletos, pedidosSel, modelosCoresRomaneio]);

  function adicionarPedido(pedidoId: string) {
    const p = pedidosDisponiveis.find((x) => x.id === pedidoId);
    if (!p) return;
    setPedidosSel((s) => [...s, { pedidoId: p.id, orcamento: p.orcamento, pedidoOlist: p.pedido_olist }]);
  }
  function removerPedido(pedidoId: string) {
    setPedidosSel((s) => s.filter((p) => p.pedidoId !== pedidoId));
  }

  function key(m: string, c: string, t: string) { return `${m}|${c}|${t}`; }

  function marcarCompleto(m: string, c: string, t: string, max: number) {
    setQtds((s) => ({ ...s, [key(m, c, t)]: max }));
    setParcialEdit(null);
  }
  function abrirParcial(m: string, c: string, t: string) {
    const k = key(m, c, t);
    setParcialEdit(k);
    setParcialVal(String(qtds[k] || ""));
  }
  function salvarParcial(m: string, c: string, t: string, max: number) {
    const v = Math.max(0, Math.min(max, Math.floor(Number(parcialVal) || 0)));
    setQtds((s) => {
      const next = { ...s };
      if (v > 0) next[key(m, c, t)] = v;
      else delete next[key(m, c, t)];
      return next;
    });
    setParcialEdit(null);
  }
  function marcarTodosLinha(g: Grupo) {
    setQtds((s) => {
      const next = { ...s };
      for (const t of g.tamanhos) if (t.pendente > 0) next[key(g.modelo, g.cor, t.tamanho)] = t.pendente;
      return next;
    });
  }
  function limparLinha(g: Grupo) {
    setQtds((s) => {
      const next = { ...s };
      for (const t of g.tamanhos) delete next[key(g.modelo, g.cor, t.tamanho)];
      return next;
    });
  }

  const linhasSelecionadas: CopUrgenciaLinha[] = grupos
    .map((g) => {
      const tams = g.tamanhos
        .map((t) => ({ tamanho: t.tamanho, qtd: qtds[key(g.modelo, g.cor, t.tamanho)] || 0 }))
        .filter((t) => t.qtd > 0);
      if (tams.length === 0) return null;
      return { modelo: g.modelo, cor: g.cor, tamanhos: tams } as CopUrgenciaLinha;
    })
    .filter((x): x is CopUrgenciaLinha => x !== null);

  const podeConfirmar = linhasSelecionadas.length > 0 && !disabled;

  function confirmar() {
    if (!podeConfirmar) return;
    onConfirm(obs.trim().toUpperCase(), linhasSelecionadas, pedidosSel);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-red-600" />
            Pedir Urgência — Romaneio {rotulo}
          </DialogTitle>
          <DialogDescription>
            Clique no <b>número</b> para marcar como urgente <b>toda</b> a quantidade pendente do tamanho (bolinha vermelha).
            Clique no <b>lápis</b> para informar uma quantidade <b>parcial</b> (bolinha cinza).
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border overflow-x-auto max-h-[60vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] sticky top-0">
              <tr>
                <th className="px-2 py-1 text-left min-w-[220px]">Modelo / Cor</th>
                {cols.map((t) => (
                  <th key={t} className="px-1 py-1 text-center w-[68px]">{t}</th>
                ))}
                <th className="px-2 py-1 text-right w-[80px]">Pend.</th>
                <th className="px-2 py-1 text-center w-[110px]"></th>
              </tr>
            </thead>
            <tbody>
              {grupos.length === 0 ? (
                <tr><td colSpan={3 + cols.length} className="p-3 text-center text-muted-foreground">Sem peças.</td></tr>
              ) : grupos.map((g) => {
                const hex = corHex(g.cor); const fg = corTextoSobre(hex);
                const linhaCompleta = g.pendenteTotal === 0;
                const byTam = new Map(g.tamanhos.map((t) => [t.tamanho, t]));
                return (
                  <tr key={`${g.modelo}|${g.cor}`} className={`border-t align-middle leading-tight ${linhaCompleta ? "opacity-60" : ""}`}>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{g.modelo}</span>
                        <span className="inline-block px-1.5 py-0 rounded text-[10px] font-bold" style={{ backgroundColor: hex, color: fg }}>{g.cor}</span>
                      </div>
                    </td>
                    {cols.map((tam) => {
                      const info = byTam.get(tam);
                      if (!info || info.total === 0) {
                        return (
                          <td key={tam} className="px-1 py-1 text-center">
                            <div className="rounded-full w-8 h-8 mx-auto flex items-center justify-center text-[11px] text-muted-foreground/40 border border-dashed">—</div>
                          </td>
                        );
                      }
                      if (info.pendente === 0) {
                        return (
                          <td key={tam} className="px-1 py-1 text-center">
                            <div className="rounded-full w-8 h-8 mx-auto flex items-center justify-center text-[11px] text-muted-foreground border border-dashed">✓</div>
                          </td>
                        );
                      }
                      const k = key(g.modelo, g.cor, tam);
                      const val = qtds[k] ?? 0;
                      const completo = val >= info.pendente && val > 0;
                      const parcial = val > 0 && val < info.pendente;
                      const bolaCor = completo ? "#dc2626" : parcial ? "#9ca3af" : "transparent";
                      const numCor = (completo || parcial) ? "#ffffff" : "#111827";
                      const numBg = (completo || parcial) ? bolaCor : "#f3f4f6";
                      return (
                        <td key={tam} className="px-1 py-1 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => marcarCompleto(g.modelo, g.cor, tam, info.pendente)}
                              disabled={disabled}
                              title="Marcar toda a pendência como urgente"
                              className="rounded-full w-9 h-9 flex items-center justify-center font-semibold tabular-nums text-[12px] border"
                              style={{ backgroundColor: numBg, color: numCor, borderColor: completo ? "#991b1b" : parcial ? "#6b7280" : "#d1d5db" }}
                            >
                              {val > 0 ? val : info.pendente}
                            </button>
                            {parcialEdit === k ? (
                              <div className="flex items-center gap-0.5">
                                <Input
                                  type="number"
                                  autoFocus
                                  min={0}
                                  max={info.pendente}
                                  value={parcialVal}
                                  onChange={(e) => setParcialVal(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") salvarParcial(g.modelo, g.cor, tam, info.pendente); }}
                                  className="h-6 w-14 text-center text-[11px] px-1"
                                />
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => salvarParcial(g.modelo, g.cor, tam, info.pendente)}>
                                  <Check className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => abrirParcial(g.modelo, g.cor, tam)}
                                disabled={disabled}
                                title="Quantidade parcial"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                            <div className="text-[9px] tabular-nums text-muted-foreground">{val}/{info.pendente}</div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-right tabular-nums text-[11px] text-muted-foreground">{g.pendenteTotal}</td>
                    <td className="px-1 py-1 text-center whitespace-nowrap">
                      {!linhaCompleta && (
                        <div className="flex items-center justify-center gap-1">
                          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => marcarTodosLinha(g)} disabled={disabled}>Todos</Button>
                          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => limparLinha(g)} disabled={disabled}>Limpar</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Pedidos solicitando estas peças (informativo)</label>
          {pedidosSel.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pedidosSel.map((p) => (
                <span key={p.pedidoId} className="inline-flex items-center gap-1 rounded border bg-muted/50 px-2 py-0.5 text-xs">
                  <b>{p.orcamento ?? "—"}</b>
                  {p.pedidoOlist && <span className="text-muted-foreground">Olist {p.pedidoOlist}</span>}
                  <button
                    type="button"
                    onClick={() => removerPedido(p.pedidoId)}
                    disabled={disabled}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                    title="Remover"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Select
              value=""
              onValueChange={(v) => { if (v) adicionarPedido(v); }}
              disabled={disabled || pedidosDisponiveis.length === 0}
            >
              <SelectTrigger className="h-8 w-[380px] text-xs">
                <div className="flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  <SelectValue placeholder={pedidosDisponiveis.length === 0 ? "Sem pedidos com faltas compatíveis" : "Adicionar orçamento…"} />
                </div>
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {pedidosDisponiveis.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {p.orcamento ?? "—"}
                        {p.pedido_olist && <span className="ml-2 text-muted-foreground">Olist {p.pedido_olist}</span>}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {p.faltas.slice(0, 4).map((f) => `${f.modelo}/${f.cor} ${f.tamanho}:${f.falta}`).join(" · ")}
                        {p.faltas.length > 4 ? ` +${p.faltas.length - 4}` : ""}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Observação (opcional)</label>
          <Textarea
            rows={2}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="EX.: FALEI COM A MIRTA, PROMETEU DIA 15"
            className="uppercase"
            disabled={disabled}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={disabled}>Cancelar</Button>
          <Button
            onClick={confirmar}
            disabled={!podeConfirmar}
            style={{ backgroundColor: "#dc2626", color: "#ffffff", borderColor: "#dc2626" }}
          >
            <Flame className="h-4 w-4 mr-1" />
            Registrar urgência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
