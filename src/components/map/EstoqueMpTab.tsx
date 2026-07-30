import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
import { DevolverPecasDialog } from "./DevolverPecasDialog";
import type { Cop } from "@/lib/cop";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { abrirInventarioParaImpressao, type InventarioRow } from "@/lib/inventario-pdf";
import { useTableSort, SortTh } from "@/components/shared/sortable";

const STATUS_LIST: MapEstoquePecaStatus[] = [
  "Fechada",
  "Aberta",
  "Corte",
  "Devolvida",
  "100% utilizada",
];

const STATUS_TOTAL: MapEstoquePecaStatus[] = ["Fechada", "Aberta", "Corte"];

const LARG_DEFAULT = 1.8;

/** Normaliza qualquer entrada para o formato X,XX (1 dígito antes, 2 depois).
 *  Ex: "18,0" | "180" | "1,8" | "1.80" -> 1.80
 *      "17" | "170" | "17,0" -> 1.70
 */
function parseLarg(raw: string | null): number | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  const first = digits[0];
  const rest = digits.slice(1, 3).padEnd(2, "0");
  const n = Number(`${first}.${rest}`);
  return Number.isFinite(n) ? n : null;
}

function fmtLarg(n: number | null | undefined): string {
  const v = n == null ? LARG_DEFAULT : Number(n);
  return v.toFixed(2).replace(".", ",");
}

/** Input próprio para largura: default 1,80, formato X,XX, auto-normalização. */
function LargInput({
  value,
  onCommit,
  inputRef,
  onEnterMoveNext,
}: {
  value: number | null | undefined;
  onCommit: (n: number) => void | Promise<void>;
  inputRef?: React.Ref<HTMLInputElement>;
  onEnterMoveNext?: () => void;
}) {
  const displayFromValue = (v: number | null | undefined) =>
    (v == null ? LARG_DEFAULT : Number(v)).toFixed(2).replace(".", ",");
  const initial = displayFromValue(value);
  const [v, setV] = useState<string>(initial);
  useEffect(() => { setV(initial); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [initial]);

  function handleChange(input: string) {
    // Mantém somente dígitos, no máximo 3.
    const digits = input.replace(/\D/g, "").slice(0, 3);
    if (!digits) { setV(""); return; }
    if (digits.length === 1) setV(digits);
    else setV(`${digits[0]},${digits.slice(1)}`);
  }

  async function commit() {
    const parsed = parseLarg(v);
    const next = parsed ?? LARG_DEFAULT;
    const formatted = next.toFixed(2).replace(".", ",");
    setV(formatted);
    if (Math.abs(next - (value == null ? LARG_DEFAULT : Number(value))) < 1e-9 && value != null) return;
    await onCommit(next);
  }

  return (
    <Input
      ref={inputRef}
      inputMode="numeric"
      value={v}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => { void commit(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void commit().then(() => onEnterMoveNext?.());
        }
        if (e.key === "Escape") { setV(initial); (e.currentTarget as HTMLInputElement).blur(); }
      }}
      className="h-7 text-[12.5px] px-1.5 text-center"
    />
  );
}


export function EstoqueMpTab() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: pecas = [], isLoading } = useEstoquePecas();
  // Precisamos das produções não finalizadas + programações para o card "Produção".
  const dataAberta = useMapData(false);
  const producoesAbertas = dataAberta.producoes.data ?? [];
  const programacoes = dataAberta.programacoes.data ?? [];
  const entregas = dataAberta.entregas.data ?? [];

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

  // Mapa producao_id -> numero (para exibir PROD na tabela de estoque).
  const { data: prodNumeroMap = {} } = useQuery({
    queryKey: ["map", "producoes", "numero-map"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("map_producoes")
        .select("id, numero");
      if (error) throw error;
      const m: Record<string, number> = {};
      for (const r of (data ?? []) as any[]) m[r.id] = r.numero;
      return m;
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

    // CRU: peças entregues pela malharia (produções abertas) ainda não programadas na tinturaria.
    let cruPendente = 0;
    for (const p of producoesAbertas as MapProducao[]) {
      const entreguesProd = (entregas as any[])
        .filter((e) => e.producao_id === p.id)
        .reduce((s, e) => s + Number(e.pecas ?? 0), 0);
      const programadasProd = (programacoes as MapProgramacaoTinturaria[])
        .filter((pr) => pr.producao_id === p.id)
        .reduce((s, pr) => s + Number(pr.pecas ?? 0), 0);
      const pend = entreguesProd - programadasProd;
      if (pend > 0) cruPendente += pend;
    }
    const cruRow = bump("CRU");
    cruRow.producao += cruPendente;

    return Array.from(map.values()).sort((a, b) => {
      if (a.cor === "CRU") return -1;
      if (b.cor === "CRU") return 1;
      return a.cor.localeCompare(b.cor);
    });
  }, [pecas, programacoes, producoesAbertas, entregas]);

  const { rows: cardsSorted, sortKey: cardsSortKey, sortDir: cardsSortDir, toggle: cardsToggle } = useTableSort(cards, {
    cor: (c) => c.cor,
    producao: (c) => c.producao,
    fechada: (c) => c.Fechada,
    aberta: (c) => c.Aberta,
    corte: (c) => c.Corte,
    devolvida: (c) => c.Devolvida,
    total: (c) => c.Fechada + c.Aberta + c.Corte,
    util: (c) => c["100% utilizada"],
  });

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

  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [devolverOpen, setDevolverOpen] = useState(false);

  const pecasFiltradasBase = useMemo(() => {
    return pecas
      .filter((p) => p.status !== "100% utilizada" && p.status !== "Devolvida")
      .filter((p) => (fCor === "__todas__" ? true : corBase(p.cor) === fCor))
      .filter((p) => (fStatus === "__todos__" ? true : p.status === fStatus))
      .filter((p) =>
        fNF.trim() === "" ? true : (p.nota_fiscal ?? "").toLowerCase().includes(fNF.trim().toLowerCase()),
      )
      .sort((a, b) => {
        const na = a.ne ?? Number.MAX_SAFE_INTEGER;
        const nb = b.ne ?? Number.MAX_SAFE_INTEGER;
        return na - nb;
      });
  }, [pecas, fCor, fStatus, fNF]);

  const { rows: pecasFiltradas, sortKey: pecasSortKey, sortDir: pecasSortDir, toggle: pecasToggle } = useTableSort(pecasFiltradasBase, {
    ne: (p) => p.ne,
    prod: (p) => prodNumeroMap[p.producao_id],
    nf: (p) => p.nota_fiscal,
    cor: (p) => corBase(p.cor),
    data_entrada: (p) => p.data_entrada,
    numero_peca: (p) => p.numero_peca,
    status: (p) => p.status,
    abertura: (p) => p.data_abertura,
    larg: (p) => (p.larg != null ? Number(p.larg) : null),
    alt: (p) => (p.alt_inicial != null ? Number(p.alt_inicial) : null),
    cortes: (p) => (p.cortes ?? []).length,
    saldo: (p) => {
      const usado = (p.cortes ?? []).reduce((s, c) => s + Number(c.metros ?? 0), 0);
      return p.alt_inicial != null ? Number(p.alt_inicial) - usado : null;
    },
  });

  const pecasSelecionadas = useMemo(
    () => pecasFiltradas.filter((p) => sel[p.id]),
    [pecasFiltradas, sel],
  );

  async function commitField(peca: MapEstoquePeca, field: keyof MapEstoquePeca, raw: string | null) {
    try {
      const patch: any = {};
      if (field === "alt_inicial") {
        patch[field] = raw == null || raw === "" ? null : Number(raw);
      } else if (field === "larg") {
        patch[field] = parseLarg(raw);
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

  const totalGeral = useMemo(() => cards.reduce((s, c) => s + c.Fechada + c.Aberta + c.Corte, 0), [cards]);

  // Refs para navegação Enter -> próxima linha.
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const setCellRef = (id: string, field: string) => (el: HTMLInputElement | null) => {
    cellRefs.current[`${id}-${field}`] = el;
  };
  const focusNextRow = (id: string, field: string) => {
    const idx = pecasFiltradas.findIndex((p) => p.id === id);
    const next = pecasFiltradas[idx + 1];
    if (!next) return;
    const nextEl = cellRefs.current[`${next.id}-${field}`];
    nextEl?.focus();
  };


  const inventarioRows: InventarioRow[] = useMemo(() => {
    const ok = new Set(["Fechada", "Aberta", "Corte"]);
    const fmtN = (n: number | null | undefined) =>
      n == null || !Number.isFinite(Number(n)) ? "—" : Number(n).toFixed(2).replace(".", ",");
    return pecas
      .filter((p) => ok.has(p.status))
      .slice()
      .sort((a, b) => {
        const c = (a.cor ?? "").localeCompare(b.cor ?? "", "pt-BR");
        if (c !== 0) return c;
        return (a.numero_peca ?? "").localeCompare(b.numero_peca ?? "", "pt-BR", { numeric: true });
      })
      .map((p) => {
        const usado = (p.cortes ?? []).reduce((s, c) => s + Number(c.metros || 0), 0);
        const saldo = p.alt_inicial == null ? null : Number(p.alt_inicial) - usado;
        return {
          cor: corBase(p.cor),
          numero_peca: p.numero_peca ?? "",
          status: p.status,
          data_entrada: p.data_entrada ? fmtDateBR(p.data_entrada) : "—",
          larg: fmtN(p.larg),
          altura: fmtN(saldo),
        };
      });
  }, [pecas]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={async () => { await abrirInventarioParaImpressao(inventarioRows); }}
          disabled={inventarioRows.length === 0}
        >
          <Printer className="h-4 w-4 mr-1.5" />
          Imprimir Inventário (PDF)
        </Button>
      </div>
      {/* ---------- Resumo por cor (tabela) ---------- */}
      <div className="rounded-md border bg-white/70 overflow-auto max-h-[70vh] tbl-congelada">
        <table className="w-full text-[12.5px] table-fixed">
          <colgroup>
            <col style={{ width: "25%" }} />
            <col style={{ width: "9.375%" }} />
            <col style={{ width: "9.375%" }} />
            <col style={{ width: "9.375%" }} />
            <col style={{ width: "9.375%" }} />
            <col style={{ width: "9.375%" }} />
            <col style={{ width: "9.375%" }} />
            <col style={{ width: "9.375%" }} />
            <col style={{ width: "9.375%" }} />
          </colgroup>
          <thead className="bg-muted/40">
            <tr className="text-left">
              <SortTh label="Cor" sortKey="cor" current={cardsSortKey} dir={cardsSortDir} onSort={cardsToggle} className="py-1 px-1.5" />
              <SortTh label="Produção" sortKey="producao" current={cardsSortKey} dir={cardsSortDir} onSort={cardsToggle} className="py-1 px-1.5 text-right tabular-nums" />
              <SortTh label="Fechada" sortKey="fechada" current={cardsSortKey} dir={cardsSortDir} onSort={cardsToggle} className="py-1 px-1.5 text-right tabular-nums" />
              <SortTh label="Aberta" sortKey="aberta" current={cardsSortKey} dir={cardsSortDir} onSort={cardsToggle} className="py-1 px-1.5 text-right tabular-nums" />
              <SortTh label="Corte" sortKey="corte" current={cardsSortKey} dir={cardsSortDir} onSort={cardsToggle} className="py-1 px-1.5 text-right tabular-nums" />
              <SortTh label="Devolvida" sortKey="devolvida" current={cardsSortKey} dir={cardsSortDir} onSort={cardsToggle} className="py-1 px-1.5 text-right tabular-nums text-red-700" />
              <SortTh label="Total" sortKey="total" current={cardsSortKey} dir={cardsSortDir} onSort={cardsToggle} className="py-1 px-1.5 text-right tabular-nums" />
              <SortTh label="100% util." sortKey="util" current={cardsSortKey} dir={cardsSortDir} onSort={cardsToggle} className="py-1 px-1.5 text-right tabular-nums text-muted-foreground/80" />
              <th className="py-1 px-1.5 font-medium text-right tabular-nums text-muted-foreground/80">% part.</th>
            </tr>
          </thead>
          <tbody>
            {cardsSorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-3 text-center text-muted-foreground">
                  {isLoading ? "Carregando…" : "Sem dados de estoque ainda."}
                </td>
              </tr>
            ) : (
              cardsSorted.map((c, i) => {
                const isCru = c.cor === "CRU";
                const bg = isCru ? "#e8dcc4" : corHex(c.cor);
                const fg = corTextoSobre(bg);
                const total = c.Fechada + c.Aberta + c.Corte;
                const part = totalGeral > 0 ? Math.round((total / totalGeral) * 100) : 0;
                return (
                  <tr
                    key={c.cor}
                    className={`border-t ${i % 2 === 1 ? "bg-muted/20" : ""} ${isCru ? "cursor-pointer hover:bg-yellow-100/60" : ""}`}
                    onClick={isCru ? () => navigate({ to: "/map", search: { tab: "programacao", fioFilter: "nao_programadas" } as any }) : undefined}
                    title={isCru ? "Ver produções com peças ainda não programadas na tinturaria" : undefined}
                  >
                    <td className="py-0.5 px-1.5">
                      <span
                        className="block w-full text-center truncate rounded-sm px-1.5 py-0.5 text-[11.5px] font-semibold"
                        style={{ backgroundColor: bg, color: fg }}
                        title={c.cor}
                      >
                        {c.cor}
                      </span>
                    </td>
                    <td className="py-0.5 px-1.5 text-right tabular-nums">{c.producao}</td>
                    <td className="py-0.5 px-1.5 text-right tabular-nums">{c.Fechada}</td>
                    <td className="py-0.5 px-1.5 text-right tabular-nums">{c.Aberta}</td>
                    <td className="py-0.5 px-1.5 text-right tabular-nums">{c.Corte}</td>
                    <td className="py-0.5 px-1.5 text-right tabular-nums text-red-700">{c.Devolvida}</td>
                    <td className="py-0.5 px-1.5 text-right tabular-nums font-semibold">{total}</td>
                    <td className="py-0.5 px-1.5 text-right tabular-nums text-muted-foreground/80">
                      {c["100% utilizada"]}
                    </td>
                    <td className="py-0.5 px-1.5 text-right tabular-nums text-muted-foreground/80">
                      {part}%</td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot className="bg-muted/50 border-t-2">
            <tr>
              <td className="py-1 px-1.5 font-semibold">Total</td>
              <td className="py-1 px-1.5 text-right tabular-nums font-semibold">{cards.reduce((s, c) => s + c.producao, 0)}</td>
              <td className="py-1 px-1.5 text-right tabular-nums font-semibold">{cards.reduce((s, c) => s + c.Fechada, 0)}</td>
              <td className="py-1 px-1.5 text-right tabular-nums font-semibold">{cards.reduce((s, c) => s + c.Aberta, 0)}</td>
              <td className="py-1 px-1.5 text-right tabular-nums font-semibold">{cards.reduce((s, c) => s + c.Corte, 0)}</td>
              <td className="py-1 px-1.5 text-right tabular-nums font-semibold text-red-700">{cards.reduce((s, c) => s + c.Devolvida, 0)}</td>
              <td className="py-1 px-1.5 text-right tabular-nums font-semibold">{totalGeral}</td>
              <td className="py-1 px-1.5 text-right tabular-nums font-semibold text-muted-foreground/80">{cards.reduce((s, c) => s + c["100% utilizada"], 0)}</td>
              <td className="py-1 px-1.5 text-right tabular-nums font-semibold text-muted-foreground/80">{totalGeral > 0 ? "100%" : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>



      {/* ---------- Filtros ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={fCor} onValueChange={setFCor}>
          <SelectTrigger
            className="h-8 w-[160px] text-xs font-semibold"
            style={fCor && fCor !== "__todas__" ? { backgroundColor: corHex(fCor), color: corTextoSobre(corHex(fCor)) } : undefined}
          >
            <SelectValue placeholder="Cor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todas__" className="py-1 text-xs">Todas as cores</SelectItem>
            {coresDisponiveis.map((c) => {
              const bg = corHex(c);
              const fg = corTextoSobre(bg);
              return (
                <SelectItem
                  key={c}
                  value={c}
                  style={{ backgroundColor: bg, color: fg }}
                  className="my-0.5 py-1 rounded-sm text-xs font-semibold focus:opacity-90"
                >
                  {c}
                </SelectItem>
              );
            })}
          </SelectContent>

        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos os status</SelectItem>
            {STATUS_LIST.filter((s) => s !== "100% utilizada" && s !== "Devolvida").map((s) => (
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
        <Button
          size="sm"
          className="h-8 text-xs"
          disabled={pecasSelecionadas.length === 0}
          onClick={() => setDevolverOpen(true)}
        >
          Devolver selecionadas{pecasSelecionadas.length ? ` (${pecasSelecionadas.length})` : ""}
        </Button>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {pecasFiltradas.length} peça(s)
        </span>
      </div>

      {/* ---------- Tabela ---------- */}
      <div className="rounded-md border bg-white/70 overflow-auto max-h-[70vh] tbl-congelada">
        <table className="w-full text-[12.5px] table-fixed">
          <colgroup>
            <col style={{ width: "3%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "7%" }} />
          </colgroup>
          <thead className="bg-muted/40">
            <tr>
              <th className="p-1 font-medium text-center">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 align-middle"
                  checked={pecasFiltradas.length > 0 && pecasFiltradas.every((p) => sel[p.id])}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setSel(() => {
                      const next: Record<string, boolean> = {};
                      if (v) for (const p of pecasFiltradas) next[p.id] = true;
                      return next;
                    });
                  }}
                />
              </th>
              <SortTh label="NE" sortKey="ne" current={pecasSortKey} dir={pecasSortDir} onSort={pecasToggle} className="text-center" />
              <SortTh label="PROD" sortKey="prod" current={pecasSortKey} dir={pecasSortDir} onSort={pecasToggle} className="text-center" />
              <SortTh label="NF" sortKey="nf" current={pecasSortKey} dir={pecasSortDir} onSort={pecasToggle} className="text-center" />
              <SortTh label="Cor" sortKey="cor" current={pecasSortKey} dir={pecasSortDir} onSort={pecasToggle} className="text-center" />
              <SortTh label="Data entrada" sortKey="data_entrada" current={pecasSortKey} dir={pecasSortDir} onSort={pecasToggle} className="text-center" />
              <SortTh label="Nº peça" sortKey="numero_peca" current={pecasSortKey} dir={pecasSortDir} onSort={pecasToggle} className="text-center" />
              <SortTh label="Status" sortKey="status" current={pecasSortKey} dir={pecasSortDir} onSort={pecasToggle} className="text-center" />
              <SortTh label="Abertura" sortKey="abertura" current={pecasSortKey} dir={pecasSortDir} onSort={pecasToggle} className="text-center" />
              <SortTh label="Larg (m)" sortKey="larg" current={pecasSortKey} dir={pecasSortDir} onSort={pecasToggle} className="text-center" />
              <SortTh label="Alt (m)" sortKey="alt" current={pecasSortKey} dir={pecasSortDir} onSort={pecasToggle} className="text-center" />
              <SortTh label="Cortes" sortKey="cortes" current={pecasSortKey} dir={pecasSortDir} onSort={pecasToggle} className="text-center" />
              <SortTh label="Saldo (m)" sortKey="saldo" current={pecasSortKey} dir={pecasSortDir} onSort={pecasToggle} className="text-center" />
            </tr>
          </thead>
          <tbody>
            {pecasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={13} className="p-3 text-center text-muted-foreground">
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
                const prodNumero = prodNumeroMap[p.producao_id];
                return (
                  <tr
                    key={p.id}
                    className={`border-t ${i % 2 === 1 ? "bg-muted/20" : ""}`}
                  >
                    <td className="p-1 text-center">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 align-middle"
                        checked={!!sel[p.id]}
                        onChange={(e) => setSel((s) => ({ ...s, [p.id]: e.target.checked }))}
                      />
                    </td>
                    <td className="p-1 text-center tabular-nums font-semibold">
                      {p.ne != null ? `NE${p.ne}` : "—"}
                    </td>
                    <td className="p-1 text-center tabular-nums">
                      {prodNumero != null ? `PROD${prodNumero}` : "—"}
                    </td>
                    <td className="p-1 text-center truncate" title={p.nota_fiscal ?? ""}>
                      {p.nota_fiscal ?? "—"}
                    </td>
                    <td className="p-1 text-center">
                      <span
                        className="inline-block rounded-sm px-1.5 py-0.5 text-[11.5px] font-semibold"
                        style={{ backgroundColor: bg, color: fg }}
                        title={p.cor ?? ""}
                      >
                        {corBase(p.cor) || "—"}
                      </span>
                    </td>
                    <td className="p-1 text-center tabular-nums">{fmtDateBR(p.data_entrada)}</td>
                    <td className="p-1">
                      <InlineInput
                        value={p.numero_peca}
                        onCommit={(v) => commitField(p, "numero_peca", v)}
                        className="text-center"
                        inputRef={setCellRef(p.id, "numero_peca")}
                        onEnterMoveNext={() => focusNextRow(p.id, "numero_peca")}
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
                          {STATUS_LIST.filter((s) => s !== "Devolvida").map((s) => (
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
                        className="text-center"
                        inputRef={setCellRef(p.id, "data_abertura")}
                        onEnterMoveNext={() => focusNextRow(p.id, "data_abertura")}
                      />
                    </td>
                    <td className="p-1">
                      <LargInput
                        value={p.larg}
                        onCommit={async (n) => { try { await patchEstoquePeca(p.id, { larg: n }); refresh(); } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); } }}
                        inputRef={setCellRef(p.id, "larg")}
                        onEnterMoveNext={() => focusNextRow(p.id, "larg")}
                      />
                    </td>
                    <td className="p-1">
                      <InlineInput
                        type="number"
                        step="0.01"
                        min="0"
                        value={p.alt_inicial}
                        onCommit={(v) => commitField(p, "alt_inicial", v)}
                        className="text-center"
                        inputRef={setCellRef(p.id, "alt_inicial")}
                        onEnterMoveNext={() => focusNextRow(p.id, "alt_inicial")}
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
                      className={`p-1 text-center tabular-nums font-semibold ${
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

      <DevolverPecasDialog
        open={devolverOpen}
        onOpenChange={setDevolverOpen}
        pecas={pecasSelecionadas}
        onDone={() => { setSel({}); refresh(); }}
      />
    </div>
  );
}
