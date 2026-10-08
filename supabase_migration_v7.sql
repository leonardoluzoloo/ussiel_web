-- ===================================================================
-- NOVATECH ANGOLA • MIGRAÇÃO V7: AUDITORIA, INTEGRIDADE E SINCRONIZAÇÃO TOTAL
-- 100% EM PORTUGUÊS • PADRÃO INDUSTRIAL ENTERPRISE PARA SUPABASE / POSTGRESQL
--
-- Objetivos:
-- 1. Sincronização automática em tempo real entre auth.users e public.usuarios (Trigger SECURITY DEFINER).
-- 2. Eliminação do deadlock de promoção (trigger antigo que forçava nivel_acesso='cliente').
-- 3. Promover imediatamente Ussiel Vaz (uvprestservice@gmail.com) e Leonardo Adriano a administradores.
-- 4. Garantir que cadastros de admin ou cliente NUNCA falhem por políticas de RLS.
-- 5. Disponibilizar RPCs seguras de gestão de usuários para o painel administrativo.
-- ===================================================================

-- 1. ATUALIZA A FUNÇÃO is_admin() (SECURITY DEFINER)
-- Reconhece Service Role, metadados do Auth e a tabela public.usuarios
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- A) Token de Service Role
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN TRUE;
  END IF;

  -- B) Metadados do Supabase Auth (user_metadata ou app_metadata)
  IF (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR 
     (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- C) Consulta à tabela public.usuarios (por auth_user_id OU por e-mail)
  IF auth.uid() IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE (auth_user_id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email'))
        AND nivel_acesso = 'admin'
        AND (status = 'ativo' OR status IS NULL)
        AND ativo = true
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. CORREÇÃO DO TRIGGER DE PROTEÇÃO DE NÍVEL DE ACESSO (ELIMINAÇÃO DO DEADLOCK)
-- O trigger antigo da V4 impedia que qualquer script ou cadastro definisse nivel_acesso = 'admin'.
-- Agora ele permite quando for chamado por administradores, service_role, ou triggers internos do Postgres.
DROP TRIGGER IF EXISTS trigger_proteger_nivel_acesso ON public.usuarios;

CREATE OR REPLACE FUNCTION public.proteger_nivel_acesso_usuario()
RETURNS TRIGGER AS $$
BEGIN
  -- Permite se for Service Role, admin autenticado ou chamada de trigger/postgres interno
  IF public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role' OR current_user = 'postgres' THEN
    RETURN NEW;
  END IF;

  -- Se for inserção ou atualização por cliente comum não autorizado:
  IF TG_OP = 'INSERT' THEN
    IF NEW.nivel_acesso = 'admin' THEN
      NEW.nivel_acesso := 'cliente';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.nivel_acesso IS DISTINCT FROM OLD.nivel_acesso THEN
      NEW.nivel_acesso := OLD.nivel_acesso;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_proteger_nivel_acesso
BEFORE INSERT OR UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.proteger_nivel_acesso_usuario();


-- 3. TRIGGER AUTOMÁTICO: SINCRONIZA QUALQUER CONTA CRIADA EM AUTH.USERS COM PUBLIC.USUARIOS
-- Esse trigger resolve definitivamente o problema de o Supabase criar o Auth mas não gravar na tabela usuarios
CREATE OR REPLACE FUNCTION public.sincronizar_novo_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_nome TEXT;
  v_telefone TEXT;
  v_admin_count INT;
  v_endereco TEXT;
  v_ponto_ref TEXT;
BEGIN
  -- Extrai metadados enviados no cadastro
  v_nome := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1));
  v_telefone := COALESCE(NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'telefone', '');
  v_endereco := COALESCE(NEW.raw_user_meta_data->>'endereco', '');
  v_ponto_ref := COALESCE(NEW.raw_user_meta_data->>'ponto_referencia', '');

  -- Quantidade de administradores atualmente ativos
  SELECT COUNT(*) INTO v_admin_count 
  FROM public.usuarios 
  WHERE nivel_acesso = 'admin' AND ativo = true;

  -- Determina a role: se foi registrado como admin, se é e-mail institucional ou se não há nenhum admin
  IF (NEW.raw_user_meta_data->>'role' = 'admin') 
     OR (v_admin_count = 0)
     OR (LOWER(NEW.email) IN ('uvprestservice@gmail.com', 'leonardoadriano733@gmail.com')) THEN
    v_role := 'admin';
  ELSE
    v_role := 'cliente';
  END IF;

  -- Insere ou atualiza na tabela public.usuarios ignorando restrições de RLS
  INSERT INTO public.usuarios (
    auth_user_id,
    nome,
    email,
    telefone,
    whatsapp,
    nivel_acesso,
    status,
    ativo,
    endereco,
    ponto_referencia,
    atualizado_em
  ) VALUES (
    NEW.id,
    TRIM(v_nome),
    LOWER(TRIM(NEW.email)),
    TRIM(v_telefone),
    TRIM(v_telefone),
    v_role,
    'ativo',
    true,
    v_endereco,
    v_ponto_ref,
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    nome = COALESCE(NULLIF(EXCLUDED.nome, ''), public.usuarios.nome),
    telefone = COALESCE(NULLIF(EXCLUDED.telefone, ''), public.usuarios.telefone),
    whatsapp = COALESCE(NULLIF(EXCLUDED.whatsapp, ''), public.usuarios.whatsapp),
    nivel_acesso = CASE
      WHEN EXCLUDED.nivel_acesso = 'admin' THEN 'admin'
      ELSE public.usuarios.nivel_acesso
    END,
    status = 'ativo',
    ativo = true,
    atualizado_em = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remove versão anterior do trigger se existir e aplica o novo
DROP TRIGGER IF EXISTS trigger_on_auth_user_created ON auth.users;
CREATE TRIGGER trigger_on_auth_user_created
AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_novo_auth_user();


-- 4. RPC DE CRIAÇÃO / SINCRONIZAÇÃO DE USUÁRIO POR ADMINISTRADOR (SECURITY DEFINER)
-- Permite que o painel de admin cadastre novos administradores ou clientes com bypass de RLS
CREATE OR REPLACE FUNCTION public.admin_cadastrar_usuario(
  p_email TEXT,
  p_nome TEXT,
  p_telefone TEXT DEFAULT '',
  p_nivel_acesso TEXT DEFAULT 'admin',
  p_auth_user_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_user_id BIGINT;
  v_final_role TEXT;
BEGIN
  -- Validação de segurança: apenas admin logado ou bootstrap inicial pode definir nível 'admin'
  IF p_nivel_acesso = 'admin' AND NOT public.is_admin() THEN
    IF (SELECT COUNT(*) FROM public.usuarios WHERE nivel_acesso = 'admin' AND ativo = true) > 0 THEN
      RAISE EXCEPTION 'Apenas administradores autenticados podem cadastrar novos administradores.';
    END IF;
  END IF;

  v_final_role := CASE WHEN p_nivel_acesso = 'admin' THEN 'admin' ELSE 'cliente' END;

  INSERT INTO public.usuarios (
    auth_user_id,
    nome,
    email,
    telefone,
    whatsapp,
    nivel_acesso,
    status,
    ativo,
    atualizado_em
  ) VALUES (
    p_auth_user_id,
    TRIM(p_nome),
    LOWER(TRIM(p_email)),
    TRIM(p_telefone),
    TRIM(p_telefone),
    v_final_role,
    'ativo',
    true,
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    auth_user_id = COALESCE(EXCLUDED.auth_user_id, public.usuarios.auth_user_id),
    nome = TRIM(p_nome),
    telefone = TRIM(p_telefone),
    whatsapp = TRIM(p_telefone),
    nivel_acesso = v_final_role,
    status = 'ativo',
    ativo = true,
    atualizado_em = NOW()
  RETURNING id INTO v_user_id;

  RETURN json_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', LOWER(TRIM(p_email)),
    'nivel_acesso', v_final_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5. RPC DE BOOTSTRAP SEGURO DO PRIMEIRO ADMINISTRADOR
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(
  p_email TEXT,
  p_nome TEXT,
  p_telefone TEXT DEFAULT ''
)
RETURNS JSON AS $$
DECLARE
  v_admin_count INT;
  v_user_id BIGINT;
BEGIN
  -- Conta quantos administradores ativos já existem
  SELECT COUNT(*) INTO v_admin_count
  FROM public.usuarios
  WHERE nivel_acesso = 'admin' AND ativo = true;

  IF v_admin_count > 0 THEN
    RAISE EXCEPTION 'O sistema já possui administrador(es) ativo(s). Use uma conta administrativa para cadastrar novos membros.';
  END IF;

  INSERT INTO public.usuarios (
    nome,
    email,
    telefone,
    whatsapp,
    nivel_acesso,
    status,
    ativo,
    atualizado_em
  ) VALUES (
    TRIM(p_nome),
    LOWER(TRIM(p_email)),
    TRIM(p_telefone),
    TRIM(p_telefone),
    'admin',
    'ativo',
    true,
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    nome = EXCLUDED.nome,
    telefone = EXCLUDED.telefone,
    whatsapp = EXCLUDED.whatsapp,
    nivel_acesso = 'admin',
    status = 'ativo',
    ativo = true,
    atualizado_em = NOW()
  RETURNING id INTO v_user_id;

  RETURN json_build_object(
    'success', true,
    'user_id', v_user_id,
    'message', 'Primeiro administrador configurado com sucesso.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 6. POLÍTICAS RLS ROBUSTAS E DEFINITIVAS PARA PUBLIC.USUARIOS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Cadastro de novos usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Usuarios leem proprio perfil ou admin" ON public.usuarios;
DROP POLICY IF EXISTS "Usuarios atualizam proprio perfil ou admin" ON public.usuarios;
DROP POLICY IF EXISTS "Admin deleta usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Admin gerencia todos usuarios" ON public.usuarios;

-- SELECT: Próprio usuário logado OU Administrador autenticado
CREATE POLICY "Usuarios leem proprio perfil ou admin" ON public.usuarios
FOR SELECT USING (
  public.is_admin() OR 
  (auth.uid() IS NOT NULL AND auth_user_id = auth.uid()) OR
  (LOWER(email) = LOWER(auth.jwt() ->> 'email'))
);

-- INSERT: Administradores cadastram qualquer perfil; Novos clientes cadastram como 'cliente'
CREATE POLICY "Cadastro de novos usuarios" ON public.usuarios
FOR INSERT WITH CHECK (
  public.is_admin() OR nivel_acesso = 'cliente'
);

-- UPDATE: Administrador altera tudo; Usuário comum altera apenas seu próprio perfil
CREATE POLICY "Usuarios atualizam proprio perfil ou admin" ON public.usuarios
FOR UPDATE USING (
  public.is_admin() OR 
  (auth.uid() IS NOT NULL AND auth_user_id = auth.uid()) OR
  (LOWER(email) = LOWER(auth.jwt() ->> 'email'))
)
WITH CHECK (
  public.is_admin() OR 
  (auth.uid() IS NOT NULL AND auth_user_id = auth.uid()) OR
  (LOWER(email) = LOWER(auth.jwt() ->> 'email'))
);

-- DELETE: Somente Administradores
CREATE POLICY "Admin deleta usuarios" ON public.usuarios
FOR DELETE USING (public.is_admin());


-- 7. RECONCILIAÇÃO E PROMOÇÃO IMEDIATA DOS ADMINISTRADORES EXISTENTES
-- Garante que Ussiel Vaz (uvprestservice@gmail.com) e Leonardo Adriano (leonardoadriano733@gmail.com)
-- sejam 100% promovidos e vinculados como admin em public.usuarios:
UPDATE public.usuarios u
SET nivel_acesso = 'admin',
    status = 'ativo',
    ativo = true,
    auth_user_id = a.id,
    atualizado_em = NOW()
FROM auth.users a
WHERE LOWER(u.email) = LOWER(a.email)
  AND (
    (a.raw_user_meta_data->>'role' = 'admin') OR 
    (a.raw_app_meta_data->>'role' = 'admin') OR
    LOWER(u.email) IN ('uvprestservice@gmail.com', 'leonardoadriano733@gmail.com')
  );

-- Se uvprestservice@gmail.com ou qualquer admin do Auth não existir em usuarios, insere imediatamente:
INSERT INTO public.usuarios (
  auth_user_id,
  nome,
  email,
  telefone,
  whatsapp,
  nivel_acesso,
  status,
  ativo,
  criado_em,
  atualizado_em
)
SELECT 
  a.id,
  COALESCE(a.raw_user_meta_data->>'name', a.raw_user_meta_data->>'nome', split_part(a.email, '@', 1)),
  LOWER(a.email),
  COALESCE(a.raw_user_meta_data->>'phone', ''),
  COALESCE(a.raw_user_meta_data->>'whatsapp', a.raw_user_meta_data->>'phone', ''),
  'admin',
  'ativo',
  true,
  NOW(),
  NOW()
FROM auth.users a
WHERE (
  (a.raw_user_meta_data->>'role' = 'admin') OR 
  (a.raw_app_meta_data->>'role' = 'admin') OR
  LOWER(a.email) IN ('uvprestservice@gmail.com', 'leonardoadriano733@gmail.com')
)
ON CONFLICT (email) DO UPDATE SET
  auth_user_id = EXCLUDED.auth_user_id,
  nivel_acesso = 'admin',
  status = 'ativo',
  ativo = true,
  atualizado_em = NOW();

-- Vincula todos os auth_user_id que estiverem pendentes
UPDATE public.usuarios u
SET auth_user_id = a.id
FROM auth.users a
WHERE LOWER(u.email) = LOWER(a.email)
  AND (u.auth_user_id IS NULL OR u.auth_user_id != a.id);


-- ===================================================================
-- 8. TABELA OFICIAL DE FAVORITOS (WISHLIST 100% PERSISTIDA NO BANCO)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.favoritos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  produto_id BIGINT NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_favoritos_usuario_produto UNIQUE (usuario_id, produto_id)
);

CREATE INDEX IF NOT EXISTS idx_favoritos_usuario ON public.favoritos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_favoritos_produto ON public.favoritos(produto_id);

ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios leem proprios favoritos" ON public.favoritos;
CREATE POLICY "Usuarios leem proprios favoritos" ON public.favoritos
FOR SELECT USING (
  public.is_admin() OR 
  usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Usuarios inserem proprios favoritos" ON public.favoritos;
CREATE POLICY "Usuarios inserem proprios favoritos" ON public.favoritos
FOR INSERT WITH CHECK (
  public.is_admin() OR 
  usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Usuarios removem proprios favoritos" ON public.favoritos;
CREATE POLICY "Usuarios removem proprios favoritos" ON public.favoritos
FOR DELETE USING (
  public.is_admin() OR 
  usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
);


-- ===================================================================
-- 9. TABELA E POLÍTICAS DE AVALIAÇÕES (REVIEWS 100% NO BANCO)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  produto_id BIGINT NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  usuario_id BIGINT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  autor VARCHAR(255) NOT NULL,
  email_autor VARCHAR(255),
  comentario TEXT NOT NULL,
  nota INT NOT NULL CHECK (nota >= 1 AND nota <= 5),
  verificado BOOLEAN DEFAULT FALSE NOT NULL,
  aprovado BOOLEAN DEFAULT TRUE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_produto ON public.avaliacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_aprovado ON public.avaliacoes(aprovado);

ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica avaliacoes aprovadas" ON public.avaliacoes;
CREATE POLICY "Leitura publica avaliacoes aprovadas" ON public.avaliacoes
FOR SELECT USING (aprovado = true OR public.is_admin());

DROP POLICY IF EXISTS "Clientes podem avaliar produtos" ON public.avaliacoes;
CREATE POLICY "Clientes podem avaliar produtos" ON public.avaliacoes
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admin gerencia avaliacoes" ON public.avaliacoes;
CREATE POLICY "Admin gerencia avaliacoes" ON public.avaliacoes
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
