import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAuditLog, listAuditUsers, type AuditLogEntry } from "@/lib/audit-log.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronLeft, ChevronRight, X } from "lucide-react";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

// Labels PT-BR de campos (cobre pedidos + tabelas MAP/COP)
const LABELS: Record<string, string> = {
  // pedidos
  pedido_olist: "Pedido Olist", orcamento: "Orçamento", vendedor: "Vendedor",
  tipo_estampa: "Tipo de estampa", status_pecas: "Status de peças", status_arte: "Status de arte",
  qtd: "Quantidade", frete: "Frete", uf_entrega: "UF entrega", data_entrega: "Data de entrega",
  entrada_pedido: "Entrada do pedido", inicio_estamparia: "Início estamparia",
  termino_estamparia: "Término estamparia", saida_juff: "Saída Juff",
  dtf_executado: "DTF executado", silk_feito: "Silk feito", embalado: "Embalado",
  layout_url: "Layout", finalizado_em: "Finalizado em", reaberto: "Reaberto",
  // map
  numero: "Número", data_pedido: "Data do pedido", faturar_para: "Faturar para",
  fornecedor: "Fornecedor", kg_solicitados: "Kg solicitados", nota_fiscal: "Nota fiscal",
  data_faturamento: "Data faturamento", data_pagamento: "Data pagamento", status: "Status",
  malharia: "Malharia", quebra_conciliada: "Quebra conciliada", finalizado: "Finalizado",
  status_malharia: "Status malharia", tinturaria: "Tinturaria", data_programacao: "Data programação",
  pecas: "Peças", cor: "Cor", kg_enviados: "Kg enviados", kg_recebidos: "Kg recebidos",
  pecas_recebidas: "Peças recebidas", data_recebimento: "Data recebimento",
  nota_fiscal_1: "NF 1", nota_fiscal_2: "NF 2", nota_cobertura: "Nota cobertura",
  kg: "Kg", programacao_id: "Programação ID", producao_id: "Produção ID",
  numero_peca: "Nº peça", data_entrada: "Data entrada", data_abertura: "Data abertura",
  alt_inicial: "Alt. inicial", cortes: "Cortes", faturado_para: "Faturado para",
  data_devolucao: "Data devolução", obs: "Observação", observacoes: "Observações",
  // cop
  solicitacao_risco: "Solicitação risco", execucao_risco: "Execução risco",
  solicitacao_corte: "Solicitação corte", execucao_corte: "Execução corte",
  observacoes_corte: "Obs. corte", cop_pai_id: "COP pai", corte_dividido: "Corte dividido",
  oficina_id: "Oficina", data_saida_oficina: "Saída oficina", num_fretes: "Nº fretes",
  romaneio_enviado_em: "Romaneio enviado em", letra: "Letra",
  conferido_em: "Conferido em", conferencia: "Conferência",
  pagamento_status: "Status pagamento", pagamento_liberado_em: "Pgto liberado em",
  pagamento_pago_em: "Pgto pago em", pagamento_valor_calculado: "Valor pgto",
  perdas: "Perdas", observacoes_pagamento: "Obs. pagamento",
  historico_recebimentos: "Hist. recebimentos", corte_em_correcao: "Corte em correção",
  pagamento_consolidado_id: "Pgto consolidado",
  // oficinas
  nome: "Nome", cnpj_cpf: "CNPJ/CPF", endereco: "Endereço", cep: "CEP",
  valor_frete: "Valor frete", valores_por_modelo: "Valores por modelo",
  cnpj: "CNPJ", cpf: "CPF", telefone: "Telefone",
  // cop_perdas
  etiqueta: "Etiqueta", modelo: "Modelo", tamanho: "Tamanho", motivo: "Motivo",
  registrado_por: "Registrado por",
  // pagamentos_consolidados
  detalhes: "Detalhes", valor_total: "Valor total", observacao: "Observação",
  pago_por: "Pago por", pago_em: "Pago em",
};
const label = (c: string) => LABELS[c] ?? c;

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

function fmtVal(v: Json): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split("-"); return `${d}/${m}/${y}`;
    }
    if (v.length > 80) return v.slice(0, 80) + "…";
    return v || "—";
  }
  if (typeof v === "number") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 100 ? s.slice(0, 100) + "…" : s;
  } catch { return String(v); }
}

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
                {e.identificador && (
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                    {e.identificador}
                  </span>
                )}
                <span className="font-medium">{autor(e)}</span>
                <span className="text-muted-foreground">em {fmtDateTime(e.feito_em)}</span>
              </div>
              {e.acao === "update" && e.mudancas && e.mudancas.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs">
                  {e.mudancas.map((m, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="text-foreground font-medium">{label(m.campo)}</span>{": "}
                      <span className="line-through opacity-70">{fmtVal(m.de)}</span>
                      {" → "}
                      <span className="text-foreground">{fmtVal(m.para)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
