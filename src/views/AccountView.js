// ===================================================================
// ACCOUNT & ORDERS VIEW (Customer Dashboard, Order Timeline Tracker)
// 100% Conectado com o Supabase e API Real
// ===================================================================

import { Icons } from '../utils/icons.js';
import { formatPrice, formatDate } from '../utils/format.js';
import { Storage, normalizeOrderStatus } from '../services/storage.js';
import { Api } from '../services/api.js';
import { createProductCard } from '../components/ProductCard.js';
import { Toast } from '../components/Toast.js';
import { showProductReviewModal } from '../components/ReviewModal.js';

// Lista padrão das 18 províncias de Angola
const ANGOLA_PROVINCES = [
  'Bengo', 'Benguela', 'Bié', 'Cabinda', 'Cuando Cubango', 'Cuanza Norte',
  'Cuanza Sul', 'Cunene', 'Huambo', 'Huíla', 'Luanda', 'Lunda Norte',
  'Lunda Sul', 'Malanje', 'Moxico', 'Namibe', 'Uíge', 'Zaire'
];

export function renderAccountView(initialTab = 'orders', initialOrderId = null) {
  const container = document.createElement('div');
  container.className = 'container';

  let currentTab = initialTab; // 'orders' | 'profile' | 'wishlist' | 'addresses'
  let profileSubTab = 'data'; // 'data' | 'security'
  let activeOrderId = initialOrderId || null;

  function formatOrderDateCompact(dateString) {
    if (!dateString) return 'Data recente';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return 'Data recente';
      const day = d.getDate();
      const months = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
      return `${day} de ${months[d.getMonth()]}`;
    } catch (e) {
      return formatDate(dateString);
    }
  }
  
  // Pré-carregamento imediato dos pedidos do usuário logado para eliminar qualquer delay
  let ordersList = [];
  const initialUser = Storage.getUser();
  if (initialUser) {
    const allLocal = Storage.getOrders ? Storage.getOrders() : [];
    const uEmail = (initialUser.email || '').toLowerCase().trim();
    ordersList = (Array.isArray(allLocal) ? allLocal : []).filter(o => {
      const oEmail = (o.customer_email || o.email_cliente || o.customer?.email || '').toLowerCase().trim();
      const oId = o.user_id || o.usuario_id || o.customer?.id;
      return (uEmail && oEmail === uEmail) || (initialUser.id && String(oId) === String(initialUser.id));
    });
  }

  let availableProducts = [];

  let isSyncing = false;

  async function syncRealData() {
    const user = Storage.getUser();

    isSyncing = true;
    try {
      const [fetchedOrders, fetchedProducts] = await Promise.all([
        user ? Api.orders.getMyOrders({ userId: user.id, userEmail: user.email }).catch(e => {
          console.warn('Erro ao buscar pedidos do usuário:', e.message);
          return [];
        }) : Promise.resolve([]),
        Api.products.getAll({ all: true }).catch(() => [])
      ]);

      if (Array.isArray(fetchedOrders)) {
        ordersList = fetchedOrders;
        if (Storage.saveOrders) Storage.saveOrders(fetchedOrders);
      }
      if (Array.isArray(fetchedProducts) && fetchedProducts.length > 0) {
        availableProducts = fetchedProducts;
      }
      render();
    } catch (e) {
      console.warn('Erro ao sincronizar dados da conta:', e.message);
    } finally {
      isSyncing = false;
    }
  }

  // Sincronização em tempo real com eventos do Admin e Loja
  const onOrdersUpdated = () => {
    syncRealData();
  };
  window.addEventListener('orders-updated', onOrdersUpdated);
  window.addEventListener('order-created', onOrdersUpdated);
  window.addEventListener('products-updated', onOrdersUpdated);
  window.addEventListener('wishlist-updated', () => render());

  function render() {
    const user = Storage.getUser();
    const wishlistIds = Storage.getWishlist();
    const wishlistedProducts = (availableProducts || []).filter(p =>
      wishlistIds.includes(p.id) || wishlistIds.includes(String(p.id)) || wishlistIds.includes(Number(p.id)) || (p.uid && wishlistIds.includes(p.uid))
    );

    // Se a aba for Favoritos e o usuário não estiver logado, exibe os favoritos com banner convidativo
    if (!user && currentTab === 'wishlist') {
      container.innerHTML = `
        <div style="margin-top: 24px; margin-bottom: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--border-light);">
          <div>
            <div style="display: flex; align-items: baseline; gap: 10px;">
              <h1 style="font-family: var(--font-display); font-size: clamp(1.5rem, 4vw, 1.85rem); font-weight: 800; color: var(--text-main); margin: 0; letter-spacing: -0.02em;">
                Meus Favoritos
              </h1>
              ${wishlistedProducts.length > 0 ? `
                <span style="font-size: 0.95rem; color: var(--text-muted); font-weight: 600;">
                  (${wishlistedProducts.length} ${wishlistedProducts.length === 1 ? 'item' : 'itens'})
                </span>
              ` : ''}
            </div>
            <p style="color: #64748b; font-size: 0.875rem; margin: 4px 0 0 0;">
              Itens salvos no seu navegador. <a href="#/login" style="color: var(--primary-600); font-weight: 700; text-decoration: underline;">Entre na sua conta</a> para sincronizar em qualquer dispositivo.
            </p>
          </div>
        </div>

        ${wishlistedProducts.length === 0 ? `
          <!-- Favoritos Vazio de Alto Padrão (Clean, Minimalista, Idêntico ao Carrinho Vazio) -->
          <div class="cart-empty-clean" style="text-align: center; padding: clamp(40px, 8vh, 80px) 16px; max-width: 440px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <!-- Ícone Sutil com Acabamento Refinado -->
            <div style="width: 72px; height: 72px; border-radius: 50%; background: #eff6ff; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; color: var(--primary-600); border: 1px solid rgba(37,99,235,0.12);">
              ${Icons.heart(32, 'var(--primary-600)')}
            </div>

            <h2 style="font-family: var(--font-display); font-size: clamp(1.3rem, 4vw, 1.55rem); font-weight: 800; color: var(--text-main); margin: 0 0 10px 0; letter-spacing: -0.02em;">
              A sua lista de favoritos está vazia
            </h2>

            <p style="color: var(--text-secondary); font-size: clamp(0.875rem, 2.5vw, 0.9375rem); margin: 0 0 24px 0; line-height: 1.5; max-width: 360px;">
              Ainda não adicionou nenhum artigo aos favoritos. Explore e acesse o catálogo.
            </p>

            <a href="#/catalogo" class="btn btn-primary" style="padding: 13px 32px; font-weight: 700; border-radius: 8px; font-size: 0.9375rem; display: inline-flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(37,99,235,0.22); min-height: 46px; width: 100%; max-width: 240px;">
              <span>Acessar Catálogo</span>
              ${Icons.chevronRight(16)}
            </a>
          </div>
        ` : `
          <div class="products-grid" id="guestWishlistGrid" style="margin-bottom: 48px;">
            <!-- Inserido dinamicamente via createProductCard -->
          </div>
        `}
      `;

      const grid = container.querySelector('#guestWishlistGrid');
      if (grid) {
        wishlistedProducts.forEach(p => grid.appendChild(createProductCard(p)));
      }
      return;
    }

    // Se o cliente não estiver logado e não estiver em Favoritos, exibe tela de login / cadastro
    if (!user) {
      container.innerHTML = `
        <div style="max-width: 560px; margin: 64px auto; background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 48px 32px; text-align: center; box-shadow: var(--shadow-sm);">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--primary-50); color: var(--primary-600); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto;">
            ${Icons.user(32)}
          </div>
          <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">
            Acesse a sua Conta
          </h2>
          <p style="color: var(--text-secondary); font-size: 0.9375rem; margin-bottom: 28px; line-height: 1.6;">
            Inicie sessão ou crie uma conta gratuita com seu e-mail e senha para acompanhar os seus pedidos, visualizar o rastreamento em tempo real e gerenciar seus dados cadastrais.
          </p>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <button class="btn btn-primary btn-full" id="accountLoginPromptBtn">
              Iniciar Sessão
            </button>
            <button class="btn btn-secondary btn-full" id="accountRegisterPromptBtn">
              Criar Nova Conta Grátis
            </button>
          </div>
        </div>
      `;

      const loginBtn = container.querySelector('#accountLoginPromptBtn');
      if (loginBtn) {
        loginBtn.onclick = () => { window.location.hash = '/login'; };
      }
      const regBtn = container.querySelector('#accountRegisterPromptBtn');
      if (regBtn) {
        regBtn.onclick = () => { window.location.hash = '/cadastro'; };
      }
      return;
    }

    container.innerHTML = `
      <div class="admin-layout" style="margin-top: 20px;">
        <!-- Menu Lateral do Cliente -->
        <aside class="admin-sidebar">
          <div style="text-align: center; padding-bottom: 18px; border-bottom: 1px solid #e2e8f0; margin-bottom: 14px;">
            <div style="width: 56px; height: 56px; border-radius: 50%; background: #0f172a; color: #ffffff; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px auto; font-weight: 800; font-size: 1.35rem; letter-spacing: 0.05em;">
              ${user.name ? user.name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() : 'CL'}
            </div>
            <h3 style="font-size: 0.9375rem; font-weight: 800; color: #0f172a; margin-bottom: 2px;">
              ${user.name || 'Cliente'}
            </h3>
            <span style="font-size: 0.75rem; color: #64748b; word-break: break-all;">${user.email || ''}</span>
          </div>

          <ul class="admin-menu-list">
            <li class="admin-menu-item ${currentTab === 'orders' ? 'active' : ''}" data-acc-tab="orders">
              ${Icons.package(18)}
              <span>Meus Pedidos (${ordersList.length})</span>
            </li>
            <li class="admin-menu-item ${currentTab === 'wishlist' ? 'active' : ''}" data-acc-tab="wishlist">
              ${Icons.heart(18)}
              <span>Favoritos (${wishlistIds.length})</span>
            </li>
            <li class="admin-menu-item ${currentTab === 'profile' ? 'active' : ''}" data-acc-tab="profile">
              ${Icons.user(18)}
              <span>Meu Perfil</span>
            </li>
            <li class="admin-menu-item ${currentTab === 'addresses' ? 'active' : ''}" data-acc-tab="addresses">
              ${Icons.mapPin(18)}
              <span>Endereço de Entrega</span>
            </li>
            <li class="admin-menu-item" id="accLogoutBtn" style="color: #ef4444; margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
              ${Icons.close(18)}
              <span>Terminar Sessão</span>
            </li>
          </ul>
        </aside>

        <!-- Conteúdo Principal da Aba -->
        <main>
          ${currentTab === 'orders' ? `
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 10px;">
                <div>
                  <h1 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.01em;">
                    Meus Pedidos
                  </h1>
                  <p style="color: #64748b; font-size: 0.8125rem; margin: 2px 0 0 0;">
                    Acompanhe as suas compras e entregas em tempo real.
                  </p>
                </div>
                <button class="btn btn-secondary btn-sm" id="refreshOrdersBtn" title="Sincronizar status com o banco de dados" style="border-radius: 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 0.8125rem;">
                  ${Icons.refresh ? Icons.refresh(14) : '⟳'} Sincronizar
                </button>
              </div>

              ${ordersList.length === 0 ? `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 64px 24px; text-align: center; box-shadow: 0 1px 4px rgba(15,23,42,0.03);">
                  <div style="width: 64px; height: 64px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px auto; color: #94a3b8;">
                    ${Icons.package(32, 'currentColor')}
                  </div>
                  <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-bottom: 8px;">
                    Ainda não tem compras registadas
                  </h3>
                  <p style="color: #64748b; font-size: 0.9375rem; max-width: 440px; margin: 0 auto 24px auto; line-height: 1.6;">
                    Assim que concluir uma compra na loja, as suas compras aparecerão em lista aqui com rastreamento detalhado.
                  </p>
                  <a href="#/catalogo" class="btn btn-primary" style="padding: 12px 28px; border-radius: 8px; font-weight: 700;">
                    Explorar Catálogo de Produtos
                  </a>
                </div>
              ` : !activeOrderId ? `
                <!-- VISÃO EM LISTA COMPACTA (PEDIDO DO USUÁRIO) -->
                <div class="orders-compact-list">
                  ${ordersList.map(order => {
                    const items = order.items || order.itens_pedido || [];
                    const firstItem = items[0] || {};
                    const firstName = firstItem.product_name || firstItem.name || 'Produto Comprado';
                    const firstImg = firstItem.product_image || firstItem.image || '';
                    const extraCount = Math.max(0, items.length - 1);
                    const orderDate = order.date || order.created_at || order.criado_em;
                    const orderCode = order.order_code || order.codigo_pedido || order.id;
                    const canonicalStatus = normalizeOrderStatus(order.status || order.status_pedido);

                    let statusBadgeColor = '#059669';
                    let statusBadgeBg = '#ecfdf5';
                    let statusText = 'Entregue';
                    if (canonicalStatus === 'shipped' || canonicalStatus === 'in_transit') {
                      statusBadgeColor = '#2563eb';
                      statusBadgeBg = '#eff6ff';
                      statusText = 'Em rota de entrega';
                    } else if (canonicalStatus === 'preparing' || canonicalStatus === 'processing') {
                      statusBadgeColor = '#d97706';
                      statusBadgeBg = '#fffbeb';
                      statusText = 'Em preparação';
                    } else if (canonicalStatus === 'cancelled') {
                      statusBadgeColor = '#dc2626';
                      statusBadgeBg = '#fef2f2';
                      statusText = 'Cancelado';
                    } else {
                      statusBadgeColor = '#475569';
                      statusBadgeBg = '#f1f5f9';
                      statusText = 'Pedido recebido';
                    }

                    return `
                      <div class="order-list-item-compact" data-select-order-id="${order.id || orderCode}">
                        <div class="order-item-compact-left">
                          ${firstImg ? `
                            <img src="${firstImg}" alt="${firstName}" class="order-item-compact-thumb" />
                          ` : `
                            <div class="order-item-compact-thumb" style="display:flex; align-items:center; justify-content:center; color:#94a3b8;">
                              ${Icons.package(26)}
                            </div>
                          `}
                          <div class="order-item-compact-info">
                            <div class="order-item-compact-title">
                              <span>${firstName}</span>
                              ${extraCount > 0 ? `<span class="order-item-extra-count">+${extraCount} ${extraCount === 1 ? 'outro item' : 'outros itens'}</span>` : ''}
                            </div>
                            <div class="order-item-compact-meta">
                              <span>Comprado em ${formatOrderDateCompact(orderDate)}</span>
                              <span>|</span>
                              <strong style="color: #0f172a;">AOA ${formatPrice(order.total).replace('Kz', '').trim()}</strong>
                            </div>
                          </div>
                        </div>

                        <div class="order-item-compact-right">
                          <span style="background: ${statusBadgeBg}; color: ${statusBadgeColor}; font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 6px; white-space: nowrap;">
                            ${statusText}
                          </span>
                          ${canonicalStatus === 'delivered' ? `
                            <button type="button" class="btn-review-item" style="padding: 6px 11px;" data-review-prod-id="${firstItem?.product_id || firstItem?.id || ''}" data-review-prod-name="${firstName}" data-review-prod-img="${firstImg}">
                              ★ Avaliar
                            </button>
                          ` : ''}
                          <button type="button" class="btn-open-order-details" title="Ver detalhes do pedido">
                            <span>Ver Detalhes</span>
                            ${Icons.chevronRight(14)}
                          </button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : `
                <!-- VISÃO DETALHADA DO PEDIDO SELECIONADO -->
                <div>
                  <button type="button" class="btn-back-to-orders" id="btnBackToOrdersList">
                    ${Icons.chevronLeft(16)} Voltar para Todos os Pedidos
                  </button>

                  ${(() => {
                    const order = ordersList.find(o => String(o.id) === String(activeOrderId) || String(o.order_code) === String(activeOrderId) || String(o.codigo_pedido) === String(activeOrderId)) || ordersList[0];
                    if (!order) return '<p>Pedido não encontrado.</p>';

                    const canonicalStatus = normalizeOrderStatus(order.status || order.status_pedido);
                    const isCancelled = canonicalStatus === 'cancelled';
                    const orderCode = order.order_code || order.codigo_pedido || order.id;
                    const items = order.items || order.itens_pedido || [];
                    const orderDate = order.date || order.created_at || order.criado_em;

                    let currentStepIndex = 0;
                    if (canonicalStatus === 'delivered') {
                      currentStepIndex = 4;
                    } else if (canonicalStatus === 'shipped' || canonicalStatus === 'in_transit') {
                      currentStepIndex = 3;
                    } else if (canonicalStatus === 'preparing' || canonicalStatus === 'processing') {
                      currentStepIndex = 2;
                    } else if (canonicalStatus === 'confirmed' || (order.payment_status === 'pago')) {
                      currentStepIndex = 1;
                    } else {
                      currentStepIndex = 0;
                    }

                    const progressPct = isCancelled ? 0 : Math.min(100, (currentStepIndex / 4) * 100);
                    const isFreeShipping = Number(order.shipping_price || 0) === 0 || Number(order.total || 0) >= 100000;

                    return `
                      <div class="order-card-enterprise">
                        <!-- Header do Pedido Padrão Enterprise (Amazon / Mercado Livre) -->
                        <div class="order-card-header">
                          <div class="order-header-info-group">
                            <div class="order-header-col">
                              <span class="order-header-label">Data da Compra</span>
                              <span class="order-header-val">${formatDate(orderDate)}</span>
                            </div>

                            <div class="order-header-col">
                              <span class="order-header-label">Total Pago</span>
                              <span class="order-header-val" style="color: #0f172a; font-weight: 900;">
                                ${formatPrice(order.total)}
                              </span>
                            </div>

                            <div class="order-header-col">
                              <span class="order-header-label">Destinatário</span>
                              <span class="order-header-val">
                                ${order.customer_name || user.name || 'Cliente'}
                              </span>
                            </div>

                            <div class="order-header-col">
                              <span class="order-header-label">Nº do Pedido</span>
                              <span class="order-code-badge" data-copy-order-code="${orderCode}" title="Clique para copiar o código">
                                <span>${orderCode}</span>
                                ${Icons.fileText ? Icons.fileText(12, 'currentColor') : '📋'}
                              </span>
                            </div>
                          </div>

                          <div class="order-header-actions">
                            ${canonicalStatus === 'shipped' || canonicalStatus === 'in_transit' ? `
                              <button type="button" class="order-header-action-btn btn-confirm-delivery" data-order-id="${order.id}" data-order-code="${orderCode}" style="background: #16a34a; border-color: #16a34a; color: #ffffff; font-weight: 800;">
                                ✓ Confirmar Recebimento
                              </button>
                            ` : ''}
                            <button type="button" class="order-header-action-btn btn-view-invoice-action" data-order-code="${orderCode}">
                              ${Icons.fileText ? Icons.fileText(14, '#2563eb') : '📄'}
                              <span>Ver Fatura / Recibo</span>
                            </button>
                            <a href="https://wa.me/244923179192?text=Ol%C3%A1%20NovaTech%2C%20preciso%20de%20informa%C3%A7%C3%B5es%20sobre%20o%20meu%20pedido%20${orderCode}" target="_blank" class="order-header-action-btn" title="Falar com o suporte no WhatsApp">
                              ${Icons.whatsapp ? Icons.whatsapp(14, '#10b981') : '💬'}
                              <span>Ajuda</span>
                            </a>
                          </div>
                        </div>

                        ${!isCancelled ? `
                          <!-- Linha do Tempo Logística Real e Contínua (Enterprise) -->
                          <div class="order-tracker-box">
                            <div class="order-timeline-track">
                              <div class="order-timeline-line-bg"></div>
                              <div class="order-timeline-line-fill" style="width: ${progressPct}%;"></div>

                              <!-- Etapa 1: Pedido Recebido -->
                              <div class="order-step-node-wrap ${currentStepIndex >= 0 ? 'done' : ''} ${currentStepIndex === 0 ? 'current' : ''}">
                                <div class="order-step-node">
                                  ${currentStepIndex > 0 ? Icons.check(14, '#ffffff') : '1'}
                                </div>
                                <span class="order-step-title">Pedido Registado</span>
                                <span class="order-step-time">${formatDate(orderDate)}</span>
                              </div>

                              <!-- Etapa 2: Pagamento -->
                              <div class="order-step-node-wrap ${currentStepIndex >= 1 ? 'done' : ''} ${currentStepIndex === 1 ? 'current' : ''}">
                                <div class="order-step-node">
                                  ${currentStepIndex > 1 ? Icons.check(14, '#ffffff') : '2'}
                                </div>
                                <span class="order-step-title">Pagamento</span>
                                <span class="order-step-time">${order.payment_status === 'pago' ? 'Confirmado' : 'Na Entrega'}</span>
                              </div>

                              <!-- Etapa 3: Preparação -->
                              <div class="order-step-node-wrap ${currentStepIndex >= 2 ? 'done' : ''} ${currentStepIndex === 2 ? 'current' : ''}">
                                <div class="order-step-node">
                                  ${currentStepIndex > 2 ? Icons.check(14, '#ffffff') : '3'}
                                </div>
                                <span class="order-step-title">Preparação</span>
                                <span class="order-step-time">${currentStepIndex >= 2 ? 'Concluída' : 'Pendente'}</span>
                              </div>

                              <!-- Etapa 4: Em Rota -->
                              <div class="order-step-node-wrap ${currentStepIndex >= 3 ? 'done' : ''} ${currentStepIndex === 3 ? 'current' : ''}">
                                <div class="order-step-node">
                                  ${currentStepIndex > 3 ? Icons.check(14, '#ffffff') : '4'}
                                </div>
                                <span class="order-step-title">Em Rota</span>
                                <span class="order-step-time">Luanda</span>
                              </div>

                              <!-- Etapa 5: Entregue -->
                              <div class="order-step-node-wrap ${currentStepIndex === 4 ? 'done' : ''}">
                                <div class="order-step-node">
                                  ${currentStepIndex === 4 ? Icons.check(14, '#ffffff') : '5'}
                                </div>
                                <span class="order-step-title">Entregue</span>
                                <span class="order-step-time">${currentStepIndex === 4 ? 'Finalizado' : 'Aguardando'}</span>
                              </div>
                            </div>
                          </div>
                        ` : ''}

                        <!-- Corpo do Pedido: Itens & Dados Reais -->
                        <div class="order-body-content">
                          <!-- Lista de Produtos da Encomenda -->
                          <div style="font-size: 0.8125rem; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.03em; margin-bottom: 10px;">
                            Itens Comprados (${items.length}):
                          </div>

                          <div class="order-items-list">
                            ${items.map(item => {
                              const name = item.product_name || item.name || 'Produto';
                              const img = item.product_image || item.image || '';
                              const price = Number(item.unit_price || item.price || 0);
                              const qty = Number(item.quantity || 1);
                              const prodId = item.product_id || item.id;

                              return `
                                <div class="order-product-row">
                                  <div class="order-product-main">
                                    ${img ? `
                                      <img src="${img}" alt="${name}" class="order-product-thumb" />
                                    ` : `
                                      <div class="order-product-thumb" style="display:flex; align-items:center; justify-content:center; color:#94a3b8;">
                                        ${Icons.package(24)}
                                      </div>
                                    `}
                                    <div class="order-product-info">
                                      <a href="${prodId ? `#/produto/${prodId}` : '#/catalogo'}" class="order-product-name">
                                        ${name}
                                      </a>
                                      <span class="order-product-meta">
                                        Quantidade: <strong>${qty} un</strong> • Preço unitário: ${formatPrice(price)}
                                      </span>
                                    </div>
                                  </div>

                                  <div class="order-product-pricing">
                                    <span class="order-product-total">${formatPrice(price * qty)}</span>
                                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
                                      ${canonicalStatus === 'delivered' ? `
                                        <button type="button" class="btn-review-item" data-review-prod-id="${prodId || ''}" data-review-prod-name="${name}" data-review-prod-img="${img}">
                                          ★ Avaliar Produto
                                        </button>
                                      ` : ''}
                                      <button type="button" class="btn-buy-again" data-buy-item-name="${name}" data-buy-item-price="${price}" data-buy-item-img="${img}" data-buy-item-id="${prodId || ''}">
                                        ${Icons.cart ? Icons.cart(12, 'currentColor') : '🛒'} Comprar Novamente
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              `;
                            }).join('')}
                          </div>

                          ${canonicalStatus === 'delivered' ? `
                            <!-- Card Estético de Convite para Avaliação da Compra -->
                            <div class="order-review-invite-card">
                              <div class="order-review-invite-left">
                                <div class="order-review-invite-badge">★</div>
                                <div>
                                  <h4 class="order-review-invite-title">O que achou da sua compra?</h4>
                                  <p class="order-review-invite-desc">Compartilhe sua experiência sobre o artigo recebido para ajudar outros clientes em Luanda.</p>
                                </div>
                              </div>
                              <div>
                                <button type="button" class="btn-review-invite-trigger" data-review-prod-id="${items[0]?.product_id || items[0]?.id || ''}" data-review-prod-name="${items[0]?.product_name || items[0]?.name || 'Produto'}" data-review-prod-img="${items[0]?.product_image || items[0]?.image || ''}">
                                  ★ Avaliar ${items.length === 1 ? 'Produto' : 'Artigos Comprados'}
                                </button>
                              </div>
                            </div>
                          ` : ''}

                          <!-- Grid de 2 Colunas: Entrega em Luanda & Resumo Financeiro Real -->
                          <div class="order-details-grid">
                            <!-- Coluna 1: Endereço Real de Entrega em Luanda -->
                            <div class="order-details-col">
                              <span class="order-details-title">
                                ${Icons.mapPin(14, 'var(--primary-600)')}
                                Local de Entrega em Luanda
                              </span>
                              <div>
                                <strong style="color: #0f172a;">Destinatário:</strong> ${order.customer_name || user.name || 'Cliente'}
                              </div>
                              <div>
                                <strong style="color: #0f172a;">Endereço:</strong> ${order.shipping_address || order.endereco_entrega || 'Morada indicada no checkout'}
                              </div>
                              ${order.ponto_referencia ? `
                                <div>
                                  <strong style="color: #0f172a;">Ponto de Referência:</strong> ${order.ponto_referencia}
                                </div>
                              ` : ''}
                              <div>
                                <strong style="color: #0f172a;">Contacto do Estafeta:</strong> ${order.customer_phone || user.phone || '+244 923 179 192'}
                              </div>
                              <div style="color: #64748b; font-size: 0.75rem; margin-top: 4px;">
                                Modalidade: Entrega ao Domicílio em Luanda (24h a 48h úteis)
                              </div>
                            </div>

                            <!-- Coluna 2: Discriminação Financeira Real do Banco -->
                            <div class="order-details-col">
                              <span class="order-details-title">
                                ${Icons.creditCard(14, 'var(--primary-600)')}
                                Resumo do Pagamento
                              </span>
                              <table class="order-summary-table">
                                <tr>
                                  <td class="label">Subtotal dos Itens:</td>
                                  <td class="val">${formatPrice(order.subtotal || (order.total - (order.shipping_price || 0)))}</td>
                                </tr>
                                <tr>
                                  <td class="label">Custo de Entrega:</td>
                                  <td class="val">
                                    ${isFreeShipping ? '<span style="color:#059669; font-weight:700;">Grátis (Luanda)</span>' : formatPrice(order.shipping_price || 3500)}
                                  </td>
                                </tr>
                                ${order.discount > 0 ? `
                                  <tr>
                                    <td class="label">Desconto Aplicado:</td>
                                    <td class="val" style="color: #16a34a;">-${formatPrice(order.discount)}</td>
                                  </tr>
                                ` : ''}
                                <tr class="total-row">
                                  <td class="label" style="color: #0f172a;">Total:</td>
                                  <td class="val">${formatPrice(order.total)}</td>
                                </tr>
                              </table>
                              <div style="margin-top: 6px; font-size: 0.75rem; color: #475569;">
                                <strong>Método:</strong> ${order.payment_method || 'Pagamento na Entrega (TPA / Dinheiro)'}
                                <br />
                                <strong>Status:</strong> <span style="color: ${order.payment_status === 'pago' ? '#059669' : '#d97706'}; font-weight: 700;">${order.payment_status === 'pago' ? '✓ Pago / Concluído' : '⏳ Aguardando / Na Entrega'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    `;
                  })()}
                </div>
              `}
            </div>
          ` : currentTab === 'wishlist' ? `
            <div>
              <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--border-light);">
                <div style="display: flex; align-items: baseline; gap: 10px;">
                  <h2 style="font-family: var(--font-display); font-size: clamp(1.3rem, 3.5vw, 1.55rem); font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.02em;">
                    Meus Produtos Favoritos
                  </h2>
                  ${wishlistedProducts.length > 0 ? `
                    <span style="font-size: 0.95rem; color: var(--text-muted); font-weight: 600;">
                      (${wishlistedProducts.length} ${wishlistedProducts.length === 1 ? 'item' : 'itens'})
                    </span>
                  ` : ''}
                </div>
              </div>

              ${wishlistedProducts.length === 0 ? `
                <!-- Favoritos Vazio de Alto Padrão (Clean, Minimalista, Idêntico ao Carrinho Vazio) -->
                <div class="cart-empty-clean" style="text-align: center; padding: clamp(40px, 8vh, 80px) 16px; max-width: 440px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                  <!-- Ícone Sutil com Acabamento Refinado -->
                  <div style="width: 72px; height: 72px; border-radius: 50%; background: #eff6ff; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; color: var(--primary-600); border: 1px solid rgba(37,99,235,0.12);">
                    ${Icons.heart(32, 'var(--primary-600)')}
                  </div>

                  <h2 style="font-family: var(--font-display); font-size: clamp(1.3rem, 4vw, 1.55rem); font-weight: 800; color: var(--text-main); margin: 0 0 10px 0; letter-spacing: -0.02em;">
                    A sua lista de favoritos está vazia
                  </h2>

                  <p style="color: var(--text-secondary); font-size: clamp(0.875rem, 2.5vw, 0.9375rem); margin: 0 0 24px 0; line-height: 1.5; max-width: 360px;">
                    Ainda não adicionou nenhum artigo aos favoritos. Explore e acesse o catálogo.
                  </p>

                  <a href="#/catalogo" class="btn btn-primary" style="padding: 13px 32px; font-weight: 700; border-radius: 8px; font-size: 0.9375rem; display: inline-flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(37,99,235,0.22); min-height: 46px; width: 100%; max-width: 240px;">
                    <span>Acessar Catálogo</span>
                    ${Icons.chevronRight(16)}
                  </a>
                </div>
              ` : `
                <div class="products-grid" id="accountWishlistGrid">
                  <!-- Inserido dinamicamente via createProductCard -->
                </div>
              `}
            </div>
          ` : currentTab === 'profile' ? `
            <div style="display:flex; flex-direction:column; gap:18px;">
              <!-- Header Corporativo do Perfil do Cliente -->
              <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:20px 24px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; box-shadow:0 1px 3px rgba(15,23,42,0.04);">
                <div style="display:flex; align-items:center; gap:16px;">
                  <div style="width:52px; height:52px; border-radius:10px; background:#0f172a; color:#ffffff; font-size:1.25rem; font-weight:800; display:flex; align-items:center; justify-content:center; letter-spacing:0.05em; flex-shrink:0;">
                    ${user.name ? user.name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() : 'CL'}
                  </div>
                  <div>
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                      <h2 style="font-size:1.25rem; font-weight:800; color:#0f172a; margin:0;">${user.name || 'Cliente'}</h2>
                      <span class="badge" style="background:#f1f5f9; color:#0f172a; font-size:0.6875rem; font-weight:700; border:1px solid #e2e8f0; padding:2px 8px; border-radius:5px;">
                        Conta Ativa
                      </span>
                    </div>
                    <div style="font-size:0.875rem; color:#64748b; margin-top:2px;">
                      ${user.email || ''}
                    </div>
                  </div>
                </div>

                <div>
                  <span class="badge" style="background:#f8fafc; color:#475569; border:1px solid #e2e8f0; font-size:0.75rem; font-weight:600; padding:4px 10px; border-radius:6px;">
                    Cliente Registrado
                  </span>
                </div>
              </div>

              <!-- Card Unificado de Perfil do Cliente -->
              <div class="acc-profile-card">
                <div class="acc-profile-subnav">
                  <button
                    type="button"
                    class="acc-profile-subtab-btn ${profileSubTab === 'data' ? 'active' : ''}"
                    data-acc-subtab="data"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span>Dados Cadastrais & Endereço</span>
                  </button>

                  <button
                    type="button"
                    class="acc-profile-subtab-btn ${profileSubTab === 'security' ? 'active' : ''}"
                    data-acc-subtab="security"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    <span>Segurança de Acesso</span>
                  </button>
                </div>

                <!-- Conteúdo da Sub-Aba -->
                ${profileSubTab === 'data' ? `
                  <!-- SUB-ABA 1: DADOS CADASTRAIS & ENDEREÇO SEPARADO -->
                  <div class="acc-profile-body">
                    <form id="profileForm" onsubmit="event.preventDefault();" style="display:flex; flex-direction:column; gap:18px;">
                      <!-- Seção 1: Dados Pessoais -->
                      <div>
                        <h4 style="font-size:0.875rem; font-weight:800; color:#0f172a; margin:0 0 12px 0; text-transform:uppercase; letter-spacing:0.04em;">Informações Pessoais</h4>
                        <div class="form-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                          <div class="form-group" style="grid-column: span 2;">
                            <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Nome Completo <span style="color:#ef4444;">*</span></label>
                            <input type="text" id="profName" class="form-input" value="${user.name || ''}" placeholder="Seu nome completo" required style="height:42px; font-size:16px; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                          </div>

                          <div class="form-group">
                            <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">E-mail Cadastrado</label>
                            <input type="email" id="profEmail" class="form-input" value="${user.email || ''}" readonly style="height:42px; font-size:16px; border-radius:8px; border:1px solid #e2e8f0; background:#f8fafc; color:#64748b; width:100%; box-sizing:border-box; padding:8px 12px; cursor:not-allowed;" />
                          </div>

                          <div class="form-group">
                            <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Telefone / Telemóvel <span style="color:#ef4444;">*</span></label>
                            <input type="tel" id="profPhone" class="form-input" value="${user.phone || ''}" placeholder="+244 923 000 000" required style="height:42px; font-size:16px; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                          </div>

                          <div class="form-group" style="grid-column: span 2;">
                            <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">WhatsApp para Notificações</label>
                            <input type="tel" id="profWA" class="form-input" value="${user.whatsapp || user.phone || ''}" placeholder="+244 923 000 000" style="height:42px; font-size:16px; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                          </div>
                        </div>
                      </div>

                      <!-- Seção 2: Endereço de Entrega Separado -->
                      <div style="border-top:1px solid #f1f5f9; padding-top:16px;">
                        <h4 style="font-size:0.875rem; font-weight:800; color:#0f172a; margin:0 0 12px 0; text-transform:uppercase; letter-spacing:0.04em;">Endereço de Entrega em Angola</h4>
                        <div class="form-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                          <div class="form-group">
                            <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Província <span style="color:#ef4444;">*</span></label>
                            <select id="profProvincia" class="form-input" style="height:42px; font-size:16px; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px; background:#ffffff;">
                              ${ANGOLA_PROVINCES.map(p => `
                                <option value="${p}" ${(user.provincia || 'Luanda') === p ? 'selected' : ''}>${p}</option>
                              `).join('')}
                            </select>
                          </div>

                          <div class="form-group">
                            <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Município / Cidade <span style="color:#ef4444;">*</span></label>
                            <input type="text" id="profCity" class="form-input" value="${user.cidade || ''}" placeholder="Ex: Talatona, Maianga, Belas..." style="height:42px; font-size:16px; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                          </div>

                          <div class="form-group">
                            <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Bairro <span style="color:#ef4444;">*</span></label>
                            <input type="text" id="profNeighborhood" class="form-input" value="${user.bairro || ''}" placeholder="Ex: Morro Bento, Alvalade..." style="height:42px; font-size:16px; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                          </div>

                          <div class="form-group">
                            <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Rua / Avenida <span style="color:#ef4444;">*</span></label>
                            <input type="text" id="profStreet" class="form-input" value="${user.rua || ''}" placeholder="Ex: Rua Principal nº 12" style="height:42px; font-size:16px; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                          </div>

                          <div class="form-group" style="grid-column: span 2;">
                            <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Número / Edifício / Apto</label>
                            <input type="text" id="profNumber" class="form-input" value="${user.numero || ''}" placeholder="Ex: Casa nº 14 / Edifício Acácias, Apt 3B" style="height:42px; font-size:16px; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                          </div>

                          <div class="form-group" style="grid-column: span 2;">
                            <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Ponto de Referência</label>
                            <input type="text" id="profReference" class="form-input" value="${user.ponto_referencia || ''}" placeholder="Ex: Próximo à bomba Sonangol, em frente ao supermercado..." style="height:42px; font-size:16px; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                          </div>
                        </div>
                      </div>

                      <div class="acc-profile-action-row" style="margin-top:8px;">
                        <button type="submit" id="saveProfileBtn" class="btn btn-primary" style="padding:11px 24px; font-weight:700; font-size:0.875rem; border-radius:8px;">
                          Salvar Dados Cadastrais
                        </button>
                      </div>
                    </form>
                  </div>
                ` : `
                  <!-- SUB-ABA 2: SEGURANÇA DE ACESSO -->
                  <div class="acc-profile-body">
                    <form id="customerPasswordForm" style="display:flex; flex-direction:column; gap:16px; max-width:680px;">
                      <div class="form-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                        <div class="form-group">
                          <label class="form-label" for="profNewPass" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Nova Senha <span style="color:#ef4444;">*</span></label>
                          <input type="password" id="profNewPass" class="form-input" placeholder="Mínimo 6 caracteres" autocomplete="new-password" required minlength="6" style="height:42px; font-size:16px; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                        </div>

                        <div class="form-group">
                          <label class="form-label" for="profNewPassConfirm" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Confirmar Nova Senha <span style="color:#ef4444;">*</span></label>
                          <input type="password" id="profNewPassConfirm" class="form-input" placeholder="Repita a nova senha" autocomplete="new-password" required minlength="6" style="height:42px; font-size:16px; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                        </div>
                      </div>

                      <div class="acc-profile-action-row">
                        <button type="submit" id="saveCustomerPasswordBtn" class="btn btn-primary" style="padding:11px 24px; font-weight:700; font-size:0.875rem; border-radius:8px;">
                          Atualizar Senha de Acesso
                        </button>
                      </div>
                    </form>
                  </div>
                `}
              </div>
            </div>
          ` : `
            <!-- Aba Endereços -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; box-shadow: 0 1px 3px rgba(15,23,42,0.04);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                <div>
                  <h2 style="font-family: var(--font-display); font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">
                    Endereço Oficial de Entrega
                  </h2>
                  <p style="color: #64748b; font-size: 0.875rem; margin: 0;">
                    Local utilizado por padrão nos seus pedidos e entregas.
                  </p>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="editAddressQuickBtn" style="border-radius: 8px; font-weight: 600;">
                  ✏️ Editar Endereço
                </button>
              </div>

              <div style="border: 1px solid #cbd5e1; border-radius: 10px; padding: 20px; background: #f8fafc; position: relative;">
                <span class="badge" style="background: #0f172a; color: #ffffff; position: absolute; top: 16px; right: 16px; font-size: 0.6875rem; padding: 3px 8px; border-radius: 4px;">PADRÃO</span>
                <h4 style="font-weight: 800; color: #0f172a; margin: 0 0 12px 0; font-size: 1rem;">
                  ${user.name || 'Cliente'}
                </h4>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 0.875rem; color: #334155;">
                  <div>
                    <span style="font-size: 0.75rem; color: #64748b; display: block; font-weight: 600;">Província</span>
                    <strong>${user.provincia || 'Luanda'}</strong>
                  </div>
                  <div>
                    <span style="font-size: 0.75rem; color: #64748b; display: block; font-weight: 600;">Município / Cidade</span>
                    <strong>${user.cidade || 'Não informado'}</strong>
                  </div>
                  <div>
                    <span style="font-size: 0.75rem; color: #64748b; display: block; font-weight: 600;">Bairro</span>
                    <strong>${user.bairro || 'Não informado'}</strong>
                  </div>
                  <div>
                    <span style="font-size: 0.75rem; color: #64748b; display: block; font-weight: 600;">Rua / Número</span>
                    <strong>${[user.rua, user.numero].filter(Boolean).join(', ') || user.endereco || 'Não informado'}</strong>
                  </div>
                </div>

                ${user.ponto_referencia ? `
                  <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 0.875rem; color: #475569;">
                    <strong style="color: #0f172a;">📍 Ponto de Referência:</strong> ${user.ponto_referencia}
                  </div>
                ` : ''}

                <div style="margin-top: 12px; font-size: 0.875rem; color: #475569;">
                  <strong style="color: #0f172a;">📞 Contato para Entrega:</strong> ${user.phone || 'Não informado'} ${user.whatsapp ? `(WhatsApp: ${user.whatsapp})` : ''}
                </div>
              </div>
            </div>
          `}
        </main>
      </div>
    `;

    // Renderizar Cards de Favoritos
    if (currentTab === 'wishlist') {
      const grid = container.querySelector('#accountWishlistGrid');
      if (grid) {
        wishlistedProducts.forEach(p => grid.appendChild(createProductCard(p)));
      }
    }

    attachAccountEvents();
  }

  function getStatusStepIndex(status) {
    const canonical = normalizeOrderStatus(status);
    switch (canonical) {
      case 'received':
        return 0;
      case 'confirmed':
        return 1;
      case 'preparing':
        return 2;
      case 'shipped':
        return 4;
      case 'delivered':
        return 5;
      case 'cancelled':
        return -1;
      default:
        return 1;
    }
  }

  function attachAccountEvents() {
    container.querySelectorAll('[data-acc-tab]').forEach(item => {
      item.onclick = () => {
        currentTab = item.dataset.accTab;
        render();
      };
    });

    // Abrir Visão Detalhada ao Clicar no Item da Lista Compacta
    container.querySelectorAll('[data-select-order-id]').forEach(card => {
      card.onclick = () => {
        const orderId = card.getAttribute('data-select-order-id');
        if (orderId) {
          activeOrderId = orderId;
          render();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };
    });

    // Voltar para a Lista Compacta de Pedidos
    const backBtn = container.querySelector('#btnBackToOrdersList');
    if (backBtn) {
      backBtn.onclick = () => {
        activeOrderId = null;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    }

    // Copiar Código do Pedido com Toast
    container.querySelectorAll('[data-copy-order-code]').forEach(badge => {
      badge.onclick = (e) => {
        e.stopPropagation();
        const code = badge.getAttribute('data-copy-order-code');
        if (code) {
          navigator.clipboard.writeText(code).then(() => {
            Toast.show(`Código do pedido ${code} copiado!`, 'success');
          }).catch(() => {
            Toast.show(`Pedido: ${code}`, 'info');
          });
        }
      };
    });

    // Comprar Novamente (Adiciona produto ao carrinho)
    container.querySelectorAll('.btn-buy-again').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const name = btn.getAttribute('data-buy-item-name') || 'Produto';
        const price = Number(btn.getAttribute('data-buy-item-price') || 0);
        const img = btn.getAttribute('data-buy-item-img') || '';
        const id = btn.getAttribute('data-buy-item-id') || Date.now();

        Storage.addToCart({ id, name, price, image: img }, 1);
        Toast.show(`"${name}" foi adicionado ao seu carrinho de compras!`, 'success');
      };
    });

    // Abrir Modal Estético de Avaliação de Produto
    container.querySelectorAll('[data-review-prod-id]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const productId = btn.getAttribute('data-review-prod-id');
        const productName = btn.getAttribute('data-review-prod-name') || 'Produto';
        const productImage = btn.getAttribute('data-review-prod-img') || '';
        showProductReviewModal({ productId, productName, productImage });
      };
    });

    // Visualizar Recibo / Fatura Comercial (Dados 100% Reais)
    container.querySelectorAll('.btn-view-invoice-action').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const code = btn.getAttribute('data-order-code');
        const idx = btn.getAttribute('data-order-idx');
        let order = null;
        if (code) {
          order = ordersList.find(o => String(o.order_code) === String(code) || String(o.codigo_pedido) === String(code) || String(o.id) === String(code));
        }
        if (!order && idx !== null && idx !== undefined && ordersList[Number(idx)]) {
          order = ordersList[Number(idx)];
        }
        if (!order && activeOrderId) {
          order = ordersList.find(o => String(o.id) === String(activeOrderId) || String(o.order_code) === String(activeOrderId) || String(o.codigo_pedido) === String(activeOrderId));
        }
        if (!order) {
          order = ordersList[0];
        }
        if (order) {
          showInvoiceModal(order, Storage.getUser());
        }
      };
    });

    // Confirmação de recebimento pelo cliente (FASE 10)
    container.querySelectorAll('.btn-confirm-delivery').forEach(btn => {
      btn.onclick = async (e) => {
        e.preventDefault();
        const orderId = btn.dataset.orderId;
        const orderCode = btn.dataset.orderCode || orderId;

        if (!confirm(`Confirma que você recebeu o pedido #${orderCode} em mãos com todos os itens em conformidade?`)) {
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Processando confirmação...';

        try {
          await Api.orders.confirmDelivery(orderId, Storage.getUser());
          Toast.show(`Recebimento do pedido #${orderCode} confirmado com sucesso!`, 'success');
          await syncRealData();
        } catch (err) {
          Toast.show(err.message || 'Erro ao confirmar entrega.', 'error');
          btn.disabled = false;
          btn.textContent = '✓ Confirmar Recebimento';
        }
      };
    });

    // Alternância de Sub-Abas do Perfil do Cliente
    container.querySelectorAll('.acc-profile-subtab-btn').forEach(btn => {
      btn.onclick = () => {
        const targetSub = btn.dataset.accSubtab;
        if (targetSub && targetSub !== profileSubTab) {
          profileSubTab = targetSub;
          render();
        }
      };
    });

    const logoutBtn = container.querySelector('#accLogoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        try {
          await Api.auth.logout();
        } catch {}
        Storage.logoutUser();
        window.location.hash = '/';
      };
    }

    const refreshBtn = container.querySelector('#refreshOrdersBtn');
    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = 'Carregando...';
        await syncRealData();
        Toast.show('Status de pedidos atualizado!', 'success');
      };
    }

    const editAddrBtn = container.querySelector('#editAddressQuickBtn');
    if (editAddrBtn) {
      editAddrBtn.onclick = () => {
        currentTab = 'profile';
        profileSubTab = 'data';
        render();
        const input = container.querySelector('#profStreet') || container.querySelector('#profProvincia');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
    }

    // Formulário de Dados Cadastrais do Cliente com Campos Separados
    const profForm = container.querySelector('#profileForm');
    if (profForm) {
      profForm.onsubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const u = Storage.getUser() || {};
        const newName = container.querySelector('#profName')?.value.trim() || u.name;
        const newPhone = container.querySelector('#profPhone')?.value.trim() || u.phone;
        const newWA = container.querySelector('#profWA')?.value.trim() || newPhone;
        const newProvincia = container.querySelector('#profProvincia')?.value || 'Luanda';
        const newCity = container.querySelector('#profCity')?.value.trim() || '';
        const newNeighborhood = container.querySelector('#profNeighborhood')?.value.trim() || '';
        const newStreet = container.querySelector('#profStreet')?.value.trim() || '';
        const newNumber = container.querySelector('#profNumber')?.value.trim() || '';
        const newRef = container.querySelector('#profReference')?.value.trim() || '';

        const fullAddr = [newStreet, newNumber, newNeighborhood, newCity, newProvincia].filter(Boolean).join(', ');

        const saveBtn = container.querySelector('#saveProfileBtn');
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = 'Salvando dados...';
        }

        u.name = newName;
        u.phone = newPhone;
        u.whatsapp = newWA;
        u.provincia = newProvincia;
        u.cidade = newCity;
        u.bairro = newNeighborhood;
        u.rua = newStreet;
        u.numero = newNumber;
        u.endereco = fullAddr;
        u.ponto_referencia = newRef;

        try {
          await Api.auth.updateProfile(u);
          Storage.saveUser(u);
          Toast.show({ title: 'Dados cadastrais e endereço salvos com sucesso!', type: 'success' });
          render();
        } catch (err) {
          Toast.show({ title: 'Erro ao salvar dados', message: err.message, type: 'error' });
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Salvar Dados Cadastrais';
          }
        }
      };
    }

    // Formulário de Alteração de Senha do Cliente
    const custPwdForm = container.querySelector('#customerPasswordForm');
    if (custPwdForm) {
      custPwdForm.onsubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const newPass = container.querySelector('#profNewPass')?.value || '';
        const newPassConfirm = container.querySelector('#profNewPassConfirm')?.value || '';

        if (newPass.length < 6) {
          Toast.show({ title: 'A nova senha deve ter no mínimo 6 caracteres.', type: 'error' });
          return;
        }
        if (newPass !== newPassConfirm) {
          Toast.show({ title: 'As senhas digitadas não coincidem.', type: 'error' });
          return;
        }

        const saveBtn = container.querySelector('#saveCustomerPasswordBtn');
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = 'Atualizando senha...';
        }

        try {
          await Api.auth.updatePassword(newPass);
          Toast.show({ title: 'Senha de acesso atualizada com sucesso!', type: 'success' });
          custPwdForm.reset();
        } catch (err) {
          Toast.show({ title: 'Erro ao atualizar senha', message: err.message, type: 'error' });
        } finally {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Atualizar Senha de Acesso';
          }
        }
      };
    }
  }

  // Sincroniza dados reais em segundo plano
  syncRealData();

  render();
  return container;
}



// ===================================================================
// MODAL DE FATURA COMERCIAL & RECIBO OFICIAL (ENTERPRISE E-COMMERCE)
// ===================================================================
function showInvoiceModal(order, user = {}) {
  const existing = document.querySelector('.invoice-modal-overlay');
  if (existing) existing.remove();

  const orderCode = order.order_code || order.codigo_pedido || order.id;
  const orderDate = order.date || order.created_at || order.criado_em;
  const items = order.items || order.itens_pedido || [];
  const isPaid = order.payment_status === 'pago';
  const isFreeShipping = Number(order.shipping_price || 0) === 0 || Number(order.total || 0) >= 100000;

  const overlay = document.createElement('div');
  overlay.className = 'invoice-modal-overlay';
  overlay.innerHTML = `
    <div class="invoice-modal-card" id="invoicePrintArea">
      <!-- Top Header da Fatura -->
      <div class="invoice-header">
        <div>
          <div style="font-family: var(--font-display); font-size: 1.4rem; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">
            NOVA<span style="color: var(--primary-600);">TECH</span> ANGOLA
          </div>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">
            Comprovativo Oficial de Compra • Loja Online
          </div>
          <div style="font-size: 0.75rem; color: #64748b;">
            Luanda, Angola • contacto@novatech.co.ao • +244 923 179 192
          </div>
        </div>

        <div style="text-align: right;">
          <span class="badge" style="background: ${isPaid ? '#ecfdf5' : '#fffbeb'}; color: ${isPaid ? '#065f46' : '#92400e'}; border: 1px solid ${isPaid ? '#a7f3d0' : '#fde68a'}; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 6px;">
            ${isPaid ? '✓ PAGAMENTO LIQUIDADO' : '⏳ PAGAMENTO PENDENTE'}
          </span>
          <div style="font-family: monospace; font-size: 0.95rem; font-weight: 800; color: #0f172a; margin-top: 6px;">
            ${orderCode}
          </div>
          <div style="font-size: 0.75rem; color: #64748b;">
            Data: ${formatDate(orderDate)}
          </div>
        </div>
      </div>

      <!-- Corpo da Fatura -->
      <div class="invoice-body">
        <!-- Dados do Cliente e Envio -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.8125rem;">
          <div>
            <span style="font-weight: 800; text-transform: uppercase; color: #64748b; font-size: 0.6875rem; display: block; margin-bottom: 4px;">
              CLIENTE / DESTINATÁRIO
            </span>
            <div style="font-weight: 800; color: #0f172a; font-size: 0.9375rem;">
              ${order.customer_name || user.name || 'Cliente'}
            </div>
            ${(order.customer_email || user.email) ? `
              <div style="color: #475569; margin-top: 2px;">
                ${order.customer_email || user.email}
              </div>
            ` : ''}
            ${(order.customer_phone || user.phone) ? `
              <div style="color: #475569;">
                Tel: ${order.customer_phone || user.phone}
              </div>
            ` : ''}
          </div>

          <div>
            <span style="font-weight: 800; text-transform: uppercase; color: #64748b; font-size: 0.6875rem; display: block; margin-bottom: 4px;">
              ENDEREÇO DE ENTREGA (LUANDA)
            </span>
            <div style="color: #0f172a; font-weight: 700;">
              ${order.shipping_address || 'Morada indicada na encomenda'}
            </div>
            ${order.ponto_referencia ? `
              <div style="color: #64748b; font-size: 0.75rem; margin-top: 2px;">
                Ref: ${order.ponto_referencia}
              </div>
            ` : ''}
            <div style="color: #64748b; font-size: 0.75rem; margin-top: 4px;">
              Método: ${order.payment_method || 'Pagamento na Entrega (TPA / Dinheiro)'}
            </div>
          </div>
        </div>

        <!-- Tabela de Itens Comprados -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 0.875rem;">
          <thead>
            <tr style="border-bottom: 2px solid #e2e8f0; text-align: left; color: #64748b; font-size: 0.75rem; text-transform: uppercase;">
              <th style="padding: 10px 8px;">Descrição do Artigo</th>
              <th style="padding: 10px 8px; text-align: center;">Qtd</th>
              <th style="padding: 10px 8px; text-align: right;">Preço Unit.</th>
              <th style="padding: 10px 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => {
              const name = item.product_name || item.name || 'Produto';
              const price = Number(item.unit_price || item.price || 0);
              const qty = Number(item.quantity || 1);
              return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 8px; font-weight: 600; color: #0f172a;">
                    ${name}
                  </td>
                  <td style="padding: 12px 8px; text-align: center; color: #475569;">
                    ${qty}
                  </td>
                  <td style="padding: 12px 8px; text-align: right; color: #475569;">
                    ${formatPrice(price)}
                  </td>
                  <td style="padding: 12px 8px; text-align: right; font-weight: 800; color: #0f172a;">
                    ${formatPrice(price * qty)}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- Resumo Financeiro da Fatura -->
        <div style="display: flex; justify-content: flex-end;">
          <div style="width: 100%; max-width: 320px; font-size: 0.875rem;">
            <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #64748b;">
              <span>Subtotal:</span>
              <strong style="color: #0f172a;">${formatPrice(order.subtotal || (order.total - (order.shipping_price || 0)))}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #64748b;">
              <span>Frete / Entrega em Luanda:</span>
              <strong style="color: #0f172a;">
                ${isFreeShipping ? '<span style="color:#059669;">Grátis</span>' : formatPrice(order.shipping_price || 0)}
              </strong>
            </div>
            ${order.discount > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #16a34a;">
                <span>Desconto Especial:</span>
                <strong>-${formatPrice(order.discount)}</strong>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; padding: 10px 0 4px 0; margin-top: 6px; border-top: 2px solid #0f172a; font-size: 1.15rem; font-weight: 900; color: #0f172a;">
              <span>Total Pago:</span>
              <span>${formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        <!-- Termo de Garantia e Autenticidade -->
        <div style="margin-top: 28px; padding: 12px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 0.75rem; color: #166534; line-height: 1.5;">
          🛡️ <strong>Garantia Oficial NovaTech:</strong> Todos os artigos possuem garantia de 3 meses (90 dias) contra defeitos de fabricação a partir da data de receção da encomenda. Guarde este comprovativo.
        </div>
      </div>

      <!-- Ações do Rodapé -->
      <div class="invoice-footer">
        <button type="button" class="btn btn-secondary" id="closeInvoiceBtn" style="font-size: 0.875rem;">
          Fechar
        </button>
        <button type="button" class="btn btn-primary" id="printInvoiceBtn" style="font-size: 0.875rem; display: inline-flex; align-items: center; gap: 6px;">
          🖨️ Imprimir / Guardar PDF
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#closeInvoiceBtn').onclick = () => overlay.remove();
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };

  overlay.querySelector('#printInvoiceBtn').onclick = () => {
    window.print();
  };
}
