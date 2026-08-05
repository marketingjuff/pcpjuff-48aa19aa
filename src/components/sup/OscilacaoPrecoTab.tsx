import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSupFornecedores } from "@/components/sup/FornecedoresTab";
import { useSupFornecedorProdutos, useSupProdutos, useSupProdutoGrupos } from "@/components/sup/ProdutosTab";
import { competenciaLabel, fmtMoeda, n, type SupPrecoHistorico } from "@/lib/sup";

interface Props {
  de: string;
  ate: string;
}

const CORES = ["#0d9488", "#6366f1", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#0ea5e9", "#e11d48"];

function mesDe(iso: string) {
  return iso.slice(0, 7);
}

function mesesEntre(inicio: string, fim: string): string[] {
  const out: string[] = [];
  let [a, m] = inicio.split("-").map(Number);
  const [fa, fm] = fim.split("-").map(Number);
  while (a! < fa! || (a === fa && m! <= fm!)) {
    out.push(`${String(a).padStart(4, "0")}-${String(m).padStart(2, "0")}`);
    m!++;
    if (m! > 12) { m = 1; a!++; }
  }
  return out;
}

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

function mesMenos(mes: string, qtd: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a!, m! - 1 - qtd, 1));
  return d.toISOString().slice(0, 7);
}

/** Evolução mensal do preço. Somente leitura, ignora registros anulados. */
export function OscilacaoPrecoTab({ de, ate }: Props) {
  const { data: fornecedores = [] } = useSupFornecedores();
  const { data: produtos = [] } = useSupProdutos();
  const { data: vinculos = [] } = useSupFornecedorProdutos();
  const { data: grupos = [] } = useSupProdutoGrupos();

  const [modo, setModo] = useState<"grupo" | "produto">("grupo");
  const [grupoId, setGrupoId] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [comNegociado, setComNegociado] = useState(false);

  const { data: historico = [] } = useQuery({
    queryKey: ["sup-oscilacao-historico"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sup_preco_historico")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as SupPrecoHistorico[];
    },
  });

  const gruposAtivos = useMemo(() => grupos.filter((g) => g.ativo), [grupos]);
  const produtosOrdenados = useMemo(
    () => produtos.filter((p) => p.ativo).slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [produtos],
  );

  const nomeForn = (id: string | null | undefined) => {
    const f = fornecedores.find((x) => x.id === id);
    return f?.nome_fantasia || f?.razao_social || "—";
  };

  /** Séries por fornecedor (e por tipo), já convertidas quando for grupo. */
  const dados = useMemo(() => {
    const grupo = gruposAtivos.find((g) => g.id === grupoId) ?? null;
    const produtoSel = produtos.find((p) => p.id === produtoId) ?? null;

    const alvos: Array<{ vinculoId: string; label: string; fator: number }> = [];
    if (modo === "grupo" && grupo) {
      for (const p of produtos.filter((x) => x.grupo_id === grupo.id && x.fornecedor_id)) {
        const v = vinculos.find((x) => x.produto_id === p.id && x.fornecedor_id === p.fornecedor_id);
        if (!v) continue;
        const fator = n(p.fator_conversao);
        if (fator <= 0) continue;
        alvos.push({ vinculoId: v.id, label: nomeForn(p.fornecedor_id), fator });
      }
    } else if (modo === "produto" && produtoSel) {
      const v = vinculos.find((x) => x.produto_id === produtoSel.id && x.fornecedor_id === produtoSel.fornecedor_id);
      if (v) alvos.push({ vinculoId: v.id, label: nomeForn(produtoSel.fornecedor_id), fator: 1 });
    }
    if (alvos.length === 0) return null;

    const tipos: Array<"tabela" | "negociado"> = comNegociado ? ["tabela", "negociado"] : ["tabela"];

    // Alterações relevantes: último preço por (alvo, tipo, mês).
    type Alt = { mes: string; valor: number };
    const porSerie = new Map<string, { label: string; tipo: string; alts: Alt[] }>();
    for (const alvo of alvos) {
      for (const tipo of tipos) {
        const regs = historico
          .filter((h) => h.fornecedor_produto_id === alvo.vinculoId && (h.tipo ?? "tabela") === tipo && !h.anulado);
        const porMes = new Map<string, number>();
        for (const h of regs) porMes.set(mesDe(h.created_at), n(h.preco_novo) / alvo.fator);
        if (porMes.size === 0) continue;
        const alts = [...porMes.entries()].map(([mes, valor]) => ({ mes, valor })).sort((a, b) => a.mes.localeCompare(b.mes));
        const chave = `${alvo.label}${tipo === "negociado" ? " (negociado)" : ""}`;
        const atual = porSerie.get(chave);
        if (atual) atual.alts.push(...alts);
        else porSerie.set(chave, { label: chave, tipo, alts });
      }
    }
    if (porSerie.size === 0) return null;

    const todosMeses = [...porSerie.values()].flatMap((s) => s.alts.map((a) => a.mes)).sort();
    const primeiro = todosMeses[0]!;
    const inicio = de ? mesDe(de) : primeiro < mesMenos(mesAtual(), 23) ? mesMenos(mesAtual(), 23) : primeiro;
    const fim = ate ? mesDe(ate) : mesAtual();
    const meses = mesesEntre(inicio < primeiro ? primeiro : inicio, fim >= inicio ? fim : inicio);

    const series = [...porSerie.values()].map((s) => {
      s.alts.sort((a, b) => a.mes.localeCompare(b.mes));
      return s;
    });

    const chart = meses.map((mes) => {
      const row: Record<string, any> = { mes, label: competenciaLabel(mes) };
      for (const s of series) {
        const validos = s.alts.filter((a) => a.mes <= mes);
        row[s.label] = validos.length ? validos[validos.length - 1]!.valor : null;
        row[`${s.label}__alt`] = s.alts.some((a) => a.mes === mes);
      }
      return row;
    });

    const resumo = series.map((s) => {
      const pontos = chart.map((r) => r[s.label]).filter((v): v is number => typeof v === "number");
      if (pontos.length === 0) return null;
      let menor = pontos[0]!, maior = pontos[0]!, mesMenor = "", mesMaior = "";
      for (const r of chart) {
        const v = r[s.label];
        if (typeof v !== "number") continue;
        if (v <= menor) { menor = v; mesMenor = r.mes; }
        if (v >= maior) { maior = v; mesMaior = r.mes; }
      }
      const atualV = pontos[pontos.length - 1]!;
      const primeiroV = pontos[0]!;
      return {
        label: s.label,
        menor, mesMenor, maior, mesMaior,
        amplitude: menor > 0 ? ((maior - menor) / menor) * 100 : null,
        atual: atualV,
        variacaoPeriodo: primeiroV > 0 ? ((atualV - primeiroV) / primeiroV) * 100 : null,
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    return { chart, series, meses, resumo, unidade: modo === "grupo" ? grupo?.unidade_referencia ?? "un." : produtoSel?.unidade ?? "un." };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, grupoId, produtoId, comNegociado, historico, produtos, vinculos, gruposAtivos, fornecedores, de, ate]);

  const selecionou = (modo === "grupo" && !!grupoId) || (modo === "produto" && !!produtoId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-52">
          <Label className="text-xs">Modo</Label>
          <Select value={modo} onValueChange={(v) => setModo(v as any)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="grupo">Por item equivalente (grupo)</SelectItem>
              <SelectItem value="produto">Por produto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {modo === "grupo" ? (
          <div className="w-72">
            <Label className="text-xs">Item equivalente</Label>
            <Select value={grupoId} onValueChange={setGrupoId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
              <SelectContent>
                {gruposAtivos.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.nome} · por {g.unidade_referencia}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="w-72">
            <Label className="text-xs">Produto</Label>
            <Select value={produtoId} onValueChange={setProdutoId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
              <SelectContent>
                {produtosOrdenados.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <label className="flex items-center gap-1.5 text-xs pb-2.5 cursor-pointer">
          <Checkbox checked={comNegociado} onCheckedChange={(v) => setComNegociado(!!v)} />
          Mostrar preço negociado
        </label>
      </div>

      {!selecionou || !dados ? (
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground text-center">
          {selecionou
            ? "Ainda não há histórico de preço suficiente para este item. O gráfico se preenche conforme as alterações de preço forem registradas."
            : "Selecione um item equivalente ou um produto para ver a oscilação de preço."}
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-card p-3">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2">
              Evolução mensal — R$ / {dados.unidade}
            </div>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dados.chart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtMoeda(v)} width={90} />
                  <Tooltip
                    formatter={(v: any, name: any, item: any) => {
                      const idx = dados.chart.findIndex((r) => r.mes === item?.payload?.mes);
                      const alt = item?.payload?.[`${name}__alt`];
                      const ant = idx > 0 ? dados.chart[idx - 1]![name] : null;
                      const varPct = alt && typeof ant === "number" && ant > 0 ? ((Number(v) - ant) / ant) * 100 : null;
                      return [
                        `${fmtMoeda(v)}${varPct == null ? "" : ` (${varPct > 0 ? "+" : ""}${varPct.toFixed(1)}%)`}`,
                        name,
                      ];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {dados.series.map((s, i) => (
                    <Line
                      key={s.label}
                      type="monotone"
                      dataKey={s.label}
                      stroke={CORES[i % CORES.length]}
                      strokeWidth={2}
                      strokeDasharray={s.tipo === "negociado" ? "5 4" : undefined}
                      connectNulls
                      dot={(props: any) =>
                        props.payload?.[`${s.label}__alt`]
                          ? <circle key={`${s.label}-${props.index}`} cx={props.cx} cy={props.cy} r={4} fill={CORES[i % CORES.length]} />
                          : (<g key={`${s.label}-${props.index}`} />)
                      }
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {dados.meses.length < 12 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[12px] text-amber-900">
              Série com {dados.meses.length} meses. Leituras de sazonalidade ficam confiáveis a partir de 12 meses de histórico.
            </div>
          )}

          <div className="rounded-md border bg-card overflow-hidden">
            <div className="px-3 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wider">
              Resumo por fornecedor no período exibido
            </div>
            <table className="w-full text-[12.5px]">
              <thead className="bg-muted/20">
                <tr className="text-xs">
                  <th className="p-1.5 text-left">Fornecedor</th>
                  <th className="p-1.5 text-right">Menor preço (mês)</th>
                  <th className="p-1.5 text-right">Maior preço (mês)</th>
                  <th className="p-1.5 text-right">Amplitude %</th>
                  <th className="p-1.5 text-right">Preço atual</th>
                  <th className="p-1.5 text-right">Variação no período %</th>
                </tr>
              </thead>
              <tbody>
                {dados.resumo.map((r) => (
                  <tr key={r.label} className="border-t">
                    <td className="p-1.5">{r.label}</td>
                    <td className="p-1.5 text-right tabular-nums">
                      {fmtMoeda(r.menor)} <span className="text-muted-foreground">({competenciaLabel(r.mesMenor)})</span>
                    </td>
                    <td className="p-1.5 text-right tabular-nums">
                      {fmtMoeda(r.maior)} <span className="text-muted-foreground">({competenciaLabel(r.mesMaior)})</span>
                    </td>
                    <td className="p-1.5 text-right font-semibold tabular-nums">
                      {r.amplitude == null ? "—" : `${r.amplitude.toFixed(1)}%`}
                    </td>
                    <td className="p-1.5 text-right tabular-nums">{fmtMoeda(r.atual)}</td>
                    <td className={`p-1.5 text-right font-semibold tabular-nums ${r.variacaoPeriodo == null ? "" : r.variacaoPeriodo > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      {r.variacaoPeriodo == null ? "—" : `${r.variacaoPeriodo > 0 ? "+" : ""}${r.variacaoPeriodo.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
