import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, TrendingDown, TrendingUp } from "lucide-react";
import { SortTh, useTableSort } from "@/components/shared/sortable";
import { useSupFornecedores } from "@/components/sup/FornecedoresTab";
import {
  SUP_UNIDADES, fmtDataBR, fmtMoeda, n, variacaoPercentual,
  type SupFornecedorProduto, type SupPrecoHistorico, type SupProduto,
} from "@/lib/sup";

export function useSupProdutos() {
  return useQuery({
    queryKey: ["sup-produtos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sup_produtos").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as SupProduto[];
    },
  });
}

export function useSupFornecedorProdutos() {
  return useQuery({
    queryKey: ["sup-fornecedor-produtos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sup_fornecedor_produtos").select("*");
      if (error) throw error;
      return (data ?? []) as SupFornecedorProduto[];
    },
  });
}

/** Aplica preço novo: grava histórico (imutável) e atualiza o cadastro. */
export async function aplicarPrecoTabela(args: {
  fornecedor_produto_id: string;
  preco_anterior: number | null;
  preco_novo: number;
  motivo?: string | null;
  anexo_url?: string | null;
}) {
  const { fornecedor_produto_id, preco_anterior, preco_novo } = args;
  const anterior = preco_anterior == null || n(preco_anterior) === 0 ? null : n(preco_anterior);
  const direcao: "alta" | "baixa" | "inicial" =
    anterior == null ? "inicial" : preco_novo > anterior ? "alta" : "baixa";
  const status_revisao = direcao === "alta" ? "pendente" : "revisada";
  const { data: u } = await supabase.auth.getUser();

  const { data: hist, error: e1 } = await (supabase as any)
    .from("sup_preco_historico")
    .insert({
      fornecedor_produto_id,
      preco_anterior: anterior,
      preco_novo,
      direcao,
      motivo: args.motivo || null,
      anexo_url: args.anexo_url || null,
      status_revisao,
      alterado_por: u.user?.id ?? null,
    })
    .select("id")
    .single();
  if (e1) throw e1;

  const { error: e2 } = await (supabase as any)
    .from("sup_fornecedor_produtos")
    .update({ preco_tabela: preco_novo })
    .eq("id", fornecedor_produto_id);
  if (e2) throw e2;
  return hist?.id as string | undefined;
}

export function ProdutosTab() {
  const qc = useQueryClient();
  const { data: produtos = [], isLoading } = useSupProdutos();
  const { data: fornecedores = [] } = useSupFornecedores();
  const { data: vinculos = [] } = useSupFornecedorProdutos();
  const [busca, setBusca] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [prodOpen, setProdOpen] = useState(false);
  const [prodForm, setProdForm] = useState<Partial<SupProduto>>({ ativo: true, unidade: "unidade" });
  const [precoOpen, setPrecoOpen] = useState(false);
  const [precoAlvo, setPrecoAlvo] = useState<{ vinculo: SupFornecedorProduto | null; fornecedor_id: string } | null>(null);
  const [precoForm, setPrecoForm] = useState<{ preco: string; motivo: string; qtd_min: string; prazo: string; arquivo: File | null }>(
    { preco: "", motivo: "", qtd_min: "", prazo: "", arquivo: null },
  );

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return produtos.filter((p) => !b || [p.nome, p.categoria, p.especificacao].some((v) => (v ?? "").toLowerCase().includes(b)));
  }, [produtos, busca]);

  const { rows: ordenados, sortKey, sortDir, toggle } = useTableSort(filtrados, {
    nome: (r) => r.nome,
    categoria: (r) => r.categoria,
    unidade: (r) => r.unidade,
    preco_referencia: (r) => r.preco_referencia ?? -1,
    ativo: (r) => (r.ativo ? 1 : 0),
  }, { key: "nome" });

  const sel = produtos.find((p) => p.id === selId) ?? null;
  const vinculosDoProduto = useMemo(
    () => vinculos.filter((v) => v.produto_id === selId),
    [vinculos, selId],
  );

  const { data: historico = [] } = useQuery({
    queryKey: ["sup-preco-historico", selId],
    enabled: !!selId,
    queryFn: async () => {
      const ids = vinculos.filter((v) => v.produto_id === selId).map((v) => v.id);
      if (ids.length === 0) return [] as SupPrecoHistorico[];
      const { data, error } = await (supabase as any)
        .from("sup_preco_historico")
        .select("*")
        .in("fornecedor_produto_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupPrecoHistorico[];
    },
  });

  const salvarProduto = useMutation({
    mutationFn: async (f: Partial<SupProduto>) => {
      if (!f.nome?.trim()) throw new Error("Informe o nome do produto.");
      const precoRef = String((f as any).preco_referencia ?? "").trim().replace(",", ".");
      const payload = {
        nome: f.nome.trim(),
        categoria: f.categoria || null,
        unidade: f.unidade || "unidade",
        especificacao: f.especificacao || null,
        preco_referencia: precoRef === "" ? null : Number(precoRef),
        ativo: f.ativo ?? true,
      };
      if (payload.preco_referencia != null && !Number.isFinite(payload.preco_referencia)) {
        throw new Error("Informe um preço de cadastro válido.");
      }

      if (f.id) {
        const { error } = await (supabase as any).from("sup_produtos").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await (supabase as any).from("sup_produtos").insert({ ...payload, created_by: u.user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-produtos"] });
      toast.success("Produto salvo.");
      setProdOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar produto."),
  });

  const salvarPreco = useMutation({
    mutationFn: async () => {
      if (!precoAlvo || !selId) return;
      const preco = Number(String(precoForm.preco).replace(",", "."));
      if (!Number.isFinite(preco) || preco < 0) throw new Error("Informe um preço válido.");

      let anexo_url: string | null = null;
      if (precoForm.arquivo) {
        const path = `precos/${selId}/${Date.now()}-${precoForm.arquivo.name}`;
        const { error } = await supabase.storage.from("sup-anexos").upload(path, precoForm.arquivo);
        if (error) throw error;
        anexo_url = path;
      }

      let vinculoId = precoAlvo.vinculo?.id ?? null;
      let anterior = precoAlvo.vinculo?.preco_tabela ?? null;
      if (!vinculoId) {
        const { data, error } = await (supabase as any)
          .from("sup_fornecedor_produtos")
          .insert({
            fornecedor_id: precoAlvo.fornecedor_id,
            produto_id: selId,
            quantidade_minima: precoForm.qtd_min === "" ? null : Number(precoForm.qtd_min),
            prazo_entrega_dias: precoForm.prazo === "" ? null : Number(precoForm.prazo),
          })
          .select("id")
          .single();
        if (error) throw error;
        vinculoId = data.id as string;
        anterior = null;
      } else {
        const { error } = await (supabase as any)
          .from("sup_fornecedor_produtos")
          .update({
            quantidade_minima: precoForm.qtd_min === "" ? null : Number(precoForm.qtd_min),
            prazo_entrega_dias: precoForm.prazo === "" ? null : Number(precoForm.prazo),
          })
          .eq("id", vinculoId);
        if (error) throw error;
      }

      if (n(anterior) !== preco) {
        await aplicarPrecoTabela({
          fornecedor_produto_id: vinculoId!,
          preco_anterior: anterior,
          preco_novo: preco,
          motivo: precoForm.motivo,
          anexo_url,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-fornecedor-produtos"] });
      qc.invalidateQueries({ queryKey: ["sup-preco-historico"] });
      qc.invalidateQueries({ queryKey: ["sup-alteracoes-preco"] });
      toast.success("Preço aplicado.");
      setPrecoOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao aplicar preço."),
  });

  function abrirPreco(fornecedor_id: string, vinculo: SupFornecedorProduto | null) {
    setPrecoAlvo({ fornecedor_id, vinculo });
    setPrecoForm({
      preco: vinculo?.preco_tabela != null ? String(vinculo.preco_tabela) : "",
      motivo: "",
      qtd_min: vinculo?.quantidade_minima != null ? String(vinculo.quantidade_minima) : "",
      prazo: vinculo?.prazo_entrega_dias != null ? String(vinculo.prazo_entrega_dias) : "",
      arquivo: null,
    });
    setPrecoOpen(true);
  }

  const nomeFornecedor = (id: string) => fornecedores.find((f) => f.id === id)?.razao_social ?? "—";
  const fornecedorDoVinculo = (vinculoId: string) => {
    const v = vinculos.find((x) => x.id === vinculoId);
    return v ? nomeFornecedor(v.fornecedor_id) : "—";
  };
  const semVinculo = fornecedores.filter((f) => f.ativo && !vinculosDoProduto.some((v) => v.fornecedor_id === f.id));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4">
      <div className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs">Busca no catálogo</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, categoria…" className="h-9" />
          </div>
          <Button
            className="h-9 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => { setProdForm({ ativo: true, unidade: "unidade" }); setProdOpen(true); }}
          >
            <Plus className="h-4 w-4 mr-1" /> Novo produto
          </Button>
        </div>

        <div className="rounded-md border bg-card overflow-auto max-h-[70vh]">
          <table className="w-full text-[13px] tbl-congelada">
            <thead className="bg-muted/40">
              <tr className="text-xs">
                <SortTh label="Produto" sortKey="nome" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
                <SortTh label="Categoria" sortKey="categoria" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
                <SortTh label="Unidade" sortKey="unidade" current={sortKey} dir={sortDir} onSort={toggle} />
                <SortTh label="Preço cadastro" sortKey="preco_referencia" current={sortKey} dir={sortDir} onSort={toggle} className="text-right" />
                <SortTh label="Situação" sortKey="ativo" current={sortKey} dir={sortDir} onSort={toggle} />
                <th className="p-1.5 w-10"></th>

              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>
              ) : ordenados.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum produto.</td></tr>
              ) : ordenados.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t cursor-pointer hover:bg-muted/20 ${selId === p.id ? "bg-teal-50" : ""}`}
                  onClick={() => setSelId(p.id)}
                >
                  <td className="p-1.5 font-medium">{p.nome}</td>
                  <td className="p-1.5">{p.categoria ?? "—"}</td>
                  <td className="p-1.5 text-center">{p.unidade}</td>
                  <td className="p-1.5 text-right font-semibold tabular-nums">{p.preco_referencia == null ? "—" : fmtMoeda(p.preco_referencia)}</td>
                  <td className="p-1.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${p.ativo ? "bg-teal-100 text-teal-900" : "bg-muted text-muted-foreground"}`}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="p-1.5 text-center">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setProdForm({ ...p }); setProdOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        {!sel ? (
          <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
            Selecione um produto para ver preços por fornecedor e histórico.
          </div>
        ) : (
          <>
            <div className="rounded-md border bg-card p-3">
              <div className="font-semibold">{sel.nome}</div>
              <div className="text-xs text-muted-foreground">
                {sel.categoria ?? "sem categoria"} · unidade {sel.unidade} · preço de cadastro{" "}
                <b className="tabular-nums">{sel.preco_referencia == null ? "—" : fmtMoeda(sel.preco_referencia)}</b>
                {sel.especificacao ? ` · ${sel.especificacao}` : ""}
              </div>
            </div>

            <div className="rounded-md border bg-card overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider bg-muted/40">Preços por fornecedor</div>
              <table className="w-full text-[13px]">
                <thead className="bg-muted/20">
                  <tr className="text-xs">
                    <th className="p-1.5 text-left">Fornecedor</th>
                    <th className="p-1.5 text-right">Preço de tabela</th>
                    <th className="p-1.5 text-center">Qtd. mínima</th>
                    <th className="p-1.5 text-center">Prazo</th>
                    <th className="p-1.5 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {vinculosDoProduto.length === 0 ? (
                    <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Nenhum fornecedor vinculado.</td></tr>
                  ) : vinculosDoProduto.map((v) => (
                    <tr key={v.id} className="border-t">
                      <td className="p-1.5">{nomeFornecedor(v.fornecedor_id)}</td>
                      <td className="p-1.5 text-right font-semibold tabular-nums">{v.preco_tabela == null ? "—" : fmtMoeda(v.preco_tabela)}</td>
                      <td className="p-1.5 text-center tabular-nums">{v.quantidade_minima ?? "—"}</td>
                      <td className="p-1.5 text-center tabular-nums">{v.prazo_entrega_dias == null ? "—" : `${v.prazo_entrega_dias} d`}</td>
                      <td className="p-1.5 text-right">
                        <Button size="sm" variant="outline" className="h-7" onClick={() => abrirPreco(v.fornecedor_id, v)}>Alterar preço</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {semVinculo.length > 0 && (
                <div className="p-2 border-t flex items-center gap-2">
                  <Select onValueChange={(fid) => abrirPreco(fid, null)}>
                    <SelectTrigger className="h-8 w-[260px]"><SelectValue placeholder="Adicionar fornecedor a este produto" /></SelectTrigger>
                    <SelectContent>
                      {semVinculo.map((f) => <SelectItem key={f.id} value={f.id}>{f.razao_social}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="rounded-md border bg-card overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider bg-muted/40">Histórico de preço</div>
              <div className="max-h-[40vh] overflow-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-muted/20">
                    <tr className="text-xs">
                      <th className="p-1.5 text-left">Quando</th>
                      <th className="p-1.5 text-left">Fornecedor</th>
                      <th className="p-1.5 text-right">De</th>
                      <th className="p-1.5 text-right">Para</th>
                      <th className="p-1.5 text-center">Variação</th>
                      <th className="p-1.5 text-left">Motivo</th>
                      <th className="p-1.5 text-center">Revisão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico.length === 0 ? (
                      <tr><td colSpan={7} className="p-3 text-center text-muted-foreground">Sem histórico.</td></tr>
                    ) : historico.map((h) => {
                      const varPct = variacaoPercentual(h.preco_anterior, n(h.preco_novo));
                      return (
                        <tr key={h.id} className="border-t">
                          <td className="p-1.5 whitespace-nowrap">{new Date(h.created_at).toLocaleString("pt-BR")}</td>
                          <td className="p-1.5">{fornecedorDoVinculo(h.fornecedor_produto_id)}</td>
                          <td className="p-1.5 text-right tabular-nums">{h.preco_anterior == null ? "—" : fmtMoeda(h.preco_anterior)}</td>
                          <td className="p-1.5 text-right font-semibold tabular-nums">{fmtMoeda(h.preco_novo)}</td>
                          <td className="p-1.5 text-center">
                            <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${h.direcao === "alta" ? "text-rose-700" : h.direcao === "baixa" ? "text-emerald-700" : "text-muted-foreground"}`}>
                              {h.direcao === "alta" ? <TrendingUp className="h-3 w-3" /> : h.direcao === "baixa" ? <TrendingDown className="h-3 w-3" /> : null}
                              {varPct == null ? "inicial" : `${varPct > 0 ? "+" : ""}${varPct.toFixed(1)}%`}
                            </span>
                          </td>
                          <td className="p-1.5">{h.motivo ?? "—"}</td>
                          <td className="p-1.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              h.status_revisao === "pendente" ? "bg-amber-100 text-amber-900"
                              : h.status_revisao === "contestada" ? "bg-rose-100 text-rose-900"
                              : "bg-emerald-100 text-emerald-900"}`}>
                              {h.status_revisao}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={prodOpen} onOpenChange={setProdOpen}>
        <DialogContent className="max-w-[620px]">
          <DialogHeader><DialogTitle>{prodForm.id ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nome *</Label>
              <Input value={prodForm.nome ?? ""} onChange={(e) => setProdForm((f) => ({ ...f, nome: e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Input value={prodForm.categoria ?? ""} onChange={(e) => setProdForm((f) => ({ ...f, categoria: e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Unidade *</Label>
              <Select value={prodForm.unidade ?? "unidade"} onValueChange={(v) => setProdForm((f) => ({ ...f, unidade: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{SUP_UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Preço de cadastro (por unidade)</Label>
              <Input
                type="number" step="0.01" min={0}
                value={(prodForm as any).preco_referencia ?? ""}
                onChange={(e) => setProdForm((f) => ({ ...f, preco_referencia: e.target.value === "" ? null : Number(e.target.value) } as any))}
                className="h-9 text-right"
                placeholder="0,00"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Referência de tabela usada quando o fornecedor não tem preço cadastrado.</p>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Especificação</Label>
              <Textarea value={prodForm.especificacao ?? ""} onChange={(e) => setProdForm((f) => ({ ...f, especificacao: e.target.value }))} rows={3} />
            </div>
            <div>
              <Label className="text-xs">Situação</Label>
              <Select value={prodForm.ativo === false ? "inativo" : "ativo"} onValueChange={(v) => setProdForm((f) => ({ ...f, ativo: v === "ativo" }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProdOpen(false)}>Cancelar</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={salvarProduto.isPending} onClick={() => salvarProduto.mutate(prodForm)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={precoOpen} onOpenChange={setPrecoOpen}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader><DialogTitle>Preço de tabela — {precoAlvo ? nomeFornecedor(precoAlvo.fornecedor_id) : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Preço atual: <b>{precoAlvo?.vinculo?.preco_tabela == null ? "sem preço" : fmtMoeda(precoAlvo.vinculo.preco_tabela)}</b>.
              A alteração é aplicada imediatamente e registrada no histórico.
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Novo preço *</Label>
                <Input value={precoForm.preco} onChange={(e) => setPrecoForm((f) => ({ ...f, preco: e.target.value }))} className="h-9" placeholder="0,00" />
              </div>
              <div>
                <Label className="text-xs">Qtd. mínima</Label>
                <Input type="number" min={0} value={precoForm.qtd_min} onChange={(e) => setPrecoForm((f) => ({ ...f, qtd_min: e.target.value }))} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Prazo (dias)</Label>
                <Input type="number" min={0} value={precoForm.prazo} onChange={(e) => setPrecoForm((f) => ({ ...f, prazo: e.target.value }))} className="h-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Motivo (opcional)</Label>
              <Textarea value={precoForm.motivo} onChange={(e) => setPrecoForm((f) => ({ ...f, motivo: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label className="text-xs">Anexo (opcional)</Label>
              <Input type="file" className="h-9" onChange={(e) => setPrecoForm((f) => ({ ...f, arquivo: e.target.files?.[0] ?? null }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrecoOpen(false)}>Cancelar</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={salvarPreco.isPending} onClick={() => salvarPreco.mutate()}>
              Aplicar preço
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
