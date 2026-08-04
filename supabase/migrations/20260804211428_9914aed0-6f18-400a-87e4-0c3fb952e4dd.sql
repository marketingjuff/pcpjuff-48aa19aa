ALTER TABLE public.sup_pedidos_compra
  ADD COLUMN IF NOT EXISTS status_pre_cancelamento text;