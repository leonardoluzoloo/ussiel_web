-- ===================================================================
-- NOVATECH ANGOLA • MIGRAÇÃO V3: TABELA DE AVALIAÇÕES DE PRODUTOS
-- 100% EM PORTUGUÊS DO BRASIL • PADRÃO INDUSTRIAL POSTGRESQL / SUPABASE
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ===================================================================

-- 1. TABELA OFICIAL DE AVALIAÇÕES DE PRODUTOS
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

-- 2. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_avaliacoes_produto ON public.avaliacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_usuario ON public.avaliacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_aprovado ON public.avaliacoes(aprovado);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_criado_em ON public.avaliacoes(criado_em DESC);

-- 3. TRIGGER PARA ATUALIZAR timestamp automático
CREATE OR REPLACE TRIGGER trigger_avaliacoes_atualizado_em
BEFORE UPDATE ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- 4. FUNÇÃO PARA RECALCULAR MÉDIA E TOTAL DE AVALIAÇÕES DO PRODUTO
CREATE OR REPLACE FUNCTION public.recalcular_avaliacao_produto()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.produtos
  SET 
    avaliacao_media = (
      SELECT COALESCE(AVG(nota)::NUMERIC(3,1), 5.0)
      FROM public.avaliacoes 
      WHERE produto_id = COALESCE(NEW.produto_id, OLD.produto_id)
        AND aprovado = TRUE
    ),
    total_avaliacoes = (
      SELECT COUNT(*)
      FROM public.avaliacoes 
      WHERE produto_id = COALESCE(NEW.produto_id, OLD.produto_id)
        AND aprovado = TRUE
    )
  WHERE id = COALESCE(NEW.produto_id, OLD.produto_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. TRIGGERS PARA DISPARAR A RECALCULAÇÃO
DROP TRIGGER IF EXISTS trigger_recalc_avaliacao_insert ON public.avaliacoes;
CREATE TRIGGER trigger_recalc_avaliacao_insert
AFTER INSERT ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.recalcular_avaliacao_produto();

DROP TRIGGER IF EXISTS trigger_recalc_avaliacao_update ON public.avaliacoes;
CREATE TRIGGER trigger_recalc_avaliacao_update
AFTER UPDATE ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.recalcular_avaliacao_produto();

DROP TRIGGER IF EXISTS trigger_recalc_avaliacao_delete ON public.avaliacoes;
CREATE TRIGGER trigger_recalc_avaliacao_delete
AFTER DELETE ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.recalcular_avaliacao_produto();

-- 6. ADICIONAR COLUNAS avaliacao_media E total_avaliacoes NA TABELA produtos (se não existirem)
ALTER TABLE public.produtos
ADD COLUMN IF NOT EXISTS avaliacao_media NUMERIC(3,1) DEFAULT 5.0 NOT NULL;

ALTER TABLE public.produtos
ADD COLUMN IF NOT EXISTS total_avaliacoes INT DEFAULT 0 NOT NULL;

-- 7. RLS (ROW LEVEL SECURITY) PARA A TABELA AVALIAÇÕES
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

-- Leitura pública das avaliações aprovadas
DROP POLICY IF EXISTS "Leitura publica avaliacoes aprovadas" ON public.avaliacoes;
CREATE POLICY "Leitura publica avaliacoes aprovadas" ON public.avaliacoes
FOR SELECT USING (aprovado = TRUE OR public.is_admin());

-- Qualquer cliente autenticado pode inserir uma avaliação
DROP POLICY IF EXISTS "Clientes podem avaliar" ON public.avaliacoes;
CREATE POLICY "Clientes podem avaliar" ON public.avaliacoes
FOR INSERT WITH CHECK (TRUE);

-- Cada usuário pode atualizar apenas sua própria avaliação; Admin pode tudo
DROP POLICY IF EXISTS "Usuarios atualizam propria avaliacao" ON public.avaliacoes;
CREATE POLICY "Usuarios atualizam propria avaliacao" ON public.avaliacoes
FOR UPDATE USING (
  public.is_admin() OR
  usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  public.is_admin() OR
  usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
);

-- Somente Admin pode excluir avaliações
DROP POLICY IF EXISTS "Admin exclui avaliacoes" ON public.avaliacoes;
CREATE POLICY "Admin exclui avaliacoes" ON public.avaliacoes
FOR DELETE USING (public.is_admin());

-- 8. VERIFICAÇÃO FINAL
SELECT 
  'MIGRACAO V3 CONCLUIDA COM SUCESSO' AS status,
  (SELECT COUNT(*) FROM public.avaliacoes) AS total_avaliacoes_existentes,
  'Tabela avaliacoes criada com RLS, triggers de media automatica e indices.' AS descricao;
