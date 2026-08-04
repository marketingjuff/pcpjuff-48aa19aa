import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileDown, Plus, Trash2 } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-role";
import { Combobox } from "@/components/shared/combobox";
import { useSupFornecedores } from "@/components/sup/FornecedoresTab";
import { useSupFornecedorProdutos, useSupProdutos } from "@/components/sup/ProdutosTab";
import { abrirPdfPedidoCompra } from "@/lib/sup-pc-pdf";
import {
  SUP_CONDICOES_PAGAMENTO, SUP_EMPRESAS, SUP_EMPRESA_LABEL, SUP_FLUXO,
  SUP_STATUS_CLASSE, SUP_STATUS_LABEL, addDias, calcTotaisPedido, economiaItem, fmtMoeda, n,
  statusPorRecebimento, type SupComissionado, type SupConfig, type SupPedidoCompra,
  type SupPedidoItem, type SupStatusPc,
} from "@/lib/sup";


type ItemLinha = {
  id?: string;
  produto_id: string;
  quantidade: number;
  unidade: string;
  preco_tabela: number;
  preco_negociado: number;
  preco_historico_id: string | null;
  quantidade_recebida: number;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pedidoId: string | null;
}

const hoje = () => new Date().toISOString().slice(0, 10);

export function PedidoCompraDialog({ open, onOpenChange, pedidoId }: Props) {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const { data: fornecedores = [] } = useSupFornecedores();
  const { data: produtos = [] } = useSupProdutos();
  const { data: vinculos = [] } = useSupFornecedorProdutos();

  const { data: config } = useQuery({
    queryKey: ["sup-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sup_config").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return (data ?? null) as SupConfig | null;
    },
  });

  const { data: comissionados = [] } = useQuery({
    queryKey: ["sup-comissionados"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sup_comissionados").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as SupComissionado[];
    },
  });

  const { data: carregado } = useQuery({
    queryKey: ["sup-pedido", pedidoId],
    enabled: open && !!pedidoId,
    queryFn: async () => {
      const [{ data: p, error: e1 }, { data: its, error: e2 }] = await Promise.all([
        (supabase as any).from("sup_pedidos_compra").select("*").eq("id", pedidoId).single(),
        (supabase as any).from("sup_pedido_itens").select("*").eq("pedido_id", pedidoId).order("ordem"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { pedido: p as SupPedidoCompra, itens: (its ?? []) as SupPedidoItem[] };
    },
  });

  const [head, setHead] = useState<Partial<SupPedidoCompra>>({});
  const [trocaFornecedor, setTrocaFornecedor] = useState<string | null>(null);

  const [linhas, setLinhas] = useState<ItemLinha[]>([]);
  const [removidos, setRemovidos] = useState<string[]>([]);
  const [motivoCancelar, setMotivoCancelar] = useState("");

  useEffect(() => {
    if (!open) return;
    if (pedidoId) {
      if (!carregado) return;
      setHead({ ...carregado.pedido });
      setLinhas(carregado.itens.map((i) => ({
        id: i.id,
        produto_id: i.produto_id,
        quantidade: n(i.quantidade),
        unidade: i.unidade,
        preco_tabela: n(i.preco_tabela),
        preco_negociado: n(i.preco_negociado),
        preco_historico_id: i.preco_historico_id,
        quantidade_recebida: n(i.quantidade_recebida),
      })));
    } else {
      setHead({
        empresa: "juff",
        data_pedido: hoje(),
        status: "rascunho",
        frete_valor: 0,
        desconto_global_tipo: "valor",
        desconto_global_valor: 0,
        comissao_percentual: config?.percentual_padrao ?? 0,
      });
      setLinhas([]);
    }
    setRemovidos([]);
    setMotivoCancelar("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pedidoId, carregado, config?.percentual_padrao]);

  const status = (head.status ?? "rascunho") as SupStatusPc;
  const cancelado = status === "cancelado";
  const bloqueado = cancelado || status === "pago";
  const totais = calcTotaisPedido(linhas, {
    desconto_global_tipo: head.desconto_global_tipo ?? null,
    desconto_global_valor: head.desconto_global_valor,
    frete_valor: head.frete_valor,
    comissao_percentual: head.comissao_percentual,
  });

  const produtosDoFornecedor = useMemo(() => {
    if (!head.fornecedor_id) return [];
    return produtos
      .filter((p) => p.fornecedor_id === head.fornecedor_id && p.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [produtos, head.fornecedor_id]);


  const fornecedorSel = useMemo(
    () => fornecedores.find((f) => f.id === head.fornecedor_id) ?? null,
    [fornecedores, head.fornecedor_id],
  );

  function set<K extends keyof SupPedidoCompra>(k: K, v: SupPedidoCompra[K]) {
    setHead((h) => ({ ...h, [k]: v }));
  }

  /** Preenche padrões do cadastro do fornecedor. Só na ação de escolher/trocar. */
  function aplicarPadroesFornecedor(fornecedor_id: string) {
    const f = fornecedores.find((x) => x.id === fornecedor_id);
    if (!f) return;
    setHead((h) => {
      const patch: Partial<SupPedidoCompra> = {};
      if (f.condicao_pagamento_padrao) patch.condicao_pagamento = f.condicao_pagamento_padrao;
      if (f.prazo_entrega_padrao_dias != null && h.data_pedido) {
        patch.previsao_entrega = addDias(h.data_pedido, f.prazo_entrega_padrao_dias);
      }
      return { ...h, ...patch };
    });
  }

  function pedirTrocaFornecedor(v: string) {
    if (v === head.fornecedor_id) return;
    if (linhas.some((l) => l.produto_id)) {
      setTrocaFornecedor(v);
      return;
    }
    set("fornecedor_id", v);
    aplicarPadroesFornecedor(v);
  }

  function confirmarTrocaFornecedor() {
    if (!trocaFornecedor) return;
    set("fornecedor_id", trocaFornecedor);
    aplicarPadroesFornecedor(trocaFornecedor);
    setLinhas([{
      produto_id: "", quantidade: 1, unidade: "unidade",
      preco_tabela: 0, preco_negociado: 0, preco_historico_id: null, quantidade_recebida: 0,
    }]);
    setTrocaFornecedor(null);
  }



  async function precoTabelaAtual(produto_id: string): Promise<{ preco: number; unidade: string; hist: string | null }> {
    const prod = produtos.find((p) => p.id === produto_id);
    const vinc = vinculos.find((v) => v.produto_id === produto_id && v.fornecedor_id === head.fornecedor_id);
    let hist: string | null = null;
    if (vinc) {
      const { data } = await (supabase as any)
        .from("sup_preco_historico")
        .select("id")
        .eq("fornecedor_produto_id", vinc.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      hist = (data?.id as string | undefined) ?? null;
    }
    const preco = vinc?.preco_tabela != null ? n(vinc.preco_tabela) : n((prod as any)?.preco_referencia);
    return { preco, unidade: prod?.unidade ?? "unidade", hist };

  }

  function addLinha() {
    setLinhas((l) => [...l, {
      produto_id: "", quantidade: 1, unidade: "unidade",
      preco_tabela: 0, preco_negociado: 0, preco_historico_id: null, quantidade_recebida: 0,
    }]);
  }

  async function trocarProduto(idx: number, produto_id: string) {
    const { preco, unidade, hist } = await precoTabelaAtual(produto_id);
    setLinhas((l) => l.map((it, i) => i === idx
      ? { ...it, produto_id, unidade, preco_tabela: preco, preco_negociado: preco, preco_historico_id: hist }
      : it));
  }

  function setLinha(idx: number, patch: Partial<ItemLinha>) {
    setLinhas((l) => l.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removerLinha(idx: number) {
    setLinhas((l) => {
      const alvo = l[idx];
      if (alvo?.id) setRemovidos((r) => [...r, alvo.id!]);
      return l.filter((_, i) => i !== idx);
    });
  }

  const salvar = useMutation({
    mutationFn: async (opts: { novoStatus?: SupStatusPc } = {}) => {
      if (!head.fornecedor_id) throw new Error("Selecione o fornecedor.");
      if (!head.data_pedido) throw new Error("Informe a data do pedido.");
      if (linhas.some((l) => !l.produto_id)) throw new Error("Há item sem produto selecionado.");
      if (linhas.some((l) => n(l.quantidade) <= 0)) throw new Error("Quantidade deve ser maior que zero.");
      if (head.condicao_pagamento === "Outros" && !head.condicao_pagamento_outros?.trim()) {
        throw new Error("Descreva a condição de pagamento em 'Outros'.");
      }

      const derivado = statusPorRecebimento(linhas, status);
      let statusFinal: string = opts.novoStatus ?? head.status ?? "rascunho";
      if (!opts.novoStatus && statusFinal !== "rascunho" && statusFinal !== "enviado" && statusFinal !== "pago" && statusFinal !== "cancelado") {
        statusFinal = derivado.status;
      }
      if (linhas.length === 0 && statusFinal !== "rascunho" && statusFinal !== "cancelado") {
        throw new Error("Inclua ao menos um item para avançar o pedido.");
      }

      let numero = head.numero ?? null;
      if (!numero && statusFinal !== "rascunho") {
        const { data, error } = await (supabase as any).rpc("sup_proximo_numero_pc", { p_data: head.data_pedido });
        if (error) throw error;
        numero = data as string;
      }

      const recebidoTotal = statusPorRecebimento(linhas, statusFinal).recebido_total;
      const { data: u } = await supabase.auth.getUser();
      const payload: Record<string, unknown> = {
        numero,
        empresa: head.empresa ?? "juff",
        fornecedor_id: head.fornecedor_id,
        data_pedido: head.data_pedido,
        responsavel_id: head.responsavel_id ?? u.user?.id ?? null,
        comissionado_id: head.comissionado_id ?? null,
        comissao_percentual: head.comissao_percentual ?? config?.percentual_padrao ?? 0,
        status: statusFinal,
        condicao_pagamento: head.condicao_pagamento ?? null,
        condicao_pagamento_outros: head.condicao_pagamento === "Outros" ? (head.condicao_pagamento_outros ?? null) : null,
        previsao_entrega: head.previsao_entrega || null,
        data_recebimento_total: recebidoTotal ? (head.data_recebimento_total || hoje()) : null,
        data_pagamento: statusFinal === "pago" ? (head.data_pagamento || hoje()) : (head.data_pagamento || null),
        frete_valor: n(head.frete_valor),
        desconto_global_tipo: head.desconto_global_tipo ?? "valor",
        desconto_global_valor: n(head.desconto_global_valor),
        
        observacoes: head.observacoes || null,
      };

      let id = pedidoId;
      if (id) {
        const { error } = await (supabase as any).from("sup_pedidos_compra").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("sup_pedidos_compra")
          .insert({ ...payload, created_by: u.user?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id as string;
      }

      if (removidos.length > 0) {
        const { error } = await (supabase as any).from("sup_pedido_itens").delete().in("id", removidos);
        if (error) throw error;
      }

      for (let i = 0; i < linhas.length; i++) {
        const l = linhas[i];
        const item = {
          pedido_id: id,
          produto_id: l.produto_id,
          quantidade: n(l.quantidade),
          unidade: l.unidade,
          preco_tabela: n(l.preco_tabela),
          preco_negociado: n(l.preco_negociado),
          preco_historico_id: l.preco_historico_id,
          quantidade_recebida: n(l.quantidade_recebida),
          ordem: i,
        };
        if (l.id) {
          const { error } = await (supabase as any).from("sup_pedido_itens").update(item).eq("id", l.id);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any).from("sup_pedido_itens").insert(item);
          if (error) throw error;
        }
      }
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-pedidos"] });
      qc.invalidateQueries({ queryKey: ["sup-pedido-itens"] });
      qc.invalidateQueries({ queryKey: ["sup-pedido", pedidoId] });
      toast.success("Pedido salvo.");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar pedido."),
  });

  const cancelar = useMutation({
    mutationFn: async () => {
      if (!pedidoId) throw new Error("Salve o pedido antes de cancelar.");
      if (!motivoCancelar.trim()) throw new Error("Informe o motivo do cancelamento.");
      const { error } = await (supabase as any)
        .from("sup_pedidos_compra")
        .update({
          status: "cancelado",
          status_pre_cancelamento: (head.status ?? "rascunho") as string,
          cancelado_em: new Date().toISOString(),
          cancelado_motivo: motivoCancelar.trim(),
        })

        .eq("id", pedidoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-pedidos"] });
      qc.invalidateQueries({ queryKey: ["sup-pedido", pedidoId] });
      toast.success("Pedido cancelado.");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao cancelar."),
  });

  const reabrir = useMutation({
    mutationFn: async () => {
      if (!pedidoId) throw new Error("Pedido não encontrado.");
      const novo = (head.status_pre_cancelamento ?? "rascunho") as string;
      const { error } = await (supabase as any)
        .from("sup_pedidos_compra")
        .update({ status: novo, cancelado_em: null, cancelado_motivo: null, status_pre_cancelamento: null })
        .eq("id", pedidoId);
      if (error) throw error;
      return novo;
    },
    onSuccess: (novo) => {
      setHead((h) => ({ ...h, status: novo, cancelado_em: null, cancelado_motivo: null, status_pre_cancelamento: null }));
      qc.invalidateQueries({ queryKey: ["sup-pedidos"] });
      qc.invalidateQueries({ queryKey: ["sup-pedido", pedidoId] });
      toast.success("Pedido reaberto.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao reabrir pedido."),
  });

  const desfazerEnvio = useMutation({
    mutationFn: async () => {
      if (!pedidoId) throw new Error("Pedido não encontrado.");
      const { error } = await (supabase as any)
        .from("sup_pedidos_compra")
        .update({ status: "rascunho" })
        .eq("id", pedidoId);
      if (error) throw error;
    },
    onSuccess: () => {
      setHead((h) => ({ ...h, status: "rascunho" }));
      qc.invalidateQueries({ queryKey: ["sup-pedidos"] });
      qc.invalidateQueries({ queryKey: ["sup-pedido", pedidoId] });
      toast.success("Envio desfeito. O pedido voltou para rascunho.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao desfazer envio."),
  });


  function gerarPdf() {
    const fornecedor = fornecedores.find((f) => f.id === head.fornecedor_id) ?? null;
    abrirPdfPedidoCompra({
      pedido: { ...(head as SupPedidoCompra) },
      fornecedor,
      itens: linhas.map((l, i) => ({
        id: l.id ?? `tmp-${i}`,
        pedido_id: pedidoId ?? "",
        produto_id: l.produto_id,
        quantidade: n(l.quantidade),
        unidade: l.unidade,
        preco_tabela: n(l.preco_tabela),
        preco_negociado: n(l.preco_negociado),
        preco_historico_id: l.preco_historico_id,
        quantidade_recebida: n(l.quantidade_recebida),
        ordem: i,
      })),
      produtos,
    });
  }

  const proximos = SUP_FLUXO[status] ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1180px] max-h-[92vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {pedidoId ? `Pedido de Compra ${head.numero ?? "(rascunho)"}` : "Novo Pedido de Compra"}
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${SUP_STATUS_CLASSE[status] ?? "bg-muted"}`}>
              {SUP_STATUS_LABEL[status] ?? status}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Empresa *</Label>
            <Select value={head.empresa ?? "juff"} onValueChange={(v) => set("empresa", v)} disabled={bloqueado}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{SUP_EMPRESAS.map((e) => <SelectItem key={e} value={e}>{SUP_EMPRESA_LABEL[e]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Fornecedor *</Label>
            <Combobox
              value={head.fornecedor_id ?? ""}
              onChange={pedirTrocaFornecedor}
              disabled={bloqueado}
              placeholder="Selecione"
              searchPlaceholder="Buscar fornecedor…"
              options={fornecedores
                .filter((f) => f.ativo || f.id === head.fornecedor_id)
                .map((f) => ({ value: f.id, label: f.razao_social, hint: f.nome_fantasia ?? undefined }))}
            />
          </div>


          <div>
            <Label className="text-xs">Data do pedido *</Label>
            <Input type="date" value={head.data_pedido ?? ""} onChange={(e) => set("data_pedido", e.target.value)} className="h-9" disabled={bloqueado} />
          </div>
          <div>
            <Label className="text-xs">Condição de pagamento</Label>
            <Select value={head.condicao_pagamento ?? ""} onValueChange={(v) => set("condicao_pagamento", v)} disabled={bloqueado}>
              <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{SUP_CONDICOES_PAGAMENTO.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {head.condicao_pagamento === "Outros" && (
            <div>
              <Label className="text-xs">Qual condição? *</Label>
              <Input value={head.condicao_pagamento_outros ?? ""} onChange={(e) => set("condicao_pagamento_outros", e.target.value)} className="h-9" disabled={bloqueado} />
            </div>
          )}
          <div>
            <Label className="text-xs">Previsão de entrega</Label>
            <Input type="date" value={head.previsao_entrega ?? ""} onChange={(e) => set("previsao_entrega", e.target.value)} className="h-9" disabled={bloqueado} />
          </div>
          <div>

            <Label className="text-xs">Frete (R$)</Label>
            <Input type="number" step="0.01" min={0} value={head.frete_valor ?? 0}
              onChange={(e) => set("frete_valor", Number(e.target.value))} className="h-9" disabled={bloqueado} />
          </div>
          <div>
            <Label className="text-xs">Desconto global</Label>
            <div className="flex gap-1">
              <Select value={head.desconto_global_tipo ?? "valor"} onValueChange={(v) => set("desconto_global_tipo", v as "valor" | "percentual")} disabled={bloqueado}>
                <SelectTrigger className="h-9 w-[92px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="valor">R$</SelectItem>
                  <SelectItem value="percentual">%</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" step="0.01" min={0} value={head.desconto_global_valor ?? 0}
                onChange={(e) => set("desconto_global_valor", Number(e.target.value))} className="h-9" disabled={bloqueado} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Comissionado</Label>
            <Select
              value={head.comissionado_id ?? "nenhum"}
              onValueChange={(v) => {
                const c = comissionados.find((x) => x.id === v);
                setHead((h) => ({
                  ...h,
                  comissionado_id: v === "nenhum" ? null : v,
                  comissao_percentual: v === "nenhum" ? 0 : (c?.percentual ?? config?.percentual_padrao ?? 0),
                }));
              }}
              disabled={bloqueado}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Sem comissão</SelectItem>
                {comissionados.filter((c) => c.ativo || c.id === head.comissionado_id).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">% comissão</Label>
            <Input type="number" step="0.01" min={0} value={head.comissao_percentual ?? 0}
              onChange={(e) => set("comissao_percentual", Number(e.target.value))} className="h-9" disabled={bloqueado || !isAdmin} />
          </div>
        </div>

        <div className="rounded-md border overflow-hidden mt-1">
          <div className="px-3 py-2 bg-muted/40 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider">Itens</span>
            <Button size="sm" variant="outline" className="h-7" onClick={addLinha} disabled={bloqueado || !head.fornecedor_id}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
            </Button>
          </div>
          <table className="w-full text-[12.5px]">
            <thead className="bg-muted/20">
              <tr className="text-xs">
                <th className="p-1.5 text-left">Produto</th>
                <th className="p-1.5 text-center w-20">Qtd</th>
                <th className="p-1.5 text-center w-20">Un.</th>
                {isAdmin && <th className="p-1.5 text-right w-28">Preço tabela</th>}
                <th className="p-1.5 text-right w-28">Preço negociado</th>
                <th className="p-1.5 text-right w-28">Subtotal</th>
                {isAdmin && <th className="p-1.5 text-right w-28">Economia</th>}
                <th className="p-1.5 text-center w-24">Recebido</th>
                <th className="p-1.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr><td colSpan={9} className="p-3 text-center text-muted-foreground">Sem itens.</td></tr>
              ) : linhas.map((l, i) => (
                <tr key={l.id ?? `n-${i}`} className="border-t">
                  <td className="p-1.5">
                    <Select value={l.produto_id} onValueChange={(v) => void trocarProduto(i, v)} disabled={bloqueado || !head.fornecedor_id}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder={head.fornecedor_id ? "Selecione" : "Escolha o fornecedor primeiro"} />
                      </SelectTrigger>
                      <SelectContent>
                        {produtosDoFornecedor.length === 0 ? (
                          <SelectItem value="__sem__" disabled>
                            Este fornecedor não tem produtos cadastrados. Cadastre na aba Produtos.
                          </SelectItem>
                        ) : produtosDoFornecedor.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>

                  </td>
                  <td className="p-1.5">
                    <Input type="number" step="0.001" min={0} value={l.quantidade}
                      onChange={(e) => setLinha(i, { quantidade: Number(e.target.value) })} className="h-8 text-center" disabled={bloqueado} />
                  </td>
                  <td className="p-1.5 text-center">{l.unidade}</td>
                  {isAdmin && (
                    <td className="p-1.5">
                      <Input type="number" step="0.01" min={0} value={l.preco_tabela}
                        onChange={(e) => setLinha(i, { preco_tabela: Number(e.target.value) })} className="h-8 text-right" disabled={bloqueado} />
                    </td>
                  )}
                  <td className="p-1.5">
                    <Input type="number" step="0.01" min={0} value={l.preco_negociado}
                      onChange={(e) => setLinha(i, { preco_negociado: Number(e.target.value) })} className="h-8 text-right" disabled={bloqueado} />
                  </td>
                  <td className="p-1.5 text-right font-semibold tabular-nums">{fmtMoeda(n(l.preco_negociado) * n(l.quantidade))}</td>
                  {isAdmin && (
                    <td className="p-1.5 text-right font-semibold tabular-nums text-emerald-700">{fmtMoeda(economiaItem(l))}</td>
                  )}
                  <td className="p-1.5">
                    <Input type="number" step="0.001" min={0} max={l.quantidade} value={l.quantidade_recebida}
                      onChange={(e) => setLinha(i, { quantidade_recebida: Math.min(n(l.quantidade), Number(e.target.value)) })}
                      className="h-8 text-center" disabled={bloqueado || status === "rascunho"} />
                  </td>
                  <td className="p-1.5 text-center">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={() => removerLinha(i)} disabled={bloqueado}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Observações internas</Label>
            <Textarea value={head.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} rows={3} disabled={bloqueado} />
          </div>
          <div className="rounded-md border bg-card p-3 space-y-1 text-[13px]">
            <Linha label="Subtotal negociado" valor={fmtMoeda(totais.subtotal_negociado)} />
            <Linha label="Desconto global" valor={`- ${fmtMoeda(totais.desconto_global_rs)}`} />
            <Linha label="Total do pedido" valor={fmtMoeda(totais.total_pedido)} forte />
            <Linha label="Frete" valor={fmtMoeda(head.frete_valor)} />
            <Linha label="Custo total" valor={fmtMoeda(totais.custo_total)} forte />
            {isAdmin && (
              <>
                <div className="border-t my-1" />
                <Linha label="Economia total" valor={fmtMoeda(totais.economia_total)} classe="text-emerald-700" forte />
                <Linha label="Comissão prevista" valor={fmtMoeda(totais.comissao_prevista)} classe="text-teal-800" />
              </>
            )}
          </div>
        </div>

        {cancelado && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">
            Pedido cancelado. Motivo: {head.cancelado_motivo ?? "—"}
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={gerarPdf} disabled={!head.fornecedor_id}>
            <FileDown className="h-4 w-4 mr-1" /> PDF do pedido
          </Button>
          {!bloqueado && pedidoId && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-rose-700 border-rose-200">Cancelar pedido</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar este pedido de compra?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O pedido sai dos totais e da apuração de comissão. Informe o motivo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea value={motivoCancelar} onChange={(e) => setMotivoCancelar(e.target.value)} rows={3} placeholder="Motivo do cancelamento" />
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => cancelar.mutate()}>Cancelar pedido</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {!bloqueado && (
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={salvar.isPending} onClick={() => salvar.mutate({})}>
              Salvar
            </Button>
          )}
          {!bloqueado && proximos.map((s) => (
            <Button key={s} variant="secondary" disabled={salvar.isPending} onClick={() => salvar.mutate({ novoStatus: s })}>
              {SUP_STATUS_LABEL[s]}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={!!trocaFornecedor} onOpenChange={(o) => { if (!o) setTrocaFornecedor(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Os produtos já lançados pertencem ao fornecedor anterior e serão removidos do pedido. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarTrocaFornecedor}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>

  );
}

function Linha({ label, valor, forte, classe }: { label: string; valor: string; forte?: boolean; classe?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${forte ? "font-semibold" : ""} ${classe ?? ""}`}>{valor}</span>
    </div>
  );
}
