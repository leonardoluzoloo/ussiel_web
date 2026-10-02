-- ===================================================================
-- NOVATECH ANGOLA • MIGRAÇÃO V5: POLÍTICAS RLS E FLUXOS DO CLIENTE
-- 100% EM PORTUGUÊS DO BRASIL • BASEADO NO SCHEMA OFICIAL DO PROJETO
-- ===================================================================

-- 1. TABELA DE AVALIAÇÕES (CRIA SE NÃO EXISTIR, COM O SCHEMA EXATO DA V3)
CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  produto_id BIGINT NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  usuario_id BIGINT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  autor VARCHAR(255) NOT NULL DEFAULT 'Cliente Verificado',
  email_autor VARCHAR(255),
  comentario TEXT NOT NULL,
  nota SMALLINT NOT NULL DEFAULT 5 CHECK (nota BETWEEN 1 AND 5),
  verificado BOOLEAN DEFAULT FALSE NOT NULL,
  aprovado BOOLEAN DEFAULT TRUE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- 2. GARANTIR A COLUNA auth_user_id NAS TABELAS ESSENCIAIS
ALTER TABLE IF EXISTS public.pedidos
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.usuarios
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

ALTER TABLE IF EXISTS public.avaliacoes
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;


-- 3. ÍNDICES DE ALTA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_pedidos_auth_user_id ON public.pedidos(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_email_cliente ON public.pedidos(email_cliente);
CREATE INDEX IF NOT EXISTS idx_usuarios_auth_user_id ON public.usuarios(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_produto ON public.avaliacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_usuario ON public.avaliacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_aprovado ON public.avaliacoes(aprovado);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_auth_user_id ON public.avaliacoes(auth_user_id);


-- 4. POLÍTICAS RLS PARA TABELA 'PEDIDOS'
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin ve todos pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Clientes leem proprios pedidos ou admin" ON public.pedidos;
DROP POLICY IF EXISTS "Acesso total pedidos" ON public.pedidos;

-- Leitura: Administrador vê todos; Cliente vê os seus (por auth_user_id, por usuario_id ou por email)
CREATE POLICY "Clientes leem proprios pedidos ou admin" ON public.pedidos
FOR SELECT USING (
  public.is_admin() OR
  (auth.uid() IS NOT NULL AND auth_user_id = auth.uid()) OR
  (auth.uid() IS NOT NULL AND usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())) OR
  (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email_cliente) = LOWER(auth.jwt() ->> 'email'))
);

-- Inserção: Permitida para checkout da loja (cliente logado ou visitante)
DROP POLICY IF EXISTS "Criacao de pedidos checkout" ON public.pedidos;
DROP POLICY IF EXISTS "Insercao de pedidos permitida" ON public.pedidos;
CREATE POLICY "Criacao de pedidos checkout" ON public.pedidos
FOR INSERT WITH CHECK (true);

-- Atualização: Admin atualiza tudo; Cliente atualiza seu próprio pedido
DROP POLICY IF EXISTS "Admin atualiza pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Atualizacao de pedidos" ON public.pedidos;
CREATE POLICY "Atualizacao de pedidos" ON public.pedidos
FOR UPDATE USING (
  public.is_admin() OR
  (auth.uid() IS NOT NULL AND auth_user_id = auth.uid()) OR
  (auth.uid() IS NOT NULL AND usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())) OR
  (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email_cliente) = LOWER(auth.jwt() ->> 'email'))
) WITH CHECK (
  public.is_admin() OR
  (auth.uid() IS NOT NULL AND auth_user_id = auth.uid()) OR
  (auth.uid() IS NOT NULL AND usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())) OR
  (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email_cliente) = LOWER(auth.jwt() ->> 'email'))
);


-- 5. POLÍTICAS RLS PARA TABELA 'ITENS_PEDIDO'
ALTER TABLE IF EXISTS public.itens_pedido ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total itens_pedido" ON public.itens_pedido;
DROP POLICY IF EXISTS "Leitura itens de pedidos autorizados" ON public.itens_pedido;
CREATE POLICY "Leitura itens de pedidos autorizados" ON public.itens_pedido
FOR SELECT USING (
  public.is_admin() OR
  EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id = itens_pedido.pedido_id
      AND (
        (auth.uid() IS NOT NULL AND p.auth_user_id = auth.uid()) OR
        (auth.uid() IS NOT NULL AND p.usuario_id IN (SELECT u.id FROM public.usuarios u WHERE u.auth_user_id = auth.uid())) OR
        (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(p.email_cliente) = LOWER(auth.jwt() ->> 'email'))
      )
  )
);

DROP POLICY IF EXISTS "Insercao de itens no checkout" ON public.itens_pedido;
CREATE POLICY "Insercao de itens no checkout" ON public.itens_pedido
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admin gerencia itens pedido" ON public.itens_pedido;
CREATE POLICY "Admin gerencia itens pedido" ON public.itens_pedido
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- 6. POLÍTICAS RLS PARA TABELA 'AVALIACOES'
ALTER TABLE IF EXISTS public.avaliacoes ENABLE ROW LEVEL SECURITY;

-- Leitura: Avaliações aprovadas são públicas; Admin ou autor veem as suas pendentes
DROP POLICY IF EXISTS "Leitura publica avaliacoes aprovadas" ON public.avaliacoes;
CREATE POLICY "Leitura publica avaliacoes aprovadas" ON public.avaliacoes
FOR SELECT USING (
  aprovado = TRUE OR
  public.is_admin() OR
  (auth.uid() IS NOT NULL AND auth_user_id = auth.uid()) OR
  (auth.uid() IS NOT NULL AND usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()))
);

-- Inserção: Clientes autenticados ou visitantes
DROP POLICY IF EXISTS "Clientes podem avaliar" ON public.avaliacoes;
CREATE POLICY "Clientes podem avaliar" ON public.avaliacoes
FOR INSERT WITH CHECK (true);

-- Atualização: Próprio autor ou Admin
DROP POLICY IF EXISTS "Usuarios atualizam propria avaliacao" ON public.avaliacoes;
CREATE POLICY "Usuarios atualizam propria avaliacao" ON public.avaliacoes
FOR UPDATE USING (
  public.is_admin() OR
  (auth.uid() IS NOT NULL AND auth_user_id = auth.uid()) OR
  (auth.uid() IS NOT NULL AND usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()))
) WITH CHECK (
  public.is_admin() OR
  (auth.uid() IS NOT NULL AND auth_user_id = auth.uid()) OR
  (auth.uid() IS NOT NULL AND usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()))
);

-- Exclusão: Apenas Admin
DROP POLICY IF EXISTS "Admin exclui avaliacoes" ON public.avaliacoes;
CREATE POLICY "Admin exclui avaliacoes" ON public.avaliacoes
FOR DELETE USING (public.is_admin());


-- 7. POLÍTICAS RLS PARA TABELA 'USUARIOS'
ALTER TABLE IF EXISTS public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios leem proprio perfil ou admin" ON public.usuarios;
CREATE POLICY "Usuarios leem proprio perfil ou admin" ON public.usuarios
FOR SELECT USING (
  public.is_admin() OR
  (auth.uid() IS NOT NULL AND auth_user_id = auth.uid()) OR
  (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
);

DROP POLICY IF EXISTS "Usuarios atualizam proprio perfil ou admin" ON public.usuarios;
CREATE POLICY "Usuarios atualizam proprio perfil ou admin" ON public.usuarios
FOR UPDATE USING (
  public.is_admin() OR
  (auth.uid() IS NOT NULL AND auth_user_id = auth.uid()) OR
  (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
) WITH CHECK (
  public.is_admin() OR
  (auth.uid() IS NOT NULL AND auth_user_id = auth.uid()) OR
  (auth.jwt() ->> 'email' IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
);


-- 8. RPC: CONFIRMAR ENTREGA DE PEDIDO PELO CLIENTE (SEGURA E ATÔMICA)
CREATE OR REPLACE FUNCTION public.confirmar_entrega_pedido(
  p_pedido_id VARCHAR,
  p_usuario_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_pedido RECORD;
  v_caller_uid UUID;
  v_caller_email TEXT;
  v_user_db_id BIGINT;
BEGIN
  v_caller_uid := COALESCE(p_usuario_id, auth.uid());
  v_caller_email := auth.jwt() ->> 'email';

  -- Localiza ID do usuário na tabela usuarios correspondente ao auth.uid(), se houver
  IF v_caller_uid IS NOT NULL THEN
    SELECT id INTO v_user_db_id FROM public.usuarios WHERE auth_user_id = v_caller_uid;
  END IF;

  -- Localiza o pedido por ID numérico ou código alfanumérico (codigo_pedido)
  SELECT * INTO v_pedido
  FROM public.pedidos
  WHERE id::TEXT = p_pedido_id OR codigo_pedido = p_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado (ID: %).', p_pedido_id;
  END IF;

  -- Validação de propriedade se não for Admin
  IF NOT public.is_admin() THEN
    IF v_pedido.auth_user_id IS NOT NULL AND v_pedido.auth_user_id <> v_caller_uid THEN
      RAISE EXCEPTION 'Acesso negado: Você não possui autorização para confirmar este pedido.';
    END IF;

    IF v_user_db_id IS NOT NULL AND v_pedido.usuario_id IS NOT NULL AND v_pedido.usuario_id <> v_user_db_id THEN
      RAISE EXCEPTION 'Acesso negado: Este pedido pertence a outro usuário.';
    END IF;

    IF v_caller_email IS NOT NULL AND LOWER(v_pedido.email_cliente) <> LOWER(v_caller_email) THEN
      RAISE EXCEPTION 'Acesso negado: O e-mail do pedido não corresponde à sua conta.';
    END IF;
  END IF;

  -- Atualiza o status do pedido para 'delivered'
  UPDATE public.pedidos
  SET 
    status_pedido = 'delivered',
    atualizado_em = NOW()
  WHERE id = v_pedido.id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'mensagem', 'Entrega confirmada com sucesso pelo cliente.',
    'pedido_id', v_pedido.id,
    'codigo_pedido', v_pedido.codigo_pedido,
    'status', 'delivered',
    'atualizado_em', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. VERIFICAÇÃO FINAL
SELECT 
  'MIGRACAO V5 CONCLUIDA COM SUCESSO' AS status,
  (SELECT COUNT(*) FROM public.pedidos) AS total_pedidos,
  'RLS consolidado e RPC confirmar_entrega_pedido ativada com sucesso.' AS descricao;
