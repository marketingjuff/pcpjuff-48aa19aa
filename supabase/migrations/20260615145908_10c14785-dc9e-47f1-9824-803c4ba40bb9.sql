
ALTER TABLE public.app_lists DROP CONSTRAINT app_lists_kind_check;
ALTER TABLE public.app_lists ADD CONSTRAINT app_lists_kind_check
  CHECK (kind = ANY (ARRAY['vendedor','dtf','silk','acabamento','frete','pagamento','nf']));

ALTER TABLE public.pedidos
  ALTER COLUMN nf_emitida TYPE text USING (
    CASE WHEN nf_emitida IS TRUE THEN 'Sim'
         WHEN nf_emitida IS FALSE THEN 'Não'
         ELSE NULL END
  );

INSERT INTO public.app_lists (kind, nome, ordem) VALUES
  ('pagamento', 'Cartão de crédito', 10),
  ('pagamento', '50%/50%', 20),
  ('pagamento', 'Boleto', 30),
  ('pagamento', 'À vista', 40),
  ('nf', 'Sim', 10),
  ('nf', 'Não', 20),
  ('nf', 'Não se aplica', 30)
ON CONFLICT (kind, nome) DO NOTHING;

ALTER TABLE public.pedidos
  ADD COLUMN data_entrega_proposta date,
  ADD COLUMN data_entrega_proposta_em timestamptz,
  ADD COLUMN data_entrega_proposta_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;
