// KPI COP e MAP — todo o cálculo da aba. Somente leitura.
import {
  type Cop,
  type Oficina,
  isOficinaInterna,
  rotuloRomaneio,
  STATUS_CORTE,
} from "@/lib/cop";
import type { MapEstoquePeca } from "@/lib/map";
import { diasUteisEntre, type Feriados } from "@/lib/dias-uteis";
import { REFACAO_CORES, REFACAO_MODELOS, REFACAO_TAMANHOS } from "@/lib/pedidos";

export type KpiCopMapFiltro = { de: string; ate: string; oficinaId: string; modelo: string; cor: string };

export type DrillLinhaCop = {
  id: string;
  rotulo: string;
  oficina: string;
  modelo: string;
  cor: string;
  tamanho: string;
  qtd: number | null;
  metros: number | null;
  valor: number | null;
  inicio: string | null;
  fim: string | null;
  dias: number | null;
  nota: string;
};

/** Um número do painel + as linhas que o formaram + o texto do total do pop-up (igual ao card). */
export type Metrica = { valor: number | null; texto: string; total: string; linhas: DrillLinhaCop[] };
export type ItemRanking = Metrica & { chave: string };
export type Tempo = Metrica & { p80: number | null; textoP80: string };

// ---------- formatação ----------
const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtInt = (n: number) => nf.format(n);
export const fmtM = (n: number) => `${nf1.format(n)} m`;
export const fmtRS = (n: number) => `R$ ${nf2.format(n)}`;
export const fmtDias = (n: number) => `${nf1.format(n)} dias úteis`;

// ---------- estatística local ----------
export function mediana(v: number[]): number | null {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function p80(v: number[]): number | null {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.8 * s.length) - 1)];
}
export function variacao(atual: number | null, anterior: number | null): number | null {
  if (atual == null || anterior == null || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

// ---------- utilidades ----------
const d10 = (s: string | null | undefined) => (s ? s.slice(0, 10) : null);
const dentro = (d: string | null | undefined, f: KpiCopMapFiltro) => {
  const x = d10(d);
  return !!x && x >= f.de && x <= f.ate;
};
const passaPeca = (modelo: string, cor: string, f: KpiCopMapFiltro) =>
  (f.modelo === "todos" || modelo === f.modelo) && (f.cor === "todos" || cor === f.cor);
const somaQtd = (l: DrillLinhaCop[]) => l.reduce((s, x) => s + (x.qtd ?? 0), 0);
const somaM = (l: DrillLinhaCop[]) => l.reduce((s, x) => s + (x.metros ?? 0), 0);
const somaV = (l: DrillLinhaCop[]) => l.reduce((s, x) => s + (x.valor ?? 0), 0);
const qtdCops = (l: DrillLinhaCop[]) => new Set(l.map((x) => x.id)).size;

const idxModelo = new Map<string, number>(REFACAO_MODELOS.map((m, i) => [m, i]));
const idxCor = new Map<string, number>(REFACAO_CORES.map((c, i) => [c.nome, i]));
const idxTam = new Map<string, number>(REFACAO_TAMANHOS.map((t, i) => [t, i]));
const ordem = (idx: Map<string, number>) => (a: string, b: string) => {
  const ia = idx.get(a) ?? 999;
  const ib = idx.get(b) ?? 999;
  return ia - ib || a.localeCompare(b);
};

type Ctx = {
  cops: Cop[];
  oficinas: Oficina[];
  copPorId: Map<string, Cop>;
  ofPorId: Map<string, Oficina>;
  feriados: Feriados;
  f: KpiCopMapFiltro;
};
export function criarCtx(cops: Cop[], oficinas: Oficina[], feriados: Feriados, f: KpiCopMapFiltro): Ctx {
  return {
    cops,
    oficinas,
    copPorId: new Map(cops.map((c) => [c.id, c])),
    ofPorId: new Map(oficinas.map((o) => [o.id, o])),
    feriados,
    f,
  };
}
const nomeOf = (ctx: Ctx, c: Cop) => (c.oficina_id ? ctx.ofPorId.get(c.oficina_id)?.nome ?? "—" : "—");
const passaOficina = (ctx: Ctx, c: Cop) => ctx.f.oficinaId === "todos" || c.oficina_id === ctx.f.oficinaId;
const rot = (ctx: Ctx, c: Cop) => rotuloRomaneio(c, ctx.cops);
const dUteis = (ctx: Ctx, a: string | null, b: string | null) => {
  const x = d10(a);
  const y = d10(b);
  return x && y ? diasUteisEntre(x, y, ctx.feriados) : null;
};

function linhaBase(ctx: Ctx, c: Cop, extra: Partial<DrillLinhaCop> = {}): DrillLinhaCop {
  return {
    id: c.id,
    rotulo: rot(ctx, c),
    oficina: nomeOf(ctx, c),
    modelo: "",
    cor: "",
    tamanho: "",
    qtd: null,
    metros: null,
    valor: null,
    inicio: null,
    fim: null,
    dias: null,
    nota: "",
    ...extra,
  };
}
function linhasPecas(ctx: Ctx, c: Cop, pecas: { modelo: string; cor: string; tamanho: string; qtd: number }[], extra: Partial<DrillLinhaCop> = {}) {
  const out: DrillLinhaCop[] = [];
  for (const p of pecas ?? []) {
    if (!p) continue;
    const q = Number(p.qtd) || 0;
    if (!q || !passaPeca(p.modelo, p.cor, ctx.f)) continue;
    out.push(linhaBase(ctx, c, { modelo: p.modelo, cor: p.cor, tamanho: p.tamanho, qtd: q, ...extra }));
  }
  return out;
}

// ---------- construtores de métrica ----------
function mPecas(l: DrillLinhaCop[]): Metrica {
  const v = somaQtd(l);
  const t = `${fmtInt(v)} peças`;
  return { valor: v, texto: t, total: `${t} em ${fmtInt(qtdCops(l))} COPs`, linhas: l };
}
function mCops(l: DrillLinhaCop[]): Metrica {
  const v = qtdCops(l);
  return { valor: v, texto: fmtInt(v), total: `${fmtInt(v)} COPs`, linhas: l };
}
function mMetros(l: DrillLinhaCop[]): Metrica {
  const v = somaM(l);
  return { valor: v, texto: fmtM(v), total: fmtM(v), linhas: l };
}
function mValor(l: DrillLinhaCop[]): Metrica {
  const v = somaV(l);
  return { valor: v, texto: fmtRS(v), total: `${fmtRS(v)} em ${fmtInt(qtdCops(l))} COPs`, linhas: l };
}
function mTempo(l: DrillLinhaCop[]): Tempo {
  const dias = l.map((x) => x.dias).filter((x): x is number => x != null);
  const md = mediana(dias);
  const p = p80(dias);
  const texto = md == null ? "—" : fmtDias(md);
  const textoP80 = p == null ? "—" : fmtDias(p);
  return {
    valor: md,
    p80: p,
    texto,
    textoP80,
    total: md == null ? "—" : `Metade dos casos até ${texto}; 8 em cada 10 até ${textoP80} (${fmtInt(dias.length)} COPs)`,
    linhas: l,
  };
}
function ranking(l: DrillLinhaCop[], chave: (x: DrillLinhaCop) => string, mk: (l: DrillLinhaCop[]) => Metrica, ord?: (a: string, b: string) => number): ItemRanking[] {
  const g = new Map<string, DrillLinhaCop[]>();
  for (const x of l) {
    const k = chave(x) || "—";
    const arr = g.get(k) ?? [];
    arr.push(x);
    g.set(k, arr);
  }
  const out = [...g.entries()].map(([k, ls]) => ({ chave: k, ...mk(ls) }));
  if (ord) out.sort((a, b) => ord(a.chave, b.chave));
  else out.sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0));
  return out;
}

// ============ BLOCO 1 — CORTE ============
export function blocoCorte(ctx: Ctx) {
  const { f } = ctx;
  const base = ctx.cops.filter((c) => dentro(c.execucao_corte, f) && passaOficina(ctx, c));
  const linhas = base.flatMap((c) => linhasPecas(ctx, c, c.pecas, { fim: d10(c.execucao_corte), nota: c.quem_cortou ?? "" }));
  const ids = new Set(linhas.map((l) => l.id));
  const porCop = base
    .filter((c) => ids.has(c.id))
    .map((c) => {
      const ls = linhas.filter((l) => l.id === c.id);
      return linhaBase(ctx, c, { qtd: somaQtd(ls), fim: d10(c.execucao_corte), nota: c.quem_cortou ?? "" });
    });
  const pecas = mPecas(linhas);
  const media = porCop.length ? (pecas.valor ?? 0) / porCop.length : null;

  const quemPorPecas = ranking(linhas, (x) => x.nota || "Não informado", mPecas);
  const quemPorCops = ranking(porCop, (x) => x.nota || "Não informado", mCops);

  const tRisco = mTempo(
    base
      .filter((c) => ids.has(c.id) && c.solicitacao_risco)
      .map((c) =>
        linhaBase(ctx, c, {
          inicio: d10(c.solicitacao_risco),
          fim: d10(c.execucao_corte),
          dias: dUteis(ctx, c.solicitacao_risco, c.execucao_corte),
          qtd: somaQtd(linhas.filter((l) => l.id === c.id)),
        }),
      ),
  );
  const tParado = mTempo(
    base
      .filter((c) => ids.has(c.id) && c.romaneio_enviado_em)
      .map((c) =>
        linhaBase(ctx, c, {
          inicio: d10(c.execucao_corte),
          fim: d10(c.romaneio_enviado_em),
          dias: dUteis(ctx, c.execucao_corte, c.romaneio_enviado_em),
          qtd: somaQtd(linhas.filter((l) => l.id === c.id)),
        }),
      ),
  );
  const divididos = mCops(porCop.filter((l) => ctx.copPorId.get(l.id)?.corte_dividido));

  // Fila de corte agora — ignora o período.
  const hoje = new Date().toISOString().slice(0, 10);
  const fila = ctx.cops
    .filter((c) => STATUS_CORTE.includes(c.status) && passaOficina(ctx, c))
    .map((c) => {
      const ultima =
        [c.execucao_corte, c.solicitacao_corte, c.execucao_risco, c.solicitacao_risco].map(d10).filter(Boolean).sort().pop() ??
        d10(c.created_at);
      const dias = ultima ? Math.max(0, Math.round((new Date(hoje + "T00:00:00").getTime() - new Date(ultima + "T00:00:00").getTime()) / 86400000)) : null;
      return linhaBase(ctx, c, { qtd: c.pecas.filter((p) => passaPeca(p.modelo, p.cor, f)).reduce((s, p) => s + (Number(p.qtd) || 0), 0), inicio: ultima, dias, nota: c.status });
    });
  const filaPorStatus = STATUS_CORTE.map((s) => {
    const ls = fila.filter((x) => x.nota === s);
    const m = mCops(ls);
    return { chave: s, ...m, total: `${m.texto} COPs, ${fmtInt(somaQtd(ls))} peças` };
  });

  return {
    copsCortados: mCops(porCop),
    pecas,
    mediaPorCop: { valor: media, texto: media == null ? "—" : `${nf1.format(media)} peças`, total: media == null ? "—" : `${nf1.format(media)} peças por COP (${fmtInt(porCop.length)} COPs)`, linhas: porCop } as Metrica,
    porModelo: ranking(linhas, (x) => x.modelo, mPecas),
    porCor: ranking(linhas, (x) => x.cor, mPecas),
    porTamanho: ranking(linhas, (x) => x.tamanho, mPecas, ordem(idxTam)),
    quemPorPecas,
    quemPorCops,
    tRisco,
    tParado,
    divididos,
    filaPorStatus,
    filaTotal: mCops(fila),
  };
}

// ============ BLOCO 2 — TECIDO ============
export type MetricaRend = Metrica & {
  cobertura: number | null;
  semMetragem: number;
  totalCops: number;
  estado: "ok" | "atencao" | "incompleto" | "vazio";
  fraseSem: string;
};
export const PISO_COBERTURA_PADRAO = 70;

export function blocoTecido(ctx: Ctx, pecasTecido: MapEstoquePeca[], piso = PISO_COBERTURA_PADRAO) {
  const { f } = ctx;
  const linhas: DrillLinhaCop[] = []; // metros por corte (total e cor)
  const rateado: DrillLinhaCop[] = []; // metros por modelo, rateados
  const exato: DrillLinhaCop[] = []; // metros por modelo, COPs com um só modelo
  const copsUsados = new Set<string>();

  for (const pt of pecasTecido) {
    const corT = pt.cor ?? "—";
    if (f.cor !== "todos" && corT !== f.cor) continue;
    const ref = `NF ${pt.nota_fiscal ?? "—"} · peça ${pt.numero_peca ?? "—"}`;
    for (const k of pt.cortes ?? []) {
      if (!dentro(k.data, f)) continue;
      const metros = Number(k.metros) || 0;
      const cop = ctx.copPorId.get(k.cop_id);
      if (!cop) {
        if (f.oficinaId !== "todos" || f.modelo !== "todos") continue;
        linhas.push({
          id: `x-${k.cop_id}`, rotulo: `${k.cop_numero}${k.letra ?? ""}`, oficina: "—", modelo: "", cor: corT, tamanho: "",
          qtd: null, metros, valor: null, inicio: d10(k.data), fim: null, dias: null, nota: `${ref} · COP não encontrado`,
        });
        continue;
      }
      if (!passaOficina(ctx, cop)) continue;
      const porModelo = new Map<string, number>();
      for (const p of cop.pecas ?? []) porModelo.set(p.modelo, (porModelo.get(p.modelo) ?? 0) + (Number(p.qtd) || 0));
      const totalPc = [...porModelo.values()].reduce((s, n) => s + n, 0);
      let metrosConta = metros;
      if (f.modelo !== "todos") {
        const q = porModelo.get(f.modelo) ?? 0;
        if (!q || !totalPc) continue;
        metrosConta = (metros * q) / totalPc;
      }
      copsUsados.add(cop.id);
      linhas.push(linhaBase(ctx, cop, { cor: corT, metros: metrosConta, inicio: d10(k.data), nota: ref }));
      for (const [m, q] of porModelo) {
        if (!q || !totalPc) continue;
        if (f.modelo !== "todos" && m !== f.modelo) continue;
        rateado.push(linhaBase(ctx, cop, { modelo: m, cor: corT, qtd: q, metros: (metros * q) / totalPc, inicio: d10(k.data), nota: `${ref} · ${nf1.format((q / totalPc) * 100)}% das peças do COP` }));
      }
      const modelosCom = [...porModelo.entries()].filter(([, q]) => q > 0);
      if (modelosCom.length === 1) {
        exato.push(linhaBase(ctx, cop, { modelo: modelosCom[0][0], cor: corT, qtd: modelosCom[0][1], metros, inicio: d10(k.data), nota: ref }));
      }
    }
  }

  // ---------- Rendimento: ancorado no COP (execucao_corte), metragem total do COP em qualquer data ----------
  const metrosPorCop = new Map<string, number>();
  for (const pt of pecasTecido) {
    if (f.cor !== "todos" && (pt.cor ?? "—") !== f.cor) continue;
    for (const k of pt.cortes ?? []) {
      if (!k.cop_id) continue;
      metrosPorCop.set(k.cop_id, (metrosPorCop.get(k.cop_id) ?? 0) + (Number(k.metros) || 0));
    }
  }
  type RC = { cop: Cop; metros: number; porModelo: Map<string, number>; totalPc: number; pecasFiltro: number };
  const recorte: RC[] = [];
  for (const cop of ctx.cops) {
    if (!dentro(cop.execucao_corte, f) || !passaOficina(ctx, cop)) continue;
    const pecasOk = (cop.pecas ?? []).filter((p) => passaPeca(p.modelo, p.cor, f));
    const pecasFiltro = pecasOk.reduce((s, p) => s + (Number(p.qtd) || 0), 0);
    if (!pecasFiltro) continue;
    const porModelo = new Map<string, number>();
    for (const p of cop.pecas ?? []) porModelo.set(p.modelo, (porModelo.get(p.modelo) ?? 0) + (Number(p.qtd) || 0));
    const totalPc = [...porModelo.values()].reduce((s, n) => s + n, 0);
    const bruto = metrosPorCop.get(cop.id) ?? 0;
    const metros = f.modelo !== "todos" && totalPc ? (bruto * (porModelo.get(f.modelo) ?? 0)) / totalPc : bruto;
    recorte.push({ cop, metros, porModelo, totalPc, pecasFiltro });
  }
  const SEM = "sem metragem lançada";
  const mkRend = (itens: { cop: Cop; metros: number; pecas: number; modelo: string }[], sufixo: string): MetricaRend => {
    const com = itens.filter((x) => x.metros > 0);
    const totalCops = new Set(itens.map((x) => x.cop.id)).size;
    const comCops = new Set(com.map((x) => x.cop.id)).size;
    const semMetragem = totalCops - comCops;
    const m = com.reduce((s, x) => s + x.metros, 0);
    const p = com.reduce((s, x) => s + x.pecas, 0);
    const v = p ? m / p : null;
    const cobertura = totalCops ? (comCops / totalCops) * 100 : null;
    const estado: MetricaRend["estado"] =
      cobertura == null ? "vazio" : cobertura >= 90 ? "ok" : cobertura >= piso ? "atencao" : "incompleto";
    const linhasR = itens.map((x) =>
      linhaBase(ctx, x.cop, { modelo: x.modelo, qtd: x.pecas, metros: x.metros > 0 ? x.metros : null, inicio: d10(x.cop.execucao_corte), nota: x.metros > 0 ? "" : SEM }));
    const fraseSem = totalCops ? `${fmtInt(semMetragem)} de ${fmtInt(totalCops)} cortes ainda sem metragem lançada` : "";
    return {
      valor: estado === "incompleto" ? null : v,
      texto: estado === "vazio" || v == null ? (estado === "incompleto" ? "incompleto" : "—") : estado === "incompleto" ? "incompleto" : `${nf2.format(v)} ${sufixo}`,
      total: v == null ? fraseSem || "—" : `${fmtM(m)} ÷ ${fmtInt(p)} peças = ${nf2.format(v)} m por peça · ${fraseSem}`,
      linhas: linhasR,
      cobertura, semMetragem, totalCops, estado, fraseSem,
    };
  };
  const rendimento = mkRend(recorte.map((r) => ({ cop: r.cop, metros: r.metros, pecas: r.pecasFiltro, modelo: "" })), "m por peça");
  const modelosRend = new Map<string, { cop: Cop; metros: number; pecas: number; modelo: string }[]>();
  for (const r of recorte) {
    for (const [mo, q] of r.porModelo) {
      if (!q || !r.totalPc) continue;
      if (f.modelo !== "todos" && mo !== f.modelo) continue;
      const pecasMo = (r.cop.pecas ?? []).filter((p) => p.modelo === mo && passaPeca(p.modelo, p.cor, f)).reduce((s, p) => s + (Number(p.qtd) || 0), 0);
      if (!pecasMo) continue;
      const bruto = metrosPorCop.get(r.cop.id) ?? 0;
      const arr = modelosRend.get(mo) ?? [];
      arr.push({ cop: r.cop, metros: (bruto * q) / r.totalPc, pecas: pecasMo, modelo: mo });
      modelosRend.set(mo, arr);
    }
  }
  const rendPorModelo: (MetricaRend & { chave: string })[] = [...modelosRend.entries()]
    .map(([chave, its]) => ({ chave, ...mkRend(its, "m/peça") }))
    .sort((a, b) => ordem(idxModelo)(a.chave, b.chave));

  const linhaTecido = (pt: MapEstoquePeca, data: string | null): DrillLinhaCop => ({
    id: pt.id, rotulo: "—", oficina: "—", modelo: "", cor: pt.cor ?? "—", tamanho: "", qtd: null,
    metros: (pt.cortes ?? []).reduce((s, k) => s + (Number(k.metros) || 0), 0), valor: null,
    inicio: data, fim: null, dias: null, nota: `NF ${pt.nota_fiscal ?? "—"} · peça ${pt.numero_peca ?? "—"}`,
  });
  const passaCorT = (pt: MapEstoquePeca) => f.cor === "todos" || pt.cor === f.cor;
  const abertas = pecasTecido.filter((pt) => passaCorT(pt) && dentro(pt.data_abertura, f)).map((pt) => linhaTecido(pt, d10(pt.data_abertura)));
  const zeradas = pecasTecido
    .filter((pt) => passaCorT(pt) && pt.status === "100% utilizada")
    .map((pt) => ({ pt, ult: (pt.cortes ?? []).map((k) => d10(k.data)).filter(Boolean).sort().pop() ?? null }))
    .filter((x) => dentro(x.ult, f))
    .map((x) => linhaTecido(x.pt, x.ult));
  const mTecido = (l: DrillLinhaCop[]): Metrica => ({ valor: l.length, texto: fmtInt(l.length), total: `${fmtInt(l.length)} peças de tecido`, linhas: l });

  return {
    metros: mMetros(linhas),
    porCor: ranking(linhas, (x) => x.cor, mMetros),
    porModeloRateado: ranking(rateado, (x) => x.modelo, mMetros, ordem(idxModelo)),
    porModeloExato: ranking(exato, (x) => x.modelo, mMetros, ordem(idxModelo)),
    rendimento,
    rendPorModelo,
    abertas: mTecido(abertas),
    zeradas: mTecido(zeradas),
  };
}

// ============ BLOCO 3 — COSTURA ============
function eventosRecebidos(ctx: Ctx, c: Cop): DrillLinhaCop[] {
  const out: DrillLinhaCop[] = [];
  const hist = c.historico_recebimentos ?? [];
  if (hist.length) {
    for (const ev of hist) {
      if (!dentro(ev.em, ctx.f)) continue;
      out.push(...linhasPecas(ctx, c, (ev.itens ?? []).map((i) => ({ ...i, qtd: i.qtd_recebida })), { fim: d10(ev.em), nota: ev.tipo === "completo" ? "chegada final" : "chegada parcial" }));
    }
  } else if (dentro(c.data_recebimento, ctx.f)) {
    out.push(...linhasPecas(ctx, c, (c.pecas_recebidas ?? []).map((i) => ({ ...i, qtd: i.qtd_recebida })), { fim: d10(c.data_recebimento), nota: "registro antigo" }));
  }
  return out;
}
function ultimaChegada(c: Cop): string | null {
  const hist = c.historico_recebimentos ?? [];
  if (hist.length) return hist.map((e) => d10(e.em)).filter(Boolean).sort().pop() ?? null;
  return d10(c.data_recebimento);
}
function chegadaFinal(c: Cop): string | null {
  const hist = c.historico_recebimentos ?? [];
  if (hist.length) return hist.filter((e) => e.tipo === "completo").map((e) => d10(e.em)).filter(Boolean).sort().pop() ?? null;
  return d10(c.data_recebimento);
}
function eventosPerdas(ctx: Ctx, c: Cop): DrillLinhaCop[] {
  const out: DrillLinhaCop[] = [];
  const hist = c.historico_perdas ?? [];
  const add = (it: { modelo: string; cor: string; tamanho: string; qtd: number; motivo?: string | null }, sinal: number, em: string | null, nota: string) => {
    const q = (Number(it.qtd) || 0) * sinal;
    if (!q || !passaPeca(it.modelo, it.cor, ctx.f)) return;
    out.push(linhaBase(ctx, c, { modelo: it.modelo, cor: it.cor, tamanho: it.tamanho, qtd: q, fim: em, nota: `${it.motivo || "Sem motivo"}${nota ? ` · ${nota}` : ""}` }));
  };
  if (hist.length) {
    for (const ev of hist) {
      if (!dentro(ev.em, ctx.f)) continue;
      const em = d10(ev.em);
      if (ev.tipo === "perda") for (const it of ev.itens ?? []) add(it, 1, em, "");
      else if (ev.tipo === "estorno_perda") for (const it of ev.itens ?? []) add(it, -1, em, "perda desfeita");
      else if (ev.tipo === "correcao_perda") {
        if (ev.antes) add(ev.antes, -1, em, "correção (antes)");
        const depois = ev.depois ?? ev.itens?.[0];
        if (depois) add(depois, 1, em, "correção (depois)");
      }
    }
  } else {
    const ref = c.data_recebimento ?? c.updated_at;
    if (dentro(ref, ctx.f)) for (const it of c.perdas ?? []) add(it, 1, d10(ref), "registro antigo");
  }
  return out;
}

export function blocoCostura(ctx: Ctx) {
  const { f } = ctx;
  const comOf = ctx.cops.filter((c) => c.oficina_id && passaOficina(ctx, c));
  const enviadas = comOf.filter((c) => dentro(c.data_saida_oficina, f)).flatMap((c) => linhasPecas(ctx, c, c.pecas, { inicio: d10(c.data_saida_oficina) }));
  const recebidas = comOf.flatMap((c) => eventosRecebidos(ctx, c));
  const perdas = comOf.flatMap((c) => eventosPerdas(ctx, c));

  const tLinhas = comOf
    .filter((c) => c.data_saida_oficina && dentro(ultimaChegada(c), f))
    .map((c) => {
      const fim = ultimaChegada(c);
      return linhaBase(ctx, c, { inicio: d10(c.data_saida_oficina), fim, dias: dUteis(ctx, c.data_saida_oficina, fim), qtd: somaQtd(linhasPecas(ctx, c, c.pecas)) });
    })
    .filter((l) => (l.qtd ?? 0) > 0);

  const divergencia = comOf
    .filter((c) => dentro(c.data_saida_oficina, f))
    .map((c) => {
      const env = somaQtd(linhasPecas(ctx, c, c.pecas));
      const rec = somaQtd(linhasPecas(ctx, c, (c.pecas_recebidas ?? []).map((i) => ({ ...i, qtd: i.qtd_recebida }))));
      const per = somaQtd(linhasPecas(ctx, c, c.perdas ?? []));
      const dif = env - rec - per;
      return linhaBase(ctx, c, { qtd: dif, inicio: d10(c.data_saida_oficina), nota: `enviou ${fmtInt(env)}, chegou ${fmtInt(rec)}, perdeu ${fmtInt(per)}` });
    })
    .filter((l) => (l.qtd ?? 0) > 0);

  const interna = recebidas.filter((l) => {
    const c = ctx.copPorId.get(l.id);
    return isOficinaInterna(c?.oficina_id ? ctx.ofPorId.get(c.oficina_id) : null);
  });

  return {
    enviadas: mPecas(enviadas),
    recebidas: mPecas(recebidas),
    porOficina: ranking(recebidas, (x) => x.oficina, mPecas),
    porModelo: ranking(recebidas, (x) => x.modelo, mPecas),
    porCor: ranking(recebidas, (x) => x.cor, mPecas),
    porTamanho: ranking(recebidas, (x) => x.tamanho, mPecas, ordem(idxTam)),
    tempo: mTempo(tLinhas),
    tempoPorOficina: ranking(tLinhas, (x) => x.oficina, mTempo).sort((a, b) => (a.valor ?? 0) - (b.valor ?? 0)),
    divergencia: mPecas(divergencia),
    perdas: mPecas(perdas),
    perdasPorOficina: ranking(perdas, (x) => x.oficina, mPecas),
    perdasPorMotivo: ranking(perdas, (x) => x.nota.split(" · ")[0], mPecas),
    perdasPorPeca: ranking(perdas, (x) => `${x.modelo} · ${x.cor} · ${x.tamanho}`, mPecas),
    interna: mPecas(interna),
  };
}

// ============ BLOCO 4 — DINHEIRO ============
export function blocoDinheiro(ctx: Ctx) {
  const { f } = ctx;
  const externa = (c: Cop) => {
    const of = c.oficina_id ? ctx.ofPorId.get(c.oficina_id) : null;
    return !!of && !isOficinaInterna(of);
  };
  const temPeca = (c: Cop) => f.modelo === "todos" && f.cor === "todos" ? true : (c.pecas ?? []).some((p) => passaPeca(p.modelo, p.cor, f));
  const base = ctx.cops.filter((c) => dentro(c.pagamento_pago_em, f) && externa(c) && passaOficina(ctx, c) && temPeca(c));
  const recebidoCop = (c: Cop) => (c.pecas_recebidas ?? []).reduce((s, i) => s + (Number(i.qtd_recebida) || 0), 0);
  const linhas = base.map((c) => linhaBase(ctx, c, { valor: Number(c.pagamento_valor_calculado) || 0, qtd: recebidoCop(c), fim: d10(c.pagamento_pago_em) }));
  const valor = mValor(linhas);
  const pecas = somaQtd(linhas);
  const cpp = pecas ? (valor.valor ?? 0) / pecas : null;

  const porModeloLinhas: DrillLinhaCop[] = [];
  const semValor = new Map<string, number>();
  for (const c of base) {
    const of = ctx.ofPorId.get(c.oficina_id!)!;
    const tabela = (of.valores_por_modelo ?? {}) as Record<string, number>;
    for (const i of c.pecas_recebidas ?? []) {
      const q = Number(i.qtd_recebida) || 0;
      if (!q || !passaPeca(i.modelo, i.cor, f)) continue;
      const v = Number(tabela[i.modelo]);
      if (!v) {
        semValor.set(i.modelo, (semValor.get(i.modelo) ?? 0) + q);
        continue;
      }
      porModeloLinhas.push(linhaBase(ctx, c, { modelo: i.modelo, cor: i.cor, tamanho: i.tamanho, qtd: q, valor: v * q, nota: `${fmtRS(v)} por peça` }));
    }
  }
  const custoPorModelo = ranking(porModeloLinhas, (x) => x.modelo, (ls) => {
    const q = somaQtd(ls);
    const v = q ? somaV(ls) / q : null;
    return { valor: v, texto: v == null ? "—" : fmtRS(v), total: v == null ? "—" : `${fmtRS(v)} por peça (${fmtInt(q)} peças)`, linhas: ls };
  }, ordem(idxModelo));
  const semValorTexto = [...semValor.entries()].sort((a, b) => ordem(idxModelo)(a[0], b[0])).map(([m, q]) => `${m} (${fmtInt(q)})`).join(", ");

  const fretes = base
    .map((c) => {
      const of = ctx.ofPorId.get(c.oficina_id!)!;
      const n = Number(c.num_fretes) || 0;
      return linhaBase(ctx, c, { qtd: n, valor: n * (Number(of.valor_frete) || 0), fim: d10(c.pagamento_pago_em), nota: `${fmtInt(n)} frete(s) × ${fmtRS(Number(of.valor_frete) || 0)}` });
    })
    .filter((l) => (l.qtd ?? 0) > 0);

  const liberado = ctx.cops
    .filter((c) => c.pagamento_status === "liberado" && externa(c) && passaOficina(ctx, c) && temPeca(c))
    .map((c) => linhaBase(ctx, c, { valor: Number(c.pagamento_valor_calculado) || 0, inicio: d10(c.pagamento_liberado_em) }));

  return {
    valor,
    porOficina: ranking(linhas, (x) => x.oficina, mValor),
    custoPorPeca: { valor: cpp, texto: cpp == null ? "—" : fmtRS(cpp), total: cpp == null ? "—" : `${valor.texto} ÷ ${fmtInt(pecas)} peças = ${fmtRS(cpp)} por peça`, linhas } as Metrica,
    custoPorModelo,
    semValorTexto,
    semValorPecas: [...semValor.values()].reduce((s, n) => s + n, 0),
    fretes: mValor(fretes),
    liberado: mValor(liberado),
  };
}

// ============ BLOCO 5 — PONTA A PONTA ============
export function blocoPontaAPonta(
  ctx: Ctx,
  r: { corte: ReturnType<typeof blocoCorte>; tecido: ReturnType<typeof blocoTecido>; costura: ReturnType<typeof blocoCostura> },
) {
  const linhas = ctx.cops
    .filter((c) => c.solicitacao_risco && passaOficina(ctx, c) && dentro(chegadaFinal(c), ctx.f))
    .map((c) => {
      const fim = chegadaFinal(c);
      return linhaBase(ctx, c, { inicio: d10(c.solicitacao_risco), fim, dias: dUteis(ctx, c.solicitacao_risco, fim), qtd: somaQtd(linhasPecas(ctx, c, c.pecas)) });
    })
    .filter((l) => (l.qtd ?? 0) > 0);
  return {
    tempoTotal: mTempo(linhas),
    funil: [
      { chave: "Metros cortados", ...r.tecido.metros },
      { chave: "Peças cortadas", ...r.corte.pecas },
      { chave: "Peças enviadas", ...r.costura.enviadas },
      { chave: "Peças recebidas", ...r.costura.recebidas },
      { chave: "Peças perdidas", ...r.costura.perdas },
    ] as ItemRanking[],
  };
}

export function calcularTudo(cops: Cop[], oficinas: Oficina[], pecasTecido: MapEstoquePeca[], feriados: Feriados, f: KpiCopMapFiltro) {
  const ctx = criarCtx(cops, oficinas, feriados, f);
  const corte = blocoCorte(ctx);
  const tecido = blocoTecido(ctx, pecasTecido);
  const costura = blocoCostura(ctx);
  const dinheiro = blocoDinheiro(ctx);
  const ponta = blocoPontaAPonta(ctx, { corte, tecido, costura });
  return { corte, tecido, costura, dinheiro, ponta };
}
export type KpiCopMapResultado = ReturnType<typeof calcularTudo>;

/** Opções de filtro na ordem canônica. */
export function opcoesFiltro(cops: Cop[]) {
  const modelos = new Set<string>();
  const cores = new Set<string>();
  for (const c of cops) for (const p of c.pecas ?? []) {
    if (p?.modelo) modelos.add(p.modelo);
    if (p?.cor) cores.add(p.cor);
  }
  return { modelos: [...modelos].sort(ordem(idxModelo)), cores: [...cores].sort(ordem(idxCor)) };
}
