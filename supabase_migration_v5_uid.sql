-- ===================================================================
-- NOVATECH ANGOLA • MIGRATION V5: ADICIONAR UID EM TODAS AS TABELAS
-- Padrão de identificadores únicos universais (UUID) para URLs e API
-- ===================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. usuarios
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS uid UUID DEFAULT gen_random_uuid() UNIQUE;
UPDATE public.usuarios SET uid = gen_random_uuid() WHERE uid IS NULL;
ALTER TABLE public.usuarios ALTER COLUMN uid SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_uid ON public.usuarios(uid);

-- 2. categorias
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS uid UUID DEFAULT gen_random_uuid() UNIQUE;
UPDATE public.categorias SET uid = gen_random_uuid() WHERE uid IS NULL;
ALTER TABLE public.categorias ALTER COLUMN uid SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categorias_uid ON public.categorias(uid);

-- 3. subcategorias
ALTER TABLE public.subcategorias ADD COLUMN IF NOT EXISTS uid UUID DEFAULT gen_random_uuid() UNIQUE;
UPDATE public.subcategorias SET uid = gen_random_uuid() WHERE uid IS NULL;
ALTER TABLE public.subcategorias ALTER COLUMN uid SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subcategorias_uid ON public.subcategorias(uid);

-- 4. catalogos
ALTER TABLE public.catalogos ADD COLUMN IF NOT EXISTS uid UUID DEFAULT gen_random_uuid() UNIQUE;
UPDATE public.catalogos SET uid = gen_random_uuid() WHERE uid IS NULL;
ALTER TABLE public.catalogos ALTER COLUMN uid SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_catalogos_uid ON public.catalogos(uid);

-- 5. produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS uid UUID DEFAULT gen_random_uuid() UNIQUE;
UPDATE public.produtos SET uid = gen_random_uuid() WHERE uid IS NULL;
ALTER TABLE public.produtos ALTER COLUMN uid SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_produtos_uid ON public.produtos(uid);

-- 6. banners
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS uid UUID DEFAULT gen_random_uuid() UNIQUE;
UPDATE public.banners SET uid = gen_random_uuid() WHERE uid IS NULL;
ALTER TABLE public.banners ALTER COLUMN uid SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_banners_uid ON public.banners(uid);

-- 7. cupons
ALTER TABLE public.cupons ADD COLUMN IF NOT EXISTS uid UUID DEFAULT gen_random_uuid() UNIQUE;
UPDATE public.cupons SET uid = gen_random_uuid() WHERE uid IS NULL;
ALTER TABLE public.cupons ALTER COLUMN uid SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cupons_uid ON public.cupons(uid);

-- 8. pedidos
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS uid UUID DEFAULT gen_random_uuid() UNIQUE;
UPDATE public.pedidos SET uid = gen_random_uuid() WHERE uid IS NULL;
ALTER TABLE public.pedidos ALTER COLUMN uid SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_uid ON public.pedidos(uid);

-- 9. itens_pedido
ALTER TABLE public.itens_pedido ADD COLUMN IF NOT EXISTS uid UUID DEFAULT gen_random_uuid() UNIQUE;
UPDATE public.itens_pedido SET uid = gen_random_uuid() WHERE uid IS NULL;
ALTER TABLE public.itens_pedido ALTER COLUMN uid SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_itens_pedido_uid ON public.itens_pedido(uid);

-- 10. movimentacoes_estoque
ALTER TABLE public.movimentacoes_estoque ADD COLUMN IF NOT EXISTS uid UUID DEFAULT gen_random_uuid() UNIQUE;
UPDATE public.movimentacoes_estoque SET uid = gen_random_uuid() WHERE uid IS NULL;
ALTER TABLE public.movimentacoes_estoque ALTER COLUMN uid SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimentacoes_estoque_uid ON public.movimentacoes_estoque(uid);

-- 11. configuracoes_loja
ALTER TABLE public.configuracoes_loja ADD COLUMN IF NOT EXISTS uid UUID DEFAULT gen_random_uuid() UNIQUE;
UPDATE public.configuracoes_loja SET uid = gen_random_uuid() WHERE uid IS NULL;
ALTER TABLE public.configuracoes_loja ALTER COLUMN uid SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_configuracoes_loja_uid ON public.configuracoes_loja(uid);
