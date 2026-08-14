// KPI PCP — cálculos puros sobre os pedidos do PCP.
// Nada aqui toca banco: recebe os registros já lidos e o conjunto de feriados.
import { diasUteisEntre } from "@/lib/dias-uteis";
import { calcularEtapaAtual, tipoIncluiDTF, tipoIncluiSilk, type Pedido, type RefacaoEpisodio } from "@/lib/pedidos";
import { parsePeople } from "@/components/pcp/MultiSelectPeople";

export type Feriados = Set<string>;

export type BaseContagem = "entrada" | "saida" | "finalizado";

export interface KpiFiltro {
  de: string;
  ate: string;
  base: BaseContagem;
  vendedor: string; // "todos" | nome
  tipoEstampa: string; // "todos" | "DTF" | "Silk" | "DTF+Silk" | "Lisa"
  pessoa: string; // "todos" | nome
}

const n = (v: unknown): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

const media = (v: number[]): number | null =>
  v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;

const refs = (p: Pedido): RefacaoEpisodio[] => (Array.isArray(p.refacoes) ? p.refacoes : []);

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Todas as pessoas que aparecem em qualquer campo de responsável do pedido. */
export function pessoasDoPedido(p: Pedido): string[] {
  const todas = [
    ...parsePeople(p.quem_bateu_silk),
    ...parsePeople(p.quem_bateu_dtf),
    ...parsePeople(p.quem_cortou_dtf),
    ...parsePeople(p.quem_revelou_tela),
    ...parsePeople(p.responsavel_acabamento),
    ...parsePeople((p as any).responsavel_conferencia),
  ];
  return [...new Set(todas.filter((x) => x.trim().length > 0))];
}

function dataBase(p: Pedido, base: BaseContagem): string | null {
  if (base === "entrada") return p.entrada_pedido;
  if (base === "saida") return p.saida_juff ?? p.finalizado_em?.slice(0, 10) ?? null;
  return p.finalizado_em?.slice(0, 10) ?? null;
}

/** Aplica período + vendedor + tipo de estampa + pessoa. */
export function filtrarPedidos(pedidos: Pedido[], f: KpiFiltro): Pedido[] {
  return pedidos.filter((p) => {
    const d = dataBase(p, f.base);
    if (!d || d < f.de || d > f.ate) return false;
    if (f.vendedor !== "todos" && (p.vendedor ?? "") !== f.vendedor) return false;
    if (f.tipoEstampa !== "todos" && (p.tipo_estampa ?? "") !== f.tipoEstampa) return false;
    if (f.pessoa !== "todos" && !pessoasDoPedido(p).includes(f.pessoa)) return false;
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Bloco 1 — Resumo do período                                         */
/* ------------------------------------------------------------------ */

export interface ResumoPeriodo {
  pedidosFinalizados: number;
  pecasProduzidas: number;
  tempoMedio: number | null;
  percNoPrazo: number | null;
  atrasoMedio: number | null;
  percComRefacao: number | null;
  pedidos: number;
}

export function resumoPeriodo(regs: Pedido[], feriados: Feriados): ResumoPeriodo {
  const finalizados = regs.filter((p) => !!p.finalizado_em);
  const prazos: number[] = [];
  const atrasos: number[] = [];
  let noPrazo = 0;
  let comData = 0;
  for (const p of regs) {
    if (p.entrada_pedido && p.saida_juff) prazos.push(diasUteisEntre(p.entrada_pedido, p.saida_juff, feriados));
    if (p.data_entrega && p.saida_juff) {
      comData++;
      if (p.saida_juff <= p.data_entrega) noPrazo++;
      else atrasos.push(diasUteisEntre(p.data_entrega, p.saida_juff, feriados));
    }
  }
  const comRefacao = regs.filter((p) => refs(p).length > 0).length;
  return {
    pedidos: regs.length,
    pedidosFinalizados: finalizados.length,
    pecasProduzidas: finalizados.reduce((s, p) => s + n(p.qtd), 0),
    tempoMedio: media(prazos),
    percNoPrazo: comData ? (noPrazo / comData) * 100 : null,
    atrasoMedio: media(atrasos),
    percComRefacao: regs.length ? (comRefacao / regs.length) * 100 : null,
  };
}

/* ------------------------------------------------------------------ */
/* Bloco 2 — Estamparia                                                */
/* ------------------------------------------------------------------ */

export interface Estamparia {
  batidasSilk: number;
  batidasDtf: number;
  pecasSilk: number;
  pecasDtf: number;
  batidasPorPecaSilk: number | null;
  batidasPorPecaDtf: number | null;
  porTipo: { tipo: string; pedidos: number; pecas: number; perc: number }[];
  porMes: { mes: string; silk: number; dtf: number; pecas: number }[];
}

const TIPOS = ["Silk", "DTF", "DTF+Silk", "Lisa"];

export function estamparia(regs: Pedido[]): Estamparia {
  let batidasSilk = 0;
  let batidasDtf = 0;
  let pecasSilk = 0;
  let pecasDtf = 0;
  const tipos = new Map<string, { pedidos: number; pecas: number }>();
  const meses = new Map<string, { silk: number; dtf: number; pecas: number }>();

  for (const p of regs) {
    const qtd = n(p.qtd);
    const tipo = (p.tipo_estampa ?? "—").trim() || "—";
    const t = tipos.get(tipo) ?? { pedidos: 0, pecas: 0 };
    t.pedidos += 1;
    t.pecas += qtd;
    tipos.set(tipo, t);

    const silk = n(p.n_batidas_silk);
    const dtf = n(p.n_batidas_dtf);
    batidasSilk += silk;
    batidasDtf += dtf;
    if (tipo === "Silk" || tipo === "DTF+Silk") pecasSilk += qtd;
    if (tipo === "DTF" || tipo === "DTF+Silk") pecasDtf += qtd;

    const ref = p.saida_juff ?? p.entrada_pedido;
    if (ref) {
      const mes = ref.slice(0, 7);
      const m = meses.get(mes) ?? { silk: 0, dtf: 0, pecas: 0 };
      m.silk += silk;
      m.dtf += dtf;
      m.pecas += qtd;
      meses.set(mes, m);
    }
  }

  const totalPecas = [...tipos.values()].reduce((s, t) => s + t.pecas, 0);
  const porTipo = [...TIPOS, ...[...tipos.keys()].filter((k) => !TIPOS.includes(k))]
    .filter((k) => tipos.has(k))
    .map((tipo) => {
      const t = tipos.get(tipo)!;
      return { tipo, pedidos: t.pedidos, pecas: t.pecas, perc: totalPecas ? (t.pecas / totalPecas) * 100 : 0 };
    });

  return {
    batidasSilk,
    batidasDtf,
    pecasSilk,
    pecasDtf,
    batidasPorPecaSilk: pecasSilk ? batidasSilk / pecasSilk : null,
    batidasPorPecaDtf: pecasDtf ? batidasDtf / pecasDtf : null,
    porTipo,
    porMes: [...meses.entries()]
      .map(([mes, m]) => ({ mes, ...m }))
      .sort((a, b) => a.mes.localeCompare(b.mes)),
  };
}

/* ------------------------------------------------------------------ */
/* Bloco 3 — Quem fez o quê                                            */
/* ------------------------------------------------------------------ */

export type CampoPessoa =
  | "quem_bateu_silk"
  | "quem_bateu_dtf"
  | "quem_cortou_dtf"
  | "quem_revelou_tela"
  | "responsavel_acabamento"
  | "responsavel_conferencia";

export interface LinhaPessoa {
  pessoa: string;
  pedidos: number;
  pecas: number;
  batidas: number;
  /** true quando alguma peça foi rateada igualmente por falta de registro. */
  estimado: boolean;
  /** true quando alguma batida foi rateada por haver mais de uma pessoa no pedido. */
  batidasEstimadas: boolean;
  numeros: string[];
}

/** Agrega por pessoa. Em DTF usa `dtf_pessoas_qtd` quando existir. */
export function porPessoa(regs: Pedido[], campo: CampoPessoa): LinhaPessoa[] {
  const map = new Map<string, LinhaPessoa>();
  const pega = (nome: string) =>
    map.get(nome) ?? { pessoa: nome, pedidos: 0, pecas: 0, batidas: 0, estimado: false, batidasEstimadas: false, numeros: [] };

  for (const p of regs) {
    const pessoas = parsePeople((p as any)[campo] as string | null);
    if (pessoas.length === 0) continue;
    const qtd = n(p.qtd);
    const batidas = campo === "quem_bateu_silk" ? n(p.n_batidas_silk) : campo === "quem_bateu_dtf" ? n(p.n_batidas_dtf) : 0;
    const detalhe = campo === "quem_bateu_dtf" ? p.dtf_pessoas_qtd : null;
    const temDetalhe = !!detalhe && pessoas.some((x) => n(detalhe[x]) > 0);
    const numero = (p.pedido_olist ?? "").trim() || "—";

    for (const nome of pessoas) {
      const l = pega(nome);
      l.pedidos += 1;
      if (temDetalhe) {
        l.pecas += n(detalhe![nome]);
      } else {
        l.pecas += qtd / pessoas.length;
        if (pessoas.length > 1) l.estimado = true;
      }
      l.batidas += batidas / pessoas.length;
      if (pessoas.length > 1 && batidas > 0) l.batidasEstimadas = true;
      l.numeros.push(numero);
      map.set(nome, l);
    }
  }
  const porBatidas = campo === "quem_bateu_silk" || campo === "quem_bateu_dtf";
  return [...map.values()].sort((a, b) => (porBatidas ? b.batidas - a.batidas : b.pecas - a.pecas));
}

/** Peças por pessoa por dia útil em que ela aparece em algum pedido. Aproximado. */
export function pecasPorPessoaPorDia(regs: Pedido[], feriados: Feriados): { pessoa: string; pecas: number; dias: number; media: number }[] {
  const map = new Map<string, { pecas: number; dias: Set<string> }>();
  for (const p of regs) {
    const dia = p.saida_juff ?? p.entrada_pedido;
    const qtd = n(p.qtd);
    const pessoas = pessoasDoPedido(p);
    if (pessoas.length === 0) continue;
    for (const nome of pessoas) {
      const l = map.get(nome) ?? { pecas: 0, dias: new Set<string>() };
      l.pecas += qtd / pessoas.length;
      if (dia) l.dias.add(dia);
      map.set(nome, l);
    }
  }
  void feriados;
  return [...map.entries()]
    .map(([pessoa, l]) => ({
      pessoa,
      pecas: l.pecas,
      dias: l.dias.size,
      media: l.dias.size ? l.pecas / l.dias.size : 0,
    }))
    .sort((a, b) => b.media - a.media);
}

/* ------------------------------------------------------------------ */
/* Bloco 4 — Onde o tempo está indo                                    */
/* ------------------------------------------------------------------ */

export interface EtapaTempo {
  etapa: string;
  n: number;
  planejadoMedio: number | null;
  realMedio: number | null;
  diferenca: number | null;
  realP80: number | null;
  amostraPequena: boolean;
}

export interface TempoBloco {
  etapas: EtapaTempo[];
  /** Etapa com a maior diferença positiva, considerando só etapas com n >= 5. */
  maiorFolga: string | null;
  /** Etapa com o maior realMedio, considerando só etapas com n >= 5. */
  gargalo: string | null;
  cobertura: { elegiveis: number; total: number; perc: number };
  porMes: { mes: string; medio: number | null; pedidos: number }[];
  faixas: { faixa: string; pedidos: number; perc: number }[];
}

const maxData = (a: string | null | undefined, b: string | null | undefined): string | null => {
  if (!a || !b) return null;
  return a > b ? a : b;
};

function arteLiberouDtf(p: Pedido): string | null {
  return maxData(p.dtf_executado, p.dtf_cortado_data);
}

function arteLiberouSilk(p: Pedido): string | null {
  return p.fotolito_executado ?? null;
}

function arteLiberou(p: Pedido): string | null {
  const dtf = tipoIncluiDTF(p.tipo_estampa);
  const silk = tipoIncluiSilk(p.tipo_estampa);
  if (dtf && silk) return maxData(arteLiberouDtf(p), arteLiberouSilk(p));
  if (dtf) return arteLiberouDtf(p);
  if (silk) return arteLiberouSilk(p);
  return null;
}

function fimEstamparia(p: Pedido): string | null {
  const dtf = tipoIncluiDTF(p.tipo_estampa);
  const silk = tipoIncluiSilk(p.tipo_estampa);
  if (dtf && silk) return maxData(p.dtf_data_executada, p.silk_data_executada);
  if (dtf) return p.dtf_data_executada ?? null;
  if (silk) return p.silk_data_executada ?? null;
  return null;
}

function p80(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil(0.8 * s.length) - 1));
  return s[i]!;
}

const ETAPAS_TEMPO = ["Espera no Dados In", "Arte", "Estamparia DTF", "Estamparia Silk", "Acabamento", "Expedição"] as const;

/** Data (YYYY-MM-DD) da entrada real na Arte, gravada pelo banco no 1o save do Input de Producao. */
function arteIniciou(p: Pedido): string | null {
  const v = (p as unknown as { arte_iniciou_em?: string | null }).arte_iniciou_em;
  return v ? v.slice(0, 10) : null;
}

export function tempoBloco(regs: Pedido[], feriados: Feriados): TempoBloco {
  const dias = (a: string | null | undefined, b: string | null | undefined) =>
    a && b ? diasUteisEntre(a, b, feriados) : null;
  const plan: Record<string, number[]> = {};
  const real: Record<string, number[]> = {};
  for (const e of ETAPAS_TEMPO) {
    plan[e] = [];
    real[e] = [];
  }
  const porMes = new Map<string, number[]>();
  const faixas = { "Até 5 dias": 0, "6 a 10 dias": 0, "11 a 15 dias": 0, "Mais de 15 dias": 0 } as Record<string, number>;
  let totalFaixa = 0;
  let elegiveis = 0;

  for (const p of regs) {
    if (refs(p).length === 0) {
      let entrou = false;
      const par = (etapa: string, pa: string | null | undefined, pb: string | null | undefined, ra: string | null | undefined, rb: string | null | undefined) => {
        const dp = dias(pa, pb);
        const dr = dias(ra, rb);
        if (dp == null || dr == null) return;
        plan[etapa]!.push(dp);
        real[etapa]!.push(dr);
        entrou = true;
      };
      // Etapa somente-real: nao tem planejado e nao conta para cobertura/elegiveis.
      const soReal = (etapa: string, ra: string | null | undefined, rb: string | null | undefined) => {
        const dr = dias(ra, rb);
        if (dr == null) return;
        real[etapa]!.push(dr);
      };
      const tipo = p.tipo_estampa;
      const dtf = tipoIncluiDTF(tipo);
      const silk = tipoIncluiSilk(tipo);
      const lisa = !dtf && !silk;

      soReal("Espera no Dados In", p.entrada_pedido, arteIniciou(p));
      if (!lisa) par("Arte", arteIniciou(p), p.arte_data, arteIniciou(p), arteLiberou(p));
      if (dtf) par("Estamparia DTF", p.inicio_estamparia, p.termino_estamparia, arteLiberouDtf(p), p.dtf_data_executada);
      if (silk) par("Estamparia Silk", p.inicio_estamparia, p.termino_estamparia, arteLiberouSilk(p), p.silk_data_executada);
      par(
        "Acabamento",
        p.inicio_acabamento,
        p.termino_acabamento,
        lisa ? p.inicio_acabamento : fimEstamparia(p),
        p.data_saida_juff,
      );
      par("Expedição", p.termino_acabamento, p.saida_juff, p.data_saida_juff, p.exp_despachado_em);
      if (entrou) elegiveis++;
    }

    const total = dias(p.entrada_pedido, p.saida_juff);
    if (total != null) {
      const mes = (p.saida_juff ?? "").slice(0, 7);
      if (mes) {
        const arr = porMes.get(mes) ?? [];
        arr.push(total);
        porMes.set(mes, arr);
      }
      totalFaixa++;
      if (total <= 5) faixas["Até 5 dias"]!++;
      else if (total <= 10) faixas["6 a 10 dias"]!++;
      else if (total <= 15) faixas["11 a 15 dias"]!++;
      else faixas["Mais de 15 dias"]!++;
    }
  }

  const etapas: EtapaTempo[] = ETAPAS_TEMPO.map((etapa) => {
    const pv = plan[etapa]!;
    const rv = real[etapa]!;
    const pm = media(pv);
    const rm = media(rv);
    return {
      etapa,
      n: rv.length,
      planejadoMedio: pm,
      realMedio: rm,
      diferenca: pm != null && rm != null ? pm - rm : null,
      realP80: p80(rv),
      amostraPequena: rv.length < 5,
    };
  });

  const qualificadas = etapas.filter((e) => e.n >= 5);
  const folgas = qualificadas.filter((e) => (e.diferenca ?? 0) > 0);
  const maiorFolga = folgas.length
    ? folgas.reduce((a, b) => ((b.diferenca ?? 0) > (a.diferenca ?? 0) ? b : a)).etapa
    : null;
  const comReal = qualificadas.filter((e) => e.realMedio != null);
  const gargalo = comReal.length
    ? comReal.reduce((a, b) => ((b.realMedio ?? 0) > (a.realMedio ?? 0) ? b : a)).etapa
    : null;

  return {
    etapas,
    maiorFolga,
    gargalo,
    cobertura: { elegiveis, total: regs.length, perc: regs.length ? (elegiveis / regs.length) * 100 : 0 },
    porMes: [...porMes.entries()]
      .map(([mes, v]) => ({ mes, medio: media(v), pedidos: v.length }))
      .sort((a, b) => a.mes.localeCompare(b.mes)),
    faixas: Object.entries(faixas).map(([faixa, pedidos]) => ({
      faixa,
      pedidos,
      perc: totalFaixa ? (pedidos / totalFaixa) * 100 : 0,
    })),
  };
}


/* ------------------------------------------------------------------ */
/* Bloco 5 — Situação de agora (independe do período)                  */
/* ------------------------------------------------------------------ */

export interface SituacaoAgora {
  filas: { rotulo: string; pedidos: number }[];
  atrasados: { pedido: string; data_entrega: string; dias: number }[];
  vencendo: { pedido: string; data_entrega: string; dias: number }[];
  idadeMedia: number | null;
}

export function situacaoAgora(pedidos: Pedido[], feriados: Feriados, hoje = todayISO()): SituacaoAgora {
  const abertos = pedidos.filter((p) => !p.finalizado_em);
  const conta = (pred: (p: Pedido) => boolean) => abertos.filter(pred).length;
  const etapa = (p: Pedido) => calcularEtapaAtual(p).etapa.replace(/\*+$/, "");
  const tipo = (p: Pedido) => p.tipo_estampa ?? "";

  const filas = [
    { rotulo: "Esperando Arte", pedidos: conta((p) => etapa(p).includes("Arte")) },
    {
      rotulo: "Em DTF",
      pedidos: conta((p) => etapa(p).startsWith("Aguardando DTF") && (tipo(p) === "DTF" || tipo(p) === "DTF+Silk")),
    },
    {
      rotulo: "Em Silk",
      pedidos: conta(
        (p) =>
          (etapa(p) === "Aguardando Silk" || etapa(p) === "Aguardando DTF + Silk") &&
          (tipo(p) === "Silk" || tipo(p) === "DTF+Silk"),
      ),
    },
    { rotulo: "Em Acabamento", pedidos: conta((p) => etapa(p) === "Aguardando Acabamento") },
    { rotulo: "Em Expedição", pedidos: conta((p) => etapa(p) === "Aguardando Expedição") },
  ];

  const atrasados: SituacaoAgora["atrasados"] = [];
  const vencendo: SituacaoAgora["vencendo"] = [];
  const idades: number[] = [];
  for (const p of abertos) {
    const numero = (p.pedido_olist ?? "").trim() || "—";
    if (p.entrada_pedido) idades.push(diasUteisEntre(p.entrada_pedido, hoje, feriados));
    if (!p.data_entrega) continue;
    if (p.data_entrega < hoje) {
      atrasados.push({ pedido: numero, data_entrega: p.data_entrega, dias: diasUteisEntre(p.data_entrega, hoje, feriados) });
    } else {
      const restantes = diasUteisEntre(hoje, p.data_entrega, feriados);
      if (restantes <= 3) vencendo.push({ pedido: numero, data_entrega: p.data_entrega, dias: restantes });
    }
  }

  return {
    filas,
    atrasados: atrasados.sort((a, b) => b.dias - a.dias),
    vencendo: vencendo.sort((a, b) => a.dias - b.dias),
    idadeMedia: media(idades),
  };
}

/* ------------------------------------------------------------------ */
/* Bloco 6 — Erros e retrabalho                                        */
/* ------------------------------------------------------------------ */

export interface Retrabalho {
  pecasRefeitas: number;
  percRefeitas: number | null;
  pecasPerdidas: number;
  percPerdidas: number | null;
  porArea: { area: string; episodios: number; pecas: number; perdidas: number }[];
  correcoesPorAba: { aba: string; qtd: number }[];
  reabertos: number;
}

const ABA_LABEL: Record<string, string> = {
  arte: "Arte",
  dtf: "DTF",
  silk: "Silk",
  acabamento: "Acabamento",
};

export function retrabalho(regs: Pedido[], pecasProduzidas: number): Retrabalho {
  const areas = new Map<string, { area: string; episodios: number; pecas: number; perdidas: number }>();
  const abas = new Map<string, number>();
  let pecasRefeitas = 0;
  let pecasPerdidas = 0;
  let reabertos = 0;

  for (const p of regs) {
    if (p.reaberto) reabertos++;
    for (const e of refs(p)) {
      const area = (e?.area_erro || e?.area_identificou || "—").trim() || "—";
      const l = areas.get(area) ?? { area, episodios: 0, pecas: 0, perdidas: 0 };
      l.episodios += 1;
      l.pecas += n(e?.pecas_refazer);
      l.perdidas += n(e?.perda_pecas);
      areas.set(area, l);
      pecasRefeitas += n(e?.pecas_refazer);
      pecasPerdidas += n(e?.perda_pecas);
    }
    for (const c of (p as any).correcoes_etapa ?? []) {
      const aba = ABA_LABEL[c?.aba_origem as string] ?? "—";
      abas.set(aba, (abas.get(aba) ?? 0) + 1);
    }
  }

  return {
    pecasRefeitas,
    percRefeitas: pecasProduzidas ? (pecasRefeitas / pecasProduzidas) * 100 : null,
    pecasPerdidas,
    percPerdidas: pecasProduzidas ? (pecasPerdidas / pecasProduzidas) * 100 : null,
    porArea: [...areas.values()].sort((a, b) => b.pecas - a.pecas),
    correcoesPorAba: [...abas.entries()].map(([aba, qtd]) => ({ aba, qtd })).sort((a, b) => b.qtd - a.qtd),
    reabertos,
  };
}

/* ------------------------------------------------------------------ */
/* Bloco 7 — A data que a gente promete                                */
/* ------------------------------------------------------------------ */

export interface PromessaDeData {
  pedidosComData: number;
  pedidosAdiados: number;
  percAdiados: number | null;
  diasEmpurradosMedio: number | null;
  entraram: number;
  sairam: number;
  secagemMedia: number | null;
}

export function promessaDeData(regs: Pedido[], feriados: Feriados, de: string, ate: string): PromessaDeData {
  let comData = 0;
  let adiados = 0;
  const empurrados: number[] = [];
  const secagem: number[] = [];

  for (const p of regs) {
    if (p.dias_secagem != null) secagem.push(n(p.dias_secagem));
    if (!p.data_entrega) continue;
    comData++;
    const hist = Array.isArray((p as any).historico_data_entrega) ? ((p as any).historico_data_entrega as any[]) : [];
    const primeiras = hist.map((h) => (typeof h?.data === "string" ? h.data : null)).filter(Boolean) as string[];
    if (primeiras.length === 0) continue;
    const primeira = primeiras.sort()[0]!;
    if (primeira < p.data_entrega) {
      adiados++;
      empurrados.push(diasUteisEntre(primeira, p.data_entrega, feriados));
    }
  }

  const entraram = regs.filter((p) => p.entrada_pedido && p.entrada_pedido >= de && p.entrada_pedido <= ate).length;
  const sairam = regs.filter((p) => p.saida_juff && p.saida_juff >= de && p.saida_juff <= ate).length;

  return {
    pedidosComData: comData,
    pedidosAdiados: adiados,
    percAdiados: comData ? (adiados / comData) * 100 : null,
    diasEmpurradosMedio: media(empurrados),
    entraram,
    sairam,
    secagemMedia: media(secagem),
  };
}

/* ------------------------------------------------------------------ */
/* Períodos                                                            */
/* ------------------------------------------------------------------ */

export type PresetPeriodo = "mes" | "mes_passado" | "90d" | "ano" | "livre";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function periodoDoPreset(preset: PresetPeriodo, hoje = new Date()): { de: string; ate: string } {
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  if (preset === "mes") return { de: iso(new Date(y, m, 1)), ate: iso(new Date(y, m + 1, 0)) };
  if (preset === "mes_passado") return { de: iso(new Date(y, m - 1, 1)), ate: iso(new Date(y, m, 0)) };
  if (preset === "ano") return { de: iso(new Date(y, 0, 1)), ate: iso(new Date(y, 11, 31)) };
  const de = new Date(hoje);
  de.setDate(de.getDate() - 89);
  return { de: iso(de), ate: iso(hoje) };
}

/** Período imediatamente anterior, com a mesma duração. */
export function periodoAnterior(de: string, ate: string): { de: string; ate: string } {
  const a = new Date(de + "T00:00:00");
  const b = new Date(ate + "T00:00:00");
  const dias = Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
  const fim = new Date(a);
  fim.setDate(fim.getDate() - 1);
  const ini = new Date(fim);
  ini.setDate(ini.getDate() - (dias - 1));
  return { de: iso(ini), ate: iso(fim) };
}
