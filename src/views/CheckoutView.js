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
    free_shipping_threshold: 100000,
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
    formData.province = formData.province || activeUser.provincia || 'Luanda';
    formData.city = formData.city || activeUser.cidade || activeUser.city || '';
    formData.neighborhood = formData.neighborhood || activeUser.bairro || activeUser.neighborhood || '';
    formData.street = formData.street || activeUser.rua || activeUser.street || activeUser.endereco || '';
    formData.number = formData.number || activeUser.numero || activeUser.number || '';
    formData.reference = formData.reference || activeUser.ponto_referencia || activeUser.reference || '';

    const cart = Storage.getCart();
    const subtotal = Storage.getCartSubtotal();
    const coupon = Storage.getAppliedCoupon();

    if (cart.length === 0 && currentStep !== 5) {
      container.innerHTML = `
        <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 72px 24px; text-align: center; margin: 48px 0;">
          <h2 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 8px;">Nenhum produto no carrinho</h2>
          <p style="color: var(--text-secondary); margin-bottom: 24px;">Adicione produtos antes de iniciar o checkout.</p>
          <a href="#/catalogo" class="btn btn-primary">Explorar Catálogo</a>
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
      <div style="margin-top: 28px; margin-bottom: 24px;">
        <h1 style="font-family: var(--font-display); font-size: 1.875rem; font-weight: 900; color: #0f172a; margin-bottom: 4px;">
          Finalização de Compra Segura
        </h1>
        <div style="display: flex; gap: 8px; font-size: 0.8125rem; color: #64748b;">
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
              <div class="step-number" style="${currentStep > 1 ? 'background: #10b981;' : ''}">
                ${currentStep > 1 ? Icons.check(18, '#ffffff') : '1'}
              </div>
              <div>
                <h3 class="step-title">1. Dados do Cliente / Identificação</h3>
                <span style="font-size: 0.75rem; color: #10b981; font-weight: 600;">✓ Sessão iniciada com conta oficial</span>
              </div>
            </div>

            ${currentStep === 1 ? `
              <form id="step1Form" onsubmit="event.preventDefault();" class="form-grid">
                <div class="form-group form-group-full">
                  <label class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #334155;">Nome Completo *</label>
                  <input type="text" id="custName" class="form-input" required value="${formData.name}" placeholder="Seu Nome Completo" style="font-size: 16px; height: 42px; border-radius: 8px;" />
                </div>

                <div class="form-group form-group-half">
                  <label class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #334155;">E-mail para Confirmação *</label>
                  <input type="email" id="custEmail" class="form-input" required value="${formData.email}" placeholder="seu.email@exemplo.com" style="font-size: 16px; height: 42px; border-radius: 8px;" />
                </div>

                <div class="form-group form-group-half">
                  <label class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #334155;">Telefone / Telemóvel *</label>
                  <input type="tel" id="custPhone" class="form-input" required value="${formData.phone}" placeholder="+244 923 000 000" style="font-size: 16px; height: 42px; border-radius: 8px;" />
                </div>

                <div class="form-group form-group-full">
                  <label class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #334155;">WhatsApp (para envio de comprovativo e rastreio)</label>
                  <input type="tel" id="custWhatsApp" class="form-input" value="${formData.whatsapp}" placeholder="+244 923 000 000" style="font-size: 16px; height: 42px; border-radius: 8px;" />
                </div>

                <div class="checkout-actions-row" style="justify-content: flex-end;">
                  <button type="submit" class="btn btn-primary" style="padding: 12px 28px; border-radius: 8px; font-weight: 700;">
                    Continuar para o Endereço →
                  </button>
                </div>
              </form>
            ` : `
              <div style="font-size: 0.875rem; color: #475569; display: flex; justify-content: space-between; align-items: center;">
                <span><strong>${formData.name}</strong> • ${formData.email} • ${formData.phone}</span>
                <button class="step-edit-btn" data-goto-step="1" style="color: #0284c7; font-weight: 700; cursor: pointer; background: none; border: none;">Editar</button>
              </div>
            `}
          </div>

          <!-- Step 2: Delivery Address -->
          <div class="checkout-step-card" style="${currentStep < 2 ? 'opacity: 0.6; pointer-events: none;' : ''}">
            <div class="checkout-step-header">
              <div class="step-number" style="${currentStep > 2 ? 'background: #10b981;' : ''}">
                ${currentStep > 2 ? Icons.check(18, '#ffffff') : '2'}
              </div>
              <div>
                <h3 class="step-title">2. Endereço de Entrega em Angola</h3>
                <span style="font-size: 0.75rem; color: #64748b;">Onde deseja receber a sua encomenda?</span>
              </div>
            </div>

            ${currentStep === 2 ? `
              <form id="step2Form" onsubmit="event.preventDefault();" class="form-grid">
                <div class="form-group form-group-half">
                  <label class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #334155;">Província *</label>
                  <select id="addrProvince" class="form-select" style="font-size: 16px; height: 42px; border-radius: 8px;">
                    ${ANGOLA_PROVINCES.map(p => {
                      const pName = typeof p === 'object' ? p.name : p;
                      return `<option value="${pName}" ${pName === (formData.province || 'Luanda') ? 'selected' : ''}>${pName}</option>`;
                    }).join('')}
                  </select>
                </div>

                <div class="form-group form-group-half">
                  <label class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #334155;">Município / Cidade *</label>
                  <input type="text" id="addrCity" class="form-input" required value="${formData.city}" placeholder="Ex: Talatona, Maianga, Belas..." style="font-size: 16px; height: 42px; border-radius: 8px;" />
                </div>

                <div class="form-group form-group-half">
                  <label class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #334155;">Bairro *</label>
                  <input type="text" id="addrNeighborhood" class="form-input" required value="${formData.neighborhood}" placeholder="Ex: Morro Bento, Alvalade..." style="font-size: 16px; height: 42px; border-radius: 8px;" />
                </div>

                <div class="form-group form-group-half">
                  <label class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #334155;">Rua / Avenida *</label>
                  <input type="text" id="addrStreet" class="form-input" required value="${formData.street}" placeholder="Ex: Rua Direita de Luanda Sul" style="font-size: 16px; height: 42px; border-radius: 8px;" />
                </div>

                <div class="form-group form-group-half">
                  <label class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #334155;">Número / Edifício / Apto</label>
                  <input type="text" id="addrNumber" class="form-input" value="${formData.number}" placeholder="Ex: Casa nº 14 / Apt 3B" style="font-size: 16px; height: 42px; border-radius: 8px;" />
                </div>

                <div class="form-group form-group-half">
                  <label class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #334155;">Ponto de Referência</label>
                  <input type="text" id="addrReference" class="form-input" value="${formData.reference}" placeholder="Ex: Próximo à bomba Sonangol..." style="font-size: 16px; height: 42px; border-radius: 8px;" />
                </div>

                <div class="checkout-actions-row">
                  <button type="button" class="btn btn-secondary" data-goto-step="1" style="border-radius: 8px; font-weight: 600;">← Voltar</button>
                  <button type="submit" class="btn btn-primary" style="padding: 12px 28px; border-radius: 8px; font-weight: 700;">Continuar para Envio →</button>
                </div>
              </form>
            ` : currentStep > 2 ? `
              <div style="font-size: 0.875rem; color: #475569; display: flex; justify-content: space-between; align-items: center;">
                <span>${[formData.street, formData.number ? 'nº ' + formData.number : '', formData.neighborhood, formData.city, formData.province].filter(Boolean).join(', ')}</span>
                <button class="step-edit-btn" data-goto-step="2" style="color: #0284c7; font-weight: 700; cursor: pointer; background: none; border: none;">Editar</button>
              </div>
            ` : ''}
          </div>

          <!-- Step 3: Shipping Options -->
          <div class="checkout-step-card" style="${currentStep < 3 ? 'opacity: 0.6; pointer-events: none;' : ''}">
            <div class="checkout-step-header">
              <div class="step-number" style="${currentStep > 3 ? 'background: #10b981;' : ''}">
                ${currentStep > 3 ? Icons.check(18, '#ffffff') : '3'}
              </div>
              <div>
                <h3 class="step-title">3. Modalidade de Envio</h3>
                <span style="font-size: 0.75rem; color: #64748b;">Selecione a velocidade desejada</span>
              </div>
            </div>

            ${currentStep === 3 ? `
              <div class="radio-cards-group">
                <div class="radio-card ${formData.shippingMethod === 'normal' ? 'active' : ''}" data-ship-opt="normal">
                  <div class="radio-card-left">
                    <input type="radio" name="shipOpt" value="normal" ${formData.shippingMethod === 'normal' ? 'checked' : ''} />
                    <div class="radio-card-text">
                      <span class="radio-card-title">Entrega Normal</span>
                      <span class="radio-card-desc">Prazo padrão: 24 a 48 horas úteis</span>
                    </div>
                  </div>
                  <span class="radio-card-price">${isFreeShipping ? 'GRÁTIS' : formatPrice(currentShippingRates.normal)}</span>
                </div>

                <div class="radio-card ${formData.shippingMethod === 'express' ? 'active' : ''}" data-ship-opt="express">
                  <div class="radio-card-left">
                    <input type="radio" name="shipOpt" value="express" ${formData.shippingMethod === 'express' ? 'checked' : ''} />
                    <div class="radio-card-text">
                      <span class="radio-card-title">Entrega Expressa Mesmo Dia</span>
                      <span class="radio-card-desc">Prazo prioritário: Entrega rápida em até 6 horas</span>
                    </div>
                  </div>
                  <span class="radio-card-price">${formatPrice(currentShippingRates.express)}</span>
                </div>
              </div>

              <div class="checkout-actions-row">
                <button type="button" class="btn btn-secondary" data-goto-step="2" style="border-radius: 8px; font-weight: 600;">← Voltar</button>
                <button type="button" class="btn btn-primary" id="step3NextBtn" style="padding: 12px 28px; border-radius: 8px; font-weight: 700;">Continuar para Pagamento →</button>
              </div>
            ` : currentStep > 3 ? `
              <div style="font-size: 0.875rem; color: #475569; display: flex; justify-content: space-between; align-items: center;">
                <span>${formData.shippingMethod === 'express' ? 'Entrega Expressa Mesmo Dia' : 'Entrega Normal (24-48h)'} • ${isFreeShipping && formData.shippingMethod === 'normal' ? 'Grátis' : formatPrice(shippingCost)}</span>
                <button class="step-edit-btn" data-goto-step="3" style="color: #0284c7; font-weight: 700; cursor: pointer; background: none; border: none;">Editar</button>
              </div>
            ` : ''}
          </div>

          <!-- Step 4: Payment Methods (Angola Focused & Real Store Data) -->
          <div class="checkout-step-card" style="${currentStep < 4 ? 'opacity: 0.6; pointer-events: none;' : ''}">
            <div class="checkout-step-header">
              <div class="step-number">4</div>
              <div>
                <h3 class="step-title">4. Método de Pagamento</h3>
                <span style="font-size: 0.75rem; color: #64748b;">Pagamento 100% seguro em Kwanzas (Kz)</span>
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
                      <span class="radio-card-desc">Receba o pedido de autorização no seu aplicativo MCX</span>
                    </div>
                  </div>
                  <span class="badge" style="background: #2563eb; color: #fff;">RECOMENDADO</span>
                </div>

                ${formData.paymentMethod === 'multicaixa_express' ? `
                  <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: -4px 0 8px 0;">
                    <label class="form-label" style="color: #1e40af; font-weight: 700; font-size: 0.8125rem;">Número do seu Telemóvel Multicaixa Express:</label>
                    <input type="tel" id="mcExpressPhone" class="form-input" value="${formData.multicaixaPhone}" placeholder="+244 923 000 000" style="margin-top: 6px; height: 42px; font-size: 16px; border-radius: 8px; width: 100%; box-sizing: border-box;" />
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
                      <span class="radio-card-desc">Transferência para conta oficial ${storeSettings.store_name || 'NovaTech'} (${storeSettings.bank_name || 'BAI'})</span>
                    </div>
                  </div>
                </div>

                ${formData.paymentMethod === 'transfer' ? `
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: -4px 0 8px 0; font-size: 0.8125rem;">
                    <div style="margin-bottom: 6px;"><strong>Titular da Conta:</strong> <span>${storeSettings.bank_holder || 'NovaTech'}</span></div>
                    <div style="margin-bottom: 6px;"><strong>Banco Principal:</strong> <span>${storeSettings.bank_name || 'BAI'}</span></div>
                    <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; background: #ffffff; border: 1px dashed #cbd5e1; padding: 10px 14px; border-radius: 8px;">
                      <div>
                        <span style="font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; color: #64748b; display: block;">IBAN Oficial de Pagamento:</span>
                        <strong id="displayIbanCode" style="font-family: ui-monospace, monospace; font-size: 0.9375rem; color: #0f172a; word-break: break-all;">${storeSettings.bank_iban || 'AO06 0040 0000 1234 5678 9012 3'}</strong>
                      </div>
                      <button type="button" id="copyIbanBtn" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 6px 12px; border-radius: 6px; font-weight: 600;">
                        Copiar IBAN
                      </button>
                    </div>
                    <div style="color: #64748b; font-size: 0.75rem; line-height: 1.4;">
                      Após efetuar a transferência bancária, envie o comprovativo oficial para o WhatsApp <strong>${storeSettings.whatsapp || storeSettings.phone || '+244 923 179 192'}</strong> para liberação do seu pedido.
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
                      <span class="radio-card-title">Pagamento na Entrega (TPA / Cartão / Dinheiro)</span>
                      <span class="radio-card-desc">Pague ao estafeta no momento em que receber a encomenda</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="checkout-actions-row">
                <button type="button" class="btn btn-secondary" data-goto-step="3" style="border-radius: 8px; font-weight: 600;">← Voltar</button>
                <button type="button" class="btn btn-accent" id="finishOrderBtn" style="padding: 14px 28px; font-size: 1rem; border-radius: 8px; font-weight: 800;">
                  FINALIZAR PEDIDO (${formatPrice(total)})
                </button>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Right: Order Summary Sticky -->
        <div>
          <div class="checkout-summary-box" style="border-radius: 12px;">
            <h3 style="font-family: var(--font-display); font-size: 1.125rem; font-weight: 800; color: #0f172a; margin-bottom: 16px;">
              Produtos no Pedido (${cart.length})
            </h3>

            <div class="checkout-items-list" style="display: flex; flex-direction: column; gap: 12px; max-height: 260px; overflow-y: auto; margin-bottom: 20px;">
              ${cart.map(i => `
                <div class="checkout-item-row">
                  <img src="${i.image}" alt="${i.name}" class="checkout-item-img" style="border-radius: 6px;" />
                  <div class="checkout-item-info">
                    <div class="checkout-item-title">${(i.name || '').toUpperCase()}</div>
                    <div class="checkout-item-meta">${i.quantity} un. • ${formatPrice(i.price)}</div>
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
                <div class="checkout-summary-row" style="color: #10b981;">
                  <span>Desconto</span>
                  <strong>-${formatPrice(discountAmount)}</strong>
                </div>
              ` : ''}
              <div class="checkout-summary-row">
                <span>Taxa de Entrega</span>
                <strong>${isFreeShipping && formData.shippingMethod === 'normal' ? '<span style="color: #10b981;">GRÁTIS</span>' : formatPrice(shippingCost)}</strong>
              </div>
              <div class="checkout-summary-row checkout-total-row">
                <span>Total a Pagar</span>
                <span>${formatPrice(total)}</span>
              </div>
            </div>

            <div style="background: #f8fafc; border-radius: 8px; padding: 12px; font-size: 0.75rem; color: #64748b; display: flex; align-items: center; gap: 8px; margin-top: 14px;">
              ${Icons.shieldCheck(20, '#10b981')}
              <span>Garantia de Entrega e Devolução Segura.</span>
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
        formData.whatsapp = container.querySelector('#custWhatsApp')?.value.trim() || formData.phone;
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
        formData.number = container.querySelector('#addrNumber')?.value.trim() || '';
        formData.reference = container.querySelector('#addrReference')?.value.trim() || '';

        // Sincroniza os dados de endereço atualizados com o perfil do cliente
        const u = Storage.getUser();
        if (u) {
          u.provincia = formData.province;
          u.cidade = formData.city;
          u.bairro = formData.neighborhood;
          u.rua = formData.street;
          u.numero = formData.number;
          u.ponto_referencia = formData.reference;
          u.endereco = [formData.street, formData.number, formData.neighborhood, formData.city, formData.province].filter(Boolean).join(', ');
          Storage.saveUser(u);
          Api.auth.updateProfile(u).catch(() => {});
        }

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
        finishBtn.innerHTML = 'Processando pedido seguro...';

        const loggedUser = Storage.getUser();
        const orderPayload = {
          user_id: loggedUser?.id || null,
          customer_name: formData.name,
          customer_email: formData.email,
          customer_phone: formData.phone,
          customer_whatsapp: formData.whatsapp || formData.phone,
          provincia: formData.province || 'Luanda',
          cidade: formData.city || '',
          bairro: formData.neighborhood || '',
          rua: formData.street || '',
          numero: formData.number || '',
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
          if (coupon && coupon.code) {
            await Api.coupons.validate(coupon.code, subtotal, formData.email).catch(() => {});
          }

          const apiOrder = await Api.orders.create(orderPayload);
          const orderCode = apiOrder.order_code || apiOrder.codigo_pedido || `NV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

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

          Storage.clearCart();
          Storage.removeCoupon();
          Api.cart.clearDbCart().catch(() => {});

          if (coupon && coupon.code) {
            Api.coupons.incrementUsage(coupon.code).catch(() => {});
          }

          orderResult = newOrder;
          currentStep = 5;
          render();

          window.dispatchEvent(new CustomEvent('orders-updated', { detail: { order: newOrder } }));
          window.dispatchEvent(new CustomEvent('stock-updated'));

          Toast.show({
            title: 'Pedido realizado com sucesso! 🎉',
            message: `O seu pedido ${orderCode} foi registrado com sucesso.`,
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
    const rawPhone = (storeSettings.whatsapp || storeSettings.phone || '+244923179192').replace(/\D/g, '');
    const waText = encodeURIComponent(`Olá! Acabei de finalizar o pedido *#${order.id}* no valor de *${formatPrice(order.total)}*. Segue o comprovativo para validação.`);
    const waUrl = `https://wa.me/${rawPhone}?text=${waText}`;

    container.innerHTML = `
      <div class="checkout-success-card" style="border-radius: 14px; padding: 36px 24px; max-width: 680px; margin: 32px auto; background: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15,23,42,0.06);">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: #ecfdf5; color: #047857; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
            ${Icons.check(36)}
          </div>
          <h1 style="font-family: var(--font-display); font-size: 1.75rem; font-weight: 900; color: #0f172a; margin-bottom: 6px;">
            PEDIDO CONFIRMADO COM SUCESSO!
          </h1>
          <p style="font-size: 0.9375rem; color: #64748b; line-height: 1.5; margin: 0 auto 12px auto; max-width: 480px;">
            Obrigado pela sua compra, <strong>${order.customer.name}</strong>. O seu pedido foi registrado no sistema.
          </p>
          <div style="display: inline-block; background: #f1f5f9; border: 1px solid #e2e8f0; color: #0f172a; font-family: var(--font-display); font-size: 1.125rem; font-weight: 800; padding: 6px 18px; border-radius: 8px; letter-spacing: 0.05em;">
            Código: ${order.id}
          </div>
        </div>

        <!-- Order Details Summary -->
        <div class="checkout-success-details-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 24px;">
          <div>
            <h4 style="font-weight: 800; color: #0f172a; margin-bottom: 6px; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.04em;">Endereço de Entrega:</h4>
            <div style="font-size: 0.8125rem; color: #475569; line-height: 1.6;">
              <strong>${order.customer.name}</strong><br />
              ${[order.address.street, order.address.number ? 'nº ' + order.address.number : '', order.address.neighborhood].filter(Boolean).join(', ')}<br />
              ${order.address.city || ''} - ${order.address.province || 'Luanda'}<br />
              Telefone: ${order.customer.phone}
            </div>
          </div>

          <div>
            <h4 style="font-weight: 800; color: #0f172a; margin-bottom: 6px; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.04em;">Pagamento:</h4>
            <div style="font-size: 0.8125rem; color: #475569; line-height: 1.6;">
              Método: <strong>${order.paymentMethod}</strong><br />
              Status: <span class="badge" style="background: #fef3c7; color: #92400e; font-size: 0.6875rem; padding: 2px 6px; border-radius: 4px;">Aguardando Pagamento</span><br />
              Total a Pagar: <strong style="color: #0f172a; font-family: var(--font-display); font-size: 1.125rem; display: block; margin-top: 4px;">${formatPrice(order.total)}</strong>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="checkout-success-actions" style="display: flex; flex-direction: column; gap: 10px;">
          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn" style="background: #25d366; color: #ffffff; border: none; padding: 12px 20px; font-weight: 800; font-size: 0.9375rem; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none;">
            📱 Enviar Comprovativo no WhatsApp da Loja
          </a>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <a href="#/pedidos" class="btn btn-primary" style="padding: 11px 16px; font-weight: 700; font-size: 0.875rem; border-radius: 8px; text-align: center; text-decoration: none;">
              Acompanhar Meus Pedidos
            </a>
            <a href="#/" class="btn btn-secondary" style="padding: 11px 16px; font-weight: 600; font-size: 0.875rem; border-radius: 8px; text-align: center; text-decoration: none;">
              Continuar na Loja
            </a>
          </div>
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
