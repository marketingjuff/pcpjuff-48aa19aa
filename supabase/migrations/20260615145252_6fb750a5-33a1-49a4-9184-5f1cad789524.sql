
ALTER TABLE public.pedidos ADD COLUMN reaberto boolean NOT NULL DEFAULT false;

UPDATE public.pedidos SET reaberto = true WHERE status_geral = 'reaberto';

ALTER TABLE public.pedidos RENAME COLUMN status_geral TO status_pecas;

UPDATE public.pedidos SET status_pecas = 'incompleto'
WHERE status_pecas IN ('aberto', 'reaberto') OR status_pecas IS NULL;

UPDATE public.pedidos SET status_pecas = 'completo' WHERE status_pecas = 'completo';
