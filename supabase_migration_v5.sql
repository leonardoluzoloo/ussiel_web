-- ===================================================================
-- MIGRAÇÃO V5: MIGRAÇÃO DA TABELA CONFIGURACOES_LOJA
-- Desfaz a coluna genérica 'valor' (JSONB) e cria colunas dedicadas e tipadas
-- Endereço Estruturado: provincia, cidade, bairro, rua, endereco, ponto_referencia
-- ===================================================================

-- 1. Cria ou atualiza as colunas dedicadas na tabela configuracoes_loja
ALTER TABLE public.configuracoes_loja 
  ADD COLUMN IF NOT EXISTS id INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nome_loja VARCHAR(255) DEFAULT 'NovaTech Angola',
  ADD COLUMN IF NOT EXISTS slogan VARCHAR(255) DEFAULT 'Loja de Tecnologia, Smartphones e Eletrônicos Premium',
  ADD COLUMN IF NOT EXISTS moeda VARCHAR(10) DEFAULT 'Kz',
  ADD COLUMN IF NOT EXISTS telefone VARCHAR(50) DEFAULT '+244 923 179 192',
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50) DEFAULT '+244 923 179 192',
  ADD COLUMN IF NOT EXISTS email VARCHAR(255) DEFAULT 'contacto@novatech.co.ao',
  ADD COLUMN IF NOT EXISTS provincia VARCHAR(100) DEFAULT 'Luanda',
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(100) DEFAULT 'Luanda',
  ADD COLUMN IF NOT EXISTS bairro VARCHAR(100) DEFAULT 'Talatona',
  ADD COLUMN IF NOT EXISTS rua VARCHAR(255) DEFAULT 'Av. Luanda Sul',
  ADD COLUMN IF NOT EXISTS endereco TEXT DEFAULT 'Talatona Shopping & Maianga, Loja 12',
  ADD COLUMN IF NOT EXISTS ponto_referencia TEXT DEFAULT 'Próximo ao Belas Shopping',
  ADD COLUMN IF NOT EXISTS horario_funcionamento VARCHAR(255) DEFAULT 'Seg - Sáb: 08:30 às 19:30 | Dom: 10:00 às 16:00',
  ADD COLUMN IF NOT EXISTS tarifa_entrega_padrao NUMERIC(15, 2) DEFAULT 3500.00,
  ADD COLUMN IF NOT EXISTS tarifa_entrega_expresso NUMERIC(15, 2) DEFAULT 6500.00,
  ADD COLUMN IF NOT EXISTS limite_frete_gratis NUMERIC(15, 2) DEFAULT 1000000.00,
  ADD COLUMN IF NOT EXISTS titular_conta_bancaria VARCHAR(255) DEFAULT 'NovaTech Comércio & Serviços, Lda',
  ADD COLUMN IF NOT EXISTS banco_principal VARCHAR(255) DEFAULT 'Banco Angolano de Investimentos (BAI)',
  ADD COLUMN IF NOT EXISTS iban_oficial VARCHAR(100) DEFAULT 'AO06 0040 0000 1234 5678 9012 3',
  ADD COLUMN IF NOT EXISTS telefone_multicaixa_express VARCHAR(50) DEFAULT '+244 923 179 192',
  ADD COLUMN IF NOT EXISTS permitir_pedidos_sem_estoque BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS politica_entrega TEXT,
  ADD COLUMN IF NOT EXISTS politica_devolucao TEXT,
  ADD COLUMN IF NOT EXISTS politica_termos TEXT;

-- 2. Migra os dados legados existentes dentro da coluna 'valor' (caso existam)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'configuracoes_loja' 
      AND column_name = 'valor'
  ) THEN
    UPDATE public.configuracoes_loja
    SET
      nome_loja = COALESCE((valor->>'store_name'), (valor->>'nome_loja'), nome_loja),
      slogan = COALESCE((valor->>'slogan'), slogan),
      moeda = COALESCE((valor->>'currency'), (valor->>'moeda'), moeda),
      telefone = COALESCE((valor->>'phone'), (valor->>'telefone'), telefone),
      whatsapp = COALESCE((valor->>'whatsapp'), whatsapp),
      email = COALESCE((valor->>'email'), email),
      provincia = COALESCE((valor->>'provincia'), (valor->>'province'), provincia),
      cidade = COALESCE((valor->>'cidade'), (valor->>'city'), cidade),
      bairro = COALESCE((valor->>'bairro'), (valor->>'neighborhood'), bairro),
      rua = COALESCE((valor->>'rua'), (valor->>'street'), rua),
      endereco = COALESCE((valor->>'address'), (valor->>'endereco'), endereco),
      ponto_referencia = COALESCE((valor->>'ponto_referencia'), (valor->>'reference'), ponto_referencia),
      horario_funcionamento = COALESCE((valor->>'opening_hours'), (valor->>'horario_funcionamento'), horario_funcionamento),
      tarifa_entrega_padrao = COALESCE((valor->>'shipping_price_normal')::numeric, (valor->>'tarifa_entrega_padrao')::numeric, tarifa_entrega_padrao),
      tarifa_entrega_expresso = COALESCE((valor->>'shipping_price_express')::numeric, (valor->>'tarifa_entrega_expresso')::numeric, tarifa_entrega_expresso),
      limite_frete_gratis = COALESCE((valor->>'free_shipping_threshold')::numeric, (valor->>'limite_frete_gratis')::numeric, limite_frete_gratis),
      titular_conta_bancaria = COALESCE((valor->>'bank_holder'), (valor->>'titular_conta_bancaria'), titular_conta_bancaria),
      banco_principal = COALESCE((valor->>'bank_name'), (valor->>'banco_principal'), banco_principal),
      iban_oficial = COALESCE((valor->>'bank_iban'), (valor->>'iban_oficial'), iban_oficial),
      telefone_multicaixa_express = COALESCE((valor->>'mcx_phone'), (valor->>'telefone_multicaixa_express'), telefone_multicaixa_express),
      permitir_pedidos_sem_estoque = COALESCE((valor->>'allow_out_of_stock_orders')::boolean, (valor->>'permitir_pedidos_sem_estoque')::boolean, permitir_pedidos_sem_estoque),
      politica_entrega = COALESCE((valor->>'delivery_policy'), (valor->>'politica_entrega'), politica_entrega),
      politica_devolucao = COALESCE((valor->>'return_policy'), (valor->>'politica_devolucao'), politica_devolucao),
      politica_termos = COALESCE((valor->>'terms_policy'), (valor->>'politica_termos'), politica_termos)
    WHERE valor IS NOT NULL;

    -- Remove a coluna legada 'valor'
    ALTER TABLE public.configuracoes_loja DROP COLUMN valor;
  END IF;
END $$;

-- 3. Garante o registro inicial com chave 'general'
INSERT INTO public.configuracoes_loja (
  id, chave, nome_loja, slogan, moeda, telefone, whatsapp, email,
  provincia, cidade, bairro, rua, endereco, ponto_referencia,
  horario_funcionamento, tarifa_entrega_padrao, tarifa_entrega_expresso,
  limite_frete_gratis, titular_conta_bancaria, banco_principal, iban_oficial,
  telefone_multicaixa_express, permitir_pedidos_sem_estoque
) VALUES (
  1, 'general', 'NovaTech Angola', 'Loja de Tecnologia, Smartphones e Eletrônicos Premium', 'Kz',
  '+244 923 179 192', '+244 923 179 192', 'contacto@novatech.co.ao',
  'Luanda', 'Luanda', 'Talatona', 'Av. Luanda Sul', 'Talatona Shopping & Maianga, Loja 12', 'Próximo ao Belas Shopping',
  'Seg - Sáb: 08:30 às 19:30 | Dom: 10:00 às 16:00',
  3500.00, 6500.00, 1000000.00, 'NovaTech Comércio & Serviços, Lda',
  'Banco Angolano de Investimentos (BAI)', 'AO06 0040 0000 1234 5678 9012 3',
  '+244 923 179 192', FALSE
) ON CONFLICT (chave) DO NOTHING;

-- 4. Permissões de RLS
ALTER TABLE public.configuracoes_loja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica configuracoes" ON public.configuracoes_loja;
CREATE POLICY "Leitura publica configuracoes" ON public.configuracoes_loja FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin gerencia configuracoes" ON public.configuracoes_loja;
CREATE POLICY "Admin gerencia configuracoes" ON public.configuracoes_loja FOR ALL USING (true) WITH CHECK (true);
