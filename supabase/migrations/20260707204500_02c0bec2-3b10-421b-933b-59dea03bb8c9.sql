CREATE TABLE public.map_estoque_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programacao_id uuid NOT NULL REFERENCES public.map_tinturaria_programacoes(id),
  producao_id uuid NOT NULL REFERENCES public.map_producoes(id),
  nota_fiscal text,
  cor text,
  data_entrada date,
  numero_peca text,
  status text NOT NULL DEFAULT 'Fechada'
    CHECK (status IN ('Fechada','Aberta','Corte','Devolvida','100% utilizada')),
  data_abertura date,
  alt_inicial numeric,
  cortes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_estoque_pecas TO authenticated;
GRANT ALL ON public.map_estoque_pecas TO service_role;

ALTER TABLE public.map_estoque_pecas ENABLE ROW LEVEL SECURITY;

CREATE POLICY map_select ON public.map_estoque_pecas FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_area(auth.uid(), 'map'::text));
CREATE POLICY map_insert ON public.map_estoque_pecas FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_area(auth.uid(), 'map'::text));
CREATE POLICY map_update ON public.map_estoque_pecas FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_area(auth.uid(), 'map'::text))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_area(auth.uid(), 'map'::text));
CREATE POLICY map_delete ON public.map_estoque_pecas FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_area(auth.uid(), 'map'::text));

CREATE TRIGGER update_map_estoque_pecas_updated_at
  BEFORE UPDATE ON public.map_estoque_pecas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX map_estoque_pecas_programacao_id_idx ON public.map_estoque_pecas(programacao_id);
CREATE INDEX map_estoque_pecas_producao_id_idx ON public.map_estoque_pecas(producao_id);