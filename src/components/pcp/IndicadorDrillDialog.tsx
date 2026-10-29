import { useEffect, useMemo, useState } from "react";
import { Download, Search, ArrowUp, ArrowDown, ArrowLeftRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fmtMoeda, fmtNum } from "@/lib/indicadores-olist";
import type { DrillColuna, DrillLinha, DrillPayload, DrillTipo } from "@/lib/indicadores-drill";

function fmtData(v: string | number | null): string {
  const s = String(v ?? "");
  if (!s) return "—";
  const iso = s.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

export function formatCelula(v: string | number | null, tipo: DrillTipo): string {
  if (v === null || v === undefined || v === "") return "—";
  switch (tipo) {
    case "moeda":
      return fmtMoeda(Number(v) || 0);
    case "numero":
      return fmtNum(Number(v) || 0);
    case "dias":
      return (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    case "perc":
      return `${(Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    case "data":
      return fmtData(v);
    default:
      return String(v);
  }
}

function csvEscape(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

function baixarCsv(payload: DrillPayload, linhas: DrillLinha[]) {
  const head = payload.colunas.map((c) => csvEscape(c.label)).join(";");
  const body = linhas
    .map((l) => payload.colunas.map((c) => csvEscape(formatCelula(l[c.chave] ?? null, c.tipo))).join(";"))
    .join("\n");
  const blob = new Blob([`\uFEFF${head}\n${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `detalhamento-${payload.titulo.toLowerCase().replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function alinhamento(c: DrillColuna) {
  if (c.align === "right") return "text-right";
  if (c.align === "center") return "text-center";
  return "text-left";
}

interface Props {
  payload: DrillPayload | null;
  onOpenChange: (open: boolean) => void;
}

export function IndicadorDrillDialog({ payload, onOpenChange }: Props) {
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<{ chave: string; dir: "asc" | "desc" } | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmarLote, setConfirmarLote] = useState(false);

  useEffect(() => {
    setSelecionados(new Set());
  }, [busca]);
  // Fecha ou termina o lote (setDrill(null)) → payload some e a seleção é limpa.
  useEffect(() => {
    if (!payload) {
      setSelecionados(new Set());
      setConfirmarLote(false);
    }
  }, [payload]);

  const linhas = useMemo(() => {
    if (!payload) return [];
    const q = busca.trim().toLowerCase();
    let out = payload.linhas;
    if (q) {
      out = out.filter((l) =>
        payload.colunas.some((c) => String(l[c.chave] ?? "").toLowerCase().includes(q)),
      );
    }
    if (ordem) {
      const col = payload.colunas.find((c) => c.chave === ordem.chave);
      const numerico = col && ["numero", "moeda", "dias", "perc"].includes(col.tipo);
      out = [...out].sort((a, b) => {
        const va = a[ordem.chave];
        const vb = b[ordem.chave];
        let r: number;
        if (numerico) r = (Number(va) || 0) - (Number(vb) || 0);
        else r = String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR");
        return ordem.dir === "asc" ? r : -r;
      });
    }
    return out;
  }, [payload, busca, ordem]);

  if (!payload) return null;

  const acao = payload.acaoEscopo;
  const loteAtivo = !!acao?.onMoverLote;
  /** Mesmo teste que decide mostrar o botão da linha. */
  const podeMover = (numero: string) => {
    if (!acao || !numero) return false;
    if (acao.escopoAtual === "custom" && !acao.ehStoreAuto(numero)) return false;
    return true;
  };
  const numeroDe = (l: DrillLinha) => (acao ? String(l[acao.chaveNumero] ?? "") : "");
  const elegiveisVisiveis = loteAtivo
    ? Array.from(new Set(linhas.map(numeroDe).filter((n) => podeMover(n))))
    : [];
  const marcadosVisiveis = elegiveisVisiveis.filter((n) => selecionados.has(n)).length;
  const estadoCabecalho: boolean | "indeterminate" =
    marcadosVisiveis === 0 ? false : marcadosVisiveis === elegiveisVisiveis.length ? true : "indeterminate";
  const alternarTodos = () => {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (estadoCabecalho === true) elegiveisVisiveis.forEach((x) => n.delete(x));
      else elegiveisVisiveis.forEach((x) => n.add(x));
      return n;
    });
  };
  const alternar = (numero: string, marcar: boolean) => {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (marcar) n.add(numero);
      else n.delete(numero);
      return n;
    });
  };
  const colExtra = (acao ? 1 : 0) + (loteAtivo ? 1 : 0);

  const colSoma = payload.colunas.find((c) => c.somar);
  const somaVisivel = colSoma ? linhas.reduce((s, l) => s + (Number(l[colSoma.chave]) || 0), 0) : null;
  const somaSelecionada = (() => {
    if (!colSoma || !acao || selecionados.size === 0) return null;
    const vistos = new Set<string>();
    let t = 0;
    for (const l of payload.linhas) {
      const n = numeroDe(l);
      if (!selecionados.has(n)) continue;
      const chave = `${n}|${JSON.stringify(l)}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      t += Number(l[colSoma.chave]) || 0;
    }
    return t;
  })();
  const confere =
    payload.indicadorValor != null && payload.totalConferencia != null
      ? Math.abs(payload.indicadorValor - payload.totalConferencia) < 0.01
      : null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] sm:max-w-[1200px] max-h-[92vh] flex flex-col gap-3">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">{payload.titulo}</DialogTitle>
          <DialogDescription className="text-xs">
            {payload.subtitulo ?? "Linhas que compõem este indicador."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nesta lista…"
              className="h-8 pl-7 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {fmtNum(linhas.length)} de {fmtNum(payload.linhas.length)} linha(s)
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => baixarCsv(payload, linhas)}
            disabled={!linhas.length}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Exportar CSV
          </Button>
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          <table className="w-full text-xs tbl-congelada">
            <thead>
              <tr>
                {loteAtivo ? (
                  <th className="w-8 px-2 py-1.5">
                    <Checkbox
                      checked={estadoCabecalho}
                      onCheckedChange={alternarTodos}
                      disabled={!elegiveisVisiveis.length}
                      aria-label="Marcar todos"
                    />
                  </th>
                ) : null}
                {payload.colunas.map((c) => {
                  const ativo = ordem?.chave === c.chave;
                  return (
                    <th
                      key={c.chave}
                      className={`px-2 py-1.5 font-semibold whitespace-nowrap cursor-pointer select-none ${alinhamento(c)}`}
                      onClick={() =>
                        setOrdem((prev) =>
                          prev?.chave === c.chave
                            ? { chave: c.chave, dir: prev.dir === "asc" ? "desc" : "asc" }
                            : { chave: c.chave, dir: "desc" },
                        )
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {ativo ? (
                          ordem!.dir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : null}
                      </span>
                    </th>
                  );
                })}
                {acao ? <th className="px-2 py-1.5 font-semibold whitespace-nowrap text-right">Escopo</th> : null}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td
                    colSpan={payload.colunas.length + colExtra}
                    className="px-2 py-6 text-center text-muted-foreground"
                  >
                    Nenhuma linha compõe este indicador com os filtros atuais.
                  </td>
                </tr>
              ) : (
                linhas.map((l, idx) => (
                  <tr key={idx} className="border-t hover:bg-muted/40">
                    {loteAtivo ? (
                      <td className="w-8 px-2 py-1">
                        {(() => {
                          const n = numeroDe(l);
                          if (!podeMover(n)) return null;
                          return (
                            <Checkbox
                              checked={selecionados.has(n)}
                              onCheckedChange={(v) => alternar(n, v === true)}
                              aria-label={`Selecionar pedido ${n}`}
                            />
                          );
                        })()}
                      </td>
                    ) : null}
                    {payload.colunas.map((c) => (
                      <td
                        key={c.chave}
                        className={`px-2 py-1 whitespace-nowrap ${alinhamento(c)} ${
                          ["numero", "moeda", "dias", "perc"].includes(c.tipo) ? "tabular-nums" : ""
                        }`}
                      >
                        {formatCelula(l[c.chave] ?? null, c.tipo)}
                      </td>
                    ))}
                    {acao ? (
                      <td className="px-2 py-1 whitespace-nowrap text-right">
                        {(() => {
                          const numero = String(l[acao.chaveNumero] ?? "");
                          const destino = acao.escopoAtual === "store" ? "custom" : "store";
                          /* No Custom só faz sentido devolver pedido cuja regra automática é Store. */
                          if (!podeMover(numero)) return null;
                          const carregando = acao.pendente === numero;
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              disabled={!!acao.pendente}
                              onClick={() => acao.onMover(numero, destino)}
                            >
                              <ArrowLeftRight className="h-3 w-3 mr-1" />
                              {carregando
                                ? "Movendo…"
                                : destino === "custom"
                                  ? "Mover para Custom"
                                  : "Voltar para Store"}
                            </Button>
                          );
                        })()}
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
            {colSoma && linhas.length > 0 ? (
              <tfoot>
                <tr className="border-t bg-muted/60 font-semibold">
                  {loteAtivo ? <td /> : null}
                  {payload.colunas.map((c, i) => (
                    <td key={c.chave} className={`px-2 py-1.5 ${alinhamento(c)} tabular-nums`}>
                      {c.chave === colSoma.chave
                        ? formatCelula(somaVisivel, c.tipo)
                        : i === 0
                          ? "Total exibido"
                          : ""}
                    </td>
                  ))}
                  {acao ? <td /> : null}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>


        {loteAtivo && selecionados.size > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs">
            <span className="tabular-nums">
              {selecionados.size === 1 ? "1 pedido selecionado" : `${fmtNum(selecionados.size)} pedidos selecionados`}
              {somaSelecionada != null && colSoma ? ` · ${formatCelula(somaSelecionada, colSoma.tipo)}` : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSelecionados(new Set())}>
                Limpar seleção
              </Button>
              <Button size="sm" className="h-7 text-xs" disabled={!!acao?.loteEmAndamento} onClick={() => setConfirmarLote(true)}>
                <ArrowLeftRight className="h-3 w-3 mr-1" />
                {acao?.loteEmAndamento ? "Movendo…" : "Mover para Custom"}
              </Button>
            </div>
          </div>
        ) : null}

        <AlertDialog open={confirmarLote} onOpenChange={setConfirmarLote}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mover para Juff Custom</AlertDialogTitle>
              <AlertDialogDescription>
                Você vai mover {selecionados.size === 1 ? "1 pedido" : `${selecionados.size} pedidos`} de Juff Store para Juff Custom. Os indicadores dos dois escopos vão mudar. Dá para desfazer depois, pedido por pedido, pelo botão Voltar para Store.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmarLote(false);
                  acao?.onMoverLote?.(Array.from(selecionados));
                }}
              >
                Mover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {payload.indicadorLabel ? (
            <span>
              Indicador no painel: <strong className="text-foreground tabular-nums">{payload.indicadorLabel}</strong>
            </span>
            ) : null}
            {payload.totalConferencia != null ? (
              <span>
                Conferência das linhas:{" "}
                <strong className="text-foreground tabular-nums">
                  {formatCelula(payload.totalConferencia, payload.conferenciaTipo ?? "numero")}
                </strong>
              </span>
            ) : null}
            {confere === false ? (
              <span className="text-destructive">
                Diferença de arredondamento ou linhas sem par — confira a nota abaixo.
              </span>
            ) : null}
          </div>
          {payload.nota ? <p>{payload.nota}</p> : null}
          {loteAtivo ? (
            <p>
              Marque as linhas para mover vários pedidos de uma vez entre Juff Store e Juff Custom. A troca é salva e
              pode ser desfeita quando quiser.
            </p>
          ) : acao ? (
            <p>
              O botão move o pedido inteiro entre Juff Store e Juff Custom. A troca é salva e pode ser desfeita
              quando quiser.
            </p>
          ) : (
            <p>Visualização somente leitura. Nada aqui altera dados.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default IndicadorDrillDialog;
