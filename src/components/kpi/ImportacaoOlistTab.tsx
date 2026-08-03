import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, AlertTriangle, CheckCircle2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { parseVendasOlist, type EmpresaOlist, type ResultadoImportacaoVendas } from "@/lib/olist-vendas";
import { PendenciaMapeamentoAlert } from "@/components/cop/PendenciaMapeamentoAlert";
import { basePedidoOlist } from "@/lib/pedido-olist-match";



const EMPRESAS: EmpresaOlist[] = ["JOKE", "JUFF"];
const CHUNK = 500;

interface Lote {
  id: string;
  empresa: string;
  arquivo_nome: string | null;
  arquivos_lidos: number | null;
  total_linhas: number | null;
  total_pedidos: number | null;
  total_itens: number | null;
  importado_em: string;
  importado_por: string | null;
}

function fmtDataHora(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function lerTudo<T>(fn: (from: number, to: number) => Promise<T[]>): Promise<T[]> {
  const passo = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += passo) {
    const parte = await fn(from, from + passo - 1);
    out.push(...parte);
    if (parte.length < passo) break;
  }
  return out;
}

export function ImportacaoOlistTab() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [empresa, setEmpresa] = useState<EmpresaOlist | "">("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);
  const [previa, setPrevia] = useState<ResultadoImportacaoVendas | null>(null);
  const [confirmouTroca, setConfirmouTroca] = useState(false);

  const { data: lotes = [] } = useQuery({
    queryKey: ["olist-vendas", "lotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("olist_import_lotes" as any)
        .select("*")
        .order("importado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Lote[];
    },
  });

  const { data: mapeados = [] } = useQuery({
    queryKey: ["olist-produto-map", "lista"],
    queryFn: async () => {
      const { data, error } = await supabase.from("olist_produto_map" as any).select("produto_olist");
      if (error) throw error;
      return (data ?? []).map((r: any) => String(r.produto_olist));
    },
  });

  const { data: pedidosPcp = [] } = useQuery({
    queryKey: ["olist-vendas", "pedidos-pcp"],
    queryFn: async () =>
      lerTudo<string>(async (from, to) => {
        const { data, error } = await supabase
          .from("pedidos")
          .select("pedido_olist")
          .not("pedido_olist", "is", null)
          .range(from, to);
        if (error) throw error;
        return (data ?? []).map((r: any) => String(r.pedido_olist).trim());
      }),
  });

  const { data: excluidos = [] } = useQuery({
    queryKey: ["olist-vendas", "excluidos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("olist_pedidos_excluidos" as any).select("numero_pedido");
      if (error) throw error;
      return (data ?? []).map((r: any) => String(r.numero_pedido));
    },
  });

  const { data: empresaPorPedido = {} } = useQuery({
    queryKey: ["olist-vendas", "empresa-por-pedido"],
    queryFn: async () => {
      const rows = await lerTudo<{ numero_pedido: string; empresa: string; lote_id: string }>(async (from, to) => {
        const { data, error } = await supabase
          .from("olist_pedidos" as any)
          .select("numero_pedido, empresa, lote_id")
          .range(from, to);
        if (error) throw error;
        return (data ?? []) as any;
      });
      const map: Record<string, string> = {};
      for (const r of rows) map[r.numero_pedido] = r.empresa;
      return map;
    },
  });

  const setMapeados = useMemo(() => new Set(mapeados), [mapeados]);
  /* Parciais do PCP (3996A / 3996B) casam com o pedido único da Olist (3996). */
  const setPcp = useMemo(() => new Set(pedidosPcp.map((n) => basePedidoOlist(n))), [pedidosPcp]);
  const setExcluidos = useMemo(() => new Set(excluidos), [excluidos]);

  const resumo = useMemo(() => {
    if (!previa) return null;
    /* Pedido Juff Store é e-commerce: nunca passa pelo PCP, então fica fora da conferência. */
    const setStore = new Set(previa.pedidosStore);
    const numeros = previa.pedidos.map((p) => p.numero_pedido).filter((n) => !setStore.has(n));
    const casam = numeros.filter((n) => setPcp.has(basePedidoOlist(n)));
    const soOlist = numeros.filter((n) => !setPcp.has(basePedidoOlist(n)));

    const naLista = numeros.filter((n) => setExcluidos.has(n));
    const trocaEmpresa = numeros.filter(
      (n) => empresaPorPedido[n] && empresaPorPedido[n] !== empresa,
    );
    const pecas = previa.itens.filter((i) => !i.is_servico).reduce((s, i) => s + i.qtd, 0);
    return { casam, soOlist, naLista, trocaEmpresa, pecas };
  }, [previa, setPcp, setExcluidos, empresaPorPedido, empresa]);


  async function gerarPrevia(f: File) {
    if (!empresa) return;
    setLendo(true);
    setPrevia(null);
    setConfirmouTroca(false);
    try {
      const res = await parseVendasOlist(f, setMapeados);
      setPrevia(res);
      if (res.produtosSemMapeamento.length > 0) {
        toast.warning(`${res.produtosSemMapeamento.length} produto(s) sem mapeamento no de-para.`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler o arquivo.");
    } finally {
      setLendo(false);
    }
  }

  const gravar = useMutation({
    mutationFn: async () => {
      if (!previa || !empresa) throw new Error("Prévia ausente.");
      const { data: userData } = await supabase.auth.getUser();
      const { data: lote, error: errLote } = await supabase
        .from("olist_import_lotes" as any)
        .insert({
          empresa,
          arquivo_nome: arquivo?.name ?? null,
          arquivos_lidos: previa.arquivosLidos,
          total_linhas: previa.totalLinhas,
          total_pedidos: previa.pedidos.length,
          total_itens: previa.itens.length,
          importado_por: userData.user?.id ?? null,
        } as any)
        .select("id")
        .single();
      if (errLote) throw errLote;
      const lote_id = (lote as any).id as string;

      for (let i = 0; i < previa.pedidos.length; i += CHUNK) {
        const bloco = previa.pedidos.slice(i, i + CHUNK).map((p) => ({ ...p, lote_id, empresa }));
        const { error } = await supabase.from("olist_pedidos" as any).insert(bloco as any);
        if (error) throw error;
      }
      for (let i = 0; i < previa.itens.length; i += CHUNK) {
        const bloco = previa.itens.slice(i, i + CHUNK).map((it) => ({ ...it, lote_id }));
        const { error } = await supabase.from("olist_itens" as any).insert(bloco as any);
        if (error) throw error;
      }
      return { pedidos: previa.pedidos.length, itens: previa.itens.length };
    },
    onSuccess: (r) => {
      toast.success(`Importado: ${r.pedidos} pedidos e ${r.itens} itens.`);
      setPrevia(null);
      setArquivo(null);
      setConfirmouTroca(false);
      if (inputRef.current) inputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["olist-vendas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gravar a importação."),
  });

  const precisaConfirmar = (resumo?.trocaEmpresa.length ?? 0) > 0;
  const podeGravar = !!previa && !!empresa && (!precisaConfirmar || confirmouTroca) && !gravar.isPending;

  return (
    <div className="space-y-4">
      <PendenciaMapeamentoAlert />
      <Card>

        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> Importação de pedidos da Olist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)] items-end">
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Select value={empresa} onValueChange={(v) => { setEmpresa(v as EmpresaOlist); setPrevia(null); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Arquivo .zip com as planilhas (.xls)</Label>
              <Input
                ref={inputRef}
                type="file"
                accept=".zip,.xls,.xlsx"
                disabled={!empresa || lendo}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setArquivo(f);
                  if (f) gerarPrevia(f);
                }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A empresa é definida por esta seleção — o arquivo da Olist não identifica a empresa. Nada é gravado antes de você confirmar a prévia.
          </p>
          {lendo && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo planilhas…
            </div>
          )}
        </CardContent>
      </Card>

      {previa && resumo && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Prévia — {empresa}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6 text-sm">
              {[
                ["Arquivos lidos", previa.arquivosLidos],
                ["Linhas", previa.totalLinhas],
                ["Pedidos", previa.pedidos.length],
                ["Itens", previa.itens.length],
                ["Peças", resumo.pecas],
                ["Serviços", previa.servicos.length],
              ].map(([label, v]) => (
                <div key={String(label)} className="rounded-md border bg-muted/30 px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">{label}</div>
                  <div className="font-semibold tabular-nums">{v as number}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-3 text-sm">
              <div className="rounded-md border px-3 py-2">
                <div className="text-[11px] text-muted-foreground">Casam com o PCP</div>
                <div className="font-semibold tabular-nums">{resumo.casam.length}</div>
              </div>
              <div className="rounded-md border px-3 py-2">
                <div className="text-[11px] text-muted-foreground">Somente na Olist</div>
                <div className="font-semibold tabular-nums">{resumo.soOlist.length}</div>
              </div>
              <div className="rounded-md border px-3 py-2">
                <div className="text-[11px] text-muted-foreground">Na lista de excluídos</div>
                <div className="font-semibold tabular-nums">{resumo.naLista.length}</div>
              </div>
            </div>


            {previa.pedidosDescontoSuspeito.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                <div className="text-xs font-medium text-amber-900">
                  {previa.pedidosDescontoSuspeito.length} pedido(s) com desconto maior que o valor dos itens — confira
                  antes de gravar
                </div>
                <div className="mt-2 max-h-48 overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-amber-900/70">
                        <th className="px-2 py-1 font-medium">Pedido</th>
                        <th className="px-2 py-1 text-right font-medium">Subtotal</th>
                        <th className="px-2 py-1 text-right font-medium">Desconto</th>
                        <th className="px-2 py-1 text-right font-medium">Líquido</th>
                        <th className="px-2 py-1 font-medium">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previa.pedidosDescontoSuspeito.map((p) => (
                        <tr key={p.numero_pedido} className="border-t border-amber-200 text-amber-900">
                          <td className="px-2 py-1 tabular-nums">{p.numero_pedido}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{p.subtotal.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{p.desconto.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{p.liquido.toFixed(2)}</td>
                          <td className="px-2 py-1">{p.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-1 text-[11px] text-amber-900/70">
                  Aviso apenas informativo — a gravação segue liberada.
                </div>
              </div>
            )}

            {previa.store.pedidos > 0 && (
              <div className="rounded-md border border-dashed px-3 py-2">

                <div className="text-xs font-medium">Juff Store (e-commerce)</div>
                <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {previa.store.pedidos} pedido(s) · {previa.store.linhas} linha(s) · {previa.store.pecas} peça(s).
                  Esses pedidos não passam pelo PCP e não exigem de-para: ficam fora da conferência acima e dos avisos de
                  mapeamento.
                </div>
                {previa.store.foraPadrao.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium">
                      {previa.store.foraPadrao.length} descrição(ões) fora do padrão (informativo)
                    </div>
                    <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-auto pl-5 text-xs text-muted-foreground">
                      {previa.store.foraPadrao.map((f) => (
                        <li key={f.descricao}>
                          {f.descricao} — {f.motivo}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}



            {previa.produtosSemMapeamento.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{previa.produtosSemMapeamento.length} produto(s) sem mapeamento</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5 text-xs mt-1 space-y-0.5">
                    {previa.produtosSemMapeamento.map((p) => <li key={p}>{p}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {previa.servicos.length > 0 && (
              <div className="rounded-md border px-3 py-2">
                <div className="text-xs font-medium mb-1">Itens de serviço (não contam como peça)</div>
                <ul className="list-disc pl-5 text-xs space-y-0.5 text-muted-foreground">
                  {previa.servicos.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>
            )}

            {previa.linhasIgnoradas.length > 0 && (
              <div className="rounded-md border px-3 py-2">
                <div className="text-xs font-medium mb-1">{previa.linhasIgnoradas.length} linha(s) ignorada(s)</div>
                <ul className="list-disc pl-5 text-xs space-y-0.5 text-muted-foreground max-h-40 overflow-auto">
                  {previa.linhasIgnoradas.map((l, i) => (
                    <li key={i}>{l.arquivo} · linha {l.linha} — {l.motivo}</li>
                  ))}
                </ul>
              </div>
            )}

            {precisaConfirmar && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Troca de empresa detectada</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p className="text-xs">
                    {resumo.trocaEmpresa.length} pedido(s) foram importados anteriormente com empresa diferente. Confirma a alteração para <strong>{empresa}</strong>?
                  </p>
                  <ul className="list-disc pl-5 text-xs space-y-0.5 max-h-40 overflow-auto">
                    {resumo.trocaEmpresa.map((n) => (
                      <li key={n}>{n} — antes: {empresaPorPedido[n]}</li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    variant={confirmouTroca ? "secondary" : "default"}
                    onClick={() => setConfirmouTroca((v) => !v)}
                  >
                    {confirmouTroca ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Alteração confirmada</> : "Confirmar alteração de empresa"}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-2">
              <Button disabled={!podeGravar} onClick={() => gravar.mutate()}>
                {gravar.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Gravar importação
              </Button>
              <Button variant="ghost" onClick={() => { setPrevia(null); setArquivo(null); if (inputRef.current) inputRef.current.value = ""; }}>
                Descartar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico de importações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="tbl-congelada overflow-auto max-h-[420px]">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1.5">Data</th>
                  <th className="text-left px-2 py-1.5">Empresa</th>
                  <th className="text-left px-2 py-1.5">Arquivo</th>
                  <th className="text-right px-2 py-1.5">Planilhas</th>
                  <th className="text-right px-2 py-1.5">Linhas</th>
                  <th className="text-right px-2 py-1.5">Pedidos</th>
                  <th className="text-right px-2 py-1.5">Itens</th>
                </tr>
              </thead>
              <tbody>
                {lotes.length === 0 && (
                  <tr><td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">Nenhuma importação ainda.</td></tr>
                )}
                {lotes.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtDataHora(l.importado_em)}</td>
                    <td className="px-2 py-1.5"><Badge variant="secondary">{l.empresa}</Badge></td>
                    <td className="px-2 py-1.5 max-w-[280px] truncate">{l.arquivo_nome ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{l.arquivos_lidos ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{l.total_linhas ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{l.total_pedidos ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{l.total_itens ?? "—"}</td>
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
