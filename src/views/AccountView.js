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

export function renderAccountView(initialTab = 'orders') {
  const container = document.createElement('div');
  container.className = 'container';

  let currentTab = initialTab; // 'orders' | 'profile' | 'wishlist' | 'addresses'
  let profileSubTab = 'data'; // 'data' | 'security'
  // IMPORTANTE: Inicia com lista vazia. Nunca usa Storage.getOrders() diretamente
  // pois aquele cache é compartilhado e pode conter pedidos de outros usuários.
  // A fonte de verdade é sempre o Supabase via Api.orders.getMyOrders().
  let ordersList = [];
  let availableProducts = [];
  let isSyncing = false;

  async function syncRealData() {
    const user = Storage.getUser();
    if (!user) {
      // Sem usuário logado: lista vazia (nunca mostrar pedidos do cache compartilhado)
      ordersList = [];
      render();
      return;
    }

    isSyncing = true;
    try {
      const [fetchedOrders, fetchedProducts] = await Promise.all([
        // Supabase = fonte de verdade. Fallback = lista vazia (nunca cache compartilhado)
        Api.orders.getMyOrders({ userId: user.id, userEmail: user.email }).catch(e => {
          console.warn('Erro ao buscar pedidos do usuário:', e.message);
          return [];
        }),
        Api.products.getAll({ all: true }).catch(() => [])
      ]);

      if (Array.isArray(fetchedOrders)) {
        ordersList = fetchedOrders;
      }
      if (Array.isArray(fetchedProducts)) {
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

  function render() {
    const user = Storage.getUser();

    // Se o cliente não estiver logado, exibe tela de login / cadastro
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
            Inicie sessão ou crie uma conta gratuita com seu e-mail e senha para acompanhar os seus pedidos, visualizar o rastreamento em tempo real e gerenciar seus favoritos.
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

    const wishlistIds = Storage.getWishlist();
    const wishlistedProducts = availableProducts.filter(p =>
      wishlistIds.includes(p.id) || wishlistIds.includes(String(p.id)) || wishlistIds.includes(Number(p.id))
    );

    container.innerHTML = `
      <div style="margin-top: 32px; margin-bottom: 28px;">
        <h1 style="font-family: var(--font-display); font-size: 2rem; font-weight: 900; color: var(--text-main);">
          Área do Cliente
        </h1>
        <p style="color: var(--text-secondary); font-size: 0.9375rem;">
          Gerencie os seus pedidos, dados pessoais, endereço de entrega e produtos favoritos.
        </p>
      </div>

      <div class="admin-layout">
        <!-- Menu Lateral do Cliente -->
        <aside class="admin-sidebar">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid var(--border-light); margin-bottom: 16px;">
            <div style="width: 60px; height: 60px; border-radius: 50%; background: var(--primary-100); color: var(--primary-700); display: flex; align-items: center; justify-content: center; margin: 0 auto 10px auto; font-weight: 800; font-size: 1.5rem;">
              ${user.name ? user.name.split(' ')[0].charAt(0).toUpperCase() : 'U'}
            </div>
            <h3 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin-bottom: 2px;">
              ${user.name ? user.name.split(' ')[0] : 'Cliente'}
            </h3>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${user.email || ''}</span>
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
            <li class="admin-menu-item" id="accLogoutBtn" style="color: var(--accent-rose); margin-top: 12px; border-top: 1px solid var(--border-light); padding-top: 14px;">
              ${Icons.close(18)}
              <span>Terminar Sessão</span>
            </li>
          </ul>
        </aside>

        <!-- Conteúdo Principal da Aba -->
        <main>
          ${currentTab === 'orders' ? `
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; color: var(--text-main);">
                  Histórico de Encomendas & Rastreamento
                </h2>
                <button class="btn btn-secondary btn-sm" id="refreshOrdersBtn" title="Atualizar status dos pedidos">
                  ${Icons.refresh ? Icons.refresh(14) : '⟳'} Atualizar Status
                </button>
              </div>

              ${ordersList.length === 0 ? `
                <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 64px 24px; text-align: center;">
                  <div style="margin-bottom: 16px; opacity: 0.35;">
                    ${Icons.package(48, 'var(--text-muted)')}
                  </div>
                  <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">
                    Nenhum pedido realizado ainda
                  </h3>
                  <p style="color: var(--text-secondary); font-size: 0.9375rem; max-width: 440px; margin: 0 auto 24px auto; line-height: 1.6;">
                    Assim que você finalizar a sua primeira compra, o histórico detalhado com timeline e rastreamento em tempo real aparecerão aqui.
                  </p>
                  <a href="#/" class="btn btn-primary" style="padding: 12px 28px;">
                    Explorar Produtos
                  </a>
                </div>
              ` : `
                <div style="display: flex; flex-direction: column; gap: 24px;">
                  ${ordersList.map(order => {
                    const statusIndex = getStatusStepIndex(order.status || order.status_pedido);
                    const isCancelled = (order.status || order.status_pedido) === 'cancelled' || (order.status || order.status_pedido) === 'cancelado';
                    const orderCode = order.order_code || order.codigo_pedido || order.id;
                    const items = order.items || order.itens_pedido || [];

                    return `
                      <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 24px; box-shadow: var(--shadow-xs);">
                        <!-- Cabeçalho do Pedido -->
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 16px; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                          <div>
                            <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.05em;">Código do Pedido</span>
                            <div style="font-family: var(--font-display); font-size: 1.25rem; font-weight: 800; color: var(--primary-700);">${orderCode}</div>
                            <span style="font-size: 0.8125rem; color: var(--text-secondary);">${formatDate(order.date || order.created_at || order.criado_em)}</span>
                          </div>

                          <div style="text-align: right;">
                            <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Valor Total</span>
                            <div style="font-family: var(--font-display); font-size: 1.25rem; font-weight: 800; color: var(--text-main);">${formatPrice(order.total)}</div>
                            <span style="font-size: 0.75rem; color: var(--text-secondary);">${order.payment_method || order.paymentMethod || 'Multicaixa'}</span>
                          </div>
                        </div>

                        ${isCancelled ? `
                          <div style="background: #fee2e2; border: 1px solid #fecaca; border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 16px; color: #991b1b; font-weight: 700; font-size: 0.875rem;">
                            ⚠️ Este pedido foi cancelado. Se tiver dúvidas, entre em contacto com o suporte.
                          </div>
                        ` : `
                          <!-- Timeline Visual do Rastreamento em Tempo Real -->
                          <div style="margin: 24px 0;">
                            <div class="order-timeline">
                              <div class="timeline-step ${statusIndex >= 0 ? 'completed' : ''}">
                                <div class="timeline-node">${statusIndex >= 1 ? Icons.check(14) : '1'}</div>
                                <span class="timeline-text">Recebido</span>
                              </div>
                              <div class="timeline-step ${statusIndex >= 1 ? 'completed' : statusIndex === 0 ? 'active' : ''}">
                                <div class="timeline-node">${statusIndex >= 2 ? Icons.check(14) : '2'}</div>
                                <span class="timeline-text">Pagamento</span>
                              </div>
                              <div class="timeline-step ${statusIndex >= 2 ? 'completed' : statusIndex === 1 ? 'active' : ''}">
                                <div class="timeline-node">${statusIndex >= 3 ? Icons.check(14) : '3'}</div>
                                <span class="timeline-text">Preparação</span>
                              </div>
                              <div class="timeline-step ${statusIndex >= 3 ? 'completed' : statusIndex === 2 ? 'active' : ''}">
                                <div class="timeline-node">${statusIndex >= 4 ? Icons.check(14) : '4'}</div>
                                <span class="timeline-text">Enviado</span>
                              </div>
                              <div class="timeline-step ${statusIndex >= 4 ? 'completed' : statusIndex === 3 ? 'active' : ''}">
                                <div class="timeline-node">${statusIndex >= 5 ? Icons.check(14) : '5'}</div>
                                <span class="timeline-text">Em Trânsito</span>
                              </div>
                              <div class="timeline-step ${statusIndex === 5 ? 'completed' : ''}">
                                <div class="timeline-node">${statusIndex === 5 ? Icons.check(14) : '6'}</div>
                                <span class="timeline-text">Entregue</span>
                              </div>
                            </div>
                          </div>
                        `}

                        <!-- Endereço de Entrega Registrado no Pedido -->
                        <div style="background: #f1f5f9; border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 16px; font-size: 0.8125rem; color: var(--text-secondary);">
                          <strong>Endereço de Entrega:</strong> ${order.shipping_address || order.endereco_entrega || 'Endereço fornecido no checkout'}
                          ${order.ponto_referencia ? `<br /><strong>Ponto de Referência:</strong> 📍 ${order.ponto_referencia}` : ''}
                        </div>

                        <!-- Itens do Pedido -->
                        <div style="background: #f8fafc; border-radius: var(--radius-sm); padding: 16px;">
                          <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-main); margin-bottom: 12px;">Itens da Encomenda (${items.length}):</div>
                          <div style="display: flex; flex-direction: column; gap: 10px;">
                            ${items.map(item => {
                              const name = item.product_name || item.name || 'Produto';
                              const img = item.product_image || item.image || '';
                              const price = Number(item.unit_price || item.price || 0);
                              const qty = Number(item.quantity || 1);

                              return `
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                                  <div style="display: flex; align-items: center; gap: 12px;">
                                    ${img ? `
                                      <img src="${img}" alt="${name}" style="width: 44px; height: 44px; object-fit: contain; background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-xs);" />
                                    ` : `
                                      <div style="width: 44px; height: 44px; background: #e2e8f0; border-radius: var(--radius-xs); display: flex; align-items: center; justify-content: center; color: var(--text-muted);">
                                        ${Icons.package(18)}
                                      </div>
                                    `}
                                    <div>
                                      <div style="font-size: 0.875rem; font-weight: 600; color: var(--text-main);">${name}</div>
                                      <div style="font-size: 0.75rem; color: var(--text-muted);">${qty} unidade(s) • ${formatPrice(price)}</div>
                                    </div>
                                  </div>
                                  <span style="font-weight: 700; font-size: 0.875rem;">${formatPrice(price * qty)}</span>
                                </div>
                              `;
                            }).join('')}
                          </div>
                        </div>

                        <!-- Ações do Cliente / Confirmação de Entrega (FASE 10) -->
                        ${normalizeOrderStatus(order.status || order.status_pedido) === 'shipped' ? `
                          <div style="margin-top: 16px; padding: 16px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
                            <div>
                              <div style="font-weight: 800; color: #1e40af; font-size: 0.9375rem; display: flex; align-items: center; gap: 6px;">
                                🚚 Sua encomenda está a caminho do seu endereço!
                              </div>
                              <p style="color: #3b82f6; font-size: 0.8125rem; margin: 4px 0 0 0;">
                                O estafeta já saiu para entrega. Quando receber o pacote, clique no botão ao lado para confirmar.
                              </p>
                            </div>
                            <button class="btn btn-primary btn-confirm-delivery" data-order-id="${order.id}" data-order-code="${orderCode}" style="background: #16a34a; border-color: #16a34a; padding: 10px 20px; font-weight: 800; font-size: 0.875rem; white-space: nowrap;">
                              ✓ Confirmar Recebimento do Pedido
                            </button>
                          </div>
                        ` : normalizeOrderStatus(order.status || order.status_pedido) === 'delivered' ? `
                          <div style="margin-top: 16px; padding: 12px 16px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: var(--radius-sm); color: #065f46; font-weight: 700; font-size: 0.875rem; display: flex; align-items: center; gap: 8px;">
                            <span>★ Encomenda entregue e finalizada com sucesso. Obrigado por confiar na NovaTech Angola!</span>
                          </div>
                        ` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          ` : currentTab === 'wishlist' ? `
            <div>
              <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin-bottom: 20px;">
                Meus Produtos Favoritos (${wishlistedProducts.length})
              </h2>

              ${wishlistedProducts.length === 0 ? `
                <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 48px 24px; text-align: center;">
                  <p style="color: var(--text-muted); margin-bottom: 16px;">Você ainda não favoritou nenhum produto cadastrado na loja.</p>
                  <a href="#/" class="btn btn-primary">Descobrir Produtos</a>
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
                        Conta Verificada
                      </span>
                    </div>
                    <div style="font-size:0.875rem; color:#64748b; margin-top:2px;">
                      ${user.email || ''}
                    </div>
                  </div>
                </div>

                <div>
                  <span class="badge" style="background:#f8fafc; color:#475569; border:1px solid #e2e8f0; font-size:0.75rem; font-weight:600; padding:4px 10px; border-radius:6px;">
                    Cliente NovaTech
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
                  <!-- SUB-ABA 1: DADOS CADASTRAIS & ENDEREÇO -->
                  <div class="acc-profile-body">
                    <div style="margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid #f1f5f9;">
                      <h3 style="font-size:1rem; font-weight:700; color:#0f172a; margin:0 0 4px 0;">Informações Pessoais & Endereço de Entrega</h3>
                      <p style="font-size:0.8125rem; color:#64748b; margin:0;">Estes dados são utilizados para faturamento e agendamento de entregas dos seus pedidos.</p>
                    </div>

                    <form id="profileForm" onsubmit="event.preventDefault();" style="display:flex; flex-direction:column; gap:16px;">
                      <div class="form-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                        <div class="form-group">
                          <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Nome Completo <span style="color:#ef4444;">*</span></label>
                          <input type="text" id="profName" class="form-input" value="${user.name || ''}" placeholder="Ex: Leonardo Adriano" required style="height:42px; font-size:0.875rem; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                        </div>

                        <div class="form-group">
                          <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">E-mail Cadastrado</label>
                          <input type="email" id="profEmail" class="form-input" value="${user.email || ''}" readonly style="height:42px; font-size:0.875rem; border-radius:8px; border:1px solid #e2e8f0; background:#f8fafc; color:#64748b; width:100%; box-sizing:border-box; padding:8px 12px; cursor:not-allowed;" />
                        </div>

                        <div class="form-group">
                          <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Telefone / Telemóvel <span style="color:#ef4444;">*</span></label>
                          <input type="tel" id="profPhone" class="form-input" value="${user.phone || ''}" placeholder="Ex: +244 923 000 000" required style="height:42px; font-size:0.875rem; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                        </div>

                        <div class="form-group">
                          <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">WhatsApp para Notificações</label>
                          <input type="tel" id="profWA" class="form-input" value="${user.whatsapp || user.phone || ''}" placeholder="Ex: +244 923 000 000" style="height:42px; font-size:0.875rem; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                        </div>

                        <div class="form-group" style="grid-column: span 2;">
                          <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Endereço Completo de Entrega</label>
                          <input type="text" id="profAddress" class="form-input" value="${user.endereco || ''}" placeholder="Ex: Província de Luanda, Município de Talatona, Bairro Morro Bento, Rua Principal nº 12" style="height:42px; font-size:0.875rem; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                        </div>

                        <div class="form-group" style="grid-column: span 2;">
                          <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Ponto de Referência</label>
                          <input type="text" id="profReference" class="form-input" value="${user.ponto_referencia || ''}" placeholder="Ex: Próximo à bomba Sonangol, em frente ao supermercado..." style="height:42px; font-size:0.875rem; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                        </div>
                      </div>

                      <div class="acc-profile-action-row">
                        <button type="submit" id="saveProfileBtn" class="btn btn-primary" style="padding:11px 24px; font-weight:700; font-size:0.875rem; border-radius:8px;">
                          Salvar Dados Cadastrais
                        </button>
                      </div>
                    </form>
                  </div>
                ` : `
                  <!-- SUB-ABA 2: SEGURANÇA DE ACESSO -->
                  <div class="acc-profile-body">
                    <div style="margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid #f1f5f9;">
                      <h3 style="font-size:1rem; font-weight:700; color:#0f172a; margin:0 0 4px 0;">Atualizar Senha de Acesso</h3>
                      <p style="font-size:0.8125rem; color:#64748b; margin:0;">Cadastre uma senha forte com no mínimo 6 caracteres para proteger sua conta e compras.</p>
                    </div>

                    <form id="customerPasswordForm" style="display:flex; flex-direction:column; gap:16px; max-width:680px;">
                      <div class="form-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                        <div class="form-group">
                          <label class="form-label" for="profNewPass" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Nova Senha <span style="color:#ef4444;">*</span></label>
                          <input type="password" id="profNewPass" class="form-input" placeholder="Mínimo 6 caracteres" autocomplete="new-password" required minlength="6" style="height:42px; font-size:0.875rem; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                        </div>

                        <div class="form-group">
                          <label class="form-label" for="profNewPassConfirm" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">Confirmar Nova Senha <span style="color:#ef4444;">*</span></label>
                          <input type="password" id="profNewPassConfirm" class="form-input" placeholder="Repita a nova senha" autocomplete="new-password" required minlength="6" style="height:42px; font-size:0.875rem; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
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
            <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 32px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                  <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; color: var(--text-main);">
                    Endereço Oficial de Entrega
                  </h2>
                  <p style="color: var(--text-secondary); font-size: 0.875rem;">
                    Local utilizado por padrão nos seus pedidos e entregas da NovaTech.
                  </p>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="editAddressQuickBtn">
                  ✏️ Atualizar Endereço
                </button>
              </div>

              <div style="border: 2px solid var(--primary-500); border-radius: var(--radius-sm); padding: 24px; background: var(--primary-50); position: relative;">
                <span class="badge" style="background: var(--primary-600); color: #ffffff; position: absolute; top: 16px; right: 16px;">ENDEREÇO OFICIAL</span>
                <h4 style="font-weight: 800; color: var(--text-main); margin-bottom: 8px; font-size: 1.0625rem;">
                  ${user.name || 'Cliente'}
                </h4>
                <div style="font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.8;">
                  <strong>Endereço Completo:</strong> ${user.endereco ? user.endereco : '<span style="color: #b91c1c;">Nenhum endereço cadastrado ainda.</span>'}<br />
                  <strong>Ponto de Referência:</strong> ${user.ponto_referencia ? `📍 ${user.ponto_referencia}` : '<span style="color: var(--text-muted);">Sem ponto de referência informado.</span>'}<br />
                  <strong>Telefone para Contato na Entrega:</strong> ${user.phone ? user.phone : '<span style="color: #b91c1c;">Não informado.</span>'}
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
          btn.textContent = '✓ Confirmar Recebimento do Pedido';
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
        const input = container.querySelector('#profAddress');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
    }

    // Formulário de Dados Cadastrais do Cliente
    const profForm = container.querySelector('#profileForm');
    if (profForm) {
      profForm.onsubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const u = Storage.getUser() || {};
        const newName = container.querySelector('#profName').value.trim();
        const newPhone = container.querySelector('#profPhone').value.trim();
        const newWA = container.querySelector('#profWA')?.value.trim() || newPhone;
        const newAddr = container.querySelector('#profAddress')?.value.trim() || '';
        const newRef = container.querySelector('#profReference')?.value.trim() || '';

        const saveBtn = container.querySelector('#saveProfileBtn');
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = 'Salvando dados...';
        }

        u.name = newName;
        u.phone = newPhone;
        u.whatsapp = newWA;
        u.endereco = newAddr;
        u.ponto_referencia = newRef;

        try {
          await Api.auth.updateProfile(u);
          Storage.saveUser(u);
          Toast.show({ title: 'Dados cadastrais atualizados com sucesso!', type: 'success' });
          render();
        } catch (err) {
          Toast.show({ title: 'Erro ao salvar dados cadastrais', message: err.message, type: 'error' });
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
