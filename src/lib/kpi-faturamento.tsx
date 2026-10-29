import { createContext, useContext, type ReactNode } from "react";

const Ctx = createContext(true);

/** Envolve as abas do KPI. mostrar=false faz todo valor em reais sumir da tela. */
export function FaturamentoProvider({ mostrar, children }: { mostrar: boolean; children: ReactNode }) {
  return <Ctx.Provider value={mostrar}>{children}</Ctx.Provider>;
}

/** true = pode exibir valores em reais. Fora do provider devolve true (comportamento atual). */
export function useMostrarFaturamento(): boolean {
  return useContext(Ctx);
}
