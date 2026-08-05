import { useMemo } from "react";
import { useSupFornecedores } from "@/components/sup/FornecedoresTab";
import { useSupFornecedorProdutos, useSupProdutos, useSupProdutoGrupos } from "@/components/sup/ProdutosTab";
import { useSupPedidos, useSupPedidoItens } from "@/components/sup/PedidosCompraTab";
import { fmtDataBR, fmtMoeda, n, precoPorUnidadeRef, precoVigente } from "@/lib/sup";

/** Comparativo entre fornecedores por grupo de itens equivalentes. Somente leitura. */
export function ComparativoFornecedoresTab() {
  const { data: fornecedores = [] } = useSupFornecedores();
  const { data: produtos = [] } = useSupProdutos();
  const { data: vinculos = [] } = useSupFornecedorProdutos();
  const { data: grupos = [] } = useSupProdutoGrupos();
  const { data: pedidos = [] } = useSupPedidos();
  const { data: itensPc = [] } = useSupPedidoItens();

  /** Última compra por produto (pedido não cancelado, data mais recente). */
  const ultimaCompra = useMemo(() => {
    const pedidoPorId = new Map(pedidos.map((p) => [p.id, p]));
    const m = new Map<string, { data: string; preco_negociado: number }>();
    for (const it of itensPc) {
      const pc = pedidoPorId.get(it.pedido_id);
      if (!pc || pc.status === "cancelado") continue;
      const atual = m.get(it.produto_id);
      if (!atual || pc.data_pedido > atual.data) {
        m.set(it.produto_id, { data: pc.data_pedido, preco_negociado: n(it.preco_negociado) });
      }
    }
    return m;
  }, [pedidos, itensPc]);

  const comparativo = useMemo(() => {
    return grupos
      .filter((g) => g.ativo)
      .map((g) => {
        const itens = produtos
          .filter((p) => p.grupo_id === g.id && p.ativo && p.fornecedor_id)
          .map((p) => {
            const v = vinculos.find((x) => x.produto_id === p.id && x.fornecedor_id === p.fornecedor_id) ?? null;
            const vigente = precoVigente(v);
            const porRef = precoPorUnidadeRef(vigente, p.fator_conversao);
            const forn = fornecedores.find((f) => f.id === p.fornecedor_id);
            const uc = ultimaCompra.get(p.id) ?? null;
            return {
              produto_id: p.id,
              produto: p.nome,
              unidade: p.unidade,
              fornecedor: forn?.nome_fantasia || forn?.razao_social || "—",
              vigente: vigente ?? 0,
              porRef: porRef ?? 0,
              difPerc: 0,
              ultimaCompraData: uc?.data ?? null,
              ultimaCompraPorRef: uc ? precoPorUnidadeRef(uc.preco_negociado, p.fator_conversao) : null,
            };
          })
          .filter((it) => it.porRef > 0)
          .sort((a, b) => a.porRef - b.porRef);

        if (itens.length < 2) return null;
        const melhor = itens[0]!.porRef;
        const pior = itens[itens.length - 1]!.porRef;
        for (const it of itens) it.difPerc = ((it.porRef - melhor) / melhor) * 100;

        return {
          id: g.id,
          nome: g.nome,
          unidade_referencia: g.unidade_referencia,
          itens,
          economia: pior - melhor,
          economiaPerc: ((pior - melhor) / pior) * 100,
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)
      .sort((a, b) => b.economiaPerc - a.economiaPerc);
  }, [grupos, produtos, vinculos, fornecedores, ultimaCompra]);

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <div className="px-3 py-2 bg-muted/40">
        <div className="text-xs font-semibold uppercase tracking-wider">Comparativo entre fornecedores</div>
        <div className="text-[11px] text-muted-foreground">
          Compara apenas produtos que estão no mesmo grupo de itens equivalentes, sempre convertidos para a unidade de
          referência do grupo. Sem grupo e sem fator de conversão, o produto não entra na comparação.
        </div>
      </div>
      {comparativo.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground text-center">
          Nenhum grupo com dois ou mais fornecedores com preço cadastrado.
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-auto divide-y">
          {comparativo.map((g) => (
            <div key={g.id} className="p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                <div className="text-[13px] font-semibold">
                  {g.nome} <span className="text-muted-foreground font-normal">· por {g.unidade_referencia}</span>
                </div>
                <div className="text-[11.5px]">
                  Economia potencial:{" "}
                  <span className="font-semibold tabular-nums text-emerald-700">
                    {fmtMoeda(g.economia)}/{g.unidade_referencia}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}({g.economiaPerc.toFixed(1)}% trocando o mais caro pelo mais barato)
                  </span>
                </div>
              </div>
              <table className="w-full text-[12.5px]">
                <thead className="bg-muted/20">
                  <tr className="text-xs">
                    <th className="p-1.5 text-left">Fornecedor</th>
                    <th className="p-1.5 text-left">Produto</th>
                    <th className="p-1.5 text-right">Preço vigente</th>
                    <th className="p-1.5 text-center">Unidade</th>
                    <th className="p-1.5 text-right">Preço/un. ref.</th>
                    <th className="p-1.5 text-right">vs. melhor</th>
                    <th className="p-1.5 text-center">Última compra</th>
                    <th className="p-1.5 text-right">R$/un. ref na última compra</th>
                  </tr>
                </thead>
                <tbody>
                  {g.itens.map((it, i) => (
                    <tr key={it.produto_id} className={`border-t ${i === 0 ? "bg-emerald-50" : ""}`}>
                      <td className="p-1.5">
                        {it.fornecedor}
                        {i === 0 && <span className="ml-1 text-[10.5px] font-semibold text-emerald-800">melhor preço</span>}
                      </td>
                      <td className="p-1.5">{it.produto}</td>
                      <td className="p-1.5 text-right tabular-nums">{fmtMoeda(it.vigente)}</td>
                      <td className="p-1.5 text-center">{it.unidade}</td>
                      <td className="p-1.5 text-right font-semibold tabular-nums">{fmtMoeda(it.porRef)}</td>
                      <td className="p-1.5 text-right tabular-nums">{i === 0 ? "—" : `+${it.difPerc.toFixed(1)}%`}</td>
                      <td className="p-1.5 text-center tabular-nums">{fmtDataBR(it.ultimaCompraData)}</td>
                      <td className="p-1.5 text-right tabular-nums">
                        {it.ultimaCompraPorRef == null ? "—" : fmtMoeda(it.ultimaCompraPorRef)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
