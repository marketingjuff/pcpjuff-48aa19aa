import { CorSelect } from "@/components/shared/cor-select";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, AlertCircle, AlertTriangle } from "lucide-react";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { REFACAO_MODELOS, REFACAO_TAMANHOS, cmpCor, cmpModelo, type Pedido } from "@/lib/pedidos";
import type { Cop } from "@/lib/cop";
import {
  pkKey, calcEmProducao, calcFaltantes, calcRecebido, calcPerdas, calcDisponivel,
} from "@/lib/cop-saldos";
import { useItensUltimoSnapshot, useProdutoMap } from "./AlimentacaoEstoqueTab";
import { useTableSort, SortTh } from "@/components/shared/sortable";

export function SaldoRealTab() {
  const qc = useQueryClient();
  const { itens } = useItensUltimoSnapshot();
  const { data: mapa = [] } = useProdutoMap();

  const { data: cops = [] } = useQuery({
    queryKey: ["cops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cops" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Cop[];
    },
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-cop-saldos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pedidos" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Pedido[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("saldo-real")
      .on("postgres_changes", { event: "*", schema: "public", table: "cops" }, () => qc.invalidateQueries({ queryKey: ["cops"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => qc.invalidateQueries({ queryKey: ["pedidos-cop-saldos"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "olist_produto_map" }, () => qc.invalidateQueries({ queryKey: ["estoque-olist"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "estoque_olist_snapshots" }, () => qc.invalidateQueries({ queryKey: ["estoque-olist"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);


  const disponivel = useMemo(() => {
    const producao = calcEmProducao(cops);
    const faltantes = calcFaltantes(pedidos);
    const recebido = calcRecebido(cops);
    const perdas = calcPerdas(cops);
    return calcDisponivel(producao, faltantes, recebido, perdas);
  }, [cops, pedidos]);

  const mapPorProduto = useMemo(() => new Map(mapa.map((m) => [m.produto_olist, m.modelo_cop])), [mapa]);

  const { joke, juff, naoMapeados } = useMemo(() => {
    const joke = new Map<string, number>();
    const juff = new Map<string, number>();
    const naoMapeados = new Set<string>();
    for (const it of itens) {
      const modelo = mapPorProduto.get(it.produto_olist);
      if (!modelo) { naoMapeados.add(it.produto_olist); continue; }
      const k = pkKey(modelo, it.cor, it.tamanho);
      const alvo = it.empresa === "JOKE" ? joke : juff;
      alvo.set(k, (alvo.get(k) ?? 0) + (it.qtd ?? 0));
    }
    return { joke, juff, naoMapeados };
  }, [itens, mapPorProduto]);

  const chaves = useMemo(() => {
    const set = new Set<string>([...joke.keys(), ...juff.keys(), ...disponivel.keys()]);
    return set;
  }, [joke, juff, disponivel]);

  /** Saldo multi-empresa (JOKE+JUFF); negativo é considerado ZERADO. */
  const multiEmpresa = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of chaves) {
      m.set(k, Math.max(0, (joke.get(k) ?? 0) + (juff.get(k) ?? 0)));
    }
    return m;
  }, [chaves, joke, juff]);

  const saldoReal = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of chaves) {
      m.set(k, (multiEmpresa.get(k) ?? 0) + (disponivel.get(k) ?? 0));
    }
    return m;
  }, [chaves, multiEmpresa, disponivel]);

  const cores = useMemo(() => {
    const s = new Set<string>();
    for (const k of chaves) { const cor = k.split("|")[1]; if (cor) s.add(cor); }
    return Array.from(s).sort(cmpCor);
  }, [chaves]);

  const [corFiltro, setCorFiltro] = useState("todas");
  const [modeloFiltro, setModeloFiltro] = useState("todos");
  const [apenasNegativos, setApenasNegativos] = useState(false);

  const linhas = useMemo(() => {
    const out: { modelo: string; cor: string }[] = [];
    const set = new Set<string>();
    for (const k of chaves) {
      const [modelo, cor] = k.split("|");
      if (!modelo || !cor) continue;
      set.add(`${modelo}|${cor}`);
    }
    for (const s of set) {
      const [modelo, cor] = s.split("|");
      if (corFiltro !== "todas" && cor !== corFiltro) continue;
      if (modeloFiltro !== "todos" && modelo !== modeloFiltro) continue;
      const ativo = REFACAO_TAMANHOS.some((t) => (saldoReal.get(pkKey(modelo, cor, t)) ?? 0) !== 0);
      if (!ativo) continue;
      if (apenasNegativos && !REFACAO_TAMANHOS.some((t) => (saldoReal.get(pkKey(modelo, cor, t)) ?? 0) < 0)) continue;
      out.push({ modelo, cor });
    }
    return out.sort((a, b) => cmpCor(a.cor, b.cor) || cmpModelo(a.modelo, b.modelo));
  }, [chaves, corFiltro, modeloFiltro, apenasNegativos, saldoReal]);

  const totaisTam = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of REFACAO_TAMANHOS) {
      let s = 0;
      for (const l of linhas) s += saldoReal.get(pkKey(l.modelo, l.cor, t)) ?? 0;
      m.set(t, s);
    }
    return m;
  }, [linhas, saldoReal]);

  const totalGeral = useMemo(() => {
    let s = 0;
    for (const v of totaisTam.values()) s += v;
    return s;
  }, [totaisTam]);


  const sortGetters = useMemo(() => {
    const g: Record<string, (row: { modelo: string; cor: string }) => string | number | null | undefined> = {
      cor: (l) => l.cor,
      modelo: (l) => l.modelo,
    };
    for (const t of REFACAO_TAMANHOS) {
      g[t] = (l) => saldoReal.get(pkKey(l.modelo, l.cor, t)) ?? 0;
    }
    return g;
  }, [saldoReal]);
  const { rows: linhasOrdenadas, sortKey, sortDir, toggle: toggleSort } = useTableSort(linhas, sortGetters);

  const [popup, setPopup] = useState<{ modelo: string; cor: string; tamanho: string } | null>(null);
  const pk = popup ? pkKey(popup.modelo, popup.cor, popup.tamanho) : null;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Saldo Real Juff</h2>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" title="Recarregar" onClick={() => {
            qc.invalidateQueries({ queryKey: ["cops"] });
            qc.invalidateQueries({ queryKey: ["pedidos-cop-saldos"] });
            qc.invalidateQueries({ queryKey: ["estoque-olist"] });
          }}><RefreshCw className="h-4 w-4" /></Button>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Modelo:</Label>
            <Select value={modeloFiltro} onValueChange={setModeloFiltro}>
              <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {REFACAO_MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Cor:</Label>
            <CorSelect
              value={corFiltro}
              onChange={setCorFiltro}
              allValue="todas"
              allLabel="Todas"
              options={cores.map((c) => ({ nome: c }))}
              className="h-9 w-[180px]"
            />

          </div>
          <Button variant={apenasNegativos ? "default" : "outline"} onClick={() => setApenasNegativos((v) => !v)}>
            <AlertCircle className="h-4 w-4 mr-1" />
            {apenasNegativos ? "Mostrando: negativos" : "Apenas negativos"}
          </Button>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="rounded-md border bg-card px-3 py-1.5 text-sm">
            Total de peças existentes: <span className="font-bold tabular-nums text-foreground">{totalGeral.toLocaleString("pt-BR")}</span>
          </span>
          <span>{linhas.length} linhas</span>
        </div>

      </div>

      {naoMapeados.size > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>
            {naoMapeados.size} produto(s) da Olist ainda sem modelo COP e fora deste cálculo — mapeie na aba
            {" "}<span className="font-semibold">Alimentação Estoque Real</span>: {Array.from(naoMapeados).slice(0, 6).join(" · ")}
            {naoMapeados.size > 6 ? " …" : ""}
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Saldo Real por Modelo · Cor (JOKE + JUFF + Disponível)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto max-h-[70vh] tbl-congelada">
          <table className="w-full text-[12.5px] leading-[1.2]">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <SortTh label="Cor" sortKey="cor" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-left min-w-[56px]" />
                <SortTh label="Modelo" sortKey="modelo" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-left min-w-[64px]" />
                {REFACAO_TAMANHOS.map((t) => (
                  <SortTh key={t} label={t} sortKey={t} current={sortKey} dir={sortDir} onSort={toggleSort} className="text-center w-[96px] justify-center" />
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr><td colSpan={REFACAO_TAMANHOS.length + 2} className="p-4 text-center text-muted-foreground">Sem dados.</td></tr>
              ) : (() => {
                let corIdx = -1;
                let lastCor: string | null = null;
                return linhasOrdenadas.map((l, i) => {
                  const hex = corHex(l.cor); const fg = corTextoSobre(hex);
                  const novaCor = lastCor !== l.cor;
                  if (novaCor) { corIdx++; lastCor = l.cor; }
                  const zebra = corIdx % 2 === 1;
                  return (
                    <tr key={i} className={`${novaCor ? "border-t" : ""} ${zebra ? "bg-muted/80" : ""} hover:bg-accent/60`}>
                      <td className="px-2 py-0 leading-tight">
                        {novaCor ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: hex, color: fg }}>{l.cor}</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-0 leading-tight">{l.modelo}</td>
                      {REFACAO_TAMANHOS.map((t) => {
                        const k = pkKey(l.modelo, l.cor, t);
                        const v = saldoReal.get(k) ?? 0;
                        const presente = chaves.has(k);
                        const color = !presente ? "text-muted-foreground"
                          : v < 0 ? "text-red-700"
                          : v === 0 ? "text-muted-foreground"
                          : "text-green-700";
                        return (
                          <td key={t} className="p-0 text-center leading-tight">
                            <button
                              type="button"
                              className={`w-full rounded px-2 py-0 tabular-nums hover:bg-accent/60 ${color}`}
                              disabled={!presente}
                              onClick={() => setPopup({ modelo: l.modelo, cor: l.cor, tamanho: t })}
                            >
                              {presente ? v : "—"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })()}
            </tbody>
            {linhas.length > 0 && (
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="p-2" colSpan={2}>Total</td>
                  {REFACAO_TAMANHOS.map((t) => (
                    <td key={t} className="p-2 text-center tabular-nums">{totaisTam.get(t) ?? 0}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!popup} onOpenChange={(v) => !v && setPopup(null)}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{popup ? `${popup.modelo} · ${popup.cor} · ${popup.tamanho}` : ""}</DialogTitle>
          </DialogHeader>
          {pk && (
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b"><td className="py-1">Estoque JOKE</td><td className="py-1 text-right font-semibold tabular-nums">{joke.get(pk) ?? 0}</td></tr>
                <tr className="border-b"><td className="py-1">Estoque JUFF</td><td className="py-1 text-right font-semibold tabular-nums">{juff.get(pk) ?? 0}</td></tr>
                <tr className="border-b">
                  <td className="py-1">Saldo Multi-Empresa {(joke.get(pk) ?? 0) + (juff.get(pk) ?? 0) < 0 && <span className="text-xs text-muted-foreground">(negativo zerado)</span>}</td>
                  <td className="py-1 text-right font-semibold tabular-nums">{multiEmpresa.get(pk) ?? 0}</td>
                </tr>
                <tr className="border-b"><td className="py-1">Saldo Disponível (COP)</td><td className="py-1 text-right font-semibold tabular-nums">{disponivel.get(pk) ?? 0}</td></tr>
                <tr><td className="py-1 font-bold">Saldo Real</td><td className="py-1 text-right font-bold tabular-nums">{saldoReal.get(pk) ?? 0}</td></tr>
              </tbody>
            </table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
