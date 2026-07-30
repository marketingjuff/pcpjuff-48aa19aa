INSERT INTO public.olist_produto_map (produto_olist, modelo_cop) VALUES
  ('Regata Masculina ThermoAir', 'Regata Masculina'),
  ('Regata Masculina ThermoAir XTRA', 'Regata Masculina'),
  ('Juff Store - Regata Masculina ThermoAir', 'Regata Masculina'),
  ('Regata Feminina ThermoAir XTRA', 'Regata Feminina'),
  ('Juff Store - Regata Feminina ThermoAir', 'Regata Feminina'),
  ('Juff Store - Camiseta ThermoAir', 'Camiseta'),
  ('Juff Store - Camiseta Infantil ThermoAir', 'Camiseta Infantil'),
  ('Juff Store - Manga Longa Feminina ThermoAir', 'ML Feminina')
ON CONFLICT DO NOTHING;