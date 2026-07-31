import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { REFACAO_MODELOS } from "@/lib/pedidos";
import {
  parsePlanilhaOlist,
  empresaPeloNome,
  type EmpresaOlist,
  type ItemOlist,
  type LinhaIgnorada,
} from "@/lib/estoque-olist";
import { useTableSort, SortTh } from "@/components/shared/sortable";
import { PendenciaMapeamentoAlert } from "./PendenciaMapeamentoAlert";


const EMPRESAS: EmpresaOlist[] = ["JOKE", "JUFF"];

interface Snapshot {
  id: string;
  empresa: EmpresaOlist;
  arquivo_nome: string | null;
  importado_em: string;
  total_linhas: number;
  linhas_ignoradas: LinhaIgnorada[];
}

function fmtDataHora(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function useSnapshotsRecentes() {
  return useQuery({
    queryKey: ["estoque-olist", "snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_olist_snapshots" as any)
        .select("*")
        .order("importado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Snapshot[];
    },
  });
}

export function useItensUltimoSnapshot() {
  const { data: snaps = [] } = useSnapshotsRecentes();
  const ultimos = useMemo(() => {
    const m = new Map<EmpresaOlist, Snapshot>();
    for (const s of snaps) if (!m.has(s.empresa)) m.set(s.empresa, s);
    return m;
  }, [snaps]);
  const ids = useMemo(() => Array.from(ultimos.values()).map((s) => s.id).sort(), [ultimos]);

  const q = useQuery({
    queryKey: ["estoque-olist", "itens", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      // Paginação obrigatória: o Data API limita cada resposta a 1000 linhas.
      type Row = ItemOlist & { empresa: EmpresaOlist; snapshot_id: string };
      const out: Row[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("estoque_olist_itens" as any)
          .select("*")
          .in("snapshot_id", ids)
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const page = (data ?? []) as unknown as Row[];
        out.push(...page);
        if (page.length < PAGE) break;
      }
      return out;
    },
  });

  return { ultimos, itens: q.data ?? [], isLoading: q.isLoading };
}

export function useProdutoMap() {
  return useQuery({
    queryKey: ["estoque-olist", "produto-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("olist_produto_map" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; produto_olist: string; modelo_cop: string }[];
    },
  });
}

export function AlimentacaoEstoqueTab() {
  const qc = useQueryClient();
  const { data: snaps = [] } = useSnapshotsRecentes();
  const { ultimos, itens } = useItensUltimoSnapshot();
  const { data: mapa = [] } = useProdutoMap();
  const [busca, setBusca] = useState("");
  const [empresaPrevia, setEmpresaPrevia] = useState<EmpresaOlist>("JOKE");
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});


  const ultimaGeral = snaps[0]?.importado_em ?? null;

  const importar = useMutation({
    mutationFn: async ({ file, empresa }: { file: File; empresa: EmpresaOlist }) => {
      const parsed = await parsePlanilhaOlist(file);
      if (parsed.itens.length === 0) throw new Error("Nenhuma linha válida encontrada na planilha.");
      const { data: user } = await supabase.auth.getUser();
      const { data: snap, error: e1 } = await supabase
        .from("estoque_olist_snapshots" as any)
        .insert({
          empresa,
          arquivo_nome: file.name,
          importado_por: user.user?.id ?? null,
          total_linhas: parsed.totalLinhas,
          linhas_ignoradas: parsed.ignoradas,
        } as any)
        .select("id")
        .single();
      if (e1) throw e1;
      const snapshotId = (snap as any).id as string;
      const rows = parsed.itens.map((it) => ({ ...it, empresa, snapshot_id: snapshotId }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error: e2 } = await supabase.from("estoque_olist_itens" as any).insert(rows.slice(i, i + 500) as any);
        if (e2) throw e2;
      }
      return parsed;
    },
    onSuccess: (parsed, vars) => {
      qc.invalidateQueries({ queryKey: ["estoque-olist"] });
      
      toast.success(
        `${vars.empresa}: ${parsed.totalLinhas} linha(s) lida(s), ${parsed.itens.length} combinação(ões) agregada(s)` +
          (parsed.ignoradas.length ? `, ${parsed.ignoradas.length} ignorada(s)` : ""),
      );
      if (parsed.ignoradas.length) {
        const ex = parsed.ignoradas.slice(0, 3).map((l) => `linha ${l.linha}: ${l.motivo}`).join(" · ");
        toast.warning(`${parsed.ignoradas.length} linha(s) ignorada(s) — ${ex}${parsed.ignoradas.length > 3 ? " …" : ""}`, { duration: 12000 });
      }
      const novosPendentes = Array.from(new Set(parsed.itens.map((i) => i.produto_olist))).filter(
        (p) => !mapPorProduto.has(p),
      );
      if (novosPendentes.length) {
        toast.error(
          `${novosPendentes.length} produto(s) sem mapeamento (ficam FORA do Saldo Real): ${novosPendentes
            .slice(0, 3)
            .join(", ")}${novosPendentes.length > 3 ? "…" : ""} — o de-para é feito em Configurações do COP.`,
          { duration: 20000 },
        );
      }
      setEmpresaPrevia(vars.empresa);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao importar planilha."),
  });

  const mapPorProduto = useMemo(
    () => new Map(mapa.map((m) => [m.produto_olist, m])),
    [mapa],
  );




  const previa = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens
      .filter((it) => it.empresa === empresaPrevia)
      .filter((it) => !q || `${it.produto_olist} ${it.cor} ${it.tamanho}`.toLowerCase().includes(q))
      .sort((a, b) =>
        a.produto_olist.localeCompare(b.produto_olist, "pt-BR") ||
        a.cor.localeCompare(b.cor, "pt-BR") ||
        a.tamanho.localeCompare(b.tamanho, "pt-BR"),
      );
  }, [itens, empresaPrevia, busca]);

  const previaSort = useTableSort(previa, {
    produto: (it) => it.produto_olist,
    cor: (it) => it.cor,
    tamanho: (it) => it.tamanho,
    qtd: (it) => it.qtd,
  });

  const ignoradasUltimas = useMemo(() => {
    const out: { empresa: EmpresaOlist; l: LinhaIgnorada }[] = [];
    for (const [empresa, s] of ultimos) {
      for (const l of Array.isArray(s.linhas_ignoradas) ? s.linhas_ignoradas : []) out.push({ empresa, l });
    }
    return out;
  }, [ultimos]);

  const ignoradasSort = useTableSort(ignoradasUltimas, {
    empresa: (x) => x.empresa,
    linha: (x) => x.l.linha,
    produto: (x) => x.l.produto,
    motivo: (x) => x.l.motivo,
  });

  function handleFile(empresa: EmpresaOlist, file?: File | null) {
    if (!file) return;
    const sugerida = empresaPeloNome(file.name);
    if (sugerida && sugerida !== empresa) {
      toast.info(`O nome do arquivo sugere ${sugerida}, mas será importado como ${empresa}.`);
    }
    importar.mutate({ file, empresa });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold tracking-tight">Alimentação Estoque Real</h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            Última atualização geral: <span className="font-semibold tabular-nums">{fmtDataHora(ultimaGeral)}</span>
          </span>
          <Button variant="outline" size="icon" title="Recarregar" onClick={() => qc.invalidateQueries({ queryKey: ["estoque-olist"] })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <PendenciaMapeamentoAlert />


      {EMPRESAS.some((e) => !ultimos.has(e)) && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          Empresa(s) sem importação: {EMPRESAS.filter((e) => !ultimos.has(e)).join(", ")}.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {EMPRESAS.map((empresa) => {
          const s = ultimos.get(empresa);
          return (
            <Card key={empresa}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {empresa}
                  {s ? <CheckCircle2 className="h-4 w-4 text-green-700" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div
                  className="rounded-md border-2 border-dashed p-4 text-center text-xs text-muted-foreground"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFile(empresa, e.dataTransfer.files?.[0]); }}
                >
                  Arraste a planilha da Olist aqui (.xls, .xlsx ou .csv)
                  <div className="mt-2">
                    <input
                      ref={(el) => { inputs.current[empresa] = el; }}
                      type="file"
                      accept=".xls,.xlsx,.csv"
                      className="hidden"
                      onChange={(e) => { handleFile(empresa, e.target.files?.[0]); e.currentTarget.value = ""; }}
                    />
                    <Button size="sm" variant="outline" disabled={importar.isPending} onClick={() => inputs.current[empresa]?.click()}>
                      <Upload className="h-4 w-4 mr-1" /> Selecionar arquivo
                    </Button>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Última importação: <span className="font-semibold tabular-nums">{fmtDataHora(s?.importado_em)}</span>
                  {s?.arquivo_nome ? <> · {s.arquivo_nome}</> : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>




      {ignoradasUltimas.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Linhas ignoradas nas últimas importações ({ignoradasUltimas.length})</CardTitle></CardHeader>
          <CardContent className="overflow-auto max-h-[30vh] tbl-congelada">
            <table className="w-full text-[12px]">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <SortTh label="Empresa" sortKey="empresa" current={ignoradasSort.sortKey} dir={ignoradasSort.sortDir} onSort={ignoradasSort.toggle} className="text-left w-[80px]" />
                  <SortTh label="Linha" sortKey="linha" current={ignoradasSort.sortKey} dir={ignoradasSort.sortDir} onSort={ignoradasSort.toggle} className="text-left w-[70px]" />
                  <SortTh label="Produto" sortKey="produto" current={ignoradasSort.sortKey} dir={ignoradasSort.sortDir} onSort={ignoradasSort.toggle} className="text-left" />
                  <SortTh label="Motivo" sortKey="motivo" current={ignoradasSort.sortKey} dir={ignoradasSort.sortDir} onSort={ignoradasSort.toggle} className="text-left" />
                </tr>
              </thead>
              <tbody>
                {ignoradasSort.rows.map((x, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 font-semibold">{x.empresa}</td>
                    <td className="p-2 tabular-nums">{x.l.linha}</td>
                    <td className="p-2">{x.l.produto}</td>
                    <td className="p-2 text-muted-foreground">{x.l.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Prévia da última importação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs">Empresa:</Label>
            <Select value={empresaPrevia} onValueChange={(v) => setEmpresaPrevia(v as EmpresaOlist)}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="h-9 w-[260px]" placeholder="Buscar produto, cor ou tamanho" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <span className="text-xs text-muted-foreground">{previa.length} linha(s)</span>
          </div>
          <div className="overflow-auto max-h-[50vh] tbl-congelada">
            <table className="w-full text-[12.5px]">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <SortTh label="Produto" sortKey="produto" current={previaSort.sortKey} dir={previaSort.sortDir} onSort={previaSort.toggle} className="text-left" />
                  <SortTh label="Cor" sortKey="cor" current={previaSort.sortKey} dir={previaSort.sortDir} onSort={previaSort.toggle} className="text-left w-[140px]" />
                  <SortTh label="Tamanho" sortKey="tamanho" current={previaSort.sortKey} dir={previaSort.sortDir} onSort={previaSort.toggle} className="text-left w-[80px]" />
                  <SortTh label="Qtd" sortKey="qtd" current={previaSort.sortKey} dir={previaSort.sortDir} onSort={previaSort.toggle} className="text-right w-[80px]" />
                </tr>
              </thead>
              <tbody>
                {previaSort.rows.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Sem dados.</td></tr>
                ) : previaSort.rows.map((it, i) => (
                  <tr key={i} className={`border-t ${i % 2 ? "bg-muted/30" : ""}`}>
                    <td className="p-2">{it.produto_olist}</td>
                    <td className="p-2">{it.cor}</td>
                    <td className="p-2">{it.tamanho}</td>
                    <td className="p-2 text-right font-semibold tabular-nums">{it.qtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
