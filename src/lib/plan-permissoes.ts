/**
 * Quem pode EDITAR o PLAN.
 *
 * Admin e gestor editam (parâmetros, fichas de encaixe, cores fora de linha,
 * estoque mínimo). Qualquer outro papel — ou nenhum — é somente leitura.
 */
export function podeEditarPlan(roles: readonly string[]): boolean {
  return roles.includes("admin") || roles.includes("gestor");
}
