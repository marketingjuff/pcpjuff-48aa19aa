import { describe, test } from "node:test";
import assert from "node:assert/strict";

function expect<T>(actual: T) {
  return {
    toBe: (expected: T) => assert.strictEqual(actual, expected),
    toEqual: (expected: T) => assert.deepStrictEqual(actual, expected),
    toHaveLength: (expected: number) => assert.strictEqual((actual as { length: number }).length, expected),
    toBeNull: () => assert.strictEqual(actual, null),
  };
}
const { montarEstoqueMinimo, minimoSobDemandaParaSalvar, itensSobDemandaDaCor, sobDemandaAoSalvar } = await import("./plan");
const { itensDaColagem } = await import("../components/plan/EstoqueMinimoTab");
type MinimoSalvo = import("./plan").MinimoSalvo;

const salvo: MinimoSalvo = {
  modelo: "Camiseta", cor: "amarelo", tamanho: "M", minimo_adotado: 0,
  sugerido_na_adocao: 20, sob_demanda: false, adotado_em: "2026-11-05T20:03:00Z", adotado_por: null,
};
function linha(s: MinimoSalvo | null) {
  const rows = montarEstoqueMinimo({
    mediaMensal: new Map([["Camiseta|amarelo|M", 30]]), tamanhos: ["M"], leadTime: undefined,
    config: { semanas_seguranca: 0, lead_time_com_cru_dias: 30 },
    coresForaDeLinha: new Set(), minimosAdotados: new Map(s ? [["Camiseta|amarelo|M", s]] : []), limiarPct: 10,
  });
  const row = rows.find(l => l.modelo === "Camiseta" && l.cor === "amarelo" && l.tamanho === "M");
  if (!row) throw new Error("Linha de teste não criada");
  return row;
}

describe("Sob demanda por tamanho", () => {
  test("adotado 0 e sugerido 30 continuam defasados normalmente", () => {
    expect(linha(salvo).sugerido).toBe(30);
    expect(linha(salvo).defasado).toBe(true);
  });
  test("marcação silencia o defasado e mantém o sugerido", () => {
    const l = linha({ ...salvo, sob_demanda: true });
    expect(l.sobDemanda).toBe(true);
    expect(l.defasado).toBe(false);
    expect(l.sugerido).toBe(30);
    expect([l].filter((r) => r.defasado)).toHaveLength(0);
  });
  test("voltar ao normal restaura o alerta", () => {
    const normal = minimoSobDemandaParaSalvar(salvo, 30, false);
    expect(linha({ ...salvo, ...normal }).defasado).toBe(true);
  });
  test("linha sem registro inicia sem marcação", () => {
    expect(linha(null).sobDemanda).toBe(false);
    expect(linha(null).adotado).toBeNull();
  });
  test("nova marcação cria adotado 0 e registra sugerido 30", () => {
    expect(minimoSobDemandaParaSalvar(null, 30, true)).toEqual({
      minimo_adotado: 0, sugerido_na_adocao: 30, sob_demanda: true,
    });
  });
  test("alternar preserva números atuais e sugerido nulo", () => {
    expect(minimoSobDemandaParaSalvar({ minimo_adotado: 7, sugerido_na_adocao: null }, 30, true))
      .toEqual({ minimo_adotado: 7, sugerido_na_adocao: null, sob_demanda: true });
  });
  test("colar 50 sobre destino marcado preserva a marcação", () => {
    const l = linha({ ...salvo, sob_demanda: true });
    expect(itensDaColagem([l], new Map([["M", 50]]), true)).toEqual([
      { modelo: "Camiseta", cor: "amarelo", tamanho: "M", minimo: 50, sugerido: 30, sobDemanda: true },
    ]);
  });
  test("número copiado de origem marcada não marca o destino", () => {
    const origem = linha({ ...salvo, minimo_adotado: 50, sob_demanda: true });
    expect(itensDaColagem([linha(salvo)], new Map([[origem.tamanho, origem.adotado ?? 0]]), true)[0]?.sobDemanda).toBe(false);
  });
  test("salvar adotado zero marca Sob demanda automaticamente", () => {
    expect(sobDemandaAoSalvar(0, false)).toBe(true);
    expect(sobDemandaAoSalvar(0, undefined)).toBe(true);
  });
  test("salvar valor positivo preserva a marcação atual", () => {
    expect(sobDemandaAoSalvar(50, false)).toBe(false);
    expect(sobDemandaAoSalvar(50, true)).toBe(true);
    expect(sobDemandaAoSalvar(50, undefined)).toBe(false);
  });
  test("colar sem substituir não altera mínimo zero já definido", () => {
    expect(itensDaColagem([linha(salvo)], new Map([["M", 50]]), false)).toEqual([]);
  });
  test("ação por cor inclui todos os tamanhos e exclui outro modelo e cor", () => {
    const l = linha(salvo);
    const itens = itensSobDemandaDaCor([l, { ...l, tamanho: "P", adotado: 7 },
      { ...l, cor: "preto" }, { ...l, modelo: "Polo" }], "Camiseta", "amarelo");
    expect(itens.map((i) => i.tamanho)).toEqual(["M", "P"]);
    expect(itens.every((i) => i.sobDemanda)).toBe(true);
  });
  test("cor parcialmente marcada completa somente os tamanhos restantes", () => {
    const l = linha(salvo);
    expect(itensSobDemandaDaCor([l, { ...l, tamanho: "P", sobDemanda: true }], "Camiseta", "amarelo"))
      .toEqual([{ modelo: "Camiseta", cor: "amarelo", tamanho: "M", sugerido: 30, sobDemanda: true }]);
  });
  test("cor inteira marcada volta ao normal preservando mínimos de cada tamanho", () => {
    const l = { ...linha(salvo), sobDemanda: true };
    const itens = itensSobDemandaDaCor([l, { ...l, tamanho: "P", adotado: 7 }], "Camiseta", "amarelo");
    expect(itens.map((i) => i.sobDemanda)).toEqual([false, false]);
    expect([salvo, { ...salvo, minimo_adotado: 7 }].map((s, idx) =>
      minimoSobDemandaParaSalvar(s, 30, itens[idx]?.sobDemanda ?? true).minimo_adotado)).toEqual([0, 7]);
  });
});
const { CATALOGO_PADRAO } = await import("./plan-catalogo");
const { classificarCor, copiarCatalogo, mudarCorCatalogo, mudarCorEmTodos, restaurarModeloCatalogo, validarCatalogo, montarNecessidade, filtrarModeloCor, totaisNecessidade, montarTinturaria } = await import("./plan");
function grade(catalogo = CATALOGO_PADRAO, globais = new Set<string>()) {
  return montarEstoqueMinimo({ mediaMensal: new Map(), tamanhos: ["PP", "P", "M", "G", "GG", "EXG", "EXXG"], leadTime: undefined, config: {}, coresForaDeLinha: globais, minimosAdotados: new Map(), limiarPct: 10, catalogo });
}
function necessidade(catalogo = CATALOGO_PADRAO, mediaMensal = new Map<string, number>(), saldoReal = new Map<string, number>(), minimosAdotados = new Map<string, MinimoSalvo>()) {
  return montarNecessidade({ catalogo, tamanhos: ["PP", "P", "M", "G", "GG", "EXG", "EXXG"], mediaMensal, saldoReal, emProducao: new Map(), horizonteMeses: 1, semanasSeguranca: 0, minimosAdotados });
}
describe("Catálogo completo do PLAN", () => {
  test("semente gera 1924 linhas sem venda nem mínimos", () => {
    expect(grade()).toHaveLength(1924);
    expect(grade().every(l => l.adotado === null)).toBe(true);
  });
  test("Camiseta tem 18 cores normais e 8 Outlet com sete tamanhos", () => {
    const rows = grade().filter(l => l.modelo === "Camiseta");
    expect(rows).toHaveLength(182);
    expect(new Set(rows.filter(l => l.classificacao === "normal").map(l => l.cor)).size).toBe(18);
    expect(new Set(rows.filter(l => l.classificacao === "outlet").map(l => l.cor)).size).toBe(8);
    expect(rows.filter(l => l.classificacao === "outlet").every(l => l.sobDemanda && l.sugerido === 0 && !l.defasado)).toBe(true);
  });
  test("Cross tem 12 normais, fúcsia Outlet e amarelo ausente", () => {
    const rows = grade().filter(l => l.modelo === "Regata Cross");
    expect(rows).toHaveLength(104);
    expect(new Set(rows.filter(l => l.classificacao === "normal").map(l => l.cor)).size).toBe(12);
    expect(new Set(rows.filter(l => l.classificacao !== "normal").map(l => l.cor)).size).toBe(14);
    expect(rows.filter(l => l.cor === "fúcsia").every(l => l.classificacao === "outlet")).toBe(true);
    expect(rows.filter(l => l.cor === "amarelo").every(l => l.classificacao === "ausente")).toBe(true);
    expect([...new Set(rows.map(l => l.tamanho))]).toEqual(["P", "M", "G", "GG"]);
  });
  test("Breeze só tem 26 cores ausentes com quatro tamanhos", () => {
    const rows = grade().filter(l => l.modelo === "Regata Breeze");
    expect(rows).toHaveLength(104);
    expect(rows.every(l => l.classificacao === "ausente" && l.sobDemanda)).toBe(true);
    expect(new Set(rows.map(l => l.cor)).size).toBe(26);
  });
  test("bloqueio global mantém todas as 1924 linhas e tem precedência", () => {
    const rows = grade(CATALOGO_PADRAO, new Set(["amarelo", "fúcsia"]));
    expect(rows).toHaveLength(1924);
    expect(rows.filter(l => l.cor === "amarelo" || l.cor === "fúcsia").every(l => l.classificacao === "geral" && l.sugerido === 0 && l.sobDemanda)).toBe(true);
    const promovido = mudarCorCatalogo(CATALOGO_PADRAO, "Regata Cross", "amarelo", "normal");
    expect(classificarCor(promovido, "Regata Cross", "amarelo", new Set(["amarelo"]))).toBe("geral");
  });
  test("histórico e mínimo não inventam tamanho PP na Cross", () => {
    const rows = montarEstoqueMinimo({ catalogo: CATALOGO_PADRAO, mediaMensal: new Map([["Regata Cross|preto|PP", 20]]), tamanhos: ["PP", "P", "M", "G", "GG", "EXG", "EXXG"], leadTime: undefined, config: {}, coresForaDeLinha: new Set(), minimosAdotados: new Map([["Regata Cross|preto|PP", { ...salvo, modelo: "Regata Cross", tamanho: "PP" }]]), limiarPct: 10 });
    expect(rows.some(l => l.modelo === "Regata Cross" && l.tamanho === "PP")).toBe(false);
  });
  test("promoção muda só amarelo da Cross e desliga o padrão implícito", () => {
    const novo = mudarCorCatalogo(CATALOGO_PADRAO, "Regata Cross", "amarelo", "normal");
    expect(novo["Regata Move"]).toEqual(CATALOGO_PADRAO["Regata Move"]);
    const rows = grade(novo).filter(l => l.modelo === "Regata Cross" && l.cor === "amarelo");
    expect(rows).toHaveLength(4);
    expect(rows.every(l => !l.sobDemanda && l.adotado === null && l.classificacao === "normal")).toBe(true);
    expect(classificarCor(CATALOGO_PADRAO, "Regata Cross", "amarelo")).toBe("ausente");
  });
  test("colagem é recusada em Outlet, ausente e geral", () => {
    for (const classificacao of ["outlet", "ausente", "geral"] as const) {
      expect(itensDaColagem([{ ...linha(salvo), classificacao }], new Map([["M", 50]]), true)).toEqual([]);
    }
  });
  test("validar descarta nomes inválidos e conserva tamanho vazio", () => {
    const v = validarCatalogo({ Camiseta: { tamanhos: ["M", "99", "M"], normais: ["amarelo", "rosa ultra"], outlet: [] }, Fantasma: { tamanhos: ["M"], normais: [], outlet: [] } });
    expect(v.Camiseta).toEqual({ tamanhos: ["M"], normais: ["amarelo"], outlet: [] });
    expect(Object.hasOwn(v, "Fantasma")).toBe(false);
    expect(v["Baby Look"]).toEqual(CATALOGO_PADRAO["Baby Look"]);
    expect(grade({ Camiseta: { tamanhos: [], normais: ["amarelo"], outlet: [] } })).toHaveLength(0);
  });
  test("configuração inválida ou listas sobrepostas usam padrão", () => {
    expect(validarCatalogo(null)).toEqual(CATALOGO_PADRAO);
    expect(validarCatalogo({ Camiseta: { tamanhos: ["M"], normais: ["amarelo"], outlet: ["amarelo"] } })).toEqual(CATALOGO_PADRAO);
  });
  test("lote verde militar altera 11 modelos sem criar nos ausentes", () => {
    const lote = mudarCorEmTodos(CATALOGO_PADRAO, "verde militar", "outlet");
    expect(lote.quantidade).toBe(11);
    expect(classificarCor(lote.catalogo, "Regata Cross", "verde militar")).toBe("ausente");
    expect(classificarCor(lote.catalogo, "Camiseta", "verde militar")).toBe("outlet");
  });
  test("restaurar devolve somente o modelo selecionado", () => {
    const alterado = mudarCorCatalogo(mudarCorCatalogo(CATALOGO_PADRAO, "Camiseta", "roxo", "normal"), "Regata Cross", "amarelo", "normal");
    const restaurado = restaurarModeloCatalogo(alterado, "Camiseta");
    expect(restaurado.Camiseta).toEqual(CATALOGO_PADRAO.Camiseta);
    expect(classificarCor(restaurado, "Regata Cross", "amarelo")).toBe("normal");
  });
  test("necessidade lista 416 pares incluindo zeros sem inflar os totais", () => {
    const rows = necessidade();
    expect(rows).toHaveLength(416);
    expect(totaisNecessidade(rows)).toEqual({ demanda: 0, estoque: 0, producao: 0, falta: 0 });
    expect(rows.find(l => l.modelo === "Regata Cross" && l.cor === "preto")?.aProduzirPorTam.PP).toBe(undefined);
  });
  test("Outlet e ausente zeram produção mesmo com pedidos firmes", () => {
    const rows = necessidade(CATALOGO_PADRAO, new Map([["Camiseta|roxo|M", 30]]), new Map([["Camiseta|roxo|M", -5], ["Regata Cross|amarelo|M", -7]]));
    const outlet = rows.find(l => l.modelo === "Camiseta" && l.cor === "roxo");
    expect(outlet?.aProduzir).toBe(0);
    expect(outlet?.jaVendido).toBe(5);
    expect(rows.find(l => l.modelo === "Regata Cross" && l.cor === "amarelo")?.aProduzir).toBe(0);
  });
  test("trocar normal por Outlet reduz sugestão de 30 para zero", () => {
    const media = new Map([["Camiseta|amarelo|M", 30]]);
    expect(totaisNecessidade(necessidade(CATALOGO_PADRAO, media)).falta).toBe(30);
    expect(totaisNecessidade(necessidade(mudarCorCatalogo(CATALOGO_PADRAO, "Camiseta", "amarelo", "outlet"), media)).falta).toBe(0);
  });
  test("filtros Camiseta e Baby Look amarelo somam somente dois pares", () => {
    const rows = necessidade(CATALOGO_PADRAO, new Map([["Camiseta|amarelo|M", 30], ["Baby Look|amarelo|M", 20], ["Regata Masculina|preto|M", 70]]));
    const recorte = filtrarModeloCor(rows, { modelos: ["Camiseta", "Baby Look"], cores: ["amarelo"] });
    expect(recorte).toHaveLength(2);
    expect(totaisNecessidade(recorte)).toEqual({ demanda: 50, estoque: 0, producao: 0, falta: 50 });
    expect(filtrarModeloCor(rows, { modelos: [], cores: [] })).toHaveLength(416);
  });
  test("Tinturaria recalcula kg só do modelo selecionado", () => {
    const rows = necessidade(CATALOGO_PADRAO, new Map([["Camiseta|amarelo|M", 30], ["Baby Look|amarelo|M", 20]]));
    const ficha = { id: "f", modelo: "Camiseta", tamanho_referencia: "M", pecas_por_folha: 1, altura_folha_m: 1, largura_tecido_m: 1, ativo: true, observacao: null };
    const calc = (ls: typeof rows) => montarTinturaria({ linhas: ls.filter(l => !l.foraDeLinha), tamanhos: ["M"], fichas: [ficha, { ...ficha, modelo: "Baby Look" }], config: { largura_padrao_m: 1, gramatura_g_por_metro: 1000, fator_perda_encaixe: 1, lote_minimo_tinturaria_kg: 1 }, metrosEstoquePorCor: new Map(), kgTinturariaPorCor: new Map(), cruTotal: 0 }).find(l => l.cor === "amarelo");
    expect(calc(rows)?.kgATingir).toBe(50);
    expect(calc(filtrarModeloCor(rows, { modelos: ["Camiseta"], cores: [] }))?.kgATingir).toBe(30);
  });
});
