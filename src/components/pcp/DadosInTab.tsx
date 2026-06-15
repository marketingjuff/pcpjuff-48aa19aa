import { pedidoAtivoNasAreas, sortByDataSaidaJuffAsc } from "@/lib/pedidos";
import { useEffect, useMemo, useState } from "react";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Save, X, FileText, Download, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDiasUteis, diasUteisEntre } from "@/lib/dias-uteis";
import { useFeriados } from "@/hooks/use-feriados";
import { formatDateBR } from "@/lib/format";
import { EtapaBadgeFromPedido, PedidoMobileCard, Chip, StatusPecasBadge, StatusPecasChip } from "./shared";
import { useDirtyTracker, useRegisterSave, useDirtyForm } from "./dirty-form-context";

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
  const [uploading, setUploading] = useState(false);
  const { feriados } = useFeriados();
  const { isDirty } = useDirtyForm();
  const { names: vendedores } = useAppList("vendedor");
  const { names: fretes } = useAppList("frete");
  const { names: formasPagamento } = useAppList("pagamento");
  const { names: nfOpcoes } = useAppList("nf");

  useEffect(() => {
    if (!isDirty) setForm(selected ?? empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  useDirtyTracker(form, selected ?? empty, active);

  function set<K extends keyof Pedido>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

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

  // Cálculos automáticos — regras v2:
  // Frete: reservar tempo_frete dias úteis VAZIOS — a data de entrega NÃO conta.
  //   => Saída Juff = (dia útil anterior à entrega) menos (tempo_frete-1) dias úteis.
  // Produção: dia da Saída Juff NÃO conta como dia útil disponível.
  //   => tempo_producao = dias úteis entre entrada e o dia útil anterior à saída.
  const tempoFreteNum = Number(form.tempo_frete ?? 0) || 0;
  const saidaJuffCalc = useMemo(() => {
    if (!form.data_entrega || !tempoFreteNum) return null;
    // Recua 1 dia útil para "não contar" a data de entrega, depois os demais dias de frete.
    return addDiasUteis(form.data_entrega, -tempoFreteNum, feriados);
  }, [form.data_entrega, tempoFreteNum, feriados]);
  const tempoProducaoCalc = useMemo(() => {
    if (!form.entrada_pedido || !saidaJuffCalc) return null;
    // "Dia da saída não conta" — diasUteisEntre é exclusivo do início e inclusivo do fim,
    // então recuamos 1 dia útil para excluir o próprio dia da saída.
    const ultimoDiaProducao = addDiasUteis(saidaJuffCalc, -1, feriados);
    return diasUteisEntre(form.entrada_pedido, ultimoDiaProducao, feriados);
  }, [form.entrada_pedido, saidaJuffCalc, feriados]);

  const VENDOR_REQUIRED: (keyof Pedido)[] = ["pedido_olist", "orcamento", "qtd", "vendedor", "entrada_pedido"];
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
    onSave({
      ...form,
      saida_juff: saidaJuffCalc ?? form.saida_juff ?? null,
      tempo_producao: tempoProducaoCalc ?? form.tempo_producao ?? null,
    });
  }
  async function saveProducao() {
    const missP = findMissing(PROD_REQUIRED);
    setMissingProd(missP);
    if (missP.size > 0) {
      toast.error("Preencha os campos obrigatórios do Input de Produção.");
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
    onSave({
      ...form,
      saida_juff: saidaJuffCalc ?? form.saida_juff ?? null,
      tempo_producao: tempoProducaoCalc ?? form.tempo_producao ?? null,
    });
  }
  useRegisterSave(saveVendor, active);

  function handleNew() { onSelect(null); setForm(empty); }

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

  return (
    <div className="space-y-3">
      <Card className="border-primary/30">
        <CardContent className="py-2 flex items-center justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Orçamento Comercial</div>
            <div className="text-2xl sm:text-4xl font-bold tabular-nums truncate">{form.orcamento || "—"}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>
            {selected && (
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Vendedor */}
        <Card className="border-l-4 border-l-green-500 bg-green-50/40 dark:bg-green-950/10">
          <CardHeader className="py-3"><CardTitle className="text-base text-green-700 dark:text-green-400">Input do Vendedor</CardTitle></CardHeader>
          <CardContent className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            <Field label="Pedido Olist *" invalid={missingVendor.has("pedido_olist")}><Input value={form.pedido_olist ?? ""} onChange={(e) => set("pedido_olist", e.target.value)} /></Field>
            <Field label="Orçamento Comercial *" invalid={missingVendor.has("orcamento")}><Input value={form.orcamento ?? ""} onChange={(e) => set("orcamento", e.target.value)} /></Field>
            <Field label="Quantas peças *" invalid={missingVendor.has("qtd")}><Input value={form.qtd ?? ""} onChange={(e) => set("qtd", e.target.value)} /></Field>
            <Field label="Vendedor *" invalid={missingVendor.has("vendedor")}>
              <Select value={form.vendedor ?? ""} onValueChange={(v) => set("vendedor", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{vendedores.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Forma de pagamento">
              <Select value={form.forma_pagamento ?? ""} onValueChange={(v) => set("forma_pagamento", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{formasPagamento.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Nota Fiscal">
              <Select value={form.nf_emitida ?? ""} onValueChange={(v) => set("nf_emitida", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{nfOpcoes.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Frete">
              <Select value={form.frete ?? ""} onValueChange={(v) => set("frete", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{fretes.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Tempo de frete (dias úteis)"><Input type="number" min="0" value={form.tempo_frete ?? ""} onChange={(e) => set("tempo_frete", e.target.value)} /></Field>
            <Field label="UF de Entrega">
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
              onChangeDataEntrega={(v) => set("data_entrega", v)}
              onPropostaSaved={(v) => {
                set("data_entrega_proposta", v);
              }}
            />
            <Field label="É necessário vetorização?">
              <Select value={form.necessita_vetorizacao ? "Sim" : "Não"} onValueChange={(v) => set("necessita_vetorizacao", v === "Sim")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SIM_NAO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Layout (PDF até 30MB)">
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
            <div className="sm:col-span-2">
              <Field label="Observações do vendedor">
                <Textarea rows={2} value={form.obs_vendedor ?? ""} onChange={(e) => set("obs_vendedor", e.target.value)} />
              </Field>
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="button" onClick={saveVendor} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />{selected?.id ? "Atualizar" : "Salvar"} Input do Vendedor
              </Button>
              {selected && (
                <Button type="button" variant="outline" onClick={handleNew}><X className="h-4 w-4 mr-1" />Cancelar edição</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Produção */}
        <Card className="border-l-4 border-l-blue-500 bg-blue-50/40 dark:bg-blue-950/10">
          <CardHeader className="py-3"><CardTitle className="text-base text-blue-700 dark:text-blue-400">Input de Produção</CardTitle></CardHeader>
          <CardContent className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            <Field label="Status de Peças *" invalid={missingProd.has("status_pecas")}>
              <Select value={form.status_pecas ?? ""} onValueChange={(v) => set("status_pecas", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{STATUS_PECAS_OPCOES.map((v) => <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Tipo de Estampa *" invalid={missingProd.has("tipo_estampa")}>
              <Select value={form.tipo_estampa ?? ""} onValueChange={setTipoEstampa}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{TIPOS_ESTAMPA.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Arte (limite)"><DateInputBR value={form.arte_data} onChange={(v) => set("arte_data", v)} /></Field>
            <Field label="Início Estamparia"><DateInputBR value={form.inicio_estamparia} onChange={(v) => set("inicio_estamparia", v)} /></Field>
            <Field label="Término Estamparia"><DateInputBR value={form.termino_estamparia} onChange={(v) => set("termino_estamparia", v)} /></Field>
            <Field label="Acabamento"><DateInputBR value={form.acabamento_data} onChange={(v) => set("acabamento_data", v)} /></Field>
            <Field label="Saída Juff (calculado)">
              <div className="px-3 py-2 rounded-md bg-muted/50 border text-sm font-medium">{saidaJuffCalc ? formatDateBR(saidaJuffCalc) : "—"}</div>
            </Field>
            <Field label="Tempo de produção (dias úteis)">
              <div className="px-3 py-2 rounded-md bg-muted/50 border text-sm font-medium">{tempoProducaoCalc ?? "—"}</div>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Observações de produção">
                <Textarea rows={2} value={form.observacoes_pedido ?? ""} onChange={(e) => set("observacoes_pedido", e.target.value)} />
              </Field>
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="button" onClick={saveProducao} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />{selected?.id ? "Atualizar" : "Salvar"} Input de Produção
              </Button>
            </div>
            {selected?.data_entrega_proposta && (
              <div className="sm:col-span-2">
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

      <Card>
        <CardHeader><CardTitle className="text-base">Dashboard — Dados In</CardTitle></CardHeader>
        <CardContent className="p-0">
          {/* Mobile cards */}
          <div className="md:hidden divide-y">
            {(() => {
              const visiveis = sortByDataSaidaJuffAsc(pedidos.filter((p) => pedidoAtivoNasAreas(p)));
              if (visiveis.length === 0) return <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido ativo.</div>;
              return visiveis.map((p) => (
                <PedidoMobileCard key={p.id} pedido={p} active={selected?.id === p.id} onClick={() => onSelect(p.id)}>
                  <Chip label="QTD" value={p.qtd} />
                  <Chip label="Vend" value={p.vendedor} />
                  <Chip label="Tipo" value={p.tipo_estampa} />
                  <Chip label="Pgto" value={p.forma_pagamento} />
                  <Chip label="NF" value={p.nf_emitida ?? "—"} />
                  <StatusPecasChip pedido={p} />
                  <Chip label="Entrega" value={formatDateBR(p.data_entrega) || "—"} />
                </PedidoMobileCard>
              ));
            })()}
          </div>
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                {["Etapa","Pedido","Orçamento","QTD","Vendedor","Forma Pgto","NF","Frete","Tempo Frete","Status de Peças","Estampa","Entrada","Saída Juff","Data Entrega"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortByDataSaidaJuffAsc(pedidos.filter((p) => pedidoAtivoNasAreas(p))).map((p) => (
                <tr key={p.id}
                  onClick={() => onSelect(p.id)}
                  className={`border-t cursor-pointer hover:bg-accent ${selected?.id === p.id ? "bg-accent" : ""}`}>
                  <td className="px-3 py-2"><EtapaBadgeFromPedido pedido={p} /></td>
                  <td className="px-3 py-2 font-medium">{p.pedido_olist}</td>
                  <td className="px-3 py-2">{p.orcamento}</td>
                  <td className="px-3 py-2">{p.qtd}</td>
                  <td className="px-3 py-2">{p.vendedor}</td>
                  <td className="px-3 py-2">{p.forma_pagamento ?? "—"}</td>
                  <td className="px-3 py-2">{p.nf_emitida ?? "—"}</td>
                  <td className="px-3 py-2">{p.frete ?? "—"}</td>
                  <td className="px-3 py-2">{p.tempo_frete ?? "—"}</td>
                  <td className="px-3 py-2"><StatusPecasBadge pedido={p} /></td>
                  <td className="px-3 py-2"><Badge variant="outline">{p.tipo_estampa}</Badge></td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.entrada_pedido)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.saida_juff)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.data_entrega)}</td>
                </tr>
              ))}
              {sortByDataSaidaJuffAsc(pedidos.filter((p) => pedidoAtivoNasAreas(p))).length === 0 && (
                <tr><td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido ativo.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
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
    <div className={`space-y-1.5 ${invalid ? "rounded-md ring-2 ring-destructive/60 p-1 -m-1" : ""}`}>
      <Label className={`text-xs font-medium ${invalid ? "text-destructive" : ""}`}>{label}{invalid ? " — obrigatório" : ""}</Label>
      {children}
    </div>
  );
}

/** Bloco 4: campo Data de Entrega com fluxo de "Solicitar alteração" quando produção já tem input. */
function DataEntregaField({
  form, selected, onChangeDataEntrega, onPropostaSaved,
}: {
  form: Partial<Pedido>;
  selected: Pedido | null;
  onChangeDataEntrega: (v: string | null) => void;
  onPropostaSaved: (v: string) => void;
}) {
  const [solicitando, setSolicitando] = useState(false);
  const [novaData, setNovaData] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const producaoPreenchida = !!selected?.arte_data;
  const temDataEntrega = !!selected?.data_entrega;
  const exigeSolicitacao = !!selected?.id && producaoPreenchida && temDataEntrega;

  if (!exigeSolicitacao) {
    return (
      <Field label="Data de Entrega">
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
          <Button type="button" variant="outline" size="sm" onClick={() => { setSolicitando(true); setNovaData(selected?.data_entrega_proposta ?? null); }}>
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
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
