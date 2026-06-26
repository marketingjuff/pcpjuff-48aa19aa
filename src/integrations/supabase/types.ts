export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_color_settings: {
        Row: {
          data: Json
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          data?: Json
          id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      app_lists: {
        Row: {
          created_at: string
          id: string
          kind: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      cop_perdas: {
        Row: {
          cop_id: string | null
          cor: string
          created_at: string
          etiqueta: string | null
          id: string
          modelo: string
          motivo: string | null
          oficina_id: string | null
          qtd: number
          registrado_por: string | null
          tamanho: string
          updated_at: string
        }
        Insert: {
          cop_id?: string | null
          cor: string
          created_at?: string
          etiqueta?: string | null
          id?: string
          modelo: string
          motivo?: string | null
          oficina_id?: string | null
          qtd: number
          registrado_por?: string | null
          tamanho: string
          updated_at?: string
        }
        Update: {
          cop_id?: string | null
          cor?: string
          created_at?: string
          etiqueta?: string | null
          id?: string
          modelo?: string
          motivo?: string | null
          oficina_id?: string | null
          qtd?: number
          registrado_por?: string | null
          tamanho?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cop_perdas_cop_id_fkey"
            columns: ["cop_id"]
            isOneToOne: false
            referencedRelation: "cops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cop_perdas_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      cops: {
        Row: {
          conferencia: Json
          conferido_em: string | null
          conferido_por: string | null
          cop_pai_id: string | null
          cop_romaneio_pai_id: string | null
          corte_dividido: boolean
          created_at: string
          created_by: string | null
          data_recebimento: string | null
          data_saida_oficina: string | null
          execucao_corte: string | null
          execucao_risco: string | null
          id: string
          letra: string | null
          num_fretes: number
          numero: number
          observacoes_corte: string | null
          observacoes_romaneio: string | null
          oficina_id: string | null
          pagamento_liberado_em: string | null
          pagamento_liberado_por: string | null
          pagamento_pago_em: string | null
          pagamento_pago_por: string | null
          pagamento_status: string
          pagamento_valor_calculado: number | null
          pecas: Json
          pecas_recebidas: Json
          perdas: Json
          romaneio_enviado_em: string | null
          solicitacao_corte: string | null
          solicitacao_risco: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          conferencia?: Json
          conferido_em?: string | null
          conferido_por?: string | null
          cop_pai_id?: string | null
          cop_romaneio_pai_id?: string | null
          corte_dividido?: boolean
          created_at?: string
          created_by?: string | null
          data_recebimento?: string | null
          data_saida_oficina?: string | null
          execucao_corte?: string | null
          execucao_risco?: string | null
          id?: string
          letra?: string | null
          num_fretes?: number
          numero?: number
          observacoes_corte?: string | null
          observacoes_romaneio?: string | null
          oficina_id?: string | null
          pagamento_liberado_em?: string | null
          pagamento_liberado_por?: string | null
          pagamento_pago_em?: string | null
          pagamento_pago_por?: string | null
          pagamento_status?: string
          pagamento_valor_calculado?: number | null
          pecas?: Json
          pecas_recebidas?: Json
          perdas?: Json
          romaneio_enviado_em?: string | null
          solicitacao_corte?: string | null
          solicitacao_risco?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          conferencia?: Json
          conferido_em?: string | null
          conferido_por?: string | null
          cop_pai_id?: string | null
          cop_romaneio_pai_id?: string | null
          corte_dividido?: boolean
          created_at?: string
          created_by?: string | null
          data_recebimento?: string | null
          data_saida_oficina?: string | null
          execucao_corte?: string | null
          execucao_risco?: string | null
          id?: string
          letra?: string | null
          num_fretes?: number
          numero?: number
          observacoes_corte?: string | null
          observacoes_romaneio?: string | null
          oficina_id?: string | null
          pagamento_liberado_em?: string | null
          pagamento_liberado_por?: string | null
          pagamento_pago_em?: string | null
          pagamento_pago_por?: string | null
          pagamento_status?: string
          pagamento_valor_calculado?: number | null
          pecas?: Json
          pecas_recebidas?: Json
          perdas?: Json
          romaneio_enviado_em?: string | null
          solicitacao_corte?: string | null
          solicitacao_risco?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cops_cop_pai_id_fkey"
            columns: ["cop_pai_id"]
            isOneToOne: false
            referencedRelation: "cops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cops_cop_romaneio_pai_id_fkey"
            columns: ["cop_romaneio_pai_id"]
            isOneToOne: false
            referencedRelation: "cops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cops_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          id: string
        }
        Insert: {
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
        }
        Relationships: []
      }
      oficinas: {
        Row: {
          cep: string | null
          cnpj_cpf: string | null
          created_at: string
          endereco: string | null
          id: string
          nome: string
          updated_at: string
          valor_frete: number
          valores_por_modelo: Json
        }
        Insert: {
          cep?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
          updated_at?: string
          valor_frete?: number
          valores_por_modelo?: Json
        }
        Update: {
          cep?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
          updated_at?: string
          valor_frete?: number
          valores_por_modelo?: Json
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          acabamento_data: string | null
          acabamento_observacao: string | null
          arte_data: string | null
          arte_observacao: string | null
          created_at: string
          data_entrega: string | null
          data_entrega_proposta: string | null
          data_entrega_proposta_em: string | null
          data_entrega_proposta_por: string | null
          data_saida_juff: string | null
          dias_secagem: number | null
          dtf_cortado: string | null
          dtf_cortado_data: string | null
          dtf_data_executada: string | null
          dtf_estampado: string | null
          dtf_executado: string | null
          dtf_impresso: string | null
          dtf_observacao: string | null
          dtf_pessoas_qtd: Json | null
          embalado: string | null
          entrada_pedido: string | null
          exp_cobranca_pagamento: boolean | null
          exp_despachado: boolean | null
          exp_despachado_em: string | null
          exp_etiqueta: boolean | null
          exp_frete_solicitado: boolean | null
          exp_frete_solicitado_em: string | null
          exp_observacoes: string | null
          exp_pagamento: boolean | null
          expedicao_entrou_em: string | null
          finalizado_em: string | null
          forma_pagamento: string | null
          fotolito_executado: string | null
          fotolito_impresso: string | null
          frete: string | null
          historico_data_entrega: Json
          id: string
          inicio_acabamento: string | null
          inicio_estamparia: string | null
          layout_url: string | null
          n_batidas_dtf: number | null
          n_batidas_silk: number | null
          necessita_vetorizacao: boolean | null
          nf_emitida: string | null
          obs_vendedor: string | null
          observacoes_pedido: string | null
          orcamento: string | null
          pecas_completadas_log: Json
          pecas_solicitadas: Json
          pedido_olist: string | null
          qtd: number | null
          quem_bateu_dtf: string | null
          quem_bateu_silk: string | null
          quem_cortou_dtf: string | null
          quem_revelou_tela: string | null
          reaberto: boolean
          refacoes: Json
          responsavel_acabamento: string | null
          responsavel_conferencia: string | null
          saida_juff: string | null
          silk_data_executada: string | null
          silk_feito: string | null
          silk_observacao: string | null
          status_arte: string | null
          status_pecas: string | null
          tela_gravada: string | null
          tempo_frete: number | null
          tempo_producao: number | null
          termino_acabamento: string | null
          termino_estamparia: string | null
          tipo_estampa: string | null
          uf_entrega: string | null
          updated_at: string
          vendedor: string | null
          vetorizacao_dtf: string | null
          vetorizacao_executada: boolean | null
          vetorizacao_silk: string | null
        }
        Insert: {
          acabamento_data?: string | null
          acabamento_observacao?: string | null
          arte_data?: string | null
          arte_observacao?: string | null
          created_at?: string
          data_entrega?: string | null
          data_entrega_proposta?: string | null
          data_entrega_proposta_em?: string | null
          data_entrega_proposta_por?: string | null
          data_saida_juff?: string | null
          dias_secagem?: number | null
          dtf_cortado?: string | null
          dtf_cortado_data?: string | null
          dtf_data_executada?: string | null
          dtf_estampado?: string | null
          dtf_executado?: string | null
          dtf_impresso?: string | null
          dtf_observacao?: string | null
          dtf_pessoas_qtd?: Json | null
          embalado?: string | null
          entrada_pedido?: string | null
          exp_cobranca_pagamento?: boolean | null
          exp_despachado?: boolean | null
          exp_despachado_em?: string | null
          exp_etiqueta?: boolean | null
          exp_frete_solicitado?: boolean | null
          exp_frete_solicitado_em?: string | null
          exp_observacoes?: string | null
          exp_pagamento?: boolean | null
          expedicao_entrou_em?: string | null
          finalizado_em?: string | null
          forma_pagamento?: string | null
          fotolito_executado?: string | null
          fotolito_impresso?: string | null
          frete?: string | null
          historico_data_entrega?: Json
          id?: string
          inicio_acabamento?: string | null
          inicio_estamparia?: string | null
          layout_url?: string | null
          n_batidas_dtf?: number | null
          n_batidas_silk?: number | null
          necessita_vetorizacao?: boolean | null
          nf_emitida?: string | null
          obs_vendedor?: string | null
          observacoes_pedido?: string | null
          orcamento?: string | null
          pecas_completadas_log?: Json
          pecas_solicitadas?: Json
          pedido_olist?: string | null
          qtd?: number | null
          quem_bateu_dtf?: string | null
          quem_bateu_silk?: string | null
          quem_cortou_dtf?: string | null
          quem_revelou_tela?: string | null
          reaberto?: boolean
          refacoes?: Json
          responsavel_acabamento?: string | null
          responsavel_conferencia?: string | null
          saida_juff?: string | null
          silk_data_executada?: string | null
          silk_feito?: string | null
          silk_observacao?: string | null
          status_arte?: string | null
          status_pecas?: string | null
          tela_gravada?: string | null
          tempo_frete?: number | null
          tempo_producao?: number | null
          termino_acabamento?: string | null
          termino_estamparia?: string | null
          tipo_estampa?: string | null
          uf_entrega?: string | null
          updated_at?: string
          vendedor?: string | null
          vetorizacao_dtf?: string | null
          vetorizacao_executada?: boolean | null
          vetorizacao_silk?: string | null
        }
        Update: {
          acabamento_data?: string | null
          acabamento_observacao?: string | null
          arte_data?: string | null
          arte_observacao?: string | null
          created_at?: string
          data_entrega?: string | null
          data_entrega_proposta?: string | null
          data_entrega_proposta_em?: string | null
          data_entrega_proposta_por?: string | null
          data_saida_juff?: string | null
          dias_secagem?: number | null
          dtf_cortado?: string | null
          dtf_cortado_data?: string | null
          dtf_data_executada?: string | null
          dtf_estampado?: string | null
          dtf_executado?: string | null
          dtf_impresso?: string | null
          dtf_observacao?: string | null
          dtf_pessoas_qtd?: Json | null
          embalado?: string | null
          entrada_pedido?: string | null
          exp_cobranca_pagamento?: boolean | null
          exp_despachado?: boolean | null
          exp_despachado_em?: string | null
          exp_etiqueta?: boolean | null
          exp_frete_solicitado?: boolean | null
          exp_frete_solicitado_em?: string | null
          exp_observacoes?: string | null
          exp_pagamento?: boolean | null
          expedicao_entrou_em?: string | null
          finalizado_em?: string | null
          forma_pagamento?: string | null
          fotolito_executado?: string | null
          fotolito_impresso?: string | null
          frete?: string | null
          historico_data_entrega?: Json
          id?: string
          inicio_acabamento?: string | null
          inicio_estamparia?: string | null
          layout_url?: string | null
          n_batidas_dtf?: number | null
          n_batidas_silk?: number | null
          necessita_vetorizacao?: boolean | null
          nf_emitida?: string | null
          obs_vendedor?: string | null
          observacoes_pedido?: string | null
          orcamento?: string | null
          pecas_completadas_log?: Json
          pecas_solicitadas?: Json
          pedido_olist?: string | null
          qtd?: number | null
          quem_bateu_dtf?: string | null
          quem_bateu_silk?: string | null
          quem_cortou_dtf?: string | null
          quem_revelou_tela?: string | null
          reaberto?: boolean
          refacoes?: Json
          responsavel_acabamento?: string | null
          responsavel_conferencia?: string | null
          saida_juff?: string | null
          silk_data_executada?: string | null
          silk_feito?: string | null
          silk_observacao?: string | null
          status_arte?: string | null
          status_pecas?: string | null
          tela_gravada?: string | null
          tempo_frete?: number | null
          tempo_producao?: number | null
          termino_acabamento?: string | null
          termino_estamparia?: string | null
          tipo_estampa?: string | null
          uf_entrega?: string | null
          updated_at?: string
          vendedor?: string | null
          vetorizacao_dtf?: string | null
          vetorizacao_executada?: boolean | null
          vetorizacao_silk?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          nome?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          areas_extras: string[] | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          areas_extras?: string[] | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          areas_extras?: string[] | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_area: { Args: { _area: string; _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_member: { Args: never; Returns: boolean }
      liberar_pagamento_cop: {
        Args: { _cop_id: string; _valor: number }
        Returns: undefined
      }
      marcar_pagamento_cop: {
        Args: { _cop_id: string; _pago: boolean }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "operador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gestor", "operador"],
    },
  },
} as const
