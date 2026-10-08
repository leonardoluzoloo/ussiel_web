// ===================================================================
// CART VIEW (Tela de Carrinho Completo - Design Limpo & Profissional)
// ===================================================================

import { Icons } from '../utils/icons.js';
import { formatPrice } from '../utils/format.js';
import { Storage, FREE_SHIPPING_THRESHOLD } from '../services/storage.js';
import { Api } from '../services/api.js';
import { Toast } from '../components/Toast.js';
import { ANGOLA_PROVINCES } from '../utils/provinces.js';

export function renderCartView() {
  const container = document.createElement('div');
  container.className = 'container';

  const PROVINCE_RATES = {
    'Luanda': 3500
  };

  let selectedProvince = 'Luanda';

  function render() {
    const cart = Storage.getCart();
    const subtotal = Storage.getCartSubtotal();
    const totalItems = cart.reduce((acc, item) => acc + (Number(item.quantity) || 1), 0);
    const coupon = Storage.getAppliedCoupon();
    const wishlistCount = Storage.getWishlist().length;

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
      <!-- Cabeçalho Limpo e Integrado -->
      <div style="display: flex; align-items: baseline; justify-content: space-between; margin-top: 36px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border-light);">
        <div style="display: flex; align-items: baseline; gap: 10px;">
          <h1 style="font-family: var(--font-display); font-size: 1.875rem; font-weight: 800; color: var(--text-main); margin: 0; letter-spacing: -0.02em;">
            Carrinho de Compras
          </h1>
          ${cart.length > 0 ? `
            <span style="font-size: 0.95rem; color: var(--text-muted); font-weight: 600;">
              (${totalItems} ${totalItems === 1 ? 'item' : 'itens'})
            </span>
          ` : ''}
        </div>
        <a href="#/catalogo" style="font-size: 0.875rem; color: var(--primary-600); text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
          ${Icons.arrowLeft(14)}
          <span>${cart.length > 0 ? 'Continuar comprando' : 'Voltar à loja'}</span>
        </a>
      </div>

      ${cart.length === 0 ? `
        <!-- Carrinho Vazio de Alto Padrão (Clean, Minimalista, 100% Responsivo no Mobile e Desktop) -->
        <div class="cart-empty-clean" style="text-align: center; padding: clamp(40px, 8vh, 80px) 16px; max-width: 440px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <!-- Ícone Sutil com Acabamento Refinado -->
          <div style="width: 72px; height: 72px; border-radius: 50%; background: #eff6ff; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; color: var(--primary-600); border: 1px solid rgba(37,99,235,0.12);">
            ${Icons.cart(32, 'var(--primary-600)')}
          </div>

          <h2 style="font-family: var(--font-display); font-size: clamp(1.3rem, 4vw, 1.55rem); font-weight: 800; color: var(--text-main); margin: 0 0 10px 0; letter-spacing: -0.02em;">
            O seu carrinho de compras está vazio
          </h2>

          <p style="color: var(--text-secondary); font-size: clamp(0.875rem, 2.5vw, 0.9375rem); margin: 0 0 24px 0; line-height: 1.5; max-width: 360px;">
            Ainda não adicionou nenhum artigo. Explore e acesse o catálogo.
          </p>

          <a href="#/catalogo" class="btn btn-primary" style="padding: 13px 32px; font-weight: 700; border-radius: 8px; font-size: 0.9375rem; display: inline-flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(37,99,235,0.22); min-height: 46px; width: 100%; max-width: 240px;">
            <span>Acessar Catálogo</span>
            ${Icons.chevronRight(16)}
          </a>
        </div>
      ` : `
        <!-- Layout do Carrinho Completo -->
        <div class="checkout-grid" style="margin-top: 20px; margin-bottom: 64px;">
          <!-- Coluna Esquerda: Itens do Carrinho -->
          <div>
            <!-- Informativo de Entrega Profissional -->
            <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 18px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <div style="display: flex; align-items: center; gap: 12px; font-size: 0.825rem; color: var(--text-secondary);">
                <div style="width: 34px; height: 34px; border-radius: 8px; background: #eff6ff; display: flex; align-items: center; justify-content: center; color: var(--primary-600); flex-shrink: 0;">
                  ${Icons.truck(18)}
                </div>
                <div>
                  <div style="font-weight: 700; color: var(--text-main); font-size: 0.85rem;">
                    Entrega em Luanda em até 24–48h
                  </div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">
                    Despacho rápido e conferência de segurança na entrega
                  </div>
                </div>
              </div>
              <div style="flex-shrink: 0;">
                ${isFreeShipping ? `
                  <span style="display: inline-flex; align-items: center; gap: 4px; background: #ecfdf5; color: #065f46; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.75rem; border: 1px solid #a7f3d0;">
                    ✓ Entrega Grátis
                  </span>
                ` : `
                  <span style="font-size: 0.8125rem; font-weight: 700; color: var(--text-main); background: #f8fafc; border: 1px solid var(--border-light); padding: 4px 10px; border-radius: 6px;">
                    Taxa: ${formatPrice(shippingPrice)}
                  </span>
                `}
              </div>
            </div>

            <!-- Tabela / Lista de Itens -->
            <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); overflow: hidden; margin-bottom: 16px;">
              <!-- Cabeçalho (Desktop) -->
              <div class="cart-table-header" style="background: #fafbfc; border-bottom: 1px solid var(--border-light); padding: 14px 20px;">
                <span>Produto</span>
                <span>Preço</span>
                <span style="text-align: center;">Quantidade</span>
                <span style="text-align: right;">Subtotal</span>
                <span></span>
              </div>

              <!-- Itens -->
              ${cart.map(item => {
                const prodLink = item.uid || item.slug || item.id;
                return `
                  <div class="cart-item-row" style="padding: 18px 20px; border-bottom: 1px solid var(--border-light);">
                    <div class="cart-item-product-info">
                      <a href="#/produto/${encodeURIComponent(prodLink)}">
                        <img src="${item.image}" alt="${item.name}" class="cart-item-thumb" style="width: 68px; height: 68px; object-fit: contain; border-radius: 8px; background: #f8fafc; border: 1px solid #f1f5f9; padding: 4px;" />
                      </a>
                      <div class="cart-item-details">
                        <a href="#/produto/${encodeURIComponent(prodLink)}" style="color: var(--text-main); font-weight: 700; font-size: 0.9375rem; text-decoration: none; display: block; line-height: 1.35; margin-bottom: 4px;">
                          ${item.name}
                        </a>
                        ${item.variant?.color || item.variant?.storage ? `
                          <div style="display: inline-flex; align-items: center; gap: 4px; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; color: #475569; font-weight: 500;">
                            ${[item.variant.color, item.variant.storage].filter(Boolean).join(' • ')}
                          </div>
                        ` : ''}
                      </div>
                    </div>

                    <!-- Preço Unitário -->
                    <div class="cart-item-unit-price" style="font-weight: 600; color: var(--text-secondary); font-size: 0.875rem;">
                      ${formatPrice(item.price)}
                    </div>

                    <!-- Quantidade -->
                    <div class="cart-item-qty">
                      <div class="qty-control" style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: 6px; padding: 2px;">
                        <button class="qty-btn" data-cart-action="dec" data-key="${item.key}" style="border-radius: 4px;" title="Diminuir">-</button>
                        <span class="qty-val" style="min-width: 32px; font-weight: 700;">${item.quantity}</span>
                        <button class="qty-btn" data-cart-action="inc" data-key="${item.key}" style="border-radius: 4px;" title="Aumentar">+</button>
                      </div>
                    </div>

                    <!-- Subtotal do Item -->
                    <div class="cart-item-total" style="font-weight: 800; font-size: 0.95rem; color: var(--text-main); text-align: right;">
                      ${formatPrice(item.price * item.quantity)}
                    </div>

                    <!-- Remover -->
                    <button class="btn-remove-item" data-cart-action="del" data-key="${item.key}" title="Remover item" style="background: none; border: none; cursor: pointer; color: #94a3b8; display: flex; align-items: center; justify-content: center; padding: 6px; border-radius: 4px; transition: color 0.15s ease;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">
                      ${Icons.trash(16)}
                    </button>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Ações Inferiores -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 4px 24px 4px;">
              <a href="#/" class="btn btn-secondary" style="font-size: 0.875rem; padding: 9px 18px; border-radius: 6px;">
                ${Icons.arrowLeft(14)}
                <span>Continuar comprando</span>
              </a>
              <button id="clearAllCartBtn" style="background: none; border: none; font-size: 0.8125rem; color: #94a3b8; cursor: pointer; text-decoration: underline; padding: 6px 8px; transition: color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">
                Esvaziar carrinho
              </button>
            </div>
          </div>

          <!-- Coluna Direita: Resumo do Pedido -->
          <div>
            <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 24px; position: sticky; top: 140px;">
              <h3 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--border-light);">
                Resumo do pedido
              </h3>

              <!-- Destino de Entrega -->
              <div style="margin-bottom: 18px;">
                <label style="font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 6px;">
                  Destino da entrega
                </label>
                <select id="provinceSelect" class="form-select" style="width: 100%; height: 40px; font-size: 0.875rem; border-radius: 6px;">
                  ${ANGOLA_PROVINCES.map(prov => `
                    <option value="${prov.name}" ${prov.name === selectedProvince ? 'selected' : ''} ${!prov.active ? 'disabled style="color: #94a3b8; background: #f8fafc;"' : ''}>
                      ${prov.name === 'Luanda' ? `Luanda • ${isFreeShipping ? 'Grátis' : formatPrice(PROVINCE_RATES['Luanda'])}` : `${prov.name} (Indisponível)`}
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Cupom de Desconto -->
              <div style="margin-bottom: 20px;">
                <label style="font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 6px;">
                  Cupom de desconto
                </label>
                ${coupon ? `
                  <div style="display: flex; align-items: center; justify-content: space-between; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 8px 12px; border-radius: 6px; font-size: 0.8125rem; color: #166534;">
                    <span>Cupom <strong>${coupon.code}</strong> aplicado</span>
                    <button id="removeCartCouponBtn" style="background: none; border: none; color: #166534; font-weight: 800; cursor: pointer; font-size: 0.9rem;" title="Remover cupom">✕</button>
                  </div>
                ` : `
                  <div style="display: flex; gap: 8px;">
                    <input type="text" id="cartCouponCode" placeholder="Código do cupom" class="form-input" style="flex: 1; height: 38px; font-size: 0.8125rem; text-transform: uppercase;" />
                    <button id="applyCartCouponBtn" class="btn btn-secondary" style="height: 38px; padding: 0 14px; font-size: 0.8125rem; font-weight: 600;">
                      Aplicar
                    </button>
                  </div>
                `}
              </div>

              <!-- Linhas de Valores -->
              <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 22px; font-size: 0.875rem;">
                <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
                  <span>Subtotal</span>
                  <span style="font-weight: 600; color: var(--text-main);">${formatPrice(subtotal)}</span>
                </div>

                ${discountAmount > 0 ? `
                  <div style="display: flex; justify-content: space-between; color: #10b981;">
                    <span>Desconto</span>
                    <span style="font-weight: 700;">-${formatPrice(discountAmount)}</span>
                  </div>
                ` : ''}

                <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
                  <span>Entrega</span>
                  <span>${isFreeShipping ? '<strong style="color: #10b981;">Grátis</strong>' : `<strong style="color: var(--text-main);">${formatPrice(shippingPrice)}</strong>`}</span>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: baseline; padding-top: 14px; border-top: 1px solid var(--border-light); font-size: 1.15rem; font-weight: 900; color: var(--text-main);">
                  <span>Total</span>
                  <span style="font-family: var(--font-display); font-size: 1.35rem; color: var(--primary-700);">${formatPrice(total)}</span>
                </div>
              </div>

              <!-- Botão Principal de Checkout -->
              <button id="cartProceedToCheckoutBtn" class="btn btn-accent btn-full" style="padding: 13px 20px; font-size: 0.95rem; font-weight: 700; border-radius: 8px; justify-content: center;">
                Finalizar compra
              </button>

              <div style="text-align: center; margin-top: 14px; font-size: 0.75rem; color: var(--text-muted);">
                Entrega para Luanda • Pagamento no checkout
              </div>
            </div>
          </div>
        </div>
      `}
    `;

    attachCartEvents();
  }

  function attachCartEvents() {
    // Ações de Quantidade
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

    // Remover Item
    container.querySelectorAll('[data-cart-action="del"]').forEach(btn => {
      btn.onclick = () => {
        Storage.removeFromCart(btn.dataset.key);
        render();
        Toast.show({ title: 'Item removido do carrinho', type: 'info' });
      };
    });

    // Limpar Todo o Carrinho
    const clearBtn = container.querySelector('#clearAllCartBtn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (confirm('Deseja realmente esvaziar todos os itens do carrinho?')) {
          Storage.clearCart();
          render();
        }
      };
    }

    // Seletor de Província
    const provSelect = container.querySelector('#provinceSelect');
    if (provSelect) {
      provSelect.onchange = () => {
        selectedProvince = provSelect.value;
        render();
      };
    }

    // Aplicar Cupom
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
        applyBtn.innerHTML = '...';

        try {
          const subtotal = Storage.getCartSubtotal();
          const validated = await Api.coupons.validate(code, subtotal);
          Storage.saveAppliedCoupon({
            code: validated.code,
            type: validated.discount_type || validated.type || 'percent',
            value: Number(validated.discount_value || validated.value || 0),
            description: validated.description || `Cupom ${validated.code} aplicado`
          });
          Toast.show({ title: 'Cupom aplicado com sucesso', type: 'success' });
          render();
        } catch (err) {
          Toast.show({ title: 'Cupom inválido', message: err.message || 'Verifique o código e tente novamente.', type: 'warning' });
          applyBtn.disabled = false;
          applyBtn.innerHTML = 'Aplicar';
        }
      };
    }

    // Remover Cupom
    const removeBtn = container.querySelector('#removeCartCouponBtn');
    if (removeBtn) {
      removeBtn.onclick = () => {
        Storage.removeCoupon();
        render();
      };
    }

    // Avançar para o Checkout
    const checkoutBtn = container.querySelector('#cartProceedToCheckoutBtn');
    if (checkoutBtn) {
      checkoutBtn.onclick = () => {
        const user = Storage.getUser();
        if (!user) {
          Toast.show({
            title: 'Identificação necessária',
            message: 'Inicie sessão ou crie uma conta para concluir a compra.',
            type: 'info'
          });
          window.location.hash = '/login';
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

  const handleCartUpdated = () => {
    if (document.body.contains(container)) {
      render();
    }
  };
  window.addEventListener('cart-updated', handleCartUpdated);

  render();
  return container;
}
