-- Inserir domínios SEI na tabela trusted_domains
INSERT INTO public.trusted_domains (domain, category, priority, description) VALUES
  ('manuais.processoeletronico.gov.br', 'primary', 98, 'Manual oficial SEI 4.0+ (PEN/MGI)'),
  ('processoeletronico.gov.br', 'primary', 96, 'Portal federal PEN/SEI - Ministério da Gestão'),
  ('wiki.processoeletronico.gov.br', 'official_mirror', 94, 'Wiki colaborativa do Processo Eletrônico Nacional'),
  ('portalsei.rs.gov.br', 'official_mirror', 90, 'Portal SEI do Rio Grande do Sul')
ON CONFLICT (domain) DO UPDATE SET
  category = EXCLUDED.category,
  priority = EXCLUDED.priority,
  description = EXCLUDED.description;