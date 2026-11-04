CREATE TABLE IF NOT EXISTS public.plan_fichas_modelo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo text NOT NULL UNIQUE,
  tamanho_referencia text NOT NULL,
  pecas_por_folha numeric NOT NULL,
  altura_folha_m numeric NOT NULL,
  largura_tecido_m numeric NOT NULL DEFAULT 1.80,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.plan_config (
  chave text PRIMARY KEY,
  valor numeric NOT NULL,
  descricao text,
  updated_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.plan_fichas_modelo TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.plan_config TO authenticated;
GRANT ALL ON public.plan_fichas_modelo TO service_role;
GRANT ALL ON public.plan_config TO service_role;
ALTER TABLE public.plan_fichas_modelo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_config ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['plan_fichas_modelo','plan_config'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_select_team') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_team_member())', t||'_select_team', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_insert_admin') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))', t||'_insert_admin', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_update_admin') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), ''admin''::public.app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))', t||'_update_admin', t);
    END IF;
  END LOOP;
END $$;
INSERT INTO public.plan_fichas_modelo (modelo, tamanho_referencia, pecas_por_folha, altura_folha_m, largura_tecido_m) VALUES
('Camiseta','G',3,2.07,1.80),
('Baby Look','M',3,1.58,1.80),
('Regata Masculina','G',3,1.75,1.80),
('ML Masculina','G',2,1.78,1.80),
('ML Hide Masculina','G',2,2.01,1.80),
('Regata Feminina','M',3,1.53,1.80),
('ML Feminina','M',2,1.34,1.80),
('ML Hide Feminina','M',2,1.47,1.80),
('Regata Cross','M',3,1.56,1.80),
('Regata Wing','M',4,1.96,1.80),
('Regata Move','M',3,1.27,1.80),
('T-Shirt Canoa','M',3,1.33,1.80),
('Camiseta Infantil','M',3,1.33,1.80),
('ML Infantil','M',2,1.15,1.80),
('ML Hide Infantil','M',1,0.63,1.80)
ON CONFLICT (modelo) DO NOTHING;
INSERT INTO public.plan_config (chave, valor, descricao) VALUES
('gramatura_g_por_metro',250,'Gramas por metro corrido de tecido na largura padrão'),
('largura_padrao_m',1.80,'Largura de referência da gramatura acima'),
('fator_perda_encaixe',1.05,'Multiplicador aplicado sobre a altura da folha'),
('semanas_seguranca',3,'Semanas de consumo mantidas como estoque de segurança'),
('lead_time_completo_dias',65,'Dias entre pedir fio e ter a peça pronta'),
('lead_time_com_cru_dias',40,'Dias quando já existe tecido cru parado na tinturaria'),
('lote_minimo_tinturaria_kg',80,'Lote mínimo que a tinturaria aceita por cor'),
('horizonte_meses_padrao',3,'Horizonte de planejamento inicial da tela')
ON CONFLICT (chave) DO NOTHING;