import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAuditLog, listAuditUsers, type AuditLogEntry } from "@/lib/audit-log.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronLeft, ChevronRight, X } from "lucide-react";

import { labelCampo, formatValor } from "@/lib/audit-labels";

const TABELA_LABELS: Record<string, string> = {
  pedidos: "Pedido",
  map_producoes: "Produção",
  map_tinturaria_programacoes: "Tinturaria",
  map_malharia_entregas: "Malharia",
  map_estoque_pecas: "Estoque peça",
  map_devolucoes: "Devolução",
  cops: "COP",
  oficinas: "Oficina",
  cop_perdas: "Perda COP",
  pagamentos_consolidados: "Pgto consolidado",
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function autor(e: AuditLogEntry): string {
  return e.feito_por_nome || e.feito_por_email || (e.feito_por ? "usuário " + e.feito_por.slice(0, 6) : "sistema");
}

function acaoBadge(a: AuditLogEntry["acao"]) {
  if (a === "insert") return <Badge className="bg-green-600 hover:bg-green-600">criado</Badge>;
  if (a === "delete") return <Badge variant="destructive">deletado</Badge>;
  return <Badge variant="secondary">alterado</Badge>;
}

interface Props {
  area: "pcp" | "map" | "cop";
}

export function AuditLogView({ area }: Props) {
  const fetchLog = useServerFn(getAuditLog);
  const fetchUsers = useServerFn(listAuditUsers);

  const [busca, setBusca] = useState("");
  const [buscaInput, setBuscaInput] = useState("");
  const [usuarioId, setUsuarioId] = useState<string>("__all__");
  const [acao, setAcao] = useState<string>("__all__");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [page, setPage] = useState(1);

  const usersQ = useQuery({
    queryKey: ["audit-users"],
    queryFn: async () => fetchUsers(),
  });

  const logQ = useQuery({
    queryKey: ["audit-log", area, busca, usuarioId, acao, dataInicio, dataFim, page],
    queryFn: async () => {
      return fetchLog({
        data: {
          area,
          busca: busca || undefined,
          usuarioId: usuarioId !== "__all__" ? usuarioId : undefined,
          acao: acao !== "__all__" ? (acao as any) : undefined,
          dataInicio: dataInicio ? new Date(dataInicio).toISOString() : undefined,
          dataFim: dataFim ? new Date(dataFim + "T23:59:59").toISOString() : undefined,
          page,
        },
      });
    },
  });

  function limparFiltros() {
    setBusca(""); setBuscaInput(""); setUsuarioId("__all__");
    setAcao("__all__"); setDataInicio(""); setDataFim(""); setPage(1);
  }

  function aplicarBusca(e: React.FormEvent) {
    e.preventDefault();
    setBusca(buscaInput.trim());
    setPage(1);
  }

  const total = logQ.data?.total ?? 0;
  const pageSize = logQ.data?.pageSize ?? 200;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-lg p-3 sm:p-4 space-y-3">
        <form onSubmit={aplicarBusca} className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">
              {area === "pcp" ? "Buscar (Olist / Orçamento)" : "Buscar (identificador)"}
            </label>
            <Input
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              placeholder={area === "pcp" ? "Ex.: 22961" : "Ex.: nome oficina, nº COP…"}
            />
          </div>
          <div className="min-w-[180px]">
            <label className="text-xs text-muted-foreground">Usuário</label>
            <Select value={usuarioId} onValueChange={(v) => { setUsuarioId(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {(usersQ.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome || u.email || u.id.slice(0, 6)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs text-muted-foreground">Ação</label>
            <Select value={acao} onValueChange={(v) => { setAcao(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                <SelectItem value="insert">Criado</SelectItem>
                <SelectItem value="update">Alterado</SelectItem>
                <SelectItem value="delete">Deletado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs text-muted-foreground">De</label>
            <Input type="date" value={dataInicio}
              onChange={(e) => { setDataInicio(e.target.value); setPage(1); }} />
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs text-muted-foreground">Até</label>
            <Input type="date" value={dataFim}
              onChange={(e) => { setDataFim(e.target.value); setPage(1); }} />
          </div>
          <Button type="submit">Buscar</Button>
          <Button type="button" variant="ghost" size="sm" onClick={limparFiltros}>
            <X className="h-4 w-4 mr-1" />Limpar
          </Button>
        </form>

        <div className="text-xs text-muted-foreground flex items-center justify-between">
          <span>
            {logQ.isLoading ? "carregando…" : `${total} registro${total === 1 ? "" : "s"}`}
            {totalPages > 1 && ` · página ${page} de ${totalPages}`}
          </span>
          {totalPages > 1 && (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {logQ.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}
      {logQ.error && (
        <div className="text-sm text-destructive py-4">
          Erro: {(logQ.error as Error).message}
        </div>
      )}

      {!logQ.isLoading && logQ.data && logQ.data.entries.length === 0 && (
        <div className="text-sm text-muted-foreground py-6 border rounded-md text-center">
          Nenhum registro encontrado com os filtros aplicados.
        </div>
      )}

      {logQ.data && logQ.data.entries.length > 0 && (
        <ol className="relative border-l border-border pl-5 space-y-4 pt-2">
          {logQ.data.entries.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[26px] top-1.5 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {acaoBadge(e.acao)}
                {area !== "pcp" && (
                  <Badge variant="outline" className="text-[10px]">
                    {TABELA_LABELS[e.tabela] ?? e.tabela}
                  </Badge>
                )}
                {area === "pcp" && (() => {
                  const olist = e.pedido_olist ?? (e.linha_completa?.pedido_olist as string | null | undefined);
                  const orc = e.orcamento ?? (e.linha_completa?.orcamento as string | null | undefined);
                  return (
                    <>
                      {olist && (
                        <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          Olist {olist}
                        </span>
                      )}
                      {orc && (
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                          Orç. {orc}
                        </span>
                      )}
                      {!olist && !orc && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          #{e.registro_id.slice(0, 8)}
                        </span>
                      )}
                    </>
                  );
                })()}
                {area !== "pcp" && e.identificador && (
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                    {e.identificador}
                  </span>
                )}
                <span className="font-medium">{autor(e)}</span>
                <span className="text-muted-foreground">em {fmtDateTime(e.feito_em)}</span>
              </div>
              {e.acao === "update" && e.mudancas && e.mudancas.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs">
                  {e.mudancas.map((m, i) => {
                    const de = formatValor(m.campo, m.de as any);
                    const para = formatValor(m.campo, m.para as any);
                    return (
                      <li key={i} className="text-muted-foreground">
                        <span className="text-foreground font-medium">{labelCampo(m.campo)}</span>{": "}
                        <span className="line-through opacity-70" title={de.titulo}>{de.texto}</span>
                        {" → "}
                        <span className="text-foreground" title={para.titulo}>{para.texto}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
