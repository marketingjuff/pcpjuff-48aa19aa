import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { SortTh, useTableSort } from "@/components/shared/sortable";
import { Combobox } from "@/components/shared/combobox";

import { useSupFornecedores } from "@/components/sup/FornecedoresTab";
import { PedidoCompraDialog } from "@/components/sup/PedidoCompraDialog";
import {
  SUP_EMPRESAS, SUP_EMPRESA_LABEL, SUP_STATUS_CLASSE, SUP_STATUS_LABEL, SUP_STATUS_PC,
  calcTotaisPedido, comissaoPercentualEfetiva, fmtDataBR, fmtMoeda, n,
  type SupPedidoCompra, type SupPedidoItem, type SupStatusPc,
} from "@/lib/sup";
import { useIsAdmin } from "@/hooks/use-role";

export function useSupPedidos() {
  return useQuery({
    queryKey: ["sup-pedidos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sup_pedidos_compra")
        .select("*")
        .order("data_pedido", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupPedidoCompra[];
    },
  });
}

export function useSupPedidoItens() {
  return useQuery({
    queryKey: ["sup-pedido-itens"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sup_pedido_itens")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as SupPedidoItem[];
    },
  });
}

interface Props {
  pcId?: string;
  fornecedorId?: string;
}

export function PedidosCompraTab({ pcId, fornecedorId }: Props) {
  const isAdmin = useIsAdmin();
  const { data: pedidos = [], isLoading } = useSupPedidos();
  const { data: itens = [] } = useSupPedidoItens();
  const { data: fornecedores = [] } = useSupFornecedores();

  const [status, setStatus] = useState<string>("todos");
  const [empresa, setEmpresa] = useState<string>("todas");
  const [forn, setForn] = useState<string>(fornecedorId ?? "todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);

  useEffect(() => { if (fornecedorId) setForn(fornecedorId); }, [fornecedorId]);
  useEffect(() => { if (pcId) setAbertoId(pcId); }, [pcId]);

  const itensPorPedido = useMemo(() => {
    const m = new Map<string, SupPedidoItem[]>();
    for (const i of itens) {
      const arr = m.get(i.pedido_id) ?? [];
      arr.push(i);
      m.set(i.pedido_id, arr);
    }
    return m;
  }, [itens]);

  const nomeForn = (id: string) => fornecedores.find((f) => f.id === id)?.razao_social ?? "—";

  const linhas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return pedidos
      .filter((p) => {
        if (status !== "todos" && p.status !== status) return false;
        if (empresa !== "todas" && p.empresa !== empresa) return false;
        if (forn !== "todos" && p.fornecedor_id !== forn) return false;
        if (de && p.data_pedido < de) return false;
        if (ate && p.data_pedido > ate) return false;
        if (b && !`${p.numero ?? ""} ${nomeForn(p.fornecedor_id)}`.toLowerCase().includes(b)) return false;
        return true;
      })
      .map((p) => {
        const its = itensPorPedido.get(p.id) ?? [];
        const t = calcTotaisPedido(its, {
          desconto_global_tipo: p.desconto_global_tipo,
          desconto_global_valor: p.desconto_global_valor,
          frete_valor: p.frete_valor,
          comissao_percentual: comissaoPercentualEfetiva(p),
        });
        return { p, its, t };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos, itensPorPedido, status, empresa, forn, de, ate, busca, fornecedores]);

  const { rows: ordenadas, sortKey, sortDir, toggle } = useTableSort(linhas, {
    numero: (r) => r.p.numero,
    data_pedido: (r) => r.p.data_pedido,
    empresa: (r) => r.p.empresa,
    fornecedor: (r) => nomeForn(r.p.fornecedor_id),
    status: (r) => r.p.status,
    total: (r) => r.t.total_pedido,
    economia: (r) => r.t.economia_total,
  }, { key: "data_pedido", dir: "desc" });

  const totais = ordenadas.reduce(
    (acc, r) => {
      if (r.p.status === "cancelado") return acc;
      acc.total += r.t.total_pedido;
      acc.custo += r.t.custo_total;
      acc.economia += r.t.economia_total;
      return acc;
    },
    { total: 0, custo: 0, economia: 0 },
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {SUP_STATUS_PC.map((s) => <SelectItem key={s} value={s}>{SUP_STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-32">
          <Label className="text-xs">Empresa</Label>
          <Select value={empresa} onValueChange={setEmpresa}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {SUP_EMPRESAS.map((e) => <SelectItem key={e} value={e}>{SUP_EMPRESA_LABEL[e]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-56">
          <Label className="text-xs">Fornecedor</Label>
          <Combobox
            value={forn}
            onChange={setForn}
            options={[
              { value: "todos", label: "Todos" },
              ...fornecedores.map((f) => ({
                value: f.id,
                label: f.razao_social,
                hint: f.nome_fantasia ?? undefined,
              })),
            ]}
            placeholder="Todos"
            searchPlaceholder="Buscar fornecedor…"
          />
        </div>

        <div className="w-36">
          <Label className="text-xs">De</Label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9" />
        </div>
        <div className="w-36">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9" />
        </div>
        <div className="w-48">
          <Label className="text-xs">Busca</Label>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nº PC, fornecedor" className="h-9" />
        </div>
        <div className="ml-auto">
          <Button className="h-9 bg-teal-600 hover:bg-teal-700 text-white" onClick={() => setNovoOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo pedido de compra
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label="Pedidos" valor={String(ordenadas.length)} />
        <Kpi label="Total dos pedidos" valor={fmtMoeda(totais.total)} />
        <Kpi label="Custo com frete" valor={fmtMoeda(totais.custo)} />
        <Kpi label="Economia gerada" valor={fmtMoeda(totais.economia)} destaque />
      </div>

      <div className="rounded-md border bg-card overflow-auto max-h-[68vh]">
        <table className="w-full text-[13px] tbl-congelada">
          <thead className="bg-muted/40">
            <tr className="text-xs">
              <SortTh label="Nº PC" sortKey="numero" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
              <SortTh label="Data" sortKey="data_pedido" current={sortKey} dir={sortDir} onSort={toggle} />
              <SortTh label="Empresa" sortKey="empresa" current={sortKey} dir={sortDir} onSort={toggle} />
              <SortTh label="Fornecedor" sortKey="fornecedor" current={sortKey} dir={sortDir} onSort={toggle} className="text-left" />
              <SortTh label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={toggle} />
              <th className="p-1.5 font-medium text-center">Itens</th>
              <SortTh label="Total" sortKey="total" current={sortKey} dir={sortDir} onSort={toggle} className="text-right" />
              {isAdmin && <SortTh label="Economia" sortKey="economia" current={sortKey} dir={sortDir} onSort={toggle} className="text-right" />}
              <th className="p-1.5 font-medium text-center">Previsão</th>
              <th className="p-1.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>
            ) : ordenadas.length === 0 ? (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Nenhum pedido de compra.</td></tr>
            ) : ordenadas.map(({ p, its, t }) => (
              <tr key={p.id} className="border-t hover:bg-muted/20">
                <td className="p-1.5 font-semibold tabular-nums">{p.numero ?? "—"}</td>
                <td className="p-1.5 text-center tabular-nums">{fmtDataBR(p.data_pedido)}</td>
                <td className="p-1.5 text-center">{SUP_EMPRESA_LABEL[p.empresa as "joke" | "juff"] ?? p.empresa}</td>
                <td className="p-1.5">{nomeForn(p.fornecedor_id)}</td>
                <td className="p-1.5 text-center">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${SUP_STATUS_CLASSE[p.status as SupStatusPc] ?? "bg-muted"}`}>
                    {SUP_STATUS_LABEL[p.status as SupStatusPc] ?? p.status}
                  </span>
                </td>
                <td className="p-1.5 text-center tabular-nums">{its.length}</td>
                <td className="p-1.5 text-right font-semibold tabular-nums">{fmtMoeda(t.total_pedido)}</td>
                {isAdmin && (
                  <td className="p-1.5 text-right font-semibold tabular-nums text-emerald-700">{fmtMoeda(t.economia_total)}</td>
                )}
                <td className="p-1.5 text-center tabular-nums">{fmtDataBR(p.previsao_entrega)}</td>
                <td className="p-1.5 text-right">
                  <Button size="sm" variant="outline" className="h-7" onClick={() => setAbertoId(p.id)}>Abrir</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PedidoCompraDialog
        open={!!abertoId || novoOpen}
        pedidoId={abertoId}
        onOpenChange={(v) => { if (!v) { setAbertoId(null); setNovoOpen(false); } }}
      />
    </div>
  );
}

function Kpi({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-md border bg-card p-2.5 ${destaque ? "border-emerald-300 bg-emerald-50/60" : ""}`}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${destaque ? "text-emerald-800" : ""}`}>{valor}</div>
    </div>
  );
}
