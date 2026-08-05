import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useSupFornecedores } from "@/components/sup/FornecedoresTab";
import { useSupProdutos, useSupProdutoGrupos } from "@/components/sup/ProdutosTab";
import { useSupPedidos, useSupPedidoItens } from "@/components/sup/PedidosCompraTab";
import { fmtDataBR, fmtMoeda, fmtQtd, n, variacaoPreco } from "@/lib/sup";

interface Props {
  de: string;
  ate: string;
}

type Linha = {
  key: string;
  data: string;
  pc: string;
  grupo: string;
  fornecedorAnterior: string | null;
  precoRefAnterior: number | null;
  fornecedorAtual: string;
  precoRefAtual: number;
  deltaPct: number | null;
  qtdRef: number;
  economiaRs: number;
};

/** Economia por troca de fornecedor — indicador de referência, sem relação com comissão. */
export function EconomiaTrocaTab({ de, ate }: Props) {
  const { data: fornecedores = [] } = useSupFornecedores();
  const { data: produtos = [] } = useSupProdutos();
  const { data: grupos = [] } = useSupProdutoGrupos();
  const { data: pedidos = [] } = useSupPedidos();
  const { data: itens = [] } = useSupPedidoItens();

  const linhas = useMemo<Linha[]>(() => {
    const pedidoPorId = new Map(pedidos.map((p) => [p.id, p]));
    const produtoPorId = new Map(produtos.map((p) => [p.id, p]));
    const grupoPorId = new Map(grupos.map((g) => [g.id, g]));
    const nomeForn = (id: string | null | undefined) => {
      const f = fornecedores.find((x) => x.id === id);
      return f?.nome_fantasia || f?.razao_social || "—";
    };

    // Todos os itens elegíveis (grupo definido, pedido não cancelado), em ordem cronológica.
    const base = itens
      .map((it) => {
        const pc = pedidoPorId.get(it.pedido_id);
        const prod = produtoPorId.get(it.produto_id);
        if (!pc || !prod || pc.status === "cancelado") return null;
        if (!prod.grupo_id) return null;
        const fator = n(prod.fator_conversao);
        if (fator <= 0) return null;
        return {
          it,
          pc,
          prod,
          fator,
          created_at: (it as any).created_at ?? "",
          precoRef: n(it.preco_negociado) / fator,
          qtdRef: n(it.quantidade) * fator,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) =>
        a.pc.data_pedido.localeCompare(b.pc.data_pedido) || a.created_at.localeCompare(b.created_at),
      );

    const out: Linha[] = [];
    for (const cur of base) {
      const dia = cur.pc.data_pedido;
      if (de && dia < de) continue;
      if (ate && dia > ate) continue;

      // Última compra do mesmo grupo, de fornecedor diferente, com data anterior.
      const candidatos = base.filter(
        (o) =>
          o.prod.grupo_id === cur.prod.grupo_id &&
          o.pc.fornecedor_id !== cur.pc.fornecedor_id &&
          o.pc.data_pedido < dia,
      );
      const ref = candidatos.length
        ? candidatos.reduce((best, o) =>
            o.pc.data_pedido > best.pc.data_pedido ||
            (o.pc.data_pedido === best.pc.data_pedido && o.created_at > best.created_at)
              ? o
              : best,
          )
        : null;

      const precoRefAnterior = ref ? ref.precoRef : null;
      const economiaUnit = precoRefAnterior == null ? 0 : precoRefAnterior - cur.precoRef;
      out.push({
        key: cur.it.id,
        data: dia,
        pc: cur.pc.numero ?? "—",
        grupo: grupoPorId.get(cur.prod.grupo_id!)?.nome ?? "—",
        fornecedorAnterior: ref ? nomeForn(ref.pc.fornecedor_id) : null,
        precoRefAnterior,
        fornecedorAtual: nomeForn(cur.pc.fornecedor_id),
        precoRefAtual: cur.precoRef,
        deltaPct: precoRefAnterior == null ? null : variacaoPreco(precoRefAnterior, cur.precoRef),
        qtdRef: cur.qtdRef,
        economiaRs: precoRefAnterior == null ? 0 : economiaUnit * cur.qtdRef,
      });
    }
    return out.reverse();
  }, [pedidos, itens, produtos, grupos, fornecedores, de, ate]);

  const totais = useMemo(() => {
    let soma = 0, ganhos = 0, perdas = 0;
    for (const l of linhas) {
      soma += l.economiaRs;
      if (l.economiaRs > 0) ganhos++;
      else if (l.economiaRs < 0) perdas++;
    }
    return { soma, ganhos, perdas };
  }, [linhas]);

  function num(v: number) {
    return v.toFixed(2).replace(".", ",");
  }

  function exportarCsv() {
    const cab = [
      "Data", "PC", "Grupo", "Fornecedor anterior", "R$/un. ref anterior", "Fornecedor atual",
      "R$/un. ref atual", "Variação %", "Qtd (un. ref)", "Economia R$",
    ];
    const linhasCsv = linhas.map((l) => [
      fmtDataBR(l.data),
      l.pc,
      l.grupo,
      l.fornecedorAnterior ?? "—",
      l.precoRefAnterior == null ? "—" : num(l.precoRefAnterior),
      l.fornecedorAtual,
      num(l.precoRefAtual),
      l.deltaPct == null ? "—" : num(l.deltaPct),
      num(l.qtdRef),
      num(l.economiaRs),
    ]);
    const csv = [cab, ...linhasCsv].map((r) => r.join(";")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "economia-por-troca.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider">Economia por troca de fornecedor</div>
          <div className="text-[11px] text-muted-foreground">
            Indicador de referência. Não entra na apuração de comissão.
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={exportarCsv} disabled={linhas.length === 0}>
          <Download className="h-4 w-4 mr-1" />Exportar CSV
        </Button>
      </div>

      <div className="rounded-md border bg-card overflow-auto max-h-[70vh]">
        <table className="w-full text-[12.5px] tbl-congelada">
          <thead className="bg-muted/40">
            <tr className="text-xs">
              <th className="p-1.5 text-left">Data</th>
              <th className="p-1.5 text-left">PC</th>
              <th className="p-1.5 text-left">Grupo</th>
              <th className="p-1.5 text-left">Fornecedor anterior</th>
              <th className="p-1.5 text-right">R$/un. ref anterior</th>
              <th className="p-1.5 text-left">Fornecedor atual</th>
              <th className="p-1.5 text-right">R$/un. ref atual</th>
              <th className="p-1.5 text-right">Δ%</th>
              <th className="p-1.5 text-right">Qtd (un. ref)</th>
              <th className="p-1.5 text-right">Economia R$</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">
                Nenhuma compra de item equivalente no período.
              </td></tr>
            ) : linhas.map((l) => (
              <tr key={l.key} className="border-t">
                <td className="p-1.5 whitespace-nowrap tabular-nums">{fmtDataBR(l.data)}</td>
                <td className="p-1.5">{l.pc}</td>
                <td className="p-1.5">{l.grupo}</td>
                <td className="p-1.5">
                  {l.fornecedorAnterior ?? (
                    <span className="text-muted-foreground text-[11px]">— primeira compra do grupo neste fornecedor</span>
                  )}
                </td>
                <td className="p-1.5 text-right tabular-nums">
                  {l.precoRefAnterior == null ? "—" : fmtMoeda(l.precoRefAnterior)}
                </td>
                <td className="p-1.5">{l.fornecedorAtual}</td>
                <td className="p-1.5 text-right tabular-nums">{fmtMoeda(l.precoRefAtual)}</td>
                <td className={`p-1.5 text-right tabular-nums font-semibold ${l.deltaPct == null ? "" : l.deltaPct > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {l.deltaPct == null ? "—" : `${l.deltaPct > 0 ? "+" : ""}${l.deltaPct.toFixed(1)}%`}
                </td>
                <td className="p-1.5 text-right tabular-nums">{fmtQtd(l.qtdRef)}</td>
                <td className={`p-1.5 text-right tabular-nums font-semibold ${l.economiaRs < 0 ? "text-rose-700" : l.economiaRs > 0 ? "text-emerald-700" : ""}`}>
                  {fmtMoeda(l.economiaRs)}
                </td>
              </tr>
            ))}
          </tbody>
          {linhas.length > 0 && (
            <tfoot className="bg-muted/30 border-t">
              <tr className="text-[12.5px]">
                <td colSpan={9} className="p-1.5 text-right">
                  Total do período · {totais.ganhos} troca(s) com economia · {totais.perdas} com encarecimento
                </td>
                <td className={`p-1.5 text-right font-semibold tabular-nums ${totais.soma < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {fmtMoeda(totais.soma)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
