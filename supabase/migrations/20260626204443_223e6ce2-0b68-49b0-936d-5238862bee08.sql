
-- ===== 1) pedidos: log de peças completadas pelo COP =====
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS pecas_completadas_log jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ===== 2) cops: conferência + pagamento + perdas (registro local opcional) =====
ALTER TABLE public.cops
  ADD COLUMN IF NOT EXISTS conferencia jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pagamento_status text NOT NULL DEFAULT 'nao_pago',
  ADD COLUMN IF NOT EXISTS pagamento_liberado_em timestamptz,
  ADD COLUMN IF NOT EXISTS pagamento_liberado_por uuid,
  ADD COLUMN IF NOT EXISTS pagamento_pago_em timestamptz,
  ADD COLUMN IF NOT EXISTS pagamento_pago_por uuid,
  ADD COLUMN IF NOT EXISTS pagamento_valor_calculado numeric(12,2),
  ADD COLUMN IF NOT EXISTS perdas jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Garante valores permitidos para o status de pagamento (validação leve)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cops_pagamento_status_chk'
  ) THEN
    ALTER TABLE public.cops
      ADD CONSTRAINT cops_pagamento_status_chk
      CHECK (pagamento_status IN ('nao_pago','liberado','pago'));
  END IF;
END$$;

-- Permitir que gestores vejam os COPs (necessário para liberar pagamento)
DROP POLICY IF EXISTS "cops_select_gestor" ON public.cops;
CREATE POLICY "cops_select_gestor" ON public.cops
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::public.app_role));

-- ===== 3) cop_perdas =====
CREATE TABLE IF NOT EXISTS public.cop_perdas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cop_id uuid REFERENCES public.cops(id) ON DELETE SET NULL,
  oficina_id uuid REFERENCES public.oficinas(id) ON DELETE SET NULL,
  etiqueta text,
  modelo text NOT NULL,
  cor text NOT NULL,
  tamanho text NOT NULL,
  qtd integer NOT NULL CHECK (qtd > 0),
  motivo text,
  registrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cop_perdas TO authenticated;
GRANT ALL ON public.cop_perdas TO service_role;

ALTER TABLE public.cop_perdas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cop_perdas_admin_all" ON public.cop_perdas;
CREATE POLICY "cop_perdas_admin_all" ON public.cop_perdas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

DROP POLICY IF EXISTS "cop_perdas_gestor_select" ON public.cop_perdas;
CREATE POLICY "cop_perdas_gestor_select" ON public.cop_perdas
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'gestor'::public.app_role));

DROP TRIGGER IF EXISTS trg_cop_perdas_updated_at ON public.cop_perdas;
CREATE TRIGGER trg_cop_perdas_updated_at
  BEFORE UPDATE ON public.cop_perdas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 4) RPCs de pagamento =====
CREATE OR REPLACE FUNCTION public.liberar_pagamento_cop(_cop_id uuid, _valor numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'gestor'::public.app_role)
       OR public.has_role(auth.uid(),'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Permissao negada: apenas gestor ou admin pode liberar pagamento.';
  END IF;

  UPDATE public.cops
     SET pagamento_status = 'liberado',
         pagamento_liberado_em = now(),
         pagamento_liberado_por = auth.uid(),
         pagamento_valor_calculado = _valor,
         status = 'Aguardando Pagamento'
   WHERE id = _cop_id;
END;
$$;

REVOKE ALL ON FUNCTION public.liberar_pagamento_cop(uuid, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.liberar_pagamento_cop(uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.marcar_pagamento_cop(_cop_id uuid, _pago boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permissao negada: apenas admin pode marcar pagamento.';
  END IF;

  IF _pago THEN
    UPDATE public.cops
       SET pagamento_status = 'pago',
           pagamento_pago_em = now(),
           pagamento_pago_por = auth.uid(),
           status = 'Finalizado'
     WHERE id = _cop_id;
  ELSE
    UPDATE public.cops
       SET pagamento_status = CASE WHEN pagamento_liberado_em IS NOT NULL THEN 'liberado' ELSE 'nao_pago' END,
           pagamento_pago_em = NULL,
           pagamento_pago_por = NULL,
           status = CASE WHEN pagamento_liberado_em IS NOT NULL THEN 'Aguardando Pagamento' ELSE status END
     WHERE id = _cop_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_pagamento_cop(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.marcar_pagamento_cop(uuid, boolean) TO authenticated;
