CREATE OR REPLACE FUNCTION public.marcar_pagamento_cop(_cop_id uuid, _pago boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::public.app_role)
       OR (public.has_role(auth.uid(),'gestor'::public.app_role) AND public.has_area(auth.uid(),'cop'))) THEN
    RAISE EXCEPTION 'Permissao negada: apenas admin ou gestor com acesso COP pode marcar pagamento.';
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
$function$;