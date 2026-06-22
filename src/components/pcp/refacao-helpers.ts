import { supabase } from "@/integrations/supabase/client";
import {
  episodioAberto,
  etapaAtualSemAsterisco,
  type Pedido,
  type RefacaoEpisodio,
} from "@/lib/pedidos";
import type { RefacaoFormPayload } from "./RefacaoDialog";
import type { VoltarDestino } from "./VoltarDropdown";

/**
 * Constrói o array `refacoes` resultante de um Refazer:
 * - Se há episódio aberto: atualiza o `etapa_destino` desse episódio.
 * - Se não há e veio payload: cria um novo episódio (aberto).
 * - Se não há episódio e não veio payload: retorna o array atual sem mudanças.
 */
export async function montarRefacoesAposRefazer(
  pedido: Pedido,
  destino: VoltarDestino,
  payload: RefacaoFormPayload | null,
): Promise<RefacaoEpisodio[]> {
  const refsAtuais: RefacaoEpisodio[] = Array.isArray(pedido.refacoes) ? pedido.refacoes : [];
  const aberto = episodioAberto(pedido);
  if (aberto) {
    return refsAtuais.map((e) =>
      e === aberto ? { ...e, etapa_destino: destino } : e,
    );
  }
  if (!payload) return refsAtuais;
  const { data: u } = await supabase.auth.getUser();
  const novo: RefacaoEpisodio = {
    etapa_origem: etapaAtualSemAsterisco(pedido),
    etapa_destino: destino,
    data: new Date().toISOString(),
    quem: u?.user?.id ?? null,
    pecas_refazer: payload.pecas_refazer,
    perda_pecas: payload.perda_pecas,
    perda_adesivos: payload.perda_adesivos,
    motivo: payload.motivo,
    aberto: true,
  };
  return [...refsAtuais, novo];
}
