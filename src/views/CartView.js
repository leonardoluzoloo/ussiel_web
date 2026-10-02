// ===================================================================
// CART VIEW (Full Cart Page with Shipping Calculator & Order Summary)
// ===================================================================

import { Icons } from '../utils/icons.js';
import { formatPrice } from '../utils/format.js';
import { Storage, FREE_SHIPPING_THRESHOLD } from '../services/storage.js';
import { Api } from '../services/api.js';
import { Toast } from '../components/Toast.js';

export function renderCartView() {
  const container = document.createElement('div');
  container.className = 'container';

  // Province shipping estimates for Angola
  const PROVINCE_RATES = {
    'Luanda': 3500,
    'Benguela': 8500,
    'Huambo': 9000,
    'Huíla': 9500,
    'Cabinda': 12000,
    'Cuanza Sul': 7500,
    'Uíge': 8000
  };

  let selectedProvince = 'Luanda';

  function render() {
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

    const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD || coupon?.type === 'free_shipping';
    const shippingPrice = isFreeShipping ? 0 : (PROVINCE_RATES[selectedProvince] || 3500);
    const total = Math.max(0, subtotal - discountAmount + shippingPrice);

    const remainingForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
    const progressPct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));

    container.innerHTML = `
      <div style="margin-top: 32px; margin-bottom: 24px;">
        <h1 style="font-family: var(--font-display); font-size: 2rem; font-weight: 900; color: var(--text-main);">
          Meu Carrinho de Compras
        </h1>
        <p style="color: var(--text-secondary); font-size: 0.9375rem;">
          Revise os seus produtos selecionados antes de avançar para a finalização do pedido.
        </p>
      </div>

      ${cart.length === 0 ? `
        <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 72px 24px; text-align: center; margin-bottom: 64px;">
          <div style="margin-bottom: 16px; opacity: 0.4;">
            ${Icons.cart(64, 'var(--text-muted)')}
          </div>
          <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">
            O seu carrinho de compras está vazio
          </h2>
          <p style="color: var(--text-secondary); font-size: 1rem; max-width: 480px; margin: 0 auto 28px auto;">
            Aproveite as novidades e ofertas imperdíveis em smartphones, laptops, consoles e fones de ouvido!
          </p>
          <a href="#/" class="btn btn-primary" style="padding: 14px 32px;">
            Explorar Produtos
          </a>
        </div>
      ` : `
        <!-- Free Shipping Reminder -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 16px 20px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 0.875rem; font-weight: 700; color: #166534;">
              ${remainingForFree > 0
        ? `Faltam ${formatPrice(remainingForFree)} para você ganhar FRETE GRÁTIS em Luanda!`
        : `🎉 Parabéns! O seu pedido atingiu o valor de Frete Grátis!`
      }
            </span>
            <span style="font-size: 0.75rem; font-weight: 700; color: #166534;">${progressPct}%</span>
          </div>
          <div style="width: 100%; height: 8px; background: #dcfce7; border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: ${progressPct}%; background: var(--accent-emerald); border-radius: 4px; transition: width 0.3s ease;"></div>
          </div>
        </div>

        <!-- Cart Grid Layout -->
        <div class="checkout-grid">
          <!-- Left: Cart Items List -->
          <div>
            <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); overflow: hidden; margin-bottom: 20px;">
              <!-- Header row (Desktop) -->
              <div class="cart-table-header">
                <span>Produto</span>
                <span>Preço Unitário</span>
                <span style="text-align: center;">Quantidade</span>
                <span style="text-align: right;">Subtotal</span>
                <span></span>
              </div>

              <!-- Items -->
              ${cart.map(item => `
                <div class="cart-item-row">
                  <div class="cart-item-product-info">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-thumb" />
                    <div class="cart-item-details">
                      <h4 class="cart-item-name">
                        ${item.name}
                      </h4>
                      ${item.variant?.color || item.variant?.storage ? `
                        <div class="cart-item-variant">
                          ${[item.variant.color, item.variant.storage].filter(Boolean).join(' • ')}
                        </div>
                      ` : ''}
                      <div class="cart-item-sku">
                        SKU: ${item.sku}
                      </div>
                    </div>
                  </div>

                  <!-- Unit Price -->
                  <div class="cart-item-unit-price">
                    ${formatPrice(item.price)}
                  </div>

                  <!-- Qty -->
                  <div class="cart-item-qty">
                    <div class="qty-control">
                      <button class="qty-btn" data-cart-action="dec" data-key="${item.key}">-</button>
                      <span class="qty-val">${item.quantity}</span>
                      <button class="qty-btn" data-cart-action="inc" data-key="${item.key}">+</button>
                    </div>
                  </div>

                  <!-- Total -->
                  <div class="cart-item-total">
                    ${formatPrice(item.price * item.quantity)}
                  </div>

                  <!-- Delete -->
                  <button class="btn-remove-item" data-cart-action="del" data-key="${item.key}" title="Remover produto">
                    ${Icons.trash(18)}
                  </button>
                </div>
              `).join('')}
            </div>

            <!-- Bottom Action Row -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
              <a href="#/" class="btn btn-secondary" style="gap: 8px;">
                ${Icons.arrowLeft(16)}
                <span>Continuar Comprando</span>
              </a>
              <button id="clearAllCartBtn" class="btn btn-secondary" style="color: var(--accent-rose); border-color: #fecaca;">
                Limpar Todo o Carrinho
              </button>
            </div>
          </div>

          <!-- Right: Summary & Checkout Card -->
          <div>
            <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 24px; position: sticky; top: 180px;">
              <h3 style="font-family: var(--font-display); font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border-light);">
                Resumo da Compra
              </h3>

              <!-- Shipping Estimator -->
              <div style="margin-bottom: 20px;">
                <label style="font-size: 0.8125rem; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 6px;">
                  Calcular Entrega por Província
                </label>
                <select id="provinceSelect" class="form-select" style="width: 100%;">
                  ${Object.keys(PROVINCE_RATES).map(prov => `
                    <option value="${prov}" ${prov === selectedProvince ? 'selected' : ''}>
                      ${prov} ${isFreeShipping ? '(Grátis)' : `(${formatPrice(PROVINCE_RATES[prov])})`}
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Coupon Box -->
              <div style="margin-bottom: 20px;">
                <label style="font-size: 0.8125rem; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 6px;">
                  Cupom de Desconto
                </label>
                ${coupon ? `
                  <div style="display: flex; align-items: center; justify-content: space-between; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.8125rem; color: #065f46;">
                    <span>Cupom <strong>${coupon.code}</strong> ativo</span>
                    <button id="removeCartCouponBtn" style="color: #065f46; font-weight: 800; cursor: pointer;">✕</button>
                  </div>
                ` : `
                  <div style="display: flex; gap: 8px;">
                    <input type="text" id="cartCouponCode" placeholder="Insira o seu código..." class="form-input" style="flex: 1;" />
                    <button id="applyCartCouponBtn" class="btn btn-secondary">Aplicar</button>
                  </div>
                  <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">
                    Insira o código do seu cupom para obter desconto imediato
                  </div>
                `}
              </div>

              <!-- Totals Breakdown -->
              <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; font-size: 0.9375rem;">
                <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
                  <span>Subtotal</span>
                  <strong>${formatPrice(subtotal)}</strong>
                </div>

                ${discountAmount > 0 ? `
                  <div style="display: flex; justify-content: space-between; color: var(--accent-emerald);">
                    <span>Desconto do Cupom</span>
                    <strong>-${formatPrice(discountAmount)}</strong>
                  </div>
                ` : ''}

                <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
                  <span>Estimativa de Entrega (${selectedProvince})</span>
                  <strong>${isFreeShipping ? '<span style="color: var(--accent-emerald);">GRÁTIS</span>' : formatPrice(shippingPrice)}</strong>
                </div>

                <div style="display: flex; justify-content: space-between; padding-top: 14px; border-top: 2px solid #f1f5f9; font-size: 1.25rem; font-weight: 900; color: var(--text-main);">
                  <span>Total a Pagar</span>
                  <span style="color: var(--primary-700); font-family: var(--font-display);">${formatPrice(total)}</span>
                </div>
              </div>

              <button id="cartProceedToCheckoutBtn" class="btn btn-accent btn-full" style="padding: 14px 20px; font-size: 1rem;">
                Avançar para o Pagamento
              </button>

              <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 16px; font-size: 0.75rem; color: var(--text-muted);">
                ${Icons.shieldCheck(16, '#10b981')}
                <span>Compra protegida com segurança de 256 bits</span>
              </div>
            </div>
          </div>
        </div>
      `}
    `;

    attachCartEvents();
  }

  function attachCartEvents() {
    // Quantity actions
    container.querySelectorAll('[data-cart-action="inc"]').forEach(btn => {
      btn.onclick = () => {
        Storage.updateCartQty(btn.dataset.key, 1);
        render();
      };
    });

    container.querySelectorAll('[data-cart-action="dec"]').forEach(btn => {
      btn.onclick = () => {
        Storage.updateCartQty(btn.dataset.key, -1);
        render();
      };
    });

    container.querySelectorAll('[data-cart-action="del"]').forEach(btn => {
      btn.onclick = () => {
        Storage.removeFromCart(btn.dataset.key);
        render();
        Toast.show({ title: 'Produto removido do carrinho', type: 'info' });
      };
    });

    // Clear cart
    const clearBtn = container.querySelector('#clearAllCartBtn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (confirm('Tem certeza que deseja esvaziar o carrinho?')) {
          Storage.clearCart();
          render();
        }
      };
    }

    // Province selector
    const provSelect = container.querySelector('#provinceSelect');
    if (provSelect) {
      provSelect.onchange = () => {
        selectedProvince = provSelect.value;
        render();
      };
    }

    // Coupon actions
    const applyBtn = container.querySelector('#applyCartCouponBtn');
    if (applyBtn) {
      applyBtn.onclick = async () => {
        const input = container.querySelector('#cartCouponCode');
        const code = input?.value.trim();
        if (!code) {
          Toast.show({ title: 'Atenção', message: 'Digite o código do cupom.', type: 'warning' });
          return;
        }

        applyBtn.disabled = true;
        applyBtn.innerHTML = 'Validando...';

        try {
          const validated = await Api.coupons.validate(code, subtotal);
          Storage.saveAppliedCoupon({
            code: validated.code,
            type: validated.discount_type || validated.type || 'percent',
            value: Number(validated.discount_value || validated.value || 0),
            description: validated.description || `Cupom ${validated.code} ativado com sucesso!`
          });
          Toast.show({ title: 'Cupom aplicado! 🎉', message: `Desconto ativado no seu pedido.`, type: 'success' });
          render();
        } catch (err) {
          Toast.show({ title: 'Cupom inválido', message: err.message || 'Verifique o código e tente novamente.', type: 'warning' });
          applyBtn.disabled = false;
          applyBtn.innerHTML = 'Aplicar';
        }
      };
    }

    const removeBtn = container.querySelector('#removeCartCouponBtn');
    if (removeBtn) {
      removeBtn.onclick = () => {
        Storage.removeCoupon();
        render();
      };
    }

    // Proceed to Checkout validation
    const checkoutBtn = container.querySelector('#cartProceedToCheckoutBtn');
    if (checkoutBtn) {
      checkoutBtn.onclick = () => {
        const user = Storage.getUser();
        if (!user) {
          Toast.show({
            title: 'Identificação Necessária',
            message: 'Inicie sessão ou crie uma conta para avançar ao pagamento.',
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
        window.location.hash = '/checkout';
      };
    }
  }

  render();
  return container;
}
