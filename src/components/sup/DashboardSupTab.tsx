import { useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line } from "recharts";
import { useSupFornecedores } from "@/components/sup/FornecedoresTab";
import { useSupPedidoItens, useSupPedidos } from "@/components/sup/PedidosCompraTab";
import { useSupProdutos } from "@/components/sup/ProdutosTab";
import {
  SUP_EMPRESAS, SUP_EMPRESA_LABEL, calcTotaisPedido, competenciaLabel, economiaItem, fmtMoeda, n,
  subtotalItem, type SupPedidoItem,
} from "@/lib/sup";

export function DashboardSupTab() {
  const { data: pedidos = [] } = useSupPedidos();
  const { data: itens = [] } = useSupPedidoItens();
  const { data: fornecedores = [] } = useSupFornecedores();
  const { data: produtos = [] } = useSupProdutos();

  const [empresa, setEmpresa] = usePersistedState("sup:dashboard:empresa", "todas");
  const [de, setDe] = usePersistedState("sup:dashboard:de", "");
  const [ate, setAte] = usePersistedState("sup:dashboard:ate", "");

  const itensPorPedido = useMemo(() => {
    const m = new Map<string, SupPedidoItem[]>();
    for (const i of itens) {
      const arr = m.get(i.pedido_id) ?? [];
      arr.push(i);
      m.set(i.pedido_id, arr);
    }
    return m;
  }, [itens]);

  const base = useMemo(() => {
    return pedidos
      .filter((p) => {
        if (p.status === "cancelado") return false;
        if (empresa !== "todas" && p.empresa !== empresa) return false;
        if (de && p.data_pedido < de) return false;
        if (ate && p.data_pedido > ate) return false;
        return true;
      })
      .map((p) => {
        const its = itensPorPedido.get(p.id) ?? [];
        const t = calcTotaisPedido(its, {
          desconto_global_tipo: p.desconto_global_tipo,
          desconto_global_valor: p.desconto_global_valor,
          frete_valor: p.frete_valor,
          comissao_percentual: p.comissao_percentual,
        });
        return { p, its, t };
      });
  }, [pedidos, itensPorPedido, empresa, de, ate]);

  const kpis = base.reduce(
    (acc, r) => {
      acc.pedidos += 1;
      acc.custo += r.t.custo_total;
      acc.economia += r.t.economia_total;
      acc.comissao += r.t.comissao_prevista;
      return acc;
    },
    { pedidos: 0, custo: 0, economia: 0, comissao: 0 },
  );

  const porMes = useMemo(() => {
    const m = new Map<string, { comp: string; custo: number; economia: number }>();
    for (const r of base) {
      const comp = r.p.data_pedido.slice(0, 7);
      const cur = m.get(comp) ?? { comp, custo: 0, economia: 0 };
      cur.custo += r.t.custo_total;
      cur.economia += r.t.economia_total;
      m.set(comp, cur);
    }
    return [...m.values()].sort((a, b) => a.comp.localeCompare(b.comp)).map((x) => ({ ...x, label: competenciaLabel(x.comp) }));
  }, [base]);

  const porFornecedor = useMemo(() => {
    const m = new Map<string, { nome: string; custo: number; economia: number }>();
    for (const r of base) {
      const nome = fornecedores.find((f) => f.id === r.p.fornecedor_id)?.razao_social ?? "—";
      const cur = m.get(r.p.fornecedor_id) ?? { nome, custo: 0, economia: 0 };
      cur.custo += r.t.custo_total;
      cur.economia += r.t.economia_total;
      m.set(r.p.fornecedor_id, cur);
    }
    return [...m.values()].sort((a, b) => b.custo - a.custo).slice(0, 10);
  }, [base, fornecedores]);

  const porProduto = useMemo(() => {
    const m = new Map<string, { nome: string; qtd: number; gasto: number; economia: number }>();
    for (const r of base) {
      for (const i of r.its) {
        const nome = produtos.find((p) => p.id === i.produto_id)?.nome ?? "—";
        const cur = m.get(i.produto_id) ?? { nome, qtd: 0, gasto: 0, economia: 0 };
        cur.qtd += n(i.quantidade);
        cur.gasto += subtotalItem(i);
        cur.economia += economiaItem(i);
        m.set(i.produto_id, cur);
      }
    }
    return [...m.values()].sort((a, b) => b.gasto - a.gasto).slice(0, 15);
  }, [base, produtos]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-36">
          <Label className="text-xs">Empresa</Label>
          <Select value={empresa} onValueChange={setEmpresa}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {SUP_EMPRESAS.map((e) => <SelectItem key={e} value={e}>{SUP_EMPRESA_LABEL[e]}</SelectItem>)}
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
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Card label="Pedidos" valor={String(kpis.pedidos)} />
        <Card label="Custo total" valor={fmtMoeda(kpis.custo)} />
        <Card label="Economia gerada" valor={fmtMoeda(kpis.economia)} classe="text-emerald-800" />
        <Card label="Comissão prevista" valor={fmtMoeda(kpis.comissao)} classe="text-teal-800" />
      </div>

      <div className="rounded-md border bg-card p-3">
        <div className="text-xs font-semibold uppercase tracking-wider mb-2">Custo e economia por mês</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={porMes}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => fmtMoeda(v)} />
              <Legend />
              <Line type="monotone" dataKey="custo" name="Custo" stroke="#0f766e" strokeWidth={2} />
              <Line type="monotone" dataKey="economia" name="Economia" stroke="#059669" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-md border bg-card p-3">
        <div className="text-xs font-semibold uppercase tracking-wider mb-2">Top fornecedores</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porFornecedor}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => fmtMoeda(v)} />
              <Legend />
              <Bar dataKey="custo" name="Custo" fill="#0f766e" />
              <Bar dataKey="economia" name="Economia" fill="#34d399" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider bg-muted/40">Produtos mais comprados</div>
        <table className="w-full text-[13px]">
          <thead className="bg-muted/20">
            <tr className="text-xs">
              <th className="p-1.5 text-left">Produto</th>
              <th className="p-1.5 text-right">Quantidade</th>
              <th className="p-1.5 text-right">Gasto</th>
              <th className="p-1.5 text-right">Economia</th>
            </tr>
          </thead>
          <tbody>
            {porProduto.length === 0 ? (
              <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">Sem dados.</td></tr>
            ) : porProduto.map((r) => (
              <tr key={r.nome} className="border-t">
                <td className="p-1.5">{r.nome}</td>
                <td className="p-1.5 text-right tabular-nums">{r.qtd.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</td>
                <td className="p-1.5 text-right font-semibold tabular-nums">{fmtMoeda(r.gasto)}</td>
                <td className="p-1.5 text-right tabular-nums text-emerald-700">{fmtMoeda(r.economia)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, valor, classe }: { label: string; valor: string; classe?: string }) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${classe ?? ""}`}>{valor}</div>
    </div>
  );
}
