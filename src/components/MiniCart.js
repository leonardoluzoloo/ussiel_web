// ===================================================================
// MINI CART DRAWER COMPONENT
// ===================================================================

import { Icons } from '../utils/icons.js';
import { formatPrice } from '../utils/format.js';
import { Storage, FREE_SHIPPING_THRESHOLD } from '../services/storage.js';
import { Api } from '../services/api.js';
import { Toast } from './Toast.js';

export function setupMiniCart() {
  // Create backdrop and drawer elements
  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop';

  const drawer = document.createElement('div');
  drawer.className = 'cart-drawer';

  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  function renderCart() {
    const cart = Storage.getCart();
    const subtotal = Storage.getCartSubtotal();
    const coupon = Storage.getAppliedCoupon();

    let discountAmount = 0;
    if (coupon) {
      if (coupon.type === 'percent') {
        discountAmount = Math.round(subtotal * (coupon.value / 100));
      } else if (coupon.type === 'fixed') {
        discountAmount = Math.min(coupon.value, subtotal);
      }
    }

    const total = Math.max(0, subtotal - discountAmount);

    // Free shipping calculation
    const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
    const shippingProgressPct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));

    drawer.innerHTML = `
      <!-- Header -->
      <div class="drawer-header">
        <div class="drawer-title">
          ${Icons.cart(22, 'var(--primary-600)')}
          <span>Seu Carrinho (${Storage.getCartCount()})</span>
        </div>
        <button class="drawer-close" id="closeMiniCart">
          ${Icons.close(18)}
        </button>
      </div>

      <!-- Free Shipping Progress -->
      <div class="shipping-progress-box">
        <div class="shipping-progress-text">
          ${remainingForFreeShipping > 0 
            ? `Faltam <strong>${formatPrice(remainingForFreeShipping)}</strong> para ganhar <strong>FRETE GRÁTIS!</strong>`
            : `🎉 <strong>Parabéns!</strong> Você ganhou <strong>FRETE GRÁTIS!</strong>`
          }
        </div>
        <div class="shipping-progress-track">
          <div class="shipping-progress-bar" style="width: ${shippingProgressPct}%"></div>
        </div>
      </div>

      <!-- Body / Items -->
      <div class="drawer-body">
        ${cart.length === 0 ? `
          <div style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
            <div style="margin-bottom: 16px; opacity: 0.5;">
              ${Icons.cart(54, 'var(--text-muted)')}
            </div>
            <h4 style="font-size: 1.125rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">
              Seu carrinho está vazio
            </h4>
            <p style="font-size: 0.875rem; margin-bottom: 24px;">
              Explore as nossas ofertas e adicione produtos incríveis!
            </p>
            <button class="btn btn-primary" id="drawerExploreBtn">
              Começar a Comprar
            </button>
          </div>
        ` : `
          ${cart.map(item => `
            <div class="drawer-item" data-item-key="${item.key}">
              <img src="${item.image}" alt="${item.name}" class="drawer-item-img" />
              <div class="drawer-item-info">
                <h4 class="drawer-item-name">${item.name}</h4>
                ${item.variant?.color || item.variant?.storage ? `
                  <div class="drawer-item-variant">
                    ${[item.variant.color, item.variant.storage].filter(Boolean).join(' • ')}
                  </div>
                ` : ''}
                <div class="drawer-item-bottom">
                  <div class="qty-control">
                    <button class="qty-btn" data-action="decrease" data-key="${item.key}">-</button>
                    <span class="qty-val">${item.quantity}</span>
                    <button class="qty-btn" data-action="increase" data-key="${item.key}">+</button>
                  </div>
                  <div class="drawer-item-price">${formatPrice(item.price * item.quantity)}</div>
                  <button class="btn-remove-item" data-action="remove" data-key="${item.key}" title="Remover item">
                    ${Icons.trash(16)}
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        `}
      </div>

      <!-- Footer -->
      ${cart.length > 0 ? `
        <div class="drawer-footer">
          <!-- Coupon Box -->
          <div style="margin-bottom: 16px;">
            ${coupon ? `
              <div style="display: flex; align-items: center; justify-content: space-between; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.8125rem; color: #065f46;">
                <span>Cupom <strong>${coupon.code}</strong> aplicado (${coupon.description})</span>
                <button id="drawerRemoveCoupon" style="color: #065f46; font-weight: 700; cursor: pointer;">✕</button>
              </div>
            ` : `
              <div style="display: flex; gap: 8px;">
                <input type="text" id="drawerCouponInput" placeholder="Código de Cupom..." style="flex: 1; height: 38px; padding: 0 12px; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.8125rem;" />
                <button id="drawerApplyCoupon" class="btn btn-secondary" style="height: 38px; padding: 0 14px; font-size: 0.8125rem;">Aplicar</button>
              </div>
            `}
          </div>

          <div class="drawer-summary-row">
            <span>Subtotal</span>
            <strong>${formatPrice(subtotal)}</strong>
          </div>
          ${discountAmount > 0 ? `
            <div class="drawer-summary-row" style="color: var(--accent-emerald);">
              <span>Desconto</span>
              <strong>-${formatPrice(discountAmount)}</strong>
            </div>
          ` : ''}
          <div class="drawer-summary-row total">
            <span>Total Estimado</span>
            <span>${formatPrice(total)}</span>
          </div>

          <div class="drawer-actions">
            <button class="btn btn-accent btn-full" id="drawerCheckoutBtn">
              Finalizar Compra
            </button>
            <button class="btn btn-secondary btn-full" id="drawerViewCartBtn">
              Ver Carrinho Completo
            </button>
          </div>
        </div>
      ` : ''}
    `;

    // Event listeners inside drawer
    attachDrawerEvents();
  }

  function attachDrawerEvents() {
    const closeBtn = drawer.querySelector('#closeMiniCart');
    if (closeBtn) closeBtn.onclick = closeDrawer;

    const exploreBtn = drawer.querySelector('#drawerExploreBtn');
    if (exploreBtn) exploreBtn.onclick = () => {
      closeDrawer();
      window.location.hash = '/catalogo';
    };

    // Quantity modifiers
    drawer.querySelectorAll('[data-action="increase"]').forEach(btn => {
      btn.onclick = () => {
        Storage.updateCartQty(btn.dataset.key, 1);
        renderCart();
      };
    });

    drawer.querySelectorAll('[data-action="decrease"]').forEach(btn => {
      btn.onclick = () => {
        Storage.updateCartQty(btn.dataset.key, -1);
        renderCart();
      };
    });

    drawer.querySelectorAll('[data-action="remove"]').forEach(btn => {
      btn.onclick = () => {
        Storage.removeFromCart(btn.dataset.key);
        renderCart();
        Toast.show({ title: 'Item removido do carrinho', type: 'info' });
      };
    });

    // Apply Coupon
    const applyCouponBtn = drawer.querySelector('#drawerApplyCoupon');
    if (applyCouponBtn) {
      applyCouponBtn.onclick = async () => {
        const input = drawer.querySelector('#drawerCouponInput');
        const code = input?.value.trim();
        if (!code) {
          Toast.show({ title: 'Atenção', message: 'Digite o código do cupom.', type: 'warning' });
          return;
        }

        applyCouponBtn.disabled = true;
        applyCouponBtn.innerHTML = '...';

        try {
          const validated = await Api.coupons.validate(code, Storage.getCartSubtotal());
          Storage.saveAppliedCoupon({
            code: validated.code,
            type: validated.discount_type || validated.type || 'percent',
            value: Number(validated.discount_value || validated.value || 0),
            description: validated.description || `Cupom ${validated.code} aplicado com sucesso!`
          });
          Toast.show({ title: 'Cupom aplicado! 🎉', message: 'Desconto adicionado ao carrinho.', type: 'success' });
          renderCart();
        } catch (err) {
          Toast.show({ title: 'Cupom inválido', message: err.message || 'Verifique o código e tente novamente.', type: 'warning' });
          applyCouponBtn.disabled = false;
          applyCouponBtn.innerHTML = 'Aplicar';
        }
      };
    }

    const removeCouponBtn = drawer.querySelector('#drawerRemoveCoupon');
    if (removeCouponBtn) {
      removeCouponBtn.onclick = () => {
        Storage.removeCoupon();
        renderCart();
      };
    }

    // Checkout & View Cart
    const checkoutBtn = drawer.querySelector('#drawerCheckoutBtn');
    if (checkoutBtn) {
      checkoutBtn.onclick = () => {
        const user = Storage.getUser();
        if (!user) {
          closeDrawer();
          Toast.show({
            title: 'Identificação Necessária',
            message: 'Inicie sessão ou crie uma conta para finalizar a sua encomenda.',
            type: 'info'
          });
          window.dispatchEvent(new CustomEvent('open-auth-modal'));
          const onLogin = () => {
            window.removeEventListener('user-updated', onLogin);
            window.location.hash = '/checkout';
          };
          window.addEventListener('user-updated', onLogin);
          return;
        }
        closeDrawer();
        window.location.hash = '/checkout';
      };
    }

    const viewCartBtn = drawer.querySelector('#drawerViewCartBtn');
    if (viewCartBtn) {
      viewCartBtn.onclick = () => {
        closeDrawer();
        window.location.hash = '/carrinho';
      };
    }
  }

  function openDrawer() {
    renderCart();
    backdrop.classList.add('active');
    drawer.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    backdrop.classList.remove('active');
    drawer.classList.remove('active');
    document.body.style.overflow = '';
  }

  backdrop.onclick = closeDrawer;

  // Global triggers
  window.addEventListener('open-mini-cart', openDrawer);
  window.addEventListener('cart-updated', () => {
    if (drawer.classList.contains('active')) {
      renderCart();
    }
  });

  return { openDrawer, closeDrawer };
}
