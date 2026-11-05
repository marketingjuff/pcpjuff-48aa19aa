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
const { montarEstoqueMinimo, minimoSobDemandaParaSalvar, itensSobDemandaDaCor } = await import("./plan");
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
  const row = rows[0];
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