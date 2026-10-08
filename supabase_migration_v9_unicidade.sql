-- ===================================================================
-- MIGRAÇÃO V9: VALIDAÇÃO DE UNICIDADE DE CATEGORIAS E SUBCATEGORIAS
-- NovaTech Angola • Dupla Camada de Proteção (Banco de Dados + Aplicação)
-- ===================================================================

-- 1. Padronização preventiva: converter registros existentes para LETRAS MAIÚSCULAS
UPDATE public.categorias
SET nome = UPPER(TRIM(nome));

UPDATE public.subcategorias
SET nome = UPPER(TRIM(nome));

UPDATE public.produtos
SET nome = UPPER(TRIM(nome));

-- 2. Índice e Restrição de Unicidade Case-Insensitive para CATEGORIAS
-- Garante que não possa existir 'ELETRÔNICOS' e 'eletrônicos' simultaneamente
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_categorias_nome_upper
ON public.categorias (UPPER(TRIM(nome)));

-- 3. Índice e Restrição de Unicidade Case-Insensitive para SUBCATEGORIAS
-- Garante que dentro da mesma categoria não haja 'SAMSUNG' e 'samsung' duplicados
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_subcategorias_categoria_nome_upper
ON public.subcategorias (categoria_id, UPPER(TRIM(nome)));

-- 4. Função e Triggers no Banco de Dados para forçar UPPERCASE automático
-- Mesmo se alguma inserção direta via SQL/API tentar gravar minúsculas,
-- o banco converterá automaticamente para MAIÚSCULAS antes de gravar.

CREATE OR REPLACE FUNCTION public.fn_force_uppercase_entities()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'categorias' THEN
    NEW.nome := UPPER(TRIM(NEW.nome));
  ELSIF TG_TABLE_NAME = 'subcategorias' THEN
    NEW.nome := UPPER(TRIM(NEW.nome));
  ELSIF TG_TABLE_NAME = 'produtos' THEN
    NEW.nome := UPPER(TRIM(NEW.nome));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para Categorias
DROP TRIGGER IF EXISTS trg_categorias_uppercase ON public.categorias;
CREATE TRIGGER trg_categorias_uppercase
BEFORE INSERT OR UPDATE OF nome ON public.categorias
FOR EACH ROW EXECUTE FUNCTION public.fn_force_uppercase_entities();

-- Trigger para Subcategorias
DROP TRIGGER IF EXISTS trg_subcategorias_uppercase ON public.subcategorias;
CREATE TRIGGER trg_subcategorias_uppercase
BEFORE INSERT OR UPDATE OF nome ON public.subcategorias
FOR EACH ROW EXECUTE FUNCTION public.fn_force_uppercase_entities();

-- Trigger para Produtos
DROP TRIGGER IF EXISTS trg_produtos_uppercase ON public.produtos;
CREATE TRIGGER trg_produtos_uppercase
BEFORE INSERT OR UPDATE OF nome ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.fn_force_uppercase_entities();
