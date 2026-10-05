// ===================================================================
// CHECKOUT WIZARD (Guest/User, Address, Shipping, Angola Payments)
// ===================================================================

import { Icons } from '../utils/icons.js';
import { formatPrice } from '../utils/format.js';
import { Storage, FREE_SHIPPING_THRESHOLD } from '../services/storage.js';
import { Api } from '../services/api.js';
import { Toast } from '../components/Toast.js';
import { ANGOLA_PROVINCES } from '../utils/provinces.js';

export function renderCheckoutView() {
  const container = document.createElement('div');
  container.className = 'container';

  // State
  let currentStep = 1; // 1: Identification, 2: Address, 3: Shipping, 4: Payment, 5: Success
  let orderResult = null;

  const user = Storage.getUser();

  // Form state
  const formData = {
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    whatsapp: user?.whatsapp || user?.phone || '',
    province: 'Luanda',
    city: user?.city || '',
    neighborhood: user?.neighborhood || '',
    street: user?.street || user?.endereco || '',
    number: user?.number || '',
    reference: user?.reference || user?.ponto_referencia || '',
    shippingMethod: 'normal', // 'normal' | 'express'
    paymentMethod: 'multicaixa_express', // 'multicaixa_express' | 'transfer' | 'reference' | 'cod'
    multicaixaPhone: user?.phone || ''
  };

  // Store settings state (carregado dinamicamente do banco de dados Supabase)
  let storeSettings = {
    store_name: 'NovaTech Angola',
    phone: '+244 923 179 192',
    whatsapp: '+244 923 179 192',
    email: 'contacto@novatech.co.ao',
    free_shipping_threshold: 1000000,
    shipping_price_normal: 3500,
    shipping_price_express: 6500,
    bank_holder: 'NovaTech Comércio & Serviços, Lda',
    bank_name: 'Banco Angolano de Investimentos (BAI)',
    bank_iban: 'AO06 0040 0000 1234 5678 9012 3',
    mcx_phone: '+244 923 179 192'
  };

  // Carrega configurações reais da loja do banco
  Api.settings.get('general').then(cfg => {
    if (cfg && typeof cfg === 'object') {
      storeSettings = { ...storeSettings, ...cfg };
      render();
    }
  }).catch(() => {});

  function getShippingRates() {
    return {
      normal: Number(storeSettings.shipping_price_normal !== undefined ? storeSettings.shipping_price_normal : 3500),
      express: Number(storeSettings.shipping_price_express !== undefined ? storeSettings.shipping_price_express : 6500)
    };
  }

  function getFreeShippingThreshold() {
    return Number(storeSettings.free_shipping_threshold !== undefined ? storeSettings.free_shipping_threshold : FREE_SHIPPING_THRESHOLD);
  }

  function render() {
    const activeUser = Storage.getUser();
    if (!activeUser) {
      container.innerHTML = `
        <div style="max-width: 560px; margin: 64px auto; background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 48px 32px; text-align: center; box-shadow: var(--shadow-sm);">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--primary-50); color: var(--primary-600); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto;">
            ${Icons.user(32)}
          </div>
          <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">
            Identificação Obrigatória
          </h2>
          <p style="color: var(--text-secondary); font-size: 0.9375rem; margin-bottom: 28px; line-height: 1.6;">
            Para garantir a segurança do seu pedido, envio da fatura e acompanhamento da entrega em tempo real, inicie sessão ou crie uma conta gratuita.
          </p>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <button class="btn btn-primary btn-full" id="checkoutLoginPromptBtn">
              Iniciar Sessão
            </button>
            <button class="btn btn-secondary btn-full" id="checkoutRegisterPromptBtn">
              Criar Nova Conta Grátis
            </button>
          </div>
          <a href="#/carrinho" style="display: inline-block; margin-top: 20px; font-size: 0.8125rem; color: var(--text-muted); text-decoration: underline;">
            ← Voltar para o Carrinho
          </a>
        </div>
      `;

      const loginBtn = container.querySelector('#checkoutLoginPromptBtn');
      if (loginBtn) {
        loginBtn.onclick = () => { window.location.hash = '/login'; };
      }
      const regBtn = container.querySelector('#checkoutRegisterPromptBtn');
      if (regBtn) {
        regBtn.onclick = () => { window.location.hash = '/cadastro'; };
      }
      return;
    }

    // Populate user info if logged in
    formData.name = formData.name || activeUser.name || '';
    formData.email = formData.email || activeUser.email || '';
    formData.phone = formData.phone || activeUser.phone || '';
    formData.whatsapp = formData.whatsapp || activeUser.whatsapp || activeUser.phone || '';
    formData.multicaixaPhone = formData.multicaixaPhone || activeUser.phone || '';
    if (!formData.street && (activeUser.endereco || activeUser.street)) {
      formData.street = activeUser.endereco || activeUser.street || '';
    }
    if (!formData.reference && (activeUser.ponto_referencia || activeUser.reference)) {
      formData.reference = activeUser.ponto_referencia || activeUser.reference || '';
    }

    const cart = Storage.getCart();
    const subtotal = Storage.getCartSubtotal();
    const coupon = Storage.getAppliedCoupon();

    if (cart.length === 0 && currentStep !== 5) {
      container.innerHTML = `
        <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 72px 24px; text-align: center; margin: 48px 0;">
          <h2 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 8px;">Nenhum produto no carrinho</h2>
          <p style="color: var(--text-secondary); margin-bottom: 24px;">Adicione produtos antes de iniciar o checkout.</p>
          <a href="#/" class="btn btn-primary">Voltar ao Início</a>
        </div>
      `;
      return;
    }

    let discountAmount = 0;
    if (coupon) {
      if (coupon.type === 'percent') {
        discountAmount = Math.round(subtotal * (coupon.value / 100));
      } else if (coupon.type === 'fixed') {
        discountAmount = Math.min(coupon.value, subtotal);
      }
    }

    if (formData.shippingMethod !== 'express') {
      formData.shippingMethod = 'normal';
    }

    const currentShippingRates = getShippingRates();
    const freeLimit = getFreeShippingThreshold();
    const isFreeShipping = subtotal >= freeLimit || coupon?.type === 'free_shipping';
    const shippingCost = isFreeShipping && formData.shippingMethod === 'normal'
      ? 0
      : (currentShippingRates[formData.shippingMethod] || currentShippingRates.normal);

    const total = Math.max(0, subtotal - discountAmount + shippingCost);

    if (currentStep === 5 && orderResult) {
      renderSuccessScreen(orderResult);
      return;
    }

    container.innerHTML = `
      <div style="margin-top: 32px; margin-bottom: 24px;">
        <h1 style="font-family: var(--font-display); font-size: 2rem; font-weight: 900; color: var(--text-main);">
          Finalização de Compra Segura
        </h1>
        <div style="display: flex; gap: 8px; margin-top: 8px; font-size: 0.8125rem; color: var(--text-muted);">
          <span>Etapa ${currentStep} de 4</span>
          <span>•</span>
          <span>Ambiente Criptografado SSL</span>
        </div>
      </div>

      <div class="checkout-grid">
        <!-- Steps Column (Left) -->
        <div>
          <!-- Step 1: Identification -->
          <div class="checkout-step-card" style="${currentStep !== 1 ? 'opacity: 0.9;' : ''}">
            <div class="checkout-step-header">
              <div class="step-number" style="${currentStep > 1 ? 'background: var(--accent-emerald);' : ''}">
                ${currentStep > 1 ? Icons.check(18, '#ffffff') : '1'}
              </div>
              <div>
                <h3 class="step-title">1. Dados do Cliente / Identificação</h3>
                <span style="font-size: 0.75rem; color: var(--accent-emerald); font-weight: 600;">✓ Sessão iniciada com conta oficial NovaTech</span>
              </div>
            </div>

            ${currentStep === 1 ? `
              <form id="step1Form" onsubmit="event.preventDefault();" class="form-grid">
                <div class="form-group form-group-full">
                  <label class="form-label">Nome Completo *</label>
                  <input type="text" id="custName" class="form-input" required value="${formData.name}" placeholder="Seu Nome Completo" />
                </div>

                <div class="form-group form-group-half">
                  <label class="form-label">E-mail para Confirmação *</label>
                  <input type="email" id="custEmail" class="form-input" required value="${formData.email}" placeholder="seu.email@exemplo.com" />
                </div>

                <div class="form-group form-group-half">
                  <label class="form-label">Telefone / Telemóvel *</label>
                  <input type="tel" id="custPhone" class="form-input" required value="${formData.phone}" placeholder="+244 923 179 192" />
                </div>

                <div class="form-group form-group-full">
                  <label class="form-label">WhatsApp (para envio do comprovativo e rastreio)</label>
                  <input type="tel" id="custWhatsApp" class="form-input" value="${formData.whatsapp}" placeholder="+244 923 179 192" />
                </div>

                <div class="checkout-actions-row" style="justify-content: flex-end;">
                  <button type="submit" class="btn btn-primary" style="padding: 12px 28px;">
                    Continuar para o Endereço →
                  </button>
                </div>
              </form>
            ` : `
              <div style="font-size: 0.875rem; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center;">
                <span><strong>${formData.name}</strong> • ${formData.email} • ${formData.phone}</span>
                <button class="step-edit-btn" data-goto-step="1" style="color: var(--primary-600); font-weight: 700; cursor: pointer;">Editar</button>
              </div>
            `}
          </div>

          <!-- Step 2: Delivery Address -->
          <div class="checkout-step-card" style="${currentStep < 2 ? 'opacity: 0.6; pointer-events: none;' : ''}">
            <div class="checkout-step-header">
              <div class="step-number" style="${currentStep > 2 ? 'background: var(--accent-emerald);' : ''}">
                ${currentStep > 2 ? Icons.check(18, '#ffffff') : '2'}
              </div>
              <div>
                <h3 class="step-title">2. Endereço de Entrega em Angola</h3>
                <span style="font-size: 0.75rem; color: var(--text-muted);">Onde deseja receber a sua encomenda?</span>
              </div>
            </div>

            ${currentStep === 2 ? `
              <form id="step2Form" onsubmit="event.preventDefault();" class="form-grid">
                <div class="form-group form-group-half">
                  <label class="form-label">Província *</label>
                  <select id="addrProvince" class="form-select">
                    ${ANGOLA_PROVINCES.map(p => `
                      <option value="${p.name}" ${p.name === (formData.province || 'Luanda') ? 'selected' : ''} ${!p.active ? 'disabled style="color: #94a3b8; background: #f8fafc;"' : 'style="font-weight: 600;"'}>
                        ${p.name}${!p.active ? ' (Indisponível)' : ' (Disponível)'}
                      </option>
                    `).join('')}
                  </select>
                  <span style="font-size: 0.72rem; color: #64748b; margin-top: 4px; display: block;">* Entregas ativas exclusivamente em Luanda por enquanto.</span>
                </div>

                <div class="form-group form-group-half">
                  <label class="form-label">Município *</label>
                  <input type="text" id="addrCity" class="form-input" required value="${formData.city}" placeholder="Ex: Talatona, Belas, Maianga..." />
                </div>

                <div class="form-group form-group-half">
                  <label class="form-label">Bairro *</label>
                  <input type="text" id="addrNeighborhood" class="form-input" required value="${formData.neighborhood}" placeholder="Ex: Morro Bento, Alvalade..." />
                </div>

                <div class="form-group form-group-half">
                  <label class="form-label">Endereço / Rua / Avenida *</label>
                  <input type="text" id="addrStreet" class="form-input" required value="${formData.street}" placeholder="Ex: Rua Direita de Luanda Sul" />
                </div>

                <div class="form-group form-group-half">
                  <label class="form-label">Número / Prédio / Apto</label>
                  <input type="text" id="addrNumber" class="form-input" value="${formData.number}" placeholder="Ex: Casa nº 14 / Apt 3" />
                </div>

                <div class="form-group form-group-full">
                  <label class="form-label">Ponto de Referência (Recomendado para facilitar a entrega)</label>
                  <input type="text" id="addrReference" class="form-input" value="${formData.reference}" placeholder="Ex: Próximo à bomba Sonangol, em frente à farmácia..." />
                </div>

                <div class="checkout-actions-row">
                  <button type="button" class="btn btn-secondary" data-goto-step="1">← Voltar</button>
                  <button type="submit" class="btn btn-primary" style="padding: 12px 28px;">Continuar para Entrega →</button>
                </div>
              </form>
            ` : currentStep > 2 ? `
              <div style="font-size: 0.875rem; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center;">
                <span>${formData.street}, nº ${formData.number} • ${formData.neighborhood}, ${formData.city} - ${formData.province}</span>
                <button class="step-edit-btn" data-goto-step="2" style="color: var(--primary-600); font-weight: 700; cursor: pointer;">Editar</button>
              </div>
            ` : ''}
          </div>

          <!-- Step 3: Shipping Options -->
          <div class="checkout-step-card" style="${currentStep < 3 ? 'opacity: 0.6; pointer-events: none;' : ''}">
            <div class="checkout-step-header">
              <div class="step-number" style="${currentStep > 3 ? 'background: var(--accent-emerald);' : ''}">
                ${currentStep > 3 ? Icons.check(18, '#ffffff') : '3'}
              </div>
              <div>
                <h3 class="step-title">3. Modalidade de Envio</h3>
                <span style="font-size: 0.75rem; color: var(--text-muted);">Selecione a velocidade desejada</span>
              </div>
            </div>

            ${currentStep === 3 ? `
              <div class="radio-cards-group">
                <div class="radio-card ${formData.shippingMethod === 'normal' ? 'active' : ''}" data-ship-opt="normal">
                  <div class="radio-card-left">
                    <input type="radio" name="shipOpt" value="normal" ${formData.shippingMethod === 'normal' ? 'checked' : ''} />
                    <div class="radio-card-text">
                      <span class="radio-card-title">Entrega Normal Luanda</span>
                      <span class="radio-card-desc">Prazo padrão: 24 a 48 horas úteis</span>
                    </div>
                  </div>
                  <span class="radio-card-price">${isFreeShipping ? 'GRÁTIS' : formatPrice(currentShippingRates.normal)}</span>
                </div>

                <div class="radio-card ${formData.shippingMethod === 'express' ? 'active' : ''}" data-ship-opt="express">
                  <div class="radio-card-left">
                    <input type="radio" name="shipOpt" value="express" ${formData.shippingMethod === 'express' ? 'checked' : ''} />
                    <div class="radio-card-text">
                      <span class="radio-card-title">Entrega Expressa Mesmo Dia (Luanda)</span>
                      <span class="radio-card-desc">Prazo expresso: Entrega rápida em até 6 horas</span>
                    </div>
                  </div>
                  <span class="radio-card-price">${formatPrice(currentShippingRates.express)}</span>
                </div>
              </div>

              <div class="checkout-actions-row">
                <button type="button" class="btn btn-secondary" data-goto-step="2">← Voltar</button>
                <button type="button" class="btn btn-primary" id="step3NextBtn" style="padding: 12px 28px;">Continuar para Pagamento →</button>
              </div>
            ` : currentStep > 3 ? `
              <div style="font-size: 0.875rem; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center;">
                <span>${formData.shippingMethod === 'express' ? 'Entrega Expressa Mesmo Dia (Luanda)' : 'Entrega Normal Luanda (24-48h)'} • ${isFreeShipping && formData.shippingMethod === 'normal' ? 'Grátis' : formatPrice(shippingCost)}</span>
                <button class="step-edit-btn" data-goto-step="3" style="color: var(--primary-600); font-weight: 700; cursor: pointer;">Editar</button>
              </div>
            ` : ''}
          </div>

          <!-- Step 4: Payment Methods (Angola Focused & Real Store Data) -->
          <div class="checkout-step-card" style="${currentStep < 4 ? 'opacity: 0.6; pointer-events: none;' : ''}">
            <div class="checkout-step-header">
              <div class="step-number">4</div>
              <div>
                <h3 class="step-title">4. Método de Pagamento</h3>
                <span style="font-size: 0.75rem; color: var(--text-muted);">Pagamento 100% seguro em Kwanzas (Kz)</span>
              </div>
            </div>

            ${currentStep === 4 ? `
              <div class="radio-cards-group">
                <!-- Multicaixa Express -->
                <div class="radio-card ${formData.paymentMethod === 'multicaixa_express' ? 'active' : ''}" data-pay-opt="multicaixa_express">
                  <div class="radio-card-left">
                    <input type="radio" name="payOpt" value="multicaixa_express" ${formData.paymentMethod === 'multicaixa_express' ? 'checked' : ''} />
                    <div class="radio-card-text">
                      <span class="radio-card-title">Multicaixa Express (MCX)</span>
                      <span class="radio-card-desc">Receba o pedido de autorização diretamente no aplicativo</span>
                    </div>
                  </div>
                  <span class="badge" style="background: #2563eb; color: #fff;">RECOMENDADO</span>
                </div>

                ${formData.paymentMethod === 'multicaixa_express' ? `
                  <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--radius-sm); padding: 16px; margin: -4px 0 8px 0;">
                    <label class="form-label" style="color: #1e40af; font-weight: 700; font-size: 0.8125rem;">Número do seu Telemóvel Multicaixa Express:</label>
                    <input type="tel" id="mcExpressPhone" class="form-input" value="${formData.multicaixaPhone}" placeholder="+244 923 000 000" style="margin-top: 6px; height: 42px; border-radius: 8px;" />
                    <div style="font-size: 0.75rem; color: #1e40af; margin-top: 6px; line-height: 1.4;">
                      A autorização será enviada ao seu app associado ao terminal da loja (<strong>${storeSettings.mcx_phone || storeSettings.phone || '+244 923 179 192'}</strong>). Você terá 5 minutos para validar no MCX.
                    </div>
                  </div>
                ` : ''}

                <!-- Bank Transfer -->
                <div class="radio-card ${formData.paymentMethod === 'transfer' ? 'active' : ''}" data-pay-opt="transfer">
                  <div class="radio-card-left">
                    <input type="radio" name="payOpt" value="transfer" ${formData.paymentMethod === 'transfer' ? 'checked' : ''} />
                    <div class="radio-card-text">
                      <span class="radio-card-title">Transferência Bancária Oficial (IBAN)</span>
                      <span class="radio-card-desc">Transferência para conta oficial ${storeSettings.store_name || 'NovaTech Angola'} (${storeSettings.bank_name || 'BAI'})</span>
                    </div>
                  </div>
                </div>

                ${formData.paymentMethod === 'transfer' ? `
                  <div style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 16px; margin: -4px 0 8px 0; font-size: 0.8125rem;">
                    <div style="margin-bottom: 8px;"><strong>Titular da Conta:</strong> <span>${storeSettings.bank_holder || 'NovaTech Comércio & Serviços, Lda'}</span></div>
                    <div style="margin-bottom: 8px;"><strong>Banco Principal:</strong> <span>${storeSettings.bank_name || 'Banco Angolano de Investimentos (BAI)'}</span></div>
                    <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; background: #ffffff; border: 1px dashed #cbd5e1; padding: 10px 14px; border-radius: 8px;">
                      <div>
                        <span style="font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block;">IBAN Oficial de Pagamento:</span>
                        <strong id="displayIbanCode" style="font-family: ui-monospace, monospace; font-size: 0.9375rem; color: #0f172a; word-break: break-all;">${storeSettings.bank_iban || 'AO06 0040 0000 1234 5678 9012 3'}</strong>
                      </div>
                      <button type="button" id="copyIbanBtn" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 6px 12px; display: inline-flex; align-items: center; gap: 4px;">
                        Copiar IBAN
                      </button>
                    </div>
                    <div style="color: var(--text-secondary); font-size: 0.75rem; line-height: 1.4;">
                      Após efetuar a transferência bancária, envie o comprovativo oficial para o WhatsApp <strong>${storeSettings.whatsapp || storeSettings.phone || '+244 923 179 192'}</strong> para liberação imediata do seu pedido.
                    </div>
                  </div>
                ` : ''}

                <!-- Multicaixa Reference -->
                <div class="radio-card ${formData.paymentMethod === 'reference' ? 'active' : ''}" data-pay-opt="reference">
                  <div class="radio-card-left">
                    <input type="radio" name="payOpt" value="reference" ${formData.paymentMethod === 'reference' ? 'checked' : ''} />
                    <div class="radio-card-text">
                      <span class="radio-card-title">Pagamento por Referência Multicaixa</span>
                      <span class="radio-card-desc">Pague em qualquer Caixa Automático ou Homebanking</span>
                    </div>
                  </div>
                </div>

                <!-- Pay on Delivery -->
                <div class="radio-card ${formData.paymentMethod === 'cod' ? 'active' : ''}" data-pay-opt="cod">
                  <div class="radio-card-left">
                    <input type="radio" name="payOpt" value="cod" ${formData.paymentMethod === 'cod' ? 'checked' : ''} />
                    <div class="radio-card-text">
                      <span class="radio-card-title">Pagamento na Entrega (TPA / Cartão)</span>
                      <span class="radio-card-desc">Pague ao estafeta no momento em que receber o seu produto</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="checkout-actions-row">
                <button type="button" class="btn btn-secondary" data-goto-step="3">← Voltar</button>
                <button type="button" class="btn btn-accent" id="finishOrderBtn" style="padding: 14px 28px; font-size: 1rem;">
                  FINALIZAR PEDIDO (${formatPrice(total)})
                </button>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Right: Order Summary Sticky -->
        <div>
          <div class="checkout-summary-box">
            <h3 style="font-family: var(--font-display); font-size: 1.125rem; font-weight: 800; color: var(--text-main); margin-bottom: 16px;">
              Produtos no Pedido (${cart.length})
            </h3>

            <div class="checkout-items-list" style="display: flex; flex-direction: column; gap: 12px; max-height: 260px; overflow-y: auto; margin-bottom: 20px;">
              ${cart.map(i => `
                <div class="checkout-item-row">
                  <img src="${i.image}" alt="${i.name}" class="checkout-item-img" />
                  <div class="checkout-item-info">
                    <div class="checkout-item-title">${i.name}</div>
                    <div class="checkout-item-meta">${i.quantity}x • ${formatPrice(i.price)}</div>
                  </div>
                  <div class="checkout-item-price">${formatPrice(i.price * i.quantity)}</div>
                </div>
              `).join('')}
            </div>

            <div class="checkout-totals-group">
              <div class="checkout-summary-row">
                <span>Subtotal</span>
                <strong>${formatPrice(subtotal)}</strong>
              </div>
              ${discountAmount > 0 ? `
                <div class="checkout-summary-row" style="color: var(--accent-emerald);">
                  <span>Desconto</span>
                  <strong>-${formatPrice(discountAmount)}</strong>
                </div>
              ` : ''}
              <div class="checkout-summary-row">
                <span>Taxa de Entrega</span>
                <strong>${isFreeShipping && formData.shippingMethod === 'normal' ? '<span style="color: var(--accent-emerald);">GRÁTIS</span>' : formatPrice(shippingCost)}</strong>
              </div>
              <div class="checkout-summary-row checkout-total-row">
                <span>Total a Pagar</span>
                <span>${formatPrice(total)}</span>
              </div>
            </div>

            <div style="background: #f8fafc; border-radius: var(--radius-sm); padding: 12px; font-size: 0.75rem; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
              ${Icons.shieldCheck(20, '#10b981')}
              <span>Garantia de Entrega e Devolução em Luanda.</span>
            </div>
          </div>
        </div>
      </div>
    `;

    attachWizardEvents();
  }

  function attachWizardEvents() {
    // Step 1 Submit
    const step1Form = container.querySelector('#step1Form');
    if (step1Form) {
      step1Form.onsubmit = () => {
        formData.name = container.querySelector('#custName').value.trim();
        formData.email = container.querySelector('#custEmail').value.trim();
        formData.phone = container.querySelector('#custPhone').value.trim();
        formData.whatsapp = container.querySelector('#custWhatsApp').value.trim() || formData.phone;
        currentStep = 2;
        render();
      };
    }

    // Step 2 Submit
    const step2Form = container.querySelector('#step2Form');
    if (step2Form) {
      step2Form.onsubmit = () => {
        formData.province = container.querySelector('#addrProvince').value;
        formData.city = container.querySelector('#addrCity').value.trim();
        formData.neighborhood = container.querySelector('#addrNeighborhood').value.trim();
        formData.street = container.querySelector('#addrStreet').value.trim();
        formData.number = container.querySelector('#addrNumber').value.trim();
        formData.reference = container.querySelector('#addrReference').value.trim();
        currentStep = 3;
        render();
      };
    }

    // Step 3 Navigation & Selection
    container.querySelectorAll('[data-ship-opt]').forEach(card => {
      card.onclick = () => {
        formData.shippingMethod = card.dataset.shipOpt;
        render();
      };
    });

    const step3Next = container.querySelector('#step3NextBtn');
    if (step3Next) {
      step3Next.onclick = () => {
        currentStep = 4;
        render();
      };
    }

    // Step 4 Navigation & Selection
    container.querySelectorAll('[data-pay-opt]').forEach(card => {
      card.onclick = () => {
        formData.paymentMethod = card.dataset.payOpt;
        render();
      };
    });

    // Botão de Copiar IBAN
    const copyIbanBtn = container.querySelector('#copyIbanBtn');
    if (copyIbanBtn) {
      copyIbanBtn.onclick = () => {
        const iban = storeSettings.bank_iban || 'AO06 0040 0000 1234 5678 9012 3';
        navigator.clipboard.writeText(iban.replace(/\s+/g, '')).then(() => {
          copyIbanBtn.textContent = 'Copiado! ✓';
          setTimeout(() => { copyIbanBtn.textContent = 'Copiar IBAN'; }, 2000);
          Toast.show('IBAN copiado com sucesso!', 'success');
        }).catch(() => {
          Toast.show('IBAN: ' + iban, 'info');
        });
      };
    }

    const mcPhoneInput = container.querySelector('#mcExpressPhone');
    if (mcPhoneInput) {
      mcPhoneInput.oninput = (e) => {
        formData.multicaixaPhone = e.target.value.trim();
      };
    }

    // Step navigation buttons
    container.querySelectorAll('[data-goto-step]').forEach(btn => {
      btn.onclick = () => {
        currentStep = Number(btn.dataset.gotoStep);
        render();
      };
    });

    // Finish Order Action
    const finishBtn = container.querySelector('#finishOrderBtn');
    if (finishBtn) {
      finishBtn.onclick = async () => {
        // Build order object
        const cart = Storage.getCart();
        const subtotal = Storage.getCartSubtotal();
        const coupon = Storage.getAppliedCoupon();
        let discount = 0;
        if (coupon) {
          if (coupon.type === 'percent') discount = Math.round(subtotal * (coupon.value / 100));
          else if (coupon.type === 'fixed') discount = Math.min(coupon.value, subtotal);
        }
        const currentRates = getShippingRates();
        const freeLimit = getFreeShippingThreshold();
        const shipping = subtotal >= freeLimit && formData.shippingMethod === 'normal'
          ? 0
          : (currentRates[formData.shippingMethod] || currentRates.normal);

        const finalTotal = Math.max(0, subtotal - discount + shipping);
        const methodName = formData.paymentMethod === 'multicaixa_express' ? 'Multicaixa Express' :
          formData.paymentMethod === 'transfer' ? 'Transferência Bancária' :
            formData.paymentMethod === 'reference' ? 'Referência Multicaixa' : 'Pagamento na Entrega';

        const originalBtnText = finishBtn.innerHTML;
        finishBtn.disabled = true;
        finishBtn.innerHTML = 'Gravando pedido seguro...';

        const loggedUser = Storage.getUser();
        const orderPayload = {
          user_id: loggedUser?.id || null,
          customer_name: formData.name,
          customer_email: formData.email,
          customer_phone: formData.phone,
          customer_whatsapp: formData.whatsapp || formData.phone,
          shipping_address: `${formData.street || ''}${formData.number ? ', nº ' + formData.number : ''}${formData.neighborhood ? ' - ' + formData.neighborhood : ''}, ${formData.city || ''} (${formData.province || 'Luanda'})`.trim(),
          ponto_referencia: formData.reference || '',
          shipping_method: formData.shippingMethod,
          shipping_price: shipping,
          payment_method: methodName,
          payment_details: {
            method_type: formData.paymentMethod,
            phone: formData.multicaixaPhone || formData.phone,
            bank_holder: storeSettings.bank_holder,
            bank_name: storeSettings.bank_name,
            bank_iban: storeSettings.bank_iban,
            mcx_receiver: storeSettings.mcx_phone || storeSettings.phone
          },
          subtotal,
          discount,
          total: finalTotal,
          items: cart.map(i => ({
            product_id: typeof i.id === 'number' ? i.id : null,
            product_sku: i.sku || '',
            product_name: i.name,
            product_image: i.image || '',
            selected_variant: i.variant || {},
            unit_price: i.price,
            quantity: i.quantity
          }))
        };

        try {
          // Validação estrita de cupom de primeira compra por e-mail
          if (appliedCoupon && appliedCoupon.code) {
            await Api.coupons.validate(appliedCoupon.code, subtotal, formData.email);
          }

          const apiOrder = await Api.orders.create(orderPayload);
          const orderCode = apiOrder.order_code || `NV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

          const newOrder = {
            id: orderCode,
            date: apiOrder.created_at || new Date().toISOString(),
            customer: {
              name: formData.name,
              email: formData.email,
              phone: formData.phone,
              whatsapp: formData.whatsapp
            },
            address: {
              province: formData.province,
              city: formData.city,
              neighborhood: formData.neighborhood,
              street: formData.street,
              number: formData.number,
              reference: formData.reference
            },
            shippingMethod: formData.shippingMethod,
            shippingPrice: shipping,
            paymentMethod: methodName,
            items: cart,
            subtotal,
            discount,
            total: finalTotal,
            status: 'received'
          };

          // Limpa o carrinho e cupom (Supabase já gravou o pedido e baixou o estoque atomicamente)
          Storage.clearCart();
          Storage.removeCoupon();

          // Se utilizou cupom, contabiliza o uso no banco/storage
          if (appliedCoupon && appliedCoupon.code) {
            Api.coupons.incrementUsage(appliedCoupon.code).catch(() => {});
          }

          orderResult = newOrder;
          currentStep = 5;
          render();

          window.dispatchEvent(new CustomEvent('orders-updated', { detail: { order: newOrder } }));
          window.dispatchEvent(new CustomEvent('stock-updated'));

          Toast.show({
            title: 'Pedido realizado com sucesso! 🎉',
            message: `O seu pedido ${orderCode} foi registrado no sistema.`,
            type: 'success',
            duration: 6000
          });
        } catch (err) {
          Toast.show({
            title: 'Erro ao processar pedido',
            message: err.message || 'Não foi possível registrar o pedido.',
            type: 'error'
          });
          finishBtn.disabled = false;
          finishBtn.innerHTML = originalBtnText;
        }
      };
    }
  }

  function renderSuccessScreen(order) {
    container.innerHTML = `
      <div class="checkout-success-card">
        <div style="text-align: center; margin-bottom: 28px;">
          <div style="width: 68px; height: 68px; border-radius: 50%; background: #ecfdf5; color: #047857; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
            ${Icons.check(36)}
          </div>
          <h1 style="font-family: var(--font-display); font-size: 1.85rem; font-weight: 900; color: var(--text-main); margin-bottom: 8px;">
            PEDIDO REALIZADO COM SUCESSO!
          </h1>
          <p style="font-size: 1rem; color: var(--text-secondary); line-height: 1.6;">
            Muito obrigado pela sua preferência, <strong>${order.customer.name}</strong>. Acompanhe abaixo o status do seu pedido.
          </p>
          <div style="display: inline-block; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; padding: 8px 20px; border-radius: var(--radius-full); margin-top: 14px;">
            Código do Pedido: ${order.id}
          </div>
        </div>

        <!-- Visual Timeline Status Tracker -->
        <div style="margin: 32px 0;">
          <div style="font-size: 0.8125rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); text-align: center; margin-bottom: 16px; letter-spacing: 0.06em;">
            Status do Envio em Tempo Real
          </div>
          <div class="order-timeline">
            <div class="timeline-step completed">
              <div class="timeline-node">${Icons.check(16)}</div>
              <span class="timeline-text">Pedido Recebido</span>
            </div>
            <div class="timeline-step active">
              <div class="timeline-node">${Icons.creditCard(16)}</div>
              <span class="timeline-text">Pagamento</span>
            </div>
            <div class="timeline-step">
              <div class="timeline-node">${Icons.package(16)}</div>
              <span class="timeline-text">Em Preparação</span>
            </div>
            <div class="timeline-step">
              <div class="timeline-node">${Icons.truck(16)}</div>
              <span class="timeline-text">Enviado</span>
            </div>
            <div class="timeline-step">
              <div class="timeline-node">${Icons.mapPin(16)}</div>
              <span class="timeline-text">Em Trânsito</span>
            </div>
            <div class="timeline-step">
              <div class="timeline-node">${Icons.home(16)}</div>
              <span class="timeline-text">Entregue</span>
            </div>
          </div>
        </div>

        <!-- Order Details Summary -->
        <div class="checkout-success-details-grid">
          <div>
            <h4 style="font-weight: 700; color: var(--text-main); margin-bottom: 8px;">Dados de Entrega:</h4>
            <div style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6;">
              ${order.customer.name}<br />
              ${order.address.street}, nº ${order.address.number}<br />
              ${order.address.neighborhood}, ${order.address.city} - ${order.address.province}<br />
              Telefone: ${order.customer.phone}
            </div>
          </div>

          <div>
            <h4 style="font-weight: 700; color: var(--text-main); margin-bottom: 8px;">Informações de Pagamento:</h4>
            <div style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6;">
              Método: <strong>${order.paymentMethod}</strong><br />
              Status: <strong>Aguardando Validação</strong><br />
              Total Geral: <strong style="color: var(--primary-700); font-family: var(--font-display); font-size: 1.125rem;">${formatPrice(order.total)}</strong>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="checkout-success-actions">
          <a href="#/minha-conta/pedidos" class="btn btn-primary" style="padding: 12px 28px;">
            Acompanhar Meus Pedidos
          </a>
          <button onclick="window.print();" class="btn btn-secondary">
            Imprimir Comprovativo / Fatura
          </button>
          <a href="#/" class="btn btn-secondary">
            Voltar para a Página Inicial
          </a>
        </div>
      </div>
    `;
  }

  window.addEventListener('user-updated', () => {
    render();
  });

  render();
  return container;
}
