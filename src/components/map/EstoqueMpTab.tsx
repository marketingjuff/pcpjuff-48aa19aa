import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useEstoquePecas,
  useMapData,
  syncEstoquePecas,
  patchEstoquePeca,
  fmtDateBR,
  corBase,
  programacaoRecebimentoCompleto,
  type MapEstoquePeca,
  type MapEstoquePecaStatus,
  type MapProducao,
  type MapProgramacaoTinturaria,
} from "@/lib/map";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { InlineInput } from "./InlineInput";
import { EstoquePecaCortesCell } from "./EstoquePecaCortesCell";
import type { Cop } from "@/lib/cop";

const STATUS_LIST: MapEstoquePecaStatus[] = [
  "Fechada",
  "Aberta",
  "Corte",
  "Devolvida",
  "100% utilizada",
];

const STATUS_TOTAL: MapEstoquePecaStatus[] = ["Fechada", "Aberta", "Corte"];

export function EstoqueMpTab() {
  const qc = useQueryClient();
  const { data: pecas = [], isLoading } = useEstoquePecas();
  // Precisamos das produções não finalizadas + programações para o card "Produção".
  const dataAberta = useMapData(false);
  const producoesAbertas = dataAberta.producoes.data ?? [];
  const programacoes = dataAberta.programacoes.data ?? [];

  // COPs ativos (status ≠ Finalizado) para o popover de cortes.
  const { data: copsAtivos = [] } = useQuery({
    queryKey: ["cops", "ativos-para-cortes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cops")
        .select("*")
        .neq("status", "Finalizado")
        .order("numero", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        pecas: Array.isArray(r.pecas) ? r.pecas : [],
      })) as Cop[];
    },
    staleTime: 30_000,
  });

  // Sync ao montar (idempotente): pega recebimentos históricos já completos.
  useEffect(() => {
    void syncEstoquePecas()
      .then(() => qc.invalidateQueries({ queryKey: ["map", "estoque_pecas"] }))
      .catch((e: any) => toast.error(e?.message ?? "Falha ao sincronizar estoque."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["map", "estoque_pecas"] });
  }

  // ---------- Cards por cor ----------
  const cards = useMemo(() => {
    const map = new Map<
      string,
      {
        cor: string;
        producao: number;
        Fechada: number;
        Aberta: number;
        Corte: number;
        Devolvida: number;
        "100% utilizada": number;
      }
    >();
    const bump = (cor: string) => {
      if (!map.has(cor))
        map.set(cor, {
          cor,
          producao: 0,
          Fechada: 0,
          Aberta: 0,
          Corte: 0,
          Devolvida: 0,
          "100% utilizada": 0,
        });
      return map.get(cor)!;
    };

    // Produção: peças em programações de PRODs NÃO finalizadas cujo recebimento está incompleto.
    const prodOpenIds = new Set(producoesAbertas.map((p: MapProducao) => p.id));
    for (const p of programacoes as MapProgramacaoTinturaria[]) {
      if (!prodOpenIds.has(p.producao_id)) continue;
      if (programacaoRecebimentoCompleto(p)) continue;
      const cor = corBase(p.cor);
      if (!cor) continue;
      bump(cor).producao += Number(p.pecas ?? 0);
    }

    // Peças em estoque, agrupadas por cor base.
    for (const pe of pecas) {
      const cor = corBase(pe.cor);
      if (!cor) continue;
      const row = bump(cor);
      if (pe.status in row) (row as any)[pe.status] += 1;
    }

    return Array.from(map.values()).sort((a, b) => a.cor.localeCompare(b.cor));
  }, [pecas, programacoes, producoesAbertas]);

  // ---------- Filtros ----------
  const [fCor, setFCor] = useState<string>("__todas__");
  const [fStatus, setFStatus] = useState<string>("__todos__");
  const [fNF, setFNF] = useState<string>("");

  const coresDisponiveis = useMemo(() => {
    const s = new Set<string>();
    for (const pe of pecas) {
      const c = corBase(pe.cor);
      if (c) s.add(c);
    }
    return Array.from(s).sort();
  }, [pecas]);

  const pecasFiltradas = useMemo(() => {
    return pecas
      .filter((p) => (fCor === "__todas__" ? true : corBase(p.cor) === fCor))
      .filter((p) => (fStatus === "__todos__" ? true : p.status === fStatus))
      .filter((p) =>
        fNF.trim() === "" ? true : (p.nota_fiscal ?? "").toLowerCase().includes(fNF.trim().toLowerCase()),
      )
      .sort((a, b) => (b.data_entrada ?? "").localeCompare(a.data_entrada ?? ""));
  }, [pecas, fCor, fStatus, fNF]);

  async function commitField(peca: MapEstoquePeca, field: keyof MapEstoquePeca, raw: string | null) {
    try {
      const patch: any = {};
      if (field === "alt_inicial") {
        patch[field] = raw == null || raw === "" ? null : Number(raw);
      } else {
        patch[field] = raw;
      }
      await patchEstoquePeca(peca.id, patch);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
    }
  }

  async function commitStatus(peca: MapEstoquePeca, novo: MapEstoquePecaStatus) {
    try {
      await patchEstoquePeca(peca.id, { status: novo });
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
    }
  }

  return (
    <div className="space-y-3">
      {/* ---------- Cards por cor ---------- */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-min pb-1">
          {cards.length === 0 ? (
            <div className="text-sm text-muted-foreground p-2">
              {isLoading ? "Carregando…" : "Sem dados de estoque ainda."}
            </div>
          ) : (
            cards.map((c) => {
              const bg = corHex(c.cor);
              const fg = corTextoSobre(bg);
              const total = c.Fechada + c.Aberta + c.Corte;
              return (
                <div
                  key={c.cor}
                  className="min-w-[180px] rounded-md border shadow-sm bg-white/70 overflow-hidden shrink-0"
                >
                  <div
                    className="px-2 py-1 text-[12px] font-semibold tracking-tight"
                    style={{ backgroundColor: bg, color: fg }}
                    title={c.cor}
                  >
                    {c.cor}
                  </div>
                  <div className="px-2 py-1.5 space-y-1 text-[11.5px]">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 tabular-nums">
                      <span className="text-muted-foreground">Produção</span>
                      <span className="text-right">{c.producao}</span>
                      <span className="text-muted-foreground">Fechada</span>
                      <span className="text-right">{c.Fechada}</span>
                      <span className="text-muted-foreground">Aberta</span>
                      <span className="text-right">{c.Aberta}</span>
                      <span className="text-muted-foreground">Corte</span>
                      <span className="text-right">{c.Corte}</span>
                      <span className="font-semibold">Total</span>
                      <span className="text-right font-semibold">{total}</span>
                    </div>
                    <div className="border-t pt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 tabular-nums">
                      <span className="text-muted-foreground/70">100% util.</span>
                      <span className="text-right text-muted-foreground/70">
                        {c["100% utilizada"]}
                      </span>
                      <span className="text-red-700">Devolvida</span>
                      <span className="text-right text-red-700">{c.Devolvida}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ---------- Filtros ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={fCor} onValueChange={setFCor}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Cor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todas__">Todas as cores</SelectItem>
            {coresDisponiveis.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos os status</SelectItem>
            {STATUS_LIST.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Buscar NF…"
          value={fNF}
          onChange={(e) => setFNF(e.target.value)}
          className="h-8 w-[160px] text-xs"
        />
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {pecasFiltradas.length} peça(s)
        </span>
      </div>

      {/* ---------- Tabela ---------- */}
      <div className="rounded-md border bg-white/70 overflow-x-auto">
        <table className="w-full text-[12.5px] table-fixed">
          <colgroup>
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "28%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead className="bg-muted/40 sticky top-0">
            <tr className="text-left">
              <th className="p-1.5 font-medium">NF</th>
              <th className="p-1.5 font-medium">Cor</th>
              <th className="p-1.5 font-medium">Data entrada</th>
              <th className="p-1.5 font-medium">Nº peça</th>
              <th className="p-1.5 font-medium">Status</th>
              <th className="p-1.5 font-medium">Abertura</th>
              <th className="p-1.5 font-medium text-right">Alt inicial (m)</th>
              <th className="p-1.5 font-medium">Cortes</th>
              <th className="p-1.5 font-medium text-right">Saldo (m)</th>
            </tr>
          </thead>
          <tbody>
            {pecasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-3 text-center text-muted-foreground">
                  Sem peças.
                </td>
              </tr>
            ) : (
              pecasFiltradas.map((p, i) => {
                const bg = corHex(corBase(p.cor));
                const fg = corTextoSobre(bg);
                const somaCortes = (p.cortes ?? []).reduce(
                  (s, c) => s + Number(c.metros ?? 0),
                  0,
                );
                const alt = p.alt_inicial != null ? Number(p.alt_inicial) : null;
                const saldo = alt != null ? alt - somaCortes : null;
                return (
                  <tr
                    key={p.id}
                    className={`border-t ${i % 2 === 1 ? "bg-muted/20" : ""}`}
                  >
                    <td className="p-1 truncate" title={p.nota_fiscal ?? ""}>
                      {p.nota_fiscal ?? "—"}
                    </td>
                    <td className="p-1">
                      <span
                        className="inline-block rounded-sm px-1.5 py-0.5 text-[11.5px] font-semibold"
                        style={{ backgroundColor: bg, color: fg }}
                        title={p.cor ?? ""}
                      >
                        {corBase(p.cor) || "—"}
                      </span>
                    </td>
                    <td className="p-1 tabular-nums">{fmtDateBR(p.data_entrada)}</td>
                    <td className="p-1">
                      <InlineInput
                        value={p.numero_peca}
                        onCommit={(v) => commitField(p, "numero_peca", v)}
                      />
                    </td>
                    <td className="p-1">
                      <Select
                        value={p.status}
                        onValueChange={(v) => commitStatus(p, v as MapEstoquePecaStatus)}
                      >
                        <SelectTrigger className="h-7 text-[12.5px] px-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_LIST.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-1">
                      <InlineInput
                        type="date"
                        value={p.data_abertura}
                        onCommit={(v) => commitField(p, "data_abertura", v)}
                      />
                    </td>
                    <td className="p-1">
                      <InlineInput
                        type="number"
                        step="0.01"
                        min="0"
                        value={p.alt_inicial}
                        onCommit={(v) => commitField(p, "alt_inicial", v)}
                        className="text-right"
                      />
                    </td>
                    <td className="p-1">
                      <EstoquePecaCortesCell
                        peca={p}
                        copsAtivos={copsAtivos}
                        onChanged={refresh}
                      />
                    </td>
                    <td
                      className={`p-1 text-right tabular-nums font-semibold ${
                        saldo != null && saldo < 0 ? "text-red-600" : ""
                      }`}
                    >
                      {saldo == null ? "—" : saldo.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
