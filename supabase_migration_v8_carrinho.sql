-- ===================================================================
-- NOVATECH ANGOLA • MIGRAÇÃO V8: SINCRONIZAÇÃO EM NUVEM DO CARRINHO
-- 100% EM PORTUGUÊS • PADRÃO ENTERPRISE PARA SUPABASE / POSTGRESQL
--
-- Objetivos:
-- 1. Criação da tabela oficial public.carrinho_itens vinculada aos clientes.
-- 2. Suporte a sincronização em nuvem e persistência multi-dispositivo (PC, Celular, Tablet).
-- 3. Políticas de Row Level Security (RLS) blindadas (por auth_user_id ou email).
-- 4. Constraint de unicidade para (usuario_id, variante_chave) garantindo upsert atômico.
-- 5. Trigger automático de atualização de atualizado_em.
-- 6. Grants de permissão de acesso controlados para a role authenticated.
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.carrinho_itens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  produto_id BIGINT NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  variante_chave VARCHAR(255) NOT NULL,
  quantidade INT DEFAULT 1 NOT NULL CHECK (quantidade > 0),
  preco NUMERIC(15, 2) NOT NULL,
  nome VARCHAR(255),
  imagem TEXT,
  sku VARCHAR(100),
  variante JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_carrinho_usuario_variante UNIQUE (usuario_id, variante_chave)
);

-- Índices de alta performance para consultas e joins rápidos
CREATE INDEX IF NOT EXISTS idx_carrinho_usuario ON public.carrinho_itens(usuario_id);
CREATE INDEX IF NOT EXISTS idx_carrinho_produto ON public.carrinho_itens(produto_id);
CREATE INDEX IF NOT EXISTS idx_carrinho_usuario_variante ON public.carrinho_itens(usuario_id, variante_chave);

-- Trigger para atualização automática do campo atualizado_em
CREATE OR REPLACE FUNCTION public.atualizar_carrinho_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_carrinho_atualizado_em ON public.carrinho_itens;
CREATE TRIGGER trigger_carrinho_atualizado_em
BEFORE UPDATE ON public.carrinho_itens
FOR EACH ROW EXECUTE FUNCTION public.atualizar_carrinho_atualizado_em();

-- Ativação do Row Level Security
ALTER TABLE public.carrinho_itens ENABLE ROW LEVEL SECURITY;

-- Grants de permissão regulados pelo RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carrinho_itens TO authenticated;
GRANT SELECT ON public.carrinho_itens TO anon;

-- Políticas de RLS: O cliente acessa exclusivamente o próprio carrinho (por auth_user_id ou email)
DROP POLICY IF EXISTS "Usuarios leem proprio carrinho" ON public.carrinho_itens;
CREATE POLICY "Usuarios leem proprio carrinho" ON public.carrinho_itens
FOR SELECT USING (
  public.is_admin() OR 
  usuario_id IN (
    SELECT id FROM public.usuarios 
    WHERE auth_user_id = auth.uid() 
       OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
  )
);

DROP POLICY IF EXISTS "Usuarios inserem proprio carrinho" ON public.carrinho_itens;
CREATE POLICY "Usuarios inserem proprio carrinho" ON public.carrinho_itens
FOR INSERT WITH CHECK (
  public.is_admin() OR 
  usuario_id IN (
    SELECT id FROM public.usuarios 
    WHERE auth_user_id = auth.uid() 
       OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
  )
);

DROP POLICY IF EXISTS "Usuarios atualizam proprio carrinho" ON public.carrinho_itens;
CREATE POLICY "Usuarios atualizam proprio carrinho" ON public.carrinho_itens
FOR UPDATE USING (
  public.is_admin() OR 
  usuario_id IN (
    SELECT id FROM public.usuarios 
    WHERE auth_user_id = auth.uid() 
       OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
  )
) WITH CHECK (
  public.is_admin() OR 
  usuario_id IN (
    SELECT id FROM public.usuarios 
    WHERE auth_user_id = auth.uid() 
       OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
  )
);

DROP POLICY IF EXISTS "Usuarios removem proprio carrinho" ON public.carrinho_itens;
CREATE POLICY "Usuarios removem proprio carrinho" ON public.carrinho_itens
FOR DELETE USING (
  public.is_admin() OR 
  usuario_id IN (
    SELECT id FROM public.usuarios 
    WHERE auth_user_id = auth.uid() 
       OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
  )
);
