import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-role";
import { useItensUltimoSnapshot, useProdutoMap } from "./AlimentacaoEstoqueTab";

/**
 * Produtos distintos das vendas (olist_itens) do lote mais recente de cada empresa.
 * `olist_itens` é restrita a admin, portanto a consulta só roda para admin.
 * Sem DISTINCT/GROUP BY (o Data API não oferece): traz apenas a coluna de texto
 * e deduplica com Set.
 */
function useProdutosVendas(enabled: boolean) {
  return useQuery({
    queryKey: ["olist-vendas", "produtos-distintos"],
    enabled,
    queryFn: async () => {
      const { data: lotes, error: e1 } = await supabase
        .from("olist_import_lotes" as any)
        .select("id, empresa, importado_em")
        .order("importado_em", { ascending: false });
      if (e1) throw e1;

      const maisRecentePorEmpresa = new Map<string, string>();
      for (const l of (lotes ?? []) as any[]) {
        if (!maisRecentePorEmpresa.has(l.empresa)) maisRecentePorEmpresa.set(l.empresa, l.id);
      }
      const ids = Array.from(maisRecentePorEmpresa.values());
      if (ids.length === 0) return [] as string[];

      const { data, error } = await supabase
        .from("olist_itens" as any)
        .select("produto_olist")
        .in("lote_id", ids)
        .not("produto_olist", "is", null);
      if (error) throw error;

      const s = new Set<string>();
      for (const r of (data ?? []) as any[]) {
        const p = String(r.produto_olist ?? "").trim();
        if (p) s.add(p);
      }
      return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
  });
}

export function PendenciaMapeamentoAlert() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { data: mapa = [] } = useProdutoMap();
  const { itens } = useItensUltimoSnapshot();
  const { data: produtosVendas = [] } = useProdutosVendas(isAdmin);

  const mapeados = useMemo(() => new Set(mapa.map((m) => m.produto_olist)), [mapa]);

  const pendentesEstoque = useMemo(() => {
    const s = new Set<string>();
    for (const it of itens) if (!mapeados.has(it.produto_olist)) s.add(it.produto_olist);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [itens, mapeados]);

  const pendentesVendas = useMemo(
    () => (isAdmin ? produtosVendas.filter((p) => !mapeados.has(p)) : []),
    [isAdmin, produtosVendas, mapeados],
  );

  if (pendentesEstoque.length === 0 && pendentesVendas.length === 0) return null;

  const lista = (arr: string[]) =>
    arr.slice(0, 12).join(", ") + (arr.length > 12 ? ` … (+${arr.length - 12})` : "");

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Produtos sem correspondência com um modelo do COP</AlertTitle>
      <AlertDescription className="space-y-2">
        {pendentesEstoque.length > 0 && (
          <div className="text-xs">
            <b>
              {pendentesEstoque.length} produto{pendentesEstoque.length > 1 ? "s" : ""} do estoque
            </b>{" "}
            (planilhas de estoque da Olist): {lista(pendentesEstoque)}
          </div>
        )}
        {pendentesVendas.length > 0 && (
          <div className="text-xs">
            <b>
              {pendentesVendas.length} produto{pendentesVendas.length > 1 ? "s" : ""} das vendas
            </b>{" "}
            (planilhas de pedidos da Olist): {lista(pendentesVendas)}
          </div>
        )}
        <div className="text-xs">
          Enquanto não forem validados, esses produtos ficam <b>fora do Saldo Real e dos indicadores</b>.
          {isAdmin
            ? " Faça o de-para em Configurações do COP."
            : " Acione um administrador para cadastrar o de-para em Configurações do COP."}
        </div>
        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/configuracoes", search: { area: "cop" } as any })}
          >
            Abrir Configurações do COP
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
