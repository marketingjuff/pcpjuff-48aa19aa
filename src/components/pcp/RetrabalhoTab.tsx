import { useMemo, useState } from "react";
import type { Pedido, RefacaoEpisodio } from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight, Trash2, Save } from "lucide-react";

interface Props {
  pedidos: Pedido[];
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
}

function sumPedidoTotal(p: Pedido): number {
  return Number(p.qtd ?? 0) || 0;
}

export function RetrabalhoTab({ pedidos, onSave }: Props) {
  const [busca, setBusca] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const pedidosComRefacao = useMemo(
    () =>
      pedidos.filter((p) => Array.isArray(p.refacoes) && p.refacoes.length > 0),
    [pedidos],
  );

  const filtrados = useMemo(() => {
    if (!busca) return pedidosComRefacao;
    const q = busca.toLowerCase();
    return pedidosComRefacao.filter(
      (p) =>
        String(p.pedido_olist ?? "").toLowerCase().includes(q) ||
        String(p.orcamento ?? "").toLowerCase().includes(q),
    );
  }, [pedidosComRefacao, busca]);

  const stats = useMemo(() => {
    let totalRefeitas = 0;
    let totalPerdaPecas = 0;
    let totalPerdaAdesivos = 0;
    let totalProduzidas = 0;
    const porEtapa: Record<string, number> = {};
    pedidos.forEach((p) => {
      totalProduzidas += sumPedidoTotal(p);
      (p.refacoes ?? []).forEach((e) => {
        totalRefeitas += Number(e.pecas_refazer ?? 0);
        totalPerdaPecas += Number(e.perda_pecas ?? 0);
        totalPerdaAdesivos += Number(e.perda_adesivos ?? 0);
        const k = e.etapa_origem || "—";
        porEtapa[k] = (porEtapa[k] ?? 0) + Number(e.perda_pecas ?? 0) + Number(e.perda_adesivos ?? 0);
      });
    });
    const pct = totalProduzidas > 0 ? (totalRefeitas / totalProduzidas) * 100 : 0;
    let etapaTop = "—";
    let maxV = 0;
    Object.entries(porEtapa).forEach(([k, v]) => {
      if (v > maxV) { maxV = v; etapaTop = k; }
    });
    return { totalRefeitas, totalPerdaPecas, totalPerdaAdesivos, pct, etapaTop };
  }, [pedidos]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function updateEpisodio(pedido: Pedido, idx: number, patch: Partial<RefacaoEpisodio>) {
    const refs: RefacaoEpisodio[] = [...((pedido.refacoes ?? []) as RefacaoEpisodio[])];
    refs[idx] = { ...refs[idx], ...patch };
    onSave({ id: pedido.id, refacoes: refs } as any);
  }

  function deleteEpisodio(pedido: Pedido, idx: number) {
    if (!confirm("Apagar este episódio de refação? Essa ação reduz a contagem de asteriscos do pedido.")) return;
    const refs = (pedido.refacoes ?? []).filter((_, i) => i !== idx);
    onSave({ id: pedido.id, refacoes: refs } as any);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Peças refeitas" value={stats.totalRefeitas} />
        <StatCard label="Peças perdidas" value={stats.totalPerdaPecas} />
        <StatCard label="Adesivos perdidos" value={stats.totalPerdaAdesivos} />
        <StatCard label="% Retrabalho" value={`${stats.pct.toFixed(1)}%`} />
        <StatCard label="Etapa que mais gera perda" value={stats.etapaTop} />
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Pedidos com refação</CardTitle>
          <Input
            placeholder="Buscar pedido ou orçamento"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-xs h-8"
          />
        </CardHeader>
        <CardContent className="space-y-2">
          {filtrados.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhum pedido com refação.
            </div>
          ) : (
            filtrados.map((p) => {
              const refs = p.refacoes ?? [];
              const isOpen = expanded.has(p.id);
              const totalRefeitasPed = refs.reduce((a, e) => a + Number(e.pecas_refazer ?? 0), 0);
              return (
                <div key={p.id} className="rounded-md border">
                  <button
                    type="button"
                    onClick={() => toggleExpand(p.id)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-accent text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="font-medium">{p.pedido_olist ?? "—"}</span>
                      <span className="text-xs text-muted-foreground truncate">{p.orcamento ?? ""}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{refs.length} episódio{refs.length === 1 ? "" : "s"}</Badge>
                      <Badge variant="outline">{totalRefeitasPed} pç refeitas</Badge>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t p-3 space-y-3">
                      {refs.map((e, idx) => (
                        <EpisodioRow
                          key={idx}
                          episodio={e}
                          onUpdate={(patch) => updateEpisodio(p, idx, patch)}
                          onDelete={() => deleteEpisodio(p, idx)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function EpisodioRow({
  episodio,
  onUpdate,
  onDelete,
}: {
  episodio: RefacaoEpisodio;
  onUpdate: (patch: Partial<RefacaoEpisodio>) => void;
  onDelete: () => void;
}) {
  const [local, setLocal] = useState<RefacaoEpisodio>(episodio);
  const dirty = JSON.stringify(local) !== JSON.stringify(episodio);
  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
        <Field label="Etapa origem">
          <Input value={local.etapa_origem} onChange={(e) => setLocal({ ...local, etapa_origem: e.target.value })} />
        </Field>
        <Field label="Etapa destino">
          <Input value={local.etapa_destino} onChange={(e) => setLocal({ ...local, etapa_destino: e.target.value as any })} />
        </Field>
        <Field label="Data">
          <Input value={local.data} onChange={(e) => setLocal({ ...local, data: e.target.value })} />
        </Field>
        <Field label="Quem (uuid)">
          <Input value={local.quem ?? ""} onChange={(e) => setLocal({ ...local, quem: e.target.value || null })} />
        </Field>
        <Field label="Peças refazer">
          <Input type="number" value={local.pecas_refazer} onChange={(e) => setLocal({ ...local, pecas_refazer: Number(e.target.value) })} />
        </Field>
        <Field label="Perda peças">
          <Input type="number" value={local.perda_pecas} onChange={(e) => setLocal({ ...local, perda_pecas: Number(e.target.value) })} />
        </Field>
        <Field label="Perda adesivos">
          <Input type="number" value={local.perda_adesivos} onChange={(e) => setLocal({ ...local, perda_adesivos: Number(e.target.value) })} />
        </Field>
        <Field label="Aberto">
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={local.aberto ? "sim" : "nao"}
            onChange={(e) => setLocal({ ...local, aberto: e.target.value === "sim" })}
          >
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </Field>
      </div>
      <Field label="Motivo">
        <Textarea rows={2} value={local.motivo} onChange={(e) => setLocal({ ...local, motivo: e.target.value })} />
      </Field>
      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-1" /> Apagar episódio
        </Button>
        <Button size="sm" disabled={!dirty} onClick={() => onUpdate(local)}>
          <Save className="h-4 w-4 mr-1" /> Salvar episódio
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-muted-foreground font-medium">{label}</div>
      {children}
    </div>
  );
}
