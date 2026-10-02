-- ===================================================================
-- NOVATECH ANGOLA • MIGRAÇÃO V2: SEGURANÇA, SUBCATEGORIAS & PADRONIZAÇÃO
-- 100% EM PORTUGUÊS DO BRASIL • PADRÃO INDUSTRIAL POSTGRESQL / SUPABASE
-- ===================================================================

-- 1. EXTENSÃO PGCRYPTO
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. NOVA TABELA OFICIAL DE SUBCATEGORIAS
CREATE TABLE IF NOT EXISTS public.subcategorias (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  categoria_id BIGINT NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  slug VARCHAR(255) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  ordem_exibicao INT DEFAULT 1 NOT NULL,
  ativo BOOLEAN DEFAULT TRUE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_subcategorias_categoria_slug UNIQUE (categoria_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_subcategorias_categoria ON public.subcategorias(categoria_id);
CREATE INDEX IF NOT EXISTS idx_subcategorias_slug ON public.subcategorias(slug);
CREATE INDEX IF NOT EXISTS idx_subcategorias_ativo ON public.subcategorias(ativo);

CREATE OR REPLACE TRIGGER trigger_subcategorias_atualizado_em
BEFORE UPDATE ON public.subcategorias
FOR EACH ROW EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- 3. MIGRAR SUBCATEGORIAS EXISTENTES DO JSONB DA TABELA CATEGORIAS (SE HOUVER)
DO $$
DECLARE
  cat_rec RECORD;
  sub_item JSONB;
  sub_nome TEXT;
  sub_slug TEXT;
  sub_ordem INT;
BEGIN
  FOR cat_rec IN SELECT id, subcategorias FROM public.categorias WHERE subcategorias IS NOT NULL AND jsonb_array_length(subcategorias) > 0 LOOP
    FOR sub_item IN SELECT jsonb_array_elements(cat_rec.subcategorias) LOOP
      sub_nome := COALESCE(sub_item->>'name', sub_item->>'nome', 'Subcategoria');
      sub_slug := COALESCE(sub_item->>'slug', lower(regexp_replace(sub_nome, '[^a-zA-Z0-9]+', '-', 'g')));
      sub_ordem := COALESCE((sub_item->>'display_order')::INT, (sub_item->>'ordem_exibicao')::INT, 1);
      
      INSERT INTO public.subcategorias (categoria_id, slug, nome, descricao, ordem_exibicao, ativo)
      VALUES (
        cat_rec.id, 
        sub_slug, 
        sub_nome, 
        sub_item->>'description', 
        sub_ordem, 
        COALESCE((sub_item->>'is_active')::BOOLEAN, (sub_item->>'ativo')::BOOLEAN, true)
      )
      ON CONFLICT (categoria_id, slug) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 4. ADICIONAR COLUNA subcategoria_id NA TABELA produtos COM FK RESTRICT
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS subcategoria_id BIGINT REFERENCES public.subcategorias(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_produtos_subcategoria ON public.produtos(subcategoria_id);

-- 5. ATUALIZAR STATUS DE PEDIDOS PARA PADRÃO UNIFICADO (INGLÊS NO BANCO COM SUPORTE PT-BR)
UPDATE public.pedidos SET status_pedido = 'received' WHERE status_pedido = 'recebido';
UPDATE public.pedidos SET status_pedido = 'confirmed' WHERE status_pedido = 'confirmado';
UPDATE public.pedidos SET status_pedido = 'preparing' WHERE status_pedido IN ('preparando', 'em_preparacao');
UPDATE public.pedidos SET status_pedido = 'shipped' WHERE status_pedido = 'enviado';
UPDATE public.pedidos SET status_pedido = 'delivered' WHERE status_pedido = 'entregue';
UPDATE public.pedidos SET status_pedido = 'cancelled' WHERE status_pedido = 'cancelado';

ALTER TABLE public.pedidos 
ALTER COLUMN status_pedido SET DEFAULT 'received';

-- 6. ATUALIZAR MOVIMENTAÇÕES DE ESTOQUE PARA CONVENÇÃO PADRÃO
UPDATE public.movimentacoes_estoque SET tipo_movimentacao = 'entrada' WHERE tipo_movimentacao = 'in';
UPDATE public.movimentacoes_estoque SET tipo_movimentacao = 'saida' WHERE tipo_movimentacao = 'out';
UPDATE public.movimentacoes_estoque SET tipo_movimentacao = 'ajuste' WHERE tipo_movimentacao = 'adjustment';

-- 7. FUNÇÃO DE VERIFICAÇÃO DE PRIVILÉGIOS DE ADMINISTRAÇÃO (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE auth_user_id = auth.uid()
      AND nivel_acesso = 'admin'
      AND status = 'ativo'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. POLÍTICAS ROW LEVEL SECURITY (RLS) GRANULARES E ROBUSTAS
ALTER TABLE public.subcategorias ENABLE ROW LEVEL SECURITY;

-- Subcategorias: Leitura pública, gravação apenas para admin
DROP POLICY IF EXISTS "Leitura publica subcategorias" ON public.subcategorias;
CREATE POLICY "Leitura publica subcategorias" ON public.subcategorias 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin gerencia subcategorias" ON public.subcategorias;
CREATE POLICY "Admin gerencia subcategorias" ON public.subcategorias 
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Categorias: Leitura pública, escrita apenas admin
DROP POLICY IF EXISTS "Acesso total categorias" ON public.categorias;
DROP POLICY IF EXISTS "Leitura publica categorias" ON public.categorias;
CREATE POLICY "Leitura publica categorias" ON public.categorias FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin gerencia categorias" ON public.categorias;
CREATE POLICY "Admin gerencia categorias" ON public.categorias FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Produtos: Leitura pública de produtos ativos (ou admin vê tudo), escrita admin
DROP POLICY IF EXISTS "Acesso total produtos" ON public.produtos;
DROP POLICY IF EXISTS "Leitura publica produtos" ON public.produtos;
CREATE POLICY "Leitura publica produtos" ON public.produtos FOR SELECT USING (ativo = true OR public.is_admin());

DROP POLICY IF EXISTS "Admin gerencia produtos" ON public.produtos;
CREATE POLICY "Admin gerencia produtos" ON public.produtos FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Catálogos & Banners
DROP POLICY IF EXISTS "Acesso total catalogos" ON public.catalogos;
CREATE POLICY "Leitura publica catalogos" ON public.catalogos FOR SELECT USING (true);
CREATE POLICY "Admin gerencia catalogos" ON public.catalogos FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Acesso total banners" ON public.banners;
CREATE POLICY "Leitura publica banners" ON public.banners FOR SELECT USING (true);
CREATE POLICY "Admin gerencia banners" ON public.banners FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Cupons
DROP POLICY IF EXISTS "Acesso total cupons" ON public.cupons;
CREATE POLICY "Leitura publica cupons ativos" ON public.cupons FOR SELECT USING (ativo = true OR public.is_admin());
CREATE POLICY "Admin gerencia cupons" ON public.cupons FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Usuários: Cliente acessa apenas seu próprio perfil; Admin gerencia todos
DROP POLICY IF EXISTS "Acesso total usuarios" ON public.usuarios;
CREATE POLICY "Usuarios leem proprio perfil ou admin" ON public.usuarios 
FOR SELECT USING (auth_user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Cadastro de novos usuarios" ON public.usuarios 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Usuarios atualizam proprio perfil ou admin" ON public.usuarios 
FOR UPDATE USING (auth_user_id = auth.uid() OR public.is_admin()) 
WITH CHECK (auth_user_id = auth.uid() OR public.is_admin());

-- Pedidos: Cliente vê seus pedidos; Admin vê e atualiza todos; Cliente pode confirmar entrega
DROP POLICY IF EXISTS "Acesso total pedidos" ON public.pedidos;
CREATE POLICY "Clientes leem proprios pedidos ou admin" ON public.pedidos 
FOR SELECT USING (
  public.is_admin() OR 
  usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Criacao de pedidos checkout" ON public.pedidos 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Atualizacao de pedidos" ON public.pedidos 
FOR UPDATE USING (
  public.is_admin() OR 
  (usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()) AND status_pedido IN ('shipped', 'delivered'))
) 
WITH CHECK (
  public.is_admin() OR 
  (usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()) AND status_pedido = 'delivered')
);

-- Itens do Pedido
DROP POLICY IF EXISTS "Acesso total itens_pedido" ON public.itens_pedido;
CREATE POLICY "Leitura itens de pedidos autorizados" ON public.itens_pedido 
FOR SELECT USING (
  public.is_admin() OR 
  pedido_id IN (
    SELECT id FROM public.pedidos 
    WHERE usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
  )
);

CREATE POLICY "Insercao de itens no checkout" ON public.itens_pedido 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin gerencia itens pedido" ON public.itens_pedido 
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Movimentações de Estoque: Apenas Admin
DROP POLICY IF EXISTS "Acesso total movimentacoes_estoque" ON public.movimentacoes_estoque;
CREATE POLICY "Admin gerencia estoque" ON public.movimentacoes_estoque 
FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Configurações da Loja: Leitura pública, escrita apenas Admin
DROP POLICY IF EXISTS "Acesso total configuracoes_loja" ON public.configuracoes_loja;
CREATE POLICY "Leitura publica configuracoes" ON public.configuracoes_loja FOR SELECT USING (true);
CREATE POLICY "Admin gerencia configuracoes" ON public.configuracoes_loja FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
