import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History } from "lucide-react";
import { toast } from "sonner";
import {
  useEstoquePecas,
  useMapData,
  patchEstoquePeca,
  prodCode,
  fmtDateBR,
  corBase,
  type MapEstoquePeca,
  type MapProducao,
  type HistoricoCorrecaoEvento,
} from "@/lib/map";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";
import { InlineInput } from "./InlineInput";
import { CorrigirPecaDialog } from "./CorrigirPecaDialog";
import { ReceberPecaCorrigidaDialog } from "./ReceberPecaCorrigidaDialog";

type Filtro = "todas" | "devolvida" | "aguardando_retingir" | "em_retrabalho";

function situacao(p: MapEstoquePeca): Filtro {
  if (p.correcao_status === "aguardando_retingir") return "aguardando_retingir";
  if (p.correcao_status === "em_retrabalho") return "em_retrabalho";
  return "devolvida";
}

function SituacaoBadge({ p }: { p: MapEstoquePeca }) {
  const s = situacao(p);
  if (s === "aguardando_retingir")
    return (
      <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
        Aguardando retingir{p.cor_nova ? ` → ${p.cor_nova}` : ""}
      </Badge>
    );
  if (s === "em_retrabalho")
    return <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">Em retrabalho</Badge>;
  return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Devolvida</Badge>;
}

function fmtDataHora(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

function HistoricoDialog({ peca, onOpenChange }: { peca: MapEstoquePeca | null; onOpenChange: (v: boolean) => void }) {
  const eventos: HistoricoCorrecaoEvento[] = Array.isArray(peca?.historico_correcoes) ? peca!.historico_correcoes! : [];
  const ordenados = [...eventos].reverse();
  return (
    <Dialog open={!!peca} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            Histórico — {peca?.ne != null ? `NE${peca.ne}` : "peça"} · {peca?.numero_peca ?? "—"}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto space-y-2 text-xs">
          {ordenados.length === 0 && <div className="text-muted-foreground">Sem eventos.</div>}
          {ordenados.map((e, i) => (
            <div key={i} className="rounded-md border p-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {e.tipo === "devolucao" ? "Devolução" : e.tipo === "correcao_iniciada" ? "Correção iniciada" : "Retorno"}
                </span>
                <span className="text-muted-foreground tabular-nums">{fmtDataHora(e.em)}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                {e.motivo && <div>Motivo: <span className="text-foreground">{e.motivo}</span></div>}
                {e.data_devolucao && <div>Data devolução: <span className="text-foreground">{fmtDateBR(e.data_devolucao)}</span></div>}
                {e.nf_devolucao && <div>NF devolução: <span className="text-foreground">{e.nf_devolucao}</span></div>}
                {e.correcao && <div>Correção: <span className="text-foreground">{e.correcao}</span></div>}
                {e.cor_nova && <div>Cor nova: <span className="text-foreground">{e.cor_nova}</span></div>}
                {e.numero_peca_antigo && <div>Nº peça anterior: <span className="text-foreground">{e.numero_peca_antigo}</span></div>}
                {e.nota_fiscal_antiga && <div>NF anterior: <span className="text-foreground">{e.nota_fiscal_antiga}</span></div>}
                {e.cor_antiga && <div>Cor anterior: <span className="text-foreground">{e.cor_antiga}</span></div>}
                {e.data_entrada_antiga && <div>Entrada anterior: <span className="text-foreground">{fmtDateBR(e.data_entrada_antiga)}</span></div>}
                {e.numero_peca_novo && <div>Nº peça novo: <span className="text-foreground">{e.numero_peca_novo}</span></div>}
                {e.nota_fiscal_nova && <div>NF nova: <span className="text-foreground">{e.nota_fiscal_nova}</span></div>}
                {e.data_entrada_nova && <div>Entrada nova: <span className="text-foreground">{fmtDateBR(e.data_entrada_nova)}</span></div>}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DevolucoesTab() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [corrigir, setCorrigir] = useState<MapEstoquePeca | null>(null);
  const [receber, setReceber] = useState<MapEstoquePeca | null>(null);
  const [hist, setHist] = useState<MapEstoquePeca | null>(null);

  const { data: pecas = [], isLoading } = useEstoquePecas();
  const { producoes: prodProg } = useMapData(false);
  const { producoes: prodFin } = useMapData(true);
  const prodMap = useMemo(() => {
    const m = new Map<string, MapProducao>();
    for (const p of prodProg.data ?? []) m.set(p.id, p);
    for (const p of prodFin.data ?? []) m.set(p.id, p);
    return m;
  }, [prodProg.data, prodFin.data]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["map", "estoque_pecas"] });

  const linhas = useMemo(() => {
    return pecas
      .filter((p) => p.status === "Devolvida")
      .filter((p) => (filtro === "todas" ? true : situacao(p) === filtro))
      .sort((a, b) => (a.ne ?? Number.MAX_SAFE_INTEGER) - (b.ne ?? Number.MAX_SAFE_INTEGER));
  }, [pecas, filtro]);

  async function salvarNf(p: MapEstoquePeca, v: string | null) {
    try {
      await patchEstoquePeca(p.id, { devolucao_nf: v?.trim() || null } as any);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar NF.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Situação:</span>
        <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="devolvida">Devolvida</SelectItem>
            <SelectItem value="aguardando_retingir">Aguardando retingir</SelectItem>
            <SelectItem value="em_retrabalho">Em retrabalho</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">{linhas.length} peça(s)</span>
      </div>

      <div className="overflow-auto max-h-[70vh] tbl-congelada rounded-lg border border-border/60 bg-card">
        <table className="w-full text-xs">
          <thead className="bg-yellow-100/60 text-left">
            <tr>
              <th className="p-2">NE</th>
              <th className="p-2">PROD</th>
              <th className="p-2">Nº peça</th>
              <th className="p-2 text-center">Cor atual</th>
              <th className="p-2">Motivo</th>
              <th className="p-2 text-center">Data devolução</th>
              <th className="p-2 text-center">NF devolução</th>
              <th className="p-2 text-center">Situação</th>
              <th className="p-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!isLoading && linhas.length === 0 && (
              <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Sem peças devolvidas.</td></tr>
            )}
            {linhas.map((p, i) => {
              const prod = prodMap.get(p.producao_id);
              const bg = corHex(corBase(p.cor));
              const fg = corTextoSobre(bg);
              return (
                <tr key={p.id} className={`border-t ${i % 2 ? "bg-muted/20" : ""}`}>
                  <td className="p-2">
                    <button
                      className="font-semibold tabular-nums underline-offset-2 hover:underline"
                      onClick={() => setHist(p)}
                      title="Ver histórico da peça"
                    >
                      {p.ne != null ? `NE${p.ne}` : "—"}
                    </button>
                  </td>
                  <td className="p-2 tabular-nums">{prod ? prodCode(prod.numero) : "—"}</td>
                  <td className="p-2">{p.numero_peca ?? "—"}</td>
                  <td className="p-2 text-center">
                    <span
                      className="inline-block rounded-sm px-1.5 py-0.5 text-[11.5px] font-semibold"
                      style={{ backgroundColor: bg, color: fg }}
                      title={p.cor ?? ""}
                    >
                      {corBase(p.cor) || "—"}
                    </span>
                  </td>
                  <td className="p-2">{p.devolucao_motivo ?? "—"}</td>
                  <td className="p-2 text-center tabular-nums">{fmtDateBR(p.devolucao_data)}</td>
                  <td className="p-2">
                    <InlineInput
                      value={p.devolucao_nf ?? null}
                      onCommit={(v) => salvarNf(p, v)}
                      className="text-center"
                    />
                  </td>
                  <td className="p-2 text-center"><SituacaoBadge p={p} /></td>
                  <td className="p-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setHist(p)} title="Histórico">
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      {!p.correcao_status ? (
                        <Button size="sm" className="h-7 text-xs" onClick={() => setCorrigir(p)}>Corrigir</Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => setReceber(p)}
                        >
                          {p.correcao_tipo === "retrabalhar" ? "Receber peça retrabalhada" : "Receber peça retingida"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {corrigir && (
        <CorrigirPecaDialog
          open={!!corrigir}
          onOpenChange={(v) => !v && setCorrigir(null)}
          peca={corrigir}
          onDone={refresh}
        />
      )}
      {receber && (
        <ReceberPecaCorrigidaDialog
          open={!!receber}
          onOpenChange={(v) => !v && setReceber(null)}
          peca={receber}
          onDone={refresh}
        />
      )}
      <HistoricoDialog peca={hist} onOpenChange={(v) => !v && setHist(null)} />
    </div>
  );
}
