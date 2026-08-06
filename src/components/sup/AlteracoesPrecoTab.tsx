import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TrendingDown, TrendingUp, Download, Ban } from "lucide-react";
import { SortTh, useTableSort } from "@/components/shared/sortable";
import { useProfilesMap, resolveNome } from "@/hooks/use-profiles-map";
import { useIsAdmin } from "@/hooks/use-role";
import { useSupFornecedores } from "@/components/sup/FornecedoresTab";
import { useSupFornecedorProdutos, useSupProdutos } from "@/components/sup/ProdutosTab";
import { fmtMoeda, n, rotuloVariacao, variacaoPercentual, type SupPrecoHistorico, type SupProdutoVariacaoPreco } from "@/lib/sup";

interface Props {
  de: string;
  ate: string;
}

export function AlteracoesPrecoTab({ de, ate }: Props) {
  const qc = useQueryClient();
  const profiles = useProfilesMap();
  const isAdmin = useIsAdmin();
  const { data: fornecedores = [] } = useSupFornecedores();
  const { data: produtos = [] } = useSupProdutos();
  const { data: vinculos = [] } = useSupFornecedorProdutos();

  const [direcao, setDirecao] = useState("todas");
  const [tipo, setTipo] = useState("todos");
  const [mostrarAnulados, setMostrarAnulados] = useState(false);

  const [alvo, setAlvo] = useState<SupPrecoHistorico | null>(null);
  const [motivo, setMotivo] = useState("");

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["sup-alteracoes-preco"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sup_preco_historico")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as SupPrecoHistorico[];
    },
  });

  const { data: variacaoPrecos = [] } = useQuery({
    queryKey: ["sup-variacao-precos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sup_produto_variacao_precos").select("*");
      if (error) throw error;
      return (data ?? []) as SupProdutoVariacaoPreco[];
    },
  });



  /** PCs emitidos (fora de rascunho/cancelado) que usaram o registro em anulação. */
  const { data: pcsDoAlvo = [] } = useQuery({
    queryKey: ["sup-pc-do-historico", alvo?.id],
    enabled: !!alvo,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sup_pedido_itens")
        .select("pedido_id, sup_pedidos_compra!inner(numero, status)")
        .eq("preco_historico_id", alvo!.id);
      if (error) throw error;
      const nums = new Set<string>();
      for (const it of (data ?? []) as any[]) {
        const pc = it.sup_pedidos_compra;
        if (!pc) continue;
        if (pc.status === "rascunho" || pc.status === "cancelado") continue;
        nums.add(pc.numero ?? "sem número");
      }
      return [...nums];
    },
  });

  /** id do registro mais recente não anulado por (fornecedor_produto_id + tipo). */
  const maisRecentes = useMemo(() => {
    const m = new Map<string, string>();
    const asc = historico.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const h of asc) {
      if (h.anulado) continue;
      m.set(`${h.fornecedor_produto_id}|${h.tipo ?? "tabela"}`, h.id);
    }
    return m;
  }, [historico]);

  const podeAnular = (h: SupPrecoHistorico) =>
    maisRecentes.get(`${h.fornecedor_produto_id}|${h.tipo ?? "tabela"}`) === h.id;

  const anular = useMutation({
    mutationFn: async ({ h, motivo }: { h: SupPrecoHistorico; motivo: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("sup_preco_historico")
        .update({
          anulado: true,
          anulado_por: u.user?.id ?? null,
          anulado_em: new Date().toISOString(),
          anulado_motivo: motivo.trim(),
        })
        .eq("id", h.id);
      if (error) throw error;

      const campo = (h.tipo ?? "tabela") === "negociado" ? "preco_negociado" : "preco_tabela";
      const valor = h.preco_anterior == null ? null : n(h.preco_anterior);
      const { error: e2 } = await (supabase as any)
        .from("sup_fornecedor_produtos")
        .update({ [campo]: valor })
        .eq("id", h.fornecedor_produto_id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-alteracoes-preco"] });
      qc.invalidateQueries({ queryKey: ["sup-preco-historico"] });
      qc.invalidateQueries({ queryKey: ["sup-fornecedor-produtos"] });
      setAlvo(null);
      setMotivo("");
      toast.success("Registro anulado e preço do cadastro restaurado.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao anular registro."),
  });

  const meta = (h: SupPrecoHistorico) => {
    const v = vinculos.find((x) => x.id === h.fornecedor_produto_id);
    const nome = produtos.find((p) => p.id === v?.produto_id)?.nome ?? "—";
    const comb = h.variacao_preco_id ? variacaoPrecos.find((x) => x.id === h.variacao_preco_id) : null;
    const suf = comb ? rotuloVariacao(comb) : "";
    return {
      fornecedor: fornecedores.find((f) => f.id === v?.fornecedor_id)?.razao_social ?? "—",
      produto: suf ? `${nome} — ${suf}` : nome,
    };
  };

  const linhas = useMemo(() => {
    return historico
      .filter((h) => {
        if (direcao !== "todas" && h.direcao !== direcao) return false;
        if (tipo !== "todos" && (h.tipo ?? "tabela") !== tipo) return false;
        if (!mostrarAnulados && h.anulado) return false;
        const dia = h.created_at.slice(0, 10);
        if (de && dia < de) return false;
        if (ate && dia > ate) return false;
        return true;
      })
      .map((h) => ({ h, ...meta(h), varPct: variacaoPercentual(h.preco_anterior, n(h.preco_novo)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historico, direcao, tipo, mostrarAnulados, de, ate, vinculos, fornecedores, produtos, variacaoPrecos]);

  const { rows: ordenadas, sortKey, sortDir, toggle } = useTableSort(linhas, {
    quando: (r) => r.h.created_at,
    fornecedor: (r) => r.fornecedor,
    produto: (r) => r.produto,
    tipo: (r) => r.h.tipo ?? "tabela",
    variacao: (r) => r.varPct ?? 0,
    quem: (r) => resolveNome(profiles, r.h.alterado_por),
  }, { key: "quando", dir: "desc" });

  async function baixarAnexo(path: string) {
    const { data, error } = await supabase.storage.from("sup-anexos").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir o anexo."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Label className="text-xs">Direção</Label>
          <Select value={direcao} onValueChange={setDirecao}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="inicial">Preço inicial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Label className="text-xs">Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="tabela">Tabela</SelectItem>
              <SelectItem value="negociado">Negociado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-1.5 text-xs pb-2.5 cursor-pointer">
          <Checkbox checked={mostrarAnulados} onCheckedChange={(v) => setMostrarAnulados(!!v)} />
          Mostrar anulados
        </label>
        <div className="ml-auto max-w-[520px] text-[11px] text-muted-foreground pb-2">
          Registro de todas as alterações de preço, inclusive as geradas ao salvar um pedido de compra. Cada linha é
          permanente; erros de digitação se corrigem anulando o registro.
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-auto max-h-[70vh]">
        <table className="w-full text-[13px] tbl-congelada">
          <thead className="bg-muted/40">
            <tr className="text-xs">
              <SortTh label="Quando" sortKey="quando" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
              <SortTh label="Fornecedor" sortKey="fornecedor" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
              <SortTh label="Produto" sortKey="produto" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
              <SortTh label="Tipo" sortKey="tipo" current={sortKey} dir={sortDir} onSort={toggle} />
              <th className="p-1.5 font-medium text-right">De</th>
              <th className="p-1.5 font-medium text-right">Para</th>
              <SortTh label="Variação" sortKey="variacao" current={sortKey} dir={sortDir} onSort={toggle} />
              <th className="p-1.5 font-medium text-left">Motivo</th>
              <SortTh label="Quem alterou" sortKey="quem" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
              <th className="p-1.5 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>
            ) : ordenadas.length === 0 ? (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Nenhuma alteração de preço.</td></tr>
            ) : ordenadas.map(({ h, fornecedor, produto, varPct }) => (
              <tr key={h.id} className={`border-t ${h.anulado ? "line-through text-muted-foreground" : ""}`}>
                <td className="p-1.5 whitespace-nowrap tabular-nums">{new Date(h.created_at).toLocaleString("pt-BR")}</td>
                <td className="p-1.5">{fornecedor}</td>
                <td className="p-1.5">{produto}</td>
                <td className="p-1.5 text-center">
                  <span className={`no-underline px-2 py-0.5 rounded text-[11px] font-semibold ${(h.tipo ?? "tabela") === "negociado" ? "bg-teal-100 text-teal-900" : "bg-muted text-muted-foreground"}`}>
                    {(h.tipo ?? "tabela") === "negociado" ? "Negociado" : "Tabela"}
                  </span>
                </td>
                <td className="p-1.5 text-right tabular-nums">{h.preco_anterior == null ? "—" : fmtMoeda(h.preco_anterior)}</td>
                <td className="p-1.5 text-right font-semibold tabular-nums">{fmtMoeda(h.preco_novo)}</td>
                <td className="p-1.5 text-center">
                  <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${h.direcao === "alta" ? "text-rose-700" : h.direcao === "baixa" ? "text-emerald-700" : "text-muted-foreground"}`}>
                    {h.direcao === "alta" ? <TrendingUp className="h-3 w-3" /> : h.direcao === "baixa" ? <TrendingDown className="h-3 w-3" /> : null}
                    {varPct == null ? "inicial" : `${varPct > 0 ? "+" : ""}${varPct.toFixed(1)}%`}
                  </span>
                </td>
                <td className="p-1.5">
                  {h.anulado ? (
                    <span>
                      <span className="no-underline mr-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10.5px] font-semibold align-middle">
                        Anulado
                      </span>
                      {h.anulado_motivo ?? "—"}
                      <span className="text-[11px]"> · por {resolveNome(profiles, h.anulado_por)}</span>
                    </span>
                  ) : (
                    <>
                      {h.motivo ?? "—"}
                      {h.anexo_url && (
                        <Button size="sm" variant="ghost" className="h-6 px-1 ml-1" onClick={() => void baixarAnexo(h.anexo_url!)} title="Abrir anexo">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                </td>
                <td className="p-1.5 font-semibold">{resolveNome(profiles, h.alterado_por)}</td>
                <td className="p-1.5 text-right">
                  {isAdmin && !h.anulado && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-rose-700 border-rose-200"
                      disabled={!podeAnular(h)}
                      title={podeAnular(h) ? "Anular registro" : "Anule primeiro os registros mais recentes deste produto."}
                      onClick={() => { setAlvo(h); setMotivo(""); }}
                    >
                      <Ban className="h-3.5 w-3.5 mr-1" />Anular
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!alvo} onOpenChange={(o) => { if (!o) { setAlvo(null); setMotivo(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular este registro de preço?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro continua no histórico e no log, marcado como anulado, mas deixa de contar no gráfico, nos
              comparativos e no preço atual do produto. Informe o motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pcsDoAlvo.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[12px] text-amber-900">
              Esta alteração de preço foi usada nos pedidos {pcsDoAlvo.join(", ")}. Anular corrige o histórico e o
              gráfico, mas <strong>não altera esses pedidos</strong> — os valores neles continuam como foram emitidos.
            </div>
          )}
          <div>
            <Label className="text-xs">Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: erro de digitação (R$ 82,00 em vez de R$ 8,20)" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={motivo.trim().length < 3 || anular.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!alvo || motivo.trim().length < 3) return;
                anular.mutate({ h: alvo, motivo });
              }}
            >
              Anular registro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
