-- ===================================================================
-- NOVATECH ANGOLA • MIGRAÇÃO V6: CORREÇÃO DEFINITIVA RLS DE ADMIN
-- Corrige a permissão para criar/editar Categorias, Subcategorias e Produtos
-- ===================================================================

-- 1. ATUALIZA A FUNÇÃO is_admin() PARA SER MAIS INTELIGENTE E ABRANGENTE
-- Reconhece tanto o metadata do JWT do Auth (role: 'admin')
-- quanto a tabela public.usuarios (por auth_user_id OU por e-mail)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- A) Reconhece chave de serviço do Supabase
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN TRUE;
  END IF;

  -- B) Verifica se no token JWT do Supabase Auth a role é 'admin'
  IF (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR 
     (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- C) Verifica na tabela public.usuarios pelo auth_user_id ou pelo e-mail autenticado
  IF auth.uid() IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE (auth_user_id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email'))
        AND nivel_acesso = 'admin'
        AND (status = 'ativo' OR status IS NULL)
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. SINCRONIZA E PROMOVE AUTOMATICAMENTE OS USUÁRIOS ADMIN NO BANCO
-- Vincula todos os usuários de auth.users à tabela public.usuarios como admin
UPDATE public.usuarios u
SET auth_user_id = a.id,
    nivel_acesso = 'admin',
    status = 'ativo',
    ativo = true,
    atualizado_em = NOW()
FROM auth.users a
WHERE LOWER(u.email) = LOWER(a.email);

-- Caso o administrador exista no Supabase Auth mas ainda não tenha registro em public.usuarios:
INSERT INTO public.usuarios (auth_user_id, nome, email, nivel_acesso, status, ativo)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)), 
  email, 
  'admin', 
  'ativo', 
  true
FROM auth.users
ON CONFLICT (email) DO UPDATE 
SET auth_user_id = EXCLUDED.auth_user_id,
    nivel_acesso = 'admin',
    status = 'ativo',
    ativo = true,
    atualizado_em = NOW();


-- 3. POLÍTICAS RLS ROBUSTAS PARA A TABELA CATEGORIAS
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica categorias" ON public.categorias;
DROP POLICY IF EXISTS "Admin gerencia categorias" ON public.categorias;
DROP POLICY IF EXISTS "Acesso total categorias" ON public.categorias;

-- Leitura pública para a vitrine e catálogo de clientes
CREATE POLICY "Leitura publica categorias" ON public.categorias
FOR SELECT USING (true);

-- Permissão total de criação, edição e remoção para Administradores
CREATE POLICY "Admin gerencia categorias" ON public.categorias
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- 4. POLÍTICAS RLS ROBUSTAS PARA A TABELA SUBCATEGORIAS
ALTER TABLE public.subcategorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica subcategorias" ON public.subcategorias;
DROP POLICY IF EXISTS "Admin gerencia subcategorias" ON public.subcategorias;

-- Leitura pública para subcategorias
CREATE POLICY "Leitura publica subcategorias" ON public.subcategorias
FOR SELECT USING (true);

-- Permissão total de criação, edição e remoção para Administradores
CREATE POLICY "Admin gerencia subcategorias" ON public.subcategorias
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- 5. POLÍTICAS RLS ROBUSTAS PARA A TABELA PRODUTOS
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS descricao TEXT DEFAULT '';
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica produtos" ON public.produtos;
DROP POLICY IF EXISTS "Admin gerencia produtos" ON public.produtos;
DROP POLICY IF EXISTS "Acesso total produtos" ON public.produtos;

-- Clientes veem produtos ativos, admin vê tudo
CREATE POLICY "Leitura publica produtos" ON public.produtos
FOR SELECT USING (ativo = true OR public.is_admin());

-- Admin pode criar, atualizar e excluir produtos
CREATE POLICY "Admin gerencia produtos" ON public.produtos
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- 6. POLÍTICAS RLS ROBUSTAS PARA CATÁLOGOS E BANNERS
ALTER TABLE public.catalogos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura publica catalogos" ON public.catalogos;
DROP POLICY IF EXISTS "Admin gerencia catalogos" ON public.catalogos;
CREATE POLICY "Leitura publica catalogos" ON public.catalogos FOR SELECT USING (true);
CREATE POLICY "Admin gerencia catalogos" ON public.catalogos FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura publica banners" ON public.banners;
DROP POLICY IF EXISTS "Admin gerencia banners" ON public.banners;
CREATE POLICY "Leitura publica banners" ON public.banners FOR SELECT USING (true);
CREATE POLICY "Admin gerencia banners" ON public.banners FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
