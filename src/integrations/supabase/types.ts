export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" }
  public: {
    Tables: {
      pedidos: {
        Row: {
          acabamento_data: string | null
          arte_data: string | null
          arte_observacao: string | null
          created_at: string
          data_saida_juff: string | null
          dtf_data_executada: string | null
          dtf_estampado: string | null
          dtf_executado: string | null
          dtf_impresso: string | null
          dtf_observacao: string | null
          dtf_ok: string | null
          embalado: string | null
          entrada_pedido: string
          fotolito_executado: string | null
          fotolito_impresso: string | null
          frete: string | null
          id: string
          inicio_estamparia: string | null
          modelo_estampa: string
          observacoes_pedido: string | null
          orcamento: string
          pedido_ok: string | null
          pedido_olist: string
          qtd: string
          qual_estampa: string | null
          responsavel_conferencia: string | null
          saida_juff: string | null
          silk_data_executada: string | null
          silk_feito: string | null
          silk_observacao: string | null
          silk_ok: string | null
          status: string
          tela_gravada: string | null
          tempo_frete: string | null
          termino_estamparia: string | null
          updated_at: string
          user_id: string
          vendedor: string
        }
        Insert: {
          acabamento_data?: string | null
          arte_data?: string | null
          arte_observacao?: string | null
          created_at?: string
          data_saida_juff?: string | null
          dtf_data_executada?: string | null
          dtf_estampado?: string | null
          dtf_executado?: string | null
          dtf_impresso?: string | null
          dtf_observacao?: string | null
          dtf_ok?: string | null
          embalado?: string | null
          entrada_pedido: string
          fotolito_executado?: string | null
          fotolito_impresso?: string | null
          frete?: string | null
          id?: string
          inicio_estamparia?: string | null
          modelo_estampa: string
          observacoes_pedido?: string | null
          orcamento: string
          pedido_ok?: string | null
          pedido_olist: string
          qtd: string
          qual_estampa?: string | null
          responsavel_conferencia?: string | null
          saida_juff?: string | null
          silk_data_executada?: string | null
          silk_feito?: string | null
          silk_observacao?: string | null
          silk_ok?: string | null
          status?: string
          tela_gravada?: string | null
          tempo_frete?: string | null
          termino_estamparia?: string | null
          updated_at?: string
          user_id: string
          vendedor: string
        }
        Update: Partial<Database["public"]["Tables"]["pedidos"]["Insert"]>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Update"]
