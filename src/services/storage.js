// ===================================================================
// STORAGE SERVICE (State Management: Cart, Wishlist, User, Orders)
// ===================================================================

const STORAGE_KEYS = {
  CART: 'novatech_cart_v1',
  WISHLIST: 'novatech_wishlist_session',
  USER: 'novatech_user_v1',
  ADMIN_USER: 'novatech_admin_user_v1',
  ADMIN_TOKEN: 'novatech_admin_token_v1',
  RECENT_SEARCHES: 'novatech_searches_v1',
  COUPON: 'novatech_coupon_session',
  REMEMBER_ME: 'novatech_remember_me'
};

// Purga seletiva e segura:
// 1. DADOS DE ADMIN: SEMPRE purgados de localStorage (segurança corporativa OWASP, zero persistência de admin).
// 2. DADOS DE CLIENTE: Purgados de localStorage APENAS se o cliente NÃO marcou 'Lembrar de mim'.
(function purgeUnintendedAuthFromLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    const isRememberMe = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true';
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      // Administrador e credenciais administrativas: PURGA COMPULSÓRIA SEMPRE
      if (
        k.startsWith('novatech_admin_') ||
        k === 'novatech_admin_session' ||
        k === STORAGE_KEYS.ADMIN_USER ||
        k === STORAGE_KEYS.ADMIN_TOKEN
      ) {
        keysToRemove.push(k);
        continue;
      }

      // Se 'Lembrar de mim' NÃO está ativo para clientes, purga sessões de usuário e tokens Supabase
      if (!isRememberMe) {
        if (
          k.startsWith('sb-') ||
          k.startsWith('novatech_user_') ||
          k.startsWith('novatech_auth_')
        ) {
          keysToRemove.push(k);
          continue;
        }
      }

      // Caches voláteis e dados de pedidos/cupons que não devem poluir localStorage
      if (
        k.startsWith('novatech_wishlist') ||
        k.startsWith('novatech_reviews_') ||
        k.startsWith('novatech_coupon') ||
        k.startsWith('novatech_customer_orders_cache') ||
        k.startsWith('novatech_stable_uid_')
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
  } catch {}
})();

export const FREE_SHIPPING_THRESHOLD = 1000000; // Kz 1.000.000 for free shipping

// Mapeador e normalizador canônico de status de pedidos (PT <-> EN)
export function normalizeOrderStatus(status) {
  if (!status) return 'received';
  const clean = String(status).toLowerCase().trim();
  switch (clean) {
    case 'recebido':
    case 'received':
      return 'received';
    case 'confirmado':
    case 'confirmed':
    case 'paid':
    case 'pago':
      return 'confirmed';
    case 'preparando':
    case 'preparacao':
    case 'em_preparacao':
    case 'preparing':
      return 'preparing';
    case 'enviado':
    case 'in_transit':
    case 'em_transito':
    case 'shipped':
      return 'shipped';
    case 'entregue':
    case 'delivered':
    case 'concluido':
      return 'delivered';
    case 'cancelado':
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return clean;
  }
}

export const Storage = {
  // --- CART ---
  getCart() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CART);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveCart(cart, options = {}) {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: { cart } }));

    if (!options.skipDbSync && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cart-db-sync', { detail: { cart } }));
    }
  },

  addToCart(product, quantity = 1, selectedVariant = {}, options = {}) {
    const cart = this.getCart();
    const variantKey = `${product.id}-${selectedVariant.color || ''}-${selectedVariant.storage || ''}`;
    const maxStock = product.stock !== undefined ? Number(product.stock) : 999;
    const allowNoStock = Boolean(product.allow_out_of_stock_sales);
    const addQty = Math.max(1, Number(quantity) || 1);

    // Validação de estoque real
    if (!allowNoStock && maxStock <= 0) {
      throw new Error('Este produto está temporariamente esgotado no estoque.');
    }

    const existingIndex = cart.findIndex(item => item.key === variantKey);

    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      const desiredQty = options.overwriteQty ? addQty : (currentQty + addQty);

      if (!allowNoStock && desiredQty > maxStock) {
        cart[existingIndex].quantity = maxStock;
        this.saveCart(cart);
        throw new Error(`Estoque máximo atingido. Quantidade ajustada para ${maxStock} unidades.`);
      }
      cart[existingIndex].quantity = desiredQty;
      cart[existingIndex].stock = maxStock;
    } else {
      const finalQty = (!allowNoStock && addQty > maxStock) ? maxStock : addQty;
      cart.push({
        key: variantKey,
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        image: (selectedVariant && selectedVariant.image) || product.image,
        variant: selectedVariant,
        quantity: finalQty,
        stock: maxStock
      });
    }

    this.saveCart(cart);
    return cart;
  },

  updateCartQty(itemKey, delta) {
    let cart = this.getCart();
    const item = cart.find(i => i.key === itemKey);
    if (!item) return cart;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      return this.removeFromCart(itemKey);
    }

    // Não permite ultrapassar estoque disponível no carrinho
    if (item.stock !== undefined && item.stock > 0 && newQty > item.stock) {
      item.quantity = item.stock;
      this.saveCart(cart);
      throw new Error(`Estoque insuficiente. Apenas ${item.stock} unidades disponíveis.`);
    }

    item.quantity = newQty;
    this.saveCart(cart);
    return cart;
  },

  removeFromCart(itemKey) {
    let cart = this.getCart();
    cart = cart.filter(i => i.key !== itemKey);
    this.saveCart(cart);
    return cart;
  },

  clearCart() {
    this.saveCart([]);
  },

  getCartCount() {
    const cart = this.getCart();
    return cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  },

  getCartSubtotal() {
    const cart = this.getCart();
    return cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);
  },

  // --- WISHLIST (SESSÃO EM MEMÓRIA/SESSION STORAGE + BANCO SUPABASE VIA API) ---
  _getWishlistKey() {
    return STORAGE_KEYS.WISHLIST;
  },

  getWishlist() {
    try {
      const data = sessionStorage.getItem(STORAGE_KEYS.WISHLIST);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  setWishlist(list) {
    try {
      sessionStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(list || []));
      window.dispatchEvent(new CustomEvent('wishlist-updated', { detail: { list: list || [] } }));
    } catch {}
  },

  toggleWishlist(productId) {
    let list = this.getWishlist();
    const cleanId = Number(productId);
    let isAdded = false;
    if (list.includes(cleanId) || list.includes(String(productId))) {
      list = list.filter(id => Number(id) !== cleanId && String(id) !== String(productId));
      isAdded = false;
    } else {
      list.push(cleanId || productId);
      isAdded = true;
    }
    try {
      sessionStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(list));
    } catch {}
    // Dispara evento local para UI reagir instantaneamente
    window.dispatchEvent(new CustomEvent('wishlist-updated', { detail: { list, productId, isAdded } }));

    // Dispara evento para sincronizar persistência no banco de dados (public.favoritos)
    window.dispatchEvent(new CustomEvent('wishlist-db-sync', { detail: { productId, isAdded } }));

    return isAdded;
  },

  isInWishlist(productId) {
    const list = this.getWishlist();
    const cleanId = Number(productId);
    return list.includes(cleanId) || list.includes(String(productId)) || list.includes(productId);
  },

  // --- COUPONS (SESSION STORAGE - ZERO LOCALSTORAGE) ---
  getAppliedCoupon() {
    try {
      const data = sessionStorage.getItem(STORAGE_KEYS.COUPON);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveAppliedCoupon(coupon) {
    if (coupon) {
      sessionStorage.setItem(STORAGE_KEYS.COUPON, JSON.stringify(coupon));
      window.dispatchEvent(new CustomEvent('coupon-updated', { detail: { coupon } }));
      return { success: true, coupon };
    }
    return { success: false, message: 'Cupom inválido.' };
  },

  applyCoupon(couponOrCode) {
    if (typeof couponOrCode === 'object' && couponOrCode !== null) {
      return this.saveAppliedCoupon(couponOrCode);
    }
    const clean = String(couponOrCode || '').trim().toUpperCase();
    if (!clean) return { success: false, message: 'Informe o código do cupom.' };
    return { success: false, message: 'Cupom inválido ou não encontrado.' };
  },

  removeCoupon() {
    sessionStorage.removeItem(STORAGE_KEYS.COUPON);
    window.dispatchEvent(new CustomEvent('coupon-updated', { detail: { coupon: null } }));
  },

  // --- REMEMBER ME HELPERS (CONTROLE DE PERSISTÊNCIA SELETIVA) ---
  isRememberMeActive() {
    try {
      return localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true';
    } catch {
      return false;
    }
  },

  setRememberMe(active) {
    try {
      if (active) {
        localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
      }
    } catch {}
  },

  // --- USER AUTH & PROFILE (HÍBRIDO CONFORME REGRA 2 DE ALTO PADRÃO) ---
  getUser() {
    try {
      // 1. Prioridade para sessão ativa em sessionStorage (admin ou cliente em sessão atual)
      const data = sessionStorage.getItem(STORAGE_KEYS.USER);
      if (data) return JSON.parse(data);

      // 2. Fallback para sessão de administrador ativa em sessionStorage
      const adminData = sessionStorage.getItem(STORAGE_KEYS.ADMIN_USER);
      if (adminData) return JSON.parse(adminData);

      // 3. Cliente comum com 'Lembrar de mim' ativo no localStorage
      if (this.isRememberMeActive()) {
        const localData = localStorage.getItem(STORAGE_KEYS.USER);
        if (localData) {
          const parsed = JSON.parse(localData);
          // Hardening de Segurança OWASP: se por anomalia for admin no localStorage, purga na hora!
          if (parsed && (parsed.role === 'admin' || parsed.nivel_acesso === 'admin')) {
            localStorage.removeItem(STORAGE_KEYS.USER);
            this.setRememberMe(false);
            return null;
          }
          return parsed;
        }
      }

      return null;
    } catch {
      return null;
    }
  },

  getCustomerUser() {
    try {
      const u = this.getUser();
      return (u && u.role !== 'admin' && u.nivel_acesso !== 'admin') ? u : null;
    } catch {
      return null;
    }
  },

  saveUser(user, options = {}) {
    if (!user) return;

    // REGRA 1 DE ADMIN: Segurança máxima corporativa (OWASP / PCI-DSS / ISO 27001).
    // Administrador NUNCA reside em localStorage. Sempre forçado estritamente para sessionStorage.
    if (user.role === 'admin' || user.nivel_acesso === 'admin') {
      sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_USER, JSON.stringify(user));
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
      this.setRememberMe(false);
      window.dispatchEvent(new CustomEvent('admin-user-updated', { detail: { user } }));
      window.dispatchEvent(new CustomEvent('user-updated', { detail: { user } }));
      return;
    }

    // REGRA 2 DE CLIENTE COM "LEMBRAR DE MIM":
    const shouldRemember = options.rememberMe !== undefined
      ? Boolean(options.rememberMe)
      : this.isRememberMeActive();

    this.setRememberMe(shouldRemember);

    if (shouldRemember) {
      // Cliente optou por lembrar: persiste em localStorage para sobreviver ao fechamento da janela
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      sessionStorage.removeItem(STORAGE_KEYS.USER);
    } else {
      // Cliente NÃO marcou lembrar (computador público): restrito à sessão da janela atual
      sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      localStorage.removeItem(STORAGE_KEYS.USER);
    }

    window.dispatchEvent(new CustomEvent('user-updated', { detail: { user } }));
  },

  // --- ADMIN AUTH & PROFILE DEDICADO (SESSION STORAGE ESTRITO) ---
  getAdminUser() {
    try {
      const adminData = sessionStorage.getItem(STORAGE_KEYS.ADMIN_USER);
      if (adminData) {
        const parsed = JSON.parse(adminData);
        if (parsed && (parsed.role === 'admin' || parsed.nivel_acesso === 'admin')) {
          return parsed;
        }
      }
      // Fallback seguro: se a sessão geral tiver papel de admin
      const userData = sessionStorage.getItem(STORAGE_KEYS.USER);
      if (userData) {
        const parsed = JSON.parse(userData);
        if (parsed && (parsed.role === 'admin' || parsed.nivel_acesso === 'admin')) {
          sessionStorage.setItem(STORAGE_KEYS.ADMIN_USER, JSON.stringify(parsed));
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  saveAdminUser(user) {
    if (!user) return;
    const adminObj = { ...user, role: 'admin', nivel_acesso: 'admin' };

    // Grava estritamente em sessionStorage (zero localStorage)
    sessionStorage.setItem(STORAGE_KEYS.ADMIN_USER, JSON.stringify(adminObj));
    localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
    this.setRememberMe(false);

    // Se a sessão de usuário ativa pertencer ao admin, atualiza também em sessionStorage
    const current = this.getUser();
    if (!current || current.role === 'admin' || current.email === adminObj.email) {
      sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(adminObj));
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
    window.dispatchEvent(new CustomEvent('admin-user-updated', { detail: { user: adminObj } }));
    window.dispatchEvent(new CustomEvent('user-updated', { detail: { user: adminObj } }));
  },

  logoutAdmin() {
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    sessionStorage.removeItem('novatech_admin_session');

    // Remove do localStorage por garantia de purga
    localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem('novatech_admin_session');
    this.setRememberMe(false);

    // Se a sessão da loja pertencia a esse mesmo admin, limpa também
    const current = this.getUser();
    if (current && (current.role === 'admin' || current.nivel_acesso === 'admin')) {
      sessionStorage.removeItem(STORAGE_KEYS.USER);
      sessionStorage.removeItem('novatech_auth_token_v2');
      sessionStorage.removeItem('novatech_auth_token_v1');
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem('novatech_auth_token_v2');
      localStorage.removeItem('novatech_auth_token_v1');
    }

    // Limpar caches administrativos
    localStorage.removeItem('novatech_admin_pedidos_v4_clean');
    localStorage.removeItem('novatech_admin_orders_cache');
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('novatech_admin_'))
        .forEach(k => localStorage.removeItem(k));
    } catch {}

    window.dispatchEvent(new CustomEvent('admin-user-updated', { detail: { user: null } }));
    window.dispatchEvent(new CustomEvent('user-updated', { detail: { user: this.getUser() } }));
  },

  logoutCustomer() {
    sessionStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.USER);
    this.setRememberMe(false);

    // Preserva o token e sessão do painel administrativo se houver admin logado
    const admin = this.getAdminUser();
    if (!admin) {
      sessionStorage.removeItem('novatech_auth_token_v2');
      sessionStorage.removeItem('novatech_auth_token_v1');
      localStorage.removeItem('novatech_auth_token_v2');
      localStorage.removeItem('novatech_auth_token_v1');
    }
    localStorage.removeItem(STORAGE_KEYS.COUPON);
    localStorage.removeItem('novatech_customer_orders_cache');
    window.dispatchEvent(new CustomEvent('user-updated', { detail: { user: this.getUser() } }));
  },

  logoutUser() {
    sessionStorage.removeItem(STORAGE_KEYS.USER);
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    sessionStorage.removeItem('novatech_auth_token_v2');
    sessionStorage.removeItem('novatech_auth_token_v1');
    sessionStorage.removeItem('novatech_admin_session');

    // Purga completa no localStorage
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem('novatech_auth_token_v2');
    localStorage.removeItem('novatech_auth_token_v1');
    localStorage.removeItem('novatech_admin_session');
    localStorage.removeItem(STORAGE_KEYS.COUPON);
    this.setRememberMe(false);

    // Limpar todos os caches sensíveis associados a conta
    localStorage.removeItem('novatech_admin_pedidos_v4_clean');
    localStorage.removeItem('novatech_admin_orders_cache');
    localStorage.removeItem('novatech_customer_orders_cache');
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('novatech_reviews_cache_') || k.startsWith('novatech_admin_'))
        .forEach(k => localStorage.removeItem(k));
    } catch {}

    sessionStorage.clear();
    window.dispatchEvent(new CustomEvent('admin-user-updated', { detail: { user: null } }));
    window.dispatchEvent(new CustomEvent('user-updated', { detail: { user: null } }));
  },



  // --- ORDERS (SESSION STORAGE - ZERO LOCALSTORAGE) ---
  getOrders() {
    try {
      const data = sessionStorage.getItem('novatech_orders_session');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveOrders(orders) {
    try {
      sessionStorage.setItem('novatech_orders_session', JSON.stringify(orders || []));
      localStorage.removeItem('novatech_customer_orders_cache');
    } catch {}
  },

  // --- RECENT SEARCHES ---
  getRecentSearches() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES);
      return data ? JSON.parse(data) : ['iPhone 16 Pro', 'PlayStation 5', 'MacBook M3', 'Sony WH-1000XM5'];
    } catch {
      return [];
    }
  },

  addRecentSearch(term) {
    if (!term || !term.trim()) return;
    let list = this.getRecentSearches().filter(t => t.toLowerCase() !== term.toLowerCase());
    list.unshift(term.trim());
    if (list.length > 6) list = list.slice(0, 6);
    localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(list));
  }
};
