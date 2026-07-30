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
      cop_audit_log: {
        Row: {
          acao: string
          feito_em: string
          feito_por: string | null
          feito_por_email: string | null
          feito_por_nome: string | null
          id: string
          identificador: string | null
          linha_completa: Json | null
          mudancas: Json | null
          registro_id: string
          tabela: string
        }
        Insert: {
          acao: string
          feito_em?: string
          feito_por?: string | null
          feito_por_email?: string | null
          feito_por_nome?: string | null
          id?: string
          identificador?: string | null
          linha_completa?: Json | null
          mudancas?: Json | null
          registro_id: string
          tabela: string
        }
        Update: {
          acao?: string
          feito_em?: string
          feito_por?: string | null
          feito_por_email?: string | null
          feito_por_nome?: string | null
          id?: string
          identificador?: string | null
          linha_completa?: Json | null
          mudancas?: Json | null
          registro_id?: string
          tabela?: string
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
          corte_em_correcao: boolean
          created_at: string
          created_by: string | null
          data_recebimento: string | null
          data_saida_oficina: string | null
          execucao_corte: string | null
          execucao_risco: string | null
          historico_perdas: Json
          historico_recebimentos: Json
          id: string
          letra: string | null
          num_fretes: number
          numero: number
          observacoes_corte: string | null
          observacoes_pagamento: string | null
          observacoes_romaneio: string | null
          oficina_id: string | null
          pagamento_consolidado_id: string | null
          pagamento_liberado_em: string | null
          pagamento_liberado_por: string | null
          pagamento_pago_em: string | null
          pagamento_pago_por: string | null
          pagamento_status: string
          pagamento_valor_calculado: number | null
          pecas: Json
          pecas_recebidas: Json
          perdas: Json
          refacao_perda_itens: Json
          refacao_perda_origem_id: string | null
          romaneio_enviado_em: string | null
          solicitacao_corte: string | null
          solicitacao_risco: string | null
          status: string
          updated_at: string
          updated_by: string | null
          urgencias: Json
        }
        Insert: {
          conferencia?: Json
          conferido_em?: string | null
          conferido_por?: string | null
          cop_pai_id?: string | null
          cop_romaneio_pai_id?: string | null
          corte_dividido?: boolean
          corte_em_correcao?: boolean
          created_at?: string
          created_by?: string | null
          data_recebimento?: string | null
          data_saida_oficina?: string | null
          execucao_corte?: string | null
          execucao_risco?: string | null
          historico_perdas?: Json
          historico_recebimentos?: Json
          id?: string
          letra?: string | null
          num_fretes?: number
          numero?: number
          observacoes_corte?: string | null
          observacoes_pagamento?: string | null
          observacoes_romaneio?: string | null
          oficina_id?: string | null
          pagamento_consolidado_id?: string | null
          pagamento_liberado_em?: string | null
          pagamento_liberado_por?: string | null
          pagamento_pago_em?: string | null
          pagamento_pago_por?: string | null
          pagamento_status?: string
          pagamento_valor_calculado?: number | null
          pecas?: Json
          pecas_recebidas?: Json
          perdas?: Json
          refacao_perda_itens?: Json
          refacao_perda_origem_id?: string | null
          romaneio_enviado_em?: string | null
          solicitacao_corte?: string | null
          solicitacao_risco?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          urgencias?: Json
        }
        Update: {
          conferencia?: Json
          conferido_em?: string | null
          conferido_por?: string | null
          cop_pai_id?: string | null
          cop_romaneio_pai_id?: string | null
          corte_dividido?: boolean
          corte_em_correcao?: boolean
          created_at?: string
          created_by?: string | null
          data_recebimento?: string | null
          data_saida_oficina?: string | null
          execucao_corte?: string | null
          execucao_risco?: string | null
          historico_perdas?: Json
          historico_recebimentos?: Json
          id?: string
          letra?: string | null
          num_fretes?: number
          numero?: number
          observacoes_corte?: string | null
          observacoes_pagamento?: string | null
          observacoes_romaneio?: string | null
          oficina_id?: string | null
          pagamento_consolidado_id?: string | null
          pagamento_liberado_em?: string | null
          pagamento_liberado_por?: string | null
          pagamento_pago_em?: string | null
          pagamento_pago_por?: string | null
          pagamento_status?: string
          pagamento_valor_calculado?: number | null
          pecas?: Json
          pecas_recebidas?: Json
          perdas?: Json
          refacao_perda_itens?: Json
          refacao_perda_origem_id?: string | null
          romaneio_enviado_em?: string | null
          solicitacao_corte?: string | null
          solicitacao_risco?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          urgencias?: Json
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
          {
            foreignKeyName: "cops_refacao_perda_origem_id_fkey"
            columns: ["refacao_perda_origem_id"]
            isOneToOne: false
            referencedRelation: "cops"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_olist_itens: {
        Row: {
          cor: string
          empresa: string
          id: string
          produto_olist: string
          qtd: number
          snapshot_id: string
          tamanho: string
        }
        Insert: {
          cor: string
          empresa: string
          id?: string
          produto_olist: string
          qtd?: number
          snapshot_id: string
          tamanho: string
        }
        Update: {
          cor?: string
          empresa?: string
          id?: string
          produto_olist?: string
          qtd?: number
          snapshot_id?: string
          tamanho?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_olist_itens_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "estoque_olist_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_olist_snapshots: {
        Row: {
          arquivo_nome: string | null
          empresa: string
          id: string
          importado_em: string
          importado_por: string | null
          linhas_ignoradas: Json
          total_linhas: number
        }
        Insert: {
          arquivo_nome?: string | null
          empresa: string
          id?: string
          importado_em?: string
          importado_por?: string | null
          linhas_ignoradas?: Json
          total_linhas?: number
        }
        Update: {
          arquivo_nome?: string | null
          empresa?: string
          id?: string
          importado_em?: string
          importado_por?: string | null
          linhas_ignoradas?: Json
          total_linhas?: number
        }
        Relationships: []
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
      map_audit_log: {
        Row: {
          acao: string
          feito_em: string
          feito_por: string | null
          feito_por_email: string | null
          feito_por_nome: string | null
          id: string
          identificador: string | null
          linha_completa: Json | null
          mudancas: Json | null
          registro_id: string
          tabela: string
        }
        Insert: {
          acao: string
          feito_em?: string
          feito_por?: string | null
          feito_por_email?: string | null
          feito_por_nome?: string | null
          id?: string
          identificador?: string | null
          linha_completa?: Json | null
          mudancas?: Json | null
          registro_id: string
          tabela: string
        }
        Update: {
          acao?: string
          feito_em?: string
          feito_por?: string | null
          feito_por_email?: string | null
          feito_por_nome?: string | null
          id?: string
          identificador?: string | null
          linha_completa?: Json | null
          mudancas?: Json | null
          registro_id?: string
          tabela?: string
        }
        Relationships: []
      }
      map_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      map_devolucoes: {
        Row: {
          cor: string
          created_at: string
          created_by: string | null
          data_devolucao: string
          faturado_para: string
          finalizada_em: string | null
          finalizada_por: string | null
          id: string
          kg: number
          nota_fiscal: string
          obs: string | null
          pecas: number
          producao_id: string
          status: string
        }
        Insert: {
          cor: string
          created_at?: string
          created_by?: string | null
          data_devolucao?: string
          faturado_para: string
          finalizada_em?: string | null
          finalizada_por?: string | null
          id?: string
          kg: number
          nota_fiscal: string
          obs?: string | null
          pecas: number
          producao_id: string
          status?: string
        }
        Update: {
          cor?: string
          created_at?: string
          created_by?: string | null
          data_devolucao?: string
          faturado_para?: string
          finalizada_em?: string | null
          finalizada_por?: string | null
          id?: string
          kg?: number
          nota_fiscal?: string
          obs?: string | null
          pecas?: number
          producao_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_devolucoes_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: false
            referencedRelation: "map_producoes"
            referencedColumns: ["id"]
          },
        ]
      }
      map_estoque_pecas: {
        Row: {
          alt_inicial: number | null
          cor: string | null
          cor_nova: string | null
          correcao_status: string | null
          correcao_tipo: string | null
          cortes: Json
          created_at: string
          data_abertura: string | null
          data_entrada: string | null
          devolucao_data: string | null
          devolucao_motivo: string | null
          devolucao_nf: string | null
          historico_correcoes: Json
          id: string
          larg: number | null
          ne: number | null
          nota_fiscal: string | null
          numero_peca: string | null
          producao_id: string
          programacao_id: string
          status: string
          updated_at: string
        }
        Insert: {
          alt_inicial?: number | null
          cor?: string | null
          cor_nova?: string | null
          correcao_status?: string | null
          correcao_tipo?: string | null
          cortes?: Json
          created_at?: string
          data_abertura?: string | null
          data_entrada?: string | null
          devolucao_data?: string | null
          devolucao_motivo?: string | null
          devolucao_nf?: string | null
          historico_correcoes?: Json
          id?: string
          larg?: number | null
          ne?: number | null
          nota_fiscal?: string | null
          numero_peca?: string | null
          producao_id: string
          programacao_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          alt_inicial?: number | null
          cor?: string | null
          cor_nova?: string | null
          correcao_status?: string | null
          correcao_tipo?: string | null
          cortes?: Json
          created_at?: string
          data_abertura?: string | null
          data_entrada?: string | null
          devolucao_data?: string | null
          devolucao_motivo?: string | null
          devolucao_nf?: string | null
          historico_correcoes?: Json
          id?: string
          larg?: number | null
          ne?: number | null
          nota_fiscal?: string | null
          numero_peca?: string | null
          producao_id?: string
          programacao_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_estoque_pecas_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: false
            referencedRelation: "map_producoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_estoque_pecas_programacao_id_fkey"
            columns: ["programacao_id"]
            isOneToOne: false
            referencedRelation: "map_tinturaria_programacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      map_malharia_entregas: {
        Row: {
          created_at: string
          data_recebimento: string | null
          id: string
          kg: number | null
          nota_cobertura: string | null
          nota_fiscal_1: string | null
          nota_fiscal_2: string | null
          pecas: number | null
          producao_id: string
        }
        Insert: {
          created_at?: string
          data_recebimento?: string | null
          id?: string
          kg?: number | null
          nota_cobertura?: string | null
          nota_fiscal_1?: string | null
          nota_fiscal_2?: string | null
          pecas?: number | null
          producao_id: string
        }
        Update: {
          created_at?: string
          data_recebimento?: string | null
          id?: string
          kg?: number | null
          nota_cobertura?: string | null
          nota_fiscal_1?: string | null
          nota_fiscal_2?: string | null
          pecas?: number | null
          producao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_malharia_entregas_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: false
            referencedRelation: "map_producoes"
            referencedColumns: ["id"]
          },
        ]
      }
      map_producoes: {
        Row: {
          created_at: string
          data_faturamento: string | null
          data_pagamento: string | null
          data_pedido: string
          faturar_para: string
          finalizado: boolean
          finalizado_em: string | null
          finalizado_por: string | null
          fornecedor: string
          id: string
          kg_solicitados: number
          malharia: string | null
          nota_fiscal: string | null
          numero: number
          observacoes: string | null
          quebra_conciliacao_obs: string | null
          quebra_conciliada: boolean
          quebra_conciliada_em: string | null
          quebra_conciliada_por: string | null
          status: string
          status_malharia: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_faturamento?: string | null
          data_pagamento?: string | null
          data_pedido: string
          faturar_para: string
          finalizado?: boolean
          finalizado_em?: string | null
          finalizado_por?: string | null
          fornecedor: string
          id?: string
          kg_solicitados: number
          malharia?: string | null
          nota_fiscal?: string | null
          numero: number
          observacoes?: string | null
          quebra_conciliacao_obs?: string | null
          quebra_conciliada?: boolean
          quebra_conciliada_em?: string | null
          quebra_conciliada_por?: string | null
          status?: string
          status_malharia?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_faturamento?: string | null
          data_pagamento?: string | null
          data_pedido?: string
          faturar_para?: string
          finalizado?: boolean
          finalizado_em?: string | null
          finalizado_por?: string | null
          fornecedor?: string
          id?: string
          kg_solicitados?: number
          malharia?: string | null
          nota_fiscal?: string | null
          numero?: number
          observacoes?: string | null
          quebra_conciliacao_obs?: string | null
          quebra_conciliada?: boolean
          quebra_conciliada_em?: string | null
          quebra_conciliada_por?: string | null
          status?: string
          status_malharia?: string
          updated_at?: string
        }
        Relationships: []
      }
      map_tinturaria_programacoes: {
        Row: {
          cor: string | null
          created_at: string
          data_programacao: string | null
          data_recebimento: string | null
          id: string
          kg_enviados: number | null
          kg_recebidos: number | null
          nota_cobertura: string | null
          nota_fiscal_recebimento: string | null
          pecas: number | null
          pecas_recebidas: number | null
          producao_id: string
          retingir_origem_id: string | null
          tinturaria: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          data_programacao?: string | null
          data_recebimento?: string | null
          id?: string
          kg_enviados?: number | null
          kg_recebidos?: number | null
          nota_cobertura?: string | null
          nota_fiscal_recebimento?: string | null
          pecas?: number | null
          pecas_recebidas?: number | null
          producao_id: string
          retingir_origem_id?: string | null
          tinturaria: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          data_programacao?: string | null
          data_recebimento?: string | null
          id?: string
          kg_enviados?: number | null
          kg_recebidos?: number | null
          nota_cobertura?: string | null
          nota_fiscal_recebimento?: string | null
          pecas?: number | null
          pecas_recebidas?: number | null
          producao_id?: string
          retingir_origem_id?: string | null
          tinturaria?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_tinturaria_programacoes_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: false
            referencedRelation: "map_producoes"
            referencedColumns: ["id"]
          },
        ]
      }
      oficinas: {
        Row: {
          cep: string | null
          cnpj: string | null
          cnpj_cpf: string | null
          cpf: string | null
          created_at: string
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
          valor_frete: number
          valores_por_modelo: Json
        }
        Insert: {
          cep?: string | null
          cnpj?: string | null
          cnpj_cpf?: string | null
          cpf?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          valor_frete?: number
          valores_por_modelo?: Json
        }
        Update: {
          cep?: string | null
          cnpj?: string | null
          cnpj_cpf?: string | null
          cpf?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          valor_frete?: number
          valores_por_modelo?: Json
        }
        Relationships: []
      }
      olist_produto_map: {
        Row: {
          criado_em: string
          criado_por: string | null
          id: string
          modelo_cop: string
          produto_olist: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          id?: string
          modelo_cop: string
          produto_olist: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          id?: string
          modelo_cop?: string
          produto_olist?: string
        }
        Relationships: []
      }
      pagamentos_consolidados: {
        Row: {
          created_at: string
          detalhes: Json
          id: string
          observacao: string | null
          oficina_id: string
          pago_em: string
          pago_por: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          detalhes?: Json
          id?: string
          observacao?: string | null
          oficina_id: string
          pago_em?: string
          pago_por: string
          valor_total: number
        }
        Update: {
          created_at?: string
          detalhes?: Json
          id?: string
          observacao?: string | null
          oficina_id?: string
          pago_em?: string
          pago_por?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_consolidados_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_audit_log: {
        Row: {
          acao: string
          feito_em: string
          feito_por: string | null
          feito_por_email: string | null
          feito_por_nome: string | null
          id: string
          linha_completa: Json | null
          mudancas: Json | null
          orcamento: string | null
          pedido_id: string
          pedido_olist: string | null
        }
        Insert: {
          acao: string
          feito_em?: string
          feito_por?: string | null
          feito_por_email?: string | null
          feito_por_nome?: string | null
          id?: string
          linha_completa?: Json | null
          mudancas?: Json | null
          orcamento?: string | null
          pedido_id: string
          pedido_olist?: string | null
        }
        Update: {
          acao?: string
          feito_em?: string
          feito_por?: string | null
          feito_por_email?: string | null
          feito_por_nome?: string | null
          id?: string
          linha_completa?: Json | null
          mudancas?: Json | null
          orcamento?: string | null
          pedido_id?: string
          pedido_olist?: string | null
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          acabamento_data: string | null
          acabamento_observacao: string | null
          arte_data: string | null
          arte_observacao: string | null
          arte_warning: boolean
          correcoes_etapa: Json
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
          pecas_lisas: boolean
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
          arte_warning?: boolean
          correcoes_etapa?: Json
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
          pecas_lisas?: boolean
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
          arte_warning?: boolean
          correcoes_etapa?: Json
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
          pecas_lisas?: boolean
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
      perdas_manuais: {
        Row: {
          berco: string | null
          cor: string
          created_at: string
          data: string
          destino: string | null
          id: string
          modelo: string
          motivo: string | null
          observacoes: string | null
          oficina_id: string | null
          qtd: number
          registrado_por: string | null
          responsavel: string | null
          tamanho: string
          updated_at: string
        }
        Insert: {
          berco?: string | null
          cor: string
          created_at?: string
          data?: string
          destino?: string | null
          id?: string
          modelo: string
          motivo?: string | null
          observacoes?: string | null
          oficina_id?: string | null
          qtd: number
          registrado_por?: string | null
          responsavel?: string | null
          tamanho: string
          updated_at?: string
        }
        Update: {
          berco?: string | null
          cor?: string
          created_at?: string
          data?: string
          destino?: string | null
          id?: string
          modelo?: string
          motivo?: string | null
          observacoes?: string | null
          oficina_id?: string | null
          qtd?: number
          registrado_por?: string | null
          responsavel?: string | null
          tamanho?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perdas_manuais_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      perdas_reclassificacoes: {
        Row: {
          area_erro_original: string | null
          berco: string | null
          cor: string
          created_at: string
          destino: string | null
          id: string
          modelo: string
          motivo_novo: string
          motivo_original: string | null
          observacao: string
          oficina_id: string | null
          pedido_id: string
          qtd: number
          refacao_data: string
          refacao_idx: number
          tamanho: string
          usuario_id: string | null
        }
        Insert: {
          area_erro_original?: string | null
          berco?: string | null
          cor: string
          created_at?: string
          destino?: string | null
          id?: string
          modelo: string
          motivo_novo: string
          motivo_original?: string | null
          observacao: string
          oficina_id?: string | null
          pedido_id: string
          qtd: number
          refacao_data: string
          refacao_idx: number
          tamanho: string
          usuario_id?: string | null
        }
        Update: {
          area_erro_original?: string | null
          berco?: string | null
          cor?: string
          created_at?: string
          destino?: string | null
          id?: string
          modelo?: string
          motivo_novo?: string
          motivo_original?: string | null
          observacao?: string
          oficina_id?: string | null
          pedido_id?: string
          qtd?: number
          refacao_data?: string
          refacao_idx?: number
          tamanho?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perdas_reclassificacoes_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
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
      pagar_consolidado_oficina: {
        Args: { _cop_ids: string[]; _observacao: string; _oficina_id: string }
        Returns: string
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
