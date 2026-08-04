import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingDown, TrendingUp, Download } from "lucide-react";
import { SortTh, useTableSort } from "@/components/shared/sortable";
import { useProfilesMap, resolveNome } from "@/hooks/use-profiles-map";
import { useSupFornecedores } from "@/components/sup/FornecedoresTab";
import { useSupFornecedorProdutos, useSupProdutos } from "@/components/sup/ProdutosTab";
import { fmtMoeda, n, variacaoPercentual, type SupPrecoHistorico } from "@/lib/sup";

export function AlteracoesPrecoTab() {
  const qc = useQueryClient();
  const profiles = useProfilesMap();
  const { data: fornecedores = [] } = useSupFornecedores();
  const { data: produtos = [] } = useSupProdutos();
  const { data: vinculos = [] } = useSupFornecedorProdutos();

  const [direcao, setDirecao] = useState("todas");
  const [revisao, setRevisao] = useState("todas");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

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

  const marcar = useMutation({
    mutationFn: async ({ h, status }: { h: SupPrecoHistorico; status: "revisada" | "contestada" }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("sup_preco_historico")
        .update({ status_revisao: status, revisado_por: u.user?.id ?? null, revisado_em: new Date().toISOString() })
        .eq("id", h.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sup-alteracoes-preco"] });
      qc.invalidateQueries({ queryKey: ["sup-preco-historico"] });
      qc.invalidateQueries({ queryKey: ["sup-comissoes"] });
      toast.success("Alteração revisada.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao revisar."),
  });

  const meta = (fornecedor_produto_id: string) => {
    const v = vinculos.find((x) => x.id === fornecedor_produto_id);
    return {
      fornecedor: fornecedores.find((f) => f.id === v?.fornecedor_id)?.razao_social ?? "—",
      produto: produtos.find((p) => p.id === v?.produto_id)?.nome ?? "—",
    };
  };

  const linhas = useMemo(() => {
    return historico
      .filter((h) => {
        if (direcao !== "todas" && h.direcao !== direcao) return false;
        if (revisao !== "todas" && h.status_revisao !== revisao) return false;
        const dia = h.created_at.slice(0, 10);
        if (de && dia < de) return false;
        if (ate && dia > ate) return false;
        return true;
      })
      .map((h) => ({ h, ...meta(h.fornecedor_produto_id), varPct: variacaoPercentual(h.preco_anterior, n(h.preco_novo)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historico, direcao, revisao, de, ate, vinculos, fornecedores, produtos]);

  const { rows: ordenadas, sortKey, sortDir, toggle } = useTableSort(linhas, {
    quando: (r) => r.h.created_at,
    fornecedor: (r) => r.fornecedor,
    produto: (r) => r.produto,
    variacao: (r) => r.varPct ?? 0,
    revisao: (r) => r.h.status_revisao,
  }, { key: "quando", dir: "desc" });

  async function baixarAnexo(path: string) {
    const { data, error } = await supabase.storage.from("sup-anexos").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir o anexo."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const pendentes = linhas.filter((r) => r.h.status_revisao === "pendente").length;

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
          <Label className="text-xs">Revisão</Label>
          <Select value={revisao} onValueChange={setRevisao}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="revisada">Revisada</SelectItem>
              <SelectItem value="contestada">Contestada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-36">
          <Label className="text-xs">De</Label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9" />
        </div>
        <div className="w-36">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9" />
        </div>
        <div className="ml-auto text-xs text-muted-foreground pb-2">
          {pendentes} alteração(ões) de alta pendente(s) de revisão. Contestar exclui o item da apuração de comissão.
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-auto max-h-[70vh]">
        <table className="w-full text-[13px] tbl-congelada">
          <thead className="bg-muted/40">
            <tr className="text-xs">
              <SortTh label="Quando" sortKey="quando" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
              <SortTh label="Fornecedor" sortKey="fornecedor" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
              <SortTh label="Produto" sortKey="produto" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
              <th className="p-1.5 font-medium text-right">De</th>
              <th className="p-1.5 font-medium text-right">Para</th>
              <SortTh label="Variação" sortKey="variacao" current={sortKey} dir={sortDir} onSort={toggle} />
              <th className="p-1.5 font-medium text-left">Motivo</th>
              <th className="p-1.5 font-medium text-left">Quem alterou</th>
              <SortTh label="Revisão" sortKey="revisao" current={sortKey} dir={sortDir} onSort={toggle} />
              <th className="p-1.5 w-48"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>
            ) : ordenadas.length === 0 ? (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Nenhuma alteração de preço.</td></tr>
            ) : ordenadas.map(({ h, fornecedor, produto, varPct }) => (
              <tr key={h.id} className="border-t">
                <td className="p-1.5 whitespace-nowrap tabular-nums">{new Date(h.created_at).toLocaleString("pt-BR")}</td>
                <td className="p-1.5">{fornecedor}</td>
                <td className="p-1.5">{produto}</td>
                <td className="p-1.5 text-right tabular-nums">{h.preco_anterior == null ? "—" : fmtMoeda(h.preco_anterior)}</td>
                <td className="p-1.5 text-right font-semibold tabular-nums">{fmtMoeda(h.preco_novo)}</td>
                <td className="p-1.5 text-center">
                  <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${h.direcao === "alta" ? "text-rose-700" : h.direcao === "baixa" ? "text-emerald-700" : "text-muted-foreground"}`}>
                    {h.direcao === "alta" ? <TrendingUp className="h-3 w-3" /> : h.direcao === "baixa" ? <TrendingDown className="h-3 w-3" /> : null}
                    {varPct == null ? "inicial" : `${varPct > 0 ? "+" : ""}${varPct.toFixed(1)}%`}
                  </span>
                </td>
                <td className="p-1.5">
                  {h.motivo ?? "—"}
                  {h.anexo_url && (
                    <Button size="sm" variant="ghost" className="h-6 px-1 ml-1" onClick={() => void baixarAnexo(h.anexo_url!)} title="Abrir anexo">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
                <td className="p-1.5">{resolveNome(profiles, h.alterado_por)}</td>
                <td className="p-1.5 text-center">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    h.status_revisao === "pendente" ? "bg-amber-100 text-amber-900"
                    : h.status_revisao === "contestada" ? "bg-rose-100 text-rose-900"
                    : "bg-emerald-100 text-emerald-900"}`}>
                    {h.status_revisao}
                  </span>
                </td>
                <td className="p-1.5 text-right space-x-1">
                  {h.status_revisao !== "revisada" && (
                    <Button size="sm" variant="outline" className="h-7" onClick={() => marcar.mutate({ h, status: "revisada" })}>Revisada</Button>
                  )}
                  {h.status_revisao !== "contestada" && (
                    <Button size="sm" variant="outline" className="h-7 text-rose-700 border-rose-200" onClick={() => marcar.mutate({ h, status: "contestada" })}>
                      Contestar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
