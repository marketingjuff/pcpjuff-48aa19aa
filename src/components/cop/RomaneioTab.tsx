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
import { Send, RefreshCw, FileDown, PackageOpen, Split, Check, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-role";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import {
  type Cop, type CopPeca, type CopPecaRecebida, type CopStatus, type Oficina,
  type HistoricoRecebimento,
  COP_STATUS_LIST, formatCopNumero, totalPecasCop, totalRecebidas,
  todasCompletas, proximaLetra, rotuloCop, rotuloRomaneio, numeroBaseCop, subtrairPecas,
  getRecebida, colunasTamanhos,
} from "@/lib/cop";
import { REFACAO_MODELOS, REFACAO_CORES, REFACAO_TAMANHOS } from "@/lib/pedidos";
import { useCopColorSettings } from "@/hooks/use-cop-color-settings";
import { abrirRomaneioParaImpressao } from "@/lib/romaneio-pdf";
import { EntregaRomaneioDialog } from "./EntregaRomaneioDialog";
import { ParticionarRomaneioDialog } from "./ParticionarRomaneioDialog";

const STATUS_ROMANEIO: CopStatus[] = [
  "Aguardando Oficina",
  "Aguardando Romaneio",
  "Na Oficina (Costura)",
  "Romaneio Parcial",
  "Romaneio Completo",
];

function agruparPorModeloCor(pecas: CopPeca[]): { modelo: string; cor: string; tamanhos: { tamanho: string; qtd: number }[] }[] {
  const map = new Map<string, { modelo: string; cor: string; tamanhos: { tamanho: string; qtd: number }[] }>();
  for (const p of pecas) {
    const k = `${p.modelo}|${p.cor}`;
    let g = map.get(k);
    if (!g) { g = { modelo: p.modelo, cor: p.cor, tamanhos: [] }; map.set(k, g); }
    g.tamanhos.push({ tamanho: p.tamanho, qtd: p.qtd });
  }
  return Array.from(map.values());
}

export function RomaneioTab() {
  const qc = useQueryClient();
  const { etapaStyle, btnStyle } = useCopColorSettings();
  const isAdmin = useIsAdmin();
  const [confirmVoltar, setConfirmVoltar] = useState<Cop | null>(null);

  const { data: cops = [], isLoading } = useQuery({


    queryKey: ["cops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cops" as any).select("*").order("numero", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Cop[];
    },
  });

  const { data: oficinas = [] } = useQuery({
    queryKey: ["oficinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("oficinas" as any).select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Oficina[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("cops-romaneio")
      .on("postgres_changes", { event: "*", schema: "public", table: "cops" }, () => {
        qc.invalidateQueries({ queryKey: ["cops"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<string>("__romaneio__");
  const [busca, setBusca] = useState("");
  const [showEntrega, setShowEntrega] = useState(false);
  const [showParticionar, setShowParticionar] = useState(false);

  const selected = useMemo(() => cops.find((c) => c.id === selectedId) ?? null, [cops, selectedId]);
  const oficina = useMemo(
    () => oficinas.find((o) => o.id === selected?.oficina_id) ?? null,
    [oficinas, selected],
  );

  const lista = useMemo(() => {
    return cops.filter((c) => {
      if (statusFiltro === "__romaneio__") {
        if (!STATUS_ROMANEIO.includes(c.status)) return false;
      } else if (statusFiltro !== "todos" && c.status !== statusFiltro) return false;
      if (busca) {
        const num = formatCopNumero(numeroBaseCop(c, cops));
        const rot = rotuloRomaneio(c, cops);
        if (!num.includes(busca.replace(/\D/g, "")) && !rot.toUpperCase().includes(busca.toUpperCase())) return false;
      }
      return true;
    });
  }, [cops, statusFiltro, busca]);

  // ---- Draft ----
  const [draft, setDraft] = useState<Partial<Cop>>({});
  useEffect(() => {
    if (!selected) { setDraft({}); return; }
    setDraft({
      oficina_id: selected.oficina_id,
      data_saida_oficina: selected.data_saida_oficina,
      data_recebimento: selected.data_recebimento,
      observacoes_romaneio: selected.observacoes_romaneio,
      num_fretes: selected.num_fretes ?? 1,
    });
  }, [selectedId]); // eslint-disable-line

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

  const voltarParaCorte = useMutation({
    mutationFn: async (cop: Cop) => {
      const pid = cop.cop_romaneio_pai_id ?? cop.id;
      const familia = cops.filter((c) => c.id === pid || c.cop_romaneio_pai_id === pid);
      const filhos = familia.filter((c) => c.id !== pid);
      // Se há filhos particionados, apaga-os e devolve as peças ao pai
      if (filhos.length > 0) {
        const { error: eDel } = await supabase.from("cops" as any).delete().in("id", filhos.map((c) => c.id));
        if (eDel) throw eDel;
      }
      // Pai (ou cop sem família) volta pro Corte com tudo de romaneio limpo
      const pai = cops.find((c) => c.id === pid) ?? cop;
      const pecasOriginais: CopPeca[] = filhos.length > 0
        ? (() => {
            // soma pai + filhos para reconstruir peças originais
            const acc = new Map<string, CopPeca>();
            for (const c of familia) {
              for (const p of (c.pecas || [])) {
                const k = `${p.modelo}|${p.cor}|${p.tamanho}`;
                const cur = acc.get(k);
                if (cur) cur.qtd += p.qtd; else acc.set(k, { ...p });
              }
            }
            return Array.from(acc.values());
          })()
        : (pai.pecas || []);
      const { error } = await supabase.from("cops" as any).update({
        status: "Aguardando Corte" as CopStatus,
        pecas: pecasOriginais as any,
        oficina_id: null,
        data_saida_oficina: null,
        data_recebimento: null,
        observacoes_romaneio: null,
        num_fretes: 1,
        pecas_recebidas: [] as any,
        romaneio_enviado_em: null,
        letra: null,
        cop_romaneio_pai_id: null,
        conferido_em: null,
        conferido_por: null,
        conferencia: [] as any,
        pagamento_status: "nao_pago",
        pagamento_liberado_em: null,
        pagamento_liberado_por: null,
        pagamento_pago_em: null,
        pagamento_pago_por: null,
        pagamento_valor_calculado: null,
      } as any).eq("id", pid);
      if (error) throw error;
      return pid;
    },
    onSuccess: (pid) => {
      qc.invalidateQueries({ queryKey: ["cops"] });
      setConfirmVoltar(null);
      setSelectedId(pid);
      toast.success("COP devolvido para o Corte.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao voltar para o Corte"),
  });


  function patchDraftToCop(): Partial<Cop> {
    return {
      oficina_id: draft.oficina_id ?? null,
      data_saida_oficina: draft.data_saida_oficina ?? null,
      data_recebimento: draft.data_recebimento ?? null,
      observacoes_romaneio: (draft.observacoes_romaneio ?? "")?.toString().toUpperCase() || null,
      num_fretes: Math.max(1, Math.floor(Number(draft.num_fretes) || 1)),
    };
  }

  async function handleAtualizar() {
    if (!selected) return;
    await salvar.mutateAsync({ id: selected.id, ...patchDraftToCop() });
  }

  async function handleEnviarOficina() {
    if (!selected) return;
    if (!draft.oficina_id) { toast.error("Selecione a oficina."); return; }
    if (!selected.pecas?.length) { toast.error("Romaneio sem peças."); return; }
    await salvar.mutateAsync({
      id: selected.id,
      ...patchDraftToCop(),
      status: "Na Oficina (Costura)" as CopStatus,
      romaneio_enviado_em: new Date().toISOString(),
    });
    // pop-up PDF
    const ofi = oficinas.find((o) => o.id === draft.oficina_id) ?? null;
    const next: Cop = { ...selected, ...(patchDraftToCop() as any), status: "Na Oficina (Costura)" } as Cop;
    abrirRomaneioParaImpressao(next, ofi, cops);
  }

  async function handleEntregaConfirm(rec: CopPecaRecebida[]) {
    if (!selected) return;
    const completo = todasCompletas(selected.pecas || [], rec);
    const algum = rec.some((r) => r.qtd_recebida > 0);
    const novoStatus: CopStatus =
      completo ? "Romaneio Completo" : algum ? "Romaneio Parcial" : "Na Oficina (Costura)";

    // Diff: o que mudou (recebido novo) desde o último estado salvo
    const prev = selected.pecas_recebidas ?? [];
    const novosItens: CopPecaRecebida[] = [];
    for (const r of rec) {
      const ant = prev.find((x) => x.modelo === r.modelo && x.cor === r.cor && x.tamanho === r.tamanho);
      const delta = r.qtd_recebida - (ant?.qtd_recebida ?? 0);
      if (delta > 0) novosItens.push({ ...r, qtd_recebida: delta });
    }
    const totalNovo = novosItens.reduce((s, r) => s + r.qtd_recebida, 0);
    const hist = [...(selected.historico_recebimentos ?? [])];
    if (totalNovo > 0) {
      hist.push({
        em: new Date().toISOString(),
        tipo: completo ? "completo" : "parcial",
        total: totalNovo,
        itens: novosItens,
      });
    }

    await salvar.mutateAsync({
      id: selected.id,
      pecas_recebidas: rec as any,
      status: novoStatus,
      historico_recebimentos: hist as any,
      data_recebimento: completo && !selected.data_recebimento ? new Date().toISOString().slice(0, 10) : selected.data_recebimento,
    } as any);
  }

  async function handleParticionar() {
    if (!selected) return;
    const recebidas = selected.pecas_recebidas ?? [];
    const recCount = recebidas.reduce((s, r) => s + r.qtd_recebida, 0);
    if (recCount === 0) { toast.error("Nada para particionar."); return; }
    const original_id = selected.cop_romaneio_pai_id ?? selected.id;
    // Buscar irmãos para definir letra
    const familia = cops.filter((c) => c.id === original_id || c.cop_romaneio_pai_id === original_id);
    const letrasUsadas = familia.map((c) => c.letra);
    // Garantir 'A' para o pai/origem se ainda não tem letra
    if (!letrasUsadas.includes("A")) letrasUsadas.push("A");
    const novaLetra = proximaLetra(letrasUsadas);

    // Mover as recebidas para um filho NOVO (status Romaneio Completo)
    const pecasMovidas: CopPeca[] = recebidas
      .filter((r) => r.qtd_recebida > 0)
      .map((r) => ({ modelo: r.modelo, cor: r.cor, tamanho: r.tamanho, qtd: r.qtd_recebida }));
    const pecasRestantes = subtrairPecas(selected.pecas || [], pecasMovidas);

    const agora = new Date().toISOString();
    const histFilho: HistoricoRecebimento[] = [{
      em: agora, tipo: "completo", total: recCount,
      itens: pecasMovidas.map((p) => ({ modelo: p.modelo, cor: p.cor, tamanho: p.tamanho, qtd_recebida: p.qtd })),
      letra: novaLetra,
    }];

    // Inserir filho (sem `numero` — usa o sequence; rótulo resolve via pai)
    const { data: filho, error: e1 } = await supabase.from("cops" as any).insert({
      status: "Romaneio Completo" as CopStatus,
      pecas: pecasMovidas as any,
      pecas_recebidas: pecasMovidas.map((p) => ({ modelo: p.modelo, cor: p.cor, tamanho: p.tamanho, qtd_recebida: p.qtd })) as any,
      oficina_id: selected.oficina_id,
      data_saida_oficina: selected.data_saida_oficina,
      data_recebimento: agora.slice(0, 10),
      observacoes_romaneio: selected.observacoes_romaneio,
      num_fretes: selected.num_fretes ?? 1,
      letra: novaLetra,
      cop_romaneio_pai_id: original_id,
      historico_recebimentos: histFilho as any,
    }).select().single();
    if (e1) { toast.error(e1.message); return; }

    // Atualizar pai/origem: restantes, status Parcial, zera recebimentos, letra A se faltar
    const histPai = [...(selected.historico_recebimentos ?? []), {
      em: agora, tipo: "parcial" as const, total: recCount,
      itens: pecasMovidas.map((p) => ({ modelo: p.modelo, cor: p.cor, tamanho: p.tamanho, qtd_recebida: p.qtd })),
      letra: novaLetra,
    }];
    const patchPai: any = {
      pecas: pecasRestantes as any,
      pecas_recebidas: [] as any,
      status: "Romaneio Parcial" as CopStatus,
      historico_recebimentos: histPai as any,
    };
    if (selected.id === original_id && !selected.letra) patchPai.letra = "A";
    const { error: e2 } = await supabase.from("cops" as any).update(patchPai).eq("id", selected.id);
    if (e2) { toast.error(e2.message); return; }

    qc.invalidateQueries({ queryKey: ["cops"] });
    const numeroBase = numeroBaseCop(selected, cops);
    toast.success(`Romaneio ${rotuloCop(numeroBase, novaLetra)} criado.`);
    // mantém seleção no pai (que segue parcial)
  }

  async function handleConferir() {
    if (!selected) return;
    if (selected.status !== "Romaneio Completo") return;
    const { data: ses } = await supabase.auth.getUser();
    await salvar.mutateAsync({
      id: selected.id,
      status: "Aguardando Pagamento" as CopStatus,
      conferido_em: new Date().toISOString(),
      conferido_por: ses.user?.id ?? null,
    } as any);
  }

  const familia = useMemo(() => {
    if (!selected) return [] as Cop[];
    const pid = selected.cop_romaneio_pai_id ?? selected.id;
    return cops.filter((c) => c.id === pid || c.cop_romaneio_pai_id === pid)
      .sort((a, b) => (a.letra ?? "A").localeCompare(b.letra ?? "A"));
  }, [cops, selected]);

  const recebidas = selected?.pecas_recebidas ?? [];
  const podeParticionar = !!selected
    && (selected.status === "Romaneio Parcial" || (selected.status === "Na Oficina (Costura)" && totalRecebidas(recebidas) > 0))
    && totalRecebidas(recebidas) > 0
    && totalRecebidas(recebidas) < totalPecasCop(selected.pecas);

  const original_id_atual = selected ? (selected.cop_romaneio_pai_id ?? selected.id) : null;
  const letrasFamilia = familia.map((c) => c.letra);
  if (selected && !letrasFamilia.includes("A")) letrasFamilia.push("A");
  const letraNova = proximaLetra(letrasFamilia);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ["cops"] })} title="Recarregar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Status:</Label>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="h-9 w-[260px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__romaneio__">Em Romaneio (todos os estágios)</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
                {COP_STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Buscar número/letra..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-9 w-[200px]"
          />
        </div>
        <div className="text-xs text-muted-foreground">{lista.length} registros</div>
      </div>

      {/* Editor */}
      {selected && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-4">
          {/* Lado Esquerdo — Ordem de Produção */}
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs uppercase text-muted-foreground tracking-wider">ROMANEIO · COP</div>
                  <div className="text-3xl sm:text-5xl font-bold tabular-nums">
                    {rotuloRomaneio(selected, cops)}
                    {familia.length > 1 && (
                      <span className="ml-3 text-sm font-normal text-muted-foreground">
                        (
                        {familia.map((c, idx) => (
                          <span key={c.id}>
                            {c.id === selected.id ? (
                              <span className="font-semibold">{rotuloRomaneio(c, cops)}</span>
                            ) : (
                              <button type="button" className="underline hover:text-primary" onClick={() => setSelectedId(c.id)}>
                                {rotuloRomaneio(c, cops)}
                              </button>
                            )}
                            {idx < familia.length - 1 ? " / " : ""}
                          </span>
                        ))}
                        )
                      </span>
                    )}
                  </div>
                </div>
                <span className="px-2 py-1 rounded-md text-xs font-medium border" style={etapaStyle(selected.status)}>
                  {selected.status}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Oficina (fornecedor)</Label>
                  <Select
                    value={draft.oficina_id ?? ""}
                    onValueChange={(v) => setDraft((d) => ({ ...d, oficina_id: v || null }))}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {oficinas.length === 0 && <SelectItem value="__none__" disabled>Nenhuma cadastrada</SelectItem>}
                      {oficinas.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.nome} · frete R$ {Number(o.valor_frete ?? 0).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nº de fretes</Label>
                  <Input
                    type="number"
                    min={1}
                    value={draft.num_fretes ?? 1}
                    onChange={(e) => setDraft((d) => ({ ...d, num_fretes: Math.max(1, Math.floor(Number(e.target.value) || 1)) }))}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label>Data de saída para a oficina</Label>
                  <DateInputBR value={draft.data_saida_oficina ?? ""} onChange={(v) => setDraft((d) => ({ ...d, data_saida_oficina: v }))} />
                </div>
                <div>
                  <Label>Data de recebimento</Label>
                  <DateInputBR value={draft.data_recebimento ?? ""} onChange={(v) => setDraft((d) => ({ ...d, data_recebimento: v }))} />
                </div>
              </div>

              {/* Peças (auto, read-only) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Peças do Romaneio (do Corte)</Label>
                  <div className="text-xs text-muted-foreground">
                    Total: <span className="font-semibold tabular-nums">{totalPecasCop(selected.pecas)}</span> ·
                    Recebido: <span className="font-semibold tabular-nums text-green-700"> {totalRecebidas(recebidas)}</span>
                  </div>
                </div>
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs">
                      <tr>
                        <th className="p-2 text-left">Modelo</th>
                        <th className="p-2 text-left">Cor</th>
                        <th className="p-2 text-left">Tamanhos · Qtd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agruparPorModeloCor(selected.pecas || []).map((g, i) => {
                        const hex = corHex(g.cor); const fg = corTextoSobre(hex);
                        return (
                          <tr key={i} className="border-t">
                            <td className="p-2">{g.modelo}</td>
                            <td className="p-2"><span className="inline-block px-2 py-0.5 rounded text-xs" style={{ backgroundColor: hex, color: fg }}>{g.cor}</span></td>
                            <td className="p-2">
                              <div className="flex flex-wrap gap-2">
                                {g.tamanhos.map((t) => {
                                  const r = getRecebida(recebidas, g.modelo, g.cor, t.tamanho);
                                  const completo = r >= t.qtd && t.qtd > 0;
                                  const parcial = r > 0 && r < t.qtd;
                                  const bg = completo ? "#16a34a" : parcial ? "#9ca3af" : "#f3f4f6";
                                  const cor = (completo || parcial) ? "#ffffff" : "#111827";
                                  return (
                                    <span key={t.tamanho} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                                      style={{ backgroundColor: bg, color: cor, border: "1px solid #d1d5db" }}>
                                      <span className="font-semibold">{t.tamanho}</span>
                                      <span className="tabular-nums">{t.qtd}</span>
                                      {(completo || parcial) && <span className="opacity-90">· {r}</span>}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {(!selected.pecas || selected.pecas.length === 0) && (
                        <tr><td colSpan={3} className="p-3 text-center text-muted-foreground">Sem peças.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={draft.observacoes_romaneio ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, observacoes_romaneio: e.target.value }))}
                  rows={3}
                  className="uppercase"
                />
              </div>

              {/* Botões */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  {selected.romaneio_enviado_em && (
                    <Button
                      variant="outline"
                      style={btnStyle("baixar_pdf")}
                      onClick={() => abrirRomaneioParaImpressao(selected, oficina, cops)}
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      romaneio-{formatCopNumero(selected.numero)}{selected.letra ?? ""}.pdf
                    </Button>
                  )}
                  {podeParticionar && (
                    <Button
                      style={btnStyle("particionar")}
                      onClick={() => setShowParticionar(true)}
                      title="Particionar por letra"
                    >
                      <Split className="h-4 w-4 mr-1" /> Particionar (nova letra {letraNova})
                    </Button>
                  )}
                  {isAdmin && selected.status !== "Aguardando Pagamento" && selected.status !== "Finalizado" && (
                    <Button
                      variant="outline"
                      className="border-orange-400 text-orange-700 hover:bg-orange-50"
                      onClick={() => setConfirmVoltar(selected)}
                      title="Voltar este COP para a aba Corte (apaga romaneio e filhos particionados)"
                    >
                      <Undo2 className="h-4 w-4 mr-1" /> Voltar para Corte
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button style={btnStyle("atualizar")} onClick={handleAtualizar} disabled={salvar.isPending}>
                    Salvar
                  </Button>
                  <Button
                    style={btnStyle("enviar_oficina")}
                    onClick={handleEnviarOficina}
                    disabled={salvar.isPending || (selected.status !== "Aguardando Oficina" && selected.status !== "Aguardando Romaneio")}
                    title={(selected.status !== "Aguardando Oficina" && selected.status !== "Aguardando Romaneio") ? "Romaneio já foi enviado" : "Enviar para a oficina"}
                  >
                    <Send className="h-4 w-4 mr-1" /> Enviar para Oficina
                  </Button>
                  <Button
                    style={btnStyle("entrega_romaneio")}
                    onClick={() => setShowEntrega(true)}
                    disabled={salvar.isPending
                      || (selected.status !== "Na Oficina (Costura)"
                          && selected.status !== "Romaneio Parcial"
                          && selected.status !== "Romaneio Completo")}
                  >
                    <PackageOpen className="h-4 w-4 mr-1" /> Entrega de Romaneio
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lado Direito — Conferência */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Conferência</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {selected.status === "Romaneio Completo" || selected.status === "Romaneio Parcial" || selected.conferido_em ? (
                <>
                  <div className="rounded-md border bg-muted/30 p-3">
                    {selected.status === "Romaneio Parcial"
                      ? <>Romaneio <b>parcial</b>. Confira o que já chegou e use <b>Particionar</b> para liberar a parte recebida para pagamento.</>
                      : <>Conferência liberada. Verifique se as <b>quantidades recebidas</b> batem com o que foi solicitado neste romaneio.</>}
                  </div>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="p-2 text-left">Item</th>
                          <th className="p-2 text-right">Solic.</th>
                          <th className="p-2 text-right">Recebido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selected.pecas || []).map((p, i) => {
                          const r = getRecebida(recebidas, p.modelo, p.cor, p.tamanho);
                          const ok = r === p.qtd;
                          return (
                            <tr key={i} className="border-t">
                              <td className="p-2">{p.modelo} · {p.cor} · {p.tamanho}</td>
                              <td className="p-2 text-right tabular-nums">{p.qtd}</td>
                              <td className={`p-2 text-right tabular-nums ${ok ? "text-green-700" : "text-amber-700"}`}>{r}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/30">
                          <td className="p-2 text-right"><b>Totais</b></td>
                          <td className="p-2 text-right tabular-nums"><b>{totalPecasCop(selected.pecas)}</b></td>
                          <td className="p-2 text-right tabular-nums"><b>{totalRecebidas(recebidas)}</b></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Histórico de chegadas */}
                  {(selected.historico_recebimentos?.length ?? 0) > 0 && (
                    <div className="rounded-md border p-2">
                      <div className="text-xs font-semibold mb-1">Histórico de chegadas</div>
                      <ul className="space-y-1 text-xs">
                        {selected.historico_recebimentos!.slice().reverse().map((h, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span>
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] mr-1 ${h.tipo === "completo" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                                {h.tipo}
                              </span>
                              {new Date(h.em).toLocaleString("pt-BR")}
                              {h.letra && <> · letra <b>{h.letra}</b></>}
                            </span>
                            <span className="tabular-nums font-semibold">{h.total}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selected.status === "Romaneio Completo" && (
                    selected.conferido_em ? (
                      <div className="text-xs text-green-700">
                        ✓ Conferido em {new Date(selected.conferido_em).toLocaleString("pt-BR")}.
                      </div>
                    ) : (
                      <Button style={btnStyle("conferir")} onClick={handleConferir} disabled={salvar.isPending} className="w-full">
                        <Check className="h-4 w-4 mr-1" /> Confirmar conferência
                      </Button>
                    )
                  )}
                </>
              ) : (
                <div className="rounded-md border bg-muted/20 p-3 text-muted-foreground">
                  A conferência é liberada quando o romaneio começar a receber peças.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Busca de peças */}
      <BuscaPecasBlock cops={cops} onSelect={setSelectedId} />


      {/* Lista */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Romaneios</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : lista.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum romaneio no filtro atual.</div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="p-2 text-left">Romaneio</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Oficina</th>
                    <th className="p-2 text-center">Peças</th>
                    <th className="p-2 text-center">Recebido</th>
                    <th className="p-2 text-left">Saída</th>
                    <th className="p-2 text-left">Recebimento</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => {
                    const ofi = oficinas.find((o) => o.id === c.oficina_id);
                    return (
                      <tr key={c.id}
                        className={`border-t cursor-pointer hover:bg-accent/40 ${c.id === selectedId ? "bg-accent/50" : ""}`}
                        onClick={() => setSelectedId(c.id)}
                      >
                        <td className="p-2 font-semibold tabular-nums">{rotuloRomaneio(c, cops)}</td>
                        <td className="p-2">
                          <span className="px-2 py-0.5 rounded text-xs border" style={etapaStyle(c.status)}>{c.status}</span>
                        </td>
                        <td className="p-2">{ofi?.nome ?? "—"}</td>
                        <td className="p-2 text-center tabular-nums">{totalPecasCop(c.pecas)}</td>
                        <td className="p-2 text-center tabular-nums">{totalRecebidas(c.pecas_recebidas)}</td>
                        <td className="p-2">{c.data_saida_oficina ?? "—"}</td>
                        <td className="p-2">{c.data_recebimento ?? "—"}</td>
                        <td className="p-2 text-right">
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedId(c.id); }}>
                            Abrir
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <>
          <EntregaRomaneioDialog
            open={showEntrega}
            onOpenChange={setShowEntrega}
            pecas={selected.pecas || []}
            recebidas={recebidas}
            onConfirm={handleEntregaConfirm}
          />
          <ParticionarRomaneioDialog
            open={showParticionar}
            onOpenChange={setShowParticionar}
            letraAtual={selected.letra}
            letraNova={letraNova}
            recebidas={recebidas}
            rotuloAtual={rotuloRomaneio({ ...selected, letra: selected.letra ?? (selected.id === original_id_atual ? "A" : null) } as any, cops)}
            rotuloNovo={rotuloCop(numeroBaseCop(selected, cops), letraNova)}
            onConfirm={handleParticionar}
          />
        </>
      )}

      <AlertDialog open={!!confirmVoltar} onOpenChange={(o) => !o && setConfirmVoltar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Voltar COP {confirmVoltar ? formatCopNumero(confirmVoltar.numero) : ""} para o Corte?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apaga todos os dados de romaneio (oficina, datas, recebimentos, conferência e pagamento) e devolve o COP para a aba Corte com status "Aguardando Corte". Se houver romaneios particionados (letras), eles serão apagados e as peças retornam ao COP original. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voltarParaCorte.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              disabled={voltarParaCorte.isPending}
              onClick={(e) => { e.preventDefault(); if (confirmVoltar) voltarParaCorte.mutate(confirmVoltar); }}
            >
              {voltarParaCorte.isPending ? "Voltando..." : "Voltar para Corte"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}

function BuscaPecasBlock({ cops, onSelect }: { cops: Cop[]; onSelect: (id: string) => void }) {
  const [modelo, setModelo] = useState<string>("");
  const [cor, setCor] = useState<string>("");
  const [tamanho, setTamanho] = useState<string>("");

  const aplicado = !!(modelo || cor || tamanho);

  const resultados = useMemo(() => {
    if (!aplicado) return [] as { cop: Cop; qtd: number; rotulo: string }[];
    const out: { cop: Cop; qtd: number; rotulo: string }[] = [];
    for (const c of cops) {
      const qtd = (c.pecas || []).reduce((s, p) => {
        if (modelo && p.modelo !== modelo) return s;
        if (cor && p.cor !== cor) return s;
        if (tamanho && p.tamanho !== tamanho) return s;
        return s + (Number(p.qtd) || 0);
      }, 0);
      if (qtd > 0) out.push({ cop: c, qtd, rotulo: rotuloRomaneio(c, cops) });
    }
    return out.sort((a, b) => a.rotulo.localeCompare(b.rotulo));
  }, [cops, modelo, cor, tamanho, aplicado]);

  const totalGeral = resultados.reduce((s, r) => s + r.qtd, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Busca de peças nos Romaneios</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div>
            <Label className="text-xs">Modelo</Label>
            <Select value={modelo || "__all__"} onValueChange={(v) => setModelo(v === "__all__" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {REFACAO_MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cor</Label>
            <Select value={cor || "__all__"} onValueChange={(v) => setCor(v === "__all__" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {REFACAO_CORES.map((c) => <SelectItem key={c.nome} value={c.nome}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tamanho</Label>
            <Select value={tamanho || "__all__"} onValueChange={(v) => setTamanho(v === "__all__" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {REFACAO_TAMANHOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="h-9 w-full" onClick={() => { setModelo(""); setCor(""); setTamanho(""); }}>
              Limpar
            </Button>
          </div>
        </div>

        {!aplicado ? (
          <div className="text-xs text-muted-foreground">Selecione ao menos um filtro para listar os romaneios em que a peça aparece.</div>
        ) : resultados.length === 0 ? (
          <div className="text-xs text-muted-foreground">Nenhum romaneio com essa combinação.</div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="p-2 text-left">Romaneio</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r) => (
                  <tr key={r.cop.id} className="border-t">
                    <td className="p-2 font-semibold tabular-nums">{r.rotulo}</td>
                    <td className="p-2">{r.cop.status}</td>
                    <td className="p-2 text-right tabular-nums">{r.qtd}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => onSelect(r.cop.id)}>Abrir</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30">
                  <td className="p-2" colSpan={2}><b>Total</b></td>
                  <td className="p-2 text-right tabular-nums"><b>{totalGeral}</b></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

