import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import { REFACAO_MODELOS } from "@/lib/pedidos";
import { useIsAdmin } from "@/hooks/use-role";
import { useTableSort, SortTh } from "@/components/shared/sortable";
import { useItensUltimoSnapshot, useProdutoMap } from "./AlimentacaoEstoqueTab";
import { useProdutosVendas } from "./PendenciaMapeamentoAlert";

export function ProdutoMapCard() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const { data: mapa = [] } = useProdutoMap();
  const { itens } = useItensUltimoSnapshot();
  const { data: produtosVendas = [] } = useProdutosVendas(isAdmin);
  const [pendenteSel, setPendenteSel] = useState<Record<string, string>>({});
  const [novoProduto, setNovoProduto] = useState("");
  const [novoModelo, setNovoModelo] = useState("");

  const mapeados = useMemo(() => new Set(mapa.map((m) => m.produto_olist)), [mapa]);

  const pendentes = useMemo(() => {
    const agrup = new Map<
      string,
      { produto: string; empresas: Set<string>; qtd: number; origens: Set<string> }
    >();
    const get = (produto: string) =>
      agrup.get(produto) ?? { produto, empresas: new Set<string>(), qtd: 0, origens: new Set<string>() };

    for (const it of itens) {
      if (mapeados.has(it.produto_olist)) continue;
      const e = get(it.produto_olist);
      e.empresas.add(it.empresa);
      e.qtd += it.qtd ?? 0;
      e.origens.add("Estoque");
      agrup.set(it.produto_olist, e);
    }
    for (const v of produtosVendas) {
      if (mapeados.has(v.produto)) continue;
      const e = get(v.produto);
      for (const emp of v.empresas.split(", ").filter(Boolean)) e.empresas.add(emp);
      e.qtd += v.qtd;
      e.origens.add("Vendas");
      agrup.set(v.produto, e);
    }

    return Array.from(agrup.values()).map((e) => ({
      produto: e.produto,
      empresas: Array.from(e.empresas).sort().join(", "),
      qtd: e.qtd,
      origem: Array.from(e.origens).sort().join(" + "),
    }));
  }, [itens, mapeados, produtosVendas]);

  const pendentesSort = useTableSort(pendentes, {
    produto: (p) => p.produto,
    empresas: (p) => p.empresas,
    qtd: (p) => p.qtd,
    origem: (p) => p.origem,
  });

  const mapaOrdenado = useMemo(
    () => mapa.slice().sort((a, b) => a.produto_olist.localeCompare(b.produto_olist, "pt-BR")),
    [mapa],
  );
  const mapaSort = useTableSort(mapaOrdenado, {
    produto: (m) => m.produto_olist,
    modelo: (m) => m.modelo_cop,
  });

  const salvarMap = useMutation({
    mutationFn: async ({ produto, modelo, id }: { produto: string; modelo: string; id?: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (id) {
        const { error } = await supabase
          .from("olist_produto_map" as any)
          .update({ modelo_cop: modelo } as any)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("olist_produto_map" as any)
          .insert({ produto_olist: produto, modelo_cop: modelo, criado_por: user.user?.id ?? null } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque-olist", "produto-map"] });
      qc.invalidateQueries({ queryKey: ["olist-produto-map"] });
      toast.success("Mapeamento salvo.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar mapeamento."),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          De-para de produtos da Olist
          {pendentes.length > 0 && <Badge variant="destructive">{pendentes.length} pendente(s)</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAdmin && (
          <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <Lock className="h-4 w-4 mt-0.5" />
            <span>
              Consulta somente leitura. O cadastro do de-para é privativo de <b>administrador</b>.
            </span>
          </div>
        )}

        {pendentes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />
              <span>
                <b>{pendentes.length} produto(s)</b> das últimas importações (estoque e vendas da Olist) não têm
                equivalência com um modelo do COP. Enquanto não forem mapeados, essas peças <b>não entram no Saldo
                Real nem nos indicadores</b>.
              </span>
            </div>
            <div className="overflow-auto max-h-[40vh] tbl-congelada">
              <table className="w-full text-[12.5px]">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <SortTh label="Produto na Olist" sortKey="produto" current={pendentesSort.sortKey} dir={pendentesSort.sortDir} onSort={pendentesSort.toggle} className="text-left" />
                    <SortTh label="Origem" sortKey="origem" current={pendentesSort.sortKey} dir={pendentesSort.sortDir} onSort={pendentesSort.toggle} className="text-left w-[110px]" />
                    <SortTh label="Empresa(s)" sortKey="empresas" current={pendentesSort.sortKey} dir={pendentesSort.sortDir} onSort={pendentesSort.toggle} className="text-left w-[100px]" />
                    <SortTh label="Qtd fora" sortKey="qtd" current={pendentesSort.sortKey} dir={pendentesSort.sortDir} onSort={pendentesSort.toggle} className="text-right w-[90px]" />
                    {isAdmin && <th className="p-2 text-left w-[240px]">Modelo COP</th>}
                    {isAdmin && <th className="p-2 w-[100px]" />}
                  </tr>
                </thead>
                <tbody>
                  {pendentesSort.rows.map((p) => (
                    <tr key={p.produto} className="border-t">
                      <td className="p-2">{p.produto}</td>
                      <td className="p-2 font-semibold">{p.empresas || "—"}</td>
                      <td className="p-2 text-right font-semibold tabular-nums">{p.qtd}</td>
                      {isAdmin && (
                        <td className="p-2">
                          <Select
                            value={pendenteSel[p.produto] ?? ""}
                            onValueChange={(v) => setPendenteSel((s) => ({ ...s, [p.produto]: v }))}
                          >
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {REFACAO_MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                      )}
                      {isAdmin && (
                        <td className="p-2 text-right">
                          <Button
                            size="sm"
                            disabled={!pendenteSel[p.produto] || salvarMap.isPending}
                            onClick={() => salvarMap.mutate({ produto: p.produto, modelo: pendenteSel[p.produto] })}
                          >
                            Salvar
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/20 p-2">
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Produto na Olist</div>
              <Input
                className="h-8 w-[280px] text-xs"
                placeholder="Nome exato do produto"
                value={novoProduto}
                onChange={(e) => setNovoProduto(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Modelo COP</div>
              <Select value={novoModelo} onValueChange={setNovoModelo}>
                <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {REFACAO_MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              disabled={!novoProduto.trim() || !novoModelo || salvarMap.isPending}
              onClick={() =>
                salvarMap.mutate(
                  { produto: novoProduto.trim(), modelo: novoModelo },
                  { onSuccess: () => { setNovoProduto(""); setNovoModelo(""); } },
                )
              }
            >
              Adicionar
            </Button>
          </div>
        )}

        {mapa.length > 0 && (
          <div>
            <div className="text-xs font-semibold mb-1">Já mapeados ({mapa.length})</div>
            <div className="overflow-auto max-h-[35vh] tbl-congelada">
              <table className="w-full text-[12.5px]">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <SortTh label="Produto na Olist" sortKey="produto" current={mapaSort.sortKey} dir={mapaSort.sortDir} onSort={mapaSort.toggle} className="text-left" />
                    <SortTh label="Modelo COP" sortKey="modelo" current={mapaSort.sortKey} dir={mapaSort.sortDir} onSort={mapaSort.toggle} className="text-left w-[240px]" />
                  </tr>
                </thead>
                <tbody>
                  {mapaSort.rows.map((m) => (
                    <tr key={m.id} className="border-t">
                      <td className="p-2">{m.produto_olist}</td>
                      <td className="p-2">
                        {isAdmin ? (
                          <Select
                            value={m.modelo_cop}
                            onValueChange={(v) => salvarMap.mutate({ produto: m.produto_olist, modelo: v, id: m.id })}
                          >
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {REFACAO_MODELOS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="font-semibold">{m.modelo_cop}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
