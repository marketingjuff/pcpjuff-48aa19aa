import { pedidoAtivoNasAreas, sortByDataSaidaJuffAsc, episodioAberto, validarOrcamento } from "@/lib/pedidos";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Pedido } from "@/lib/pedidos";
import {
  STATUS_PECAS_OPCOES, TIPOS_ESTAMPA, SIM_NAO, UFS,
  calcularEtapaAtual, tipoIncluiDTF, tipoIncluiSilk,
} from "@/lib/pedidos";
import { useAppList } from "@/lib/app-lists";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Save, X, FileText, Download, AlertTriangle, ArrowUpDown, CalendarClock, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDiasUteis, diasUteisEntre, diasUteisAteHoje, addDiasCorridos, proximoDiaUtil, isDataUtilISO } from "@/lib/dias-uteis";
import { useFeriados } from "@/hooks/use-feriados";
import { formatDateBR } from "@/lib/format";
import { PedidoMobileCard, Chip, QtdTotal, StatusPecasBadge, StatusPecasChip, etapaPaletteClass, TABLE_WRAPPER_CLASS, TABLE_FONT_STYLE, TH_CLASS, TD_CLASS, BADGE_SM_CLASS, useSort, cmpDate, cmpNum, ETAPA_FILTRO_OPCOES_DADOS_IN, matchEtapaFiltro, UpdateButton, EtapaBadgeView } from "./shared";
import { ObservacoesOutrosSetores } from "./ObservacoesOutrosSetores";
import { RefacaoViewerButton } from "./RefacaoViewerButton";
import { RefacaoBadge } from "./RefacaoBadge";
import { SolicitarPecasDialog } from "./SolicitarPecasDialog";
import { PecasCompletadasPanel } from "./PecasCompletadasPanel";
import { useColorSettings } from "@/hooks/use-color-settings";

import { calcularEtapaAtual as _calcEtapa } from "@/lib/pedidos";
import { useDirtyTracker, useRegisterSave, useDirtyForm } from "./dirty-form-context";
import { useIsAdmin, useHasRole } from "@/hooks/use-role";

interface Props {
  pedidos: Pedido[];
  selected: Pedido | null;
  onSelect: (id: string | null) => void;
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  onDelete: (id: string) => void;
  saving: boolean;
  active?: boolean;
}

const empty: Partial<Pedido> = {
  pedido_olist: "",
  orcamento: "",
  qtd: null,
  vendedor: null,
  tipo_estampa: "",
  status_pecas: "incompleto",
  entrada_pedido: new Date().toISOString().slice(0, 10),
  necessita_vetorizacao: false,
  forma_pagamento: null,
  nf_emitida: null,
};

export function DadosInTab({ pedidos, selected, onSelect, onSave, onDelete, saving, active = true }: Props) {
  const [form, setForm] = useState<Partial<Pedido>>(empty);
  const isAdmin = useIsAdmin();
  const isGestor = useHasRole("gestor");
  const podeDeletar = isAdmin || isGestor;
  const [uploading, setUploading] = useState(false);
  const { feriados } = useFeriados();
  const { isDirty } = useDirtyForm();
  const { names: vendedores } = useAppList("vendedor");
  const { names: fretes } = useAppList("frete");
  const { names: formasPagamento } = useAppList("pagamento");
  const { names: nfOpcoes } = useAppList("nf");

  const skipNextSelectedSync = useRef(false);
  useEffect(() => {
    if (skipNextSelectedSync.current) {
      skipNextSelectedSync.current = false;
      return;
    }
    if (!isDirty) setForm(selected ?? empty);
    else if (selected?.id) {
      // After a fresh insert, merge the new id into the dirty form so the
      // next save updates the same row instead of inserting again.
      setForm((f) => (f.id === selected.id ? f : { ...f, id: selected.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  useDirtyTracker(form, selected ?? empty, active);

  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  // ----- Solicitar Peças (ponte PCP→COP) -----
  const { btnStyle } = useColorSettings();
  const [solicitarOpen, setSolicitarOpen] = useState(false);
  const pecasSolicitadas = (form.pecas_solicitadas ?? []) as import("@/lib/pedidos").PecaSolicitada[];
  const temSolicitacao = pecasSolicitadas.length > 0;
  const temPendencia = pecasSolicitadas.some((p) => (Number(p.qtd_enviada) || 0) < (Number(p.qtd) || 0));
  const tudoEnviado = temSolicitacao && !temPendencia;

  async function salvarPecasSolicitadas(next: import("@/lib/pedidos").PecaSolicitada[]) {
    setForm((f) => ({ ...f, pecas_solicitadas: next }));
    if (selected?.id) {
      onSave({ id: selected.id, pecas_solicitadas: next } as any);
    }
  }

  async function liberarParaCompleto() {
    setForm((f) => ({ ...f, pecas_solicitadas: [], status_pecas: "completo" }));
    if (selected?.id) {
      onSave({ id: selected.id, pecas_solicitadas: [], status_pecas: "completo" } as any);
    }
  }

  function setTipoEstampa(v: string) {
    setForm((f) => {
      const next: Partial<Pedido> = { ...f, tipo_estampa: v };
      if (!tipoIncluiDTF(v)) {
        next.dtf_impresso = null; next.dtf_executado = null; next.dtf_estampado = null;
        next.dtf_data_executada = null; next.quem_bateu_dtf = null; next.dtf_observacao = null;
      }
      if (!tipoIncluiSilk(v)) {
        next.fotolito_impresso = null; next.fotolito_executado = null; next.tela_gravada = null;
        next.silk_feito = null; next.silk_data_executada = null; next.quem_bateu_silk = null; next.silk_observacao = null;
      }
      if (v === "Lisa") next.status_arte = null;
      return next;
    });
  }

  // Cálculos automáticos
  const tempoFreteNum = Number(form.tempo_frete ?? NaN);
  const saidaJuffCalc = useMemo(() => {
    if (!form.data_entrega || !Number.isFinite(tempoFreteNum)) return null;
    if (tempoFreteNum === 0) return form.data_entrega;
    return addDiasUteis(form.data_entrega, -tempoFreteNum, feriados);
  }, [form.data_entrega, tempoFreteNum, feriados]);
  const tempoProducaoCalc = useMemo(() => {
    if (!form.entrada_pedido || !saidaJuffCalc) return null;
    const ultimoDiaProducao = addDiasUteis(saidaJuffCalc, -1, feriados);
    const d = diasUteisEntre(form.entrada_pedido, ultimoDiaProducao, feriados);
    return Math.max(0, d);
  }, [form.entrada_pedido, saidaJuffCalc, feriados]);

  // A1 — Início de Acabamento
  // Silk/Silk+DTF: término_estamparia + (dias_secagem) dias corridos pulando o dia do término e o dia do início,
  //   ou seja: término + dias_secagem + 1 dia corrido; depois empurra para o próximo dia útil.
  // Só DTF: igual ao término_estamparia.
  const isLisa = form.tipo_estampa === "Lisa";
  const incluiSilk = tipoIncluiSilk(form.tipo_estampa);
  const soDTF = tipoIncluiDTF(form.tipo_estampa) && !incluiSilk;
  const diasSecagemNum = Number(form.dias_secagem ?? 0) || 0;
  const inicioAcabamentoCalc = useMemo(() => {
    if (!form.termino_estamparia || isLisa) return null;
    if (soDTF) return form.termino_estamparia;
    if (!incluiSilk) return null;
    // término dia 1, secagem N dias → início no dia (1 + N + 1); o dia do término e o dia do início não contam.
    const base = addDiasCorridos(form.termino_estamparia, diasSecagemNum + 1);
    return proximoDiaUtil(base, feriados);
  }, [form.termino_estamparia, soDTF, incluiSilk, isLisa, diasSecagemNum, feriados]);


  const VENDOR_REQUIRED: (keyof Pedido)[] = [
    "pedido_olist", "orcamento", "qtd", "vendedor", "entrada_pedido",
    "frete", "tempo_frete", "data_entrega",
    "forma_pagamento", "nf_emitida", "uf_entrega", "layout_url",
  ];
  const PROD_REQUIRED: (keyof Pedido)[] = ["status_pecas", "tipo_estampa"];
  const [missingVendor, setMissingVendor] = useState<Set<string>>(new Set());
  const [missingProd, setMissingProd] = useState<Set<string>>(new Set());

  function isEmpty(v: any) { return v === null || v === undefined || v === ""; }
  function findMissing(keys: (keyof Pedido)[]) {
    return new Set(keys.filter((k) => isEmpty((form as any)[k])).map(String));
  }

  async function checkDuplicado(pedidoOlist: string, currentId?: string): Promise<boolean> {
    if (!pedidoOlist) return false;
    const { data, error } = await supabase
      .from("pedidos").select("id").eq("pedido_olist", pedidoOlist).maybeSingle();
    if (error) { console.error(error); return false; }
    if (!data) return false;
    return data.id !== currentId;
  }

  async function saveVendor() {
    const miss = findMissing(VENDOR_REQUIRED);
    setMissingVendor(miss);
    if (miss.size > 0) {
      toast.error("Preencha os campos obrigatórios do Input do Vendedor.");
      return;
    }
    if (await checkDuplicado(String(form.pedido_olist ?? ""), selected?.id)) {
      toast.error(`Já existe um pedido com o número Olist "${form.pedido_olist}".`);
      return;
    }
    const wipe = await wipeProducaoSeRefacaoDados();
    onSave({
      ...form,
      saida_juff: saidaJuffCalc ?? form.saida_juff ?? null,
      tempo_producao: tempoProducaoCalc ?? form.tempo_producao ?? null,
      inicio_acabamento: isLisa ? (form.inicio_acabamento ?? null) : (inicioAcabamentoCalc ?? form.inicio_acabamento ?? null),
      ...wipe,
    });
  }
  async function saveProducao() {
    const missP = findMissing(PROD_REQUIRED);
    setMissingProd(missP);
    if (missP.size > 0) {
      toast.error("Preencha os campos obrigatórios do Input de Produção.");
      return;
    }
    // Validação: Término de Acabamento deve ser dia útil
    if (form.termino_acabamento && !isDataUtilISO(form.termino_acabamento, feriados)) {
      setMissingProd(new Set([...missP, "termino_acabamento"]));
      toast.error("Término de Acabamento deve cair em dia útil (não pode ser fim de semana ou feriado).");
      return;
    }
    if (!selected?.id) {
      const missV = findMissing(VENDOR_REQUIRED);
      setMissingVendor(missV);
      if (missV.size > 0) {
        toast.error("Para criar o pedido, preencha também os obrigatórios do Input do Vendedor.");
        return;
      }
      if (await checkDuplicado(String(form.pedido_olist ?? ""))) {
        toast.error(`Já existe um pedido com o número Olist "${form.pedido_olist}".`);
        return;
      }
    }
    // Validação das datas de produção (janela e ordem do fluxo)
    {
      const inicioAcabEfetivo = isLisa ? (form.inicio_acabamento ?? null) : (form.inicio_acabamento ?? inicioAcabamentoCalc ?? null);
      const datasParaValidar: { key: string; label: string; value: string | null | undefined }[] = isLisa
        ? [
            { key: "inicio_acabamento", label: "Início de Acabamento", value: form.inicio_acabamento },
            { key: "termino_acabamento", label: "Término de Acabamento", value: form.termino_acabamento },
          ]
        : [
            { key: "arte_data", label: "Arte (limite)", value: form.arte_data },
            { key: "inicio_estamparia", label: "Início de Estamparia", value: form.inicio_estamparia },
            { key: "termino_estamparia", label: "Término de Estamparia", value: form.termino_estamparia },
            { key: "inicio_acabamento", label: "Início de Acabamento", value: inicioAcabEfetivo },
            { key: "termino_acabamento", label: "Término de Acabamento", value: form.termino_acabamento },
          ];
      const algumaPreenchida = datasParaValidar.some((d) => !!d.value);
      if (algumaPreenchida && (!form.entrada_pedido || !saidaJuffCalc)) {
        toast.error("Defina Entrada do Pedido e Data de Entrega/Tempo de Frete (Saída Juff) antes de informar datas de produção.");
        return;
      }
      if (algumaPreenchida && form.entrada_pedido && saidaJuffCalc) {
        for (const d of datasParaValidar) {
          if (!d.value) continue;
          if (d.value < form.entrada_pedido || d.value > saidaJuffCalc) {
            setMissingProd(new Set([...missP, d.key]));
            toast.error(`A data ${d.label} está fora da janela de produção (entrada do pedido até a Saída Juff).`);
            return;
          }
        }
      }
      // Ordem do fluxo
      const fail = (key: string, msg: string) => {
        setMissingProd(new Set([...missP, key]));
        toast.error(msg);
      };
      if (!isLisa) {
        if (form.arte_data && form.inicio_estamparia && form.arte_data > form.inicio_estamparia) {
          fail("inicio_estamparia", "Início de Estamparia não pode ser anterior à Arte (limite)."); return;
        }
        if (form.inicio_estamparia && form.termino_estamparia && form.inicio_estamparia > form.termino_estamparia) {
          fail("termino_estamparia", "Término de Estamparia não pode ser anterior ao Início de Estamparia."); return;
        }
        if (form.termino_estamparia && inicioAcabEfetivo && form.termino_estamparia > inicioAcabEfetivo) {
          fail("inicio_acabamento", "Início de Acabamento não pode ser anterior ao Término de Estamparia."); return;
        }
        if (inicioAcabEfetivo && form.termino_acabamento && inicioAcabEfetivo > form.termino_acabamento) {
          fail("termino_acabamento", "Término de Acabamento não pode ser anterior ao Início de Acabamento."); return;
        }
      } else {
        if (form.inicio_acabamento && form.termino_acabamento && form.inicio_acabamento > form.termino_acabamento) {
          fail("termino_acabamento", "Término de Acabamento não pode ser anterior ao Início de Acabamento."); return;
        }
      }
    }
    const wipe = await wipeProducaoSeRefacaoDados();
    onSave({
      ...form,
      saida_juff: saidaJuffCalc ?? form.saida_juff ?? null,
      tempo_producao: tempoProducaoCalc ?? form.tempo_producao ?? null,
      inicio_acabamento: isLisa ? (form.inicio_acabamento ?? null) : (inicioAcabamentoCalc ?? form.inicio_acabamento ?? null),
      ...wipe,
    });
  }

  /**
   * Quando há episódio de refação aberto com destino "dados", salvar o Input
   * de Produção mantém os novos dados preenchidos e limpa as etapas seguintes,
   * liberando o pedido para seguir o fluxo normal.
   */
  async function wipeProducaoSeRefacaoDados(): Promise<Record<string, any>> {
    if (!selected) return {};
    const aberto = episodioAberto(selected);
    if (!aberto || aberto.etapa_destino !== "dados") return {};
    const { camposAlimparAposInputProducao } = await import("./refacao-helpers");
    return camposAlimparAposInputProducao(selected);
  }

  useRegisterSave(saveVendor, active);

  function handleNew() { onSelect(null); setForm(empty); }

  function handleDuplicar() {
    if (!selected) return;
    const dup: Partial<Pedido> = {
      ...empty,
      // Input do Vendedor: mantém
      orcamento: selected.orcamento ?? "",
      vendedor: selected.vendedor ?? null,
      frete: selected.frete ?? null,
      tempo_frete: selected.tempo_frete ?? null,
      uf_entrega: selected.uf_entrega ?? null,
      necessita_vetorizacao: selected.necessita_vetorizacao ?? false,
      obs_vendedor: selected.obs_vendedor ?? null,
      layout_url: selected.layout_url ?? null,
      data_entrega: selected.data_entrega ?? null,
      // Input do Vendedor: limpa
      pedido_olist: "",
      qtd: null,
      forma_pagamento: null,
      nf_emitida: null,
      // Data de entrada: hoje
      entrada_pedido: new Date().toISOString().slice(0, 10),
      // Input de Produção: mantém
      status_pecas: selected.status_pecas ?? "incompleto",
      tipo_estampa: selected.tipo_estampa ?? "",
      dias_secagem: selected.dias_secagem ?? null,
      arte_data: selected.arte_data ?? null,
      inicio_estamparia: selected.inicio_estamparia ?? null,
      termino_estamparia: selected.termino_estamparia ?? null,
      termino_acabamento: selected.termino_acabamento ?? null,
      observacoes_pedido: selected.observacoes_pedido ?? null,
      // Input de Produção: limpa
      n_batidas_dtf: null,
      n_batidas_silk: null,
    };
    skipNextSelectedSync.current = true;
    onSelect(null);
    setForm(dup);
  }

  async function handleUpload(file: File) {
    if (file.type !== "application/pdf") { toast.error("Apenas PDF."); return; }
    if (file.size > 30 * 1024 * 1024) { toast.error("Máx. 30MB."); return; }
    setUploading(true);
    try {
      const path = `${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("layouts").upload(path, file, { contentType: "application/pdf" });
      if (error) throw error;
      set("layout_url", path);
      if (selected?.id) {
        const { error: updErr } = await supabase.from("pedidos").update({ layout_url: path }).eq("id", selected.id);
        if (updErr) throw updErr;
      }
      toast.success("Layout enviado.");
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally { setUploading(false); }
  }

  async function baixarLayout(path: string) {
    const { baixarLayoutPDF } = await import("./shared");
    baixarLayoutPDF(path);
  }

  const pendenciasDataCount = useMemo(
    () => pedidos.filter((p) => !!p.data_entrega_proposta && !p.finalizado_em).length,
    [pedidos],
  );
  const [etapaFiltro, setEtapaFiltro] = useState("ativas");
  const dashboardRef = useRef<HTMLDivElement | null>(null);

  function abrirPendenciasData() {
    setEtapaFiltro("pendencias_data");
    setTimeout(() => {
      dashboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <div className="space-y-3">
      {pendenciasDataCount > 0 && (
        <button
          type="button"
          onClick={abrirPendenciasData}
          className="w-full flex items-center gap-3 p-3 rounded-md border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/15 text-left transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 shrink-0">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              {pendenciasDataCount} solicitação{pendenciasDataCount === 1 ? "" : "ões"} de alteração de data pendente{pendenciasDataCount === 1 ? "" : "s"}
            </div>
            <div className="text-xs text-blue-700/80 dark:text-blue-300/80">
              Clique para filtrar e revisar.
            </div>
          </div>
        </button>
      )}
      <Card className="border-primary/30">
        <CardContent className="py-2 flex items-center justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Orçamento Comercial</div>
            <div className="text-2xl sm:text-4xl font-bold tabular-nums truncate">{form.orcamento || "—"}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>
            {selected && (
              <Button size="sm" variant="outline" onClick={handleDuplicar}>
                <Copy className="h-4 w-4 mr-1" />Duplicar
              </Button>
            )}
            {selected && podeDeletar && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive"><Trash2 className="h-4 w-4 mr-1" />Deletar</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => selected && onDelete(selected.id)}>Deletar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {selected && <PedidoStatusInline pedido={selected} />}

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Vendedor */}
        <Card className="border-l-4 border-l-green-500 bg-green-50/40 dark:bg-green-950/10">
          <CardHeader className="py-2"><CardTitle className="text-base text-green-700 dark:text-green-400">Input do Vendedor</CardTitle></CardHeader>
          <CardContent className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 pt-0">
            <Field label="Pedido Olist *" invalid={missingVendor.has("pedido_olist")}><Input value={form.pedido_olist ?? ""} onChange={(e) => set("pedido_olist", e.target.value)} /></Field>
            <div className="lg:col-span-2">
              <Field label="Orçamento Comercial [N.° Orç - Nome Resp. - Empresa] *" invalid={missingVendor.has("orcamento")}><Input value={form.orcamento ?? ""} onChange={(e) => set("orcamento", e.target.value)} /></Field>
            </div>
            <Field label="Quantas peças *" invalid={missingVendor.has("qtd")}><Input value={form.qtd ?? ""} onChange={(e) => set("qtd", e.target.value)} /></Field>
            <Field label="Vendedor *" invalid={missingVendor.has("vendedor")}>
              <Select value={form.vendedor ?? ""} onValueChange={(v) => set("vendedor", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{vendedores.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Forma de pagamento *" invalid={missingVendor.has("forma_pagamento")}>
              <Select value={form.forma_pagamento ?? ""} onValueChange={(v) => set("forma_pagamento", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{formasPagamento.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Nota Fiscal Emitida? *" invalid={missingVendor.has("nf_emitida")}>
              <Select value={form.nf_emitida ?? ""} onValueChange={(v) => set("nf_emitida", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{nfOpcoes.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Frete *" invalid={missingVendor.has("frete")}>
              <Select value={form.frete ?? ""} onValueChange={(v) => set("frete", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{fretes.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Tempo de frete (dias úteis) *" invalid={missingVendor.has("tempo_frete")}><Input type="number" min="0" value={form.tempo_frete ?? ""} onChange={(e) => set("tempo_frete", e.target.value)} /></Field>
            <Field label="UF de Entrega *" invalid={missingVendor.has("uf_entrega")}>
              <Select value={form.uf_entrega ?? ""} onValueChange={(v) => set("uf_entrega", v)}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UFS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Entrada do pedido *" invalid={missingVendor.has("entrada_pedido")}>
              <DateInputBR value={form.entrada_pedido} onChange={(v) => set("entrada_pedido", v ?? "")} />
            </Field>
            <DataEntregaField
              form={form}
              selected={selected}
              invalid={missingVendor.has("data_entrega")}
              onChangeDataEntrega={(v) => set("data_entrega", v)}
              onPropostaSaved={(v) => {
                set("data_entrega_proposta", v);
              }}
            />

            <Field label="É necessário vetorização?">
              <Select
                value={form.necessita_vetorizacao == null ? "" : (form.necessita_vetorizacao ? "Sim" : "Não")}
                onValueChange={(v) => set("necessita_vetorizacao", v === "Sim")}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{SIM_NAO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>

            <div className="sm:col-span-2 lg:col-span-2">
              <Field label="Layout (PDF até 30MB) *" invalid={missingVendor.has("layout_url")}>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="application/pdf" disabled={uploading}
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                  {form.layout_url && (
                    <Button type="button" variant="outline" size="sm" onClick={() => baixarLayout(form.layout_url!)}>
                      <Download className="h-4 w-4 mr-1" /> Baixar layout
                    </Button>
                  )}
                </div>
                {form.layout_url && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{form.layout_url.replace(/^[0-9a-f-]{36}-/i, "")}</span>
                  </div>
                )}
              </Field>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="Observações do vendedor">
                <Textarea className="uppercase" rows={2} value={form.obs_vendedor ?? ""} onChange={(e) => set("obs_vendedor", e.target.value)} />
              </Field>
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex gap-2 justify-start">
              {selected && (
                <Button type="button" variant="outline" onClick={handleNew}><X className="h-4 w-4 mr-1" />Cancelar edição</Button>
              )}
              <UpdateButton type="button" onClick={saveVendor} disabled={saving}>
                {selected?.id ? "Atualizar" : "Salvar"} Input do Vendedor
              </UpdateButton>
            </div>
          </CardContent>
        </Card>

        {/* Produção */}
        <Card className="border-l-4 border-l-blue-500 bg-blue-50/40 dark:bg-blue-950/10">
          <CardHeader className="py-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base text-blue-700 dark:text-blue-400">Input de Produção</CardTitle>
              {selected && <RefacaoBadge pedido={selected} />}
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 pt-0">
            {/* Linha 1: Status | Tipo | Batidas DTF/Silk (condicional) */}
            <Field label="Status de Peças *" invalid={missingProd.has("status_pecas")}>
              <Select value={form.status_pecas ?? ""} onValueChange={(v) => set("status_pecas", v)} disabled={temPendencia}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{STATUS_PECAS_OPCOES.map((v) => <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
              {temPendencia && (
                <div className="text-[11px] text-amber-700 mt-1">Travado em "incompleto" enquanto houver peças pendentes.</div>
              )}
            </Field>
            <Field label="Tipo de Estampa *" invalid={missingProd.has("tipo_estampa")}>
              <Select value={form.tipo_estampa ?? ""} onValueChange={setTipoEstampa}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{TIPOS_ESTAMPA.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {form.tipo_estampa === "DTF" && (
              <>
                <Field label="Nº Batidas DTF">
                  <Input type="number" min="0" value={form.n_batidas_dtf ?? ""} onChange={(e) => set("n_batidas_dtf", e.target.value === "" ? null : Number(e.target.value))} />
                </Field>
                <div />
              </>
            )}
            {form.tipo_estampa === "Silk" && (
              <>
                <Field label="Nº Batidas Silk">
                  <Input type="number" min="0" value={form.n_batidas_silk ?? ""} onChange={(e) => set("n_batidas_silk", e.target.value === "" ? null : Number(e.target.value))} />
                </Field>
                <div />
              </>
            )}
            {form.tipo_estampa === "DTF+Silk" && (
              <>
                <Field label="Nº Batidas DTF">
                  <Input type="number" min="0" value={form.n_batidas_dtf ?? ""} onChange={(e) => set("n_batidas_dtf", e.target.value === "" ? null : Number(e.target.value))} />
                </Field>
                <Field label="Nº Batidas Silk">
                  <Input type="number" min="0" value={form.n_batidas_silk ?? ""} onChange={(e) => set("n_batidas_silk", e.target.value === "" ? null : Number(e.target.value))} />
                </Field>
              </>
            )}
            {(!form.tipo_estampa || form.tipo_estampa === "Lisa") && (<><div /><div /></>)}

            {/* Linha 2: Dias Secagem | Arte Limite | Início Estamparia | Término Estamparia (não renderiza para Lisa) */}
            {!isLisa && (
              <>
                <Field label="Dias de Secagem (dias corridos)">
                  {soDTF ? (
                    <div className="px-3 py-2 rounded-md bg-muted/50 border text-sm text-muted-foreground">Não se aplica</div>
                  ) : (
                    <Input type="number" min="0" value={form.dias_secagem ?? ""} onChange={(e) => set("dias_secagem", e.target.value === "" ? null : Number(e.target.value))} />
                  )}
                </Field>
                <Field label="Arte (limite)" invalid={missingProd.has("arte_data")}><DateInputBR value={form.arte_data} onChange={(v) => set("arte_data", v)} /></Field>
                <Field label="Início Estamparia" invalid={missingProd.has("inicio_estamparia")}><DateInputBR value={form.inicio_estamparia} onChange={(v) => set("inicio_estamparia", v)} /></Field>
                <Field label="Término Estamparia" invalid={missingProd.has("termino_estamparia")}><DateInputBR value={form.termino_estamparia} onChange={(v) => set("termino_estamparia", v)} /></Field>
              </>
            )}

            {/* Linha 3: Início Acabamento | Término Acabamento | Saída Juff | Tempo Produção */}
            {isLisa ? (
              <Field label="Início de Acabamento" invalid={missingProd.has("inicio_acabamento")}>
                <DateInputBR value={form.inicio_acabamento} onChange={(v) => set("inicio_acabamento", v)} />
              </Field>
            ) : (
              <Field label="Início de Acabamento (calculado)">
                <div className="px-3 py-2 rounded-md bg-muted/50 border text-sm font-medium">{inicioAcabamentoCalc ? formatDateBR(inicioAcabamentoCalc) : "—"}</div>
              </Field>
            )}
            <Field label="Término de Acabamento" invalid={missingProd.has("termino_acabamento")}>
              <DateInputBR value={form.termino_acabamento} onChange={(v) => set("termino_acabamento", v)} />
              {form.termino_acabamento && !isDataUtilISO(form.termino_acabamento, feriados) && (
                <div className="text-xs text-destructive mt-1">Deve ser dia útil (não pode ser fim de semana ou feriado).</div>
              )}
            </Field>
            <Field label="Saída Juff (calculado)">
              <div className="px-3 py-2 rounded-md bg-muted/50 border text-sm font-medium">{saidaJuffCalc ? formatDateBR(saidaJuffCalc) : "—"}</div>
            </Field>
            <Field label="Tempo de produção (dias úteis)">
              <div className="px-3 py-2 rounded-md bg-muted/50 border text-sm font-medium">{tempoProducaoCalc ?? "—"}</div>
            </Field>

            {/* Linha 4: Observações */}
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="Observações de produção">
                <Textarea className="uppercase" rows={2} value={form.observacoes_pedido ?? ""} onChange={(e) => set("observacoes_pedido", e.target.value)} />
              </Field>
              {selected && (
                <ObservacoesOutrosSetores
                  pedido={selected}
                  setorAtual="producao"
                  somente={["arte", "dtf", "silk", "acabamento", "expedicao"]}
                />
              )}
            </div>

            {(form.status_pecas === "incompleto" || temSolicitacao) && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Button
                  type="button"
                  onClick={() => setSolicitarOpen(true)}
                  style={btnStyle(tudoEnviado ? "pedido_completo" : "solicitar_pecas")}
                  className="border"
                >
                  {tudoEnviado ? "Pedido Completo" : "Solicitar Peças"}
                  {temSolicitacao && (
                    <span className="ml-2 text-xs opacity-90">
                      ({pecasSolicitadas.reduce((a, l) => a + (Number(l.qtd_enviada) || 0), 0)}/
                      {pecasSolicitadas.reduce((a, l) => a + (Number(l.qtd) || 0), 0)})
                    </span>
                  )}
                </Button>
                <SolicitarPecasDialog
                  open={solicitarOpen}
                  onOpenChange={setSolicitarOpen}
                  value={pecasSolicitadas}
                  onSave={salvarPecasSolicitadas}
                  readOnly={tudoEnviado}
                  limite={Number(form.qtd ?? selected?.qtd ?? 0) || 0}
                  onLiberarCompleto={liberarParaCompleto}
                />
              </div>
            )}

            <div className="sm:col-span-2 lg:col-span-4">
              <PecasCompletadasPanel pedido={selected ?? null} />
            </div>



            <div className="sm:col-span-2 lg:col-span-4 flex gap-2 justify-start flex-wrap">
              <UpdateButton type="button" onClick={saveProducao} disabled={saving}>
                {selected?.id ? "Atualizar" : "Salvar"} Input de Produção
              </UpdateButton>
              {selected && <RefacaoViewerButton pedido={selected} />}
            </div>
            {selected?.data_entrega_proposta && (
              <div className="sm:col-span-2 lg:col-span-4">
                <PropostaDataAlerta
                  pedidoId={selected.id}
                  dataAtual={selected.data_entrega}
                  dataProposta={selected.data_entrega_proposta}
                  onAprovar={(novaData) =>
                    onSave({
                      id: selected.id,
                      data_entrega: novaData,
                      data_entrega_proposta: null,
                      data_entrega_proposta_em: null,
                      data_entrega_proposta_por: null,
                    } as any)
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      <div ref={dashboardRef}>
        <DadosInDashboard
          pedidos={pedidos}
          selectedId={selected?.id ?? null}
          onSelect={onSelect}
          feriados={feriados}
          vendedores={vendedores}
          etapaFiltro={etapaFiltro}
          setEtapaFiltro={setEtapaFiltro}
        />
      </div>
    </div>
  );
}

function DadosInDashboard({
  pedidos, selectedId, onSelect, feriados, vendedores, etapaFiltro, setEtapaFiltro,
}: {
  pedidos: Pedido[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  feriados: Set<string>;
  vendedores: string[];
  etapaFiltro: string;
  setEtapaFiltro: (v: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [vendedor, setVendedor] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [dataEntrega, setDataEntrega] = useState("");
  const sort = useSort<"pedido"|"qtd"|"tempoFrete"|"entrada"|"saida"|"entrega">("saida", "asc");

  const rows = useMemo(() => {
    const arr = pedidos.filter((p) => {
      if (!matchEtapaFiltro(p, etapaFiltro)) return false;
      if (vendedor !== "todos" && p.vendedor !== vendedor) return false;
      if (status !== "todos" && p.status_pecas !== status) return false;
      if (tipo !== "todos" && p.tipo_estampa !== tipo) return false;
      if (dataEntrega && p.data_entrega !== dataEntrega) return false;
      if (search && !`${p.pedido_olist ?? ""} ${p.orcamento ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (sort.key) {
      arr.sort((a, b) => {
        switch (sort.key) {
          case "pedido": return cmpPedido(a, b, sort.dir);
          case "qtd": return cmpNum(a.qtd, b.qtd, sort.dir);
          case "tempoFrete": return cmpNum(a.tempo_frete as any, b.tempo_frete as any, sort.dir);
          case "entrada": return cmpDate(a.entrada_pedido, b.entrada_pedido, sort.dir);
          case "saida": return cmpDate(a.saida_juff, b.saida_juff, sort.dir);
          case "entrega": return cmpDate(a.data_entrega, b.data_entrega, sort.dir);
        }
        return 0;
      });
      return arr;
    }
    return sortByDataSaidaJuffAsc(arr);
  }, [pedidos, etapaFiltro, vendedor, status, tipo, dataEntrega, search, sort.key, sort.dir]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle className="text-base">Dashboard — Dados In</CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums">
            {rows.length} {rows.length === 1 ? "registro" : "registros"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-0.5">
            <Label className="text-xs text-muted-foreground font-medium">Etapa</Label>
            <Select value={etapaFiltro} onValueChange={setEtapaFiltro}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ETAPA_FILTRO_OPCOES_DADOS_IN.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-0.5">
            <Label className="text-xs text-muted-foreground font-medium">Buscar</Label>
            <Input className="h-8" placeholder="Pedido/orçamento..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-0.5">
            <Label className="text-xs text-muted-foreground font-medium">Vendedor</Label>
            <Select value={vendedor} onValueChange={setVendedor}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos vendedores</SelectItem>
                {vendedores.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-0.5">
            <Label className="text-xs text-muted-foreground font-medium">Status Peças</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                {STATUS_PECAS_OPCOES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-0.5">
            <Label className="text-xs text-muted-foreground font-medium">Tipo Estampa</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos tipos</SelectItem>
                {TIPOS_ESTAMPA.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-0.5">
            <Label className="text-xs text-muted-foreground font-medium">Data Entrega</Label>
            <DateInputBR value={dataEntrega} onChange={(v) => setDataEntrega(v ?? "")} />
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y rounded-md border">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido.</div>
          ) : rows.map((p) => (
            <PedidoMobileCard key={p.id} pedido={p} active={selectedId === p.id} onClick={() => onSelect(p.id)}>
              <Chip label="QTD" value={<QtdTotal pedido={p} />} />
              <Chip label="Vend" value={p.vendedor} />
              <Chip label="Tipo" value={p.tipo_estampa} />
              <Chip label="Pgto" value={p.forma_pagamento} />
              <Chip label="NF" value={p.nf_emitida ?? "—"} />
              <StatusPecasChip pedido={p} />
              <Chip label="Entrega" value={formatDateBR(p.data_entrega) || "—"} />
            </PedidoMobileCard>
          ))}
        </div>

        <div className={TABLE_WRAPPER_CLASS} style={TABLE_FONT_STYLE}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={TH_CLASS}>ETAPA</TableHead>
                <TableHead className={`${TH_CLASS} cursor-pointer select-none`} onClick={() => sort.toggle("pedido")}>
                  <span className="inline-flex items-center gap-1">PEDIDO<ArrowUpDown className={`h-3 w-3 ${sort.key === "pedido" ? "opacity-100" : "opacity-50"}`} /></span>
                </TableHead>
                <TableHead className={TH_CLASS}>ORÇAMENTO</TableHead>
                <TableHead className={TH_CLASS}>VENDEDOR</TableHead>
                <TableHead className={`${TH_CLASS} cursor-pointer select-none`} onClick={() => sort.toggle("qtd")}>
                  <span className="inline-flex items-center gap-1">QTD<ArrowUpDown className={`h-3 w-3 ${sort.key === "qtd" ? "opacity-100" : "opacity-50"}`} /></span>
                </TableHead>
                <TableHead className={TH_CLASS}>ESTAMPA</TableHead>
                <TableHead className={TH_CLASS}>STATUS DAS PEÇAS</TableHead>
                <TableHead className={TH_CLASS}>FRETE</TableHead>
                <TableHead className={TH_CLASS}>UF</TableHead>
                <TableHead className={`${TH_CLASS} cursor-pointer select-none whitespace-nowrap text-center`} onClick={() => sort.toggle("tempoFrete")}>
                  <span className="inline-flex items-center justify-center gap-1">TEMPO FRETE<ArrowUpDown className={`h-3 w-3 ${sort.key === "tempoFrete" ? "opacity-100" : "opacity-50"}`} /></span>
                </TableHead>
                <TableHead className={`${TH_CLASS} whitespace-nowrap`}>FORMA PGTO</TableHead>
                <TableHead className={TH_CLASS}>NF</TableHead>
                <TableHead className={`${TH_CLASS} cursor-pointer select-none whitespace-nowrap`} onClick={() => sort.toggle("entrada")}>
                  <span className="inline-flex items-center gap-1">ENTRADA<ArrowUpDown className={`h-3 w-3 ${sort.key === "entrada" ? "opacity-100" : "opacity-50"}`} /></span>
                </TableHead>
                <TableHead className={`${TH_CLASS} cursor-pointer select-none whitespace-nowrap`} onClick={() => sort.toggle("saida")}>
                  <span className="inline-flex items-center gap-1">SAÍDA JUFF<ArrowUpDown className={`h-3 w-3 ${sort.key === "saida" ? "opacity-100" : "opacity-50"}`} /></span>
                </TableHead>
                <TableHead className={`${TH_CLASS} cursor-pointer select-none whitespace-nowrap`} onClick={() => sort.toggle("entrega")}>
                  <span className="inline-flex items-center gap-1">ENTREGA<ArrowUpDown className={`h-3 w-3 ${sort.key === "entrega" ? "opacity-100" : "opacity-50"}`} /></span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={15} className="text-center py-8 text-muted-foreground">Nenhum pedido ativo.</TableCell></TableRow>
              ) : rows.map((p) => {
                const etapa = _calcEtapa(p).etapa;
                const isSelected = selectedId === p.id;
                let bg = "";
                if (p.embalado !== "Sim" && p.saida_juff) {
                  const dias = diasUteisAteHoje(p.saida_juff, feriados);
                  if (dias !== null) {
                    if (dias <= 0) bg = "bg-red-50 hover:bg-red-100/80";
                    else if (dias === 1) bg = "bg-yellow-50 hover:bg-yellow-100/80";
                  }
                }
                return (
                  <TableRow
                    key={p.id}
                    onClick={() => onSelect(p.id)}
                    className={`cursor-pointer select-none transition-colors ${bg} ${isSelected ? "outline outline-2 -outline-offset-2 outline-primary/60" : ""}`}
                  >
                    <TableCell className={TD_CLASS}><EtapaBadgeView etapa={etapa} className={BADGE_SM_CLASS} /></TableCell>
                    <TableCell className={`${TD_CLASS} font-medium`}>{p.pedido_olist}</TableCell>
                    <TableCell className={`${TD_CLASS} max-w-[200px] !text-left`}>
                      <span className="block leading-tight line-clamp-2 break-words text-left" title={p.orcamento ?? ""}>{p.orcamento}</span>
                    </TableCell>
                    <TableCell className={TD_CLASS}>{p.vendedor}</TableCell>
                    <TableCell className={`${TD_CLASS} tabular-nums`}><QtdTotal pedido={p} /></TableCell>
                    <TableCell className={TD_CLASS}><Badge variant="outline" className={BADGE_SM_CLASS}>{p.tipo_estampa}</Badge></TableCell>
                    <TableCell className={TD_CLASS}><StatusPecasBadge pedido={p} /></TableCell>
                    <TableCell className={TD_CLASS}>{p.frete ?? "—"}</TableCell>
                    <TableCell className={TD_CLASS}>{p.uf_entrega ?? "—"}</TableCell>
                    <TableCell className={`${TD_CLASS} tabular-nums text-center`}>{p.tempo_frete ?? "—"}</TableCell>
                    <TableCell className={TD_CLASS}>{p.forma_pagamento ?? "—"}</TableCell>
                    <TableCell className={TD_CLASS}>{p.nf_emitida ?? "—"}</TableCell>
                    <TableCell className={`${TD_CLASS} whitespace-nowrap`}>{formatDateBR(p.entrada_pedido) || "—"}</TableCell>
                    <TableCell className={`${TD_CLASS} whitespace-nowrap`}>{formatDateBR(p.saida_juff) || "—"}</TableCell>
                    <TableCell className={`${TD_CLASS} whitespace-nowrap`}>{formatDateBR(p.data_entrega) || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function PedidoStatusInline({ pedido }: { pedido: Pedido }) {
  const { etapa, cor } = calcularEtapaAtual(pedido);
  const aguardando = cor === "yellow" || cor === "blue" || cor === "gray";
  const finalizado = !!pedido.finalizado_em;
  const incompleto = !!pedido.arte_data && pedido.status_pecas !== "completo";
  const bg = finalizado
    ? "bg-success/10 border-success/30 text-success"
    : aguardando
    ? "bg-warning/15 border-warning/30 text-warning-foreground"
    : "bg-info/10 border-info/30 text-info";
  const label = finalizado
    ? "Pedido finalizado"
    : aguardando
    ? `Aguardando etapa: ${etapa}`
    : `Etapa atual: ${etapa}`;
  return (
    <div className="space-y-1">
      {incompleto && (
        <div className="flex items-center gap-2 p-3 rounded-md border text-sm bg-destructive/10 border-destructive/40 text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-semibold">Pedido Incompleto</span>
          <span className="text-xs opacity-80">— Status de Peças ainda está "incompleto".</span>
        </div>
      )}
      <div className={`flex items-center gap-2 p-3 rounded-md border text-sm ${bg}`}>
        <span className="font-medium">{label}</span>
      </div>
    </div>
  );
}

function Field({ label, invalid, children }: { label: string; invalid?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1 ${invalid ? "rounded-md ring-2 ring-destructive/60 p-1 -m-1" : ""}`}>
      <Label className={`text-xs font-medium ${invalid ? "text-destructive" : ""}`}>{label}{invalid ? " — obrigatório" : ""}</Label>
      {children}
    </div>
  );
}

/** Bloco 4: campo Data de Entrega com fluxo de "Solicitar alteração" quando produção já tem input. */
function DataEntregaField({
  form, selected, invalid, onChangeDataEntrega, onPropostaSaved,
}: {
  form: Partial<Pedido>;
  selected: Pedido | null;
  invalid?: boolean;
  onChangeDataEntrega: (v: string | null) => void;
  onPropostaSaved: (v: string) => void;
}) {
  const [solicitando, setSolicitando] = useState(false);
  const [novaData, setNovaData] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const producaoPreenchida = !!selected?.arte_data || !!selected?.inicio_acabamento || !!selected?.termino_acabamento;
  const temDataEntrega = !!selected?.data_entrega;
  const exigeSolicitacao = !!selected?.id && producaoPreenchida && temDataEntrega;

  if (!exigeSolicitacao) {
    return (
      <Field label="Data de Entrega *" invalid={invalid}>
        <DateInputBR value={form.data_entrega} onChange={onChangeDataEntrega} />
      </Field>
    );
  }


  async function salvarSolicitacao() {
    if (!selected || !novaData) {
      toast.error("Informe a nova data proposta.");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("pedidos")
        .update({
          data_entrega_proposta: novaData,
          data_entrega_proposta_em: new Date().toISOString(),
          data_entrega_proposta_por: userData.user?.id ?? null,
        } as any)
        .eq("id", selected.id);
      if (error) throw error;
      onPropostaSaved(novaData);
      toast.success("Solicitação enviada para a produção.");
      setSolicitando(false);
      setNovaData(null);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar solicitação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Field label="Data de Entrega">
      <div className="space-y-2">
        <div className="px-3 py-2 rounded-md bg-muted/50 border text-sm font-medium">
          {formatDateBR(selected?.data_entrega) || "—"}
        </div>
        {selected?.data_entrega_proposta && !solicitando && (
          <div className="text-xs text-amber-700 dark:text-amber-300">
            Já existe uma solicitação pendente para {formatDateBR(selected.data_entrega_proposta)}.
          </div>
        )}
        {!solicitando ? (
          <Button type="button" variant="outline" size="sm" className="whitespace-normal h-auto w-full text-center" onClick={() => { setSolicitando(true); setNovaData(selected?.data_entrega_proposta ?? null); }}>
            <AlertTriangle className="h-3.5 w-3.5 mr-1 shrink-0" />
            Solicitar Alteração de Data de Entrega
          </Button>
        ) : (
          <div className="space-y-2 p-2 rounded-md border border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
            <Label className="text-xs">Nova data proposta</Label>
            <DateInputBR value={novaData} onChange={(v) => setNovaData(v ?? null)} />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={salvarSolicitacao} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1" /> Salvar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setSolicitando(false); setNovaData(null); }}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

/** Bloco 4: alerta na produção com botão Aprovar. */
function PropostaDataAlerta({
  pedidoId, dataAtual, dataProposta, onAprovar,
}: {
  pedidoId: string;
  dataAtual: string | null;
  dataProposta: string;
  onAprovar: (novaData: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-md border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20 text-sm">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
      <div className="flex-1">
        <div className="font-semibold text-amber-800 dark:text-amber-200">
          Solicitação de alteração de data de entrega para {formatDateBR(dataProposta)}
        </div>
        <div className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
          Data atual: {formatDateBR(dataAtual) || "—"}
        </div>
      </div>
      <Button type="button" size="sm" onClick={() => onAprovar(dataProposta)}>
        Aprovar
      </Button>
    </div>
  );
}

function cmpPedido(a: Pedido, b: Pedido, dir: "asc" | "desc") {
  const na = Number(a.pedido_olist);
  const nb = Number(b.pedido_olist);
  const aBad = !Number.isFinite(na);
  const bBad = !Number.isFinite(nb);
  if (aBad && bBad) return 0;
  if (aBad) return 1;
  if (bBad) return -1;
  return dir === "asc" ? na - nb : nb - na;
}
