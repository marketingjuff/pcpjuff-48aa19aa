
CREATE TABLE IF NOT EXISTS public.pagamentos_consolidados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id uuid NOT NULL REFERENCES public.oficinas(id),
  detalhes jsonb NOT NULL DEFAULT '[]'::jsonb,
  valor_total numeric NOT NULL,
  observacao text,
  pago_por uuid NOT NULL,
  pago_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pagamentos_consolidados TO authenticated;
GRANT ALL ON public.pagamentos_consolidados TO service_role;

ALTER TABLE public.pagamentos_consolidados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pag_consolidado_select" ON public.pagamentos_consolidados
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::public.app_role)
    OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'cop'))
  );

ALTER TABLE public.cops ADD COLUMN IF NOT EXISTS pagamento_consolidado_id uuid;

CREATE OR REPLACE FUNCTION public.pagar_consolidado_oficina(
  _oficina_id uuid,
  _cop_ids uuid[],
  _observacao text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _detalhes jsonb;
  _total numeric;
  _novo_id uuid;
  _qtd int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permissao negada: apenas admin pode executar pagamento consolidado.';
  END IF;

  IF _cop_ids IS NULL OR array_length(_cop_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum COP selecionado.';
  END IF;

  SELECT count(*) INTO _qtd
    FROM public.cops
   WHERE id = ANY(_cop_ids)
     AND oficina_id = _oficina_id
     AND pagamento_status = 'liberado';

  IF _qtd <> array_length(_cop_ids, 1) THEN
    RAISE EXCEPTION 'Um ou mais COPs selecionados nao estao Liberados ou nao pertencem a esta oficina. Recarregue e tente novamente.';
  END IF;

  SELECT
    jsonb_agg(jsonb_build_object(
      'cop_id', c.id,
      'numero', c.numero,
      'letra', c.letra,
      'valor', COALESCE(c.pagamento_valor_calculado, 0)
    ) ORDER BY c.numero, c.letra),
    COALESCE(SUM(COALESCE(c.pagamento_valor_calculado, 0)), 0)
  INTO _detalhes, _total
  FROM public.cops c
  WHERE c.id = ANY(_cop_ids);

  INSERT INTO public.pagamentos_consolidados (oficina_id, detalhes, valor_total, observacao, pago_por)
  VALUES (_oficina_id, _detalhes, _total, NULLIF(upper(trim(_observacao)), ''), auth.uid())
  RETURNING id INTO _novo_id;

  UPDATE public.cops
     SET pagamento_status = 'pago',
         pagamento_pago_em = now(),
         pagamento_pago_por = auth.uid(),
         pagamento_consolidado_id = _novo_id,
         status = 'Finalizado'
   WHERE id = ANY(_cop_ids);

  RETURN _novo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pagar_consolidado_oficina(uuid, uuid[], text) FROM public;
GRANT EXECUTE ON FUNCTION public.pagar_consolidado_oficina(uuid, uuid[], text) TO authenticated;
