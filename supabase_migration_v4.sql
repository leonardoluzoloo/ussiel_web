-- ===================================================================
-- NOVATECH ANGOLA • MIGRAÇÃO V4: SEGURANÇA, INTEGRIDADE E DESEMPENHO
-- 100% EM PORTUGUÊS DO BRASIL • PADRÃO INDUSTRIAL POSTGRESQL / SUPABASE
-- ===================================================================

-- 1. TABELA RELACIONAL DE SUBCATEGORIAS (FONTE ÚNICA DA VERDADE)
CREATE TABLE IF NOT EXISTS public.subcategorias (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  categoria_id BIGINT NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  slug VARCHAR(255) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT DEFAULT '',
  ordem_exibicao INT DEFAULT 1,
  ativo BOOLEAN DEFAULT TRUE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_subcategorias_categoria_slug UNIQUE (categoria_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_subcategorias_categoria_id ON public.subcategorias(categoria_id);
CREATE INDEX IF NOT EXISTS idx_subcategorias_ativo ON public.subcategorias(ativo);

-- Trigger de atualização de timestamp
CREATE OR REPLACE TRIGGER trigger_subcategorias_atualizado_em
BEFORE UPDATE ON public.subcategorias
FOR EACH ROW EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- Habilitar RLS em subcategorias
ALTER TABLE public.subcategorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica subcategorias" ON public.subcategorias;
CREATE POLICY "Leitura publica subcategorias" ON public.subcategorias
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin gerencia subcategorias" ON public.subcategorias;
CREATE POLICY "Admin gerencia subcategorias" ON public.subcategorias
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- 2. GARANTIR COLUNA subcategoria_id NA TABELA PRODUTOS
ALTER TABLE public.produtos
ADD COLUMN IF NOT EXISTS subcategoria_id BIGINT REFERENCES public.subcategorias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_produtos_subcategoria_id ON public.produtos(subcategoria_id);


-- 3. INTEGRIDADE PRODUTO -> CATEGORIA -> SUBCATEGORIA (TRIGGER DE VALIDAÇÃO)
CREATE OR REPLACE FUNCTION public.validar_integridade_produto()
RETURNS TRIGGER AS $$
DECLARE
  v_subcat_categoria_id BIGINT;
BEGIN
  -- Se uma subcategoria for informada, ela deve pertencer à mesma categoria do produto
  IF NEW.subcategoria_id IS NOT NULL THEN
    SELECT categoria_id INTO v_subcat_categoria_id
    FROM public.subcategorias
    WHERE id = NEW.subcategoria_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A subcategoria vinculada (ID %) não existe.', NEW.subcategoria_id;
    END IF;

    IF NEW.categoria_id IS NOT NULL AND v_subcat_categoria_id <> NEW.categoria_id THEN
      RAISE EXCEPTION 'Inconsistência de taxonomia: A subcategoria não pertence à categoria selecionada.';
    END IF;
  END IF;

  -- Se não for permitida venda sem estoque, o estoque não pode ser negativo
  IF (NEW.permitir_venda_sem_estoque IS FALSE OR NEW.permitir_venda_sem_estoque IS NULL) AND NEW.estoque < 0 THEN
    RAISE EXCEPTION 'O estoque do produto não pode ser negativo (Informado: %).', NEW.estoque;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_validar_produto ON public.produtos;
CREATE TRIGGER trigger_validar_produto
BEFORE INSERT OR UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.validar_integridade_produto();


-- 4. SEGURANÇA CRÍTICA: IMPEDIR AUTOPROMOÇÃO DE ADMINISTRADOR NO BANCO
-- Garante que nenhum usuário consiga se registrar ou se promover como admin via PostgREST/anon
CREATE OR REPLACE FUNCTION public.proteger_nivel_acesso_usuario()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Apenas administradores já autenticados podem inserir novos administradores
    IF NOT public.is_admin() THEN
      NEW.nivel_acesso := 'cliente';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Se o nível de acesso foi modificado e quem fez NÃO é admin, reverte para o valor anterior
    IF NEW.nivel_acesso IS DISTINCT FROM OLD.nivel_acesso THEN
      IF NOT public.is_admin() THEN
        NEW.nivel_acesso := OLD.nivel_acesso;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_proteger_nivel_acesso ON public.usuarios;
CREATE TRIGGER trigger_proteger_nivel_acesso
BEFORE INSERT OR UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.proteger_nivel_acesso_usuario();


-- 5. RLS RIGOROSO NA TABELA USUARIOS (SEM USAR true ABERTO)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Cadastro de novos usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Usuarios leem proprio perfil ou admin" ON public.usuarios;
DROP POLICY IF EXISTS "Usuarios atualizam proprio perfil ou admin" ON public.usuarios;
DROP POLICY IF EXISTS "Admin deleta usuarios" ON public.usuarios;

-- SELECT: Próprio usuário logado ou Administrador autenticado
CREATE POLICY "Usuarios leem proprio perfil ou admin" ON public.usuarios
FOR SELECT USING (
  (auth.uid() IS NOT NULL AND auth_user_id = auth.uid()) OR public.is_admin()
);

-- INSERT: Cadastro público permitido (o trigger força nivel_acesso = 'cliente')
CREATE POLICY "Cadastro de novos usuarios" ON public.usuarios
FOR INSERT WITH CHECK (
  public.is_admin() OR nivel_acesso = 'cliente'
);

-- UPDATE: Próprio usuário ou Administrador
CREATE POLICY "Usuarios atualizam proprio perfil ou admin" ON public.usuarios
FOR UPDATE USING (
  (auth.uid() IS NOT NULL AND auth_user_id = auth.uid()) OR public.is_admin()
)
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth_user_id = auth.uid()) OR public.is_admin()
);

-- DELETE: Somente Administrador
CREATE POLICY "Admin deleta usuarios" ON public.usuarios
FOR DELETE USING (public.is_admin());


-- 6. RPC DE BOOTSTRAP SEGURO DO PRIMEIRO ADMINISTRADOR
-- Permite criar o 1º admin APENAS E EXCLUSIVAMENTE quando NÃO houver nenhum cadastrado
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
  -- Verifica se já existe algum administrador no sistema
  SELECT COUNT(*) INTO v_admin_count
  FROM public.usuarios
  WHERE nivel_acesso = 'admin';

  IF v_admin_count > 0 THEN
    RAISE EXCEPTION 'Acesso negado: O sistema já possui administrador(es) cadastrado(s). Setup bloqueado.';
  END IF;

  -- Se o usuário já existir pelo e-mail, promove para admin
  UPDATE public.usuarios
  SET nivel_acesso = 'admin',
      status = 'ativo',
      ativo = true,
      atualizado_em = NOW()
  WHERE LOWER(email) = LOWER(TRIM(p_email))
  RETURNING id INTO v_user_id;

  -- Se não existir registro, insere o primeiro admin
  IF v_user_id IS NULL THEN
    INSERT INTO public.usuarios (
      nome,
      email,
      telefone,
      whatsapp,
      nivel_acesso,
      status,
      ativo
    ) VALUES (
      TRIM(p_nome),
      LOWER(TRIM(p_email)),
      TRIM(p_telefone),
      TRIM(p_telefone),
      'admin',
      'ativo',
      true
    )
    RETURNING id INTO v_user_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'user_id', v_user_id,
    'message', 'Primeiro administrador configurado com sucesso.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. RPC ATÔMICA DE BAIXA DE ESTOQUE (LOCK PESSIMISTA ANTI-RACE CONDITION)
CREATE OR REPLACE FUNCTION public.baixar_estoque_atomico(
  p_produto_id BIGINT,
  p_quantidade INT,
  p_motivo TEXT DEFAULT 'Venda de produto'
)
RETURNS JSON AS $$
DECLARE
  v_estoque_atual INT;
  v_novo_estoque INT;
  v_permite_sem_estoque BOOLEAN;
BEGIN
  -- Bloqueio exclusivo da linha do produto até o fim da transação
  SELECT estoque, COALESCE(permitir_venda_sem_estoque, false)
  INTO v_estoque_atual, v_permite_sem_estoque
  FROM public.produtos
  WHERE id = p_produto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado (ID: %)', p_produto_id;
  END IF;

  IF NOT v_permite_sem_estoque AND v_estoque_atual < p_quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente para o produto. Disponível: %, Solicitado: %', v_estoque_atual, p_quantidade;
  END IF;

  v_novo_estoque := v_estoque_atual - p_quantidade;
  IF NOT v_permite_sem_estoque AND v_novo_estoque < 0 THEN
    v_novo_estoque := 0;
  END IF;

  UPDATE public.produtos
  SET estoque = v_novo_estoque,
      atualizado_em = NOW()
  WHERE id = p_produto_id;

  INSERT INTO public.movimentacoes_estoque (
    produto_id,
    tipo_movimentacao,
    quantidade,
    estoque_anterior,
    estoque_novo,
    motivo
  ) VALUES (
    p_produto_id,
    'saida',
    p_quantidade,
    v_estoque_atual,
    v_novo_estoque,
    p_motivo
  );

  RETURN json_build_object(
    'success', true,
    'produto_id', p_produto_id,
    'estoque_anterior', v_estoque_atual,
    'estoque_novo', v_novo_estoque
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. RPC ATÔMICA DE MOVIMENTAÇÃO DE ESTOQUE DO ADMIN (ENTRADA, SAÍDA, AJUSTE)
CREATE OR REPLACE FUNCTION public.registrar_movimentacao_estoque(
  p_produto_id BIGINT,
  p_tipo TEXT,
  p_quantidade INT,
  p_motivo TEXT DEFAULT 'Movimentação manual'
)
RETURNS JSON AS $$
DECLARE
  v_estoque_atual INT;
  v_novo_estoque INT;
  v_tipo_canonico TEXT;
BEGIN
  v_tipo_canonico := LOWER(TRIM(p_tipo));
  IF v_tipo_canonico IN ('in', 'entrada') THEN
    v_tipo_canonico := 'entrada';
  ELSIF v_tipo_canonico IN ('out', 'saida') THEN
    v_tipo_canonico := 'saida';
  ELSIF v_tipo_canonico IN ('adjustment', 'ajuste') THEN
    v_tipo_canonico := 'ajuste';
  ELSE
    RAISE EXCEPTION 'Tipo de movimentação inválido: %', p_tipo;
  END IF;

  SELECT estoque INTO v_estoque_atual
  FROM public.produtos
  WHERE id = p_produto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado (ID: %)', p_produto_id;
  END IF;

  IF v_tipo_canonico = 'entrada' THEN
    v_novo_estoque := v_estoque_atual + p_quantidade;
  ELSIF v_tipo_canonico = 'saida' THEN
    IF v_estoque_atual < p_quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para saída. Disponível: %, Solicitado: %', v_estoque_atual, p_quantidade;
    END IF;
    v_novo_estoque := v_estoque_atual - p_quantidade;
  ELSIF v_tipo_canonico = 'ajuste' THEN
    IF p_quantidade < 0 THEN
      RAISE EXCEPTION 'Saldo de estoque não pode ser negativo: %', p_quantidade;
    END IF;
    v_novo_estoque := p_quantidade;
  END IF;

  UPDATE public.produtos
  SET estoque = v_novo_estoque,
      atualizado_em = NOW()
  WHERE id = p_produto_id;

  INSERT INTO public.movimentacoes_estoque (
    produto_id,
    tipo_movimentacao,
    quantidade,
    estoque_anterior,
    estoque_novo,
    motivo
  ) VALUES (
    p_produto_id,
    v_tipo_canonico,
    p_quantidade,
    v_estoque_atual,
    v_novo_estoque,
    p_motivo
  );

  RETURN json_build_object(
    'success', true,
    'produto_id', p_produto_id,
    'tipo', v_tipo_canonico,
    'estoque_anterior', v_estoque_atual,
    'estoque_novo', v_novo_estoque
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 9. RPC DE CÁLCULO DE KPIS DO DASHBOARD (SERVER-SIDE 100% NO POSTGRESQL)
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_kpis(
  p_period TEXT DEFAULT 'all',
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ := NOW();
  v_faturamento NUMERIC := 0;
  v_pedidos INT := 0;
  v_ticket_medio NUMERIC := 0;
  v_produtos INT := 0;
  v_pedidos_pendentes INT := 0;
  v_produtos_baixo_estoque INT := 0;
BEGIN
  -- Determinação do intervalo temporal
  IF p_period = 'today' THEN
    v_start := DATE_TRUNC('day', NOW());
  ELSIF p_period = '7d' THEN
    v_start := NOW() - INTERVAL '7 days';
  ELSIF p_period = '30d' THEN
    v_start := NOW() - INTERVAL '30 days';
  ELSIF p_period = 'month' THEN
    v_start := DATE_TRUNC('month', NOW());
  ELSIF p_period = 'custom' AND p_start_date IS NOT NULL THEN
    v_start := p_start_date;
    IF p_end_date IS NOT NULL THEN
      v_end := p_end_date;
    END IF;
  ELSE
    v_start := '1970-01-01 00:00:00+00'::TIMESTAMPTZ;
  END IF;

  -- Total faturado e quantidade de pedidos (excluindo cancelados)
  SELECT 
    COALESCE(SUM(total), 0),
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN COALESCE(ROUND(AVG(total), 2), 0) ELSE 0 END
  INTO 
    v_faturamento,
    v_pedidos,
    v_ticket_medio
  FROM public.pedidos
  WHERE criado_em >= v_start 
    AND criado_em <= v_end
    AND status_pedido NOT IN ('cancelled', 'cancelado');

  -- Pedidos com status pendente de processamento
  SELECT COUNT(*) INTO v_pedidos_pendentes
  FROM public.pedidos
  WHERE criado_em >= v_start
    AND criado_em <= v_end
    AND status_pedido IN ('received', 'recebido', 'preparing', 'preparando');

  -- Total de produtos
  SELECT COUNT(*) INTO v_produtos
  FROM public.produtos;

  -- Produtos com baixo estoque
  SELECT COUNT(*) INTO v_produtos_baixo_estoque
  FROM public.produtos
  WHERE estoque <= COALESCE(estoque_minimo, 2);

  RETURN json_build_object(
    'total_sales', v_faturamento,
    'total_orders', v_pedidos,
    'ticket_medio', v_ticket_medio,
    'total_products', v_produtos,
    'pending_orders', v_pedidos_pendentes,
    'low_stock_count', v_produtos_baixo_estoque,
    'period', p_period,
    'start_date', v_start,
    'end_date', v_end
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 10. PADRONIZAÇÃO DE CONFIGURAÇÕES (MIGRAR 'geral' PARA 'general')
UPDATE public.configuracoes_loja
SET chave = 'general'
WHERE chave = 'geral';

-- 11. VERIFICAÇÃO FINAL
SELECT 
  'MIGRACAO V4 CONCLUIDA COM SUCESSO' AS status,
  (SELECT COUNT(*) FROM public.subcategorias) AS total_subcategorias,
  (SELECT COUNT(*) FROM public.usuarios WHERE nivel_acesso = 'admin') AS total_admins,
  'Proteção de nivel_acesso, RLS estrito, RPCs de estoque atômico e KPIs do dashboard ativados.' AS descricao;
