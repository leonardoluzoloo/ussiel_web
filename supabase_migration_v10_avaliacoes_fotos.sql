-- ===================================================================
-- MIGRAÇÃO V10: SUPORTE A FOTOS / ANEXOS NAS AVALIAÇÕES DE PRODUTOS
-- NovaTech Angola • Avaliações com Prova Social Real dos Clientes
-- ===================================================================

-- 1. Adicionar coluna fotos (JSONB) na tabela de avaliações caso não exista
ALTER TABLE public.avaliacoes 
ADD COLUMN IF NOT EXISTS fotos JSONB DEFAULT '[]'::jsonb;

-- 2. Índice GIN para consultas eficientes em avaliações com fotos
CREATE INDEX IF NOT EXISTS idx_avaliacoes_fotos 
ON public.avaliacoes USING gin (fotos);

-- 3. Comentário descritivo na coluna
COMMENT ON COLUMN public.avaliacoes.fotos IS 'Lista de URLs ou imagens em Base64 compactado anexadas pelo cliente';
