import { useMemo, useState } from "react";
import {
  ETAPA_DESTINO_LABEL,
  episodioAberto,
  tipoIncluiDTF,
  totalProducao,
  type Pedido,
  type RefacaoEpisodio,
  type RefacaoRetrato,
} from "@/lib/pedidos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaixaSomenteLeitura } from "./DadosInTab";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Trash2, Save, Pencil, X } from "lucide-react";
import { useProfilesMap, resolveNome } from "@/hooks/use-profiles-map";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface Props {
  pedidos: Pedido[];
  onSave: (p: Partial<Pedido> & { id?: string }) => void;
  soLeitura?: boolean;
}

// ----------- Formatadores ----------

function fmtDataHoraBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return String(iso);
  }
}

function fmtDataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    // Aceita "YYYY-MM-DD" ou ISO completo
    const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(iso);
    const d = onlyDate ? new Date(iso + "T00:00:00") : new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return String(iso);
  }
}

const ETAPA_LABEL_MAP: Record<string, string> = {
  dados: "Dados In",
  arte: "Arte",
  dtf: "DTF",
  silk: "Silk",
  acabamento: "Acabamento",
  expedicao: "Expedição",
  "Aguardando entrada": "Dados In",
  "Aguardando Dados In": "Dados In",
  "Aguardando input de produção": "Dados In",
  "Aguardando Arte": "Arte",
  "DTF Liberado / Silk na Arte": "Arte",
  "Silk Liberado / DTF na Arte": "Arte",
  "Aguardando DTF": "DTF",
  "Aguardando Silk": "Silk",
  "Aguardando DTF + Silk": "DTF/Silk",
  "Aguardando Acabamento": "Acabamento",
  "Aguardando Expedição": "Expedição",
  "Saiu para entrega": "Saiu para entrega",
  "Entregue": "Entregue",
};

function fmtEtapa(v: string | null | undefined): string {
  if (!v) return "—";
  return ETAPA_LABEL_MAP[v] ?? v;
}

// ----------- Componente principal ----------

export function RetrabalhoTab({ pedidos, onSave, soLeitura = false }: Props) {
  const [busca, setBusca] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const profilesMap = useProfilesMap();

  const pedidosComRefacao = useMemo(
    () =>
      pedidos.filter((p) => Array.isArray(p.refacoes) && p.refacoes.length > 0),
    [pedidos],
  );

  const filtrados = useMemo(() => {
    if (!busca) return pedidosComRefacao;
    const q = busca.toLowerCase();
    return pedidosComRefacao.filter(
      (p) =>
        String(p.pedido_olist ?? "").toLowerCase().includes(q) ||
        String(p.orcamento ?? "").toLowerCase().includes(q),
    );
  }, [pedidosComRefacao, busca]);

  const stats = useMemo(() => {
    let totalRefeitas = 0;
    let totalPerdaPecas = 0;
    let totalPerdaAdesivos = 0;
    let totalProduzidas = 0;
    const problemaCount: Record<string, number> = {};
    const areaIdCount: Record<string, number> = {};
    const areaErroCount: Record<string, number> = {};
    let abertas = 0;
    const episodiosPorPedido: Record<string, number> = {};
    const duracoesDias: number[] = [];
    const now = new Date();
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();
    const mesPassado = new Date(anoAtual, mesAtual - 1, 1);
    let perdaMes = 0;
    let perdaMesAnt = 0;
    const problemaUlt30: Record<string, number> = {};
    const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    pedidos.forEach((p) => {
      totalProduzidas += totalProducao(p).total;
      const refs = p.refacoes ?? [];
      if (refs.length > 0) episodiosPorPedido[p.id] = refs.length;
      refs.forEach((e) => {
        totalRefeitas += Number(e.pecas_refazer ?? 0);
        totalPerdaPecas += Number(e.perda_pecas ?? 0);
        totalPerdaAdesivos += Number(e.perda_adesivos ?? 0);
        if (e.problema) problemaCount[e.problema] = (problemaCount[e.problema] ?? 0) + 1;
        if (e.area_identificou) areaIdCount[e.area_identificou] = (areaIdCount[e.area_identificou] ?? 0) + 1;
        if (e.area_erro) areaErroCount[e.area_erro] = (areaErroCount[e.area_erro] ?? 0) + 1;
        if (e.aberto) abertas += 1;
        if (!e.aberto && e.data && (e as any).fechado_em) {
          const t0 = new Date(e.data).getTime();
          const t1 = new Date((e as any).fechado_em as string).getTime();
          if (Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0) {
            duracoesDias.push((t1 - t0) / (1000 * 60 * 60 * 24));
          }
        }
        const dtAb = e.data ? new Date(e.data) : null;
        if (dtAb && !Number.isNaN(dtAb.getTime())) {
          if (dtAb.getMonth() === mesAtual && dtAb.getFullYear() === anoAtual) {
            perdaMes += Number(e.perda_pecas ?? 0);
          } else if (dtAb.getMonth() === mesPassado.getMonth() && dtAb.getFullYear() === mesPassado.getFullYear()) {
            perdaMesAnt += Number(e.perda_pecas ?? 0);
          }
          if (dtAb >= cutoff30 && e.problema) {
            problemaUlt30[e.problema] = (problemaUlt30[e.problema] ?? 0) + 1;
          }
        }
      });
    });
    const pct = totalProduzidas > 0 ? (totalRefeitas / totalProduzidas) * 100 : 0;
    const problemasRank = Object.entries(problemaCount).sort((a, b) => b[1] - a[1]);
    const areasIdRank = Object.entries(areaIdCount).sort((a, b) => b[1] - a[1]);
    const areasErroRank = Object.entries(areaErroCount).sort((a, b) => b[1] - a[1]);
    const reincidencia = Object.values(episodiosPorPedido).filter((n) => n >= 2).length;
    const tempoMedio = duracoesDias.length > 0 ? duracoesDias.reduce((a, b) => a + b, 0) / duracoesDias.length : null;
    const deltaPerdaMes = perdaMes - perdaMesAnt;
    const problemaRecorrenteMes = Object.entries(problemaUlt30).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return {
      totalRefeitas, totalPerdaPecas, totalPerdaAdesivos, pct,
      problemasRank, areasIdRank, areasErroRank, abertas, reincidencia, tempoMedio,
      perdaMes, deltaPerdaMes, problemaRecorrenteMes,
    };
  }, [pedidos]);

  const [rankDialog, setRankDialog] = useState<null | { titulo: string; entries: [string, number][] }>(null);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function updateEpisodio(pedido: Pedido, idx: number, patch: Partial<RefacaoEpisodio>) {
    if (soLeitura) return;
    const refs: RefacaoEpisodio[] = [...((pedido.refacoes ?? []) as RefacaoEpisodio[])];
    refs[idx] = { ...refs[idx], ...patch };
    onSave({ id: pedido.id, refacoes: refs } as any);
  }

  function deleteEpisodio(pedido: Pedido, idx: number) {
    if (soLeitura) return;
    if (!confirm("Apagar este episódio de refação? Essa ação reduz a contagem de asteriscos do pedido.")) return;
    const refs = (pedido.refacoes ?? []).filter((_, i) => i !== idx);
    onSave({ id: pedido.id, refacoes: refs } as any);
  }

  return (
    <div className="space-y-4">
      {soLeitura && <FaixaSomenteLeitura />}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Peças refeitas" value={stats.totalRefeitas} />
        <StatCard label="Peças perdidas" value={stats.totalPerdaPecas} />
        <StatCard label="Adesivos perdidos" value={stats.totalPerdaAdesivos} />
        <StatCard label="% Retrabalho" value={`${stats.pct.toFixed(1)}%`} />
        <StatCard
          label="Problemas mais comuns"
          value={stats.problemasRank[0]?.[0] ?? "—"}
          onClick={stats.problemasRank.length ? () => setRankDialog({ titulo: "Ranking de problemas", entries: stats.problemasRank }) : undefined}
        />
        <StatCard
          label="Área que mais identifica"
          value={stats.areasIdRank[0]?.[0] ?? "—"}
          onClick={() => setRankDialog({ titulo: "Áreas que identificam refação", entries: stats.areasIdRank })}
        />
        <StatCard
          label="Área que mais errou"
          value={stats.areasErroRank[0]?.[0] ?? "—"}
          onClick={() => setRankDialog({ titulo: "Áreas que erraram", entries: stats.areasErroRank })}
        />
        <StatCard label="Refações em aberto" value={stats.abertas} />
        <StatCard label="Reincidência (pedidos ≥2)" value={stats.reincidencia} />
        <StatCard label="Tempo médio de resolução" value={stats.tempoMedio == null ? "—" : `${stats.tempoMedio.toFixed(1)} d`} />
        <StatCard
          label="Peças perdidas no mês"
          value={stats.perdaMes}
          hint={`${stats.deltaPerdaMes >= 0 ? "+" : ""}${stats.deltaPerdaMes} vs mês anterior`}
        />
        <StatCard label="Problema recorrente (30d)" value={stats.problemaRecorrenteMes} />
      </div>

      <Dialog open={!!rankDialog} onOpenChange={(o) => !o && setRankDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{rankDialog?.titulo}</DialogTitle>
            <DialogDescription>Distribuição por ocorrências</DialogDescription>
          </DialogHeader>
          {rankDialog && (
            rankDialog.entries.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">Sem dados.</div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankDialog.entries.map(([name, value]) => ({ name, value }))} layout="vertical" margin={{ left: 24, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={140} />
                    <RTooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>


      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <div className="flex items-baseline gap-2"><CardTitle className="text-base">Pedidos com refação</CardTitle><span className="text-xs text-muted-foreground tabular-nums">{filtrados.length} {filtrados.length === 1 ? "registro" : "registros"}</span></div>
          <Input
            placeholder="Buscar pedido ou orçamento"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-xs h-8"
          />
        </CardHeader>
        <CardContent className="space-y-2">
          {filtrados.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhum pedido com refação.
            </div>
          ) : (
            filtrados.map((p) => {
              const refs = p.refacoes ?? [];
              const isOpen = expanded.has(p.id);
              const totalRefeitasPed = refs.reduce((a, e) => a + Number(e.pecas_refazer ?? 0), 0);
              return (
                <div key={p.id} className="rounded-md border">
                  <button
                    type="button"
                    onClick={() => toggleExpand(p.id)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-accent text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="font-medium">{p.pedido_olist ?? "—"}</span>
                      <span className="text-xs text-muted-foreground truncate">{p.orcamento ?? ""}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{refs.length} episódio{refs.length === 1 ? "" : "s"}</Badge>
                      <Badge variant="outline">{totalRefeitasPed} pç refeitas</Badge>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t p-3 space-y-3">
                      {refs.map((e, idx) => (
                        <EpisodioCard
                          key={idx}
                          pedido={p}
                          episodio={e}
                          profilesMap={profilesMap}
                          onUpdate={(patch) => updateEpisodio(p, idx, patch)}
                          onDelete={() => deleteEpisodio(p, idx)}
                          soLeitura={soLeitura}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, hint, onClick }: { label: string; value: string | number; hint?: string; onClick?: () => void }) {
  return (
    <Card className={onClick ? "cursor-pointer hover:bg-accent/40 transition-colors" : undefined} onClick={onClick}>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums truncate" title={String(value)}>{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}


// ----------- Card do episódio (read-only + Editar) ----------

function EpisodioCard({
  pedido,
  episodio,
  profilesMap,
  onUpdate,
  onDelete,
  soLeitura = false,
}: {
  pedido: Pedido;
  episodio: RefacaoEpisodio;
  profilesMap: Record<string, string>;
  onUpdate: (patch: Partial<RefacaoEpisodio>) => void;
  onDelete: () => void;
  soLeitura?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const mostraAdesivos = tipoIncluiDTF(pedido.tipo_estampa);
  const responsavel = resolveNome(profilesMap, episodio.quem);

  if (editing) {
    return (
      <EpisodioEditor
        episodio={episodio}
        onCancel={() => setEditing(false)}
        onSave={(patch) => {
          onUpdate(patch);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-3">
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 text-sm">
        <ReadField label="Etapa de origem" value={fmtEtapa(episodio.etapa_origem)} />
        <ReadField label="Etapa de destino" value={ETAPA_DESTINO_LABEL[episodio.etapa_destino] ?? episodio.etapa_destino} />
        <ReadField label="Data" value={fmtDataHoraBR(episodio.data)} />
        <ReadField label="Responsável" value={responsavel} />
        <ReadField
          label="Peças a refazer"
          value={String(episodio.pecas_refazer ?? 0)}
        />
        <ReadField
          label="Peças perdidas"
          value={
            (episodio.perda_pecas ?? 0) > 0
              ? `Sim — ${episodio.perda_pecas}`
              : "Não"
          }
        />
        {mostraAdesivos && (
          <ReadField
            label="Adesivos perdidos"
            value={
              (episodio.perda_adesivos ?? 0) > 0
                ? `Sim — ${episodio.perda_adesivos}`
                : "Não"
            }
          />
        )}
        {mostraAdesivos && (
          <ReadField
            label="Faltou adesivo?"
            value={
              (episodio.qtd_falta_adesivos ?? 0) > 0
                ? `Sim — ${episodio.qtd_falta_adesivos}`
                : "Não"
            }
          />
        )}
        {episodio.etapa_destino === "dados" && (
          <ReadField
            label="Peças extras pedidas"
            value={
              (episodio.pecas_extras ?? 0) > 0
                ? `+${episodio.pecas_extras}`
                : "—"
            }
          />
        )}
        <div className="sm:col-span-2">
          <div className="text-[11px] text-muted-foreground font-medium mb-0.5">Situação</div>
          <Badge variant={episodio.aberto ? "default" : "secondary"}>
            {episodio.aberto ? "Em aberto" : "Encerrado"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 text-sm pt-2 border-t">
        <ReadField label="Identificado por" value={episodio.area_identificou ?? "—"} />
        <ReadField label="Erro de produção da Estamparia" value={typeof episodio.erro_producao === "boolean" ? (episodio.erro_producao ? "Sim" : "Não") : "—"} />
        {episodio.erro_producao && (
          <>
            <ReadField label="Área que errou" value={episodio.area_erro ?? "—"} />
            <ReadField label="Problema" value={episodio.problema ?? "—"} />
          </>
        )}
      </div>

      <div>
        <div className="text-[11px] text-muted-foreground font-medium mb-0.5">Observações</div>
        <div className="text-sm whitespace-pre-wrap">{episodio.motivo || "—"}</div>
      </div>

      {episodio.retrato && <RetratoView retrato={episodio.retrato} profilesMap={profilesMap} />}

      {!soLeitura && (
        <div className="flex justify-between gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1" /> Apagar episódio
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Editar episódio
          </Button>
        </div>
      )}
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground font-medium">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

const CAMPO_LABEL: Record<string, string> = {
  // Arte
  status_arte: "Status da arte",
  arte_observacao: "Observação da arte",
  vetorizacao_executada: "Vetorização executada",
  vetorizacao_dtf: "Vetorização DTF",
  vetorizacao_silk: "Vetorização Silk",
  dtf_impresso: "DTF impresso",
  dtf_executado: "DTF executado",
  dtf_cortado: "DTF cortado",
  dtf_cortado_data: "Data corte DTF",
  fotolito_impresso: "Fotolito impresso",
  fotolito_executado: "Fotolito executado",
  // DTF
  dtf_estampado: "DTF estampado",
  dtf_data_executada: "Data DTF executado",
  quem_bateu_dtf: "Quem bateu DTF",
  quem_cortou_dtf: "Quem cortou DTF",
  n_batidas_dtf: "Nº batidas DTF",
  dtf_pessoas_qtd: "Pessoas/qtd DTF",
  dtf_observacao: "Observação DTF",
  // Silk
  tela_gravada: "Tela gravada",
  silk_feito: "Silk feito",
  silk_data_executada: "Data Silk executado",
  quem_bateu_silk: "Quem bateu Silk",
  quem_revelou_tela: "Quem revelou tela",
  n_batidas_silk: "Nº batidas Silk",
  silk_observacao: "Observação Silk",
  // Acabamento
  embalado: "Embalado",
  acabamento_data: "Data acabamento",
  data_saida_juff: "Data saída Juff",
  responsavel_acabamento: "Responsável acabamento",
  responsavel_conferencia: "Responsável conferência",
  inicio_acabamento: "Início acabamento",
  termino_acabamento: "Término acabamento",
  dias_secagem: "Dias de secagem",
  finalizado_em: "Finalizado em",
  tempo_producao: "Tempo de produção",
  // Expedição
  expedicao_entrou_em: "Entrou em expedição",
  exp_cobranca_pagamento: "Cobrança de pagamento",
  exp_pagamento: "Pagamento",
  exp_etiqueta: "Etiqueta",
  exp_frete_solicitado: "Frete solicitado",
  exp_frete_solicitado_em: "Frete solicitado em",
  exp_despachado: "Despachado",
  exp_despachado_em: "Despachado em",
  exp_observacoes: "Observações expedição",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fmtCampo(key: string, value: any, profilesMap: Record<string, string>): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (key === "dtf_pessoas_qtd") {
      const entries = Object.entries(value as Record<string, number>);
      if (entries.length === 0) return "—";
      return entries
        .map(([uid, qtd]) => `${resolveNome(profilesMap, uid)}: ${qtd}`)
        .join(", ");
    }
    return JSON.stringify(value);
  }
  const s = String(value);
  if (UUID_RE.test(s)) return resolveNome(profilesMap, s);
  if (ISO_DT_RE.test(s)) return fmtDataHoraBR(s);
  if (ISO_DATE_RE.test(s)) return fmtDataBR(s);
  return s;
}

const GRUPOS_CAMPOS: { titulo: string; chaves: string[] }[] = [
  {
    titulo: "Input de Produção",
    chaves: ["status_pecas", "tipo_estampa", "arte_data", "inicio_estamparia", "termino_estamparia"],
  },
  {
    titulo: "Arte",
    chaves: [
      "status_arte", "arte_observacao", "vetorizacao_executada",
      "vetorizacao_dtf", "dtf_impresso", "dtf_executado", "dtf_cortado", "dtf_cortado_data",
      "vetorizacao_silk", "fotolito_impresso", "fotolito_executado",
    ],
  },
  {
    titulo: "DTF",
    chaves: ["dtf_estampado", "dtf_data_executada", "quem_bateu_dtf", "quem_cortou_dtf", "n_batidas_dtf", "dtf_pessoas_qtd", "dtf_observacao"],
  },
  {
    titulo: "Silk",
    chaves: ["tela_gravada", "silk_feito", "silk_data_executada", "quem_bateu_silk", "quem_revelou_tela", "n_batidas_silk", "silk_observacao"],
  },
  {
    titulo: "Acabamento",
    chaves: [
      "embalado", "acabamento_data", "data_saida_juff", "responsavel_acabamento", "responsavel_conferencia",
      "inicio_acabamento", "termino_acabamento", "dias_secagem", "finalizado_em", "tempo_producao",
    ],
  },
  {
    titulo: "Expedição",
    chaves: [
      "expedicao_entrou_em", "exp_cobranca_pagamento", "exp_pagamento", "exp_etiqueta",
      "exp_frete_solicitado", "exp_frete_solicitado_em", "exp_despachado", "exp_despachado_em", "exp_observacoes",
    ],
  },
];

function RetratoView({ retrato, profilesMap }: { retrato: RefacaoRetrato; profilesMap: Record<string, string> }) {
  const campos = retrato.campos_apagados ?? {};
  const grupos = GRUPOS_CAMPOS.map((g) => ({
    ...g,
    entradas: g.chaves
      .map((k) => [k, campos[k]] as [string, any])
      .filter(([, v]) => v !== null && v !== undefined && v !== ""),
  })).filter((g) => g.entradas.length > 0);
  return (
    <div className="rounded-md bg-background border p-2 text-xs space-y-2">
      <div className="font-medium text-muted-foreground uppercase text-[10px]">
        Retrato congelado no momento da refação
      </div>
      <div>
        <span className="text-muted-foreground">Datas originais: </span>
        entrada {fmtDataBR(retrato.entrada_pedido)} · saída Juff {fmtDataBR(retrato.saida_juff)}
      </div>
      <div>
        <span className="text-muted-foreground">Etapas concluídas: </span>
        {retrato.etapas_concluidas.length === 0 ? (
          <span>—</span>
        ) : (
          retrato.etapas_concluidas.map((e, i) => (
            <span key={i}>
              {i > 0 && " · "}
              {e.etapa} ✓ {fmtDataBR(e.data)}
              {e.responsavel ? ` (${resolveNome(profilesMap, e.responsavel)})` : ""}
            </span>
          ))
        )}
      </div>
      {grupos.length > 0 && (
        <div className="pt-1 border-t space-y-2">
          <div className="text-muted-foreground">Registros das áreas no momento da refação:</div>
          {grupos.map((g) => (
            <div key={g.titulo}>
              <div className="font-semibold text-[11px] mb-0.5">{g.titulo}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 pl-2">
                {g.entradas.map(([k, v]) => (
                  <div key={k} className="flex gap-1">
                    <span className="text-muted-foreground">{CAMPO_LABEL[k] ?? k}:</span>
                    <span className="font-medium">{fmtCampo(k, v, profilesMap)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------- Editor (gestor/admin) ----------

function EpisodioEditor({
  episodio,
  onCancel,
  onSave,
}: {
  episodio: RefacaoEpisodio;
  onCancel: () => void;
  onSave: (patch: Partial<RefacaoEpisodio>) => void;
}) {
  const [local, setLocal] = useState<RefacaoEpisodio>(episodio);
  const dirty = JSON.stringify(local) !== JSON.stringify(episodio);
  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
        <Field label="Etapa origem">
          <Input value={local.etapa_origem} onChange={(e) => setLocal({ ...local, etapa_origem: e.target.value })} />
        </Field>
        <Field label="Etapa destino">
          <Input value={local.etapa_destino} onChange={(e) => setLocal({ ...local, etapa_destino: e.target.value as any })} />
        </Field>
        <Field label="Data (ISO)">
          <Input value={local.data} onChange={(e) => setLocal({ ...local, data: e.target.value })} />
        </Field>
        <Field label="Quem (uuid)">
          <Input value={local.quem ?? ""} onChange={(e) => setLocal({ ...local, quem: e.target.value || null })} />
        </Field>
        <Field label="Peças refazer">
          <Input type="number" value={local.pecas_refazer} onChange={(e) => setLocal({ ...local, pecas_refazer: Number(e.target.value) })} />
        </Field>
        <Field label="Perda peças">
          <Input type="number" value={local.perda_pecas} onChange={(e) => setLocal({ ...local, perda_pecas: Number(e.target.value) })} />
        </Field>
        <Field label="Perda adesivos">
          <Input type="number" value={local.perda_adesivos} onChange={(e) => setLocal({ ...local, perda_adesivos: Number(e.target.value) })} />
        </Field>
        <Field label="Peças extras">
          <Input
            type="number"
            value={local.pecas_extras ?? ""}
            onChange={(e) =>
              setLocal({ ...local, pecas_extras: e.target.value === "" ? undefined : Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Aberto">
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={local.aberto ? "sim" : "nao"}
            onChange={(e) => setLocal({ ...local, aberto: e.target.value === "sim" })}
          >
            <option value="sim">Em aberto</option>
            <option value="nao">Encerrado</option>
          </select>
        </Field>
      </div>
      <div>
        <div className="text-[11px] text-muted-foreground font-medium mb-0.5">Observações</div>
        <div className="text-sm whitespace-pre-wrap rounded-md border bg-background px-3 py-2">{local.motivo || "—"}</div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" /> Cancelar
        </Button>
        <Button size="sm" disabled={!dirty} onClick={() => onSave(local)}>
          <Save className="h-4 w-4 mr-1" /> Salvar episódio
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-muted-foreground font-medium">{label}</div>
      {children}
    </div>
  );
}
