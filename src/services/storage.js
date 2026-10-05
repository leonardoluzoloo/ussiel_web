// ===================================================================
// STORAGE SERVICE (State Management: Cart, Wishlist, User, Orders)
// ===================================================================

const STORAGE_KEYS = {
  CART: 'novatech_cart_v1',
  WISHLIST: 'novatech_wishlist_v1',
  USER: 'novatech_user_v1',
  RECENT_SEARCHES: 'novatech_searches_v1',
  COUPON: 'novatech_coupon_v1'
};

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

  saveCart(cart) {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: { cart } }));
  },

  addToCart(product, quantity = 1, selectedVariant = {}) {
    const cart = this.getCart();
    const variantKey = `${product.id}-${selectedVariant.color || ''}-${selectedVariant.storage || ''}`;
    const maxStock = product.stock !== undefined ? Number(product.stock) : 999;
    const allowNoStock = Boolean(product.allow_out_of_stock_sales);

    // Validação de estoque real
    if (!allowNoStock && maxStock <= 0) {
      throw new Error('Este produto está temporariamente esgotado no estoque.');
    }

    const existingIndex = cart.findIndex(item => item.key === variantKey);

    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      const desiredQty = currentQty + quantity;

      if (!allowNoStock && desiredQty > maxStock) {
        cart[existingIndex].quantity = maxStock;
        this.saveCart(cart);
        throw new Error(`Estoque máximo atingido. Quantidade ajustada para ${maxStock} unidades.`);
      }
      cart[existingIndex].quantity = desiredQty;
      cart[existingIndex].stock = maxStock;
    } else {
      const finalQty = (!allowNoStock && quantity > maxStock) ? maxStock : quantity;
      cart.push({
        key: variantKey,
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        image: product.image,
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
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  },

  getCartSubtotal() {
    const cart = this.getCart();
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  // --- WISHLIST (ISOLADA POR CONTA DE USUÁRIO) ---
  _getWishlistKey() {
    const user = this.getUser();
    if (user && (user.id || user.email)) {
      const userKey = (user.id || user.email).toString().replace(/[^a-zA-Z0-9_-]/g, '_');
      return `${STORAGE_KEYS.WISHLIST}_${userKey}`;
    }
    return STORAGE_KEYS.WISHLIST;
  },

  getWishlist() {
    try {
      const key = this._getWishlistKey();
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  toggleWishlist(productId) {
    let list = this.getWishlist();
    let isAdded = false;
    if (list.includes(productId) || list.includes(String(productId)) || list.includes(Number(productId))) {
      list = list.filter(id => String(id) !== String(productId));
      isAdded = false;
    } else {
      list.push(productId);
      isAdded = true;
    }
    const key = this._getWishlistKey();
    localStorage.setItem(key, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('wishlist-updated', { detail: { list, productId, isAdded } }));
    return isAdded;
  },

  isInWishlist(productId) {
    const list = this.getWishlist();
    return list.includes(productId) || list.includes(String(productId)) || list.includes(Number(productId));
  },

  // --- COUPONS ---
  getAppliedCoupon() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COUPON);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveAppliedCoupon(coupon) {
    if (coupon) {
      localStorage.setItem(STORAGE_KEYS.COUPON, JSON.stringify(coupon));
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
    localStorage.removeItem(STORAGE_KEYS.COUPON);
    window.dispatchEvent(new CustomEvent('coupon-updated', { detail: { coupon: null } }));
  },

  // --- USER AUTH & PROFILE ---
  getUser() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveUser(user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('user-updated', { detail: { user } }));
  },

  logoutUser() {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem('novatech_auth_token_v2');
    localStorage.removeItem('novatech_auth_token_v1');
    localStorage.removeItem('novatech_admin_session');
    localStorage.removeItem(STORAGE_KEYS.COUPON);

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
    window.dispatchEvent(new CustomEvent('user-updated', { detail: { user: null } }));
  },



  // --- ORDERS ---
  getOrders() {
    try {
      const data = localStorage.getItem('novatech_customer_orders_cache');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveOrders(orders) {
    try {
      localStorage.setItem('novatech_customer_orders_cache', JSON.stringify(orders || []));
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
