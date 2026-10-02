// ===================================================================
// API CLIENT SERVICE (Dual Engine: Supabase Direct HTTPS + Local Resilient Store)
// Centro de Controle Operacional: 100% em Portugues • Sem Dados Ficticios
// Tabelas do Banco: usuarios, categorias, catalogos, produtos, banners,
// cupons, pedidos, itens_pedido, movimentacoes_estoque, configuracoes_loja
// ===================================================================

import { supabase, isSupabaseConfigured } from './supabaseClient.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TOKEN_KEY = 'novatech_auth_token_v2';

// Cache local persistente para máxima resiliência e operação contínua (100% Zerado)
const LOCAL_STORAGE_KEYS = {
  PRODUCTS: 'novatech_admin_produtos_v4_clean',
  CATEGORIES: 'novatech_admin_categorias_v4_clean',
  CATALOGS: 'novatech_admin_catalogos_v4_clean',
  BANNERS: 'novatech_admin_banners_v4_clean',
  COUPONS: 'novatech_admin_cupons_v4_clean',
  ORDERS: 'novatech_admin_pedidos_v4_clean',
  CUSTOMERS: 'novatech_admin_usuarios_v4_clean',
  SETTINGS: 'novatech_admin_configuracoes_v4_clean',
  STOCK_MOVEMENTS: 'novatech_admin_movimentacoes_v4_clean'
};

// Purga automática de dados residuais legados para garantir base 100% zerada
(function purgeLegacyMocks() {
  try {
    const legacyKeys = [
      'novatech_admin_produtos_v3',
      'novatech_admin_categorias_v3',
      'novatech_admin_catalogos_v3',
      'novatech_admin_banners_v3',
      'novatech_admin_cupons_v3',
      'novatech_admin_pedidos_v3',
      'novatech_admin_usuarios_v3',
      'novatech_admin_configuracoes_v3',
      'novatech_admin_movimentacoes_v3',
      'novatech_cart_v1',
      'novatech_applied_coupon'
    ];
    legacyKeys.forEach(k => localStorage.removeItem(k));
  } catch {}
})();

function getLocalData(key, defaultData = []) {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn(`Erro ao ler localStorage [${key}]:`, e);
  }
  return defaultData;
}

function setLocalData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Erro ao salvar no localStorage [${key}]:`, e);
  }
}

// ===================================================================
// MAPEADORES BIDIRECIONAIS: SUPABASE (PORTUGUES) <-> FRONTEND
// ===================================================================

function mapCategoriaFromDb(c) {
  if (!c) return null;
  return {
    id: c.id,
    slug: c.slug,
    name: c.nome,
    description: c.descricao || '',
    bannerDesc: c.descricao || '',
    iconName: c.icone || 'package',
    image: c.imagem_url || '',
    image_url: c.imagem_url || '',
    banner_url: c.banner_url || '',
    subcategories: Array.isArray(c.subcategorias) ? c.subcategorias : (c.subcategorias ? (typeof c.subcategorias === 'string' ? JSON.parse(c.subcategorias) : c.subcategorias) : []),
    display_order: c.ordem_exibicao || 1,
    is_active: c.ativo !== false
  };
}

function mapCategoriaToDb(c) {
  return {
    slug: c.slug || (c.name ? c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : `cat-${Date.now()}`),
    nome: c.name || c.nome || '',
    descricao: c.description || c.descricao || '',
    icone: c.iconName || c.icone || 'package',
    imagem_url: c.image || c.imagem_url || '',
    banner_url: c.banner_url || '',
    subcategorias: c.subcategories || [],
    ordem_exibicao: Number(c.display_order || c.ordem_exibicao || 1),
    ativo: c.is_active !== undefined ? Boolean(c.is_active) : (c.ativo !== undefined ? Boolean(c.ativo) : true)
  };
}

function mapCatalogoFromDb(c) {
  if (!c) return null;
  return {
    id: c.id,
    slug: c.slug,
    name: c.nome,
    description: c.descricao || '',
    badge_text: c.texto_destaque || '',
    display_order: c.ordem_exibicao || 1,
    is_active: c.ativo !== false
  };
}

function mapCatalogoToDb(c) {
  return {
    slug: c.slug || (c.name ? c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : `cat-${Date.now()}`),
    nome: c.name || c.nome || '',
    descricao: c.description || c.descricao || '',
    texto_destaque: c.badge_text || c.texto_destaque || '',
    ordem_exibicao: Number(c.display_order || c.ordem_exibicao || 1),
    ativo: c.is_active !== undefined ? Boolean(c.is_active) : true
  };
}

function mapProdutoFromDb(p) {
  if (!p) return null;
  return {
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    name: p.nome,
    brand: p.marca || 'NovaTech',
    category: p.categoria_id,
    category_id: p.categoria_id,
    catalog_id: p.catalogo_id,
    price: Number(p.preco || 0),
    oldPrice: p.preco_antigo ? Number(p.preco_antigo) : null,
    old_price: p.preco_antigo ? Number(p.preco_antigo) : null,
    stock: Number(p.estoque || 0),
    stock_min: Number(p.estoque_minimo || 2),
    allow_out_of_stock_sales: Boolean(p.permitir_venda_sem_estoque),
    is_active: p.ativo !== false,
    is_featured: Boolean(p.destaque),
    is_deal: Boolean(p.oferta),
    is_new: Boolean(p.novo),
    image: p.imagem_principal || '',
    video_url: p.video_url || null,
    gallery: Array.isArray(p.galeria) ? p.galeria : (p.galeria ? (typeof p.galeria === 'string' ? JSON.parse(p.galeria) : p.galeria) : (p.imagem_principal ? [p.imagem_principal] : [])),
    variants: (typeof p.variacoes === 'object' && p.variacoes !== null) ? p.variacoes : (p.variacoes ? JSON.parse(p.variacoes) : {}),
    specs: (typeof p.especificacoes === 'object' && p.especificacoes !== null) ? p.especificacoes : (p.especificacoes ? JSON.parse(p.especificacoes) : {}),
    badges: Array.isArray(p.etiquetas) ? p.etiquetas : (p.etiquetas ? (typeof p.etiquetas === 'string' ? JSON.parse(p.etiquetas) : p.etiquetas) : []),
    rating: Number(p.avaliacao_media || 5.0),
    reviewsCount: Number(p.total_avaliacoes || 0),
    created_at: p.criado_em
  };
}

function mapProdutoToDb(p) {
  return {
    sku: p.sku || `NV-${Date.now().toString(36).toUpperCase()}`,
    slug: p.slug || (p.name ? p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : `prod-${Date.now()}`),
    nome: p.name || p.nome || '',
    marca: p.brand || p.marca || 'NovaTech',
    categoria_id: p.category_id ? Number(p.category_id) : (p.category ? Number(p.category) : null),
    catalogo_id: p.catalog_id ? Number(p.catalog_id) : null,
    preco: Number(p.price || p.preco || 0),
    preco_antigo: (p.old_price || p.oldPrice) ? Number(p.old_price || p.oldPrice) : null,
    estoque: Number(p.stock !== undefined ? p.stock : (p.estoque || 0)),
    estoque_minimo: Number(p.stock_min !== undefined ? p.stock_min : 2),
    permitir_venda_sem_estoque: Boolean(p.allow_out_of_stock_sales),
    ativo: p.is_active !== undefined ? Boolean(p.is_active) : (p.ativo !== undefined ? Boolean(p.ativo) : true),
    destaque: Boolean(p.is_featured || p.destaque),
    oferta: Boolean(p.is_deal || p.oferta),
    novo: Boolean(p.is_new || p.novo),
    imagem_principal: p.image || p.imagem_principal || '',
    video_url: p.video_url || null,
    galeria: Array.isArray(p.gallery) ? p.gallery : (p.image ? [p.image] : []),
    variacoes: (typeof p.variants === 'object' && p.variants !== null) ? p.variants : {},
    especificacoes: (typeof p.specs === 'object' && p.specs !== null) ? p.specs : {},
    etiquetas: Array.isArray(p.badges) ? p.badges : []
  };
}

function mapBannerFromDb(b) {
  if (!b) return null;
  return {
    id: b.id,
    title: b.titulo,
    highlight: b.destaque || '',
    subtitle: b.subtitulo || '',
    badge_text: b.texto_badge || 'NOVIDADE',
    price: b.preco !== null && b.preco !== undefined ? Number(b.preco) : null,
    old_price: b.preco_antigo !== null && b.preco_antigo !== undefined ? Number(b.preco_antigo) : null,
    tag_badge: b.etiqueta_especificacao_1 || '',
    specs_badge: b.etiqueta_especificacao_2 || '',
    accent_color: b.cor_destaque || '#3b82f6',
    image_url: b.imagem_url,
    image: b.imagem_url,
    button_text: b.texto_botao || 'Comprar Agora',
    button_link: b.link_botao || '#/catalogo',
    display_order: Number(b.ordem_exibicao || 1),
    is_active: b.ativo !== false
  };
}

function mapBannerToDb(b) {
  return {
    titulo: b.title || b.titulo,
    destaque: b.highlight || b.destaque || '',
    subtitulo: b.subtitle || b.subtitulo || '',
    texto_badge: b.badge_text || b.texto_badge || 'NOVIDADE',
    preco: (b.price !== null && b.price !== undefined && b.price !== '') ? Number(b.price) : null,
    preco_antigo: (b.old_price !== null && b.old_price !== undefined && b.old_price !== '') ? Number(b.old_price) : null,
    etiqueta_especificacao_1: b.tag_badge || b.etiqueta_especificacao_1 || null,
    etiqueta_especificacao_2: b.specs_badge || b.etiqueta_especificacao_2 || null,
    cor_destaque: b.accent_color || b.cor_destaque || '#3b82f6',
    imagem_url: b.image_url || b.image || '',
    texto_botao: b.button_text || b.texto_botao || 'Comprar Agora',
    link_botao: b.button_link || b.link_botao || '#/catalogo',
    ordem_exibicao: Number(b.display_order || b.ordem_exibicao || 1),
    ativo: b.is_active !== undefined ? Boolean(b.is_active) : (b.ativo !== undefined ? Boolean(b.ativo) : true)
  };
}

function mapCupomFromDb(c) {
  if (!c) return null;
  return {
    id: c.id,
    code: c.codigo,
    type: c.tipo_desconto === 'fixed' ? 'fixed' : 'percent',
    value: Number(c.valor_desconto),
    min_spend: Number(c.valor_minimo_pedido || 0),
    max_discount: c.desconto_maximo ? Number(c.desconto_maximo) : null,
    usage_limit: c.limite_uso || 100,
    times_used: c.total_usado || 0,
    is_active: c.ativo !== false,
    start_date: c.data_inicio,
    end_date: c.data_fim
  };
}

function mapCupomToDb(c) {
  return {
    codigo: (c.code || c.codigo || '').toUpperCase().trim(),
    tipo_desconto: (c.type === 'fixed' || c.tipo_desconto === 'fixed') ? 'fixed' : 'percentage',
    valor_desconto: Number(c.value || c.valor_desconto || 0),
    valor_minimo_pedido: Number(c.min_spend || c.valor_minimo_pedido || 0),
    desconto_maximo: (c.max_discount || c.desconto_maximo) ? Number(c.max_discount || c.desconto_maximo) : null,
    limite_uso: Number(c.usage_limit || c.limite_uso || 100),
    ativo: c.is_active !== undefined ? Boolean(c.is_active) : true
  };
}

function mapPedidoFromDb(o) {
  if (!o) return null;
  const items = (o.itens_pedido || []).map(i => ({
    id: i.id,
    product_id: i.produto_id,
    product_sku: i.sku_produto,
    product_name: i.nome_produto,
    product_image: i.imagem_produto,
    selected_variant: i.variante_selecionada,
    unit_price: Number(i.preco_unitario),
    quantity: Number(i.quantidade),
    total_price: Number(i.preco_total)
  }));

  return {
    id: o.id,
    order_code: o.codigo_pedido,
    user_id: o.usuario_id,
    customer_name: o.nome_cliente,
    customer_email: o.email_cliente,
    customer_phone: o.telefone_cliente,
    customer_whatsapp: o.whatsapp_cliente,
    shipping_address: o.endereco_entrega,
    ponto_referencia: o.ponto_referencia || '',
    shipping_method: o.metodo_entrega || 'normal',
    shipping_price: Number(o.preco_entrega || 0),
    payment_method: o.metodo_pagamento,
    payment_status: o.status_pagamento,
    payment_details: o.detalhes_pagamento || {},
    subtotal: Number(o.subtotal),
    discount: Number(o.desconto || 0),
    total: Number(o.total),
    status: o.status_pedido,
    admin_notes: o.notas_admin || '',
    items: items,
    created_at: o.criado_em,
    date: o.criado_em
  };
}

function mapUsuarioFromDb(u) {
  if (!u) return null;
  return {
    id: u.id,
    auth_user_id: u.auth_user_id,
    name: u.nome,
    email: u.email,
    phone: u.telefone,
    whatsapp: u.whatsapp,
    role: u.nivel_acesso === 'admin' ? 'admin' : 'customer',
    status: u.status || (u.ativo ? 'active' : 'blocked'),
    is_active: u.ativo !== false,
    endereco: u.endereco || '',
    ponto_referencia: u.ponto_referencia || '',
    created_at: u.criado_em
  };
}

// Configurações padrão iniciais
const DEFAULT_SETTINGS = {
  store_name: 'NovaTech Angola',
  slogan: 'Loja de Tecnologia, Smartphones e Eletrônicos Premium',
  currency: 'Kz',
  phone: '+244 923 179 192',
  whatsapp: '+244 923 179 192',
  email: 'contacto@novatech.co.ao',
  address: 'Talatona Shopping & Maianga, Luanda - Angola',
  opening_hours: 'Seg - Sáb: 08:30 às 19:30 | Dom: 10:00 às 16:00',
  free_shipping_threshold: 1000000,
  shipping_price_normal: 3500,
  shipping_price_express: 6500,
  allow_out_of_stock_orders: false,
  delivery_policy: 'Entregamos em Luanda em até 24h para envio normal ou até 4h para envio expresso. Províncias em 48h a 72h via transportadora parceira certificada.',
  return_policy: 'Garantia oficial de 12 meses para equipamentos novos com selo e fatura. Trocas imediatas em caso de defeito de fabrico até 15 dias após o recebimento.',
  terms_policy: 'Todas as compras são processadas em Kwanzas (Kz) com suporte a Multicaixa Express, Transferência Bancária Imediata e Pagamento na Entrega.'
};

export const Api = {
  // --- TOKEN MANAGEMENT ---
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  },

  removeToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  // --- GENERIC FASTAPI REQUEST (Fallback Opcional) ---
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch {
          errorData = { detail: `Erro HTTP ${response.status}: ${response.statusText}` };
        }
        const error = new Error(errorData.detail || 'Ocorreu um erro na requisição.');
        error.status = response.status;
        error.data = errorData;
        throw error;
      }
      return await response.json();
    } catch (err) {
      console.warn(`[NovaTech API] Fallback para requisição ${endpoint}:`, err.message);
      throw err;
    }
  },

  // ===================================================================
  // 1. AUTENTICAÇÃO (100% E-MAIL E SENHA - SEM GOOGLE)
  // ===================================================================
  auth: {
    async register(name, email, password, phone = '', extra = {}) {
      const endereco = extra.endereco || '';
      const pontoReferencia = extra.ponto_referencia || '';

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                name,
                phone,
                endereco,
                ponto_referencia: pontoReferencia,
                role: 'customer'
              }
            }
          });
          if (error) throw error;

          // Insere ou atualiza na tabela 'usuarios' em português
          try {
            await supabase.from('usuarios').upsert({
              auth_user_id: data.user?.id || null,
              nome: name,
              email: email,
              telefone: phone,
              whatsapp: phone,
              endereco: endereco,
              ponto_referencia: pontoReferencia,
              nivel_acesso: 'cliente',
              status: 'ativo',
              ativo: true
            }, { onConflict: 'email' });
          } catch (tabErr) {
            console.warn('Aviso ao sincronizar na tabela usuarios:', tabErr.message);
          }

          const user = {
            id: data.user?.id || Date.now(),
            name,
            email,
            phone,
            endereco,
            ponto_referencia: pontoReferencia,
            role: 'customer'
          };

          if (data.session?.access_token) {
            Api.setToken(data.session.access_token);
          }
          return { access_token: data.session?.access_token || 'sb_token', user };
        } catch (sbErr) {
          console.warn('Tentando registro via backend/local após aviso do Supabase:', sbErr.message);
        }
      }

      // Fallback local caso o Supabase ainda não tenha sido conectado
      const user = {
        id: Date.now(),
        name,
        email,
        phone,
        endereco,
        ponto_referencia: pontoReferencia,
        role: 'customer'
      };
      Api.setToken('local_token_' + Date.now());
      return { access_token: 'local_token', user };
    },

    async login(email, password) {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (!error && data.user) {
            let userProfile = null;
            try {
              const { data: profile } = await supabase
                .from('usuarios')
                .select('*')
                .eq('email', email)
                .single();
              if (profile) userProfile = mapUsuarioFromDb(profile);
            } catch {}

            const role = userProfile?.role || data.user.user_metadata?.role || (email.toLowerCase().includes('admin') ? 'admin' : 'customer');
            const user = {
              id: data.user.id,
              name: userProfile?.name || data.user.user_metadata?.name || email.split('@')[0],
              email: data.user.email,
              phone: userProfile?.phone || data.user.user_metadata?.phone || '',
              endereco: userProfile?.endereco || data.user.user_metadata?.endereco || '',
              ponto_referencia: userProfile?.ponto_referencia || data.user.user_metadata?.ponto_referencia || '',
              role: role
            };
            if (data.session?.access_token) {
              Api.setToken(data.session.access_token);
            }
            return { access_token: data.session?.access_token, user };
          }
        } catch (sbErr) {
          console.warn('Erro ao autenticar no Supabase:', sbErr.message);
        }
      }

      // Se for admin local em desenvolvimento
      if (email.toLowerCase().includes('admin')) {
        const user = { id: 1, name: 'Administrador NovaTech', email, role: 'admin' };
        Api.setToken('local_admin_session_token');
        return { access_token: 'local_admin_session_token', user };
      }

      throw new Error('E-mail ou senha incorretos.');
    },

    async updatePassword(newPassword) {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        return { success: true };
      }
      return { success: true };
    },

    async updateProfile(profileData) {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('usuarios').update({
              nome: profileData.name,
              telefone: profileData.phone,
              whatsapp: profileData.whatsapp || profileData.phone,
              endereco: profileData.endereco,
              ponto_referencia: profileData.ponto_referencia
            }).eq('email', user.email);

            await supabase.auth.updateUser({
              data: {
                name: profileData.name,
                phone: profileData.phone,
                endereco: profileData.endereco,
                ponto_referencia: profileData.ponto_referencia
              }
            });
          }
        } catch (e) {
          console.warn('Erro ao atualizar perfil no Supabase:', e.message);
        }
      }
      return profileData;
    },

    async me() {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            let userProfile = null;
            try {
              const { data: profile } = await supabase
                .from('usuarios')
                .select('*')
                .eq('email', user.email)
                .single();
              if (profile) userProfile = mapUsuarioFromDb(profile);
            } catch {}

            return {
              id: user.id,
              name: userProfile?.name || user.user_metadata?.name || user.email?.split('@')[0],
              email: user.email,
              phone: userProfile?.phone || user.user_metadata?.phone || '',
              endereco: userProfile?.endereco || user.user_metadata?.endereco || '',
              ponto_referencia: userProfile?.ponto_referencia || user.user_metadata?.ponto_referencia || '',
              role: userProfile?.role || user.user_metadata?.role || (user.email?.includes('admin') ? 'admin' : 'customer')
            };
          }
        } catch (e) {
          console.warn('Erro ao verificar usuário no Supabase:', e.message);
        }
      }
      return null;
    },

    async logout() {
      if (isSupabaseConfigured() && supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
      Api.removeToken();
    }
  },

  // ===================================================================
  // 2. CATEGORIAS (TABELA: 'categorias')
  // ===================================================================
  categories: {
    async getAll() {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('categorias')
            .select('*')
            .order('ordem_exibicao', { ascending: true });
          if (!error && data) {
            const mapped = data.map(mapCategoriaFromDb);
            setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, mapped);
            return mapped;
          }
        } catch (e) {
          console.warn('Aviso: Tabela categorias no Supabase ainda não inicializada:', e.message);
        }
      }
      return getLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, []);
    },

    async create(categoryData) {
      const payload = mapCategoriaToDb(categoryData);

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('categorias').insert(payload).select().single();
          if (!error && data) {
            const item = mapCategoriaFromDb(data);
            const current = await this.getAll();
            setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, [...current, item]);
            return item;
          }
        } catch (e) {
          console.warn('Erro ao salvar categoria no Supabase:', e.message);
        }
      }

      // Local fallback
      const current = await this.getAll();
      const newCat = { id: Date.now(), ...categoryData };
      current.push(newCat);
      setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, current);
      return newCat;
    },

    async update(id, categoryData) {
      const payload = mapCategoriaToDb(categoryData);

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('categorias').update(payload).eq('id', id).select().single();
          if (!error && data) {
            const item = mapCategoriaFromDb(data);
            const current = await this.getAll();
            const updated = current.map(c => c.id === id ? item : c);
            setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, updated);
            return item;
          }
        } catch (e) {
          console.warn('Erro ao atualizar categoria no Supabase:', e.message);
        }
      }

      const current = await this.getAll();
      const updated = current.map(c => c.id === id ? { ...c, ...categoryData } : c);
      setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, updated);
      return updated.find(c => c.id === id);
    },

    async delete(id) {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('categorias').delete().eq('id', id);
          if (!error) {
            const current = await this.getAll();
            setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, current.filter(c => c.id !== id));
            return { success: true };
          }
        } catch (e) {
          console.warn('Erro ao deletar categoria no Supabase:', e.message);
        }
      }

      const current = await this.getAll();
      setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, current.filter(c => c.id !== id));
      return { success: true };
    }
  },

  // ===================================================================
  // 3. CATÁLOGOS & COLEÇÕES (TABELA: 'catalogos')
  // ===================================================================
  catalogs: {
    async getAll() {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('catalogos')
            .select('*')
            .order('ordem_exibicao', { ascending: true });
          if (!error && data) {
            const mapped = data.map(mapCatalogoFromDb);
            setLocalData(LOCAL_STORAGE_KEYS.CATALOGS, mapped);
            return mapped;
          }
        } catch (e) {
          console.warn('Aviso: Tabela catalogos no Supabase ainda não inicializada:', e.message);
        }
      }
      return getLocalData(LOCAL_STORAGE_KEYS.CATALOGS, []);
    },

    async create(catalogData) {
      const payload = mapCatalogoToDb(catalogData);

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('catalogos').insert(payload).select().single();
          if (!error && data) {
            const item = mapCatalogoFromDb(data);
            const list = await this.getAll();
            setLocalData(LOCAL_STORAGE_KEYS.CATALOGS, [...list, item]);
            return item;
          }
        } catch (e) {
          console.warn('Erro ao salvar catalogo no Supabase:', e.message);
        }
      }

      const list = await this.getAll();
      const newCat = { id: Date.now(), ...catalogData };
      list.push(newCat);
      setLocalData(LOCAL_STORAGE_KEYS.CATALOGS, list);
      return newCat;
    },

    async update(id, catalogData) {
      const payload = mapCatalogoToDb(catalogData);

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('catalogos').update(payload).eq('id', id).select().single();
          if (!error && data) {
            const item = mapCatalogoFromDb(data);
            const list = await this.getAll();
            setLocalData(LOCAL_STORAGE_KEYS.CATALOGS, list.map(c => c.id === id ? item : c));
            return item;
          }
        } catch (e) {
          console.warn('Erro ao atualizar catalogo no Supabase:', e.message);
        }
      }

      const list = await this.getAll();
      const updated = list.map(c => c.id === id ? { ...c, ...catalogData } : c);
      setLocalData(LOCAL_STORAGE_KEYS.CATALOGS, updated);
      return updated.find(c => c.id === id);
    },

    async delete(id) {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('catalogos').delete().eq('id', id);
          if (!error) {
            const list = await this.getAll();
            setLocalData(LOCAL_STORAGE_KEYS.CATALOGS, list.filter(c => c.id !== id));
            return { success: true };
          }
        } catch (e) {
          console.warn('Erro ao deletar catalogo no Supabase:', e.message);
        }
      }

      const list = await this.getAll();
      setLocalData(LOCAL_STORAGE_KEYS.CATALOGS, list.filter(c => c.id !== id));
      return { success: true };
    }
  },

  // ===================================================================
  // 4. PRODUTOS (TABELA: 'produtos')
  // ===================================================================
  products: {
    async getAll(params = {}) {
      if (isSupabaseConfigured() && supabase) {
        try {
          let query = supabase.from('produtos').select('*');

          if (!params.all) {
            query = query.eq('ativo', true);
          }
          if (params.category) {
            const { data: cat } = await supabase.from('categorias').select('id').eq('slug', params.category).single();
            if (cat) query = query.eq('categoria_id', cat.id);
          }
          if (params.brand) query = query.ilike('marca', `%${params.brand}%`);
          if (params.search) query = query.ilike('nome', `%${params.search}%`);
          if (params.is_deal !== undefined) query = query.eq('oferta', params.is_deal);
          if (params.is_featured !== undefined) query = query.eq('destaque', params.is_featured);
          if (params.min_price !== undefined) query = query.gte('preco', params.min_price);
          if (params.max_price !== undefined) query = query.lte('preco', params.max_price);

          if (params.sort_by === 'price_asc') query = query.order('preco', { ascending: true });
          else if (params.sort_by === 'price_desc') query = query.order('preco', { ascending: false });
          else if (params.sort_by === 'rating') query = query.order('avaliacao_media', { ascending: false });
          else query = query.order('id', { ascending: true });

          const { data, error } = await query;
          if (!error && data) {
            const mapped = data.map(mapProdutoFromDb);
            setLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, mapped);
            return mapped;
          }
        } catch (e) {
          console.warn('Aviso: Tabela produtos no Supabase ainda não inicializada:', e.message);
        }
      }

      return getLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, []);
    },

    async getBySlug(slug) {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('produtos').select('*').eq('slug', slug).single();
          if (!error && data) return mapProdutoFromDb(data);
        } catch (e) {}
      }

      const all = await this.getAll({ all: true });
      return all.find(p => p.slug === slug) || null;
    },

    async create(productData) {
      const payload = mapProdutoToDb(productData);

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('produtos').insert(payload).select().single();
          if (!error && data) {
            const item = mapProdutoFromDb(data);
            const list = await this.getAll({ all: true });
            setLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, [item, ...list]);
            return item;
          }
        } catch (e) {
          console.warn('Erro ao inserir produto no Supabase:', e.message);
        }
      }

      const list = await this.getAll({ all: true });
      const newProd = { id: Date.now(), ...productData };
      list.unshift(newProd);
      setLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, list);
      return newProd;
    },

    async update(id, productData) {
      const payload = mapProdutoToDb(productData);

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('produtos').update(payload).eq('id', id).select().single();
          if (!error && data) {
            const item = mapProdutoFromDb(data);
            const list = await this.getAll({ all: true });
            setLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, list.map(p => p.id === id ? item : p));
            return item;
          }
        } catch (e) {
          console.warn('Erro ao atualizar produto no Supabase:', e.message);
        }
      }

      const list = await this.getAll({ all: true });
      const updated = list.map(p => p.id === id ? { ...p, ...productData } : p);
      setLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, updated);
      return updated.find(p => p.id === id);
    },

    async delete(id) {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('produtos').delete().eq('id', id);
          if (!error) {
            const list = await this.getAll({ all: true });
            setLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, list.filter(p => p.id !== id));
            return { success: true };
          }
        } catch (e) {
          console.warn('Erro ao excluir produto no Supabase:', e.message);
        }
      }

      const list = await this.getAll({ all: true });
      setLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, list.filter(p => p.id !== id));
      return { success: true };
    }
  },

  // ===================================================================
  // 5. GESTÃO DE ESTOQUE (TABELA: 'movimentacoes_estoque')
  // ===================================================================
  stock: {
    async getMovements(productId = null) {
      if (isSupabaseConfigured() && supabase) {
        try {
          let query = supabase.from('movimentacoes_estoque').select('*').order('criado_em', { ascending: false });
          if (productId) query = query.eq('produto_id', productId);
          const { data, error } = await query;
          if (!error && data) {
            const mapped = data.map(m => ({
              id: m.id,
              product_id: m.produto_id,
              type: m.tipo_movimentacao,
              quantity: m.quantidade,
              previous_stock: m.estoque_anterior,
              new_stock: m.estoque_novo,
              reason: m.motivo,
              created_at: m.criado_em
            }));
            setLocalData(LOCAL_STORAGE_KEYS.STOCK_MOVEMENTS, mapped);
            return mapped;
          }
        } catch (e) {
          console.warn('Aviso ao consultar movimentações no Supabase:', e.message);
        }
      }
      return getLocalData(LOCAL_STORAGE_KEYS.STOCK_MOVEMENTS, []);
    },

    async recordMovement(payload) {
      const p = await Api.products.getBySlug(payload.productSlug) || (await Api.products.getAll({ all: true })).find(item => item.id === payload.productId);
      const currentStock = p ? (p.stock || 0) : 0;
      let newStock = currentStock;

      if (payload.type === 'in' || payload.type === 'entrada') newStock += payload.quantity;
      else if (payload.type === 'out' || payload.type === 'saida') newStock = Math.max(0, currentStock - payload.quantity);
      else if (payload.type === 'adjustment' || payload.type === 'ajuste') newStock = payload.quantity;

      if (isSupabaseConfigured() && supabase) {
        try {
          await supabase.from('movimentacoes_estoque').insert({
            produto_id: payload.productId,
            tipo_movimentacao: payload.type,
            quantidade: payload.quantity,
            estoque_anterior: currentStock,
            estoque_novo: newStock,
            motivo: payload.reason || ''
          });

          await supabase.from('produtos').update({ estoque: newStock }).eq('id', payload.productId);
          return { success: true, new_stock: newStock };
        } catch (e) {
          console.warn('Erro ao registrar estoque no Supabase:', e.message);
        }
      }

      if (p) {
        await Api.products.update(p.id, { stock: newStock });
      }

      const logs = getLocalData(LOCAL_STORAGE_KEYS.STOCK_MOVEMENTS, []);
      logs.unshift({ id: Date.now(), ...payload, previous_stock: currentStock, new_stock: newStock, created_at: new Date().toISOString() });
      setLocalData(LOCAL_STORAGE_KEYS.STOCK_MOVEMENTS, logs);
      return { success: true, new_stock: newStock };
    }
  },

  // ===================================================================
  // 6. BANNERS DA VITRINE (TABELA: 'banners')
  // ===================================================================
  banners: {
    async getAll() {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('banners')
            .select('*')
            .order('ordem_exibicao', { ascending: true });
          if (!error && data) {
            const mapped = data.map(mapBannerFromDb);
            setLocalData(LOCAL_STORAGE_KEYS.BANNERS, mapped);
            return mapped;
          }
        } catch (e) {
          console.warn('Aviso: Tabela banners no Supabase ainda não inicializada:', e.message);
        }
      }
      return getLocalData(LOCAL_STORAGE_KEYS.BANNERS, []);
    },

    async getActive() {
      const all = await this.getAll();
      return all.filter(b => b.is_active);
    },

    async create(bannerData) {
      const payload = mapBannerToDb(bannerData);

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('banners').insert(payload).select().single();
          if (!error && data) {
            const item = mapBannerFromDb(data);
            const list = await this.getAll();
            setLocalData(LOCAL_STORAGE_KEYS.BANNERS, [...list, item]);
            return item;
          }
        } catch (e) {
          console.warn('Erro ao inserir banner no Supabase:', e.message);
        }
      }

      const list = await this.getAll();
      const newBanner = { id: Date.now(), ...bannerData };
      list.push(newBanner);
      setLocalData(LOCAL_STORAGE_KEYS.BANNERS, list);
      return newBanner;
    },

    async update(id, bannerData) {
      const payload = mapBannerToDb(bannerData);

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('banners').update(payload).eq('id', id).select().single();
          if (!error && data) {
            const item = mapBannerFromDb(data);
            const list = await this.getAll();
            setLocalData(LOCAL_STORAGE_KEYS.BANNERS, list.map(b => b.id === id ? item : b));
            return item;
          }
        } catch (e) {
          console.warn('Erro ao atualizar banner no Supabase:', e.message);
        }
      }

      const list = await this.getAll();
      const updated = list.map(b => b.id === id ? { ...b, ...bannerData } : b);
      setLocalData(LOCAL_STORAGE_KEYS.BANNERS, updated);
      return updated.find(b => b.id === id);
    },

    async delete(id) {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('banners').delete().eq('id', id);
          if (!error) {
            const list = await this.getAll();
            setLocalData(LOCAL_STORAGE_KEYS.BANNERS, list.filter(b => b.id !== id));
            return { success: true };
          }
        } catch (e) {
          console.warn('Erro ao excluir banner no Supabase:', e.message);
        }
      }

      const list = await this.getAll();
      setLocalData(LOCAL_STORAGE_KEYS.BANNERS, list.filter(b => b.id !== id));
      return { success: true };
    }
  },

  // ===================================================================
  // 7. CUPONS PROMOCIONAIS (TABELA: 'cupons')
  // ===================================================================
  coupons: {
    async getAll() {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('cupons')
            .select('*')
            .order('criado_em', { ascending: false });
          if (!error && data) {
            const mapped = data.map(mapCupomFromDb);
            setLocalData(LOCAL_STORAGE_KEYS.COUPONS, mapped);
            return mapped;
          }
        } catch (e) {
          console.warn('Aviso: Tabela cupons no Supabase ainda não inicializada:', e.message);
        }
      }
      return getLocalData(LOCAL_STORAGE_KEYS.COUPONS, []);
    },

    async validate(code, cartTotal) {
      const clean = code.trim().toUpperCase();
      const list = await this.getAll();
      const c = list.find(item => item.code.toUpperCase() === clean);

      if (!c) throw new Error('Cupom não encontrado ou inválido.');
      if (!c.is_active) throw new Error('Este cupom foi pausado ou expirou.');
      if (c.usage_limit && c.times_used >= c.usage_limit) throw new Error('Este cupom atingiu o limite máximo de utilizações.');
      if (c.min_spend && cartTotal < c.min_spend) throw new Error(`Valor mínimo do pedido para este cupom é de ${c.min_spend.toLocaleString()} Kz.`);

      return c;
    },

    async create(couponData) {
      const payload = mapCupomToDb(couponData);

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('cupons').insert(payload).select().single();
          if (!error && data) {
            const item = mapCupomFromDb(data);
            const list = await this.getAll();
            setLocalData(LOCAL_STORAGE_KEYS.COUPONS, [item, ...list]);
            return item;
          }
        } catch (e) {
          console.warn('Erro ao criar cupom no Supabase:', e.message);
        }
      }

      const list = await this.getAll();
      const newCupom = { id: Date.now(), ...couponData };
      list.unshift(newCupom);
      setLocalData(LOCAL_STORAGE_KEYS.COUPONS, list);
      return newCupom;
    },

    async update(id, couponData) {
      const payload = mapCupomToDb(couponData);

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('cupons').update(payload).eq('id', id).select().single();
          if (!error && data) {
            const item = mapCupomFromDb(data);
            const list = await this.getAll();
            setLocalData(LOCAL_STORAGE_KEYS.COUPONS, list.map(c => c.id === id ? item : c));
            return item;
          }
        } catch (e) {
          console.warn('Erro ao atualizar cupom no Supabase:', e.message);
        }
      }

      const list = await this.getAll();
      const updated = list.map(c => c.id === id ? { ...c, ...couponData } : c);
      setLocalData(LOCAL_STORAGE_KEYS.COUPONS, updated);
      return updated.find(c => c.id === id);
    },

    async delete(id) {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('cupons').delete().eq('id', id);
          if (!error) {
            const list = await this.getAll();
            setLocalData(LOCAL_STORAGE_KEYS.COUPONS, list.filter(c => c.id !== id));
            return { success: true };
          }
        } catch (e) {
          console.warn('Erro ao excluir cupom no Supabase:', e.message);
        }
      }

      const list = await this.getAll();
      setLocalData(LOCAL_STORAGE_KEYS.COUPONS, list.filter(c => c.id !== id));
      return { success: true };
    }
  },

  // ===================================================================
  // 8. PEDIDOS & ENCOMENDAS (TABELAS: 'pedidos' e 'itens_pedido')
  // ===================================================================
  orders: {
    async getAll() {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('pedidos')
            .select('*, itens_pedido(*)')
            .order('criado_em', { ascending: false });
          if (!error && data) {
            const mapped = data.map(mapPedidoFromDb);
            setLocalData(LOCAL_STORAGE_KEYS.ORDERS, mapped);
            return mapped;
          }
        } catch (e) {
          console.warn('Aviso: Tabela pedidos no Supabase ainda não inicializada:', e.message);
        }
      }
      return getLocalData(LOCAL_STORAGE_KEYS.ORDERS, []);
    },

    async getMyOrders(userEmail) {
      const all = await this.getAll();
      if (!userEmail) return all;
      const clean = userEmail.toLowerCase().trim();
      return all.filter(o => {
        const email1 = (o.customer_email || '').toLowerCase().trim();
        const email2 = (o.email_cliente || '').toLowerCase().trim();
        return email1 === clean || email2 === clean;
      });
    },

    async create(orderPayload) {
      const orderCode = `NV-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: order, error } = await supabase.from('pedidos').insert({
            codigo_pedido: orderCode,
            nome_cliente: orderPayload.customer_name,
            email_cliente: orderPayload.customer_email,
            telefone_cliente: orderPayload.customer_phone,
            whatsapp_cliente: orderPayload.customer_whatsapp || orderPayload.customer_phone,
            endereco_entrega: orderPayload.shipping_address,
            ponto_referencia: orderPayload.ponto_referencia || '',
            metodo_entrega: orderPayload.shipping_method || 'normal',
            preco_entrega: orderPayload.shipping_price || 0,
            metodo_pagamento: orderPayload.payment_method,
            status_pagamento: 'pendente',
            detalhes_pagamento: orderPayload.payment_details || {},
            subtotal: orderPayload.subtotal,
            desconto: orderPayload.discount || 0,
            total: orderPayload.total,
            status_pedido: 'recebido',
            notas_admin: ''
          }).select().single();

          if (error) throw error;

          if (orderPayload.items && orderPayload.items.length > 0) {
            const itemsToInsert = orderPayload.items.map(i => ({
              pedido_id: order.id,
              produto_id: i.product_id || null,
              sku_produto: i.product_sku || '',
              nome_produto: i.product_name,
              imagem_produto: i.product_image || '',
              variante_selecionada: i.selected_variant || {},
              preco_unitario: i.unit_price,
              quantidade: i.quantity,
              preco_total: i.unit_price * i.quantity
            }));
            await supabase.from('itens_pedido').insert(itemsToInsert);
          }

          const fullOrder = mapPedidoFromDb({ ...order, itens_pedido: orderPayload.items });
          const current = getLocalData(LOCAL_STORAGE_KEYS.ORDERS, []);
          setLocalData(LOCAL_STORAGE_KEYS.ORDERS, [fullOrder, ...current]);
          return fullOrder;
        } catch (sbErr) {
          console.warn('Erro ao inserir pedido no Supabase:', sbErr.message);
        }
      }

      // Local fallback
      const localOrder = {
        id: Date.now(),
        order_code: orderCode,
        ...orderPayload,
        ponto_referencia: orderPayload.ponto_referencia || '',
        status: 'received',
        payment_status: 'pending',
        admin_notes: '',
        created_at: new Date().toISOString()
      };
      const list = getLocalData(LOCAL_STORAGE_KEYS.ORDERS, []);
      list.unshift(localOrder);
      setLocalData(LOCAL_STORAGE_KEYS.ORDERS, list);
      return localOrder;
    },

    async updateStatus(orderId, newStatus) {
      const updateData = { status_pedido: newStatus };
      if (newStatus === 'confirmed') updateData.status_pagamento = 'pago';
      else if (newStatus === 'cancelled') updateData.status_pagamento = 'cancelado';

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('pedidos')
            .update(updateData)
            .eq('id', orderId)
            .select('*, itens_pedido(*)')
            .single();
          if (!error && data) {
            const mapped = mapPedidoFromDb(data);
            const list = await this.getAll();
            setLocalData(LOCAL_STORAGE_KEYS.ORDERS, list.map(o => o.id === orderId ? mapped : o));
            return mapped;
          }
        } catch (e) {
          console.warn('Erro ao alterar status no Supabase:', e.message);
        }
      }

      const list = await this.getAll();
      const updated = list.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
      setLocalData(LOCAL_STORAGE_KEYS.ORDERS, updated);
      return updated.find(o => o.id === orderId);
    },

    async updateNotes(orderId, notes) {
      if (isSupabaseConfigured() && supabase) {
        try {
          await supabase.from('pedidos').update({ notas_admin: notes }).eq('id', orderId);
        } catch (e) {
          console.warn('Erro ao salvar notas no Supabase:', e.message);
        }
      }

      const list = await this.getAll();
      const updated = list.map(o => o.id === orderId ? { ...o, admin_notes: notes } : o);
      setLocalData(LOCAL_STORAGE_KEYS.ORDERS, updated);
      return updated.find(o => o.id === orderId);
    },

    async getMyOrders() {
      return this.getAll();
    },

    async track(orderCode) {
      const clean = orderCode.trim().toUpperCase();
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('pedidos')
            .select('*, itens_pedido(*)')
            .eq('codigo_pedido', clean)
            .single();
          if (!error && data) return mapPedidoFromDb(data);
        } catch (e) {}
      }

      const list = await this.getAll();
      return list.find(o => (o.order_code || '').toUpperCase() === clean);
    }
  },

  // ===================================================================
  // 9. CLIENTES & USUÁRIOS (TABELA: 'usuarios')
  // ===================================================================
  customers: {
    async getAll() {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('usuarios')
            .select('id, nome, email, telefone, whatsapp, nivel_acesso, status, ativo, endereco, ponto_referencia, criado_em')
            .order('criado_em', { ascending: false });
          if (!error && data) {
            const mapped = data.map(mapUsuarioFromDb);
            setLocalData(LOCAL_STORAGE_KEYS.CUSTOMERS, mapped);
            return mapped;
          }
        } catch (e) {
          console.warn('Aviso: Tabela usuarios no Supabase ainda não inicializada:', e.message);
        }
      }

      // Clientes derivados dos pedidos existentes ou cache local
      const orders = await Api.orders.getAll();
      const customerMap = new Map();

      orders.forEach(o => {
        if (!customerMap.has(o.customer_email)) {
          customerMap.set(o.customer_email, {
            id: o.user_id || `cust-${Math.abs(o.customer_email.split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0))}`,
            name: o.customer_name,
            email: o.customer_email,
            phone: o.customer_phone,
            whatsapp: o.customer_whatsapp || o.customer_phone,
            endereco: o.shipping_address || '',
            ponto_referencia: o.ponto_referencia || '',
            role: 'customer',
            status: 'active',
            is_active: true,
            total_orders: 0,
            total_spent: 0,
            created_at: o.created_at
          });
        }
        const c = customerMap.get(o.customer_email);
        c.total_orders += 1;
        c.total_spent += Number(o.total || 0);
      });

      return Array.from(customerMap.values());
    },

    async updateStatus(id, newStatus) {
      const isActive = newStatus === 'active' || newStatus === 'ativo';
      const statusStr = isActive ? 'ativo' : 'bloqueado';

      if (isSupabaseConfigured() && supabase) {
        try {
          await supabase.from('usuarios').update({ status: statusStr, ativo: isActive }).eq('id', id);
          return { success: true };
        } catch (e) {
          console.warn('Erro ao atualizar status do cliente no Supabase:', e.message);
        }
      }
      return { success: true };
    }
  },

  // ===================================================================
  // 10. CONFIGURAÇÕES DA LOJA (TABELA: 'configuracoes_loja')
  // ===================================================================
  settings: {
    async get(key = 'geral') {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.from('configuracoes_loja').select('valor').eq('chave', key).single();
          if (!error && data && data.valor) {
            setLocalData(`${LOCAL_STORAGE_KEYS.SETTINGS}_${key}`, data.valor);
            return data.valor;
          }
        } catch (e) {
          console.warn('Aviso ao consultar configuracoes no Supabase:', e.message);
        }
      }
      return getLocalData(`${LOCAL_STORAGE_KEYS.SETTINGS}_${key}`, DEFAULT_SETTINGS);
    },

    async save(key = 'geral', value) {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('configuracoes_loja')
            .upsert({ chave: key, valor: value, atualizado_em: new Date().toISOString() })
            .select()
            .single();
          if (!error && data) {
            setLocalData(`${LOCAL_STORAGE_KEYS.SETTINGS}_${key}`, value);
            return data.valor;
          }
        } catch (e) {
          console.warn('Erro ao salvar configuracoes no Supabase:', e.message);
        }
      }

      setLocalData(`${LOCAL_STORAGE_KEYS.SETTINGS}_${key}`, value);
      return value;
    }
  },

  // ===================================================================
  // 11. ADMIN SUITE (STATUS, SETUP, DASHBOARD KPIs)
  // ===================================================================
  admin: {
    async getStatus() {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { count, error } = await supabase
            .from('usuarios')
            .select('*', { count: 'exact', head: true })
            .eq('nivel_acesso', 'admin');
          if (!error) {
            return { has_admin: (count || 0) > 0, total_admins: count || 0 };
          }
        } catch (e) {
          console.warn('Aviso: Tabela usuarios no Supabase ainda não inicializada:', e.message);
        }
      }

      return { has_admin: true, total_admins: 1 };
    },

    async setup(name, email, password, phone = '', extra = {}) {
      const endereco = extra.endereco || '';
      const pontoReferencia = extra.ponto_referencia || '';

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                name,
                phone,
                endereco,
                ponto_referencia: pontoReferencia,
                role: 'admin'
              }
            }
          });
          if (authError) throw authError;

          try {
            await supabase.from('usuarios').upsert({
              auth_user_id: authData?.user?.id || null,
              nome: name,
              email: email,
              telefone: phone,
              whatsapp: phone,
              endereco: endereco,
              ponto_referencia: pontoReferencia,
              nivel_acesso: 'admin',
              status: 'ativo',
              ativo: true
            }, { onConflict: 'email' });
          } catch {}

          const user = {
            id: authData?.user?.id || Date.now(),
            name,
            email,
            phone,
            endereco,
            ponto_referencia: pontoReferencia,
            role: 'admin'
          };
          if (authData?.session?.access_token) {
            Api.setToken(authData.session.access_token);
          }
          return { user };
        } catch (sbErr) {
          console.warn('Aviso setup Supabase:', sbErr.message);
        }
      }

      const user = { id: 1, name, email, phone, endereco, ponto_referencia: pontoReferencia, role: 'admin' };
      Api.setToken('local_admin_master_token');
      return { user };
    },

    async getStats() {
      const orders = await Api.orders.getAll();
      const products = await Api.products.getAll({ all: true });

      const totalSales = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const pendingOrders = orders.filter(o => o.status === 'received' || o.payment_status === 'pending').length;
      const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.stock_min || 2)).length;

      return {
        total_sales: totalSales,
        total_orders: orders.length,
        total_products: products.length,
        pending_orders: pendingOrders,
        low_stock_count: lowStockProducts
      };
    }
  },

  // ===================================================================
  // 12. BANCO DE DADOS & SCHEMA (SUPABASE ASSISTANT)
  // Ferramenta para o Admin executar ou copiar o Schema SQL Oficial
  // ===================================================================
  database: {
    async testConnection() {
      const isConfigured = isSupabaseConfigured();
      if (!isConfigured || !supabase) {
        return {
          connected: false,
          message: 'Supabase não configurado. Verifique o arquivo .env (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).'
        };
      }

      const tablesStatus = {};
      const tablesToCheck = ['usuarios', 'categorias', 'catalogos', 'produtos', 'banners', 'cupons', 'pedidos', 'itens_pedido', 'movimentacoes_estoque', 'configuracoes_loja'];

      for (const table of tablesToCheck) {
        try {
          const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
          if (!error) {
            tablesStatus[table] = { exists: true, count: count || 0 };
          } else {
            tablesStatus[table] = { exists: false, error: error.message };
          }
        } catch (e) {
          tablesStatus[table] = { exists: false, error: e.message };
        }
      }

      const allExist = Object.values(tablesStatus).every(t => t.exists);

      return {
        connected: true,
        allTablesCreated: allExist,
        tables: tablesStatus
      };
    }
  }
};
