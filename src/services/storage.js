// ===================================================================
// STORAGE SERVICE (State Management: Cart, Wishlist, User, Orders)
// ===================================================================

const STORAGE_KEYS = {
  CART: 'novatech_cart_v1',
  WISHLIST: 'novatech_wishlist_v1',
  USER: 'novatech_user_v1',
  ORDERS: 'novatech_orders_v2',
  RECENT_SEARCHES: 'novatech_searches_v1',
  COUPON: 'novatech_coupon_v1'
};

export const FREE_SHIPPING_THRESHOLD = 1000000; // Kz 1.000.000 for free shipping

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
    
    const existingIndex = cart.findIndex(item => item.key === variantKey);

    if (existingIndex > -1) {
      cart[existingIndex].quantity += quantity;
    } else {
      cart.push({
        key: variantKey,
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        image: product.image,
        variant: selectedVariant,
        quantity: quantity,
        stock: product.stock
      });
    }

    this.saveCart(cart);
    return cart;
  },

  updateCartQty(itemKey, delta) {
    let cart = this.getCart();
    const item = cart.find(i => i.key === itemKey);
    if (!item) return cart;

    item.quantity += delta;
    if (item.quantity <= 0) {
      cart = cart.filter(i => i.key !== itemKey);
    }
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

  // --- WISHLIST ---
  getWishlist() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WISHLIST);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  toggleWishlist(productId) {
    let list = this.getWishlist();
    let isAdded = false;
    if (list.includes(productId)) {
      list = list.filter(id => id !== productId);
      isAdded = false;
    } else {
      list.push(productId);
      isAdded = true;
    }
    localStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('wishlist-updated', { detail: { list, productId, isAdded } }));
    return isAdded;
  },

  isInWishlist(productId) {
    return this.getWishlist().includes(productId);
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

    // Tenta resgatar cupons sincronizados localmente caso esteja offline
    try {
      const localCoupons = JSON.parse(localStorage.getItem('novatech_coupons_db') || '[]');
      const found = localCoupons.find(c => c.code && c.code.toUpperCase() === clean);
      if (found) {
        return this.saveAppliedCoupon({
          code: found.code,
          type: found.discount_type || found.type || 'percent',
          value: Number(found.discount_value || found.value || 0),
          description: found.description || `Cupom ${found.code} aplicado`
        });
      }
    } catch {}

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
    localStorage.removeItem('novatech_auth_token_v1');
    window.dispatchEvent(new CustomEvent('user-updated', { detail: { user: null } }));
  },

  // --- ORDERS ---
  getOrders() {
    try {
      localStorage.removeItem('novatech_orders_v1'); // Remove mock antigo
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveOrder(order) {
    const orders = this.getOrders();
    orders.unshift(order);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    this.clearCart();
    this.removeCoupon();
    window.dispatchEvent(new CustomEvent('order-created', { detail: { order } }));
    return order;
  },

  updateOrderStatus(orderId, newStatus) {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.status = newStatus;
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
      window.dispatchEvent(new CustomEvent('order-updated', { detail: { order } }));
    }
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
