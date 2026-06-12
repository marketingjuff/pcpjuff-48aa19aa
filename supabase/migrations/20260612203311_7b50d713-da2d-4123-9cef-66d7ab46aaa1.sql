
-- Pedidos: novos campos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS nf_emitida boolean,
  ADD COLUMN IF NOT EXISTS expedicao_entrou_em timestamptz,
  ADD COLUMN IF NOT EXISTS exp_cobranca_pagamento boolean,
  ADD COLUMN IF NOT EXISTS exp_pagamento boolean,
  ADD COLUMN IF NOT EXISTS exp_etiqueta boolean,
  ADD COLUMN IF NOT EXISTS exp_frete_solicitado boolean,
  ADD COLUMN IF NOT EXISTS exp_despachado boolean,
  ADD COLUMN IF NOT EXISTS exp_despachado_em date,
  ADD COLUMN IF NOT EXISTS exp_observacoes text;

UPDATE public.pedidos
  SET status_geral = CASE
    WHEN lower(coalesce(status_geral,'')) = 'completo' THEN 'completo'
    ELSE 'aberto'
  END;

UPDATE public.pedidos
  SET expedicao_entrou_em = finalizado_em,
      finalizado_em = NULL
  WHERE finalizado_em IS NOT NULL
    AND expedicao_entrou_em IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pedidos_pedido_olist_unique') THEN
    ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_pedido_olist_unique UNIQUE (pedido_olist);
  END IF;
END $$;

-- app_lists: expandir check para incluir 'frete' e inserir itens padrão
ALTER TABLE public.app_lists DROP CONSTRAINT IF EXISTS app_lists_kind_check;
ALTER TABLE public.app_lists ADD CONSTRAINT app_lists_kind_check
  CHECK (kind = ANY (ARRAY['vendedor','dtf','silk','acabamento','frete']));

INSERT INTO public.app_lists (kind, nome, ordem)
SELECT 'frete', v, n
FROM (VALUES ('Carro',1),('Transportadora',2),('Correio',3),('Cliente Retira',4)) AS x(v,n)
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_lists WHERE kind='frete' AND nome=x.v
);

-- Roles: enum (admin, gestor, operador)
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text USING role::text;
UPDATE public.user_roles SET role = 'operador' WHERE role <> 'admin';
UPDATE public.user_roles SET areas_extras = '{}'::text[] WHERE role <> 'admin';
DROP TYPE IF EXISTS public.app_role;
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'operador');
ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.app_role USING role::public.app_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION public.has_area(_user_id uuid, _area text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = 'admin'::public.app_role OR _area = ANY(areas_extras))
  )
$$;
