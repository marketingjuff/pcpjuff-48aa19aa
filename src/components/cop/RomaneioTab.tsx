import React, { useEffect, useMemo, useRef, useState } from "react";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Send, RefreshCw, FileDown, PackageOpen, Split, Check, Undo2, AlertTriangle, ArrowUp, ArrowDown, Flame } from "lucide-react";
import { toast } from "sonner";
import { useCanAccessCop } from "@/hooks/use-role";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import {
  type Cop, type CopPeca, type CopPecaRecebida, type CopStatus, type Oficina,
  type HistoricoRecebimento, type HistoricoPerda, type CopPerdaLinha, type CopUrgencia, type CopUrgenciaLinha,
  COP_STATUS_LIST, STATUS_CORTE, formatCopNumero, totalPecasCop, totalRecebidas,
  todasCompletas, proximaLetra, rotuloCop, rotuloRomaneio, numeroBaseCop, subtrairPecas,
  getRecebida, getPerda, colunasTamanhos, mesclarPerdasEmObservacoes, linhaUrgente,
} from "@/lib/cop";
import { REFACAO_MODELOS, REFACAO_CORES, REFACAO_TAMANHOS } from "@/lib/pedidos";
import { useCopColorSettings } from "@/hooks/use-cop-color-settings";
import { abrirRomaneioParaImpressao } from "@/lib/romaneio-pdf";
import { EntregaRomaneioDialog } from "./EntregaRomaneioDialog";
import { ParticionarRomaneioDialog } from "./ParticionarRomaneioDialog";
import { RegistrarPerdaDialog } from "./RegistrarPerdaDialog";
import { PedirUrgenciaDialog } from "./PedirUrgenciaDialog";
import { cargaPorOficina } from "@/lib/cop-oficinas";

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

export function RomaneioTab({ selectedId = null, onSelect, onChangeTab }: { selectedId?: string | null; onSelect?: (id: string | null) => void; onChangeTab?: (t: string) => void } = {}) {
  const setSelectedId = (id: string | null) => onSelect?.(id);
  const qc = useQueryClient();
  const { etapaStyle, btnStyle } = useCopColorSettings();
  const canManageCop = useCanAccessCop();
  const [showPerda, setShowPerda] = useState(false);
  const [showUrgencia, setShowUrgencia] = useState(false);

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

  
  const [statusFiltro, setStatusFiltro] = useState<string>("__ativos__");
  const [oficinaFiltro, setOficinaFiltro] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [showEntrega, setShowEntrega] = useState(false);
  const [showParticionar, setShowParticionar] = useState(false);
  const [selectedHist, setSelectedHist] = useState<HistoricoRecebimento | HistoricoPerda | null>(null);
  const [sortKey, setSortKey] = useState<"numero" | "status" | "oficina" | "recebimento">("numero");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const editorRef = useRef<HTMLDivElement | null>(null);
  const selectAndScroll = (id: string | null) => {
    setSelectedId(id);
    if (id) requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const selected = useMemo(() => cops.find((c) => c.id === selectedId) ?? null, [cops, selectedId]);
  const oficina = useMemo(
    () => oficinas.find((o) => o.id === selected?.oficina_id) ?? null,
    [oficinas, selected],
  );

  const listaFiltrada = useMemo(() => {
    return cops.filter((c) => {
      if (statusFiltro === "__ativos__") {
        if (c.status === "Finalizado" || c.pagamento_status === "pago") return false;
      } else if (statusFiltro !== "todos" && c.status !== statusFiltro) return false;
      if (oficinaFiltro !== "todas") {
        if (oficinaFiltro === "__sem__") {
          if (c.oficina_id) return false;
        } else if (c.oficina_id !== oficinaFiltro) return false;
      }
      if (busca) {
        const num = formatCopNumero(numeroBaseCop(c, cops));
        const rot = rotuloRomaneio(c, cops);
        if (!num.includes(busca.replace(/\D/g, "")) && !rot.toUpperCase().includes(busca.toUpperCase())) return false;
      }
      return true;
    });
  }, [cops, statusFiltro, oficinaFiltro, busca]);

  const oficinaNomeById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of oficinas) m.set(o.id, o.nome);
    return m;
  }, [oficinas]);

  const lista = useMemo(() => {
    const arr = [...listaFiltrada];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "numero") cmp = a.numero - b.numero;
      else if (sortKey === "status") cmp = String(a.status).localeCompare(String(b.status), "pt-BR");
      else if (sortKey === "oficina") {
        const na = a.oficina_id ? (oficinaNomeById.get(a.oficina_id) ?? "") : "";
        const nb = b.oficina_id ? (oficinaNomeById.get(b.oficina_id) ?? "") : "";
        cmp = na.localeCompare(nb, "pt-BR");
      } else if (sortKey === "recebimento") {
        cmp = String(a.data_recebimento ?? "").localeCompare(String(b.data_recebimento ?? ""));
      }
      return cmp * dir;
    });
    return arr;
  }, [listaFiltrada, sortKey, sortDir, oficinaNomeById]);

  // ---- Draft ----
  const [draft, setDraft] = useState<Partial<Cop>>({});
  useEffect(() => {
    if (!selected) { setDraft({}); return; }
    setDraft({
      oficina_id: selected.oficina_id,
      data_saida_oficina: selected.data_saida_oficina,
      data_recebimento: selected.data_recebimento,
      observacoes_romaneio: selected.observacoes_romaneio,
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

  const corrigirCorte = useMutation({
    mutationFn: async (cop: Cop) => {
      const { error } = await supabase
        .from("cops" as any)
        .update({ corte_em_correcao: true } as any)
        .eq("id", cop.id);
      if (error) throw error;
      return cop.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["cops"] });
      setSelectedId(id);
      toast.success("COP enviado para correção no Corte.");
      onChangeTab?.("corte");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao iniciar correção"),
  });

  const salvarPerdas = useMutation({
    mutationFn: async ({ cop, perdas }: { cop: Cop; perdas: CopPerdaLinha[] }) => {
      const obs = mesclarPerdasEmObservacoes(cop.observacoes_romaneio, perdas);

      // Delta: só o que aumentou vira registro de histórico.
      const prev = cop.perdas ?? [];
      const delta: CopPerdaLinha[] = [];
      for (const p of perdas) {
        const ant = prev.find((x) => x.modelo === p.modelo && x.cor === p.cor && x.tamanho === p.tamanho);
        const d = (Number(p.qtd) || 0) - (Number(ant?.qtd) || 0);
        if (d > 0) delta.push({ modelo: p.modelo, cor: p.cor, tamanho: p.tamanho, qtd: d });
      }
      const totalDelta = delta.reduce((s, x) => s + x.qtd, 0);

      const historico_perdas = [...(cop.historico_perdas ?? [])];
      if (totalDelta > 0) {
        historico_perdas.push({
          em: new Date().toISOString(),
          tipo: "perda",
          total: totalDelta,
          itens: delta,
        });
      }

      // Recalcular status considerando perdas como "entregue" para completude.
      const rec = cop.pecas_recebidas ?? [];
      const completo = todasCompletas(cop.pecas || [], rec, perdas);
      const algumRecOuPerda =
        (rec.some((r) => r.qtd_recebida > 0)) ||
        (perdas.some((p) => p.qtd > 0));

      let novoStatus: CopStatus = cop.status;
      if (completo && (cop.status === "Na Oficina (Costura)" || cop.status === "Romaneio Parcial")) {
        novoStatus = "Romaneio Completo";
      } else if (!completo && cop.status === "Na Oficina (Costura)" && algumRecOuPerda) {
        novoStatus = "Romaneio Parcial";
      }

      const patch: any = {
        perdas: perdas as any,
        observacoes_romaneio: obs,
        historico_perdas: historico_perdas as any,
      };
      if (novoStatus !== cop.status) patch.status = novoStatus;

      const { error } = await supabase.from("cops" as any).update(patch).eq("id", cop.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cops"] });
      toast.success("Perdas registradas.");
      setShowPerda(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar perdas"),
  });

  const salvarUrgencia = useMutation({
    mutationFn: async ({ cop, obs, linhas }: { cop: Cop; obs: string; linhas: CopUrgenciaLinha[] }) => {
      const { data: ses } = await supabase.auth.getUser();
      const registro: CopUrgencia = {
        em: new Date().toISOString(),
        por: ses.user?.id ?? null,
        observacao: obs,
        linhas,
      };
      const proximas = [...(cop.urgencias ?? []), registro];
      const { error } = await supabase
        .from("cops" as any)
        .update({ urgencias: proximas as any } as any)
        .eq("id", cop.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cops"] });
      toast.success("Urgência registrada.");
      setShowUrgencia(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar urgência"),
  });




  function patchDraftToCop(): Partial<Cop> {
    return {
      oficina_id: draft.oficina_id ?? null,
      data_saida_oficina: draft.data_saida_oficina ?? null,
      data_recebimento: draft.data_recebimento ?? null,
      observacoes_romaneio: (draft.observacoes_romaneio ?? "")?.toString().toUpperCase() || null,
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
    const completo = todasCompletas(selected.pecas || [], rec, selected.perdas ?? []);
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

    // Inserir filho herdando o número-base do pai-origem (sem consumir sequence)
    const numeroPai = numeroBaseCop(selected, cops);
    const { data: filho, error: e1 } = await supabase.from("cops" as any).insert({
      numero: numeroPai,
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
    const rec = selected.pecas_recebidas ?? [];
    const perdas = selected.perdas ?? [];
    const completo = selected.status === "Romaneio Completo" || todasCompletas(selected.pecas || [], rec, perdas);
    if (!completo) return;
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

  // Bloqueia edição do romaneio quando o COP ainda está em estágio de Corte ou em correção
  const emCorrecao = !!selected?.corte_em_correcao;
  const bloqueadoRomaneio = !!selected && (STATUS_CORTE.includes(selected.status) || emCorrecao);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Romaneio</h2>
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
                <SelectItem value="__ativos__">Ativos (exceto Finalizados/Pagos)</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
                {COP_STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Oficina:</Label>
            <Select value={oficinaFiltro} onValueChange={setOficinaFiltro}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="__sem__">Sem oficina</SelectItem>
                {oficinas.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
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
      <div ref={editorRef} />
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
                <div className="flex items-center gap-2">
                  {(selected.urgencias?.length ?? 0) > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-800 border border-red-300"
                      title={`${selected.urgencias.length} pedido(s) de urgência registrado(s)`}
                    >
                      <Flame className="h-3.5 w-3.5" />
                      URGÊNCIA{selected.urgencias.length > 1 ? ` ×${selected.urgencias.length}` : ""}
                    </span>
                  )}
                  <span className="px-2 py-1 rounded-md text-xs font-medium border" style={etapaStyle(selected.status)}>
                    {selected.status}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {emCorrecao ? (
                <div className="rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Em correção de corte. Edição do romaneio bloqueada até concluir na aba <span className="font-semibold">Corte</span> (botão "Voltar para o Romaneio").
                </div>
              ) : bloqueadoRomaneio && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  Este COP ainda está em <span className="font-semibold">{selected.status}</span>. Conclua o Corte e clique em
                  <span className="font-semibold"> "Mandar pro Romaneio"</span> na aba <span className="font-semibold">Corte</span> para liberar a edição aqui.
                </div>
              )}
              <fieldset disabled={bloqueadoRomaneio} className="space-y-4 disabled:opacity-60">

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                          {o.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  {(() => {
                    const grupos = agruparPorModeloCor(selected.pecas || []);
                    const cols = colunasTamanhos((selected.pecas || []).map((p) => p.tamanho));
                    return (
                      <table className="w-full text-[12.5px] leading-[1.2]">
                        <thead className="bg-muted/40 text-xs">
                          <tr>
                            <th className="p-2 text-left">Modelo</th>
                            <th className="p-2 text-left">Cor</th>
                            {cols.map((c) => (
                              <th key={c} className="p-2 text-center w-16">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {grupos.map((g, i) => {
                            const hex = corHex(g.cor); const fg = corTextoSobre(hex);
                            const byTam = new Map(g.tamanhos.map((t) => [t.tamanho, t.qtd]));
                            const urgente = linhaUrgente(selected.urgencias, g.modelo, g.cor);
                            const qtdLinha = g.tamanhos.reduce((s, t) => s + (Number(t.qtd) || 0), 0);
                            const recLinha = g.tamanhos.reduce(
                              (s, t) => s + getRecebida(recebidas, g.modelo, g.cor, t.tamanho),
                              0,
                            );
                            const perdaLinhaTot = g.tamanhos.reduce(
                              (s, t) => s + getPerda(selected.perdas ?? [], g.modelo, g.cor, t.tamanho),
                              0,
                            );
                            const linhaCompleta = qtdLinha > 0 && (recLinha + perdaLinhaTot) >= qtdLinha;
                            return (
                              <tr key={i} className="border-t">
                                <td className="p-2">
                                  <span className="inline-flex items-center gap-1" title={urgente ? "Urgência solicitada" : undefined}>
                                    {urgente && (
                                      <Flame
                                        className={`h-3.5 w-3.5 ${linhaCompleta ? "text-muted-foreground" : "text-red-600"}`}
                                        aria-label="Urgência solicitada"
                                      />
                                    )}
                                    {g.modelo}
                                  </span>
                                </td>
                                <td className="p-2"><span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: hex, color: fg }}>{g.cor}</span></td>
                                {cols.map((tam) => {
                                  const qtd = byTam.get(tam) ?? 0;
                                  if (!qtd) {
                                    return <td key={tam} className="p-2 text-center text-xs text-muted-foreground/40">—</td>;
                                  }
                                  const r = getRecebida(recebidas, g.modelo, g.cor, tam);
                                  const perdaLinha = getPerda(selected.perdas ?? [], g.modelo, g.cor, tam);
                                  const completo = r >= qtd && qtd > 0;
                                  const fechadoComPerda = !completo && qtd > 0 && perdaLinha > 0 && (r + perdaLinha) >= qtd;
                                  const parcial = !completo && !fechadoComPerda && r > 0 && r < qtd;
                                  const bg = completo ? "#16a34a" : fechadoComPerda ? "#9333ea" : parcial ? "#9ca3af" : "#f3f4f6";
                                  const cor = (completo || parcial || fechadoComPerda) ? "#ffffff" : "#111827";
                                  return (
                                    <td key={tam} className="p-2 text-center">
                                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                                        style={{ backgroundColor: bg, color: cor, border: "1px solid #d1d5db" }}>
                                        <span className="tabular-nums">{r}/{qtd}</span>
                                      </span>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                          {grupos.length === 0 && (
                            <tr><td colSpan={2 + cols.length} className="p-3 text-center text-muted-foreground">Sem peças.</td></tr>
                          )}
                        </tbody>
                      </table>
                    );
                  })()}
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

              {/* Botões — linha única, largura/altura uniformes, cores 100% via btnStyle */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {selected.romaneio_enviado_em && (
                  <Button
                    style={btnStyle("baixar_pdf")}
                    onClick={() => abrirRomaneioParaImpressao(selected, oficina, cops)}
                    className="h-10 w-[185px] justify-center truncate"
                  >
                    <FileDown className="h-4 w-4 mr-1" />
                    <span className="truncate">romaneio-{formatCopNumero(numeroBaseCop(selected, cops))}{selected.letra ?? ""}.pdf</span>
                  </Button>
                )}
                {podeParticionar && (
                  <Button
                    style={btnStyle("particionar")}
                    onClick={() => setShowParticionar(true)}
                    title="Particionar por letra"
                    className="h-10 w-[185px] justify-center truncate"
                  >
                    <Split className="h-4 w-4 mr-1" />
                    <span className="truncate">Particionar ({letraNova})</span>
                  </Button>
                )}
                {canManageCop && (
                  <Button
                    style={btnStyle("corrigir_corte")}
                    onClick={() => corrigirCorte.mutate(selected)}
                    disabled={corrigirCorte.isPending || emCorrecao}
                    title="Liberar este COP para edição não-destrutiva no Corte (mantém oficina, datas, recebidas e pagamento)"
                    className="h-10 w-[185px] justify-center truncate border"
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    <span className="truncate">Corrigir corte</span>
                  </Button>
                )}
                {canManageCop && (
                  <Button
                    style={btnStyle("registrar_perda")}
                    onClick={() => setShowPerda(true)}
                    disabled={!selected.pecas?.length}
                    title="Registrar peças perdidas neste romaneio"
                    className="h-10 w-[185px] justify-center truncate"
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    <span className="truncate">Registrar perda</span>
                  </Button>
                )}
                {canManageCop && (selected.status === "Na Oficina (Costura)" || selected.status === "Romaneio Parcial") && (
                  <Button
                    style={btnStyle("pedir_urgencia")}
                    onClick={() => setShowUrgencia(true)}
                    disabled={salvarUrgencia.isPending || !selected.pecas?.length}
                    title="Registrar pedido de urgência à oficina"
                    className="h-10 w-[185px] justify-center truncate"
                  >
                    <Flame className="h-4 w-4 mr-1" />
                    <span className="truncate">Pedir Urgência</span>
                  </Button>
                )}
                <Button
                  style={btnStyle("atualizar")}
                  onClick={handleAtualizar}
                  disabled={salvar.isPending}
                  className="h-10 w-[185px] justify-center truncate"
                >
                  <span className="truncate">Salvar</span>
                </Button>
                <Button
                  style={btnStyle("enviar_oficina")}
                  onClick={handleEnviarOficina}
                  disabled={salvar.isPending || (selected.status !== "Aguardando Oficina" && selected.status !== "Aguardando Romaneio")}
                  title={(selected.status !== "Aguardando Oficina" && selected.status !== "Aguardando Romaneio") ? "Romaneio já foi enviado" : "Enviar para a oficina"}
                  className="h-10 w-[185px] justify-center truncate"
                >
                  <Send className="h-4 w-4 mr-1" />
                  <span className="truncate">Enviar para Oficina</span>
                </Button>
                <Button
                  style={btnStyle("entrega_romaneio")}
                  onClick={() => setShowEntrega(true)}
                  disabled={salvar.isPending
                    || (selected.status !== "Na Oficina (Costura)"
                        && selected.status !== "Romaneio Parcial"
                        && selected.status !== "Romaneio Completo")}
                  className="h-10 w-[185px] justify-center truncate"
                >
                  <PackageOpen className="h-4 w-4 mr-1" />
                  <span className="truncate">Entrega de Romaneio</span>
                </Button>
              </div>
              </fieldset>
            </CardContent>
          </Card>

          {/* Lado Direito — Histórico */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Histórico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(() => {
                const perdasArr = selected.perdas ?? [];
                const completoTotal = todasCompletas(selected.pecas || [], recebidas, perdasArr);
                const totalPerda = perdasArr.reduce((s, p) => s + (Number(p.qtd) || 0), 0);
                const completoViaPerda = completoTotal && totalPerda > 0 && totalRecebidas(recebidas) < totalPecasCop(selected.pecas);
                const jaCompleto = selected.status === "Romaneio Completo" || selected.status === "Aguardando Pagamento" || selected.status === "Finalizado";
                const mostrarPainel = jaCompleto || selected.status === "Romaneio Parcial" || completoTotal || selected.conferido_em;
                if (!mostrarPainel) {
                  return (
                    <div className="rounded-md border bg-muted/20 p-3 text-muted-foreground">
                      A conferência é liberada quando o romaneio começar a receber peças.
                    </div>
                  );
                }
                return (
                <>
                  {completoViaPerda && !jaCompleto && (
                    <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
                      <b>Romaneio completo por perda.</b> As peças perdidas fecharam o saldo — envie para pagamento pelo botão abaixo.
                    </div>
                  )}
                  <div className="rounded-md border bg-muted/30 p-3">
                    {selected.status === "Romaneio Parcial" && !completoTotal
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
                        {(selected.pecas || [])
                          .filter((p) => getRecebida(recebidas, p.modelo, p.cor, p.tamanho) > 0)
                          .map((p, i) => {
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
                        {(selected.pecas || []).filter((p) => getRecebida(recebidas, p.modelo, p.cor, p.tamanho) > 0).length === 0 && (
                          <tr><td colSpan={3} className="p-3 text-center text-muted-foreground">Nenhuma peça recebida ainda.</td></tr>
                        )}
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
                  {(() => {
                    const chegadas = (selected.historico_recebimentos ?? []).map((h) => ({ ...h, _kind: "recebimento" as const }));
                    let perdas = (selected.historico_perdas ?? []).map((h) => ({ ...h, _kind: "perda" as const }));
                    // Fallback: se há perdas registradas mas nenhum evento no histórico, mostra um resumo sintético.
                    if (perdas.length === 0 && (selected.perdas ?? []).some((p) => (Number(p.qtd) || 0) > 0)) {
                      const itens = (selected.perdas ?? []).filter((p) => (Number(p.qtd) || 0) > 0);
                      const total = itens.reduce((s, p) => s + (Number(p.qtd) || 0), 0);
                      perdas = [{
                        em: selected.updated_at ?? selected.created_at ?? new Date().toISOString(),
                        tipo: "perda" as const,
                        total,
                        itens,
                        _kind: "perda" as const,
                      }];
                    }
                    const unificado = [...chegadas, ...perdas].sort((a, b) => (a.em < b.em ? 1 : -1));
                    if (unificado.length === 0) return null;
                    const badge = (h: HistoricoRecebimento | HistoricoPerda) => {
                      if (h.tipo === "completo") return "bg-green-100 text-green-800";
                      if (h.tipo === "parcial") return "bg-amber-100 text-amber-800";
                      return "bg-purple-100 text-purple-800";
                    };
                    return (
                      <div className="rounded-md border p-2">
                        <div className="text-xs font-semibold mb-1">Histórico</div>
                        <ul className="space-y-1 text-xs">
                          {unificado.map((h, i) => (
                            <li
                              key={i}
                              className="flex justify-between gap-2 cursor-pointer hover:bg-accent/40 rounded px-1 py-0.5 transition-colors"
                              onClick={() => setSelectedHist(h)}
                              title="Clique para ver o detalhe"
                            >
                              <span>
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] mr-1 ${badge(h)}`}>
                                  {h.tipo}
                                </span>
                                {new Date(h.em).toLocaleString("pt-BR")}
                                {h._kind === "recebimento" && h.letra && <> · letra <b>{h.letra}</b></>}
                              </span>
                              <span className={`tabular-nums font-semibold ${h._kind === "perda" ? "text-purple-700" : ""}`}>
                                {h._kind === "perda" ? "−" : ""}{h.total}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}

                  <Dialog open={!!selectedHist} onOpenChange={(o) => !o && setSelectedHist(null)}>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{selectedHist?.tipo === "perda" ? "Perdas registradas" : "Peças entregues"}</DialogTitle>
                        <DialogDescription>
                          {selectedHist && (
                            <span>
                              {new Date(selectedHist.em).toLocaleString("pt-BR")} — {" "}
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${selectedHist.tipo === "completo" ? "bg-green-100 text-green-800" : selectedHist.tipo === "parcial" ? "bg-amber-100 text-amber-800" : "bg-purple-100 text-purple-800"}`}>
                                {selectedHist.tipo}
                              </span>
                              {selectedHist.tipo !== "perda" && (selectedHist as HistoricoRecebimento).letra && <> · letra <b>{(selectedHist as HistoricoRecebimento).letra}</b></>}
                            </span>
                          )}
                        </DialogDescription>
                      </DialogHeader>
                      {selectedHist && (
                        <div className="rounded-md border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/40">
                              <tr>
                                <th className="p-2 text-left">Modelo</th>
                                <th className="p-2 text-left">Cor</th>
                                <th className="p-2 text-left">Tamanho</th>
                                <th className="p-2 text-right">Qtd</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedHist.itens.map((item: any, idx: number) => (
                                <tr key={idx} className="border-t">
                                  <td className="p-2">{item.modelo}</td>
                                  <td className="p-2">{item.cor}</td>
                                  <td className="p-2">{item.tamanho}</td>
                                  <td className={`p-2 text-right tabular-nums font-semibold ${selectedHist.tipo === "perda" ? "text-purple-700" : ""}`}>
                                    {selectedHist.tipo === "perda" ? item.qtd : item.qtd_recebida}
                                  </td>
                                </tr>
                              ))}
                              {selectedHist.itens.length === 0 && (
                                <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">Nenhuma peça registrada.</td></tr>
                              )}
                            </tbody>
                            <tfoot>
                              <tr className="bg-muted/30">
                                <td className="p-2 text-right" colSpan={3}><b>Total</b></td>
                                <td className={`p-2 text-right tabular-nums ${selectedHist.tipo === "perda" ? "text-purple-700" : ""}`}><b>{selectedHist.tipo === "perda" ? "−" : ""}{selectedHist.total}</b></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>


                  {(completoTotal || selected.status === "Romaneio Completo") && (
                    selected.conferido_em ? (
                      <div className="text-xs text-green-700">
                        ✓ Conferido em {new Date(selected.conferido_em).toLocaleString("pt-BR")}.
                      </div>
                    ) : (
                      <Button style={btnStyle("conferir")} onClick={handleConferir} disabled={salvar.isPending} className="w-full">
                        <Check className="h-4 w-4 mr-1" /> Mandar pro pagamento
                      </Button>
                    )
                  )}
                </>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Busca de peças */}
      <BuscaPecasBlock cops={cops} oficinas={oficinas} onSelect={setSelectedId} />


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
            <RomaneioPecasTable
              lista={lista}
              cops={cops}
              oficinaNomeById={oficinaNomeById}
              selectedId={selectedId}
              onSelect={selectAndScroll}
              etapaStyle={etapaStyle}
              sortKey={sortKey}
              sortDir={sortDir}
              toggleSort={toggleSort}
            />

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
            rotuloAtual={rotuloRomaneio(selected, cops)}
            rotuloRestante={rotuloCop(numeroBaseCop(selected, cops), selected.letra ?? "A")}
            rotuloNovo={rotuloCop(numeroBaseCop(selected, cops), letraNova)}
            onConfirm={handleParticionar}
          />
          <RegistrarPerdaDialog
            open={showPerda}
            onOpenChange={setShowPerda}
            pecas={selected.pecas || []}
            perdas={(selected.perdas as CopPerdaLinha[]) ?? []}
            onConfirm={(perdas) => salvarPerdas.mutate({ cop: selected, perdas })}
            disabled={salvarPerdas.isPending}
          />
        </>
      )}

    </div>

  );
}

function BuscaPecasBlock({ cops, oficinas, onSelect }: { cops: Cop[]; oficinas: Oficina[]; onSelect: (id: string) => void }) {
  const [modelo, setModelo] = useState<string>("");
  const [cor, setCor] = useState<string>("");
  const [tamanho, setTamanho] = useState<string>("");

  const aplicado = !!(modelo || cor || tamanho);
  const carga = useMemo(() => cargaPorOficina(cops), [cops]);
  const oficinaPorId = useMemo(() => {
    const m = new Map<string, Oficina>();
    for (const o of oficinas) m.set(o.id, o);
    return m;
  }, [oficinas]);

  type Resultado = { cop: Cop; qtd: number; rotulo: string; oficinaNome: string; cargaOficina: number; oficinaKey: string };

  const resultados = useMemo<Resultado[]>(() => {
    if (!aplicado) return [];
    const out: Resultado[] = [];
    for (const c of cops) {
      const qtd = (c.pecas || []).reduce((s, p) => {
        if (modelo && p.modelo !== modelo) return s;
        if (cor && p.cor !== cor) return s;
        if (tamanho && p.tamanho !== tamanho) return s;
        return s + (Number(p.qtd) || 0);
      }, 0);
      if (qtd > 0) {
        const ofiNome = c.oficina_id ? (oficinaPorId.get(c.oficina_id)?.nome ?? "—") : "—";
        const cargaOfi = c.oficina_id ? (carga.get(c.oficina_id) ?? 0) : 0;
        const oficinaKey = c.oficina_id ?? "__sem__";
        out.push({ cop: c, qtd, rotulo: rotuloRomaneio(c, cops), oficinaNome: ofiNome, cargaOficina: cargaOfi, oficinaKey });
      }
    }
    return out.sort((a, b) => a.oficinaNome.localeCompare(b.oficinaNome) || a.rotulo.localeCompare(b.rotulo));
  }, [cops, modelo, cor, tamanho, aplicado, oficinaPorId, carga]);

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
            <table className="w-full text-[12.5px] leading-[1.2]">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="p-2 text-left">Oficina</th>
                  <th className="p-2 text-right">Carga oficina</th>
                  <th className="p-2 text-left">Romaneio</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => {
                  const prev = i > 0 ? resultados[i - 1] : null;
                  const novoGrupo = !prev || prev.oficinaKey !== r.oficinaKey;
                  return (
                    <tr key={r.cop.id} className={novoGrupo ? "border-t-2 border-muted-foreground/40" : "border-t"}>
                      <td className="p-2">{novoGrupo ? r.oficinaNome : ""}</td>
                      <td className="p-2 text-right tabular-nums">{novoGrupo ? r.cargaOficina : ""}</td>
                      <td className="p-2 font-semibold tabular-nums">{r.rotulo}</td>
                      <td className="p-2">{r.cop.status}</td>
                      <td className="p-2 text-right tabular-nums">{r.qtd}</td>
                      <td className="p-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => onSelect(r.cop.id)}>Abrir</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30">
                  <td className="p-2" colSpan={4}><b>Total</b></td>
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

function SortableTh({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <th className="p-2 text-left">
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-primary">
        <span>{label}</span>
        {active ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}
      </button>
    </th>
  );
}

function RomaneioPecasTable({
  lista, cops, oficinaNomeById, selectedId, onSelect, etapaStyle,
  sortKey, sortDir, toggleSort,
}: {
  lista: Cop[];
  cops: Cop[];
  oficinaNomeById: Map<string, string>;
  selectedId: string | null | undefined;
  onSelect: (id: string) => void;
  etapaStyle: (s: string) => React.CSSProperties;
  sortKey: "numero" | "status" | "oficina" | "recebimento";
  sortDir: "asc" | "desc";
  toggleSort: (k: "numero" | "status" | "oficina" | "recebimento") => void;
}) {
  const tamanhosColunas = useMemo(() => {
    const set = new Set<string>();
    for (const c of lista) for (const p of c.pecas ?? []) if (p.tamanho) set.add(p.tamanho);
    return colunasTamanhos(set);
  }, [lista]);

  type Grupo = { modelo: string; cor: string; porTamanho: Map<string, number>; total: number };
  const linhas = useMemo(() => {
    return lista.map((c) => {
      const map = new Map<string, Grupo>();
      for (const p of c.pecas ?? []) {
        const k = `${p.modelo}|${p.cor}`;
        let g = map.get(k);
        if (!g) { g = { modelo: p.modelo, cor: p.cor, porTamanho: new Map(), total: 0 }; map.set(k, g); }
        g.porTamanho.set(p.tamanho, (g.porTamanho.get(p.tamanho) ?? 0) + (Number(p.qtd) || 0));
        g.total += Number(p.qtd) || 0;
      }
      return { cop: c, grupos: Array.from(map.values()) };
    });
  }, [lista]);

  function fmtBR(d: string | null | undefined): string {
    if (!d) return "—";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="text-[12.5px] leading-[1.2] w-full" style={{ borderCollapse: "collapse" }}>
        <thead className="bg-muted/40 text-xs">
          <tr>
            <SortableTh label="Romaneio" active={sortKey === "numero"} dir={sortDir} onClick={() => toggleSort("numero")} />
            <SortableTh label="Oficina" active={sortKey === "oficina"} dir={sortDir} onClick={() => toggleSort("oficina")} />
            <SortableTh label="Status" active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")} />
            <th className="px-2 py-2 text-left whitespace-nowrap">Modelo</th>
            <th className="px-2 py-2 text-left whitespace-nowrap">Cor</th>
            {tamanhosColunas.map((t) => (
              <th key={t} className="px-1 py-2 text-center whitespace-nowrap">{t}</th>
            ))}
            <th className="px-2 py-2 text-right whitespace-nowrap">Tot.</th>
            <SortableTh label="Recebimento" active={sortKey === "recebimento"} dir={sortDir} onClick={() => toggleSort("recebimento")} />
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ cop: c, grupos }, copIdx) => {
            const ofiNome = c.oficina_id ? (oficinaNomeById.get(c.oficina_id) ?? "—") : "—";
            const rows = grupos.length > 0 ? grupos : [null];
            const span = rows.length;
            const sel = c.id === selectedId;
            const zebra = copIdx % 2 === 1;
            return rows.map((g, i) => (
              <tr
                key={`${c.id}|${i}`}
                className={`border-t cursor-pointer hover:bg-accent/40 ${sel ? "bg-accent/50" : zebra ? "bg-muted/80" : ""}`}
                onClick={() => onSelect(c.id)}
              >

                {i === 0 && (
                  <>
                    <td className="p-2 font-semibold tabular-nums align-top" rowSpan={span}>{rotuloRomaneio(c, cops)}</td>
                    <td className="p-2 align-top" rowSpan={span}>{ofiNome}</td>
                    <td className="p-2 align-top" rowSpan={span}>
                      <span className="px-2 py-0.5 rounded text-xs border" style={etapaStyle(c.status)}>{c.status}</span>
                    </td>
                  </>
                )}
                {g ? (
                  <>
                    <td className="px-2 py-1 whitespace-nowrap text-xs">{g.modelo}</td>
                    <td className="px-2 py-1">
                      {(() => {
                        const hex = corHex(g.cor); const fg = corTextoSobre(hex);
                        return <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: hex, color: fg }}>{g.cor}</span>;
                      })()}
                    </td>
                    {tamanhosColunas.map((t) => {
                      const q = g.porTamanho.get(t) ?? 0;
                      return (
                        <td key={t} className="px-1 py-1 text-center tabular-nums text-xs">
                          {q > 0 ? q : <span className="text-muted-foreground/40">–</span>}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-right tabular-nums text-xs font-semibold">{g.total}</td>
                  </>
                ) : (
                  <td className="p-2 text-muted-foreground text-xs" colSpan={2 + tamanhosColunas.length + 1}>—</td>
                )}
                {i === 0 && (
                  <td className="p-2 align-top text-xs" rowSpan={span}>{fmtBR(c.data_recebimento)}</td>
                )}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}



