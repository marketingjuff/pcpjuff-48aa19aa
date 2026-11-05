import { describe, test } from "node:test";
import assert from "node:assert/strict";

function expect<T>(actual: T) {
  return {
    toBe: (expected: T) => assert.strictEqual(actual, expected),
  };
}

const { podeEditarPlan } = await import("./plan-permissoes");

describe("podeEditarPlan", () => {
  test("admin edita o PLAN", () => {
    expect(podeEditarPlan(["admin"])).toBe(true);
  });
  test("gestor edita o PLAN", () => {
    expect(podeEditarPlan(["gestor"])).toBe(true);
  });
  test("gestor com outras áreas continua editando", () => {
    expect(podeEditarPlan(["gestor", "operador"])).toBe(true);
  });
  test("operador não edita", () => {
    expect(podeEditarPlan(["operador"])).toBe(false);
  });
  test("sem papel não edita", () => {
    expect(podeEditarPlan([])).toBe(false);
  });
});
