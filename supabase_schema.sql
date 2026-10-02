-- ===================================================================
-- NOVATECH ANGOLA • SCHEMA OFICIAL DE BANCO DE DADOS (SUPABASE / POSTGRESQL)
-- 100% EM PORTUGUES DO BRASIL • SEM ACENTOS • SEM DADOS FICTICIOS
-- PADRAO INDUSTRIAL: TABELAS, RELACIONAMENTOS, INDICES, RLS E TRIGGERS
-- ===================================================================

-- Extensoes necessarias para seguranca e UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===================================================================
-- 1. FUNCAO UTILITARIA: ATUALIZACAO AUTOMATICA DO CAMPO 'atualizado_em'
-- ===================================================================
CREATE OR REPLACE FUNCTION public.funcao_atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- 2. TABELA: usuarios (Clientes e Administradores)
-- Contem endereco completo e ponto de referencia
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_user_id UUID UNIQUE,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash TEXT,
  telefone VARCHAR(50),
  whatsapp VARCHAR(50),
  nivel_acesso VARCHAR(50) DEFAULT 'cliente' NOT NULL, -- 'cliente' ou 'admin'
  status VARCHAR(50) DEFAULT 'ativo' NOT NULL,        -- 'ativo' ou 'bloqueado'
  ativo BOOLEAN DEFAULT TRUE NOT NULL,
  endereco TEXT,                                      -- Endereco do usuario
  ponto_referencia TEXT,                              -- Ponto de referencia
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_nivel_acesso ON public.usuarios(nivel_acesso);
CREATE INDEX IF NOT EXISTS idx_usuarios_auth_user_id ON public.usuarios(auth_user_id);

CREATE OR REPLACE TRIGGER trigger_usuarios_atualizado_em
BEFORE UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- ===================================================================
-- 3. TABELA: categorias (Departamentos do Ecommerce)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.categorias (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  icone VARCHAR(100) DEFAULT 'package',
  imagem_url TEXT,
  banner_url TEXT,
  subcategorias JSONB DEFAULT '[]'::jsonb,
  ordem_exibicao INT DEFAULT 1 NOT NULL,
  ativo BOOLEAN DEFAULT TRUE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categorias_slug ON public.categorias(slug);
CREATE INDEX IF NOT EXISTS idx_categorias_ativo ON public.categorias(ativo);
CREATE INDEX IF NOT EXISTS idx_categorias_ordem ON public.categorias(ordem_exibicao);

CREATE OR REPLACE TRIGGER trigger_categorias_atualizado_em
BEFORE UPDATE ON public.categorias
FOR EACH ROW EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- ===================================================================
-- 4. TABELA: catalogos (Colecoes, Destaques, Ofertas da Loja)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.catalogos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  texto_destaque VARCHAR(100),
  ordem_exibicao INT DEFAULT 1 NOT NULL,
  ativo BOOLEAN DEFAULT TRUE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catalogos_slug ON public.catalogos(slug);
CREATE INDEX IF NOT EXISTS idx_catalogos_ativo ON public.catalogos(ativo);

CREATE OR REPLACE TRIGGER trigger_catalogos_atualizado_em
BEFORE UPDATE ON public.catalogos
FOR EACH ROW EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- ===================================================================
-- 5. TABELA: produtos (Catalogo Comercial de Produtos da Loja)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.produtos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  marca VARCHAR(100) NOT NULL DEFAULT 'NovaTech',
  categoria_id BIGINT REFERENCES public.categorias(id) ON DELETE SET NULL,
  catalogo_id BIGINT REFERENCES public.catalogos(id) ON DELETE SET NULL,
  preco NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  preco_antigo NUMERIC(15, 2),
  estoque INT NOT NULL DEFAULT 0,
  estoque_minimo INT NOT NULL DEFAULT 2,
  permitir_venda_sem_estoque BOOLEAN DEFAULT FALSE NOT NULL,
  ativo BOOLEAN DEFAULT TRUE NOT NULL,
  destaque BOOLEAN DEFAULT FALSE NOT NULL,
  oferta BOOLEAN DEFAULT FALSE NOT NULL,
  novo BOOLEAN DEFAULT FALSE NOT NULL,
  imagem_principal TEXT NOT NULL,
  video_url TEXT,
  galeria JSONB DEFAULT '[]'::jsonb,
  variacoes JSONB DEFAULT '{}'::jsonb,
  especificacoes JSONB DEFAULT '{}'::jsonb,
  etiquetas JSONB DEFAULT '[]'::jsonb,
  avaliacao_media NUMERIC(3, 2) DEFAULT 5.00,
  total_avaliacoes INT DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_produtos_slug ON public.produtos(slug);
CREATE INDEX IF NOT EXISTS idx_produtos_sku ON public.produtos(sku);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON public.produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_produtos_catalogo ON public.produtos(catalogo_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON public.produtos(ativo);
CREATE INDEX IF NOT EXISTS idx_produtos_oferta ON public.produtos(oferta);
CREATE INDEX IF NOT EXISTS idx_produtos_destaque ON public.produtos(destaque);

CREATE OR REPLACE TRIGGER trigger_produtos_atualizado_em
BEFORE UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- ===================================================================
-- 6. TABELA: banners (Banners Comerciais da Pagina Inicial / Vitrine)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.banners (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  destaque VARCHAR(255),
  subtitulo TEXT,
  texto_badge VARCHAR(100) DEFAULT 'NOVIDADE',
  preco NUMERIC(15, 2),
  preco_antigo NUMERIC(15, 2),
  etiqueta_especificacao_1 VARCHAR(150),
  etiqueta_especificacao_2 VARCHAR(150),
  cor_destaque VARCHAR(50) DEFAULT '#3b82f6',
  imagem_url TEXT NOT NULL,
  texto_botao VARCHAR(100) DEFAULT 'Comprar Agora',
  link_botao TEXT DEFAULT '#/catalogo',
  ordem_exibicao INT DEFAULT 1 NOT NULL,
  ativo BOOLEAN DEFAULT TRUE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_banners_ativo ON public.banners(ativo);
CREATE INDEX IF NOT EXISTS idx_banners_ordem ON public.banners(ordem_exibicao);

CREATE OR REPLACE TRIGGER trigger_banners_atualizado_em
BEFORE UPDATE ON public.banners
FOR EACH ROW EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- ===================================================================
-- 7. TABELA: cupons (Cupons Promocionais de Desconto)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.cupons (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo VARCHAR(100) NOT NULL UNIQUE,
  tipo_desconto VARCHAR(50) NOT NULL DEFAULT 'percentage', -- 'percentage' ou 'fixed'
  valor_desconto NUMERIC(15, 2) NOT NULL,
  valor_minimo_pedido NUMERIC(15, 2) DEFAULT 0.00,
  desconto_maximo NUMERIC(15, 2),
  limite_uso INT DEFAULT 100,
  total_usado INT DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE NOT NULL,
  data_inicio TIMESTAMPTZ DEFAULT NOW(),
  data_fim TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cupons_codigo ON public.cupons(codigo);
CREATE INDEX IF NOT EXISTS idx_cupons_ativo ON public.cupons(ativo);

CREATE OR REPLACE TRIGGER trigger_cupons_atualizado_em
BEFORE UPDATE ON public.cupons
FOR EACH ROW EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- ===================================================================
-- 8. TABELA: pedidos (Encomendas Oficiais dos Clientes)
-- Contem endereco completo e ponto de referencia da entrega
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.pedidos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_pedido VARCHAR(100) NOT NULL UNIQUE,
  usuario_id BIGINT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  nome_cliente VARCHAR(255) NOT NULL,
  email_cliente VARCHAR(255) NOT NULL,
  telefone_cliente VARCHAR(50) NOT NULL,
  whatsapp_cliente VARCHAR(50),
  endereco_entrega TEXT NOT NULL,
  ponto_referencia TEXT,                                     -- Ponto de referencia
  metodo_entrega VARCHAR(50) DEFAULT 'normal' NOT NULL,
  preco_entrega NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
  metodo_pagamento VARCHAR(100) NOT NULL,
  status_pagamento VARCHAR(50) DEFAULT 'pendente' NOT NULL,  -- 'pendente', 'pago', 'cancelado'
  detalhes_pagamento JSONB DEFAULT '{}'::jsonb,
  subtotal NUMERIC(15, 2) NOT NULL,
  desconto NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
  total NUMERIC(15, 2) NOT NULL,
  status_pedido VARCHAR(50) DEFAULT 'recebido' NOT NULL,     -- 'recebido', 'confirmado', 'preparando', 'enviado', 'entregue', 'cancelado'
  notas_admin TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pedidos_codigo ON public.pedidos(codigo_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON public.pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON public.pedidos(status_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_criado_em ON public.pedidos(criado_em DESC);

CREATE OR REPLACE TRIGGER trigger_pedidos_atualizado_em
BEFORE UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- ===================================================================
-- 9. TABELA: itens_pedido (Produtos Comprados em Cada Pedido)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.itens_pedido (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pedido_id BIGINT NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id BIGINT REFERENCES public.produtos(id) ON DELETE SET NULL,
  sku_produto VARCHAR(100),
  nome_produto VARCHAR(255) NOT NULL,
  imagem_produto TEXT,
  variante_selecionada JSONB DEFAULT '{}'::jsonb,
  preco_unitario NUMERIC(15, 2) NOT NULL,
  quantidade INT NOT NULL DEFAULT 1,
  preco_total NUMERIC(15, 2) NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_itens_pedido_pedido ON public.itens_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_produto ON public.itens_pedido(produto_id);

-- ===================================================================
-- 10. TABELA: movimentacoes_estoque (Auditoria de Entradas e Saidas)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.movimentacoes_estoque (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  produto_id BIGINT NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tipo_movimentacao VARCHAR(50) NOT NULL, -- 'entrada', 'saida', 'ajuste'
  quantidade INT NOT NULL,
  estoque_anterior INT NOT NULL DEFAULT 0,
  estoque_novo INT NOT NULL DEFAULT 0,
  motivo TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto ON public.movimentacoes_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_criado_em ON public.movimentacoes_estoque(criado_em DESC);

-- ===================================================================
-- 11. TABELA: configuracoes_loja (Nome, Contatos em Luanda, Custos)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.configuracoes_loja (
  chave VARCHAR(100) PRIMARY KEY,
  valor JSONB NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ===================================================================
-- 12. ROW LEVEL SECURITY (RLS) - PERMISSOES PARA LEITURA E OPERACAO
-- ===================================================================
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_loja ENABLE ROW LEVEL SECURITY;

-- Politicas permissivas para operacao transparente no frontend e admin com anon key e authenticated
DROP POLICY IF EXISTS "Acesso total categorias" ON public.categorias;
CREATE POLICY "Acesso total categorias" ON public.categorias FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total catalogos" ON public.catalogos;
CREATE POLICY "Acesso total catalogos" ON public.catalogos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total produtos" ON public.produtos;
CREATE POLICY "Acesso total produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total banners" ON public.banners;
CREATE POLICY "Acesso total banners" ON public.banners FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total cupons" ON public.cupons;
CREATE POLICY "Acesso total cupons" ON public.cupons FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total usuarios" ON public.usuarios;
CREATE POLICY "Acesso total usuarios" ON public.usuarios FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total pedidos" ON public.pedidos;
CREATE POLICY "Acesso total pedidos" ON public.pedidos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total itens_pedido" ON public.itens_pedido;
CREATE POLICY "Acesso total itens_pedido" ON public.itens_pedido FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total movimentacoes_estoque" ON public.movimentacoes_estoque;
CREATE POLICY "Acesso total movimentacoes_estoque" ON public.movimentacoes_estoque FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total configuracoes_loja" ON public.configuracoes_loja;
CREATE POLICY "Acesso total configuracoes_loja" ON public.configuracoes_loja FOR ALL USING (true) WITH CHECK (true);
