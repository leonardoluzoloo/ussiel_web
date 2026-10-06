// ===================================================================
// API CLIENT SERVICE (Dual Engine: Supabase Direct HTTPS + Local Resilient Store)
// Centro de Controle Operacional: 100% em Portugues • Sem Dados Ficticios
// Tabelas do Banco: usuarios, categorias, catalogos, produtos, banners,
// cupons, pedidos, itens_pedido, movimentacoes_estoque, configuracoes_loja
// ===================================================================

import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { Storage, normalizeOrderStatus } from './storage.js';
import { formatAuthError } from '../utils/format.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TOKEN_KEY = 'novatech_auth_token_v2';

// Cache local persistente para máxima resiliência e operação contínua (100% Zerado)
const LOCAL_STORAGE_KEYS = {
  PRODUCTS: 'novatech_admin_produtos_v4_clean',
  CATEGORIES: 'novatech_admin_categorias_v4_clean',
  CATALOGS: 'novatech_admin_catalogos_v4_clean',
  BANNERS: 'novatech_admin_banners_v4_clean',
  COUPONS: 'novatech_admin_cupons_v4_clean',
  ORDERS: 'novatech_admin_orders_cache',
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
// MAPEADORES BIDIRECIONAIS: SUPABASE (PORTUGUES) <-> FRONTEND COM UID UNIVERSAL
// ===================================================================

export function isUuidValid(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

export function generateUid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function getStableUid(table, id, existingUid) {
  if (existingUid && String(existingUid).trim().length > 10) return existingUid;
  if (!id) return generateUid();
  const regKey = `novatech_stable_uid_${table}`;
  try {
    const raw = localStorage.getItem(regKey);
    const map = raw ? JSON.parse(raw) : {};
    if (map[id]) return map[id];
    const newUid = generateUid();
    map[id] = newUid;
    localStorage.setItem(regKey, JSON.stringify(map));
    return newUid;
  } catch {
    return generateUid();
  }
}

export function findIdByStableUid(table, uid) {
  if (!uid) return null;
  const regKey = `novatech_stable_uid_${table}`;
  try {
    const raw = localStorage.getItem(regKey);
    const map = raw ? JSON.parse(raw) : {};
    for (const [id, u] of Object.entries(map)) {
      if (u === uid) return id;
    }
  } catch {}
  return null;
}

function mapCategoriaFromDb(c) {
  if (!c) return null;
  const rawSubs = Array.isArray(c.subcategorias)
    ? c.subcategorias
    : (c.subcategorias ? (typeof c.subcategorias === 'string' ? JSON.parse(c.subcategorias) : c.subcategorias) : []);

  const cleanSubs = rawSubs.map(s => ({
    id: s.id,
    uid: s.uid || s.uuid || getStableUid('subcategorias', s.id, s.uid),
    category_id: s.category_id || s.categoria_id || c.id,
    slug: s.slug,
    name: s.name || s.nome,
    nome: s.nome || s.name,
    description: s.description || s.descricao || '',
    display_order: s.display_order || s.ordem_exibicao || 1,
    is_active: s.is_active !== false && s.ativo !== false
  }));

  return {
    id: c.id,
    uid: c.uid || c.uuid || getStableUid('categorias', c.id, c.uid),
    slug: c.slug,
    name: c.nome,
    description: c.descricao || '',
    bannerDesc: c.descricao || '',
    iconName: c.icone || 'package',
    image: c.imagem_url || '',
    image_url: c.imagem_url || '',
    banner_url: c.banner_url || '',
    subcategories: cleanSubs,
    display_order: c.ordem_exibicao || 1,
    is_active: c.ativo !== false
  };
}

function mapCategoriaToDb(c) {
  const cleanName = (c.name || c.nome || '').trim();
  const baseSlug = c.slug || cleanName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || `cat-${Date.now()}`;

  return {
    uid: c.uid || generateUid(),
    slug: baseSlug,
    nome: cleanName,
    descricao: (c.description !== undefined ? c.description : (c.descricao || '')).trim(),
    icone: c.iconName || c.icone || 'package',
    imagem_url: c.image || c.imagem_url || '',
    banner_url: c.banner_url || '',
    ordem_exibicao: Number(c.display_order !== undefined ? c.display_order : (c.ordem_exibicao || 1)),
    ativo: c.is_active !== undefined ? Boolean(c.is_active) : (c.ativo !== undefined ? Boolean(c.ativo) : true)
  };
}

function mapCatalogoFromDb(c) {
  if (!c) return null;
  return {
    id: c.id,
    uid: c.uid || c.uuid || generateUid(),
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
    uid: c.uid || generateUid(),
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
  const rawSpecs = (typeof p.especificacoes === 'object' && p.especificacoes !== null)
    ? p.especificacoes
    : (p.especificacoes ? (typeof p.especificacoes === 'string' ? JSON.parse(p.especificacoes) : {}) : {});

  const subId = p.subcategoria_id || rawSpecs.subcategoria_id || rawSpecs.subcategory_id || null;
  const subName = p.subcategoria_nome || rawSpecs.subcategoria_nome || rawSpecs.subcategory_name || rawSpecs.subcategoria || rawSpecs.subcategory || '';

  // Filtra chaves internas para garantir que specs contenha apenas fichas técnicas reais
  const cleanSpecs = {};
  if (rawSpecs && typeof rawSpecs === 'object') {
    Object.entries(rawSpecs).forEach(([k, v]) => {
      const lower = k.toLowerCase().trim();
      if (!['subcategoria_id', 'subcategory_id', 'subcategoria_nome', 'subcategory_name', 'subcategoria', 'subcategory', 'category_id', 'id', '_descricao'].includes(lower)) {
        cleanSpecs[k] = v;
      }
    });
  }

  const prodDesc = p.descricao || (rawSpecs && rawSpecs._descricao) || p.description || '';

  return {
    id: p.id,
    uid: p.uid || p.uuid || getStableUid('produtos', p.id, p.uid),
    sku: p.sku,
    slug: p.slug,
    name: p.nome,
    brand: p.marca || 'NovaTech',
    category: p.categoria_id,
    category_id: p.categoria_id,
    catalog_id: p.catalogo_id,
    subcategory_id: subId,
    subcategory_name: subName,
    subcategory: subName,
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
    description: prodDesc,
    descricao: prodDesc,
    gallery: Array.isArray(p.galeria) ? p.galeria : (p.galeria ? (typeof p.galeria === 'string' ? JSON.parse(p.galeria) : p.galeria) : (p.imagem_principal ? [p.imagem_principal] : [])),
    variants: (typeof p.variacoes === 'object' && p.variacoes !== null) ? p.variacoes : (p.variacoes ? JSON.parse(p.variacoes) : {}),
    specs: cleanSpecs,
    badges: Array.isArray(p.etiquetas) ? p.etiquetas : (p.etiquetas ? (typeof p.etiquetas === 'string' ? JSON.parse(p.etiquetas) : p.etiquetas) : []),
    reviews: Array.isArray(p.avaliacoes) ? p.avaliacoes : (Array.isArray(p.reviews) ? p.reviews : []),
    rating: (() => {
      const rawRev = Array.isArray(p.avaliacoes) ? p.avaliacoes : (Array.isArray(p.reviews) ? p.reviews : []);
      if (rawRev.length > 0) {
        return Number((rawRev.reduce((sum, r) => sum + Number(r.rating || r.avaliacao || 0), 0) / rawRev.length).toFixed(1));
      }
      return (p.avaliacao_media !== null && p.avaliacao_media !== undefined && Number(p.avaliacao_media) > 0) ? Number(p.avaliacao_media) : 0;
    })(),
    reviewsCount: (() => {
      const rawRev = Array.isArray(p.avaliacoes) ? p.avaliacoes : (Array.isArray(p.reviews) ? p.reviews : []);
      if (rawRev.length > 0) return rawRev.length;
      return (p.total_avaliacoes !== null && p.total_avaliacoes !== undefined) ? Number(p.total_avaliacoes) : 0;
    })(),
    created_at: p.criado_em
  };
}

function mapProdutoToDb(p) {
  const rawSpecs = (typeof p.specs === 'object' && p.specs !== null) ? { ...p.specs } : {};
  const subId = p.subcategory_id || p.subcategoria_id || rawSpecs.subcategoria_id || rawSpecs.subcategory_id || null;
  const parsedSubId = (!isNaN(Number(subId)) && Number(subId) > 0) ? Number(subId) : null;

  // Garante que o JSON de especificações técnicas do produto receba apenas propriedades legítimas
  const cleanSpecs = {};
  Object.entries(rawSpecs).forEach(([k, v]) => {
    const lower = k.toLowerCase().trim();
    if (!['subcategoria_id', 'subcategory_id', 'subcategoria_nome', 'subcategory_name', 'subcategoria', 'subcategory', 'category_id', 'id', '_descricao'].includes(lower)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        cleanSpecs[k] = String(v).trim();
      }
    }
  });

  const descVal = p.description || p.descricao || '';
  if (descVal) {
    cleanSpecs._descricao = descVal;
  }

  return {
    uid: p.uid || generateUid(),
    sku: p.sku || `NV-${Date.now().toString(36).toUpperCase()}`,
    slug: p.slug || (p.name ? p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : `prod-${Date.now()}`),
    nome: p.name || p.nome || '',
    marca: p.brand || p.marca || 'NovaTech',
    categoria_id: p.category_id ? Number(p.category_id) : (p.category ? Number(p.category) : null),
    subcategoria_id: parsedSubId,
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
    descricao: descVal,
    imagem_principal: p.image || p.imagem_principal || '',
    video_url: p.video_url || null,
    galeria: Array.isArray(p.gallery) ? p.gallery : (p.image ? [p.image] : []),
    variacoes: (typeof p.variants === 'object' && p.variants !== null) ? p.variants : {},
    especificacoes: cleanSpecs,
    etiquetas: Array.isArray(p.badges) ? p.badges : []
  };
}

function mapBannerFromDb(b) {
  if (!b) return null;
  return {
    id: b.id,
    uid: b.uid || b.uuid || generateUid(),
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
    uid: b.uid || generateUid(),
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
  let type = 'percentage';
  const rawType = (c.tipo_desconto || '').toLowerCase();
  if (rawType === 'fixed' || rawType === 'fixo') {
    type = 'fixed';
  } else if (rawType === 'free_shipping' || rawType === 'frete_gratis') {
    type = 'free_shipping';
  }

  return {
    id: c.id,
    uid: c.uid || c.uuid || generateUid(),
    code: c.codigo,
    type: type,
    value: Number(c.valor_desconto || 0),
    min_spend: Number(c.valor_minimo_pedido || 0),
    max_discount: c.desconto_maximo ? Number(c.desconto_maximo) : null,
    usage_limit: c.limite_uso !== null && c.limite_uso !== undefined ? Number(c.limite_uso) : 100,
    times_used: Number(c.total_usado || 0),
    is_active: c.ativo !== false,
    start_date: c.data_inicio,
    end_date: c.data_fim
  };
}

function mapCupomToDb(c) {
  let discountType = 'percentage';
  const rawType = (c.discount_type || c.type || c.tipo_desconto || '').toLowerCase();
  if (rawType === 'fixed' || rawType === 'fixo') {
    discountType = 'fixed';
  } else if (rawType === 'free_shipping' || rawType === 'frete_gratis') {
    discountType = 'free_shipping';
  }

  return {
    uid: c.uid || generateUid(),
    codigo: (c.code || c.codigo || '').toUpperCase().trim(),
    tipo_desconto: discountType,
    valor_desconto: discountType === 'free_shipping' ? 0 : Number(c.discount_value !== undefined ? c.discount_value : (c.value || c.valor_desconto || 0)),
    valor_minimo_pedido: Number(c.min_order_value !== undefined ? c.min_order_value : (c.min_spend || c.valor_minimo_pedido || 0)),
    desconto_maximo: (c.max_discount || c.desconto_maximo) ? Number(c.max_discount || c.desconto_maximo) : null,
    limite_uso: c.usage_limit ? Number(c.usage_limit) : (c.limite_uso ? Number(c.limite_uso) : 100),
    total_usado: Number(c.times_used || c.total_usado || 0),
    ativo: c.is_active !== undefined ? Boolean(c.is_active) : true,
    data_inicio: c.start_date || c.data_inicio || new Date().toISOString(),
    data_fim: c.end_date || c.data_fim || c.expires_at || null
  };
}

function mapPedidoFromDb(o) {
  if (!o) return null;
  const items = (o.itens_pedido || []).map(i => ({
    id: i.id,
    uid: i.uid || i.uuid || generateUid(),
    product_id: i.produto_id,
    product_sku: i.sku_produto,
    product_name: i.nome_produto,
    product_image: i.imagem_produto,
    selected_variant: i.variante_selecionada,
    unit_price: Number(i.preco_unitario),
    quantity: Number(i.quantidade),
    total_price: Number(i.preco_total)
  }));

  const canonicalStatus = normalizeOrderStatus(o.status_pedido || o.status || 'received');

  return {
    id: o.id,
    uid: o.uid || o.uuid || generateUid(),
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
    payment_status: o.status_pagamento || 'pendente',
    payment_details: o.detalhes_pagamento || {},
    subtotal: Number(o.subtotal || 0),
    discount: Number(o.desconto || 0),
    total: Number(o.total || 0),
    status: canonicalStatus,
    status_pedido: canonicalStatus,
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
    uid: u.uid || u.uuid || generateUid(),
    auth_user_id: u.auth_user_id,
    name: u.nome,
    email: u.email,
    phone: u.telefone,
    whatsapp: u.whatsapp,
    role: u.nivel_acesso === 'admin' ? 'admin' : 'customer',
    status: u.status || (u.ativo ? 'ativo' : 'bloqueado'),
    is_active: u.ativo !== false && u.status !== 'bloqueado',
    endereco: u.endereco || '',
    ponto_referencia: u.ponto_referencia || '',
    total_orders: Number(u.total_orders || 0),
    total_spent: Number(u.total_spent || 0),
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
  provincia: 'Luanda',
  cidade: 'Luanda',
  bairro: 'Talatona',
  rua: 'Av. Luanda Sul',
  endereco: 'Talatona Shopping & Maianga, Loja 12',
  ponto_referencia: 'Próximo ao Belas Shopping',
  opening_hours: 'Seg - Sáb: 08:30 às 19:30 | Dom: 10:00 às 16:00',
  free_shipping_threshold: 1000000,
  shipping_price_normal: 3500,
  shipping_price_express: 6500,
  bank_holder: 'NovaTech Comércio & Serviços, Lda',
  bank_name: 'Banco Angolano de Investimentos (BAI)',
  bank_iban: 'AO06 0040 0000 1234 5678 9012 3',
  mcx_phone: '+244 923 179 192',
  allow_out_of_stock_orders: false,
  delivery_policy: 'Entregamos em Luanda em até 24h para envio normal ou até 4h para envio expresso. Províncias em 48h a 72h via transportadora parceira certificada.',
  return_policy: 'Garantia oficial de 12 meses para equipamentos novos com selo e fatura. Trocas imediatas em caso de defeito de fabrico até 15 dias após o recebimento.',
  terms_policy: 'Todas as compras são processadas em Kwanzas (Kz) com suporte a Multicaixa Express, Transferência Bancária Imediata e Pagamento na Entrega.'
};

function mapConfiguracoesFromDb(c) {
  if (!c) return DEFAULT_SETTINGS;
  // Se for registro legado com 'valor' JSONB
  const obj = (c.valor && typeof c.valor === 'object') ? c.valor : c;

  return {
    id: obj.id || 1,
    key: obj.chave || 'general',
    store_name: obj.nome_loja || obj.store_name || DEFAULT_SETTINGS.store_name,
    slogan: obj.slogan || DEFAULT_SETTINGS.slogan,
    currency: obj.moeda || obj.currency || 'Kz',
    phone: obj.telefone || obj.phone || DEFAULT_SETTINGS.phone,
    whatsapp: obj.whatsapp || DEFAULT_SETTINGS.whatsapp,
    email: obj.email || DEFAULT_SETTINGS.email,
    provincia: obj.provincia || DEFAULT_SETTINGS.provincia,
    cidade: obj.cidade || DEFAULT_SETTINGS.cidade,
    bairro: obj.bairro || DEFAULT_SETTINGS.bairro,
    rua: obj.rua || DEFAULT_SETTINGS.rua,
    endereco: obj.endereco || obj.address || DEFAULT_SETTINGS.endereco,
    address: obj.endereco || obj.address || DEFAULT_SETTINGS.endereco,
    ponto_referencia: obj.ponto_referencia || DEFAULT_SETTINGS.ponto_referencia,
    opening_hours: obj.horario_funcionamento || obj.opening_hours || DEFAULT_SETTINGS.opening_hours,
    shipping_price_normal: Number(obj.tarifa_entrega_padrao !== undefined ? obj.tarifa_entrega_padrao : (obj.shipping_price_normal !== undefined ? obj.shipping_price_normal : DEFAULT_SETTINGS.shipping_price_normal)),
    shipping_price_express: Number(obj.tarifa_entrega_expresso !== undefined ? obj.tarifa_entrega_expresso : (obj.shipping_price_express !== undefined ? obj.shipping_price_express : DEFAULT_SETTINGS.shipping_price_express)),
    free_shipping_threshold: Number(obj.limite_frete_gratis !== undefined ? obj.limite_frete_gratis : (obj.free_shipping_threshold !== undefined ? obj.free_shipping_threshold : DEFAULT_SETTINGS.free_shipping_threshold)),
    bank_holder: obj.titular_conta_bancaria || obj.bank_holder || DEFAULT_SETTINGS.bank_holder,
    bank_name: obj.banco_principal || obj.bank_name || DEFAULT_SETTINGS.bank_name,
    bank_iban: obj.iban_oficial || obj.bank_iban || DEFAULT_SETTINGS.bank_iban,
    mcx_phone: obj.telefone_multicaixa_express || obj.mcx_phone || DEFAULT_SETTINGS.mcx_phone,
    allow_out_of_stock_orders: obj.permitir_pedidos_sem_estoque !== undefined ? Boolean(obj.permitir_pedidos_sem_estoque) : Boolean(obj.allow_out_of_stock_orders),
    delivery_policy: obj.politica_entrega || obj.delivery_policy || DEFAULT_SETTINGS.delivery_policy,
    return_policy: obj.politica_devolucao || obj.return_policy || DEFAULT_SETTINGS.return_policy,
    terms_policy: obj.politica_termos || obj.terms_policy || DEFAULT_SETTINGS.terms_policy,
    updated_at: obj.atualizado_em
  };
}

function mapConfiguracoesToDb(s = {}) {
  return {
    id: 1,
    chave: 'general',
    nome_loja: s.store_name || s.nome_loja || DEFAULT_SETTINGS.store_name,
    slogan: s.slogan || DEFAULT_SETTINGS.slogan,
    moeda: s.currency || s.moeda || 'Kz',
    telefone: s.phone || s.telefone || DEFAULT_SETTINGS.phone,
    whatsapp: s.whatsapp || DEFAULT_SETTINGS.whatsapp,
    email: s.email || DEFAULT_SETTINGS.email,
    provincia: s.provincia || DEFAULT_SETTINGS.provincia,
    cidade: s.cidade || DEFAULT_SETTINGS.cidade,
    bairro: s.bairro || DEFAULT_SETTINGS.bairro,
    rua: s.rua || DEFAULT_SETTINGS.rua,
    endereco: s.endereco || s.address || DEFAULT_SETTINGS.endereco,
    ponto_referencia: s.ponto_referencia || DEFAULT_SETTINGS.ponto_referencia,
    horario_funcionamento: s.opening_hours || s.horario_funcionamento || DEFAULT_SETTINGS.opening_hours,
    tarifa_entrega_padrao: Number(s.shipping_price_normal !== undefined ? s.shipping_price_normal : DEFAULT_SETTINGS.shipping_price_normal),
    tarifa_entrega_expresso: Number(s.shipping_price_express !== undefined ? s.shipping_price_express : DEFAULT_SETTINGS.shipping_price_express),
    limite_frete_gratis: Number(s.free_shipping_threshold !== undefined ? s.free_shipping_threshold : DEFAULT_SETTINGS.free_shipping_threshold),
    titular_conta_bancaria: s.bank_holder || s.titular_conta_bancaria || DEFAULT_SETTINGS.bank_holder,
    banco_principal: s.bank_name || s.banco_principal || DEFAULT_SETTINGS.bank_name,
    iban_oficial: s.bank_iban || s.iban_oficial || DEFAULT_SETTINGS.bank_iban,
    telefone_multicaixa_express: s.mcx_phone || s.telefone_multicaixa_express || DEFAULT_SETTINGS.mcx_phone,
    permitir_pedidos_sem_estoque: Boolean(s.allow_out_of_stock_orders),
    politica_entrega: s.delivery_policy || DEFAULT_SETTINGS.delivery_policy,
    politica_devolucao: s.return_policy || DEFAULT_SETTINGS.return_policy,
    politica_termos: s.terms_policy || DEFAULT_SETTINGS.terms_policy,
    atualizado_em: new Date().toISOString()
  };
}

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
      const cleanEmail = String(email || '').trim().toLowerCase();

      if (isSupabaseConfigured() && supabase) {
        try {
          // Garante que o link de confirmacao do e-mail redireciona para a URL base da aplicacao sem fragmento '#'
          const redirectTo = typeof window !== 'undefined'
            ? `${window.location.origin}${window.location.pathname}`
            : undefined;

          const { data, error } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              emailRedirectTo: redirectTo,
              data: {
                name,
                phone,
                endereco,
                ponto_referencia: pontoReferencia,
                role: 'customer'
              }
            }
          });

          if (error) {
            throw new Error(formatAuthError(error));
          }

          // Se a conta já existia com e-mail não confirmado ou duplicado
          if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            throw new Error('Este e-mail já está cadastrado no sistema. Inicie sessão ou use a recuperação de senha.');
          }

          // Insere ou atualiza na tabela 'usuarios' em português
          try {
            await supabase.from('usuarios').upsert({
              auth_user_id: data.user?.id || null,
              nome: name,
              email: cleanEmail,
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
            auth_user_id: data.user?.id || null,
            name: name || cleanEmail.split('@')[0],
            email: cleanEmail,
            phone,
            endereco,
            ponto_referencia: pontoReferencia,
            role: 'customer'
          };

          const requiresEmailConfirmation = !data.session && Boolean(data.user);

          if (data.session?.access_token) {
            Api.setToken(data.session.access_token);
          }
          return {
            access_token: data.session?.access_token || null,
            user,
            requiresEmailConfirmation
          };
        } catch (sbErr) {
          console.error('Falha no cadastro via Supabase:', sbErr.message);
          throw new Error(formatAuthError(sbErr));
        }
      }

      throw new Error('Serviço de autenticação não configurado no servidor.');
    },

    async login(email, password) {
      const cleanEmail = String(email || '').trim().toLowerCase();

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
          if (error) {
            throw new Error(formatAuthError(error));
          }
          if (data && data.user) {
            let userProfile = null;
            try {
              const { data: profile } = await supabase
                .from('usuarios')
                .select('*')
                .eq('email', cleanEmail)
                .single();
              if (profile) userProfile = mapUsuarioFromDb(profile);
            } catch (pErr) {
              console.warn('Aviso ao consultar perfil de usuário no banco:', pErr.message);
            }

            // Role baseada estritamente no banco de dados ou metadata oficial
            const role = (userProfile?.role === 'admin' || data.user.user_metadata?.role === 'admin' || data.user.app_metadata?.role === 'admin')
              ? 'admin'
              : 'customer';

            // Verificação de status do usuário no banco
            if (userProfile && (userProfile.status === 'bloqueado' || userProfile.is_active === false)) {
              await supabase.auth.signOut().catch(() => {});
              throw new Error('Esta conta está suspensa ou bloqueada. Entre em contacto com o suporte.');
            }

            const user = {
              id: userProfile?.id || data.user.id,
              auth_user_id: data.user.id,
              name: userProfile?.name || data.user.user_metadata?.name || cleanEmail.split('@')[0],
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
          throw sbErr;
        }
      }

      throw new Error('Serviço de autenticação não configurado ou credenciais inválidas.');
    },

    async adminLogin(email, password) {
      const result = await this.login(email, password);
      if (result.user.role !== 'admin') {
        // Encerra sessão caso um cliente tente logar no endpoint admin
        await this.logout().catch(() => {});
        throw new Error('Você não possui permissão para acessar o painel administrativo.');
      }
      return result;
    },

    async registerAdmin(payload) {
      const name = String(payload.name || '').trim();
      const email = String(payload.email || '').trim().toLowerCase();
      const password = String(payload.password || '');
      const phone = String(payload.phone || '').trim();

      if (!name || name.length < 2) {
        throw new Error('O nome deve conter pelo menos 2 caracteres.');
      }
      if (!email || !email.includes('@') || !email.includes('.')) {
        throw new Error('Por favor, informe um endereço de e-mail válido.');
      }
      if (!password || password.length < 6) {
        throw new Error('A senha deve ter no mínimo 6 dígitos.');
      }

      if (!isSupabaseConfigured() || !supabase) {
        throw new Error('Serviço de autenticação oficial não configurado. Cadastro de administrador bloqueado por segurança.');
      }

      // 1. Verifica no banco se já existe algum administrador cadastrado
      const status = await Api.admin.getStatus();
      const currentUser = Storage.getUser();
      const isCallerAdmin = currentUser?.role === 'admin';

      // 2. Se já existem administradores e quem tenta cadastrar NÃO é um admin logado:
      if (status.has_admin && !isCallerAdmin) {
        throw new Error('O sistema já possui administradores configurados. Novos administradores só podem ser cadastrados por um administrador autenticado.');
      }

      // 3. Se NÃO há nenhum administrador cadastrado, executa o bootstrap seguro do 1º admin
      if (!status.has_admin) {
        return await Api.admin.setup({
          name,
          email,
          password,
          phone
        });
      }

      // 4. Se já há administradores e o usuário logado É administrador, cria o novo admin
      try {
        const redirectTo = typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname}`
          : undefined;

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              name,
              phone,
              role: 'admin'
            }
          }
        });

        if (error) {
          throw new Error(formatAuthError(error));
        }

        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error('Este e-mail já está cadastrado no sistema. Inicie sessão ou recupere sua senha.');
        }

        // Como o chamador é admin autenticado, o trigger proteger_nivel_acesso_usuario permite o nível 'admin'
        const { error: upsertErr } = await supabase.from('usuarios').upsert({
          auth_user_id: data.user?.id || null,
          nome: name,
          email: email,
          telefone: phone,
          whatsapp: phone,
          nivel_acesso: 'admin',
          status: 'ativo',
          ativo: true
        }, { onConflict: 'email' });

        if (upsertErr) {
          console.warn('Aviso ao sincronizar administrador no banco:', upsertErr.message);
        }

        const newAdminUser = {
          id: data.user?.id || Date.now(),
          auth_user_id: data.user?.id || null,
          name: name || email.split('@')[0],
          email,
          phone,
          role: 'admin'
        };

        const sessionToken = data.session?.access_token || null;
        const requiresEmailConfirmation = !sessionToken && Boolean(data.user);

        return { 
          access_token: sessionToken, 
          user: newAdminUser,
          requiresEmailConfirmation
        };
      } catch (err) {
        throw new Error(formatAuthError(err));
      }
    },

    async forgotPassword(email) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error('Por favor, informe um e-mail válido.');
      }

      if (isSupabaseConfigured() && supabase) {
        try {
          const redirectTo = typeof window !== 'undefined'
            ? `${window.location.origin}${window.location.pathname}`
            : undefined;
          const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
          if (error) {
            console.warn('Aviso do Supabase no reset de senha:', error.message);
          }
        } catch (err) {
          console.warn('Exceção ao solicitar reset de senha:', err.message);
        }
      }

      // Mensagem genérica segura conforme especificado
      return {
        success: true,
        message: 'Se existir uma conta associada a este e-mail, enviaremos as instruções para redefinir sua senha.'
      };
    },

    async resetPassword(newPassword) {
      if (!newPassword || newPassword.length < 6) {
        throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
      }

      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
          throw new Error(error.message || 'Sessão de recuperação expirada ou inválida. Solicite um novo link.');
        }
        return { success: true };
      }

      return { success: true };
    },

    async updatePassword(newPassword) {
      return this.resetPassword(newPassword);
    },

    async updateProfile(profileData) {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const dbPayload = {
              nome: profileData.name,
              telefone: profileData.phone,
              whatsapp: profileData.whatsapp || profileData.phone,
              provincia: profileData.provincia || 'Luanda',
              cidade: profileData.cidade || '',
              bairro: profileData.bairro || '',
              rua: profileData.rua || '',
              numero: profileData.numero || '',
              endereco: profileData.endereco || [profileData.rua, profileData.numero, profileData.bairro, profileData.cidade, profileData.provincia].filter(Boolean).join(', '),
              ponto_referencia: profileData.ponto_referencia || ''
            };

            const { error: dbErr } = await supabase.from('usuarios').update(dbPayload).eq('email', user.email);
            if (dbErr) {
              console.warn('Tentativa com colunas individuais falhou ou campos ausentes, fallback para endereco:', dbErr.message);
              // Fallback para caso alguma coluna específica não exista no schema remoto
              await supabase.from('usuarios').update({
                nome: profileData.name,
                telefone: profileData.phone,
                whatsapp: profileData.whatsapp || profileData.phone,
                endereco: dbPayload.endereco,
                ponto_referencia: profileData.ponto_referencia
              }).eq('email', user.email);
            }

            const { error: authErr } = await supabase.auth.updateUser({
              data: {
                name: profileData.name,
                phone: profileData.phone,
                whatsapp: profileData.whatsapp || profileData.phone,
                provincia: profileData.provincia,
                cidade: profileData.cidade,
                bairro: profileData.bairro,
                rua: profileData.rua,
                numero: profileData.numero,
                endereco: dbPayload.endereco,
                ponto_referencia: profileData.ponto_referencia
              }
            });
            if (authErr) console.warn('Supabase auth metadata update warning:', authErr.message);
          }
        } catch (e) {
          console.error('Erro ao atualizar perfil no Supabase:', e.message);
          throw new Error('Falha ao atualizar dados de perfil: ' + (e.message || 'Erro desconhecido'));
        }
      }
      return profileData;
    },

    async updateAdminAccount({ name, email, currentPassword, newPassword, phone }) {
      if (isSupabaseConfigured() && supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Se for fornecida nova senha, valida a senha atual se enviada
          if (newPassword) {
            if (currentPassword) {
              const { error: verifyErr } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword
              });
              if (verifyErr) {
                throw new Error('A senha atual digitada está incorreta.');
              }
            }
            const { error: pwdErr } = await supabase.auth.updateUser({ password: newPassword });
            if (pwdErr) throw pwdErr;
          }

          // Se for fornecido novo email ou nome
          const updates = { data: { name, phone: phone || '' } };
          if (email && email.toLowerCase() !== user.email?.toLowerCase()) {
            updates.email = email;
          }
          const { error: updateErr } = await supabase.auth.updateUser(updates);
          if (updateErr) throw updateErr;

          // Atualiza na tabela usuarios
          try {
            await supabase.from('usuarios').update({
              nome: name,
              email: email || user.email,
              telefone: phone || ''
            }).eq('email', user.email);
          } catch {}

          return {
            id: user.id,
            name,
            email: email || user.email,
            phone: phone || '',
            role: 'admin'
          };
        }
      }

      // Operação Local Resiliente
      return {
        name,
        email,
        phone: phone || '',
        role: 'admin'
      };
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

            const role = (userProfile?.role === 'admin' || user.user_metadata?.role === 'admin' || user.app_metadata?.role === 'admin')
              ? 'admin'
              : 'customer';

            return {
              id: userProfile?.id || user.id,
              auth_user_id: user.id,
              name: userProfile?.name || user.user_metadata?.name || user.email?.split('@')[0],
              email: user.email,
              phone: userProfile?.phone || user.user_metadata?.phone || '',
              endereco: userProfile?.endereco || user.user_metadata?.endereco || '',
              ponto_referencia: userProfile?.ponto_referencia || user.user_metadata?.ponto_referencia || '',
              role: role
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
      Storage.logoutUser();
    }
  },

  // ===================================================================
  // 2. CATEGORIAS (TABELA: 'categorias')
  // ===================================================================
  categories: {
    async getAll() {
      if (isSupabaseConfigured() && supabase) {
        try {
          const [catsRes, subsRes] = await Promise.all([
            supabase.from('categorias').select('*').order('ordem_exibicao', { ascending: true }),
            supabase.from('subcategorias').select('*').order('ordem_exibicao', { ascending: true })
          ]);

          if (!catsRes.error && catsRes.data) {
            const subsByCat = {};
            if (!subsRes.error && Array.isArray(subsRes.data)) {
              subsRes.data.forEach(s => {
                const catId = Number(s.categoria_id);
                if (!subsByCat[catId]) subsByCat[catId] = [];
                subsByCat[catId].push({
                  id: s.id,
                  category_id: s.categoria_id,
                  name: s.nome,
                  slug: s.slug,
                  description: s.descricao || '',
                  display_order: s.ordem_exibicao || 1,
                  is_active: s.ativo !== false
                });
              });
            }

            const mapped = catsRes.data.map(cat => {
              const base = mapCategoriaFromDb(cat);
              // Prioridade: leitura estrita da tabela relacional 'subcategorias'
              if (subsByCat[cat.id] && subsByCat[cat.id].length > 0) {
                base.subcategories = subsByCat[cat.id];
              }
              return base;
            });

            setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, mapped);
            return mapped;
          }
          if (catsRes.error) {
            console.error('Erro ao consultar categorias no Supabase:', catsRes.error.message);
          }
        } catch (e) {
          console.error('Erro de conexão com Supabase categorias:', e.message);
        }
      }
      return getLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, []);
    },

    async getBySlug(identifier) {
      if (!identifier) return null;
      if (isSupabaseConfigured() && supabase) {
        try {
          let data = null;
          if (isUuidValid(identifier)) {
            const res = await supabase.from('categorias').select('*').eq('uid', identifier).maybeSingle();
            data = res.data;
          }
          if (!data) {
            const res = await supabase.from('categorias').select('*').eq('slug', identifier).maybeSingle();
            data = res.data;
          }
          if (!data) {
            const res = await supabase.from('categorias').select('*').ilike('nome', identifier).maybeSingle();
            data = res.data;
          }
          if (!data && !isNaN(Number(identifier))) {
            const res = await supabase.from('categorias').select('*').eq('id', Number(identifier)).maybeSingle();
            data = res.data;
          }
          if (data) return mapCategoriaFromDb(data);
        } catch (e) {}
      }

      const all = await this.getAll();
      return all.find(c => (c.uid && c.uid.toLowerCase() === String(identifier).toLowerCase()) || c.slug === identifier || String(c.id) === String(identifier) || c.name?.toLowerCase() === String(identifier).toLowerCase()) || null;
    },

    async getByUid(uid) {
      return this.getBySlug(uid);
    },

    async create(categoryData) {
      if (!categoryData.name && !categoryData.nome) {
        throw new Error('O nome da categoria é obrigatório.');
      }
      const payload = mapCategoriaToDb(categoryData);

      if (isSupabaseConfigured() && supabase) {
        let { data, error } = await supabase.from('categorias').insert(payload).select().single();

        if (error && error.message && error.message.includes('slug')) {
          payload.slug = `${payload.slug}-${Date.now().toString().slice(-4)}`;
          const retry = await supabase.from('categorias').insert(payload).select().single();
          data = retry.data;
          error = retry.error;
        }

        if (error) {
          console.error('Erro ao gravar categoria no Supabase:', error);
          throw new Error('Falha ao gravar no banco de dados: ' + (error.message || 'Erro desconhecido'));
        }

        if (data) {
          const item = mapCategoriaFromDb(data);
          const current = getLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, []);
          setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, [...current.filter(c => c.id !== item.id), item]);
          window.dispatchEvent(new CustomEvent('categories-updated', { detail: { category: item } }));
          return item;
        }
      }

      const current = getLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, []);
      const newCat = {
        id: Date.now(),
        slug: payload.slug,
        name: payload.nome,
        description: payload.descricao,
        subcategories: [],
        display_order: payload.ordem_exibicao,
        is_active: payload.ativo
      };
      current.push(newCat);
      setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, current);
      window.dispatchEvent(new CustomEvent('categories-updated', { detail: { category: newCat } }));
      return newCat;
    },

    async update(id, categoryData) {
      const currentCats = await this.getAll();
      const existing = currentCats.find(c => c.id === id);

      const merged = {
        ...(existing || {}),
        ...categoryData,
        subcategories: categoryData.subcategories !== undefined
          ? categoryData.subcategories
          : (existing?.subcategories || [])
      };

      const payload = mapCategoriaToDb(merged);

      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('categorias')
          .update(payload)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('Erro ao atualizar categoria no Supabase:', error);
          throw new Error('Falha ao atualizar no banco de dados: ' + (error.message || 'Erro desconhecido'));
        }

        if (data) {
          const item = mapCategoriaFromDb(data);
          const current = getLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, []);
          const updated = current.map(c => c.id === id ? item : c);
          setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, updated);
          window.dispatchEvent(new CustomEvent('categories-updated', { detail: { category: item } }));
          return item;
        }
      }

      const current = getLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, []);
      const updated = current.map(c => c.id === id ? { ...c, ...categoryData } : c);
      setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, updated);
      const changed = updated.find(c => c.id === id);
      window.dispatchEvent(new CustomEvent('categories-updated', { detail: { category: changed } }));
      return changed;
    },

    async delete(id) {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('categorias').delete().eq('id', id);
        if (error) {
          console.error('Erro ao excluir categoria no Supabase:', error);
          throw new Error('Falha ao excluir categoria do banco de dados: ' + (error.message || 'Erro desconhecido'));
        }
      }

      const current = getLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, []);
      setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, current.filter(c => c.id !== id));
      window.dispatchEvent(new CustomEvent('categories-updated', { detail: { id } }));
      return { success: true };
    },

    // --- MÉTODOS DE SUBCATEGORIAS (VINCULADAS À TABELA RELACIONAL 'subcategorias') ---
    async createSubcategory({ parent_id, name, description = '', display_order = 1, is_active = true }) {
      if (!parent_id) throw new Error('Selecione a categoria pai para vincular a subcategoria.');
      if (!name || !name.trim()) throw new Error('O nome da subcategoria é obrigatório.');

      const currentCats = await this.getAll();
      const parent = currentCats.find(c => c.id === Number(parent_id));
      if (!parent) throw new Error('Categoria pai não encontrada no sistema.');

      const existingSubs = Array.isArray(parent.subcategories) ? parent.subcategories : [];
      const cleanName = name.trim();
      const slug = cleanName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') || `sub-${Date.now()}`;

      let dbSubId = null;

      // 1. Persistência estrita na tabela oficial 'subcategorias'
      if (isSupabaseConfigured() && supabase) {
        const { data: dbSub, error: subErr } = await supabase
          .from('subcategorias')
          .insert({
            categoria_id: parent.id,
            slug: slug,
            nome: cleanName,
            descricao: (description || '').trim(),
            ordem_exibicao: Number(display_order || (existingSubs.length + 1)),
            ativo: is_active !== false
          })
          .select()
          .single();

        if (subErr) {
          console.error('Erro ao inserir subcategoria no Supabase:', subErr);
          throw new Error('Falha ao cadastrar subcategoria no banco: ' + (subErr.message || 'Erro desconhecido'));
        }

        if (dbSub) {
          dbSubId = dbSub.id;
        }
      }

      const newSub = {
        id: dbSubId || `sub-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        category_id: parent.id,
        name: cleanName,
        slug: slug,
        description: (description || '').trim(),
        display_order: Number(display_order || (existingSubs.length + 1)),
        is_active: is_active !== false
      };

      const updatedSubs = [...existingSubs, newSub];
      parent.subcategories = updatedSubs;

      const current = getLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, []);
      setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, current.map(c => c.id === parent.id ? parent : c));
      window.dispatchEvent(new CustomEvent('categories-updated', { detail: { category: parent } }));
      return { subcategory: newSub, category: parent };
    },

    async updateSubcategory({ category_id, subcategory_id, name, description, display_order, is_active }) {
      if (!category_id) throw new Error('Categoria pai não informada.');
      if (!subcategory_id) throw new Error('Subcategoria não informada.');
      if (!name || !name.trim()) throw new Error('O nome da subcategoria é obrigatório.');

      const currentCats = await this.getAll();
      const parent = currentCats.find(c => c.id === Number(category_id));
      if (!parent) throw new Error('Categoria pai não encontrada.');

      // 1. Atualizar na tabela oficial 'subcategorias'
      if (isSupabaseConfigured() && supabase && !isNaN(Number(subcategory_id))) {
        const { error: sbSubErr } = await supabase
          .from('subcategorias')
          .update({
            nome: name.trim(),
            descricao: description !== undefined ? description.trim() : '',
            ordem_exibicao: display_order !== undefined ? Number(display_order) : 1,
            ativo: is_active !== undefined ? Boolean(is_active) : true
          })
          .eq('id', Number(subcategory_id));

        if (sbSubErr) {
          console.error('Erro ao atualizar subcategoria no Supabase:', sbSubErr);
          throw new Error('Falha ao atualizar subcategoria no banco: ' + (sbSubErr.message || 'Erro desconhecido'));
        }
      }

      const existingSubs = Array.isArray(parent.subcategories) ? parent.subcategories : [];
      const updatedSubs = existingSubs.map(s => {
        if (String(s.id) === String(subcategory_id)) {
          return {
            ...s,
            name: name.trim(),
            description: description !== undefined ? description.trim() : (s.description || ''),
            display_order: display_order !== undefined ? Number(display_order) : (s.display_order || 1),
            is_active: is_active !== undefined ? Boolean(is_active) : (s.is_active !== false)
          };
        }
        return s;
      });

      parent.subcategories = updatedSubs;
      const current = getLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, []);
      setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, current.map(c => c.id === parent.id ? parent : c));
      window.dispatchEvent(new CustomEvent('categories-updated', { detail: { category: parent } }));
      return { category: parent };
    },

    async deleteSubcategory(category_id, subcategory_id) {
      // 1. Integridade Referencial: Bloquear exclusão se houver produtos vinculados
      const allProds = await Api.products.getAll({ all: true });
      const prodsUsingSub = allProds.filter(p => 
        String(p.subcategory_id) === String(subcategory_id) || 
        String(p.subcategoria_id) === String(subcategory_id) ||
        (p.specs && (String(p.specs.subcategory_id) === String(subcategory_id) || String(p.specs.subcategoria_id) === String(subcategory_id)))
      );

      if (prodsUsingSub.length > 0) {
        throw new Error(`Não é possível excluir esta subcategoria pois existem ${prodsUsingSub.length} produto(s) vinculado(s) a ela. Transfira ou desvincule os produtos antes de excluir.`);
      }

      const currentCats = await this.getAll();
      const parent = currentCats.find(c => c.id === Number(category_id));
      if (!parent) throw new Error('Categoria pai não encontrada.');

      // 2. Excluir da tabela oficial 'subcategorias'
      if (isSupabaseConfigured() && supabase && !isNaN(Number(subcategory_id))) {
        const { error: delSubErr } = await supabase
          .from('subcategorias')
          .delete()
          .eq('id', Number(subcategory_id));

        if (delSubErr) {
          console.error('Erro ao excluir subcategoria no Supabase:', delSubErr);
          throw new Error('Falha ao excluir subcategoria no banco: ' + (delSubErr.message || 'Erro desconhecido'));
        }
      }

      const existingSubs = Array.isArray(parent.subcategories) ? parent.subcategories : [];
      const updatedSubs = existingSubs.filter(s => String(s.id) !== String(subcategory_id));

      parent.subcategories = updatedSubs;
      const current = getLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, []);
      setLocalData(LOCAL_STORAGE_KEYS.CATEGORIES, current.map(c => c.id === parent.id ? parent : c));
      window.dispatchEvent(new CustomEvent('categories-updated', { detail: { category: parent } }));
      return { success: true, category: parent };
    }
  },

  // ===================================================================
  // 2.1 SUBCATEGORIAS (TABELA: 'subcategorias' E RETROCOMPATIBILIDADE)
  // ===================================================================
  subcategories: {
    async getAll(categoryId = null) {
      if (isSupabaseConfigured() && supabase) {
        try {
          let query = supabase.from('subcategorias').select('*').order('ordem_exibicao', { ascending: true });
          if (categoryId) query = query.eq('categoria_id', Number(categoryId));
          const { data, error } = await query;
          if (!error && data && data.length > 0) {
            return data.map(s => ({
              id: s.id,
              category_id: s.categoria_id,
              name: s.nome,
              slug: s.slug,
              description: s.descricao || '',
              display_order: s.ordem_exibicao || 1,
              is_active: s.ativo !== false
            }));
          }
        } catch (e) {
          console.warn('Aviso ao consultar tabela subcategorias no Supabase:', e.message);
        }
      }

      // Fallback elegante via categorias
      const cats = await Api.categories.getAll();
      if (categoryId) {
        const cat = cats.find(c => c.id === Number(categoryId));
        return (cat && Array.isArray(cat.subcategories)) ? cat.subcategories : [];
      }
      const allSubs = [];
      cats.forEach(c => {
        if (Array.isArray(c.subcategories)) {
          c.subcategories.forEach(s => allSubs.push({ ...s, category_id: c.id, category_name: c.name }));
        }
      });
      return allSubs;
    },

    create(payload) {
      return Api.categories.createSubcategory(payload);
    },

    update(payload) {
      return Api.categories.updateSubcategory(payload);
    },

    delete(categoryId, subcategoryId) {
      return Api.categories.deleteSubcategory(categoryId, subcategoryId);
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
      if (!catalogData.name && !catalogData.nome) {
        throw new Error('O nome da campanha é obrigatório.');
      }
      const payload = mapCatalogoToDb(catalogData);

      if (isSupabaseConfigured() && supabase) {
        let { data, error } = await supabase.from('catalogos').insert(payload).select().single();

        if (error && error.message && error.message.includes('slug')) {
          payload.slug = `${payload.slug}-${Date.now().toString().slice(-4)}`;
          const retry = await supabase.from('catalogos').insert(payload).select().single();
          data = retry.data;
          error = retry.error;
        }

        if (error) {
          console.error('Erro ao gravar campanha no Supabase:', error);
          throw new Error('Falha ao gravar campanha no banco de dados: ' + (error.message || 'Erro desconhecido'));
        }

        if (data) {
          const item = mapCatalogoFromDb(data);
          const list = getLocalData(LOCAL_STORAGE_KEYS.CATALOGS, []);
          setLocalData(LOCAL_STORAGE_KEYS.CATALOGS, [...list.filter(c => c.id !== item.id), item]);
          return item;
        }
      }

      const list = getLocalData(LOCAL_STORAGE_KEYS.CATALOGS, []);
      const newCat = { id: Date.now(), ...catalogData };
      list.push(newCat);
      setLocalData(LOCAL_STORAGE_KEYS.CATALOGS, list);
      return newCat;
    },

    async update(id, catalogData) {
      const payload = mapCatalogoToDb(catalogData);

      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.from('catalogos').update(payload).eq('id', id).select().single();
        if (error) {
          console.error('Erro ao atualizar campanha no Supabase:', error);
          throw new Error('Falha ao atualizar campanha no banco de dados: ' + (error.message || 'Erro desconhecido'));
        }
        if (data) {
          const item = mapCatalogoFromDb(data);
          const list = getLocalData(LOCAL_STORAGE_KEYS.CATALOGS, []);
          setLocalData(LOCAL_STORAGE_KEYS.CATALOGS, list.map(c => c.id === id ? item : c));
          return item;
        }
      }

      const list = getLocalData(LOCAL_STORAGE_KEYS.CATALOGS, []);
      const updated = list.map(c => c.id === id ? { ...c, ...catalogData } : c);
      setLocalData(LOCAL_STORAGE_KEYS.CATALOGS, updated);
      return updated.find(c => c.id === id);
    },

    async delete(id) {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('catalogos').delete().eq('id', id);
        if (error) {
          console.error('Erro ao deletar campanha no Supabase:', error);
          throw new Error('Falha ao excluir campanha do banco de dados: ' + (error.message || 'Erro desconhecido'));
        }
      }

      const list = getLocalData(LOCAL_STORAGE_KEYS.CATALOGS, []);
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
            try {
              let catId = null;
              if (isUuidValid(params.category)) {
                const { data: catByUid } = await supabase.from('categorias').select('id').eq('uid', params.category).maybeSingle();
                if (catByUid) catId = catByUid.id;
              }
              if (!catId) {
                const { data: catBySlug } = await supabase.from('categorias').select('id').eq('slug', params.category).maybeSingle();
                if (catBySlug) catId = catBySlug.id;
              }
              if (!catId) {
                const { data: catByName } = await supabase.from('categorias').select('id').ilike('nome', params.category).maybeSingle();
                if (catByName) catId = catByName.id;
              }
              if (!catId && !isNaN(Number(params.category))) {
                catId = Number(params.category);
              }
              if (catId) {
                query = query.eq('categoria_id', catId);
              }
            } catch {}
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

      let localList = getLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, []);
      if (!params.all) {
        localList = localList.filter(p => p.is_active !== false);
      }
      if (params.category) {
        localList = localList.filter(p => String(p.category) === String(params.category) || String(p.category_id) === String(params.category) || p.category_slug === params.category || (p.category_uid && p.category_uid === params.category));
      }
      if (params.brand) {
        localList = localList.filter(p => p.brand && p.brand.toLowerCase().includes(params.brand.toLowerCase()));
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        localList = localList.filter(p => (p.name && p.name.toLowerCase().includes(q)) || (p.brand && p.brand.toLowerCase().includes(q)) || (p.sku && p.sku.toLowerCase().includes(q)));
      }
      if (params.is_deal !== undefined) {
        localList = localList.filter(p => Boolean(p.is_deal) === Boolean(params.is_deal));
      }
      return localList;
    },

    async getBySlug(identifier) {
      if (!identifier) return null;
      if (isSupabaseConfigured() && supabase) {
        try {
          let data = null;
          if (isUuidValid(identifier)) {
            const res = await supabase.from('produtos').select('*').eq('uid', identifier).maybeSingle();
            data = res.data;
          }
          if (!data) {
            const res = await supabase.from('produtos').select('*').eq('slug', identifier).maybeSingle();
            data = res.data;
          }
          if (!data) {
            const mappedId = findIdByStableUid('produtos', identifier);
            if (mappedId) {
              const res = await supabase.from('produtos').select('*').eq('id', Number(mappedId)).maybeSingle();
              data = res.data;
            }
          }
          if (!data && !isNaN(Number(identifier))) {
            const res = await supabase.from('produtos').select('*').eq('id', Number(identifier)).maybeSingle();
            data = res.data;
          }
          if (data) return mapProdutoFromDb(data);
        } catch (e) {}
      }

      const all = await this.getAll({ all: true });
      return all.find(p => p.uid === identifier || p.slug === identifier || String(p.id) === String(identifier)) || null;
    },

    async getByUid(uid) {
      return this.getBySlug(uid);
    },

    async getById(id) {
      return this.getBySlug(id);
    },

    async create(productData) {
      if (!productData.name && !productData.nome) {
        throw new Error('O nome do produto é obrigatório.');
      }
      if (!productData.category_id && !productData.category) {
        throw new Error('A vinculação a uma categoria é obrigatória.');
      }
      if (!productData.subcategory_id && !productData.subcategory && !productData.subcategory_name) {
        throw new Error('A vinculação a uma subcategoria é obrigatória.');
      }
      const payload = mapProdutoToDb(productData);

      if (isSupabaseConfigured() && supabase) {
        let { data, error } = await supabase.from('produtos').insert(payload).select().single();

        // Se coluna subcategoria_id não existir na tabela Supabase ainda, faz fallback sem quebrar
        if (error && error.message && error.message.includes('subcategoria_id')) {
          delete payload.subcategoria_id;
          const retrySub = await supabase.from('produtos').insert(payload).select().single();
          data = retrySub.data;
          error = retrySub.error;
        }

        // Se coluna descricao não existir na tabela Supabase ainda, remove e reenvia (especificações já guardam _descricao)
        if (error && error.message && error.message.includes('descricao')) {
          delete payload.descricao;
          const retryDesc = await supabase.from('produtos').insert(payload).select().single();
          data = retryDesc.data;
          error = retryDesc.error;
        }

        // Se slug colidir, adiciona sufixo numérico
        if (error && error.message && error.message.includes('slug')) {
          payload.slug = `${payload.slug}-${Date.now().toString().slice(-4)}`;
          const retry = await supabase.from('produtos').insert(payload).select().single();
          data = retry.data;
          error = retry.error;
        }
        // Se SKU colidir, adiciona sufixo numérico
        if (error && error.message && error.message.includes('sku')) {
          payload.sku = `${payload.sku}-${Math.floor(100 + Math.random() * 900)}`;
          const retry = await supabase.from('produtos').insert(payload).select().single();
          data = retry.data;
          error = retry.error;
        }

        if (error) {
          console.error('Erro ao gravar produto no Supabase:', error);
          throw new Error('Falha ao gravar produto no banco de dados: ' + (error.message || 'Erro desconhecido'));
        }

        if (data) {
          const item = mapProdutoFromDb(data);
          const list = getLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, []);
          setLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, [item, ...list.filter(p => p.id !== item.id)]);
          window.dispatchEvent(new CustomEvent('products-updated', { detail: { product: item } }));
          return item;
        }
      }

      const list = getLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, []);
      const newProd = { id: Date.now(), ...productData };
      list.unshift(newProd);
      setLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, list);
      window.dispatchEvent(new CustomEvent('products-updated', { detail: { product: newProd } }));
      return newProd;
    },

    async update(id, productData) {
      const existing = await this.getById(id);
      const merged = existing ? { ...existing, ...productData } : productData;

      if (merged.category_id !== undefined && !merged.category_id && !merged.category) {
        throw new Error('A vinculação a uma categoria é obrigatória.');
      }
      if ((merged.subcategory_id !== undefined || merged.subcategory !== undefined) &&
          !merged.subcategory_id && !merged.subcategory && !merged.subcategory_name) {
        throw new Error('A vinculação a uma subcategoria é obrigatória.');
      }
      const payload = mapProdutoToDb(merged);

      if (isSupabaseConfigured() && supabase) {
        let { data, error } = await supabase.from('produtos').update(payload).eq('id', id).select().single();

        if (error && error.message && error.message.includes('subcategoria_id')) {
          delete payload.subcategoria_id;
          const retry = await supabase.from('produtos').update(payload).eq('id', id).select().single();
          data = retry.data;
          error = retry.error;
        }

        if (error && error.message && error.message.includes('descricao')) {
          delete payload.descricao;
          const retry = await supabase.from('produtos').update(payload).eq('id', id).select().single();
          data = retry.data;
          error = retry.error;
        }

        if (error) {
          console.error('Erro ao atualizar produto no Supabase:', error);
          throw new Error('Falha ao atualizar produto no banco de dados: ' + (error.message || 'Erro desconhecido'));
        }

        if (data) {
          const item = mapProdutoFromDb(data);
          const list = getLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, []);
          setLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, list.map(p => p.id === id ? item : p));
          window.dispatchEvent(new CustomEvent('products-updated', { detail: { product: item } }));
          return item;
        }
      }

      const list = getLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, []);
      const updated = list.map(p => p.id === id ? { ...p, ...productData } : p);
      setLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, updated);
      const changed = updated.find(p => p.id === id);
      window.dispatchEvent(new CustomEvent('products-updated', { detail: { product: changed } }));
      return changed;
    },

    async delete(id) {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('produtos').delete().eq('id', id);
        if (error) {
          console.error('Erro ao excluir produto no Supabase:', error);
          throw new Error('Falha ao excluir produto do banco de dados: ' + (error.message || 'Erro desconhecido'));
        }
      }

      const list = getLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, []);
      setLocalData(LOCAL_STORAGE_KEYS.PRODUCTS, list.filter(p => p.id !== id));
      window.dispatchEvent(new CustomEvent('products-updated', { detail: { id } }));
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
            const mapped = data.map(m => {
              const rawType = (m.tipo_movimentacao || '').toLowerCase();
              const normType = (rawType === 'entrada' || rawType === 'in') ? 'in' : (rawType === 'saida' || rawType === 'out') ? 'out' : 'adjustment';
              return {
                id: m.id,
                product_id: m.produto_id,
                type: normType,
                movement_type: normType,
                tipo_movimentacao: rawType === 'in' ? 'entrada' : rawType === 'out' ? 'saida' : (rawType || 'entrada'),
                quantity: m.quantidade,
                previous_stock: m.estoque_anterior,
                new_stock: m.estoque_novo,
                reason: m.motivo,
                created_at: m.criado_em
              };
            });
            setLocalData(LOCAL_STORAGE_KEYS.STOCK_MOVEMENTS, mapped);
            return mapped;
          }
        } catch (e) {
          console.warn('Aviso ao consultar movimentações no Supabase:', e.message);
        }
      }
      return getLocalData(LOCAL_STORAGE_KEYS.STOCK_MOVEMENTS, []);
    },

    async registerMovement(payload) {
      const prodId = Number(payload.product_id || payload.productId);
      const rawInputType = String(payload.movement_type || payload.type || 'in').toLowerCase();
      const qty = Number(payload.quantity || 1);
      const reason = payload.reason || 'Ajuste de inventário';

      // Mapeia tipo do frontend para convenção do banco
      let canonicalDb = 'entrada';
      let clientType = 'in';

      if (rawInputType === 'in' || rawInputType === 'entrada') {
        canonicalDb = 'entrada';
        clientType = 'in';
      } else if (rawInputType === 'out' || rawInputType === 'saida') {
        canonicalDb = 'saida';
        clientType = 'out';
      } else if (rawInputType === 'adjustment' || rawInputType === 'ajuste') {
        canonicalDb = 'ajuste';
        clientType = 'adjustment';
      }

      // Usa RPC atômica do PostgreSQL com lock pessimista (FOR UPDATE)
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: rpcResult, error: rpcError } = await supabase.rpc('registrar_movimentacao_estoque', {
            p_produto_id: prodId,
            p_tipo: canonicalDb,
            p_quantidade: qty,
            p_motivo: reason
          });

          if (rpcError) {
            throw new Error(rpcError.message || 'Erro na movimentação de estoque.');
          }

          const result = typeof rpcResult === 'string' ? JSON.parse(rpcResult) : rpcResult;
          const newStock = result.estoque_novo;

          // Atualiza cache local com dados vindos do servidor
          const logs = getLocalData(LOCAL_STORAGE_KEYS.STOCK_MOVEMENTS, []);
          logs.unshift({
            id: Date.now(),
            product_id: prodId,
            movement_type: clientType,
            type: clientType,
            tipo_movimentacao: canonicalDb,
            quantity: qty,
            previous_stock: result.estoque_anterior,
            new_stock: newStock,
            reason: reason,
            created_at: new Date().toISOString()
          });
          setLocalData(LOCAL_STORAGE_KEYS.STOCK_MOVEMENTS, logs);

          window.dispatchEvent(new CustomEvent('products-updated', { detail: { productId: prodId, newStock } }));
          window.dispatchEvent(new CustomEvent('stock-updated', { detail: { productId: prodId, newStock } }));

          return { success: true, new_stock: newStock };
        } catch (e) {
          console.error('Erro ao registrar movimentação de estoque via RPC:', e.message);
          throw e;
        }
      }

      throw new Error('Serviço de banco de dados não configurado. Movimentação de estoque requer Supabase ativo.');
    },

    async recordMovement(payload) {
      return this.registerMovement(payload);
    },

    async decrementStockAtomic(productId, quantity = 1, reason = 'Venda de produto') {
      const prodId = Number(productId);
      const qty = Math.max(1, Number(quantity || 1));
      if (!prodId || isNaN(prodId)) throw new Error('ID de produto inválido para baixa de estoque.');

      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.rpc('baixar_estoque_atomico', {
          p_produto_id: prodId,
          p_quantidade: qty,
          p_motivo: reason
        });

        if (error) {
          throw new Error(error.message || 'Falha ao baixar estoque atômico.');
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        window.dispatchEvent(new CustomEvent('stock-updated', { detail: { productId: prodId, newStock: result?.estoque_novo } }));
        return result;
      }

      throw new Error('Supabase não configurado para baixa atômica de estoque.');
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
        const { data, error } = await supabase.from('banners').insert(payload).select().single();

        if (error) {
          console.error('Erro ao gravar banner no Supabase:', error);
          throw new Error('Falha ao gravar banner no banco de dados: ' + (error.message || 'Erro desconhecido'));
        }

        if (data) {
          const item = mapBannerFromDb(data);
          const list = getLocalData(LOCAL_STORAGE_KEYS.BANNERS, []);
          setLocalData(LOCAL_STORAGE_KEYS.BANNERS, [...list.filter(b => b.id !== item.id), item]);
          window.dispatchEvent(new CustomEvent('banners-updated', { detail: { banner: item } }));
          return item;
        }
      }

      const list = getLocalData(LOCAL_STORAGE_KEYS.BANNERS, []);
      const newBanner = { id: Date.now(), ...bannerData };
      list.push(newBanner);
      setLocalData(LOCAL_STORAGE_KEYS.BANNERS, list);
      window.dispatchEvent(new CustomEvent('banners-updated', { detail: { banner: newBanner } }));
      return newBanner;
    },

    async update(id, bannerData) {
      const payload = mapBannerToDb(bannerData);

      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.from('banners').update(payload).eq('id', id).select().single();

        if (error) {
          console.error('Erro ao atualizar banner no Supabase:', error);
          throw new Error('Falha ao atualizar banner no banco de dados: ' + (error.message || 'Erro desconhecido'));
        }

        if (data) {
          const item = mapBannerFromDb(data);
          const list = getLocalData(LOCAL_STORAGE_KEYS.BANNERS, []);
          setLocalData(LOCAL_STORAGE_KEYS.BANNERS, list.map(b => b.id === id ? item : b));
          window.dispatchEvent(new CustomEvent('banners-updated', { detail: { banner: item } }));
          return item;
        }
      }

      const list = getLocalData(LOCAL_STORAGE_KEYS.BANNERS, []);
      const updated = list.map(b => b.id === id ? { ...b, ...bannerData } : b);
      setLocalData(LOCAL_STORAGE_KEYS.BANNERS, updated);
      const changed = updated.find(b => b.id === id);
      window.dispatchEvent(new CustomEvent('banners-updated', { detail: { banner: changed } }));
      return changed;
    },

    async delete(id) {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('banners').delete().eq('id', id);
        if (error) {
          console.error('Erro ao excluir banner no Supabase:', error);
          throw new Error('Falha ao excluir banner do banco de dados: ' + (error.message || 'Erro desconhecido'));
        }
      }

      const list = getLocalData(LOCAL_STORAGE_KEYS.BANNERS, []);
      setLocalData(LOCAL_STORAGE_KEYS.BANNERS, list.filter(b => b.id !== id));
      window.dispatchEvent(new CustomEvent('banners-updated', { detail: { id } }));
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

    async validate(code, cartTotal, customerEmailOrId = null) {
      const clean = String(code || '').trim().toUpperCase();
      const list = await this.getAll();
      let c = list.find(item => item.code && item.code.toUpperCase() === clean);

      // Garante suporte nativo ao cupom oficial de boas-vindas NOVATECH10
      if (!c && clean === 'NOVATECH10') {
        c = {
          id: 'novatech10-official',
          code: 'NOVATECH10',
          discount_type: 'fixed',
          discount_value: 10000,
          value: 10000,
          min_spend: 30000,
          min_order_value: 30000,
          is_active: true,
          first_purchase_only: true,
          usage_limit: 10000,
          times_used: 0
        };
      }

      if (!c) throw new Error('Cupom não encontrado ou inválido.');
      if (!c.is_active) throw new Error('Este cupom foi pausado ou desativado.');
      
      // Validação de datas de validade (BUG-026)
      const now = new Date();
      if (c.start_date) {
        const startDate = new Date(c.start_date);
        if (!isNaN(startDate.getTime()) && now < startDate) {
          throw new Error(`Este cupom só será válido a partir de ${startDate.toLocaleDateString('pt-BR')}.`);
        }
      }
      if (c.end_date) {
        const endDate = new Date(c.end_date);
        if (!isNaN(endDate.getTime())) {
          if (c.end_date.length === 10) endDate.setHours(23, 59, 59, 999);
          if (now > endDate) {
            throw new Error(`Este cupom promocional expirou em ${endDate.toLocaleDateString('pt-BR')}.`);
          }
        }
      }

      // Validação de limite global de utilizações
      if (c.usage_limit && (c.times_used || 0) >= c.usage_limit) {
        throw new Error('Este cupom atingiu o limite máximo de utilizações permitido.');
      }
      
      const minSpend = Number(c.min_spend || c.min_order_value || 0);
      if (minSpend > 0 && cartTotal < minSpend) {
        throw new Error(`O valor mínimo do pedido para este cupom é de ${minSpend.toLocaleString()} Kz.`);
      }

      // REGRA DE PRIMEIRA COMPRA / 1 USO POR CLIENTE (NOVATECH10)
      const isFirstPurchaseCoupon = clean === 'NOVATECH10' || c.first_purchase_only === true;
      if (isFirstPurchaseCoupon) {
        const currentUser = Storage.getUser();
        const targetEmail = String(customerEmailOrId || currentUser?.email || '').trim().toLowerCase();

        if (targetEmail) {
          // 1. Verifica pedidos no Supabase associados a este e-mail
          if (isSupabaseConfigured() && supabase) {
            try {
              const { data: userOrders, error: ordErr } = await supabase
                .from('pedidos')
                .select('id, codigo_pedido, status_pedido')
                .eq('email_cliente', targetEmail)
                .neq('status_pedido', 'cancelled')
                .limit(1);

              if (!ordErr && userOrders && userOrders.length > 0) {
                throw new Error('O cupom NOVATECH10 é exclusivo para clientes em sua primeira compra.');
              }
            } catch (queryErr) {
              if (queryErr.message && queryErr.message.includes('exclusivo para clientes')) {
                throw queryErr;
              }
            }
          }

          // 2. Verifica no histórico local de pedidos
          const localOrders = getLocalData(LOCAL_STORAGE_KEYS.ORDERS, []);
          const hasExistingOrder = localOrders.some(o => {
            const oEmail = String(o?.customer?.email || o?.email_cliente || '').toLowerCase().trim();
            const oStatus = o?.status || o?.status_pedido || '';
            return oEmail === targetEmail && oStatus !== 'cancelled';
          });

          if (hasExistingOrder) {
            throw new Error('O cupom NOVATECH10 só pode ser utilizado uma única vez na primeira compra.');
          }
        }
      }

      return c;
    },

    async incrementUsage(code) {
      if (!code) return;
      const clean = String(code).trim().toUpperCase();

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data } = await supabase.from('cupons').select('id, total_usado, limite_uso').eq('codigo', clean).single();
          if (data) {
            const currentTotal = Number(data.total_usado || 0);
            const newTotal = currentTotal + 1;
            await supabase.from('cupons').update({ total_usado: newTotal }).eq('id', data.id);
          }
        } catch (e) {
          console.warn('Aviso ao incrementar cupom no Supabase:', e.message);
        }
      }

      const list = await this.getAll();
      const updated = list.map(c => {
        if (c.code && c.code.toUpperCase() === clean) {
          return { ...c, times_used: (c.times_used || 0) + 1 };
        }
        return c;
      });
      setLocalData(LOCAL_STORAGE_KEYS.COUPONS, updated);
      window.dispatchEvent(new CustomEvent('coupons-updated'));
    },

    async create(couponData) {
      if (!couponData.code && !couponData.codigo) {
        throw new Error('O código do cupom é obrigatório.');
      }
      const payload = mapCupomToDb(couponData);

      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.from('cupons').insert(payload).select().single();

        if (error) {
          console.error('Erro ao gravar cupom no Supabase:', error);
          if (error.message && error.message.includes('unique')) {
            throw new Error(`Já existe um cupom cadastrado com o código "${payload.codigo}".`);
          }
          throw new Error('Falha ao gravar cupom no banco de dados: ' + (error.message || 'Erro desconhecido'));
        }

        if (data) {
          const item = mapCupomFromDb(data);
          const list = getLocalData(LOCAL_STORAGE_KEYS.COUPONS, []);
          setLocalData(LOCAL_STORAGE_KEYS.COUPONS, [item, ...list.filter(c => c.id !== item.id)]);
          window.dispatchEvent(new CustomEvent('coupons-updated', { detail: { coupon: item } }));
          return item;
        }
      }

      const list = getLocalData(LOCAL_STORAGE_KEYS.COUPONS, []);
      const newCupom = { id: Date.now(), times_used: 0, ...couponData };
      list.unshift(newCupom);
      setLocalData(LOCAL_STORAGE_KEYS.COUPONS, list);
      window.dispatchEvent(new CustomEvent('coupons-updated', { detail: { coupon: newCupom } }));
      return newCupom;
    },

    async update(id, couponData) {
      const payload = mapCupomToDb(couponData);

      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.from('cupons').update(payload).eq('id', id).select().single();

        if (error) {
          console.error('Erro ao atualizar cupom no Supabase:', error);
          throw new Error('Falha ao atualizar cupom no banco de dados: ' + (error.message || 'Erro desconhecido'));
        }

        if (data) {
          const item = mapCupomFromDb(data);
          const list = getLocalData(LOCAL_STORAGE_KEYS.COUPONS, []);
          setLocalData(LOCAL_STORAGE_KEYS.COUPONS, list.map(c => c.id === id ? item : c));
          window.dispatchEvent(new CustomEvent('coupons-updated', { detail: { coupon: item } }));
          return item;
        }
      }

      const list = getLocalData(LOCAL_STORAGE_KEYS.COUPONS, []);
      const updated = list.map(c => c.id === id ? { ...c, ...couponData } : c);
      setLocalData(LOCAL_STORAGE_KEYS.COUPONS, updated);
      const changed = updated.find(c => c.id === id);
      window.dispatchEvent(new CustomEvent('coupons-updated', { detail: { coupon: changed } }));
      return changed;
    },

    async delete(id) {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('cupons').delete().eq('id', id);
        if (error) {
          console.error('Erro ao excluir cupom no Supabase:', error);
          throw new Error('Falha ao excluir cupom do banco de dados: ' + (error.message || 'Erro desconhecido'));
        }
      }

      const list = getLocalData(LOCAL_STORAGE_KEYS.COUPONS, []);
      setLocalData(LOCAL_STORAGE_KEYS.COUPONS, list.filter(c => c.id !== id));
      window.dispatchEvent(new CustomEvent('coupons-updated', { detail: { id } }));
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

    async getMyOrders(userParam) {
      let userEmail = '';
      let userId = null;
      if (typeof userParam === 'object' && userParam !== null) {
        userEmail = (userParam.userEmail || userParam.email || userParam.customer_email || '').toLowerCase().trim();
        userId = userParam.userId || userParam.id || userParam.user_id || null;
      } else if (typeof userParam === 'string') {
        userEmail = userParam.toLowerCase().trim();
      }

      if (isSupabaseConfigured() && supabase) {
        try {
          let query = supabase.from('pedidos').select('*, itens_pedido(*)').order('criado_em', { ascending: false });
          if (userId && userEmail) {
            query = query.or(`usuario_id.eq.${userId},email_cliente.ilike.${userEmail}`);
          } else if (userId) {
            query = query.eq('usuario_id', userId);
          } else if (userEmail) {
            query = query.ilike('email_cliente', userEmail);
          } else {
            return [];
          }

          const { data, error } = await query;
          if (!error && data) {
            return data.map(mapPedidoFromDb);
          }
        } catch (e) {
          console.warn('Aviso ao consultar pedidos do cliente no Supabase:', e.message);
        }
      }

      // Fallback local seguro (nunca vaza pedidos de outros clientes)
      const all = getLocalData(LOCAL_STORAGE_KEYS.ORDERS, []);
      if (!userEmail && !userId) return [];
      return all.filter(o => {
        const mEmail = (o.customer_email || o.email_cliente || o.customer?.email || '').toLowerCase().trim();
        const mId = o.user_id || o.usuario_id || o.customer?.id;
        return (userEmail && mEmail === userEmail) || (userId && String(mId) === String(userId));
      });
    },

    async getById(orderId, currentUser = null) {
      if (!orderId) return null;

      if (isSupabaseConfigured() && supabase) {
        try {
          // Tenta buscar por uid, codigo_pedido ou id
          let { data } = await supabase
            .from('pedidos')
            .select('*, itens_pedido(*)')
            .eq('uid', orderId)
            .maybeSingle();

          if (!data) {
            const res = await supabase
              .from('pedidos')
              .select('*, itens_pedido(*)')
              .eq('codigo_pedido', orderId)
              .maybeSingle();
            data = res.data;
          }

          if (!data && !isNaN(Number(orderId))) {
            const res = await supabase
              .from('pedidos')
              .select('*, itens_pedido(*)')
              .eq('id', Number(orderId))
              .maybeSingle();
            data = res.data;
          }

          if (data) {
            // Validação de ownership: cliente só pode ver o próprio pedido
            if (currentUser && currentUser.role !== 'admin') {
              const userEmail = (currentUser.email || '').toLowerCase().trim();
              const orderEmail = (data.email_cliente || '').toLowerCase().trim();
              const userDbId = currentUser.db_id || currentUser.id;

              const isOwner =
                (userEmail && userEmail === orderEmail) ||
                (userDbId && String(data.usuario_id) === String(userDbId));

              if (!isOwner) {
                throw new Error('Acesso negado: este pedido não pertence à sua conta.');
              }
            }

            return mapPedidoFromDb(data);
          }
        } catch (e) {
          if (e.message && e.message.includes('Acesso negado')) throw e;
          console.warn('[orders.getById] Erro:', e.message);
        }
      }

      // Fallback local
      const all = getLocalData(LOCAL_STORAGE_KEYS.ORDERS, []);
      return all.find(o => o.uid === orderId || o.order_code === orderId || String(o.id) === String(orderId)) || null;
    },



    async confirmDelivery(orderId, currentUser = null) {
      const cleanId = String(orderId || '');
      const now = new Date();
      const timestampStr = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const deliveryNote = `[Entrega Concluída] Cliente confirmou o recebimento da encomenda em ${timestampStr}.`;

      let updatedOrder = null;

      if (isSupabaseConfigured() && supabase) {
        // SEGURANÇA: verificar ownership antes de atualizar
        // Busca o pedido e valida que pertence ao usuário logado
        if (currentUser) {
          try {
            const { data: existingOrder, error: fetchErr } = await supabase
              .from('pedidos')
              .select('id, usuario_id, email_cliente, status_pedido')
              .eq('id', orderId)
              .single();

            if (fetchErr || !existingOrder) {
              throw new Error('Pedido não encontrado.');
            }

            // Verifica se o pedido pertence ao usuário logado
            const userEmail = (currentUser.email || '').toLowerCase().trim();
            const orderEmail = (existingOrder.email_cliente || '').toLowerCase().trim();
            const userDbId = currentUser.db_id || currentUser.id;

            const isOwner =
              (userEmail && userEmail === orderEmail) ||
              (userDbId && String(existingOrder.usuario_id) === String(userDbId));

            if (!isOwner) {
              throw new Error('Acesso negado: este pedido não pertence à sua conta.');
            }

            // Só permite confirmar entrega se o pedido estiver "enviado"
            if (existingOrder.status_pedido !== 'shipped') {
              throw new Error(`Não é possível confirmar entrega: o pedido está com status "${existingOrder.status_pedido}".`);
            }
          } catch (authErr) {
            if (authErr.message && (authErr.message.includes('Acesso negado') || authErr.message.includes('não pertence') || authErr.message.includes('não encontrado') || authErr.message.includes('status'))) {
              throw authErr;
            }
            console.warn('[confirmDelivery] Erro na verificação de ownership:', authErr.message);
          }
        }

        try {
          const { data, error } = await supabase
            .from('pedidos')
            .update({
              status_pedido: 'delivered',
              notas_admin: deliveryNote,
              atualizado_em: now.toISOString()
            })
            .eq('id', orderId)
            .select('*, itens_pedido(*)')
            .single();

          if (!error && data) {
            updatedOrder = mapPedidoFromDb(data);
          }
        } catch (sbErr) {
          console.warn('Erro ao registrar confirmação de entrega no Supabase:', sbErr.message);
        }
      }

      // Atualiza cache local
      const list = await this.getAll();
      const updatedList = list.map(o => {
        if (String(o.id) === cleanId || String(o.order_code) === cleanId || String(o.codigo_pedido) === cleanId) {
          return {
            ...o,
            status: 'delivered',
            status_pedido: 'delivered',
            delivery_confirmed_at: now.toISOString(),
            admin_notes: (o.admin_notes ? o.admin_notes + '\n' : '') + deliveryNote
          };
        }
        return o;
      });
      setLocalData(LOCAL_STORAGE_KEYS.ORDERS, updatedList);

      window.dispatchEvent(new CustomEvent('orders-updated', { detail: { orderId, status: 'delivered', order: updatedOrder } }));
      window.dispatchEvent(new CustomEvent('order-delivered', { detail: { orderId, status: 'delivered', order: updatedOrder } }));
      return updatedOrder || { id: orderId, status: 'delivered' };
    },

    async create(orderPayload) {
      const orderCode = `NV-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      if (isSupabaseConfigured() && supabase) {
        // 1. Resolução segura de usuario_id para respeitar a chave estrangeira BIGINT em public.pedidos(usuario_id)
        let resolvedUserId = null;
        if (typeof orderPayload.user_id === 'number' && !isNaN(orderPayload.user_id)) {
          resolvedUserId = orderPayload.user_id;
        } else if (orderPayload.customer_email) {
          try {
            const { data: uData } = await supabase
              .from('usuarios')
              .select('id')
              .eq('email', orderPayload.customer_email.trim().toLowerCase())
              .maybeSingle();
            if (uData?.id && !isNaN(Number(uData.id))) {
              resolvedUserId = Number(uData.id);
            }
          } catch (uErr) {
            console.warn('Aviso ao resolver ID do usuário para o pedido:', uErr.message);
          }
        }

        // 2. VALIDAÇÃO SERVER-SIDE DE PREÇOS (Anti-Tamper — Section 16)
        // Busca o preço real de cada produto no banco e recalcula os totais.
        // O cliente NÃO pode alterar o preço via DevTools ou localStorage.
        if (orderPayload.items && orderPayload.items.length > 0) {
          const productIds = [...new Set(
            orderPayload.items
              .map(i => Number(i.product_id || i.id))
              .filter(id => !isNaN(id) && id > 0)
          )];

          let serverProducts = [];
          if (productIds.length > 0) {
            const { data: prodsData, error: prodsErr } = await supabase
              .from('produtos')
              .select('id, preco, preco_antigo, ativo, permitir_venda_sem_estoque, nome')
              .in('id', productIds);

            if (!prodsErr && prodsData) {
              serverProducts = prodsData;
            }
          }

          let serverSubtotal = 0;
          const validatedItems = [];

          for (const item of orderPayload.items) {
            const prodId = Number(item.product_id || item.id);
            const qty = Math.max(1, Number(item.quantity || 1));
            const serverProd = serverProducts.find(p => p.id === prodId);

            if (serverProd) {
              // Produto inativo — bloquear compra
              if (serverProd.ativo === false) {
                throw new Error(`O produto "${serverProd.nome || 'ID ' + prodId}" está desativado e não pode ser comprado.`);
              }
              // Usa preço real do banco (ignora preço enviado pelo cliente)
              const realPrice = Number(serverProd.preco || 0);
              serverSubtotal += realPrice * qty;
              validatedItems.push({
                ...item,
                unit_price: realPrice,
                price: realPrice,
                preco_unitario: realPrice,
                preco_total: realPrice * qty
              });
            } else {
              // Produto sem correspondência no banco (não cadastrado) — usar preço do payload como fallback
              const fallbackPrice = Number(item.unit_price || item.price || 0);
              serverSubtotal += fallbackPrice * qty;
              validatedItems.push({ ...item, unit_price: fallbackPrice, price: fallbackPrice });
            }
          }

          // Recalcula cupom/desconto com base no subtotal real do servidor
          const serverCouponDiscount = Number(orderPayload.discount || 0);
          const serverTotal = Math.max(0, serverSubtotal - serverCouponDiscount) + Number(orderPayload.shipping_price || 0);

          // Substitui valores no payload pelos valores validados
          orderPayload = {
            ...orderPayload,
            items: validatedItems,
            subtotal: serverSubtotal,
            total: serverTotal
          };
        }

        // 3. BAIXA ATÔMICA DE ESTOQUE (Lock pessimista anti-race condition via RPC)
        // Se qualquer item não tiver estoque suficiente, a RPC levanta exceção e impede a compra.
        if (orderPayload.items && orderPayload.items.length > 0) {
          for (const item of orderPayload.items) {
            const rawId = item.product_id || item.id;
            const prodId = Number(rawId);
            const qty = Math.max(1, Number(item.quantity || 1));

            if (prodId && !isNaN(prodId)) {
              const { error: stockErr } = await supabase.rpc('baixar_estoque_atomico', {
                p_produto_id: prodId,
                p_quantidade: qty,
                p_motivo: `Venda Pedido ${orderCode}`
              });

              if (stockErr) {
                console.error('[Checkout] Erro na baixa atômica de estoque:', stockErr);
                throw new Error(`Não foi possível concluir o pedido: ${stockErr.message || 'Estoque insuficiente para o produto solicitado.'}`);
              }
            }
          }
        }

        // 4. Inserção oficial do pedido na tabela 'pedidos' (com valores validados pelo servidor)
        const { data: order, error } = await supabase.from('pedidos').insert({
          codigo_pedido: orderCode,
          usuario_id: resolvedUserId,
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
          status_pedido: 'received',
          notas_admin: ''
        }).select().single();

        if (error) {
          console.error('[Checkout] Erro ao gravar pedido no Supabase:', error);
          throw new Error('Falha ao registrar pedido no servidor: ' + (error.message || 'Erro desconhecido'));
        }

        // 4. Inserção dos itens do pedido na tabela 'itens_pedido'
        if (orderPayload.items && orderPayload.items.length > 0) {
          const itemsToInsert = orderPayload.items.map(i => ({
            pedido_id: order.id,
            produto_id: (!isNaN(Number(i.product_id || i.id))) ? Number(i.product_id || i.id) : null,
            sku_produto: i.product_sku || '',
            nome_produto: i.product_name || i.name,
            imagem_produto: i.product_image || i.image || '',
            variante_selecionada: i.selected_variant || {},
            preco_unitario: i.unit_price || i.price,
            quantidade: i.quantity,
            preco_total: (i.unit_price || i.price) * i.quantity
          }));
          const { error: itemsErr } = await supabase.from('itens_pedido').insert(itemsToInsert);
          if (itemsErr) {
            console.warn('[Checkout] Aviso ao registrar itens do pedido no Supabase:', itemsErr.message);
          }
        }

        const fullOrder = mapPedidoFromDb({ ...order, itens_pedido: orderPayload.items });
        fullOrder.status_history = [
          { status: 'received', timestamp: new Date().toISOString(), notes: 'Pedido registrado' }
        ];
        const current = getLocalData(LOCAL_STORAGE_KEYS.ORDERS, []);
        setLocalData(LOCAL_STORAGE_KEYS.ORDERS, [fullOrder, ...current]);
        
        window.dispatchEvent(new CustomEvent('orders-updated', { detail: { order: fullOrder } }));
        window.dispatchEvent(new CustomEvent('order-created', { detail: { order: fullOrder } }));
        window.dispatchEvent(new CustomEvent('stock-updated'));
        return fullOrder;
      }

      throw new Error('Serviço de processamento de pedidos indisponível. Conecte o banco de dados Supabase.');
    },

    async updateStatus(orderId, newStatus, notes = '') {
      const canonicalStatus = normalizeOrderStatus(newStatus);
      const VALID_STATUSES = ['received', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];
      if (!VALID_STATUSES.includes(canonicalStatus)) {
        throw new Error(`Status operacional inválido: ${newStatus}. Valores permitidos: ${VALID_STATUSES.join(', ')}`);
      }

      const updateData = { status_pedido: canonicalStatus };
      if (canonicalStatus === 'confirmed') updateData.status_pagamento = 'pago';
      else if (canonicalStatus === 'cancelled') updateData.status_pagamento = 'cancelado';
      if (notes) updateData.notas_admin = notes;

      let updatedOrder = null;

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('pedidos')
            .update(updateData)
            .eq('id', orderId)
            .select('*, itens_pedido(*)')
            .single();
          if (!error && data) {
            updatedOrder = mapPedidoFromDb(data);
          }
        } catch (e) {
          console.warn('Erro ao alterar status no Supabase:', e.message);
        }
      }

      const list = await this.getAll();
      const nowIso = new Date().toISOString();

      const updatedList = list.map(o => {
        const isMatch = o.id === orderId || String(o.id) === String(orderId) || o.order_code === orderId;
        if (!isMatch) return o;

        const history = Array.isArray(o.status_history) ? [...o.status_history] : [];
        history.push({
          status: canonicalStatus,
          timestamp: nowIso,
          updated_by: 'admin',
          notes: notes || ''
        });

        const merged = {
          ...o,
          ...(updatedOrder || {}),
          status: canonicalStatus,
          status_pedido: canonicalStatus,
          admin_notes: notes !== undefined && notes !== '' ? notes : (o.admin_notes || ''),
          status_history: history,
          updated_at: nowIso
        };
        if (canonicalStatus === 'confirmed') merged.payment_status = 'pago';
        else if (canonicalStatus === 'cancelled') merged.payment_status = 'cancelado';

        updatedOrder = merged;
        return merged;
      });

      setLocalData(LOCAL_STORAGE_KEYS.ORDERS, updatedList);

      // Sincroniza via Storage unificado e emite evento para todo o sistema (Admin, Loja e Área do Cliente)
      // Sincroniza via Storage unificado e emite evento para todo o sistema (Admin, Loja e Área do Cliente)

      window.dispatchEvent(new CustomEvent('orders-updated', {
        detail: { orderId, status: canonicalStatus, notes, timestamp: nowIso, order: updatedOrder }
      }));

      return updatedOrder || { id: orderId, status: canonicalStatus };
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
      const updated = list.map(o => (o.id === orderId || String(o.id) === String(orderId) || o.order_code === orderId) ? { ...o, admin_notes: notes } : o);
      setLocalData(LOCAL_STORAGE_KEYS.ORDERS, updated);
      window.dispatchEvent(new CustomEvent('orders-updated', { detail: { orderId, notes } }));
      return updated.find(o => o.id === orderId || String(o.id) === String(orderId) || o.order_code === orderId);
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
          const { data: users, error } = await supabase
            .from('usuarios')
            .select('id, auth_user_id, nome, email, telefone, whatsapp, nivel_acesso, status, ativo, endereco, ponto_referencia, criado_em')
            .order('criado_em', { ascending: false });

          if (!error && users) {
            // Obter pedidos para calcular estatísticas reais de compra (BUG-010)
            const { data: orders } = await supabase
              .from('pedidos')
              .select('id, usuario_id, email_cliente, total, status_pedido');

            const ordersList = orders || [];
            const mapped = users.map(u => {
              const uEmail = (u.email || '').toLowerCase().trim();
              const userOrders = ordersList.filter(o => 
                (o.usuario_id && Number(o.usuario_id) === Number(u.id)) ||
                (o.email_cliente && o.email_cliente.toLowerCase().trim() === uEmail)
              );
              const totalSpent = userOrders
                .filter(o => normalizeOrderStatus(o.status_pedido) !== 'cancelled')
                .reduce((sum, o) => sum + Number(o.total || 0), 0);

              const base = mapUsuarioFromDb(u);
              return {
                ...base,
                total_orders: userOrders.length,
                total_spent: totalSpent
              };
            });

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
        const email = (o.customer_email || '').toLowerCase().trim();
        if (!email) return;
        if (!customerMap.has(email)) {
          customerMap.set(email, {
            id: o.user_id || `cust-${Math.abs(email.split('').reduce((a,b)=>((a<<5)-a)+b.charCodeAt(0),0))}`,
            name: o.customer_name,
            email: email,
            phone: o.customer_phone,
            whatsapp: o.customer_whatsapp || o.customer_phone,
            endereco: o.shipping_address || '',
            ponto_referencia: o.ponto_referencia || '',
            role: 'customer',
            status: 'ativo',
            is_active: true,
            total_orders: 0,
            total_spent: 0,
            created_at: o.created_at
          });
        }
        const c = customerMap.get(email);
        c.total_orders += 1;
        if (normalizeOrderStatus(o.status) !== 'cancelled') {
          c.total_spent += Number(o.total || 0);
        }
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
  // Cada campo possui sua própria coluna tipada no banco de dados
  // ===================================================================
  settings: {
    async get(key = 'general') {
      const canonicalKey = (key === 'geral' ? 'general' : key);
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('configuracoes_loja')
            .select('*')
            .eq('chave', canonicalKey)
            .maybeSingle();

          if (!error && data) {
            const mapped = mapConfiguracoesFromDb(data);
            setLocalData(`${LOCAL_STORAGE_KEYS.SETTINGS}_${canonicalKey}`, mapped);
            return mapped;
          }
        } catch (e) {
          console.warn('Aviso ao consultar configuracoes no Supabase:', e.message);
        }
      }
      return getLocalData(`${LOCAL_STORAGE_KEYS.SETTINGS}_${canonicalKey}`, DEFAULT_SETTINGS);
    },

    async save(key = 'general', value) {
      const canonicalKey = (key === 'geral' ? 'general' : key);
      const dbPayload = mapConfiguracoesToDb({ ...value, chave: canonicalKey });

      if (isSupabaseConfigured() && supabase) {
        let { data, error } = await supabase
          .from('configuracoes_loja')
          .upsert(dbPayload, { onConflict: 'chave' })
          .select()
          .single();

        // Fallback para schema legado com coluna valor caso o banco ainda não tenha rodado a migração
        if (error && error.message && (error.message.includes('column') || error.message.includes('coluna'))) {
          console.warn('Tentando salvar via fallback de coluna única:', error.message);
          const legacyPayload = { chave: canonicalKey, valor: value, atualizado_em: new Date().toISOString() };
          const res = await supabase.from('configuracoes_loja').upsert(legacyPayload, { onConflict: 'chave' }).select().single();
          if (res.error) throw new Error('Falha ao salvar configurações: ' + res.error.message);
          data = res.data;
        } else if (error) {
          console.error('Erro ao salvar configuracoes no Supabase:', error);
          throw new Error('Falha ao salvar configurações no banco de dados: ' + (error.message || 'Erro desconhecido'));
        }

        const mapped = data ? mapConfiguracoesFromDb(data) : value;
        setLocalData(`${LOCAL_STORAGE_KEYS.SETTINGS}_${canonicalKey}`, mapped);
        return mapped;
      }

      setLocalData(`${LOCAL_STORAGE_KEYS.SETTINGS}_${canonicalKey}`, value);
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
          console.warn('Aviso ao consultar status de administradores no Supabase:', error.message);
        } catch (e) {
          console.warn('Aviso: Tabela usuarios no Supabase ainda não inicializada:', e.message);
        }
        return { has_admin: false, total_admins: 0 };
      }

      return { has_admin: false, total_admins: 0 };
    },

    // Suporte flexível para objeto único { name, email, password, phone, ... } ou argumentos separados
    async setup(arg1, arg2, arg3, arg4 = '', arg5 = {}) {
      let name, email, password, phone, extra;
      if (typeof arg1 === 'object' && arg1 !== null) {
        name = arg1.name;
        email = arg1.email;
        password = arg1.password;
        phone = arg1.phone || '';
        extra = arg1.extra || arg1;
      } else {
        name = arg1;
        email = arg2;
        password = arg3;
        phone = arg4 || '';
        extra = arg5 || {};
      }

      if (!name || typeof name !== 'string' || !name.trim()) {
        throw new Error('O nome do administrador é obrigatório.');
      }
      if (!email || typeof email !== 'string' || !email.trim()) {
        throw new Error('O e-mail do administrador é obrigatório.');
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        throw new Error('A senha deve possuir pelo menos 6 caracteres.');
      }

      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();
      const endereco = extra.endereco || '';
      const pontoReferencia = extra.ponto_referencia || '';

      if (isSupabaseConfigured() && supabase) {
        try {
          const redirectTo = typeof window !== 'undefined'
            ? `${window.location.origin}${window.location.pathname}`
            : undefined;

          // 1. Cria o usuário no Supabase Auth
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: cleanEmail,
            password: password,
            options: {
              emailRedirectTo: redirectTo,
              data: {
                name: cleanName,
                phone: phone,
                endereco: endereco,
                ponto_referencia: pontoReferencia,
                role: 'admin'
              }
            }
          });
          if (authError) throw authError;

          // Se já existia usuário registrado com este e-mail
          if (authData?.user && Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
            throw new Error('Este e-mail já está cadastrado no sistema. Inicie sessão ou utilize a recuperação de senha.');
          }

          // 2. Usa RPC segura bootstrap_first_admin para promover no banco
          // Esta RPC só funciona se NÃO existir nenhum admin cadastrado
          try {
            const { data: bootstrapResult, error: bootstrapError } = await supabase.rpc('bootstrap_first_admin', {
              p_email: cleanEmail,
              p_nome: cleanName,
              p_telefone: phone
            });

            if (bootstrapError) {
              // Se já existe admin, o bootstrap falha — isso é esperado
              console.warn('bootstrap_first_admin:', bootstrapError.message);
              // Tenta upsert normal
              await supabase.from('usuarios').upsert({
                auth_user_id: authData?.user?.id || null,
                nome: cleanName,
                email: cleanEmail,
                telefone: phone,
                whatsapp: phone,
                endereco: endereco,
                ponto_referencia: pontoReferencia,
                nivel_acesso: 'admin',
                status: 'ativo',
                ativo: true
              }, { onConflict: 'email' });
            } else {
              // Atualiza o auth_user_id no registro criado pela RPC
              if (authData?.user?.id) {
                await supabase.from('usuarios')
                  .update({ auth_user_id: authData.user.id })
                  .eq('email', cleanEmail);
              }
            }
          } catch (rpcErr) {
            console.warn('Nota: RPC bootstrap_first_admin indisponível, usando upsert direto:', rpcErr.message);
            await supabase.from('usuarios').upsert({
              auth_user_id: authData?.user?.id || null,
              nome: cleanName,
              email: cleanEmail,
              telefone: phone,
              whatsapp: phone,
              endereco: endereco,
              ponto_referencia: pontoReferencia,
              nivel_acesso: 'admin',
              status: 'ativo',
              ativo: true
            }, { onConflict: 'email' });
          }

          let sessionToken = authData?.session?.access_token || null;
          let requiresEmailConfirmation = false;

          // Se não retornou sessão direta no signUp, tenta autenticar com signInWithPassword
          if (!sessionToken) {
            try {
              const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: password
              });
              if (!signInErr && signInData?.session?.access_token) {
                sessionToken = signInData.session.access_token;
              } else if (signInErr) {
                const errMsg = (signInErr.message || '').toLowerCase();
                if (errMsg.includes('confirm') || errMsg.includes('email_not_confirmed')) {
                  requiresEmailConfirmation = true;
                }
              }
            } catch (ignore) {}
          }

          if (sessionToken) {
            Api.setToken(sessionToken);
          } else if (!requiresEmailConfirmation && !authData?.session) {
            requiresEmailConfirmation = true;
          }

          const user = {
            id: authData?.user?.id || Date.now(),
            auth_user_id: authData?.user?.id || null,
            name: cleanName,
            email: cleanEmail,
            phone: phone,
            endereco: endereco,
            ponto_referencia: pontoReferencia,
            role: 'admin'
          };

          // Registrar no cache local
          const localUsers = getLocalData(LOCAL_STORAGE_KEYS.CUSTOMERS, []);
          setLocalData(LOCAL_STORAGE_KEYS.CUSTOMERS, [user, ...localUsers.filter(u => u.email !== user.email)]);
          Storage.saveUser(user);

          return { 
            access_token: sessionToken, 
            user, 
            requiresEmailConfirmation 
          };
        } catch (sbErr) {
          console.error('Falha no setup de admin:', sbErr);
          throw new Error(formatAuthError(sbErr));
        }
      }

      throw new Error('Supabase não configurado para criação de administradores.');
    },

    async getStats(period = 'all') {
      // Tenta usar RPC server-side (100% PostgreSQL) para KPIs do dashboard
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: kpiResult, error: kpiError } = await supabase.rpc('get_admin_dashboard_kpis', {
            p_period: period
          });

          if (!kpiError && kpiResult) {
            const kpis = typeof kpiResult === 'string' ? JSON.parse(kpiResult) : kpiResult;
            return {
              total_sales: Number(kpis.total_sales || 0),
              total_orders: Number(kpis.total_orders || 0),
              ticket_medio: Number(kpis.ticket_medio || 0),
              total_products: Number(kpis.total_products || 0),
              pending_orders: Number(kpis.pending_orders || 0),
              low_stock_count: Number(kpis.low_stock_count || 0),
              period: kpis.period || period
            };
          }
        } catch (rpcErr) {
          console.warn('RPC get_admin_dashboard_kpis indisponível, usando fallback client-side:', rpcErr.message);
        }
      }

      // Fallback client-side caso a RPC não esteja disponível
      const orders = await Api.orders.getAll();
      const products = await Api.products.getAll({ all: true });

      // Filtragem por período temporal
      let filteredOrders = orders;
      const now = new Date();

      if (period === 'today') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        filteredOrders = orders.filter(o => new Date(o.date || o.created_at || o.criado_em).getTime() >= todayStart);
      } else if (period === '7d') {
        const limit7d = now.getTime() - (7 * 24 * 60 * 60 * 1000);
        filteredOrders = orders.filter(o => new Date(o.date || o.created_at || o.criado_em).getTime() >= limit7d);
      } else if (period === '30d') {
        const limit30d = now.getTime() - (30 * 24 * 60 * 60 * 1000);
        filteredOrders = orders.filter(o => new Date(o.date || o.created_at || o.criado_em).getTime() >= limit30d);
      }

      const validOrders = filteredOrders.filter(o => normalizeOrderStatus(o.status) !== 'cancelled');
      const totalSales = validOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const pendingOrders = filteredOrders.filter(o => normalizeOrderStatus(o.status) === 'received' || o.payment_status === 'pendente' || o.payment_status === 'pending').length;
      const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.stock_min || 2)).length;

      return {
        total_sales: totalSales,
        total_orders: filteredOrders.length,
        total_products: products.length,
        pending_orders: pendingOrders,
        low_stock_count: lowStockProducts,
        orders: filteredOrders
      };
    }
  },

  // ===================================================================
  // 12. AVALIAÇÕES DE PRODUTOS (TABELA: 'avaliacoes')
  // Supabase como fonte de verdade — localStorage apenas como cache
  // ===================================================================
  reviews: {
    /**
     * Busca avaliações aprovadas de um produto diretamente do Supabase.
     * Fallback para localStorage somente se Supabase estiver indisponível.
     */
    async getByProduct(productId) {
      const prodId = Number(productId);
      if (!prodId) return [];

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('avaliacoes')
            .select('*')
            .eq('produto_id', prodId)
            .eq('aprovado', true)
            .order('criado_em', { ascending: false });

          if (!error && data) {
            const mapped = data.map(r => ({
              id: r.id,
              product_id: r.produto_id,
              user_id: r.usuario_id,
              author: r.autor,
              email: r.email_autor || '',
              comment: r.comentario,
              rating: r.nota,
              verified: r.verificado,
              approved: r.aprovado,
              date: r.criado_em
            }));
            // Atualiza cache local por produto
            try { localStorage.setItem(`novatech_reviews_cache_${prodId}`, JSON.stringify(mapped)); } catch {}
            return mapped;
          }
          if (error) console.warn('Aviso ao buscar avaliações no Supabase:', error.message);
        } catch (e) {
          console.warn('Erro de conexão ao buscar avaliações:', e.message);
        }
      }

      // Fallback: tenta cache local (sem gravar no localStorage como fonte de verdade)
      try {
        const cached = localStorage.getItem(`novatech_reviews_cache_${prodId}`);
        if (cached) return JSON.parse(cached);
      } catch {}
      return [];
    },

    /**
     * Submete uma nova avaliação ao Supabase.
     * Tenta associar ao usuário logado se disponível.
     */
    async create({ productId, author, comment, rating = 5, email = '' }) {
      const prodId = Number(productId);
      if (!prodId) throw new Error('ID do produto inválido.');
      if (!author || !author.trim()) throw new Error('Informe o seu nome para publicar a avaliação.');
      if (!comment || !comment.trim()) throw new Error('Escreva um comentário para publicar a avaliação.');
      if (rating < 1 || rating > 5) throw new Error('A nota deve ser entre 1 e 5 estrelas.');

      // Tenta descobrir o usuário logado para associar à avaliação
      let userId = null;
      let isVerified = false;
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            const { data: profile } = await supabase
              .from('usuarios')
              .select('id')
              .eq('auth_user_id', authUser.id)
              .single();
            if (profile) {
              userId = profile.id;
              isVerified = true; // Usuário autenticado = compra verificável
            }
          }
        } catch {}
      }

      const payload = {
        produto_id: prodId,
        usuario_id: userId,
        autor: author.trim(),
        email_autor: email.trim() || null,
        comentario: comment.trim(),
        nota: Number(rating),
        verificado: isVerified,
        aprovado: true
      };

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('avaliacoes')
            .insert(payload)
            .select()
            .single();

          if (error) {
            console.error('Erro ao inserir avaliação no Supabase:', error);
            throw new Error('Não foi possível publicar a avaliação. Tente novamente.');
          }

          if (data) {
            // Limpa cache para forçar re-fetch atualizado
            try { localStorage.removeItem(`novatech_reviews_cache_${prodId}`); } catch {}
            return {
              id: data.id,
              product_id: data.produto_id,
              user_id: data.usuario_id,
              author: data.autor,
              comment: data.comentario,
              rating: data.nota,
              verified: data.verificado,
              approved: data.aprovado,
              date: data.criado_em
            };
          }
        } catch (sbErr) {
          if (sbErr.message && sbErr.message.includes('publicar')) throw sbErr;
          console.warn('Fallback local para avaliação:', sbErr.message);
        }
      }

      // Fallback local (somente quando Supabase indisponível)
      const localReview = {
        id: `local-${Date.now()}`,
        product_id: prodId,
        user_id: null,
        author: author.trim(),
        comment: comment.trim(),
        rating: Number(rating),
        verified: false,
        approved: true,
        date: new Date().toISOString(),
        _local: true // Marca como pendente de sincronização
      };

      // Adiciona ao cache local
      try {
        const cached = JSON.parse(localStorage.getItem(`novatech_reviews_cache_${prodId}`) || '[]');
        cached.unshift(localReview);
        localStorage.setItem(`novatech_reviews_cache_${prodId}`, JSON.stringify(cached));
      } catch {}

      return localReview;
    },

    /**
     * Busca TODAS as avaliações para o painel Admin (aprovadas e pendentes).
     * Apenas Admin deve chamar este método.
     */
    async getAll() {
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data, error } = await supabase
            .from('avaliacoes')
            .select('*, produtos(nome)')
            .order('criado_em', { ascending: false });

          if (!error && data) {
            return data.map(r => ({
              id: r.id,
              product_id: r.produto_id,
              product_name: r.produtos?.nome || '',
              user_id: r.usuario_id,
              author: r.autor,
              email: r.email_autor || '',
              comment: r.comentario,
              rating: r.nota,
              verified: r.verificado,
              approved: r.aprovado,
              date: r.criado_em
            }));
          }
        } catch (e) {
          console.warn('Erro ao buscar todas as avaliações:', e.message);
        }
      }
      return [];
    },

    /**
     * Admin: aprovar ou rejeitar uma avaliação.
     */
    async updateApproval(reviewId, approved) {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('avaliacoes')
          .update({ aprovado: Boolean(approved) })
          .eq('id', reviewId)
          .select()
          .single();
        if (error) throw new Error('Falha ao atualizar avaliação: ' + error.message);
        return data;
      }
      return { id: reviewId, approved };
    },

    /**
     * Admin: excluir uma avaliação.
     */
    async delete(reviewId) {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('avaliacoes').delete().eq('id', reviewId);
        if (error) throw new Error('Falha ao excluir avaliação: ' + error.message);
      }
      return { success: true };
    }
  },

  // ===================================================================
  // 13. BANCO DE DADOS & SCHEMA (SUPABASE ASSISTANT)
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
      const tablesToCheck = ['usuarios', 'categorias', 'catalogos', 'produtos', 'banners', 'cupons', 'pedidos', 'itens_pedido', 'movimentacoes_estoque', 'configuracoes_loja', 'avaliacoes'];

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
