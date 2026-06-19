CREATE TABLE public.app_color_settings (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.app_color_settings TO authenticated;
GRANT INSERT, UPDATE ON public.app_color_settings TO authenticated;
GRANT ALL ON public.app_color_settings TO service_role;

ALTER TABLE public.app_color_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth can read color settings"
  ON public.app_color_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "admin can insert color settings"
  ON public.app_color_settings FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin can update color settings"
  ON public.app_color_settings FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_app_color_settings_updated_at
  BEFORE UPDATE ON public.app_color_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_color_settings (id, data) VALUES ('global', '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;