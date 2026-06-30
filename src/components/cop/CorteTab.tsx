import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInputBR } from "@/components/ui/date-input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, X, Scissors, Send, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { REFACAO_MODELOS, REFACAO_CORES, REFACAO_TAMANHOS } from "@/lib/pedidos";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import {
  type Cop, type CopPeca, type CopStatus,
  COP_STATUS_LIST, STATUS_CORTE, formatCopNumero, totalPecasCop, subtrairPecas,
  calcularStatusCorte, getRecebida,
} from "@/lib/cop";
import { useCopColorSettings } from "@/hooks/use-cop-color-settings";
import { DivisaoCorteDialog } from "./DivisaoCorteDialog";
import { useIsAdmin } from "@/hooks/use-role";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type LinhaGrupo = {
  modelo: string;
  cor: string;
  qtd: Record<string, number>; // por tamanho
};

function agrupar(pecas: CopPeca[]): LinhaGrupo[] {
  const map = new Map<string, LinhaGrupo>();
  for (const p of pecas ?? []) {
    const k = `${p.modelo}|${p.cor}`;
    let g = map.get(k);
    if (!g) { g = { modelo: p.modelo, cor: p.cor, qtd: {} }; map.set(k, g); }
    const t = p.tamanho || "—";
    g.qtd[t] = (g.qtd[t] || 0) + (Number(p.qtd) || 0);
  }
  return Array.from(map.values());
}

function desagrupar(grupos: LinhaGrupo[]): CopPeca[] {
  const out: CopPeca[] = [];
  for (const g of grupos) {
    if (!g.modelo || !g.cor) continue;
    for (const t of REFACAO_TAMANHOS) {
      const q = Number(g.qtd[t]) || 0;
      if (q > 0) out.push({ modelo: g.modelo, cor: g.cor, tamanho: t, qtd: q });
    }
  }
  return out;
}

export function CorteTab({ selectedId = null, onSelect, onChangeTab }: { selectedId?: string | null; onSelect?: (id: string | null) => void; onChangeTab?: (t: string) => void } = {}) {
  const setSelectedId = (id: string | null) => onSelect?.(id);
  const qc = useQueryClient();
  const { etapaStyle, btnStyle } = useCopColorSettings();
  const isAdmin = useIsAdmin();
  const [confirmDelete, setConfirmDelete] = useState<Cop | null>(null);

  const { data: cops = [], isLoading } = useQuery({
    queryKey: ["cops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cops" as any).select("*").order("numero", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Cop[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("cops-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "cops" }, () => {
        qc.invalidateQueries({ queryKey: ["cops"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  
  const [statusFiltro, setStatusFiltro] = useState<string>("__ativos__");
  const [busca, setBusca] = useState("");
  const [showDivisao, setShowDivisao] = useState(false);

  const selected = useMemo(() => cops.find((c) => c.id === selectedId) ?? null, [cops, selectedId]);

  // Lista filtrada (por padrão, todos os COPs ATIVOS — exceto Finalizado/Pago)
  const lista = useMemo(() => {
    return cops.filter((c) => {
      if (statusFiltro === "__ativos__") {
        if (c.status === "Finalizado" || c.pagamento_status === "pago") return false;
      } else if (statusFiltro !== "todos" && c.status !== statusFiltro) return false;
      if (busca && !formatCopNumero(c.numero).includes(busca.replace(/\D/g, ""))) return false;
      return true;
    });
  }, [cops, statusFiltro, busca]);

  // Form draft espelha o COP selecionado
  const [draft, setDraft] = useState<Partial<Cop>>({});
  const [grupos, setGrupos] = useState<LinhaGrupo[]>([]);

  useEffect(() => {
    if (!selected) { setDraft({}); setGrupos([]); return; }
    setDraft({
      solicitacao_risco: selected.solicitacao_risco,
      execucao_risco: selected.execucao_risco,
      solicitacao_corte: selected.solicitacao_corte,
      execucao_corte: selected.execucao_corte,
      observacoes_corte: selected.observacoes_corte,
    });
    setGrupos(agrupar(selected.pecas || []));
  }, [selectedId]); // eslint-disable-line

  // ===== Mutations =====
  const criar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("cops" as any)
        .insert({ status: "Aguardando Risco", pecas: [] })
        .select().single();
      if (error) throw error;
      return data as unknown as Cop;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["cops"] });
      setSelectedId(c.id);
      toast.success(`COP ${formatCopNumero(c.numero)} criado.`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar COP"),
  });

  const salvar = useMutation({
    mutationFn: async (patch: Partial<Cop> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("cops" as any).update(rest as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cops"] });
      toast.success("Salvo.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cops" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cops"] });
      setSelectedId(null);
      setConfirmDelete(null);
      toast.success("COP excluído.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir COP"),
  });

  const emCorrecao = !!selected?.corte_em_correcao;
  const bloqueado = !!selected && !STATUS_CORTE.includes(selected.status) && !emCorrecao;

  /** Quantidades já recebidas por linha (apenas no modo correção). */
  function qtdRecebidaDe(modelo: string, cor: string, tamanho: string): number {
    if (!selected) return 0;
    return getRecebida(selected.pecas_recebidas ?? [], modelo, cor, tamanho);
  }

  /** Valida que nenhuma linha foi reduzida abaixo do já recebido. */
  function validarPecasContraRecebidas(pecas: CopPeca[]): string | null {
    if (!emCorrecao || !selected) return null;
    for (const r of (selected.pecas_recebidas ?? [])) {
      const linha = pecas.find((p) => p.modelo === r.modelo && p.cor === r.cor && p.tamanho === r.tamanho);
      const novo = linha?.qtd ?? 0;
      if (novo < r.qtd_recebida) {
        return `Não é possível reduzir ${r.modelo}·${r.cor}·${r.tamanho} para ${novo} (já recebido: ${r.qtd_recebida}).`;
      }
    }
    return null;
  }

  async function handleAtualizar() {
    if (!selected) return;
    if (bloqueado) { toast.error("Este COP já saiu para o Romaneio. Use 'Corrigir corte' na aba Romaneio."); return; }
    const pecas = desagrupar(grupos);
    const erro = validarPecasContraRecebidas(pecas);
    if (erro) { toast.error(erro); return; }
    if (emCorrecao) {
      // Mantém status; só ajusta peças e observações.
      await salvar.mutateAsync({
        id: selected.id,
        observacoes_corte: (draft.observacoes_corte ?? "")?.toString().toUpperCase() || null,
        pecas,
      });
      return;
    }
    const datas = {
      solicitacao_risco: draft.solicitacao_risco ?? null,
      execucao_risco: draft.execucao_risco ?? null,
      solicitacao_corte: draft.solicitacao_corte ?? null,
      execucao_corte: draft.execucao_corte ?? null,
    };
    const novoStatus = calcularStatusCorte(datas);
    await salvar.mutateAsync({
      id: selected.id,
      ...datas,
      observacoes_corte: (draft.observacoes_corte ?? "")?.toString().toUpperCase() || null,
      pecas,
      status: novoStatus,
    });
  }

  async function handleVoltarRomaneio() {
    if (!selected || !emCorrecao) return;
    const pecas = desagrupar(grupos);
    const erro = validarPecasContraRecebidas(pecas);
    if (erro) { toast.error(erro); return; }
    await salvar.mutateAsync({
      id: selected.id,
      observacoes_corte: (draft.observacoes_corte ?? "")?.toString().toUpperCase() || null,
      pecas,
      corte_em_correcao: false as any,
    });
    toast.success("COP devolvido ao Romaneio.");
    onChangeTab?.("romaneio");
  }

  async function handleMandarRomaneio() {
    if (!selected) return;
    const pecas = desagrupar(grupos);
    if (pecas.length === 0) { toast.error("Adicione ao menos uma peça."); return; }
    await salvar.mutateAsync({
      id: selected.id,
      solicitacao_risco: draft.solicitacao_risco ?? null,
      execucao_risco: draft.execucao_risco ?? null,
      solicitacao_corte: draft.solicitacao_corte ?? null,
      execucao_corte: draft.execucao_corte ?? null,
      observacoes_corte: (draft.observacoes_corte ?? "")?.toString().toUpperCase() || null,
      pecas,
      status: "Aguardando Oficina" as CopStatus,
    });
  }

  async function handleDivisao(movidas: CopPeca[]) {
    if (!selected) return;
    const restante = subtrairPecas(selected.pecas || [], movidas);
    // Cria filho
    const { data: filho, error: e1 } = await supabase.from("cops" as any).insert({
      status: "Aguardando Risco",
      pecas: movidas as any,
      cop_pai_id: selected.id,
    }).select().single();
    if (e1) { toast.error(e1.message); return; }
    // Atualiza pai
    const { error: e2 } = await supabase.from("cops" as any).update({
      pecas: restante as any,
      corte_dividido: true,
    }).eq("id", selected.id);
    if (e2) { toast.error(e2.message); return; }
    qc.invalidateQueries({ queryKey: ["cops"] });
    toast.success(`COP filho ${formatCopNumero((filho as any).numero)} criado.`);
  }

  // Par de irmãos (para enunciado "0001 (0001/0047)")
  const par = useMemo(() => {
    if (!selected) return null;
    const paiId = selected.cop_pai_id ?? selected.id;
    const irmaos = cops.filter((c) => c.id === paiId || c.cop_pai_id === paiId)
      .sort((a, b) => a.numero - b.numero);
    if (irmaos.length < 2) return null;
    return irmaos;
  }, [cops, selected]);

  const ehFilho = !!selected?.cop_pai_id;
  const podeDividir = !!selected && !selected.corte_dividido && !ehFilho;

  // ===== Edit grid helpers =====
  function addLinha() {
    setGrupos((g) => [...g, { modelo: "", cor: "", qtd: {} }]);
  }
  function removeLinha(i: number) {
    setGrupos((g) => g.filter((_, idx) => idx !== i));
  }
  function setLinha(i: number, patch: Partial<LinhaGrupo>) {
    setGrupos((g) => g.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function setQtd(i: number, t: string, v: number) {
    setGrupos((g) => g.map((l, idx) => idx === i ? { ...l, qtd: { ...l.qtd, [t]: Math.max(0, Math.floor(Number(v) || 0)) } } : l));
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Novo COP
          </Button>
          <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ["cops"] })} title="Recarregar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Status:</Label>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="h-9 w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__ativos__">Ativos (exceto Finalizados/Pagos)</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
                {COP_STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Buscar número..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-9 w-[180px]"
          />
        </div>
        <div className="text-xs text-muted-foreground">{lista.length} registros</div>
      </div>

      {/* Editor do selecionado */}
      {selected && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase text-muted-foreground tracking-wider">COP</div>
                <div className="text-3xl sm:text-5xl font-bold tabular-nums">
                  {formatCopNumero(selected.numero)}
                  {par && (
                    <span className="ml-3 text-sm font-normal text-muted-foreground">
                      (
                      {par.map((c, idx) => (
                        <span key={c.id}>
                          {c.id === selected.id ? (
                            <span className="font-semibold">{formatCopNumero(c.numero)}</span>
                          ) : (
                            <button
                              type="button"
                              className="underline hover:text-primary"
                              onClick={() => setSelectedId(c.id)}
                            >
                              {formatCopNumero(c.numero)}
                            </button>
                          )}
                          {idx < par.length - 1 ? "/" : ""}
                        </span>
                      ))}
                      )
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-1 rounded-md text-xs font-medium border"
                  style={etapaStyle(selected.status)}
                >
                  {selected.status}
                </span>
                {ehFilho && (
                  <span className="text-xs text-muted-foreground">(COP filho de divisão)</span>
                )}
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setConfirmDelete(selected)}
                    title="Excluir COP (apaga também o romaneio)"
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir COP
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {emCorrecao && (
              <div className="rounded-md border border-orange-300 bg-orange-50 p-3 text-xs text-orange-900">
                <b>Correção de corte ativa.</b> As datas e o status estão preservados. Você pode ajustar as peças (acrescentar ou diminuir), respeitando o que já foi recebido no romaneio. Ao terminar, clique em <b>"Voltar para o Romaneio"</b>.
              </div>
            )}
            {bloqueado && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                Este COP já saiu para o Romaneio (status <b>{selected.status}</b>). A edição do Corte está bloqueada.
                Para reabrir, use o botão <b>"Corrigir corte"</b> na aba Romaneio.
              </div>
            )}
            <fieldset disabled={bloqueado} className="contents">
            {/* Datas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Solicitação do Risco</Label>
                <DateInputBR value={draft.solicitacao_risco ?? ""} onChange={(v) => setDraft((d) => ({ ...d, solicitacao_risco: v }))} disabled={bloqueado || emCorrecao} />
              </div>
              <div>
                <Label>Execução do Risco</Label>
                <DateInputBR value={draft.execucao_risco ?? ""} onChange={(v) => setDraft((d) => ({ ...d, execucao_risco: v }))} disabled={bloqueado || emCorrecao} />
              </div>
              <div>
                <Label>Solicitação do Corte</Label>
                <DateInputBR value={draft.solicitacao_corte ?? ""} onChange={(v) => setDraft((d) => ({ ...d, solicitacao_corte: v }))} disabled={bloqueado || emCorrecao} />
              </div>
              <div>
                <Label>Execução do Corte</Label>
                <DateInputBR value={draft.execucao_corte ?? ""} onChange={(v) => setDraft((d) => ({ ...d, execucao_corte: v }))} disabled={bloqueado || emCorrecao} />
              </div>
            </div>

            {/* Peças */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Descrição dos produtos</Label>
                <div className="text-xs text-muted-foreground">
                  Total: <span className="font-semibold tabular-nums">{grupos.reduce((s, g) => s + Object.values(g.qtd).reduce((a, b) => a + (Number(b) || 0), 0), 0)}</span> peças
                </div>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs">
                    <tr>
                      <th className="p-2 text-left w-[90px] min-w-[90px]">Modelo</th>
                      <th className="p-2 text-left w-[70px] min-w-[70px]">Cor</th>
                      {REFACAO_TAMANHOS.map((t) => (
                        <th key={t} className="p-2 text-center w-[72px] min-w-[72px]">{t}</th>
                      ))}
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.length === 0 ? (
                      <tr><td colSpan={REFACAO_TAMANHOS.length + 3} className="p-3 text-center text-muted-foreground">Nenhuma linha. Clique em "Adicionar linha".</td></tr>
                    ) : grupos.map((g, i) => {
                      const hex = g.cor ? corHex(g.cor) : "#cccccc";
                      const fg = corTextoSobre(hex);
                      return (
                        <tr key={i} className="border-t">
                          <td className="p-1.5">
                            <Select value={g.modelo} onValueChange={(v) => setLinha(i, { modelo: v })} disabled={bloqueado}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                              <SelectContent>
                                {REFACAO_MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-1.5">
                            <Select value={g.cor} onValueChange={(v) => setLinha(i, { cor: v })} disabled={bloqueado}>
                              <SelectTrigger className="h-8" style={g.cor ? { backgroundColor: hex, color: fg } : undefined}>
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {REFACAO_CORES.map((c) => {
                                  const f = corTextoSobre(c.hex);
                                  return (
                                    <SelectItem key={c.nome} value={c.nome} style={{ backgroundColor: c.hex, color: f }}>
                                      {c.nome}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </td>
                          {REFACAO_TAMANHOS.map((t) => {
                            const rec = emCorrecao && g.modelo && g.cor ? qtdRecebidaDe(g.modelo, g.cor, t) : 0;
                            const v = g.qtd[t] ?? 0;
                            const erroLinha = emCorrecao && rec > 0 && v < rec;
                            return (
                              <td key={t} className="p-1.5 text-center w-[72px] min-w-[72px]">
                                <Input
                                  type="number"
                                  min={emCorrecao ? rec : 0}
                                  className={"h-8 text-center px-1 tabular-nums w-full " + (erroLinha ? "border-destructive text-destructive" : "")}
                                  value={g.qtd[t] ?? ""}
                                  onChange={(e) => setQtd(i, t, Number(e.target.value))}
                                  disabled={bloqueado}
                                  title={rec > 0 ? `Já recebido: ${rec}` : undefined}
                                />
                                {rec > 0 && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5">≥{rec}</div>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-1.5">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLinha(i)} title="Remover linha" disabled={bloqueado}>
                              <X className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addLinha} disabled={bloqueado}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar linha
              </Button>
            </div>

            {/* Observações */}
            <div>
              <Label>Observações do Corte</Label>
              <Textarea
                value={draft.observacoes_corte ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, observacoes_corte: e.target.value }))}
                rows={3}
                className="uppercase"
                disabled={bloqueado}
              />
            </div>
            </fieldset>

            {/* Botões */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <Button
                variant="outline"
                style={btnStyle("dividir_corte")}
                onClick={() => setShowDivisao(true)}
                disabled={!podeDividir || bloqueado}
                title={!podeDividir ? (ehFilho ? "COP filho não pode ser dividido" : "Este COP já foi dividido") : "Dividir corte"}
              >
                <Scissors className="h-4 w-4 mr-1" /> Divisão de Corte
              </Button>
              <div className="flex items-center gap-2">
                <Button style={btnStyle("atualizar")} onClick={handleAtualizar} disabled={salvar.isPending || bloqueado}>
                  Salvar
                </Button>
                <Button
                  style={btnStyle("mandar_romaneio")}
                  onClick={handleMandarRomaneio}
                  disabled={salvar.isPending || selected.status !== "Aguardando Romaneio"}
                  title={selected.status !== "Aguardando Romaneio" ? "Preencha as 4 datas (até Execução do Corte) e salve." : "Enviar para Romaneio"}
                >
                  <Send className="h-4 w-4 mr-1" /> Mandar pro Romaneio
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">COPs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : lista.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum COP no filtro atual.</div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="p-2 text-left">Número</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-center">Peças</th>
                    <th className="p-2 text-left">Solic. Risco</th>
                    <th className="p-2 text-left">Exec. Corte</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => (
                    <tr
                      key={c.id}
                      className={`border-t cursor-pointer hover:bg-accent/40 ${c.id === selectedId ? "bg-accent/50" : ""}`}
                      onClick={() => setSelectedId(c.id)}
                    >
                      <td className="p-2 font-semibold tabular-nums">
                        {formatCopNumero(c.numero)}
                        {c.cop_pai_id && <span className="ml-1 text-[10px] text-muted-foreground">(filho)</span>}
                      </td>
                      <td className="p-2">
                        <span className="px-2 py-0.5 rounded text-xs border" style={etapaStyle(c.status)}>{c.status}</span>
                      </td>
                      <td className="p-2 text-center tabular-nums">{totalPecasCop(c.pecas)}</td>
                      <td className="p-2">{c.solicitacao_risco ?? "—"}</td>
                      <td className="p-2">{c.execucao_corte ?? "—"}</td>
                      <td className="p-2 text-right">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedId(c.id); }}>
                          Abrir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <DivisaoCorteDialog
          open={showDivisao}
          onOpenChange={setShowDivisao}
          pecas={selected.pecas || []}
          onConfirm={handleDivisao}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir COP {confirmDelete ? formatCopNumero(confirmDelete.numero) : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação <b>não pode ser desfeita</b>. O COP será removido permanentemente,
              junto com todos os dados de risco, corte e <b>romaneio</b> vinculados a ele.
              {confirmDelete?.corte_dividido && (
                <span className="block mt-2 text-amber-700">
                  Atenção: este COP foi dividido. Os COPs filhos continuarão existindo independentemente.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluir.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={excluir.isPending}
              onClick={(e) => { e.preventDefault(); if (confirmDelete) excluir.mutate(confirmDelete.id); }}
            >
              {excluir.isPending ? "Excluindo..." : "Excluir definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
