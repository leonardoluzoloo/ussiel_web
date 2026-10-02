// ===================================================================
// ADMIN DASHBOARD VIEW (Complete Operational Backoffice Suite)
// 10 Módulos de Administração Total • Mobile & Notebook Responsive
// ===================================================================

import { Icons } from '../utils/icons.js';
import { formatPrice, formatDate } from '../utils/format.js';
import { Storage } from '../services/storage.js';
import { Api } from '../services/api.js';
import { Toast } from '../components/Toast.js';
import { SCHEMA_SQL } from '../data/schemaSql.js';
import { isSupabaseConfigured } from '../services/supabaseClient.js';
import { createImageUploader } from '../utils/imageUpload.js';

export function renderAdminView() {
  const container = document.createElement('div');
  container.className = 'admin-backoffice-page';

  // Abas operacionais:
  // 'dashboard' | 'orders' | 'products' | 'categories' | 'catalogs' |
  // 'coupons' | 'customers' | 'stock' | 'banners' | 'settings' | 'database'
  let currentTab = 'dashboard';
  let isLoading = true;
  let systemStatus = { has_admin: true, total_admins: 1 };
  let dbCheckResult = null;
  let isCheckingDb = false;

  // Estados dos dados carregados
  let stats = null;
  let ordersList = [];
  let productsList = [];
  let categoriesList = [];
  let catalogsList = [];
  let couponsList = [];
  let customersList = [];
  let stockMovementsList = [];
  let bannersList = [];
  let storeSettings = {};

  // Filtros ativos
  let orderSearchQuery = '';
  let orderStatusFilter = 'all';
  let productSearchQuery = '';
  let productCategoryFilter = 'all';
  let productStockFilter = 'all';
  let customerSearchQuery = '';

  // 1. Inicialização e Checagem de Acesso
  async function init() {
    try {
      const statusRes = await Api.admin.getStatus();
      systemStatus = statusRes;
    } catch (e) {
      console.warn('Erro ao checar status:', e.message);
    }

    const currentUser = Storage.getUser();
    const token = Api.getToken();

    if (currentUser && token) {
      try {
        const me = await Api.auth.me();
        if (me) {
          Storage.saveUser(me);
          if (me.role === 'admin') {
            await loadAllData();
          }
        }
      } catch (err) {
        console.warn('Sessão expirada ou erro no perfil:', err.message);
      }
    }

    isLoading = false;
    render();
  }

  // 2. Carrega todos os módulos em paralelo
  async function loadAllData() {
    try {
      const [
        dashStats,
        allOrders,
        allProducts,
        allCats,
        allCatalogs,
        allCoupons,
        allCusts,
        allMovements,
        allBanners,
        settings
      ] = await Promise.all([
        Api.admin.getStats().catch(() => null),
        Api.orders.getAll().catch(() => []),
        Api.products.getAll({ all: true }).catch(() => []),
        Api.categories.getAll().catch(() => []),
        Api.catalogs.getAll().catch(() => []),
        Api.coupons.getAll().catch(() => []),
        Api.customers.getAll().catch(() => []),
        Api.stock.getMovements().catch(() => []),
        Api.banners.getAll().catch(() => []),
        Api.settings.get('general').catch(() => ({}))
      ]);

      stats = dashStats;
      ordersList = allOrders || [];
      productsList = allProducts || [];
      categoriesList = allCats || [];
      catalogsList = allCatalogs || [];
      couponsList = allCoupons || [];
      customersList = allCusts || [];
      stockMovementsList = allMovements || [];
      bannersList = allBanners || [];
      storeSettings = settings || {};
    } catch (err) {
      console.warn('Erro ao carregar dados operacionais:', err.message);
    }
  }

  // 3. Renderizador Principal
  function render() {
    container.innerHTML = '';
    const currentUser = Storage.getUser();
    const isAdmin = currentUser && currentUser.role === 'admin';

    if (isLoading) {
      container.innerHTML = `
        <div style="min-height: 480px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;">
          <div style="width: 44px; height: 44px; border: 4px solid var(--border-light); border-top-color: var(--primary-600); border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <span style="font-size: 0.9375rem; color: var(--text-muted); font-weight: 600;">Carregando Central de Operações da NovaTech...</span>
        </div>
      `;
      return;
    }

    if (!systemStatus.has_admin) {
      renderSetupScreen();
      return;
    }

    if (!isAdmin) {
      renderLoginScreen();
      return;
    }

    renderDashboardLayout();
  }

  // --- TELA DE CONFIGURAÇÃO DO PRIMEIRO ADMIN ---
  function renderSetupScreen() {
    container.innerHTML = `
      <div style="max-width: 580px; margin: 48px auto 80px auto; background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 40px 32px; box-shadow: var(--shadow-md);">
        <div style="text-align: center; margin-bottom: 28px;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: #eff6ff; color: var(--primary-600); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
            ${Icons.user(32)}
          </div>
          <span class="badge" style="background: var(--accent-emerald); color: #ffffff; margin-bottom: 8px;">PRIMEIRA CONFIGURAÇÃO</span>
          <h2 style="font-family: var(--font-display); font-size: 1.75rem; font-weight: 900; color: var(--text-main); margin-bottom: 8px;">
            Configurar Administrador Master
          </h2>
          <p style="color: var(--text-secondary); font-size: 0.9375rem; line-height: 1.6;">
            Bem-vindo à <strong>NovaTech Angola</strong>! Cadastre seus dados abaixo para ativar o controle total da loja.
          </p>
        </div>

        <form id="adminSetupForm" style="display: flex; flex-direction: column; gap: 16px;">
          <div class="form-group">
            <label class="form-label">Nome Completo</label>
            <input type="text" id="setupName" class="form-input" placeholder="Ex: Administrador Geral" required />
          </div>
          <div class="form-group">
            <label class="form-label">Seu E-mail de Acesso</label>
            <input type="email" id="setupEmail" class="form-input" placeholder="admin@novatech.co.ao" required />
          </div>
          <div class="form-group">
            <label class="form-label">Telefone / WhatsApp</label>
            <input type="tel" id="setupPhone" class="form-input" placeholder="+244 923 179 192" required />
          </div>
          <div class="form-group">
            <label class="form-label">Senha de Acesso</label>
            <input type="password" id="setupPassword" class="form-input" placeholder="Mínimo 6 caracteres" required />
          </div>
          <div class="form-group">
            <label class="form-label">Endereço Completo</label>
            <input type="text" id="setupEndereco" class="form-input" placeholder="Ex: Luanda, Talatona, Rua Principal, nº 10" />
          </div>
          <div class="form-group">
            <label class="form-label">Ponto de Referência</label>
            <input type="text" id="setupPontoReferencia" class="form-input" placeholder="Ex: Próximo ao Belas Shopping" />
          </div>

          <button type="submit" class="btn btn-primary btn-full" style="padding: 14px; font-weight: 800; font-size: 1rem; margin-top: 8px;">
            Criar Administrador e Iniciar Operação →
          </button>
        </form>

        <div style="margin-top: 24px; text-align: center;">
          <a href="#/" style="font-size: 0.8125rem; color: var(--text-muted); text-decoration: underline;">
            ← Voltar para a Loja
          </a>
        </div>
      </div>
    `;

    const form = container.querySelector('#adminSetupForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = container.querySelector('#setupName').value.trim();
      const email = container.querySelector('#setupEmail').value.trim();
      const phone = container.querySelector('#setupPhone').value.trim();
      const password = container.querySelector('#setupPassword').value;
      const endereco = container.querySelector('#setupEndereco')?.value.trim() || '';
      const pontoReferencia = container.querySelector('#setupPontoReferencia')?.value.trim() || '';

      try {
        const res = await Api.admin.setup(name, email, password, phone, { endereco, ponto_referencia: pontoReferencia });
        Storage.saveUser(res.user);
        Toast.show('Administrador Master criado com sucesso!', 'success');
        systemStatus.has_admin = true;
        await loadAllData();
        render();
      } catch (err) {
        Toast.show(err.message || 'Erro ao criar administrador.', 'error');
      }
    });
  }

  // --- TELA DE LOGIN DO ADMINISTRADOR ---
  function renderLoginScreen() {
    const currentUser = Storage.getUser();
    container.innerHTML = `
      <div style="max-width: 520px; margin: 48px auto 80px auto; background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 40px 32px; box-shadow: var(--shadow-md);">
        <div style="text-align: center; margin-bottom: 28px;">
          <div style="width: 60px; height: 60px; border-radius: 50%; background: #1e293b; color: #ffffff; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
            ${Icons.user(28)}
          </div>
          <span class="badge" style="background: var(--primary-600); color: #ffffff; margin-bottom: 8px;">ÁREA RESTRITA</span>
          <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 900; color: var(--text-main); margin-bottom: 8px;">
            Acesso ao Painel Administrativo
          </h2>
          <p style="color: var(--text-secondary); font-size: 0.875rem;">
            Entre com suas credenciais de Administrador da NovaTech.
          </p>
          ${(currentUser && currentUser.role !== 'admin') ? `
            <div style="margin-top: 16px; padding: 12px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: var(--radius-sm); font-size: 0.8125rem; color: #be123c;">
              Você está autenticado como <strong>${currentUser.email}</strong>, mas esta conta não possui privilégios de Administrador.
            </div>
          ` : ''}
        </div>

        <form id="adminLoginForm" style="display: flex; flex-direction: column; gap: 16px;">
          <div class="form-group">
            <label class="form-label">E-mail do Administrador</label>
            <input type="email" id="adminLogEmail" class="form-input" placeholder="admin@novatech.co.ao" required />
          </div>

          <div class="form-group">
            <label class="form-label">Senha</label>
            <input type="password" id="adminLogPassword" class="form-input" placeholder="••••••••" required />
          </div>

          <button type="submit" class="btn btn-primary btn-full" style="padding: 13px; font-weight: 700; margin-top: 4px;">
            Entrar na Central de Controle
          </button>
        </form>

        <div style="margin-top: 24px; text-align: center; font-size: 0.8125rem;">
          <a href="#/" style="color: var(--text-secondary); text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
            ← Voltar para a Loja Oficial
          </a>
        </div>
      </div>
    `;

    const form = container.querySelector('#adminLoginForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = container.querySelector('#adminLogEmail').value.trim();
      const password = container.querySelector('#adminLogPassword').value;

      try {
        const res = await Api.auth.login(email, password);
        Storage.saveUser(res.user);
        if (res.user.role === 'admin') {
          Toast.show(`Bem-vindo, ${res.user.name}!`, 'success');
          await loadAllData();
          render();
        } else {
          Toast.show('Conta autenticada, mas sem privilégios de Administrador.', 'warning');
          render();
        }
      } catch (err) {
        Toast.show(err.message || 'Erro ao realizar login.', 'error');
      }
    });
  }

  // --- LAYOUT DA CENTRAL DE CONTROLE CORPORATIVA ---
  function renderDashboardLayout() {
    const user = Storage.getUser();
    const lowStockCount = productsList.filter(p => (p.stock || 0) <= (p.stock_min || 2)).length;
    const pendingOrdersCount = ordersList.filter(o => o.status === 'received' || o.payment_status === 'pending').length;
    const userInitials = (user?.name || 'AD').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    container.innerHTML = `
      <!-- 1. Header Corporativo Executivo -->
      <header class="admin-enterprise-topbar">
        <div class="admin-enterprise-topbar-inner">
          <div class="admin-enterprise-brand-group">
            <button id="adminMobileDrawerToggleBtn" class="admin-mobile-drawer-btn" aria-label="Abrir Menu Administrativo" title="Menu de Módulos">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div class="admin-enterprise-brand">
              <div class="admin-brand-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </div>
              <div class="admin-brand-text">
                <span class="admin-brand-title">NOVATECH</span>
                <span class="admin-brand-subtitle">PAINEL ADMINISTRATIVO</span>
              </div>
            </div>
            <div class="admin-sys-status-pill">
              <span class="admin-status-dot"></span>
              <span>${isSupabaseConfigured() ? 'Supabase Conectado' : 'Operação Local Ativa'}</span>
            </div>
          </div>

          <div class="admin-enterprise-actions">
            <a href="#/" class="admin-topbar-btn admin-topbar-btn-store" title="Visualizar a loja oficial como cliente">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              <span>Ver Loja</span>
            </a>
            <button id="adminRefreshBtn" class="admin-topbar-btn" title="Sincronizar base de dados">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              <span class="desktop-only-txt">Sincronizar</span>
            </button>
            <button id="adminClearCacheBtn" class="admin-topbar-btn admin-topbar-btn-danger" title="Zerar e Limpar Base Local">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              <span class="desktop-only-txt">Limpar Base</span>
            </button>
            
            <div class="admin-profile-chip">
              <div class="admin-profile-avatar">${userInitials}</div>
              <div class="admin-profile-info">
                <span class="admin-profile-name">${user?.name || 'Administrador'}</span>
                <span class="admin-profile-role">Master Admin</span>
              </div>
              <button id="adminLogoutBtn" class="admin-logout-btn" title="Encerrar Sessão">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- 2. Drawer Lateral para Mobile (< 992px) -->
      <div class="admin-mobile-drawer-overlay" id="adminMobileDrawerOverlay"></div>
      <aside class="admin-mobile-drawer" id="adminMobileDrawer">
        <div class="admin-mobile-drawer-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="admin-brand-icon" style="width:30px; height:30px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <strong style="font-size:0.9375rem; color:#fff;">Módulos do Sistema</strong>
          </div>
          <button id="adminMobileDrawerCloseBtn" style="background:none; border:none; color:#94a3b8; font-size:1.25rem; cursor:pointer; padding:4px;">✕</button>
        </div>
        <div class="admin-mobile-drawer-content">
          <div class="admin-sidebar-group-title">Geral</div>
          <div class="admin-nav-item ${currentTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
            <div class="admin-nav-item-left">${Icons.grid(18)}<span>Visão Geral</span></div>
          </div>

          <div class="admin-sidebar-group-title" style="margin-top:12px;">Cadastros da Loja</div>
          <div class="admin-nav-item ${currentTab === 'products' ? 'active' : ''}" data-tab="products">
            <div class="admin-nav-item-left">${Icons.cpu(18)}<span>Produtos</span></div>
            <span class="admin-nav-pill-badge">${productsList.length}</span>
          </div>
          <div class="admin-nav-item ${currentTab === 'categories' ? 'active' : ''}" data-tab="categories">
            <div class="admin-nav-item-left">${Icons.grid(18)}<span>Categorias</span></div>
            <span class="admin-nav-pill-badge">${categoriesList.length}</span>
          </div>
          <div class="admin-nav-item ${currentTab === 'banners' ? 'active' : ''}" data-tab="banners">
            <div class="admin-nav-item-left">${Icons.heart ? Icons.heart(18) : '🖼️'}<span>Banners da Vitrine</span></div>
            <span class="admin-nav-pill-badge">${bannersList.length}</span>
          </div>
          <div class="admin-nav-item ${currentTab === 'catalogs' ? 'active' : ''}" data-tab="catalogs">
            <div class="admin-nav-item-left">${Icons.tag(18)}<span>Catálogos</span></div>
            <span class="admin-nav-pill-badge">${catalogsList.length}</span>
          </div>

          <div class="admin-sidebar-group-title" style="margin-top:12px;">Vendas & Operações</div>
          <div class="admin-nav-item ${currentTab === 'orders' ? 'active' : ''}" data-tab="orders">
            <div class="admin-nav-item-left">${Icons.package(18)}<span>Pedidos</span></div>
            <span class="admin-nav-pill-badge" style="${pendingOrdersCount > 0 ? 'background:#f97316; color:#fff;' : ''}">${ordersList.length}</span>
          </div>
          <div class="admin-nav-item ${currentTab === 'stock' ? 'active' : ''}" data-tab="stock">
            <div class="admin-nav-item-left">${Icons.truck(18)}<span>Gestão de Estoque</span></div>
            ${lowStockCount > 0 ? `<span class="badge" style="background:#ef4444; color:#fff; font-size:0.6875rem;">${lowStockCount}⚠️</span>` : ''}
          </div>
          <div class="admin-nav-item ${currentTab === 'coupons' ? 'active' : ''}" data-tab="coupons">
            <div class="admin-nav-item-left">${Icons.tag(18)}<span>Cupons & Promoções</span></div>
            <span class="admin-nav-pill-badge">${couponsList.length}</span>
          </div>
          <div class="admin-nav-item ${currentTab === 'customers' ? 'active' : ''}" data-tab="customers">
            <div class="admin-nav-item-left">${Icons.user(18)}<span>Clientes</span></div>
            <span class="admin-nav-pill-badge">${customersList.length}</span>
          </div>

          <div class="admin-sidebar-group-title" style="margin-top:12px;">Sistema</div>
          <div class="admin-nav-item ${currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
            <div class="admin-nav-item-left">${Icons.settings ? Icons.settings(18) : '⚙️'}<span>Configurações</span></div>
          </div>
          <div class="admin-nav-item ${currentTab === 'database' ? 'active' : ''}" data-tab="database">
            <div class="admin-nav-item-left">${Icons.cpu(18)}<span>Banco SQL</span></div>
          </div>
        </div>
      </aside>

      <!-- 3. Barra de Abas Rápidas para Mobile (< 992px) -->
      <nav class="admin-mobile-tabs-bar" id="adminMobileTabsBar">
        <button class="admin-mobile-tab-btn ${currentTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
          <span>📊 Visão Geral</span>
        </button>
        <button class="admin-mobile-tab-btn ${currentTab === 'products' ? 'active' : ''}" data-tab="products">
          <span>📦 Produtos (${productsList.length})</span>
        </button>
        <button class="admin-mobile-tab-btn ${currentTab === 'categories' ? 'active' : ''}" data-tab="categories">
          <span>📂 Categorias (${categoriesList.length})</span>
        </button>
        <button class="admin-mobile-tab-btn ${currentTab === 'banners' ? 'active' : ''}" data-tab="banners">
          <span>🖼️ Banners (${bannersList.length})</span>
        </button>
        <button class="admin-mobile-tab-btn ${currentTab === 'orders' ? 'active' : ''}" data-tab="orders">
          <span>🛒 Pedidos (${ordersList.length})</span>
        </button>
        <button class="admin-mobile-tab-btn ${currentTab === 'catalogs' ? 'active' : ''}" data-tab="catalogs">
          <span>🏷️ Catálogos</span>
        </button>
        <button class="admin-mobile-tab-btn ${currentTab === 'coupons' ? 'active' : ''}" data-tab="coupons">
          <span>🎟️ Cupons</span>
        </button>
        <button class="admin-mobile-tab-btn ${currentTab === 'stock' ? 'active' : ''}" data-tab="stock">
          <span>📈 Estoque ${lowStockCount > 0 ? `(${lowStockCount}⚠️)` : ''}</span>
        </button>
        <button class="admin-mobile-tab-btn ${currentTab === 'customers' ? 'active' : ''}" data-tab="customers">
          <span>👥 Clientes</span>
        </button>
        <button class="admin-mobile-tab-btn ${currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
          <span>⚙️ Configs</span>
        </button>
        <button class="admin-mobile-tab-btn ${currentTab === 'database' ? 'active' : ''}" data-tab="database">
          <span>🗄️ SQL</span>
        </button>
      </nav>

      <!-- 4. Workspace Corporativo Grid (Sidebar no Desktop + Conteúdo Central) -->
      <div class="admin-enterprise-body">
        <aside class="admin-enterprise-sidebar">
          <div class="admin-sidebar-group-title">Geral</div>
          <div class="admin-nav-item ${currentTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
            <div class="admin-nav-item-left">${Icons.grid(18)}<span>Visão Geral</span></div>
          </div>

          <div class="admin-sidebar-group-title" style="margin-top:14px;">Cadastros da Loja</div>
          <div class="admin-nav-item ${currentTab === 'products' ? 'active' : ''}" data-tab="products">
            <div class="admin-nav-item-left">${Icons.cpu(18)}<span>Produtos</span></div>
            <span class="admin-nav-pill-badge">${productsList.length}</span>
          </div>
          <div class="admin-nav-item ${currentTab === 'categories' ? 'active' : ''}" data-tab="categories">
            <div class="admin-nav-item-left">${Icons.grid(18)}<span>Categorias</span></div>
            <span class="admin-nav-pill-badge">${categoriesList.length}</span>
          </div>
          <div class="admin-nav-item ${currentTab === 'banners' ? 'active' : ''}" data-tab="banners">
            <div class="admin-nav-item-left">${Icons.heart ? Icons.heart(18) : '🖼️'}<span>Banners da Vitrine</span></div>
            <span class="admin-nav-pill-badge">${bannersList.length}</span>
          </div>
          <div class="admin-nav-item ${currentTab === 'catalogs' ? 'active' : ''}" data-tab="catalogs">
            <div class="admin-nav-item-left">${Icons.tag(18)}<span>Catálogos & Campanhas</span></div>
            <span class="admin-nav-pill-badge">${catalogsList.length}</span>
          </div>

          <div class="admin-sidebar-group-title" style="margin-top:14px;">Vendas & Operações</div>
          <div class="admin-nav-item ${currentTab === 'orders' ? 'active' : ''}" data-tab="orders">
            <div class="admin-nav-item-left">${Icons.package(18)}<span>Pedidos de Clientes</span></div>
            <span class="admin-nav-pill-badge" style="${pendingOrdersCount > 0 ? 'background:#f97316; color:#fff;' : ''}">${ordersList.length}</span>
          </div>
          <div class="admin-nav-item ${currentTab === 'stock' ? 'active' : ''}" data-tab="stock">
            <div class="admin-nav-item-left">${Icons.truck(18)}<span>Gestão de Estoque</span></div>
            ${lowStockCount > 0 ? `<span class="badge" style="background:#ef4444; color:#fff; font-size:0.6875rem;">${lowStockCount}⚠️</span>` : ''}
          </div>
          <div class="admin-nav-item ${currentTab === 'coupons' ? 'active' : ''}" data-tab="coupons">
            <div class="admin-nav-item-left">${Icons.tag(18)}<span>Cupons Promocionais</span></div>
            <span class="admin-nav-pill-badge">${couponsList.length}</span>
          </div>
          <div class="admin-nav-item ${currentTab === 'customers' ? 'active' : ''}" data-tab="customers">
            <div class="admin-nav-item-left">${Icons.user(18)}<span>Base de Clientes</span></div>
            <span class="admin-nav-pill-badge">${customersList.length}</span>
          </div>

          <div class="admin-sidebar-group-title" style="margin-top:14px;">Sistema & Infra</div>
          <div class="admin-nav-item ${currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
            <div class="admin-nav-item-left">${Icons.settings ? Icons.settings(18) : '⚙️'}<span>Configurações</span></div>
          </div>
          <div class="admin-nav-item ${currentTab === 'database' ? 'active' : ''}" data-tab="database">
            <div class="admin-nav-item-left">${Icons.cpu(18)}<span>Banco de Dados (SQL)</span></div>
            <span class="badge" style="background:#dbeafe; color:#1e40af; font-size:0.6875rem;">SUPABASE</span>
          </div>
        </aside>

        <!-- Área Central de Conteúdo da Aba Selecionada -->
        <main class="admin-content-area" id="adminMainContent">
          ${renderTabContent()}
        </main>
      </div>
    `;

    attachLayoutEvents();
  }

  // 4. Renderiza a aba ativa
  function renderTabContent() {
    switch (currentTab) {
      case 'dashboard':
        return renderDashboardTab();
      case 'orders':
        return renderOrdersTab();
      case 'products':
        return renderProductsTab();
      case 'categories':
        return renderCategoriesTab();
      case 'catalogs':
        return renderCatalogsTab();
      case 'coupons':
        return renderCouponsTab();
      case 'customers':
        return renderCustomersTab();
      case 'stock':
        return renderStockTab();
      case 'banners':
        return renderBannersTab();
      case 'settings':
        return renderSettingsTab();
      case 'database':
        return renderDatabaseTab();
      default:
        return renderDashboardTab();
    }
  }

  // ===================================================================
  // ABA 1: VISÃO GERAL (DASHBOARD)
  // ===================================================================
  function renderDashboardTab() {
    const totalSales = ordersList.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const lowStock = productsList.filter(p => (p.stock || 0) <= (p.stock_min || 2));
    const pendingOrders = ordersList.filter(o => o.status === 'received' || o.payment_status === 'pending');

    return `
      <div>
        <!-- Stats Grid -->
        <div class="admin-stats-grid">
          <div class="stat-card">
            <div>
              <div class="stat-label">Vendas Totais</div>
              <div class="stat-val" style="color: var(--primary-700);">${formatPrice(totalSales)}</div>
            </div>
            <div style="color: var(--primary-600);">${Icons.creditCard(28)}</div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-label">Total de Encomendas</div>
              <div class="stat-val">${ordersList.length}</div>
            </div>
            <div style="color: var(--accent-emerald);">${Icons.package(28)}</div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-label">Produtos no Catálogo</div>
              <div class="stat-val">${productsList.length}</div>
            </div>
            <div style="color: var(--accent-purple);">${Icons.cpu(28)}</div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-label">Atenção ao Estoque</div>
              <div class="stat-val" style="${lowStock.length > 0 ? 'color: #dc2626;' : ''}">
                ${lowStock.length} itens baixos
              </div>
            </div>
            <div style="color: #dc2626;">${Icons.truck(28)}</div>
          </div>
        </div>

        <!-- Alertas Operacionais Rápidos -->
        ${(pendingOrders.length > 0 || lowStock.length > 0) ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px;">
            ${pendingOrders.length > 0 ? `
              <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-md); padding: 16px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-weight: 800; color: #b45309; font-size: 0.9375rem;">📦 ${pendingOrders.length} Encomendas Aguardando</div>
                  <div style="font-size: 0.8125rem; color: #78350f;">Existem pedidos recebidos aguardando confirmação.</div>
                </div>
                <button class="btn btn-secondary" style="font-size: 0.75rem; padding: 6px 12px;" data-tab="orders">Revisar</button>
              </div>
            ` : ''}

            ${lowStock.length > 0 ? `
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-md); padding: 16px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-weight: 800; color: #b91c1c; font-size: 0.9375rem;">⚠️ ${lowStock.length} Itens com Estoque Baixo</div>
                  <div style="font-size: 0.8125rem; color: #991b1b;">Reponha o inventário antes que esgote na loja.</div>
                </div>
                <button class="btn btn-secondary" style="font-size: 0.75rem; padding: 6px 12px;" data-tab="stock">Ver Estoque</button>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Tabela de Pedidos Recentes -->
        <div class="admin-card">
          <div class="admin-card-header">
            <h3 class="admin-card-title">
              ${Icons.package(20)}
              <span>Últimas Encomendas Realizadas</span>
            </h3>
            <button class="btn btn-secondary" style="font-size: 0.8125rem;" data-tab="orders">
              Ver Todos os Pedidos (${ordersList.length}) →
            </button>
          </div>

          <div class="admin-table-wrapper">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cliente</th>
                  <th>Data</th>
                  <th>Total</th>
                  <th>Pagamento</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${ordersList.length === 0 ? `
                  <tr>
                    <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-secondary);">
                      Nenhuma encomenda registrada ainda.
                    </td>
                  </tr>
                ` : ordersList.slice(0, 5).map(o => `
                  <tr>
                    <td><strong>${o.order_code}</strong></td>
                    <td>
                      <div>${o.customer_name}</div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${o.customer_phone}</div>
                    </td>
                    <td>${formatDate(o.created_at)}</td>
                    <td><strong style="color: var(--primary-700);">${formatPrice(o.total)}</strong></td>
                    <td>
                      <span class="badge" style="background: #f1f5f9; color: var(--text-secondary); font-size: 0.6875rem;">
                        ${o.payment_method?.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      ${renderStatusBadge(o.status)}
                    </td>
                    <td>
                      <button class="btn btn-secondary btn-sm open-order-modal-btn" data-order-id="${o.id}">
                        Detalhes
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ===================================================================
  // ABA 2: GESTÃO DE PEDIDOS
  // ===================================================================
  function renderOrdersTab() {
    let filtered = [...ordersList];

    if (orderStatusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === orderStatusFilter);
    }
    if (orderSearchQuery) {
      const q = orderSearchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        (o.order_code && o.order_code.toLowerCase().includes(q)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.customer_phone && o.customer_phone.toLowerCase().includes(q)) ||
        (o.customer_email && o.customer_email.toLowerCase().includes(q))
      );
    }

    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <h2 class="admin-card-title">
            ${Icons.package(22)}
            <span>Gestão Operacional de Pedidos (${ordersList.length})</span>
          </h2>
        </div>

        <!-- Filtros de Busca e Status -->
        <div class="admin-filter-bar">
          <div class="admin-search-wrapper">
            <span class="admin-search-icon">${Icons.search(16)}</span>
            <input
              type="text"
              id="orderSearchInput"
              class="admin-search-input"
              placeholder="Buscar por código, nome, telefone ou email..."
              value="${orderSearchQuery}"
            />
          </div>

          <select id="orderStatusFilterSelect" class="admin-filter-select">
            <option value="all" ${orderStatusFilter === 'all' ? 'selected' : ''}>Todos os Status</option>
            <option value="received" ${orderStatusFilter === 'received' ? 'selected' : ''}>Recebido</option>
            <option value="confirmed" ${orderStatusFilter === 'confirmed' ? 'selected' : ''}>Confirmado / Pago</option>
            <option value="preparing" ${orderStatusFilter === 'preparing' ? 'selected' : ''}>Em Separação</option>
            <option value="shipped" ${orderStatusFilter === 'shipped' ? 'selected' : ''}>Enviado</option>
            <option value="delivered" ${orderStatusFilter === 'delivered' ? 'selected' : ''}>Entregue</option>
            <option value="cancelled" ${orderStatusFilter === 'cancelled' ? 'selected' : ''}>Cancelado</option>
          </select>
        </div>

        <!-- Tabela de Pedidos -->
        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Contato</th>
                <th>Data</th>
                <th>Valor Total</th>
                <th>Status Atual</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    Nenhum pedido encontrado com os filtros aplicados.
                  </td>
                </tr>
              ` : filtered.map(o => `
                <tr>
                  <td><strong>${o.order_code}</strong></td>
                  <td>${o.customer_name}</td>
                  <td>
                    <div style="font-size: 0.8125rem;">${o.customer_phone}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${o.customer_email}</div>
                  </td>
                  <td>${formatDate(o.created_at)}</td>
                  <td><strong style="color: var(--primary-700);">${formatPrice(o.total)}</strong></td>
                  <td>${renderStatusBadge(o.status)}</td>
                  <td>
                    <button class="btn btn-primary btn-sm open-order-modal-btn" data-order-id="${o.id}">
                      Abrir Pedido
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ===================================================================
  // ABA 3: GESTÃO DE PRODUTOS (CATÁLOGO TOTAL)
  // ===================================================================
  function renderProductsTab() {
    let filtered = [...productsList];

    if (productCategoryFilter !== 'all') {
      filtered = filtered.filter(p => String(p.category_id) === String(productCategoryFilter));
    }
    if (productStockFilter === 'low') {
      filtered = filtered.filter(p => (p.stock || 0) <= (p.stock_min || 2) && (p.stock || 0) > 0);
    } else if (productStockFilter === 'out') {
      filtered = filtered.filter(p => (p.stock || 0) === 0);
    } else if (productStockFilter === 'in_stock') {
      filtered = filtered.filter(p => (p.stock || 0) > (p.stock_min || 2));
    }
    if (productSearchQuery) {
      const q = productSearchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      );
    }

    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h2 class="admin-card-title">
              ${Icons.cpu(22)}
              <span>Gestão de Produtos do Catálogo (${productsList.length})</span>
            </h2>
            <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 4px;">
              Crie, edite preços, estoque, fotos, vídeos, variações e controle a visibilidade na loja.
            </p>
          </div>
          <button id="openNewProductModalBtn" class="btn btn-primary" style="gap: 8px;">
            ${Icons.plus(16)}
            <span>Novo Produto</span>
          </button>
        </div>

        <!-- Filtros de Busca e Categoria -->
        <div class="admin-filter-bar">
          <div class="admin-search-wrapper">
            <span class="admin-search-icon">${Icons.search(16)}</span>
            <input
              type="text"
              id="productSearchInput"
              class="admin-search-input"
              placeholder="Buscar por nome, marca, SKU..."
              value="${productSearchQuery}"
            />
          </div>

          <select id="productCatFilterSelect" class="admin-filter-select">
            <option value="all">Todas as Categorias</option>
            ${categoriesList.map(c => `
              <option value="${c.id}" ${productCategoryFilter === String(c.id) ? 'selected' : ''}>${c.name}</option>
            `).join('')}
          </select>

          <select id="productStockFilterSelect" class="admin-filter-select">
            <option value="all" ${productStockFilter === 'all' ? 'selected' : ''}>Todos os Estoques</option>
            <option value="in_stock" ${productStockFilter === 'in_stock' ? 'selected' : ''}>Estoque Normal</option>
            <option value="low" ${productStockFilter === 'low' ? 'selected' : ''}>⚠️ Estoque Baixo</option>
            <option value="out" ${productStockFilter === 'out' ? 'selected' : ''}>⛔ Sem Estoque</option>
          </select>
        </div>

        <!-- Tabela de Produtos -->
        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Produto / SKU</th>
                <th>Marca</th>
                <th>Preço</th>
                <th>Estoque</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    Nenhum produto cadastrado ou encontrado.
                  </td>
                </tr>
              ` : filtered.map(p => `
                <tr>
                  <td style="width: 54px;">
                    ${p.image ? `
                      <img
                        src="${p.image}"
                        alt="${p.name}"
                        style="width: 44px; height: 44px; object-fit: contain; border-radius: var(--radius-sm); border: 1px solid var(--border-light); background: #f8fafc;"
                        onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"
                      />
                      <div style="display: none; width: 44px; height: 44px; background: #f1f5f9; border-radius: var(--radius-sm); align-items: center; justify-content: center; color: var(--text-muted); border: 1px solid var(--border-light);">
                        ${Icons.package(20)}
                      </div>
                    ` : `
                      <div style="width: 44px; height: 44px; background: #f1f5f9; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; color: var(--text-muted); border: 1px solid var(--border-light);">
                        ${Icons.package(20)}
                      </div>
                    `}
                  </td>
                  <td>
                    <div style="font-weight: 700; color: var(--text-main);">${p.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">SKU: ${p.sku || 'N/A'}</div>
                  </td>
                  <td><span class="badge" style="background:#f1f5f9; color:var(--text-secondary);">${p.brand || 'Geral'}</span></td>
                  <td>
                    <div><strong style="color: var(--primary-700);">${formatPrice(p.price)}</strong></div>
                    ${p.old_price ? `<div style="font-size: 0.75rem; text-decoration: line-through; color: var(--text-muted);">${formatPrice(p.old_price)}</div>` : ''}
                  </td>
                  <td>
                    <span class="badge" style="${(p.stock || 0) <= 0 ? 'background:#fee2e2; color:#b91c1c;' : ((p.stock || 0) <= (p.stock_min || 2) ? 'background:#fef3c7; color:#b45309;' : 'background:#dcfce7; color:#15803d;')}">
                      ${p.stock || 0} un
                    </span>
                  </td>
                  <td>
                    <button class="toggle-product-active-btn" data-id="${p.id}" data-active="${p.is_active !== false}" style="background: none; border: none; cursor: pointer;">
                      <span class="badge" style="${p.is_active !== false ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                        ${p.is_active !== false ? '● Ativo' : '○ Inativo'}
                      </span>
                    </button>
                  </td>
                  <td>
                    <div style="display: flex; gap: 6px;">
                      <button class="btn btn-secondary btn-sm edit-product-btn" data-id="${p.id}" title="Editar Produto">
                        Editar
                      </button>
                      <button class="btn btn-sm delete-product-btn" data-id="${p.id}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;" title="Excluir">
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ===================================================================
  // ABA 4: CATEGORIAS & SUBCATEGORIAS
  // ===================================================================
  function renderCategoriesTab() {
    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h2 class="admin-card-title">
              ${Icons.grid(22)}
              <span>Categorias & Subcategorias (${categoriesList.length})</span>
            </h2>
            <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 4px;">
              Estruture o catálogo da sua loja: cadastre categorias principais e subcategorias com imagens, ícones e URLs personalizadas.
            </p>
          </div>
          <button id="openNewCategoryModalBtn" class="btn btn-primary" style="gap: 8px;">
            ${Icons.plus(16)}
            <span>+ Cadastrar Nova Categoria</span>
          </button>
        </div>

        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Ordem</th>
                <th>Imagem / Ícone</th>
                <th>Nome / Slug</th>
                <th>Hierarquia</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${categoriesList.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    Nenhuma categoria cadastrada. Clique em <strong>+ Cadastrar Nova Categoria</strong> acima.
                  </td>
                </tr>
              ` : categoriesList.map(c => {
                const parent = categoriesList.find(p => p.id === c.parent_id);
                return `
                  <tr>
                    <td><strong>#${c.display_order || 0}</strong></td>
                    <td style="width: 60px;">
                      ${c.image_url ? `
                        <div style="width: 42px; height: 42px; border-radius: 8px; overflow: hidden; background: #0f172a; border: 1px solid var(--border-light); display: flex; align-items: center; justify-content: center;">
                          <img src="${c.image_url}" alt="${c.name}" style="max-width: 100%; max-height: 100%; object-fit: cover;" />
                        </div>
                      ` : `
                        <div style="width: 42px; height: 42px; border-radius: 8px; background: #eff6ff; color: var(--primary-600); display: flex; align-items: center; justify-content: center;">
                          ${Icons[c.icon_name] ? Icons[c.icon_name](20) : Icons.package(20)}
                        </div>
                      `}
                    </td>
                    <td>
                      <div style="font-weight: 700; color: var(--text-main); font-size: 0.9375rem;">${c.name}</div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">slug: /categoria/${c.slug}</div>
                    </td>
                    <td>
                      ${parent ? `
                        <span class="badge" style="background: #eff6ff; color: var(--primary-700);">
                          ↳ Subcategoria de ${parent.name}
                        </span>
                      ` : `
                        <span class="badge" style="background: #f1f5f9; color: var(--text-main); font-weight: 700;">
                          Categoria Principal
                        </span>
                      `}
                    </td>
                    <td>
                      <span class="badge" style="${c.is_active !== false ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                        ${c.is_active !== false ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 6px;">
                        <button class="btn btn-secondary btn-sm edit-category-btn" data-id="${c.id}">
                          Editar
                        </button>
                        <button class="btn btn-sm delete-category-btn" data-id="${c.id}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;">
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ===================================================================
  // ABA 5: CATÁLOGOS & COLEÇÕES
  // ===================================================================
  function renderCatalogsTab() {
    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h2 class="admin-card-title">
              ${Icons.tag(22)}
              <span>Catálogos & Campanhas Especiais (${catalogsList.length})</span>
            </h2>
            <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 4px;">
              Crie catálogos como Black Friday, Ofertas de Verão, Topo de Gama e agrupe produtos sem alterar código.
            </p>
          </div>
          <button id="openNewCatalogModalBtn" class="btn btn-primary" style="gap: 8px;">
            ${Icons.plus(16)}
            <span>Novo Catálogo</span>
          </button>
        </div>

        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Nome / Slug</th>
                <th>Badge Comercial</th>
                <th>Descrição</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${catalogsList.length === 0 ? `
                <tr>
                  <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    Nenhum catálogo configurado.
                  </td>
                </tr>
              ` : catalogsList.map(c => `
                <tr>
                  <td>
                    <div style="font-weight: 700; color: var(--text-main);">${c.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">slug: #${c.slug}</div>
                  </td>
                  <td>
                    ${c.badge_text ? `
                      <span class="badge" style="background: var(--accent-orange); color: #ffffff;">
                        ${c.badge_text}
                      </span>
                    ` : '<span style="color:var(--text-muted); font-size:0.75rem;">—</span>'}
                  </td>
                  <td style="max-width: 260px; font-size: 0.8125rem; color: var(--text-secondary);">
                    ${c.description || 'Sem descrição.'}
                  </td>
                  <td>
                    <span class="badge" style="${c.is_active !== false ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                      ${c.is_active !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 6px;">
                      <button class="btn btn-secondary btn-sm edit-catalog-btn" data-id="${c.id}">
                        Editar
                      </button>
                      <button class="btn btn-sm delete-catalog-btn" data-id="${c.id}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;">
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ===================================================================
  // ABA 6: CUPONS & DESCONTOS
  // ===================================================================
  function renderCouponsTab() {
    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h2 class="admin-card-title">
              ${Icons.tag(22)}
              <span>Cupons Promocionais & Descontos (${couponsList.length})</span>
            </h2>
            <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 4px;">
              Crie cupons percentuais (%), fixos (Kz) ou frete grátis com limites de utilização e datas.
            </p>
          </div>
          <button id="openNewCouponModalBtn" class="btn btn-primary" style="gap: 8px;">
            ${Icons.plus(16)}
            <span>Novo Cupom</span>
          </button>
        </div>

        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Desconto</th>
                <th>Pedido Mínimo</th>
                <th>Usos / Limite</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${couponsList.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    Nenhum cupom cadastrado.
                  </td>
                </tr>
              ` : couponsList.map(c => `
                <tr>
                  <td>
                    <code style="font-weight: 800; font-size: 0.9375rem; background: #f8fafc; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-light); color: var(--primary-700);">
                      ${c.code}
                    </code>
                  </td>
                  <td>
                    <strong>
                      ${c.discount_type === 'percent' ? `${c.discount_value}% OFF` : (c.discount_type === 'free_shipping' ? 'Frete Grátis' : formatPrice(c.discount_value))}
                    </strong>
                  </td>
                  <td>${Number(c.min_order_value) > 0 ? formatPrice(c.min_order_value) : 'Sem valor mínimo'}</td>
                  <td>
                    <span style="font-size: 0.8125rem;">${c.times_used || 0} / ${c.usage_limit || '∞'}</span>
                  </td>
                  <td>
                    <button class="toggle-coupon-active-btn" data-id="${c.id}" data-active="${c.is_active !== false}" style="background: none; border: none; cursor: pointer;">
                      <span class="badge" style="${c.is_active !== false ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                        ${c.is_active !== false ? '● Ativo' : '○ Pausado'}
                      </span>
                    </button>
                  </td>
                  <td>
                    <button class="btn btn-sm delete-coupon-btn" data-id="${c.id}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;">
                      Excluir
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ===================================================================
  // ABA 7: GESTÃO DE ESTOQUE
  // ===================================================================
  function renderStockTab() {
    const outOfStock = productsList.filter(p => (p.stock || 0) === 0);
    const lowStock = productsList.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= (p.stock_min || 2));

    return `
      <div>
        <!-- Cards de Resumo de Estoque -->
        <div class="admin-stats-grid">
          <div class="stat-card">
            <div>
              <div class="stat-label">Itens Sem Estoque</div>
              <div class="stat-val" style="color: #dc2626;">${outOfStock.length} produtos</div>
            </div>
            <div style="color: #dc2626;">${Icons.close(28)}</div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-label">Itens em Nível Crítico</div>
              <div class="stat-val" style="color: #d97706;">${lowStock.length} produtos</div>
            </div>
            <div style="color: #d97706;">${Icons.truck(28)}</div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-label">Unidades Totais no Depósito</div>
              <div class="stat-val" style="color: var(--primary-700);">
                ${productsList.reduce((sum, p) => sum + (p.stock || 0), 0)} un
              </div>
            </div>
            <div style="color: var(--primary-600);">${Icons.package(28)}</div>
          </div>

          <div class="stat-card" style="display: flex; flex-direction: column; justify-content: center; align-items: stretch;">
            <button id="openRecordStockModalBtn" class="btn btn-primary btn-full" style="padding: 12px; font-weight: 800;">
              + Registrar Entrada / Saída
            </button>
          </div>
        </div>

        <!-- Tabela de Controle de Estoque dos Produtos -->
        <div class="admin-card" style="margin-bottom: 24px;">
          <div class="admin-card-header">
            <h3 class="admin-card-title">
              ${Icons.cpu(20)}
              <span>Nível de Estoque por Produto</span>
            </h3>
          </div>

          <div class="admin-table-wrapper">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>SKU</th>
                  <th>Estoque Atual</th>
                  <th>Estoque Mínimo</th>
                  <th>Ações Rápidas</th>
                </tr>
              </thead>
              <tbody>
                ${productsList.map(p => `
                  <tr>
                    <td><strong>${p.name}</strong></td>
                    <td><code>${p.sku || 'N/A'}</code></td>
                    <td>
                      <span class="badge" style="${(p.stock || 0) <= 0 ? 'background:#fee2e2; color:#b91c1c;' : ((p.stock || 0) <= (p.stock_min || 2) ? 'background:#fef3c7; color:#b45309;' : 'background:#dcfce7; color:#15803d;')}">
                        ${p.stock || 0} unidades
                      </span>
                    </td>
                    <td>${p.stock_min || 2} un</td>
                    <td>
                      <div style="display: flex; gap: 6px;">
                        <button class="btn btn-secondary btn-sm quick-add-stock-btn" data-id="${p.id}" data-name="${p.name}" title="Entrada rápida de estoque">
                          + Adicionar Estoque
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Histórico de Movimentações -->
        <div class="admin-card">
          <div class="admin-card-header">
            <h3 class="admin-card-title">
              ${Icons.truck(20)}
              <span>Histórico de Entradas & Saídas</span>
            </h3>
          </div>

          <div class="admin-table-wrapper">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Produto</th>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                  <th>Motivo / Observação</th>
                </tr>
              </thead>
              <tbody>
                ${stockMovementsList.length === 0 ? `
                  <tr>
                    <td colspan="5" style="text-align: center; padding: 32px; color: var(--text-muted);">
                      Nenhuma movimentação registrada no histórico.
                    </td>
                  </tr>
                ` : stockMovementsList.slice(0, 10).map(m => `
                  <tr>
                    <td>${formatDate(m.created_at)}</td>
                    <td><strong>${m.product?.name || `Produto #${m.product_id}`}</strong></td>
                    <td>
                      <span class="badge" style="${m.movement_type === 'in' ? 'background:#dcfce7; color:#15803d;' : (m.movement_type === 'out' ? 'background:#fee2e2; color:#b91c1c;' : 'background:#eff6ff; color:#1e40af;')}">
                        ${m.movement_type === 'in' ? '▲ Entrada' : (m.movement_type === 'out' ? '▼ Saída' : '● Ajuste')}
                      </span>
                    </td>
                    <td><strong>${m.quantity} un</strong></td>
                    <td style="color: var(--text-secondary);">${m.reason || 'Ajuste manual'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ===================================================================
  // ABA 8: BANNERS & VITRINE COMERCIAL (Upload de Imagens)
  // ===================================================================
  function renderBannersTab() {
    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h2 class="admin-card-title">
              ${Icons.heart ? Icons.heart(22) : '🖼️'}
              <span>Banners da Vitrine Inicial (${bannersList.length})</span>
            </h2>
            <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 4px;">
              Gerencie as artes dos banners da sua loja: envie as imagens promocionais e defina o link para onde o cliente será direcionado ao clicar.
            </p>
          </div>
          <button id="openNewBannerModalBtn" class="btn btn-primary" style="gap: 8px;">
            ${Icons.plus(16)}
            <span>+ Subir Novo Banner</span>
          </button>
        </div>

        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Ordem</th>
                <th>Arte do Banner</th>
                <th>Identificação / Título</th>
                <th>Link de Destino</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${bannersList.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    Nenhum banner cadastrado. Clique no botão <strong>+ Subir Novo Banner</strong> para enviar uma imagem da sua campanha.
                  </td>
                </tr>
              ` : bannersList.map(b => `
                <tr>
                  <td>
                    <span class="badge" style="background:#f1f5f9; color:#334155; font-weight:800;">
                      #${b.display_order || 1}
                    </span>
                  </td>
                  <td style="width: 160px;">
                    <div style="width: 150px; height: 60px; border-radius: 8px; overflow: hidden; background: #0b0f19; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-light);">
                      <img
                        src="${b.image_url}"
                        alt="${b.title}"
                        style="width: 100%; height: 100%; object-fit: cover;"
                      />
                    </div>
                  </td>
                  <td>
                    <div style="font-weight: 800; color: var(--text-main); font-size: 0.9375rem;">
                      ${b.title}
                    </div>
                  </td>
                  <td>
                    <div style="font-size: 0.8125rem; color: var(--primary-700); font-family: monospace; word-break: break-all; max-width: 220px;">
                      ${b.button_link || '#/catalogo'}
                    </div>
                  </td>
                  <td>
                    <button class="btn btn-sm toggle-banner-active-btn" data-id="${b.id}" data-active="${b.is_active !== false}" title="Clique para ativar ou bloquear este banner" style="${b.is_active !== false ? 'background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;' : 'background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;'}">
                      ${b.is_active !== false ? '✓ Ativo na Vitrine' : '✕ Bloqueado'}
                    </button>
                  </td>
                  <td>
                    <div style="display: flex; gap: 6px;">
                      <button class="btn btn-secondary btn-sm edit-banner-btn" data-id="${b.id}" title="Editar Banner">
                        Editar
                      </button>
                      <button class="btn btn-sm delete-banner-btn" data-id="${b.id}" title="Excluir Banner" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;">
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ===================================================================
  // ABA 9: GESTÃO DE CLIENTES
  // ===================================================================
  function renderCustomersTab() {
    let filtered = [...customersList];
    if (customerSearchQuery) {
      const q = customerSearchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
      );
    }

    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h2 class="admin-card-title">
              ${Icons.user(22)}
              <span>Gestão de Clientes (${customersList.length})</span>
            </h2>
            <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 4px;">
              Visualização de clientes cadastrados, histórico de compras e bloqueio de contas. Senhas nunca são expostas.
            </p>
          </div>
        </div>

        <div class="admin-filter-bar">
          <div class="admin-search-wrapper">
            <span class="admin-search-icon">${Icons.search(16)}</span>
            <input
              type="text"
              id="customerSearchInput"
              class="admin-search-input"
              placeholder="Buscar cliente por nome, e-mail ou telefone..."
              value="${customerSearchQuery}"
            />
          </div>
        </div>

        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Nome do Cliente</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th>Endereço Completo</th>
                <th>Ponto de Referência</th>
                <th>Total Gasto</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    Nenhum cliente cadastrado.
                  </td>
                </tr>
              ` : filtered.map(c => `
                <tr>
                  <td><strong>${c.name}</strong></td>
                  <td>${c.email}</td>
                  <td>${c.phone || '<span style="color:var(--text-muted);">Não informado</span>'}</td>
                  <td>
                    <div style="font-size: 0.8125rem; max-width: 200px; color: var(--text-main); line-height: 1.4;">
                      ${c.endereco || '<span style="color:var(--text-muted); font-size: 0.75rem;">Não informado</span>'}
                    </div>
                  </td>
                  <td>
                    <div style="font-size: 0.8125rem; max-width: 170px; color: var(--text-secondary); line-height: 1.4;">
                      ${c.ponto_referencia ? `📍 ${c.ponto_referencia}` : '<span style="color:var(--text-muted); font-size: 0.75rem;">Sem referência</span>'}
                    </div>
                  </td>
                  <td><strong style="color: var(--primary-700);">${formatPrice(c.total_spent || 0)}</strong></td>
                  <td>
                    <span class="badge" style="${c.status !== 'blocked' ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                      ${c.status !== 'blocked' ? 'Ativo' : 'Bloqueado'}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-sm toggle-block-customer-btn" data-id="${c.id}" data-blocked="${c.status === 'blocked'}" style="${c.status === 'blocked' ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                      ${c.status === 'blocked' ? 'Desbloquear' : 'Bloquear Conta'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ===================================================================
  // ABA 10: CONFIGURAÇÕES DA LOJA
  // ===================================================================
  function renderSettingsTab() {
    const s = storeSettings;
    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h2 class="admin-card-title">
              ${Icons.settings ? Icons.settings(22) : Icons.package(22)}
              <span>Configurações Gerais da Loja</span>
            </h2>
            <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 4px;">
              Edite nome da loja, contactos em Luanda, taxas de entrega e políticas comerciais. Salva no banco de dados.
            </p>
          </div>
        </div>

        <form id="storeSettingsForm" style="display: flex; flex-direction: column; gap: 20px;">
          <!-- 1. Perfil da Loja -->
          <div style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 18px;">
            <h4 style="font-size: 0.9375rem; font-weight: 800; color: var(--text-main); margin-bottom: 14px;">
              1. Identidade & Contatos
            </h4>
            <div class="admin-form-grid-2">
              <div class="form-group">
                <label class="form-label">Nome Oficial da Loja</label>
                <input type="text" id="setStoreName" class="form-input" value="${s.store_name || 'NovaTech Angola'}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Slogan Comercial</label>
                <input type="text" id="setSlogan" class="form-input" value="${s.slogan || 'Loja de Tecnologia e Smartphones'}" />
              </div>
            </div>

            <div class="admin-form-grid-3" style="margin-top: 12px;">
              <div class="form-group">
                <label class="form-label">Telefone Principal</label>
                <input type="tel" id="setPhone" class="form-input" value="${s.phone || '+244 923 179 192'}" required />
              </div>
              <div class="form-group">
                <label class="form-label">WhatsApp de Atendimento</label>
                <input type="tel" id="setWhatsapp" class="form-input" value="${s.whatsapp || '+244 923 179 192'}" required />
              </div>
              <div class="form-group">
                <label class="form-label">E-mail Comercial</label>
                <input type="email" id="setEmail" class="form-input" value="${s.email || 'contacto@novatech.co.ao'}" required />
              </div>
            </div>

            <div class="form-group" style="margin-top: 12px;">
              <label class="form-label">Endereço Físico em Luanda</label>
              <input type="text" id="setAddress" class="form-input" value="${s.address || 'Talatona, Luanda - Angola'}" required />
            </div>
          </div>

          <!-- 2. Entrega e Checkout -->
          <div style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 18px;">
            <h4 style="font-size: 0.9375rem; font-weight: 800; color: var(--text-main); margin-bottom: 14px;">
              2. Custos de Envio & Checkout
            </h4>
            <div class="admin-form-grid-3">
              <div class="form-group">
                <label class="form-label">Valor Entrega Normal (Kz)</label>
                <input type="number" id="setShippingNormal" class="form-input" value="${s.shipping_price_normal || 3500}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Valor Entrega Expresso (Kz)</label>
                <input type="number" id="setShippingExpress" class="form-input" value="${s.shipping_price_express || 6500}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Frete Grátis Acima de (Kz)</label>
                <input type="number" id="setFreeShipping" class="form-input" value="${s.free_shipping_threshold || 1000000}" required />
              </div>
            </div>
          </div>

          <!-- 3. Políticas da Loja -->
          <div style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 18px;">
            <h4 style="font-size: 0.9375rem; font-weight: 800; color: var(--text-main); margin-bottom: 14px;">
              3. Políticas Oficiais (Exibidas aos Clientes)
            </h4>
            <div class="form-group">
              <label class="form-label">Política de Entrega</label>
              <textarea id="setDeliveryPolicy" class="form-input" rows="3">${s.delivery_policy || ''}</textarea>
            </div>
            <div class="form-group" style="margin-top: 12px;">
              <label class="form-label">Garantia & Devolução</label>
              <textarea id="setReturnPolicy" class="form-input" rows="3">${s.return_policy || ''}</textarea>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button type="submit" class="btn btn-primary" style="padding: 14px 28px; font-weight: 800; font-size: 0.9375rem;">
              Salvar Todas as Configurações
            </button>
          </div>
        </form>
      </div>
    `;
  }

  // ===================================================================
  // ABA 11: BANCO DE DADOS & SUPABASE (INFRAESTRUTURA LIMPA DO ZERO)
  // Permite ao Administrador executar o script e checar as tabelas
  // ===================================================================
  function renderDatabaseTab() {
    const isConfig = isSupabaseConfigured();
    const tablesList = [
      { name: 'usuarios', label: 'Usuários (Clientes & Admins com Endereço e Ponto de Ref.)' },
      { name: 'categorias', label: 'Categorias e Departamentos' },
      { name: 'catalogos', label: 'Catálogos & Coleções Comerciais' },
      { name: 'produtos', label: 'Produtos do Catálogo' },
      { name: 'banners', label: 'Banners da Vitrine Comercial' },
      { name: 'cupons', label: 'Cupons de Desconto' },
      { name: 'pedidos', label: 'Pedidos e Encomendas Oficiais' },
      { name: 'itens_pedido', label: 'Itens Comprados nos Pedidos' },
      { name: 'movimentacoes_estoque', label: 'Movimentações e Auditoria de Estoque' },
      { name: 'configuracoes_loja', label: 'Configurações Globais da Loja' }
    ];

    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <!-- Card 1: Status de Conexão e Instruções -->
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" style="background:#2563eb; color:#fff;">SUPABASE POSTGRESQL</span>
                <span class="badge" style="${isConfig ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                  ${isConfig ? '● Credenciais Detectadas (.env)' : '✕ Credenciais Ausentes'}
                </span>
              </div>
              <h2 class="admin-card-title" style="margin-top: 6px;">
                ${Icons.cpu(22)}
                <span>Gestão da Infraestrutura de Banco de Dados</span>
              </h2>
              <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 4px;">
                Banco de dados construído do zero, 100% em português, sem acentos, sem dados fictícios. Siga os passos abaixo para inicializar as 10 tabelas oficiais diretamente pelo seu painel do Supabase.
              </p>
            </div>

            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <button id="checkDatabaseTablesBtn" class="btn btn-secondary" style="gap: 8px;">
                ${isCheckingDb ? 'Verificando...' : '↻ Verificar Status das Tabelas'}
              </button>
              <button id="copySqlSchemaBtn" class="btn btn-primary" style="gap: 8px;">
                <span>📋 Copiar Script SQL Oficial</span>
              </button>
            </div>
          </div>

          <!-- Guia Rápido de Execução -->
          <div style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 20px; margin-bottom: 20px;">
            <h4 style="font-size: 0.9375rem; font-weight: 800; color: var(--text-main); margin-bottom: 12px;">
              Passo a Passo para Executar o Banco no Supabase (Em menos de 1 minuto):
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; font-size: 0.875rem;">
              <div style="background: #ffffff; padding: 14px; border-radius: 6px; border: 1px solid var(--border-light);">
                <div style="font-weight: 800; color: var(--primary-700); margin-bottom: 4px;">1. Copie o Script SQL</div>
                <div style="color: var(--text-secondary); line-height: 1.4;">Clique no botão azul acima <strong>"Copiar Script SQL Oficial"</strong>. O código completo será copiado automaticamente.</div>
              </div>
              <div style="background: #ffffff; padding: 14px; border-radius: 6px; border: 1px solid var(--border-light);">
                <div style="font-weight: 800; color: var(--primary-700); margin-bottom: 4px;">2. Abra o SQL Editor</div>
                <div style="color: var(--text-secondary); line-height: 1.4;">Acesse seu painel do <strong>Supabase</strong> (<a href="https://supabase.com/dashboard" target="_blank" style="color: var(--primary-600); font-weight: 700; text-decoration: underline;">supabase.com/dashboard</a>) e clique no menu <strong>SQL Editor</strong>.</div>
              </div>
              <div style="background: #ffffff; padding: 14px; border-radius: 6px; border: 1px solid var(--border-light);">
                <div style="font-weight: 800; color: var(--primary-700); margin-bottom: 4px;">3. Cole e Execute (RUN)</div>
                <div style="color: var(--text-secondary); line-height: 1.4;">Clique em <strong>New Query</strong>, cole o código (Ctrl+V) e clique no botão verde <strong>RUN</strong>. As 10 tabelas serão criadas instantaneamente!</div>
              </div>
            </div>
          </div>

          <!-- Status das 10 Tabelas em Português -->
          <div>
            <h4 style="font-size: 0.9375rem; font-weight: 800; color: var(--text-main); margin-bottom: 12px;">
              Status das 10 Tabelas Oficiais no Banco:
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
              ${tablesList.map(t => {
                const info = dbCheckResult?.tables ? dbCheckResult.tables[t.name] : null;
                const isCreated = info?.exists === true;
                return `
                  <div style="background: #ffffff; border: 1px solid ${isCreated ? '#bbf7d0' : 'var(--border-light)'}; border-radius: 6px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                      <div style="font-family: monospace; font-weight: 800; font-size: 0.9375rem; color: var(--text-main);">
                        public.${t.name}
                      </div>
                      <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                        ${t.label}
                      </div>
                    </div>
                    <div>
                      ${dbCheckResult ? (
                        isCreated ? `
                          <span class="badge" style="background:#dcfce7; color:#15803d; font-weight:800;">
                            ✓ Ativa (${info.count} registros)
                          </span>
                        ` : `
                          <span class="badge" style="background:#fef3c7; color:#b45309; font-weight:800;" title="${info?.error || 'Aguardando execução do script'}">
                            ⚠️ Não criada
                          </span>
                        `
                      ) : `
                        <span class="badge" style="background:#f1f5f9; color:#475569;">
                          ● Pronto p/ criar
                        </span>
                      `}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Card 2: Visualizador do Código SQL Completo -->
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <h3 class="admin-card-title">
                <span>Script SQL Oficial Completo (PostgreSQL / Supabase)</span>
              </h3>
              <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 2px;">
                Arquivo correspondente em <code>supabase_schema.sql</code>. Contém criação de tabelas, chaves estrangeiras, triggers de atualização e políticas de segurança RLS.
              </p>
            </div>
            <button id="copySqlSchemaBtn2" class="btn btn-secondary btn-sm" style="gap: 6px;">
              <span>Copiar SQL</span>
            </button>
          </div>

          <div style="position: relative;">
            <pre id="schemaSqlCodeBlock" style="background: #090d16; color: #38bdf8; font-family: 'Consolas', 'Courier New', monospace; font-size: 0.8125rem; line-height: 1.5; padding: 20px; border-radius: 8px; max-height: 480px; overflow: auto; border: 1px solid rgba(255,255,255,0.08); white-space: pre;">${SCHEMA_SQL}</pre>
          </div>
        </div>
      </div>
    `;
  }

  // --- HELPERS E EVENT LISTENERS ---
  function renderStatusBadge(status) {
    switch (status) {
      case 'received':
        return '<span class="badge" style="background:#fef3c7; color:#b45309;">● Recebido</span>';
      case 'confirmed':
        return '<span class="badge" style="background:#dcfce7; color:#15803d;">✓ Confirmado</span>';
      case 'preparing':
        return '<span class="badge" style="background:#e0e7ff; color:#4338ca;">⚡ Em Separação</span>';
      case 'shipped':
        return '<span class="badge" style="background:#dbeafe; color:#1e40af;">✈ Enviado</span>';
      case 'delivered':
        return '<span class="badge" style="background:#d1fae5; color:#065f46;">★ Entregue</span>';
      case 'cancelled':
        return '<span class="badge" style="background:#fee2e2; color:#b91c1c;">✕ Cancelado</span>';
      default:
        return `<span class="badge">${status}</span>`;
    }
  }

  function attachLayoutEvents() {
    // Alternância de abas via Sidebar Corporativa e Drawer
    container.querySelectorAll('.admin-nav-item, .admin-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.dataset.tab;
        if (tab) {
          currentTab = tab;
          render();
        }
      });
    });

    // Alternância de abas via Mobile Tabs
    container.querySelectorAll('.admin-mobile-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab) {
          currentTab = tab;
          render();
        }
      });
    });

    // Botões genéricos com data-tab no conteúdo
    container.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab && currentTab !== tab) {
          currentTab = tab;
          render();
        }
      });
    });

    // Controle do Drawer Mobile
    const drawerToggleBtn = container.querySelector('#adminMobileDrawerToggleBtn');
    const drawerOverlay = container.querySelector('#adminMobileDrawerOverlay');
    const drawerCloseBtn = container.querySelector('#adminMobileDrawerCloseBtn');
    const drawer = container.querySelector('#adminMobileDrawer');

    function closeDrawer() {
      drawer?.classList.remove('open');
      drawerOverlay?.classList.remove('open');
    }

    if (drawerToggleBtn) {
      drawerToggleBtn.addEventListener('click', () => {
        drawer?.classList.toggle('open');
        drawerOverlay?.classList.toggle('open');
      });
    }

    if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);
    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);

    drawer?.querySelectorAll('[data-tab]').forEach(el => {
      el.addEventListener('click', closeDrawer);
    });

    // Sincronizar dados
    const refreshBtn = container.querySelector('#adminRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        Toast.show('Atualizando dados do Supabase...', 'info');
        await loadAllData();
        render();
        Toast.show('Dados sincronizados com sucesso!', 'success');
      });
    }

    // Zerar Base / Limpar Cache Local
    const clearCacheBtn = container.querySelector('#adminClearCacheBtn');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', () => {
        if (confirm('Atenção: Deseja zerar e limpar todos os dados locais em cache para começar 100% do zero?')) {
          localStorage.clear();
          Toast.show('Base local zerada com sucesso!', 'success');
          setTimeout(() => window.location.reload(), 500);
        }
      });
    }

    // Logout
    const logoutBtn = container.querySelector('#adminLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await Api.auth.logout();
        Storage.removeUser();
        Toast.show('Sessão encerrada com sucesso.', 'info');
        render();
      });
    }

    // Eventos específicos de cada aba
    attachTabSpecificEvents();
  }

  function attachTabSpecificEvents() {
    // --- Pedidos ---
    const orderSearch = container.querySelector('#orderSearchInput');
    if (orderSearch) {
      orderSearch.addEventListener('input', (e) => {
        orderSearchQuery = e.target.value;
        const main = container.querySelector('#adminMainContent');
        if (main) main.innerHTML = renderOrdersTab();
        attachTabSpecificEvents();
      });
    }

    const orderFilter = container.querySelector('#orderStatusFilterSelect');
    if (orderFilter) {
      orderFilter.addEventListener('change', (e) => {
        orderStatusFilter = e.target.value;
        const main = container.querySelector('#adminMainContent');
        if (main) main.innerHTML = renderOrdersTab();
        attachTabSpecificEvents();
      });
    }

    // Modal de Pedido
    container.querySelectorAll('.open-order-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.orderId);
        const order = ordersList.find(o => o.id === id);
        if (order) openOrderDetailsModal(order);
      });
    });

    // --- Produtos ---
    const prodSearch = container.querySelector('#productSearchInput');
    if (prodSearch) {
      prodSearch.addEventListener('input', (e) => {
        productSearchQuery = e.target.value;
        const main = container.querySelector('#adminMainContent');
        if (main) main.innerHTML = renderProductsTab();
        attachTabSpecificEvents();
      });
    }

    const prodCatFilter = container.querySelector('#productCatFilterSelect');
    if (prodCatFilter) {
      prodCatFilter.addEventListener('change', (e) => {
        productCategoryFilter = e.target.value;
        const main = container.querySelector('#adminMainContent');
        if (main) main.innerHTML = renderProductsTab();
        attachTabSpecificEvents();
      });
    }

    const prodStockFilter = container.querySelector('#productStockFilterSelect');
    if (prodStockFilter) {
      prodStockFilter.addEventListener('change', (e) => {
        productStockFilter = e.target.value;
        const main = container.querySelector('#adminMainContent');
        if (main) main.innerHTML = renderProductsTab();
        attachTabSpecificEvents();
      });
    }

    const newProdBtn = container.querySelector('#openNewProductModalBtn');
    if (newProdBtn) {
      newProdBtn.addEventListener('click', () => openProductModal());
    }

    container.querySelectorAll('.edit-product-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const prod = productsList.find(p => p.id === id);
        if (prod) openProductModal(prod);
      });
    });

    container.querySelectorAll('.delete-product-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        if (confirm('Tem certeza de que deseja excluir este produto do catálogo?')) {
          await Api.products.delete(id);
          productsList = productsList.filter(p => p.id !== id);
          Toast.show('Produto excluído com sucesso.', 'success');
          render();
        }
      });
    });

    container.querySelectorAll('.toggle-product-active-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const currentActive = btn.dataset.active === 'true';
        const newActive = !currentActive;
        await Api.products.update(id, { is_active: newActive });
        const p = productsList.find(item => item.id === id);
        if (p) p.is_active = newActive;
        Toast.show(`Produto ${newActive ? 'ativado' : 'desativado'} com sucesso!`, 'info');
        render();
      });
    });

    // --- Categorias ---
    const newCatBtn = container.querySelector('#openNewCategoryModalBtn');
    if (newCatBtn) {
      newCatBtn.addEventListener('click', () => openCategoryModal());
    }

    container.querySelectorAll('.edit-category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const cat = categoriesList.find(c => c.id === id);
        if (cat) openCategoryModal(cat);
      });
    });

    container.querySelectorAll('.delete-category-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        if (confirm('Excluir esta categoria? Os produtos associados ficarão sem categoria.')) {
          await Api.categories.delete(id);
          categoriesList = categoriesList.filter(c => c.id !== id);
          Toast.show('Categoria excluída com sucesso.', 'success');
          render();
        }
      });
    });

    // --- Catálogos ---
    const newCatalogBtn = container.querySelector('#openNewCatalogModalBtn');
    if (newCatalogBtn) {
      newCatalogBtn.addEventListener('click', () => openCatalogModal());
    }

    container.querySelectorAll('.edit-catalog-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const cat = catalogsList.find(c => c.id === id);
        if (cat) openCatalogModal(cat);
      });
    });

    container.querySelectorAll('.delete-catalog-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        if (confirm('Excluir este catálogo?')) {
          await Api.catalogs.delete(id);
          catalogsList = catalogsList.filter(c => c.id !== id);
          Toast.show('Catálogo excluído.', 'success');
          render();
        }
      });
    });

    // --- Cupons ---
    const newCouponBtn = container.querySelector('#openNewCouponModalBtn');
    if (newCouponBtn) {
      newCouponBtn.addEventListener('click', () => openCouponModal());
    }

    container.querySelectorAll('.toggle-coupon-active-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const active = btn.dataset.active === 'true';
        await Api.coupons.update(id, { is_active: !active });
        const c = couponsList.find(item => item.id === id);
        if (c) c.is_active = !active;
        Toast.show(`Cupom ${!active ? 'ativado' : 'pausado'}!`, 'info');
        render();
      });
    });

    container.querySelectorAll('.delete-coupon-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        if (confirm('Deseja excluir este cupom promocional?')) {
          await Api.coupons.delete(id);
          couponsList = couponsList.filter(c => c.id !== id);
          Toast.show('Cupom excluído.', 'success');
          render();
        }
      });
    });

    // --- Estoque ---
    const recordStockBtn = container.querySelector('#openRecordStockModalBtn');
    if (recordStockBtn) {
      recordStockBtn.addEventListener('click', () => openStockMovementModal());
    }

    container.querySelectorAll('.quick-add-stock-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const name = btn.dataset.name;
        openStockMovementModal({ productId: id, productName: name, type: 'in' });
      });
    });

    // --- Banners ---
    const newBannerBtn = container.querySelector('#openNewBannerModalBtn');
    if (newBannerBtn) {
      newBannerBtn.addEventListener('click', () => openBannerModal());
    }

    container.querySelectorAll('.edit-banner-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const b = bannersList.find(item => item.id === id);
        if (b) openBannerModal(b);
      });
    });

    container.querySelectorAll('.toggle-banner-active-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const isActive = btn.dataset.active === 'true';
        const newStatus = !isActive;
        try {
          await Api.banners.update(id, { is_active: newStatus });
          const b = bannersList.find(item => item.id === id);
          if (b) b.is_active = newStatus;
          Toast.show(`Banner ${newStatus ? 'ativado na vitrine' : 'bloqueado / desativado'}!`, 'info');
          render();
        } catch (err) {
          Toast.show('Erro ao alterar status do banner.', 'error');
        }
      });
    });

    container.querySelectorAll('.delete-banner-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        if (confirm('Excluir este banner da vitrine?')) {
          await Api.banners.delete(id);
          bannersList = bannersList.filter(b => b.id !== id);
          Toast.show('Banner excluído.', 'success');
          render();
        }
      });
    });

    // --- Clientes ---
    container.querySelectorAll('.toggle-block-customer-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const isBlocked = btn.dataset.blocked === 'true';
        const newStatus = isBlocked ? 'active' : 'blocked';
        await Api.customers.updateStatus(id, newStatus);
        const c = customersList.find(cust => String(cust.id) === String(id));
        if (c) c.status = newStatus;
        Toast.show(`Conta do cliente ${newStatus === 'blocked' ? 'bloqueada' : 'desbloqueada'}.`, 'info');
        render();
      });
    });

    // --- Configurações da Loja ---
    const settingsForm = container.querySelector('#storeSettingsForm');
    if (settingsForm) {
      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const updated = {
          store_name: container.querySelector('#setStoreName').value.trim(),
          slogan: container.querySelector('#setSlogan').value.trim(),
          phone: container.querySelector('#setPhone').value.trim(),
          whatsapp: container.querySelector('#setWhatsapp').value.trim(),
          email: container.querySelector('#setEmail').value.trim(),
          address: container.querySelector('#setAddress').value.trim(),
          shipping_price_normal: Number(container.querySelector('#setShippingNormal').value) || 3500,
          shipping_price_express: Number(container.querySelector('#setShippingExpress').value) || 6500,
          free_shipping_threshold: Number(container.querySelector('#setFreeShipping').value) || 1000000,
          delivery_policy: container.querySelector('#setDeliveryPolicy').value.trim(),
          return_policy: container.querySelector('#setReturnPolicy').value.trim()
        };

        try {
          await Api.settings.save('general', updated);
          storeSettings = updated;
          Toast.show('Configurações salvas e aplicadas na loja!', 'success');
        } catch (err) {
          Toast.show('Erro ao salvar configurações.', 'error');
        }
      });
    }

    // --- Banco de Dados (SQL & Supabase) ---
    const copySqlBtn = container.querySelector('#copySqlSchemaBtn');
    const copySqlBtn2 = container.querySelector('#copySqlSchemaBtn2');

    const handleCopySql = async () => {
      try {
        await navigator.clipboard.writeText(SCHEMA_SQL);
        Toast.show('Script SQL oficial copiado com sucesso! Abra o SQL Editor no Supabase e clique em RUN.', 'success');
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = SCHEMA_SQL;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
        Toast.show('Script SQL copiado com sucesso!', 'success');
      }
    };

    if (copySqlBtn) copySqlBtn.addEventListener('click', handleCopySql);
    if (copySqlBtn2) copySqlBtn2.addEventListener('click', handleCopySql);

    const checkDbBtn = container.querySelector('#checkDatabaseTablesBtn');
    if (checkDbBtn) {
      checkDbBtn.addEventListener('click', async () => {
        isCheckingDb = true;
        render();
        try {
          const res = await Api.database.testConnection();
          dbCheckResult = res;
          if (res.allTablesCreated) {
            Toast.show('Todas as 10 tabelas em português estão ativas no Supabase!', 'success');
          } else {
            Toast.show('Tabelas verificadas. Algumas tabelas aguardam execução do script no Supabase.', 'info');
          }
        } catch (err) {
          Toast.show('Erro ao verificar tabelas: ' + err.message, 'error');
        } finally {
          isCheckingDb = false;
          render();
        }
      });
    }
  }

  // ===================================================================
  // MODAIS OPERACIONAIS
  // ===================================================================

  // 1. Modal de Detalhes do Pedido
  function openOrderDetailsModal(order) {
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog">
        <div class="admin-modal-header">
          <div>
            <span class="badge" style="background:var(--primary-600); color:#fff;">ENCOMENDA OFICIAL</span>
            <h3 class="admin-modal-title" style="margin-top: 4px;">Pedido ${order.order_code}</h3>
          </div>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>

        <div class="admin-modal-body">
          <!-- Status e Troca Rápida -->
          <div style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 16px;">
            <label class="form-label" style="font-weight: 800;">Alterar Status do Pedido:</label>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
              <button class="btn btn-sm order-set-status-btn" data-status="confirmed" style="background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;">
                ✓ Confirmar / Pago
              </button>
              <button class="btn btn-sm order-set-status-btn" data-status="preparing" style="background:#e0e7ff; color:#4338ca; border:1px solid #c7d2fe;">
                ⚡ Em Separação
              </button>
              <button class="btn btn-sm order-set-status-btn" data-status="shipped" style="background:#dbeafe; color:#1e40af; border:1px solid #bfdbfe;">
                ✈ Enviado p/ Entrega
              </button>
              <button class="btn btn-sm order-set-status-btn" data-status="delivered" style="background:#d1fae5; color:#065f46; border:1px solid #a7f3d0;">
                ★ Entregue
              </button>
              <button class="btn btn-sm order-set-status-btn" data-status="cancelled" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;">
                ✕ Cancelar Pedido
              </button>
            </div>
          </div>

          <!-- Informações do Cliente -->
          <div class="admin-form-grid-2">
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Dados do Cliente</div>
              <div style="font-weight: 800; font-size: 1rem; margin-top: 4px;">${order.customer_name}</div>
              <div style="font-size: 0.875rem; color: var(--text-secondary);">${order.customer_email}</div>
              <div style="font-size: 0.875rem; color: var(--text-secondary);">${order.customer_phone}</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Endereço de Entrega (Luanda)</div>
              <div style="font-size: 0.875rem; color: var(--text-main); margin-top: 4px; line-height: 1.5;">
                ${order.shipping_address || 'Endereço não informado'}
              </div>
            </div>
          </div>

          <!-- Itens do Pedido -->
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">
              Itens Comprados
            </div>
            <div style="border: 1px solid var(--border-light); border-radius: var(--radius-md); overflow: hidden;">
              ${(order.items || []).map(i => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border-light); background: #ffffff;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    ${i.product_image ? `
                      <img src="${i.product_image}" alt="${i.product_name}" style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px; border: 1px solid var(--border-light); background: #f8fafc;" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
                      <div style="display: none; width: 40px; height: 40px; background: #f1f5f9; border-radius: 4px; align-items: center; justify-content: center; color: var(--text-muted);">
                        ${Icons.package(18)}
                      </div>
                    ` : `
                      <div style="width: 40px; height: 40px; background: #f1f5f9; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-muted);">
                        ${Icons.package(18)}
                      </div>
                    `}
                    <div>
                      <div style="font-weight: 700; font-size: 0.875rem;">${i.product_name}</div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">Qtd: ${i.quantity} x ${formatPrice(i.unit_price)}</div>
                    </div>
                  </div>
                  <div style="font-weight: 800; color: var(--primary-700);">${formatPrice(i.total_price || (i.unit_price * i.quantity))}</div>
                </div>
              `).join('')}
              <div style="padding: 14px 16px; background: #f8fafc; display: flex; justify-content: space-between; font-weight: 900; font-size: 1.05rem;">
                <span>Total a Pagar:</span>
                <span style="color: var(--primary-700);">${formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          <!-- Notas Internas do Admin -->
          <div class="form-group">
            <label class="form-label">Observações Internas da Operação (Visível apenas ao Admin):</label>
            <textarea id="orderAdminNotes" class="form-input" rows="2" placeholder="Ex: Cliente solicitou entrega após as 14h; comprovativo verificado no Multicaixa Express.">${order.admin_notes || ''}</textarea>
            <button id="saveOrderNotesBtn" class="btn btn-secondary btn-sm" style="margin-top: 6px;">Salvar Notas</button>
          </div>
        </div>

        <div class="admin-modal-footer">
          <button class="btn btn-secondary close-modal-btn">Fechar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Botões de Mudança de Status
    modal.querySelectorAll('.order-set-status-btn').forEach(b => {
      b.addEventListener('click', async () => {
        const newStatus = b.dataset.status;
        await Api.orders.updateStatus(order.id, newStatus);
        order.status = newStatus;
        Toast.show(`Status alterado para "${newStatus}"!`, 'success');
        modal.remove();
        render();
      });
    });

    // Salvar Notas
    const notesBtn = modal.querySelector('#saveOrderNotesBtn');
    if (notesBtn) {
      notesBtn.addEventListener('click', async () => {
        const notes = modal.querySelector('#orderAdminNotes').value.trim();
        await Api.orders.updateNotes(order.id, notes);
        order.admin_notes = notes;
        Toast.show('Observações internas salvas com sucesso!', 'success');
      });
    }
  }

  // 2. Modal de Criação / Edição de Produto (Controle Total)
  function openProductModal(prod = null) {
    const isEdit = Boolean(prod);
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog">
        <div class="admin-modal-header">
          <h3 class="admin-modal-title">${isEdit ? 'Editar Produto' : 'Cadastrar Novo Produto'}</h3>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>

        <form id="productForm" class="admin-modal-body">
          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Nome do Produto</label>
              <input type="text" id="pName" class="form-input" value="${prod?.name || ''}" placeholder="Ex: iPhone 16 Pro Max 256GB" required />
            </div>
            <div class="form-group">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <label class="form-label" style="margin-bottom:0;">Código SKU Único</label>
                <button type="button" id="btnGenSku" style="background:none; border:none; color:#2563eb; font-size:0.75rem; font-weight:700; cursor:pointer;">
                  ⚡ Gerar SKU
                </button>
              </div>
              <input type="text" id="pSku" class="form-input" value="${prod?.sku || ''}" placeholder="Ex: NV-APL-IP16-256" required />
            </div>
          </div>

          <div class="admin-form-grid-3">
            <div class="form-group">
              <label class="form-label">Marca</label>
              <input type="text" id="pBrand" class="form-input" value="${prod?.brand || 'Apple'}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Preço Normal (Kz)</label>
              <input type="number" id="pPrice" class="form-input" value="${prod?.price || ''}" placeholder="2798750" required />
            </div>
            <div class="form-group">
              <label class="form-label">Preço Promocional (Kz)</label>
              <input type="number" id="pOldPrice" class="form-input" value="${prod?.old_price || prod?.oldPrice || ''}" placeholder="3100000" />
            </div>
          </div>

          <div class="admin-form-grid-3">
            <div class="form-group">
              <label class="form-label">Categoria</label>
              <select id="pCategory" class="admin-filter-select" style="width:100%;">
                <option value="">Selecione a categoria</option>
                ${categoriesList.map(c => `
                  <option value="${c.id}" ${prod?.category_id === c.id ? 'selected' : ''}>${c.name}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Estoque Atual</label>
              <input type="number" id="pStock" class="form-input" value="${prod?.stock !== undefined ? prod.stock : 10}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Estoque Mínimo (Alerta)</label>
              <input type="number" id="pStockMin" class="form-input" value="${prod?.stock_min || 2}" required />
            </div>
          </div>

          <!-- Componente de Upload da Imagem Principal do Produto -->
          <div id="productImageUploaderMount" style="margin-bottom: 6px;"></div>

          <div class="form-group">
            <label class="form-label">URL do Vídeo Demonstrativo (Opcional - YouTube / Vimeo)</label>
            <input type="url" id="pVideo" class="form-input" value="${prod?.video_url || ''}" placeholder="https://youtube.com/watch?v=..." />
          </div>

          <div class="form-group">
            <label class="form-label">Descrição Completa</label>
            <textarea id="pDesc" class="form-input" rows="3" placeholder="Detalhes, especificações e recursos do equipamento...">${prod?.description || ''}</textarea>
          </div>

          <!-- Destaques Comerciais -->
          <div style="display: flex; gap: 16px; flex-wrap: wrap; background: #f8fafc; padding: 12px; border-radius: var(--radius-md);">
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.875rem; font-weight: 700; cursor: pointer;">
              <input type="checkbox" id="pIsDeal" ${prod?.is_deal ? 'checked' : ''} />
              <span>Oferta Especial (Deal)</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.875rem; font-weight: 700; cursor: pointer;">
              <input type="checkbox" id="pIsNew" ${prod?.is_new ? 'checked' : ''} />
              <span>Novidade</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.875rem; font-weight: 700; cursor: pointer;">
              <input type="checkbox" id="pIsFeatured" ${prod?.is_featured ? 'checked' : ''} />
              <span>Destaque Home</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.875rem; font-weight: 700; cursor: pointer;">
              <input type="checkbox" id="pAllowOutOfStock" ${prod?.allow_out_of_stock_sales ? 'checked' : ''} />
              <span>Permitir venda sem estoque</span>
            </label>
          </div>

          <div class="admin-modal-footer" style="padding: 0; margin-top: 10px;">
            <button type="button" class="btn btn-secondary close-modal-btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar Alterações' : 'Cadastrar Produto'}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Inicializa Componente de Upload de Imagem Direta
    const prodImgUploader = createImageUploader({
      id: 'prodImgUpload',
      label: 'Foto Principal do Produto',
      initialUrl: prod?.image || '',
      helperText: 'Tire uma foto com o celular ou selecione do computador (PNG, JPG, WEBP). Compressão automática ativada.',
      maxDimension: 1200
    });
    modal.querySelector('#productImageUploaderMount').appendChild(prodImgUploader.element);

    // Gerador de SKU Automático
    modal.querySelector('#btnGenSku')?.addEventListener('click', () => {
      const brand = modal.querySelector('#pBrand').value.trim() || 'NV';
      const name = modal.querySelector('#pName').value.trim() || 'PROD';
      const brandCode = brand.substring(0, 3).toUpperCase();
      const nameCode = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
      const rand = Math.floor(1000 + Math.random() * 9000);
      modal.querySelector('#pSku').value = `NV-${brandCode}-${nameCode}-${rand}`;
    });

    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#productForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const imageUrl = prodImgUploader.getValue().trim();
      if (!imageUrl) {
        Toast.show('Por favor, adicione uma foto para o produto.', 'warning');
        return;
      }

      const payload = {
        name: modal.querySelector('#pName').value.trim(),
        sku: modal.querySelector('#pSku').value.trim(),
        brand: modal.querySelector('#pBrand').value.trim(),
        price: Number(modal.querySelector('#pPrice').value),
        old_price: modal.querySelector('#pOldPrice').value ? Number(modal.querySelector('#pOldPrice').value) : null,
        category_id: modal.querySelector('#pCategory').value ? Number(modal.querySelector('#pCategory').value) : null,
        stock: Number(modal.querySelector('#pStock').value),
        stock_min: Number(modal.querySelector('#pStockMin').value),
        image: imageUrl,
        video_url: modal.querySelector('#pVideo').value.trim() || null,
        description: modal.querySelector('#pDesc').value.trim(),
        is_deal: modal.querySelector('#pIsDeal').checked,
        is_new: modal.querySelector('#pIsNew').checked,
        is_featured: modal.querySelector('#pIsFeatured').checked,
        allow_out_of_stock_sales: modal.querySelector('#pAllowOutOfStock').checked,
        is_active: true
      };

      try {
        if (isEdit) {
          await Api.products.update(prod.id, payload);
          Toast.show('Produto atualizado com sucesso!', 'success');
        } else {
          await Api.products.create(payload);
          Toast.show('Produto cadastrado com sucesso!', 'success');
        }
        modal.remove();
        await loadAllData();
        render();
      } catch (err) {
        Toast.show(err.message || 'Erro ao salvar produto.', 'error');
      }
    });
  }

  // 3. Modal de Categoria / Subcategoria
  function openCategoryModal(cat = null) {
    const isEdit = Boolean(cat);
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog">
        <div class="admin-modal-header">
          <h3 class="admin-modal-title">${isEdit ? 'Editar Categoria' : 'Nova Categoria ou Subcategoria'}</h3>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>

        <form id="categoryForm" class="admin-modal-body">
          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Nome da Categoria</label>
              <input type="text" id="catName" class="form-input" value="${cat?.name || ''}" placeholder="Ex: Smartphones" required />
            </div>
            <div class="form-group">
              <label class="form-label">Slug (URL amigável)</label>
              <input type="text" id="catSlug" class="form-input" value="${cat?.slug || ''}" placeholder="smartphones" />
            </div>
          </div>

          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Categoria Pai (Deixe vazio para Principal)</label>
              <select id="catParent" class="admin-filter-select" style="width:100%;">
                <option value="">Nenhuma (Categoria Principal)</option>
                ${categoriesList.filter(c => !cat || c.id !== cat.id).map(c => `
                  <option value="${c.id}" ${cat?.parent_id === c.id ? 'selected' : ''}>${c.name}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Ícone do Sistema</label>
              <select id="catIcon" class="admin-filter-select" style="width:100%;">
                <option value="smartphone" ${cat?.icon_name === 'smartphone' ? 'selected' : ''}>Smartphone / Celular</option>
                <option value="laptop" ${cat?.icon_name === 'laptop' ? 'selected' : ''}>Computador / Laptop</option>
                <option value="gamepad" ${cat?.icon_name === 'gamepad' ? 'selected' : ''}>Gaming / Games</option>
                <option value="tv" ${cat?.icon_name === 'tv' ? 'selected' : ''}>Televisões & Vídeo</option>
                <option value="headphones" ${cat?.icon_name === 'headphones' ? 'selected' : ''}>Áudio & Auscultadores</option>
                <option value="watch" ${cat?.icon_name === 'watch' ? 'selected' : ''}>Smartwatches / Wearables</option>
                <option value="server" ${cat?.icon_name === 'server' ? 'selected' : ''}>Redes & Servidores</option>
                <option value="cpu" ${cat?.icon_name === 'cpu' ? 'selected' : ''}>Periféricos & Acessórios</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Ordem de Exibição</label>
            <input type="number" id="catOrder" class="form-input" value="${cat?.display_order || (categoriesList.length + 1)}" required />
          </div>

          <!-- Componente de Upload Direto da Imagem da Categoria -->
          <div id="categoryImageUploaderMount" style="margin-bottom: 12px;"></div>

          <div class="form-group">
            <label class="form-label">Descrição da Categoria (SEO)</label>
            <textarea id="catDesc" class="form-input" rows="2" placeholder="Breve descrição da categoria...">${cat?.description || ''}</textarea>
          </div>

          <div class="admin-modal-footer" style="padding: 0;">
            <button type="button" class="btn btn-secondary close-modal-btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Criar Categoria'}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Inicializa Componente de Upload Direto de Imagem da Categoria
    const catImgUploader = createImageUploader({
      id: 'catImgUpload',
      label: 'Foto ou Ícone Gráfico da Categoria',
      initialUrl: cat?.image_url || '',
      helperText: 'Tire uma foto com o celular ou escolha da galeria/computador. Formatos: JPG, PNG, WEBP.',
      maxDimension: 800
    });
    modal.querySelector('#categoryImageUploaderMount').appendChild(catImgUploader.element);

    // Auto-gerador de Slug amigável ao digitar o nome
    const nameInput = modal.querySelector('#catName');
    const slugInput = modal.querySelector('#catSlug');
    nameInput.addEventListener('input', () => {
      if (!isEdit || !slugInput.value) {
        slugInput.value = nameInput.value
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '');
      }
    });

    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#categoryForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: modal.querySelector('#catName').value.trim(),
        slug: modal.querySelector('#catSlug').value.trim() || undefined,
        parent_id: modal.querySelector('#catParent').value ? Number(modal.querySelector('#catParent').value) : null,
        icon_name: modal.querySelector('#catIcon').value,
        display_order: Number(modal.querySelector('#catOrder').value),
        image_url: catImgUploader.getValue().trim() || null,
        description: modal.querySelector('#catDesc').value.trim(),
        is_active: true
      };

      try {
        if (isEdit) {
          await Api.categories.update(cat.id, payload);
          Toast.show('Categoria atualizada com sucesso!', 'success');
        } else {
          await Api.categories.create(payload);
          Toast.show('Categoria criada com sucesso!', 'success');
        }
        modal.remove();
        await loadAllData();
        render();
      } catch (err) {
        Toast.show(err.message || 'Erro ao salvar categoria.', 'error');
      }
    });
  }

  // 4. Modal de Catálogo / Coleção
  function openCatalogModal(cat = null) {
    const isEdit = Boolean(cat);
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog">
        <div class="admin-modal-header">
          <h3 class="admin-modal-title">${isEdit ? 'Editar Catálogo' : 'Novo Catálogo / Campanha'}</h3>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>

        <form id="catalogForm" class="admin-modal-body">
          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Nome do Catálogo</label>
              <input type="text" id="clName" class="form-input" value="${cat?.name || ''}" placeholder="Ex: Black Friday 2026" required />
            </div>
            <div class="form-group">
              <label class="form-label">Slug</label>
              <input type="text" id="clSlug" class="form-input" value="${cat?.slug || ''}" placeholder="black-friday" />
            </div>
          </div>

          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Badge Comercial</label>
              <input type="text" id="clBadge" class="form-input" value="${cat?.badge_text || ''}" placeholder="ATÉ 40% OFF" />
            </div>
            <div class="form-group">
              <label class="form-label">Ordem de Exibição</label>
              <input type="number" id="clOrder" class="form-input" value="${cat?.display_order || 1}" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Descrição Comercial</label>
            <textarea id="clDesc" class="form-input" rows="2">${cat?.description || ''}</textarea>
          </div>

          <div class="admin-modal-footer" style="padding:0;">
            <button type="button" class="btn btn-secondary close-modal-btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Criar Catálogo'}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#catalogForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: modal.querySelector('#clName').value.trim(),
        slug: modal.querySelector('#clSlug').value.trim() || undefined,
        badge_text: modal.querySelector('#clBadge').value.trim() || null,
        display_order: Number(modal.querySelector('#clOrder').value),
        description: modal.querySelector('#clDesc').value.trim(),
        is_active: true
      };

      try {
        if (isEdit) {
          await Api.catalogs.update(cat.id, payload);
          Toast.show('Catálogo atualizado!', 'success');
        } else {
          await Api.catalogs.create(payload);
          Toast.show('Catálogo criado!', 'success');
        }
        modal.remove();
        await loadAllData();
        render();
      } catch (err) {
        Toast.show(err.message || 'Erro ao salvar catálogo.', 'error');
      }
    });
  }

  // 5. Modal de Cupom Promocional
  function openCouponModal() {
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog">
        <div class="admin-modal-header">
          <h3 class="admin-modal-title">Novo Cupom de Desconto</h3>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>

        <form id="couponForm" class="admin-modal-body">
          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Código do Cupom</label>
              <input type="text" id="cpCode" class="form-input" placeholder="Ex: NOVA10" style="text-transform: uppercase;" required />
            </div>
            <div class="form-group">
              <label class="form-label">Tipo de Desconto</label>
              <select id="cpType" class="admin-filter-select" style="width:100%;">
                <option value="percent">Porcentagem (%)</option>
                <option value="fixed">Valor Fixo (Kz)</option>
                <option value="free_shipping">Frete Grátis</option>
              </select>
            </div>
          </div>

          <div class="admin-form-grid-3">
            <div class="form-group">
              <label class="form-label">Valor do Desconto</label>
              <input type="number" id="cpValue" class="form-input" placeholder="Ex: 10 ou 50000" required />
            </div>
            <div class="form-group">
              <label class="form-label">Valor Mínimo do Pedido (Kz)</label>
              <input type="number" id="cpMin" class="form-input" placeholder="0 para nenhum" value="0" />
            </div>
            <div class="form-group">
              <label class="form-label">Limite de Usos Totais</label>
              <input type="number" id="cpLimit" class="form-input" value="500" required />
            </div>
          </div>

          <div class="admin-modal-footer" style="padding:0;">
            <button type="button" class="btn btn-secondary close-modal-btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">Criar Cupom</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#couponForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        code: modal.querySelector('#cpCode').value.trim().toUpperCase(),
        discount_type: modal.querySelector('#cpType').value,
        discount_value: Number(modal.querySelector('#cpValue').value),
        min_order_value: Number(modal.querySelector('#cpMin').value) || 0,
        usage_limit: Number(modal.querySelector('#cpLimit').value) || 500,
        is_active: true
      };

      try {
        await Api.coupons.create(payload);
        Toast.show('Cupom criado com sucesso!', 'success');
        modal.remove();
        await loadAllData();
        render();
      } catch (err) {
        Toast.show(err.message || 'Erro ao criar cupom.', 'error');
      }
    });
  }

  // 6. Modal de Movimentação de Estoque
  function openStockMovementModal(preset = {}) {
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog">
        <div class="admin-modal-header">
          <h3 class="admin-modal-title">Registrar Movimentação de Estoque</h3>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>

        <form id="stockMovementForm" class="admin-modal-body">
          <div class="form-group">
            <label class="form-label">Selecione o Produto</label>
            <select id="smProduct" class="admin-filter-select" style="width:100%;" required>
              ${productsList.map(p => `
                <option value="${p.id}" ${preset.productId === p.id ? 'selected' : ''}>
                  ${p.name} (Atual: ${p.stock || 0} un)
                </option>
              `).join('')}
            </select>
          </div>

          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Tipo de Movimento</label>
              <select id="smType" class="admin-filter-select" style="width:100%;">
                <option value="in" ${preset.type === 'in' ? 'selected' : ''}>▲ Entrada (Recebimento de Fornecedor)</option>
                <option value="out">▼ Saída (Avaria / Descarte / Ajuste)</option>
                <option value="adjustment">● Balanço (Definir Estoque Exato)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Quantidade de Unidades</label>
              <input type="number" id="smQty" class="form-input" min="1" value="5" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Motivo / Justificativa</label>
            <input type="text" id="smReason" class="form-input" placeholder="Ex: Lote de importação recebido em Luanda" required />
          </div>

          <div class="admin-modal-footer" style="padding:0;">
            <button type="button" class="btn btn-secondary close-modal-btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">Registrar no Estoque</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#stockMovementForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        productId: Number(modal.querySelector('#smProduct').value),
        type: modal.querySelector('#smType').value,
        quantity: Number(modal.querySelector('#smQty').value),
        reason: modal.querySelector('#smReason').value.trim()
      };

      try {
        await Api.stock.recordMovement(payload);
        Toast.show('Estoque atualizado e registrado no histórico!', 'success');
        modal.remove();
        await loadAllData();
        render();
      } catch (err) {
        Toast.show(err.message || 'Erro ao registrar estoque.', 'error');
      }
    });
  }

  // 7. Modal Completo de Gestão de Banner (Upload Limpo da Arte Gráfica)
  function openBannerModal(banner = null) {
    const isEdit = Boolean(banner);
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog" style="max-width: 620px;">
        <div class="admin-modal-header">
          <div>
            <span class="badge" style="background:var(--primary-600); color:#fff; font-size:0.75rem;">ARTE DE BANNER DA VITRINE</span>
            <h3 class="admin-modal-title" style="margin-top: 4px;">${isEdit ? 'Editar Arte do Banner' : 'Subir Novo Banner para a Vitrine'}</h3>
          </div>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>

        <form id="bannerForm" class="admin-modal-body">
          <div class="form-group">
            <label class="form-label">Identificação / Título do Banner</label>
            <input 
              type="text" 
              id="bnTitle" 
              class="form-input" 
              value="${banner?.title || ''}" 
              placeholder="Ex: Campanha Topo de Gama NovaTech • iPhone 16 & Macs" 
              required 
            />
            <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 3px; display: block;">
              Usado para identificação na lista administrativa e acessibilidade (alt text). A imagem não terá textos automáticos por cima.
            </small>
          </div>

          <!-- Componente de Upload Direto da Arte do Banner -->
          <div id="bannerImageUploaderMount" style="margin-bottom: 12px;"></div>

          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Link de Destino ao Clicar</label>
              <input 
                type="text" 
                id="bnButtonLink" 
                class="form-input" 
                value="${banner?.button_link || '#/catalogo'}" 
                placeholder="#/catalogo ou link do produto" 
                required 
              />
            </div>
            <div class="form-group">
              <label class="form-label">Ordem no Carrossel</label>
              <input 
                type="number" 
                id="bnOrder" 
                class="form-input" 
                value="${banner?.display_order || (bannersList.length + 1)}" 
                min="1" 
                required 
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Status de Publicação</label>
            <select id="bnIsActive" class="admin-filter-select" style="width: 100%;">
              <option value="true" ${banner?.is_active !== false ? 'selected' : ''}>✓ Ativo na Vitrine (Visível para todos os clientes em rotação)</option>
              <option value="false" ${banner?.is_active === false ? 'selected' : ''}>✕ Oculto / Rascunho (Não exibir na página inicial)</option>
            </select>
          </div>

          <div class="admin-modal-footer" style="padding:0; margin-top: 12px;">
            <button type="button" class="btn btn-secondary close-modal-btn">Cancelar</button>
            <button type="submit" class="btn btn-primary" style="padding: 10px 24px;">${isEdit ? 'Salvar Alterações' : 'Publicar Banner'}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Inicializa Componente de Upload Direto para a Arte do Banner
    const bnImgUploader = createImageUploader({
      id: 'bnImgUpload',
      label: 'Arte do Banner Promocional',
      initialUrl: banner?.image_url || '',
      helperText: 'Tire uma foto ou suba a arte feita no Canva/Photoshop direto do seu telemóvel ou PC. Formato panorâmico (JPG, PNG, WEBP).',
      maxDimension: 1920
    });
    modal.querySelector('#bannerImageUploaderMount').appendChild(bnImgUploader.element);

    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#bannerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const imageUrl = bnImgUploader.getValue().trim();

      if (!imageUrl) {
        Toast.show('Por favor, selecione ou faça upload da imagem do banner antes de salvar.', 'warning');
        return;
      }

      const payload = {
        title: modal.querySelector('#bnTitle').value.trim() || 'Banner Promocional',
        image_url: imageUrl,
        button_link: modal.querySelector('#bnButtonLink').value.trim() || '#/catalogo',
        display_order: Number(modal.querySelector('#bnOrder').value) || 1,
        is_active: modal.querySelector('#bnIsActive').value === 'true',
        // Preserva valores limpos para compatibilidade de schema
        highlight: '',
        subtitle: '',
        badge_text: '',
        button_text: '',
        price: null,
        old_price: null,
        tag_badge: '',
        specs_badge: '',
        accent_color: '#3b82f6'
      };

      try {
        if (isEdit) {
          await Api.banners.update(banner.id, payload);
          Toast.show('Arte do banner atualizada com sucesso!', 'success');
        } else {
          await Api.banners.create(payload);
          Toast.show('Novo banner publicado na vitrine com sucesso!', 'success');
        }
        modal.remove();
        await loadAllData();
        render();
      } catch (err) {
        Toast.show(err.message || 'Erro ao salvar banner.', 'error');
      }
    });
  }

  // Executa checagem inicial
  init();

  return container;
}
