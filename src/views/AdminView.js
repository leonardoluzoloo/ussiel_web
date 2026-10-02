// ===================================================================
// ADMIN DASHBOARD VIEW (Enterprise Backoffice Suite)
// 100% Responsivo • Mobile-First • Sem SQL Exposto • UX Corporativa
// ===================================================================

import { Icons } from '../utils/icons.js';
import { formatPrice, formatDate } from '../utils/format.js';
import { Storage } from '../services/storage.js';
import { Api } from '../services/api.js';
import { Toast } from '../components/Toast.js';
import { isSupabaseConfigured } from '../services/supabaseClient.js';
import { createImageUploader } from '../utils/imageUpload.js';

export function renderAdminView() {
  const container = document.createElement('div');
  container.className = 'admin-backoffice-page';

  // Abas operacionais permitidas:
  // 'dashboard' | 'products' | 'categories' | 'banners' | 'orders' |
  // 'customers' | 'stock' | 'coupons' | 'catalogs' | 'settings'
  let currentTab = 'dashboard';
  let isLoading = true;
  let systemStatus = { has_admin: true, total_admins: 1 };

  // Estados dos dados
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
  let dashboardPeriod = 'today'; // 'today' | '7d' | '30d' | 'all'

  // 1. Inicialização
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
        console.warn('Sessão expirada:', err.message);
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
      console.warn('Erro ao carregar dados:', err.message);
    }
  }

  // 3. Renderizador Principal
  function render() {
    container.innerHTML = '';
    const currentUser = Storage.getUser();
    const isAdmin = currentUser && currentUser.role === 'admin';

    if (isLoading) {
      renderLoadingSkeleton();
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

  // Skeleton de Carregamento Elegante
  function renderLoadingSkeleton() {
    container.innerHTML = `
      <div style="min-height: 100vh; padding: 24px; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
        <div class="admin-skeleton" style="height: 64px; width: 100%;"></div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
          <div class="admin-skeleton" style="height: 100px;"></div>
          <div class="admin-skeleton" style="height: 100px;"></div>
          <div class="admin-skeleton" style="height: 100px;"></div>
          <div class="admin-skeleton" style="height: 100px;"></div>
        </div>
        <div class="admin-skeleton" style="height: 380px; width: 100%;"></div>
      </div>
    `;
  }

  // Tela de Criação do Primeiro Administrador
  function renderSetupScreen() {
    container.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: #f8fafc;">
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px 24px; width: 100%; max-width: 440px; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 52px; height: 52px; background: #2563eb; color: #fff; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
              ${Icons.user(28)}
            </div>
            <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin-bottom: 4px;">Configuração Inicial</h2>
            <p style="font-size: 0.8125rem; color: #64748b;">Cadastre a conta mestre para gerenciar a loja.</p>
          </div>

          <form id="adminSetupForm" style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label class="form-label">Nome Completo</label>
              <input type="text" id="setupName" class="form-input" placeholder="Ex: Leonardo Adriano" required />
            </div>
            <div class="form-group">
              <label class="form-label">E-mail Profissional</label>
              <input type="email" id="setupEmail" class="form-input" placeholder="admin@novatech.co.ao" required />
            </div>
            <div class="form-group">
              <label class="form-label">Senha de Acesso</label>
              <input type="password" id="setupPassword" class="form-input" placeholder="Mínimo de 6 dígitos" minlength="6" required />
            </div>
            <button type="submit" class="btn btn-primary" style="padding: 12px; font-weight: 700; margin-top: 6px;">
              Criar Conta e Acessar Painel
            </button>
          </form>
        </div>
      </div>
    `;

    container.querySelector('#adminSetupForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = container.querySelector('#setupName').value.trim();
      const email = container.querySelector('#setupEmail').value.trim();
      const password = container.querySelector('#setupPassword').value;

      try {
        const res = await Api.admin.setup({ name, email, password });
        Storage.saveUser(res.user);
        Toast.show('Administrador criado com sucesso!', 'success');
        systemStatus.has_admin = true;
        await loadAllData();
        render();
      } catch (err) {
        Toast.show(err.message || 'Erro ao criar conta administrativa.', 'error');
      }
    });
  }

  // Tela de Autenticação
  function renderLoginScreen() {
    container.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: #f8fafc;">
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px 24px; width: 100%; max-width: 420px; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 48px; height: 48px; background: #090d16; color: #38bdf8; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
              ${Icons.user(24)}
            </div>
            <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin-bottom: 4px;">Painel Administrativo</h2>
            <p style="font-size: 0.8125rem; color: #64748b;">Acesse com suas credenciais de gestor.</p>
          </div>

          <form id="adminLoginForm" style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label class="form-label">E-mail</label>
              <input type="email" id="loginEmail" class="form-input" placeholder="seu-email@novatech.co.ao" required />
            </div>
            <div class="form-group">
              <label class="form-label">Senha</label>
              <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" required />
            </div>
            <button type="submit" class="btn btn-primary" style="padding: 12px; font-weight: 700; margin-top: 6px;">
              Entrar no Painel
            </button>
            <div style="text-align: center; margin-top: 10px;">
              <a href="#/" style="font-size: 0.8125rem; color: #2563eb; text-decoration: none; font-weight: 600;">
                ← Voltar para a Loja
              </a>
            </div>
          </form>
        </div>
      </div>
    `;

    container.querySelector('#adminLoginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = container.querySelector('#loginEmail').value.trim();
      const password = container.querySelector('#loginPassword').value;

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
        Toast.show(err.message || 'Credenciais inválidas.', 'error');
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
            <button id="adminMobileDrawerToggleBtn" class="admin-mobile-drawer-btn" aria-label="Abrir Menu de Navegação" title="Menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div class="admin-enterprise-brand">
              <div class="admin-brand-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
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
            <a href="#/" class="admin-topbar-btn admin-topbar-btn-store" title="Visualizar a loja oficial como cliente" target="_blank" rel="noopener">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              <span>Ver Loja</span>
            </a>
            <button id="adminRefreshBtn" class="admin-topbar-btn" title="Sincronizar base de dados">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              <span class="desktop-only-txt">Sincronizar</span>
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

      <!-- 2. Drawer Lateral para Mobile (< 992px) - Sem barra horizontal de abas! -->
      <div class="admin-mobile-drawer-overlay" id="adminMobileDrawerOverlay"></div>
      <aside class="admin-mobile-drawer" id="adminMobileDrawer">
        <div class="admin-mobile-drawer-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="admin-brand-icon" style="width:28px; height:28px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <strong style="font-size:0.9375rem; color:#fff;">Menu Administrativo</strong>
          </div>
          <button id="adminMobileDrawerCloseBtn" style="background:none; border:none; color:#94a3b8; font-size:1.25rem; cursor:pointer; padding:4px;" aria-label="Fechar">✕</button>
        </div>
        <div class="admin-mobile-drawer-content">
          ${renderSidebarNavItems()}
        </div>
      </aside>

      <!-- 3. Workspace Principal Grid (Sidebar no Desktop + Conteúdo Central) -->
      <div class="admin-enterprise-body">
        <aside class="admin-enterprise-sidebar">
          ${renderSidebarNavItems()}
        </aside>

        <!-- Área Central de Trabalho -->
        <main class="admin-content-area" id="adminMainContent">
          ${renderActiveTabContent()}
        </main>
      </div>
    `;

    attachLayoutEvents();
  }

  // Gera a lista de navegação padronizada para Desktop Sidebar e Mobile Drawer
  function renderSidebarNavItems() {
    const lowStockCount = productsList.filter(p => (p.stock || 0) <= (p.stock_min || 2)).length;
    const pendingOrdersCount = ordersList.filter(o => o.status === 'received' || o.payment_status === 'pending').length;

    return `
      <div class="admin-sidebar-group-title">Geral</div>
      <div class="admin-nav-item ${currentTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
        <div class="admin-nav-item-left">${Icons.grid(18)}<span>Visão Geral</span></div>
      </div>

      <div class="admin-sidebar-group-title" style="margin-top:14px;">Catálogo</div>
      <div class="admin-nav-item ${currentTab === 'products' ? 'active' : ''}" data-tab="products">
        <div class="admin-nav-item-left">${Icons.package(18)}<span>Produtos</span></div>
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

      <div class="admin-sidebar-group-title" style="margin-top:14px;">Vendas</div>
      <div class="admin-nav-item ${currentTab === 'orders' ? 'active' : ''}" data-tab="orders">
        <div class="admin-nav-item-left">${Icons.truck(18)}<span>Pedidos</span></div>
        <span class="admin-nav-pill-badge" style="${pendingOrdersCount > 0 ? 'background:#f97316; color:#fff;' : ''}">${ordersList.length}</span>
      </div>
      <div class="admin-nav-item ${currentTab === 'customers' ? 'active' : ''}" data-tab="customers">
        <div class="admin-nav-item-left">${Icons.user(18)}<span>Clientes</span></div>
        <span class="admin-nav-pill-badge">${customersList.length}</span>
      </div>
      <div class="admin-nav-item ${currentTab === 'stock' ? 'active' : ''}" data-tab="stock">
        <div class="admin-nav-item-left">${Icons.cpu(18)}<span>Gestão de Estoque</span></div>
        ${lowStockCount > 0 ? `<span class="badge" style="background:#ef4444; color:#fff; font-size:0.6875rem;">${lowStockCount}⚠️</span>` : ''}
      </div>

      <div class="admin-sidebar-group-title" style="margin-top:14px;">Marketing</div>
      <div class="admin-nav-item ${currentTab === 'coupons' ? 'active' : ''}" data-tab="coupons">
        <div class="admin-nav-item-left">${Icons.tag(18)}<span>Cupons</span></div>
        <span class="admin-nav-pill-badge">${couponsList.length}</span>
      </div>
      <div class="admin-nav-item ${currentTab === 'catalogs' ? 'active' : ''}" data-tab="catalogs">
        <div class="admin-nav-item-left">${Icons.tag(18)}<span>Campanhas</span></div>
        <span class="admin-nav-pill-badge">${catalogsList.length}</span>
      </div>

      <div class="admin-sidebar-group-title" style="margin-top:14px;">Configurações</div>
      <div class="admin-nav-item ${currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
        <div class="admin-nav-item-left">${Icons.settings ? Icons.settings(18) : '⚙️'}<span>Loja & Equipe</span></div>
      </div>
    `;
  }

  // Despachante de Conteúdo da Aba Ativa
  function renderActiveTabContent() {
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
      default:
        return renderDashboardTab();
    }
  }

  // ===================================================================
  // ABA 1: VISÃO GERAL (DASHBOARD COMPACTO E RESPONSIVO)
  // ===================================================================
  function renderDashboardTab() {
    const totalSales = ordersList.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const lowStock = productsList.filter(p => (p.stock || 0) <= (p.stock_min || 2));
    const pendingOrders = ordersList.filter(o => o.status === 'received' || o.payment_status === 'pending');

    return `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- Header da Página com Filtro de Período -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h1 style="font-size:1.25rem; font-weight:800; color:#0f172a; margin-bottom:2px;">Visão Geral</h1>
            <p style="font-size:0.8125rem; color:#64748b;">Métricas em tempo real de vendas, pedidos e inventário.</p>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <select id="dashPeriodSelect" class="admin-filter-select" style="font-size:0.8125rem; padding:6px 12px;">
              <option value="today" ${dashboardPeriod === 'today' ? 'selected' : ''}>Hoje</option>
              <option value="7d" ${dashboardPeriod === '7d' ? 'selected' : ''}>Últimos 7 dias</option>
              <option value="30d" ${dashboardPeriod === '30d' ? 'selected' : ''}>Últimos 30 dias</option>
              <option value="all" ${dashboardPeriod === 'all' ? 'selected' : ''}>Histórico Geral</option>
            </select>
          </div>
        </div>

        <!-- 4 Cards Compactos de Métricas (2x2 no mobile, 4x1 no desktop) -->
        <div class="admin-stats-grid">
          <div class="stat-card">
            <div>
              <div class="stat-label">Vendas Totais</div>
              <div class="stat-val" style="color:#2563eb;">${formatPrice(totalSales)}</div>
            </div>
            <div style="color:#2563eb;">${Icons.creditCard(22)}</div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-label">Pedidos Recebidos</div>
              <div class="stat-val">${ordersList.length}</div>
            </div>
            <div style="color:#10b981;">${Icons.package(22)}</div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-label">Produtos Ativos</div>
              <div class="stat-val">${productsList.length}</div>
            </div>
            <div style="color:#8b5cf6;">${Icons.cpu(22)}</div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-label">Estoque Baixo</div>
              <div class="stat-val" style="${lowStock.length > 0 ? 'color:#ef4444;' : 'color:#64748b;'}">
                ${lowStock.length} ${lowStock.length === 1 ? 'item' : 'itens'}
              </div>
            </div>
            <div style="${lowStock.length > 0 ? 'color:#ef4444;' : 'color:#94a3b8;'}">${Icons.truck(22)}</div>
          </div>
        </div>

        <!-- Alertas Operacionais Rápidos (se houver) -->
        ${(pendingOrders.length > 0 || lowStock.length > 0) ? `
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:12px;">
            ${pendingOrders.length > 0 ? `
              <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div>
                  <strong style="color:#b45309; font-size:0.875rem;">📦 ${pendingOrders.length} Encomendas Aguardando</strong>
                  <div style="font-size:0.75rem; color:#78350f;">Existem pedidos recebidos para conferência.</div>
                </div>
                <button class="btn btn-secondary btn-sm" data-tab="orders" style="flex-shrink:0;">Revisar</button>
              </div>
            ` : ''}

            ${lowStock.length > 0 ? `
              <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div>
                  <strong style="color:#b91c1c; font-size:0.875rem;">⚠️ ${lowStock.length} Itens em Nível Crítico</strong>
                  <div style="font-size:0.75rem; color:#991b1b;">Reponha o inventário antes do esgotamento.</div>
                </div>
                <button class="btn btn-secondary btn-sm" data-tab="stock" style="flex-shrink:0;">Ver Estoque</button>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Pedidos Recentes: Tabela no Desktop, Cards no Mobile -->
        <div class="admin-card">
          <div class="admin-card-header">
            <h3 class="admin-card-title">
              ${Icons.package(18)}
              <span>Últimas Encomendas Realizadas</span>
            </h3>
            <button class="btn btn-secondary btn-sm" data-tab="orders">
              Ver Todos os Pedidos (${ordersList.length}) →
            </button>
          </div>

          ${ordersList.length === 0 ? `
            <div class="admin-empty-state">
              <div class="admin-empty-state-icon">${Icons.package(24)}</div>
              <div class="admin-empty-state-title">Nenhuma encomenda registrada ainda</div>
              <div class="admin-empty-state-desc">Os novos pedidos feitos pelos clientes aparecerão aqui automaticamente.</div>
            </div>
          ` : `
            <!-- Desktop: Tabela de Pedidos -->
            <div class="admin-table-wrapper admin-desktop-only">
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
                  ${ordersList.slice(0, 5).map(o => `
                    <tr>
                      <td><strong>${o.order_code}</strong></td>
                      <td>
                        <div>${o.customer_name}</div>
                        <div style="font-size:0.75rem; color:#64748b;">${o.customer_phone || ''}</div>
                      </td>
                      <td>${formatDate(o.created_at)}</td>
                      <td><strong style="color:#1d4ed8;">${formatPrice(o.total)}</strong></td>
                      <td>
                        <span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.6875rem;">
                          ${o.payment_method?.toUpperCase()}
                        </span>
                      </td>
                      <td>${renderStatusBadge(o.status)}</td>
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

            <!-- Mobile: Cards Responsivos de Pedidos -->
            <div class="admin-mobile-card-list admin-mobile-only">
              ${ordersList.slice(0, 5).map(o => `
                <div class="admin-res-card">
                  <div class="admin-res-card-header">
                    <div>
                      <strong style="font-size:0.9375rem; color:#0f172a;">${o.order_code}</strong>
                      <div style="font-size:0.75rem; color:#64748b;">${formatDate(o.created_at)}</div>
                    </div>
                    ${renderStatusBadge(o.status)}
                  </div>
                  <div class="admin-res-card-body">
                    <div class="admin-res-card-row">
                      <span>Cliente:</span>
                      <strong>${o.customer_name}</strong>
                    </div>
                    <div class="admin-res-card-row">
                      <span>Total:</span>
                      <strong style="color:#1d4ed8; font-size:0.9375rem;">${formatPrice(o.total)}</strong>
                    </div>
                  </div>
                  <div class="admin-res-card-actions">
                    <button class="btn btn-secondary btn-sm open-order-modal-btn" data-order-id="${o.id}">
                      Ver Detalhes do Pedido
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
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
          <div>
            <h2 class="admin-card-title">
              ${Icons.truck(20)}
              <span>Gestão de Pedidos (${ordersList.length})</span>
            </h2>
            <p style="font-size:0.8125rem; color:#64748b; margin-top:2px;">
              Acompanhe, atualize status de entrega e consulte o comprovativo dos pedidos.
            </p>
          </div>
        </div>

        <!-- Filtros de Busca e Status -->
        <div class="admin-filter-bar">
          <div class="admin-search-wrapper">
            <span class="admin-search-icon">${Icons.search(16)}</span>
            <input
              type="text"
              id="orderSearchInput"
              class="admin-search-input"
              placeholder="Buscar por código, nome ou telefone..."
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

        ${filtered.length === 0 ? `
          <div class="admin-empty-state">
            <div class="admin-empty-state-icon">${Icons.package(24)}</div>
            <div class="admin-empty-state-title">Nenhum pedido encontrado</div>
            <div class="admin-empty-state-desc">Tente alterar os termos de busca ou filtros de status selecionados.</div>
          </div>
        ` : `
          <!-- Desktop: Tabela de Pedidos -->
          <div class="admin-table-wrapper admin-desktop-only">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th>Data</th>
                  <th>Valor Total</th>
                  <th>Pagamento</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(o => `
                  <tr>
                    <td><strong>${o.order_code}</strong></td>
                    <td>${o.customer_name}</td>
                    <td>
                      <div>${o.customer_phone || '—'}</div>
                      <div style="font-size:0.75rem; color:#64748b;">${o.customer_email || ''}</div>
                    </td>
                    <td>${formatDate(o.created_at)}</td>
                    <td><strong style="color:#1d4ed8;">${formatPrice(o.total)}</strong></td>
                    <td>
                      <span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.6875rem;">
                        ${o.payment_method?.toUpperCase()}
                      </span>
                    </td>
                    <td>${renderStatusBadge(o.status)}</td>
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

          <!-- Mobile: Cards Responsivos de Pedidos -->
          <div class="admin-mobile-card-list admin-mobile-only">
            ${filtered.map(o => `
              <div class="admin-res-card">
                <div class="admin-res-card-header">
                  <div>
                    <strong style="font-size:0.9375rem; color:#0f172a;">${o.order_code}</strong>
                    <div style="font-size:0.75rem; color:#64748b;">${formatDate(o.created_at)}</div>
                  </div>
                  ${renderStatusBadge(o.status)}
                </div>
                <div class="admin-res-card-body">
                  <div class="admin-res-card-row">
                    <span>Cliente:</span>
                    <strong>${o.customer_name}</strong>
                  </div>
                  <div class="admin-res-card-row">
                    <span>Telefone:</span>
                    <span>${o.customer_phone || 'Não informado'}</span>
                  </div>
                  <div class="admin-res-card-row">
                    <span>Pagamento:</span>
                    <span>${o.payment_method?.toUpperCase()}</span>
                  </div>
                  <div class="admin-res-card-row">
                    <span>Total:</span>
                    <strong style="color:#1d4ed8; font-size:0.9375rem;">${formatPrice(o.total)}</strong>
                  </div>
                </div>
                <div class="admin-res-card-actions">
                  <button class="btn btn-secondary btn-sm open-order-modal-btn" data-order-id="${o.id}">
                    Ver Pedido
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  // ===================================================================
  // ABA 3: GESTÃO DE PRODUTOS
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
              ${Icons.package(20)}
              <span>Produtos (${productsList.length})</span>
            </h2>
            <p style="font-size:0.8125rem; color:#64748b; margin-top:2px;">
              Gerencie catálogo, preços, estoque e fotos dos produtos da loja.
            </p>
          </div>
          <button id="openNewProductModalBtn" class="btn btn-primary" style="gap:6px;">
            ${Icons.plus(16)}
            <span>+ Novo Produto</span>
          </button>
        </div>

        <!-- Filtros de Busca, Categoria e Estoque -->
        <div class="admin-filter-bar">
          <div class="admin-search-wrapper">
            <span class="admin-search-icon">${Icons.search(16)}</span>
            <input
              type="text"
              id="productSearchInput"
              class="admin-search-input"
              placeholder="Buscar por nome, marca ou SKU..."
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

        ${filtered.length === 0 ? `
          <div class="admin-empty-state">
            <div class="admin-empty-state-icon">${Icons.package(24)}</div>
            <div class="admin-empty-state-title">Nenhum produto cadastrado</div>
            <div class="admin-empty-state-desc">Cadastre seu primeiro produto para começar a montar o catálogo da sua loja.</div>
            <button class="btn btn-primary btn-sm" id="emptyStateNewProdBtn" style="margin-top:6px;">
              + Cadastrar Primeiro Produto
            </button>
          </div>
        ` : `
          <!-- Desktop: Tabela de Produtos -->
          <div class="admin-table-wrapper admin-desktop-only">
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
                ${filtered.map(p => `
                  <tr>
                    <td style="width: 52px;">
                      ${p.image ? `
                        <img
                          src="${p.image}"
                          alt="${p.name}"
                          style="width: 44px; height: 44px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; background: #ffffff;"
                        />
                      ` : `
                        <div style="width: 44px; height: 44px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #94a3b8; border: 1px solid #e2e8f0;">
                          ${Icons.package(18)}
                        </div>
                      `}
                    </td>
                    <td>
                      <div style="font-weight: 700; color: #0f172a;">${p.name}</div>
                      <div style="font-size: 0.75rem; color: #64748b; font-family: monospace;">SKU: ${p.sku || 'N/A'}</div>
                    </td>
                    <td><span class="badge" style="background:#f1f5f9; color:#475569;">${p.brand || 'Geral'}</span></td>
                    <td>
                      <div><strong style="color: #1d4ed8;">${formatPrice(p.price)}</strong></div>
                      ${p.old_price ? `<div style="font-size: 0.75rem; text-decoration: line-through; color: #94a3b8;">${formatPrice(p.old_price)}</div>` : ''}
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
                        <button class="btn btn-secondary btn-sm edit-product-btn" data-id="${p.id}" title="Editar">
                          Editar
                        </button>
                        <button class="btn btn-secondary btn-sm duplicate-product-btn" data-id="${p.id}" title="Duplicar">
                          Duplicar
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

          <!-- Mobile: Cards Responsivos de Produtos -->
          <div class="admin-mobile-card-list admin-mobile-only">
            ${filtered.map(p => {
      const cat = categoriesList.find(c => c.id === p.category_id);
      return `
                <div class="admin-res-card">
                  <div style="display:flex; gap:12px; align-items:center;">
                    ${p.image ? `
                      <img src="${p.image}" alt="${p.name}" style="width:54px; height:54px; object-fit:contain; border-radius:8px; border:1px solid #e2e8f0; background:#fff; flex-shrink:0;" />
                    ` : `
                      <div style="width:54px; height:54px; background:#f1f5f9; border-radius:8px; border:1px solid #e2e8f0; display:flex; align-items:center; justify-content:center; color:#94a3b8; flex-shrink:0;">
                        ${Icons.package(20)}
                      </div>
                    `}
                    <div style="flex:1; min-width:0;">
                      <div style="font-weight:700; color:#0f172a; font-size:0.9375rem; line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        ${p.name}
                      </div>
                      <div style="font-size:0.75rem; color:#64748b; font-family:monospace; margin-top:2px;">
                        SKU: ${p.sku || 'N/A'} • ${p.brand || 'Geral'}
                      </div>
                      <div style="margin-top:4px; display:flex; align-items:center; gap:6px;">
                        <strong style="color:#1d4ed8; font-size:0.9375rem;">${formatPrice(p.price)}</strong>
                        <span class="badge" style="font-size:0.6875rem; ${(p.stock || 0) <= 0 ? 'background:#fee2e2; color:#b91c1c;' : ((p.stock || 0) <= (p.stock_min || 2) ? 'background:#fef3c7; color:#b45309;' : 'background:#dcfce7; color:#15803d;')}">
                          ${p.stock || 0} un
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="admin-res-card-actions">
                    <button class="btn btn-secondary btn-sm edit-product-btn" data-id="${p.id}">
                      Editar
                    </button>
                    <button class="btn btn-secondary btn-sm duplicate-product-btn" data-id="${p.id}">
                      Duplicar
                    </button>
                    <button class="btn btn-sm delete-product-btn" data-id="${p.id}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; flex:0 0 40px;">
                      ✕
                    </button>
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        `}
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
              ${Icons.grid(20)}
              <span>Categorias (${categoriesList.length})</span>
            </h2>
            <p style="font-size:0.8125rem; color:#64748b; margin-top:2px;">
              Organize os produtos da sua loja por categorias e subcategorias.
            </p>
          </div>
          <button id="openNewCategoryModalBtn" class="btn btn-primary" style="gap:6px;">
            ${Icons.plus(16)}
            <span>+ Nova Categoria</span>
          </button>
        </div>

        ${categoriesList.length === 0 ? `
          <div class="admin-empty-state">
            <div class="admin-empty-state-icon">${Icons.grid(24)}</div>
            <div class="admin-empty-state-title">Nenhuma categoria cadastrada</div>
            <div class="admin-empty-state-desc">Cadastre categorias como Smartphones, Computadores ou Acessórios.</div>
            <button class="btn btn-primary btn-sm" id="emptyStateNewCatBtn" style="margin-top:6px;">
              + Nova Categoria
            </button>
          </div>
        ` : `
          <!-- Desktop: Tabela de Categorias -->
          <div class="admin-table-wrapper admin-desktop-only">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Ordem</th>
                  <th>Imagem / Ícone</th>
                  <th>Nome / Slug</th>
                  <th>Hierarquia</th>
                  <th>Produtos</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${categoriesList.map(c => {
      const parent = categoriesList.find(p => p.id === c.parent_id);
      const count = productsList.filter(p => p.category_id === c.id).length;
      return `
                    <tr>
                      <td><strong>#${c.display_order || 0}</strong></td>
                      <td style="width: 52px;">
                        ${c.image_url ? `
                          <img src="${c.image_url}" alt="${c.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;" />
                        ` : `
                          <div style="width: 40px; height: 40px; border-radius: 8px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center;">
                            ${Icons[c.icon_name] ? Icons[c.icon_name](18) : Icons.package(18)}
                          </div>
                        `}
                      </td>
                      <td>
                        <div style="font-weight: 700; color: #0f172a;">${c.name}</div>
                        <div style="font-size: 0.75rem; color: #64748b;">/categoria/${c.slug}</div>
                      </td>
                      <td>
                        ${parent ? `
                          <span class="badge" style="background: #eff6ff; color: #1d4ed8;">
                            ↳ Subcategoria de ${parent.name}
                          </span>
                        ` : `
                          <span class="badge" style="background: #f1f5f9; color: #0f172a; font-weight: 700;">
                            Categoria Principal
                          </span>
                        `}
                      </td>
                      <td>
                        <span class="badge" style="background: #f1f5f9; color: #475569;">
                          ${count} ${count === 1 ? 'produto' : 'produtos'}
                        </span>
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

          <!-- Mobile: Cards Responsivos de Categorias -->
          <div class="admin-mobile-card-list admin-mobile-only">
            ${categoriesList.map(c => {
      const parent = categoriesList.find(p => p.id === c.parent_id);
      const count = productsList.filter(p => p.category_id === c.id).length;
      return `
                <div class="admin-res-card">
                  <div style="display:flex; gap:12px; align-items:center;">
                    ${c.image_url ? `
                      <img src="${c.image_url}" alt="${c.name}" style="width:48px; height:48px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0; flex-shrink:0;" />
                    ` : `
                      <div style="width:48px; height:48px; border-radius:8px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        ${Icons[c.icon_name] ? Icons[c.icon_name](20) : Icons.package(20)}
                      </div>
                    `}
                    <div style="flex:1; min-width:0;">
                      <div style="font-weight:700; color:#0f172a; font-size:0.9375rem;">
                        ${c.name}
                      </div>
                      <div style="font-size:0.75rem; color:#64748b;">
                        slug: /categoria/${c.slug}
                      </div>
                      <div style="margin-top:4px; display:flex; gap:6px; flex-wrap:wrap;">
                        ${parent ? `
                          <span class="badge" style="background:#eff6ff; color:#1d4ed8; font-size:0.6875rem;">
                            ↳ Sub de ${parent.name}
                          </span>
                        ` : `
                          <span class="badge" style="background:#f1f5f9; color:#0f172a; font-size:0.6875rem;">
                            Principal
                          </span>
                        `}
                        <span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.6875rem;">
                          ${count} produtos
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="admin-res-card-actions">
                    <button class="btn btn-secondary btn-sm edit-category-btn" data-id="${c.id}">
                      Editar Categoria
                    </button>
                    <button class="btn btn-sm delete-category-btn" data-id="${c.id}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; flex:0 0 40px;">
                      ✕
                    </button>
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        `}
      </div>
    `;
  }

  // ===================================================================
  // ABA 5: BANNERS DA VITRINE (GRID VISUAL TOTAL)
  // ===================================================================
  function renderBannersTab() {
    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h2 class="admin-card-title">
              ${Icons.heart ? Icons.heart(20) : '🖼️'}
              <span>Banners da Vitrine Inicial (${bannersList.length})</span>
            </h2>
            <p style="font-size:0.8125rem; color:#64748b; margin-top:2px;">
              Envie artes limpas criadas no Canva ou Photoshop. Os banners aparecem na rotação da vitrine da loja.
            </p>
          </div>
          <button id="openNewBannerModalBtn" class="btn btn-primary" style="gap:6px;">
            ${Icons.plus(16)}
            <span>+ Novo Banner</span>
          </button>
        </div>

        ${bannersList.length === 0 ? `
          <div class="admin-empty-state">
            <div class="admin-empty-state-icon">🖼️</div>
            <div class="admin-empty-state-title">Nenhum banner ativo</div>
            <div class="admin-empty-state-desc">Suba uma imagem de divulgação para a página inicial com link direto para ofertas ou lançamentos.</div>
            <button class="btn btn-primary btn-sm" id="emptyStateNewBannerBtn" style="margin-top:6px;">
              + Subir Primeiro Banner
            </button>
          </div>
        ` : `
          <!-- Grid Visual de Banners (1 col no mobile, 2 ou 3 cols no desktop) -->
          <div class="admin-banners-grid">
            ${bannersList.map(b => `
              <div class="admin-banner-card">
                <div class="admin-banner-card-img-wrap">
                  <span class="admin-banner-card-order-badge">#${b.display_order || 1}</span>
                  <img
                    src="${b.image_url}"
                    alt="${b.title}"
                    class="admin-banner-card-img"
                    onerror="this.src='https://placehold.co/800x400/0f172a/38bdf8?text=Banner+NovaTech';"
                  />
                </div>
                <div class="admin-banner-card-body">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                    <div class="admin-banner-card-title">${b.title}</div>
                    <button class="btn btn-sm toggle-banner-active-btn" data-id="${b.id}" data-active="${b.is_active !== false}" style="${b.is_active !== false ? 'background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;' : 'background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;'}">
                      ${b.is_active !== false ? '✓ Ativo' : '✕ Oculto'}
                    </button>
                  </div>
                  <div class="admin-banner-card-link">
                    Destino: ${b.button_link || '#/catalogo'}
                  </div>
                  <div style="display:flex; gap:8px; margin-top:8px; border-top:1px solid #f1f5f9; padding-top:10px;">
                    <button class="btn btn-secondary btn-sm edit-banner-btn" data-id="${b.id}" style="flex:1; justify-content:center;">
                      Editar
                    </button>
                    <button class="btn btn-sm delete-banner-btn" data-id="${b.id}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; padding:6px 12px;">
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  // ===================================================================
  // ABA 6: CUPONS DE DESCONTO
  // ===================================================================
  function renderCouponsTab() {
    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h2 class="admin-card-title">
              ${Icons.tag(20)}
              <span>Cupons Promocionais (${couponsList.length})</span>
            </h2>
            <p style="font-size:0.8125rem; color:#64748b; margin-top:2px;">
              Crie códigos de desconto com valor percentual, fixo em Kwanzas ou frete grátis.
            </p>
          </div>
          <button id="openNewCouponModalBtn" class="btn btn-primary" style="gap:6px;">
            ${Icons.plus(16)}
            <span>+ Novo Cupom</span>
          </button>
        </div>

        ${couponsList.length === 0 ? `
          <div class="admin-empty-state">
            <div class="admin-empty-state-icon">${Icons.tag(24)}</div>
            <div class="admin-empty-state-title">Nenhum cupom cadastrado</div>
            <div class="admin-empty-state-desc">Crie cupons promocionais para fidelizar clientes no checkout.</div>
            <button class="btn btn-primary btn-sm" id="emptyStateNewCouponBtn" style="margin-top:6px;">
              + Criar Primeiro Cupom
            </button>
          </div>
        ` : `
          <!-- Desktop: Tabela de Cupons -->
          <div class="admin-table-wrapper admin-desktop-only">
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
                ${couponsList.map(c => `
                  <tr>
                    <td>
                      <code style="font-weight: 800; font-size: 0.9375rem; background: #f8fafc; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0; color: #1d4ed8;">
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

          <!-- Mobile: Cards de Cupons em Estilo Ticket -->
          <div class="admin-coupons-grid admin-mobile-only">
            ${couponsList.map(c => `
              <div class="admin-coupon-ticket">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <code style="font-size:1.125rem; font-weight:900; color:#1d4ed8;">${c.code}</code>
                  <span class="badge" style="${c.is_active !== false ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                    ${c.is_active !== false ? 'Ativo' : 'Pausado'}
                  </span>
                </div>
                <div style="font-size:1.25rem; font-weight:800; color:#0f172a;">
                  ${c.discount_type === 'percent' ? `${c.discount_value}% OFF` : (c.discount_type === 'free_shipping' ? 'Frete Grátis' : formatPrice(c.discount_value))}
                </div>
                <div style="font-size:0.75rem; color:#64748b;">
                  <div>Pedido mínimo: ${Number(c.min_order_value) > 0 ? formatPrice(c.min_order_value) : 'Sem valor mínimo'}</div>
                  <div>Usos: ${c.times_used || 0} / ${c.usage_limit || 'Ilimitado'}</div>
                </div>
                <div style="display:flex; gap:8px; border-top:1px dashed #cbd5e1; padding-top:10px; margin-top:4px;">
                  <button class="btn btn-secondary btn-sm toggle-coupon-active-btn" data-id="${c.id}" data-active="${c.is_active !== false}" style="flex:1;">
                    ${c.is_active !== false ? 'Pausar' : 'Ativar'}
                  </button>
                  <button class="btn btn-sm delete-coupon-btn" data-id="${c.id}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;">
                    Excluir
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  // ===================================================================
  // ABA 7: CAMPANHAS & CATÁLOGOS
  // ===================================================================
  function renderCatalogsTab() {
    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h2 class="admin-card-title">
              ${Icons.tag(20)}
              <span>Campanhas & Coleções (${catalogsList.length})</span>
            </h2>
            <p style="font-size:0.8125rem; color:#64748b; margin-top:2px;">
              Crie coleções especiais (Black Friday, Novidades de Verão, etc.) e vincule produtos.
            </p>
          </div>
          <button id="openNewCatalogModalBtn" class="btn btn-primary" style="gap:6px;">
            ${Icons.plus(16)}
            <span>+ Nova Campanha</span>
          </button>
        </div>

        ${catalogsList.length === 0 ? `
          <div class="admin-empty-state">
            <div class="admin-empty-state-icon">${Icons.tag(24)}</div>
            <div class="admin-empty-state-title">Nenhuma campanha criada</div>
            <div class="admin-empty-state-desc">Crie coleções temáticas para destacar grupos especiais de produtos.</div>
            <button class="btn btn-primary btn-sm" id="emptyStateNewCatalogBtn" style="margin-top:6px;">
              + Nova Campanha
            </button>
          </div>
        ` : `
          <div class="admin-catalogs-grid">
            ${catalogsList.map(c => `
              <div class="admin-catalog-card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                  <div>
                    <strong style="font-size:1rem; color:#0f172a;">${c.name}</strong>
                    <div style="font-size:0.75rem; color:#64748b; font-family:monospace;">slug: #${c.slug}</div>
                  </div>
                  <span class="badge" style="${c.is_active !== false ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                    ${c.is_active !== false ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                ${c.badge_text ? `
                  <div>
                    <span class="badge" style="background:#f97316; color:#ffffff; font-weight:700;">
                      ${c.badge_text}
                    </span>
                  </div>
                ` : ''}

                <div style="font-size:0.8125rem; color:#475569; line-height:1.4; flex:1;">
                  ${c.description || 'Sem descrição cadastrada.'}
                </div>

                <div style="display:flex; gap:8px; border-top:1px solid #f1f5f9; padding-top:10px;">
                  <button class="btn btn-secondary btn-sm edit-catalog-btn" data-id="${c.id}" style="flex:1;">
                    Editar
                  </button>
                  <button class="btn btn-sm delete-catalog-btn" data-id="${c.id}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;">
                    Excluir
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  // ===================================================================
  // ABA 8: CLIENTES
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
              ${Icons.user(20)}
              <span>Clientes Cadastrados (${customersList.length})</span>
            </h2>
            <p style="font-size:0.8125rem; color:#64748b; margin-top:2px;">
              Consulte dados de contato, morada e histórico de compras dos clientes.
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

        ${filtered.length === 0 ? `
          <div class="admin-empty-state">
            <div class="admin-empty-state-icon">${Icons.user(24)}</div>
            <div class="admin-empty-state-title">Nenhum cliente encontrado</div>
            <div class="admin-empty-state-desc">Os clientes que criarem conta ou realizarem pedidos aparecerão nesta lista.</div>
          </div>
        ` : `
          <!-- Desktop: Tabela de Clientes -->
          <div class="admin-table-wrapper admin-desktop-only">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Nome do Cliente</th>
                  <th>E-mail</th>
                  <th>Telefone</th>
                  <th>Endereço em Luanda</th>
                  <th>Total Comprado</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(c => `
                  <tr>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.email}</td>
                    <td>${c.phone || '<span style="color:#94a3b8;">Não informado</span>'}</td>
                    <td>
                      <div style="font-size:0.8125rem; max-width:200px; color:#0f172a; line-height:1.3;">
                        ${c.endereco || '<span style="color:#94a3b8;">Não informado</span>'}
                      </div>
                    </td>
                    <td><strong style="color:#1d4ed8;">${formatPrice(c.total_spent || 0)}</strong></td>
                    <td>
                      <span class="badge" style="${c.status !== 'blocked' ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                        ${c.status !== 'blocked' ? 'Ativo' : 'Bloqueado'}
                      </span>
                    </td>
                    <td>
                      <button class="btn btn-sm toggle-block-customer-btn" data-id="${c.id}" data-blocked="${c.status === 'blocked'}" style="${c.status === 'blocked' ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                        ${c.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Mobile: Cards de Clientes -->
          <div class="admin-mobile-card-list admin-mobile-only">
            ${filtered.map(c => `
              <div class="admin-res-card">
                <div class="admin-res-card-header">
                  <div>
                    <strong style="font-size:0.9375rem; color:#0f172a;">${c.name}</strong>
                    <div style="font-size:0.75rem; color:#64748b;">${c.email}</div>
                  </div>
                  <span class="badge" style="${c.status !== 'blocked' ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                    ${c.status !== 'blocked' ? 'Ativo' : 'Bloqueado'}
                  </span>
                </div>
                <div class="admin-res-card-body">
                  <div class="admin-res-card-row">
                    <span>Telefone:</span>
                    <span>${c.phone || 'Não informado'}</span>
                  </div>
                  <div class="admin-res-card-row">
                    <span>Endereço:</span>
                    <span style="max-width:180px; text-align:right;">${c.endereco || 'Não informado'}</span>
                  </div>
                  <div class="admin-res-card-row">
                    <span>Total Comprado:</span>
                    <strong style="color:#1d4ed8;">${formatPrice(c.total_spent || 0)}</strong>
                  </div>
                </div>
                <div class="admin-res-card-actions">
                  <button class="btn btn-sm toggle-block-customer-btn" data-id="${c.id}" data-blocked="${c.status === 'blocked'}" style="${c.status === 'blocked' ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                    ${c.status === 'blocked' ? 'Desbloquear Conta' : 'Bloquear Conta'}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  // ===================================================================
  // ABA 9: GESTÃO DE ESTOQUE
  // ===================================================================
  function renderStockTab() {
    const outOfStock = productsList.filter(p => (p.stock || 0) === 0);
    const lowStock = productsList.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= (p.stock_min || 2));
    const totalUnits = productsList.reduce((sum, p) => sum + (p.stock || 0), 0);

    return `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- Métricas Compactas de Estoque -->
        <div class="admin-stats-grid">
          <div class="stat-card">
            <div>
              <div class="stat-label">Itens Sem Estoque</div>
              <div class="stat-val" style="color:#ef4444;">${outOfStock.length}</div>
            </div>
            <div style="color:#ef4444;">${Icons.close(20)}</div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-label">Nível Crítico</div>
              <div class="stat-val" style="color:#f59e0b;">${lowStock.length}</div>
            </div>
            <div style="color:#f59e0b;">${Icons.truck(20)}</div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-label">Total em Depósito</div>
              <div class="stat-val" style="color:#2563eb;">${totalUnits} un</div>
            </div>
            <div style="color:#2563eb;">${Icons.package(20)}</div>
          </div>

          <div class="stat-card" style="display:flex; align-items:center; justify-content:center;">
            <button id="openRecordStockModalBtn" class="btn btn-primary" style="width:100%; justify-content:center; padding:10px; font-weight:700;">
              + Movimentar Estoque
            </button>
          </div>
        </div>

        <!-- Tabela e Lista de Estoque -->
        <div class="admin-card">
          <div class="admin-card-header">
            <h3 class="admin-card-title">
              ${Icons.cpu(18)}
              <span>Saldo de Estoque por Produto</span>
            </h3>
          </div>

          <!-- Desktop: Tabela de Estoque -->
          <div class="admin-table-wrapper admin-desktop-only">
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
                      <button class="btn btn-secondary btn-sm quick-add-stock-btn" data-id="${p.id}" data-name="${p.name}">
                        + Ajustar Saldo
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Mobile: Cards de Estoque -->
          <div class="admin-mobile-card-list admin-mobile-only">
            ${productsList.map(p => `
              <div class="admin-res-card">
                <div class="admin-res-card-header">
                  <div>
                    <strong style="color:#0f172a; font-size:0.9375rem;">${p.name}</strong>
                    <div style="font-size:0.75rem; color:#64748b; font-family:monospace;">SKU: ${p.sku || 'N/A'}</div>
                  </div>
                  <span class="badge" style="${(p.stock || 0) <= 0 ? 'background:#fee2e2; color:#b91c1c;' : ((p.stock || 0) <= (p.stock_min || 2) ? 'background:#fef3c7; color:#b45309;' : 'background:#dcfce7; color:#15803d;')}">
                    ${p.stock || 0} un
                  </span>
                </div>
                <div class="admin-res-card-actions">
                  <button class="btn btn-secondary btn-sm quick-add-stock-btn" data-id="${p.id}" data-name="${p.name}">
                    + Ajustar Saldo
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ===================================================================
  // ABA 10: CONFIGURAÇÕES DA LOJA & EQUIPE
  // ===================================================================
  function renderSettingsTab() {
    const s = storeSettings;
    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h2 class="admin-card-title">
              ${Icons.settings ? Icons.settings(20) : '⚙️'}
              <span>Configurações da Loja</span>
            </h2>
            <p style="font-size:0.8125rem; color:#64748b; margin-top:2px;">
              Edite a identificação da loja, contatos em Luanda, taxas de entrega e políticas comerciais.
            </p>
          </div>
        </div>

        <form id="storeSettingsForm" style="display:flex; flex-direction:column; gap:16px;">
          <!-- 1. Identidade e Contatos -->
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
            <h4 style="font-size:0.875rem; font-weight:800; color:#0f172a; margin-bottom:12px;">
              1. Identidade & Contatos em Luanda
            </h4>
            <div class="admin-form-grid-2">
              <div class="form-group">
                <label class="form-label">Nome da Loja</label>
                <input type="text" id="setStoreName" class="form-input" value="${s.store_name || 'NovaTech Angola'}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Slogan Comercial</label>
                <input type="text" id="setSlogan" class="form-input" value="${s.slogan || 'Loja de Tecnologia e Smartphones'}" />
              </div>
            </div>

            <div class="admin-form-grid-3" style="margin-top:10px;">
              <div class="form-group">
                <label class="form-label">Telefone Principal</label>
                <input type="tel" id="setPhone" class="form-input" value="${s.phone || '+244 923 179 192'}" required />
              </div>
              <div class="form-group">
                <label class="form-label">WhatsApp Oficial</label>
                <input type="tel" id="setWhatsapp" class="form-input" value="${s.whatsapp || '+244 923 179 192'}" required />
              </div>
              <div class="form-group">
                <label class="form-label">E-mail Comercial</label>
                <input type="email" id="setEmail" class="form-input" value="${s.email || 'contacto@novatech.co.ao'}" required />
              </div>
            </div>

            <div class="form-group" style="margin-top:10px;">
              <label class="form-label">Endereço Físico</label>
              <input type="text" id="setAddress" class="form-input" value="${s.address || 'Talatona, Luanda - Angola'}" required />
            </div>
          </div>

          <!-- 2. Custos de Envio -->
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
            <h4 style="font-size:0.875rem; font-weight:800; color:#0f172a; margin-bottom:12px;">
              2. Custos de Envio & Frete Grátis
            </h4>
            <div class="admin-form-grid-3">
              <div class="form-group">
                <label class="form-label">Entrega Normal (Kz)</label>
                <input type="number" id="setShippingNormal" class="form-input" value="${s.shipping_price_normal || 3500}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Entrega Expresso (Kz)</label>
                <input type="number" id="setShippingExpress" class="form-input" value="${s.shipping_price_express || 6500}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Frete Grátis Acima de (Kz)</label>
                <input type="number" id="setFreeShipping" class="form-input" value="${s.free_shipping_threshold || 1000000}" required />
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end;">
            <button type="submit" class="btn btn-primary" style="padding:12px 24px; font-weight:700;">
              Salvar Alterações da Loja
            </button>
          </div>
        </form>
      </div>
    `;
  }

  // --- HELPERS E BADGES ---
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

  // --- EVENT LISTENERS GLOBAIS DA ESTRUTURA DO ADMIN ---
  function attachLayoutEvents() {
    // Alternância de abas via Sidebar e Drawer
    container.querySelectorAll('.admin-nav-item, [data-tab]').forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.dataset.tab;
        if (tab && tab !== currentTab) {
          currentTab = tab;
          const main = container.querySelector('#adminMainContent');
          if (main) {
            main.innerHTML = renderActiveTabContent();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          // Atualiza estado ativo nos menus
          container.querySelectorAll('.admin-nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === currentTab);
          });
          attachTabSpecificEvents();
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
        Toast.show('Atualizando dados...', 'info');
        await loadAllData();
        render();
        Toast.show('Dados sincronizados com sucesso!', 'success');
      });
    }

    // Logout
    const logoutBtn = container.querySelector('#adminLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await Api.auth.logout();
        Storage.removeUser();
        Toast.show('Sessão encerrada.', 'info');
        render();
      });
    }

    attachTabSpecificEvents();
  }

  // Eventos específicos de cada tela/aba
  function attachTabSpecificEvents() {
    // --- Dashboard: Seletor de Período ---
    const periodSelect = container.querySelector('#dashPeriodSelect');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => {
        dashboardPeriod = e.target.value;
        const main = container.querySelector('#adminMainContent');
        if (main) main.innerHTML = renderDashboardTab();
        attachTabSpecificEvents();
      });
    }

    // --- Pedidos: Busca e Filtros ---
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

    container.querySelectorAll('.open-order-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.orderId);
        const order = ordersList.find(o => o.id === id);
        if (order) openOrderDetailsModal(order);
      });
    });

    // --- Produtos: Busca, Filtros e Modais ---
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
    const emptyNewProdBtn = container.querySelector('#emptyStateNewProdBtn');
    if (newProdBtn) newProdBtn.addEventListener('click', () => openProductModal());
    if (emptyNewProdBtn) emptyNewProdBtn.addEventListener('click', () => openProductModal());

    container.querySelectorAll('.edit-product-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const prod = productsList.find(p => p.id === id);
        if (prod) openProductModal(prod);
      });
    });

    container.querySelectorAll('.duplicate-product-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const prod = productsList.find(p => p.id === id);
        if (prod) duplicateProduct(prod);
      });
    });

    container.querySelectorAll('.toggle-product-active-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const isActive = btn.dataset.active === 'true';
        try {
          await Api.products.update(id, { is_active: !isActive });
          Toast.show(`Produto ${!isActive ? 'ativado' : 'desativado'} com sucesso!`, 'info');
          await loadAllData();
          render();
        } catch (err) {
          Toast.show(err.message || 'Erro ao alterar visibilidade.', 'error');
        }
      });
    });

    container.querySelectorAll('.delete-product-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        if (confirm('Tem certeza que deseja excluir permanentemente este produto?')) {
          try {
            await Api.products.delete(id);
            Toast.show('Produto removido com sucesso!', 'success');
            await loadAllData();
            render();
          } catch (err) {
            Toast.show(err.message || 'Erro ao excluir produto.', 'error');
          }
        }
      });
    });

    // --- Categorias ---
    const newCatBtn = container.querySelector('#openNewCategoryModalBtn');
    const emptyCatBtn = container.querySelector('#emptyStateNewCatBtn');
    if (newCatBtn) newCatBtn.addEventListener('click', () => openCategoryModal());
    if (emptyCatBtn) emptyCatBtn.addEventListener('click', () => openCategoryModal());

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
        if (confirm('Deseja excluir esta categoria? Os produtos vinculados perderão a categoria.')) {
          try {
            await Api.categories.delete(id);
            Toast.show('Categoria excluída.', 'success');
            await loadAllData();
            render();
          } catch (err) {
            Toast.show(err.message || 'Erro ao excluir categoria.', 'error');
          }
        }
      });
    });

    // --- Banners ---
    const newBannerBtn = container.querySelector('#openNewBannerModalBtn');
    const emptyBannerBtn = container.querySelector('#emptyStateNewBannerBtn');
    if (newBannerBtn) newBannerBtn.addEventListener('click', () => openBannerModal());
    if (emptyBannerBtn) emptyBannerBtn.addEventListener('click', () => openBannerModal());

    container.querySelectorAll('.edit-banner-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const banner = bannersList.find(b => b.id === id);
        if (banner) openBannerModal(banner);
      });
    });

    container.querySelectorAll('.toggle-banner-active-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const isActive = btn.dataset.active === 'true';
        try {
          await Api.banners.update(id, { is_active: !isActive });
          Toast.show(`Banner ${!isActive ? 'ativado na vitrine' : 'ocultado'}!`, 'info');
          await loadAllData();
          render();
        } catch (err) {
          Toast.show(err.message || 'Erro ao alterar status do banner.', 'error');
        }
      });
    });

    container.querySelectorAll('.delete-banner-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        if (confirm('Tem certeza que deseja remover este banner da vitrine?')) {
          try {
            await Api.banners.delete(id);
            Toast.show('Banner excluído com sucesso!', 'success');
            await loadAllData();
            render();
          } catch (err) {
            Toast.show(err.message || 'Erro ao excluir banner.', 'error');
          }
        }
      });
    });

    // --- Cupons ---
    const newCouponBtn = container.querySelector('#openNewCouponModalBtn');
    const emptyCouponBtn = container.querySelector('#emptyStateNewCouponBtn');
    if (newCouponBtn) newCouponBtn.addEventListener('click', () => openCouponModal());
    if (emptyCouponBtn) emptyCouponBtn.addEventListener('click', () => openCouponModal());

    container.querySelectorAll('.toggle-coupon-active-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const isActive = btn.dataset.active === 'true';
        try {
          await Api.coupons.update(id, { is_active: !isActive });
          Toast.show(`Cupom ${!isActive ? 'ativado' : 'pausado'}!`, 'info');
          await loadAllData();
          render();
        } catch (err) {
          Toast.show(err.message || 'Erro ao alterar cupom.', 'error');
        }
      });
    });

    container.querySelectorAll('.delete-coupon-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        if (confirm('Deseja excluir este cupom de desconto?')) {
          try {
            await Api.coupons.delete(id);
            Toast.show('Cupom excluído com sucesso!', 'success');
            await loadAllData();
            render();
          } catch (err) {
            Toast.show(err.message || 'Erro ao excluir cupom.', 'error');
          }
        }
      });
    });

    // --- Catálogos / Campanhas ---
    const newCatalogBtn = container.querySelector('#openNewCatalogModalBtn');
    const emptyCatalogBtn = container.querySelector('#emptyStateNewCatalogBtn');
    if (newCatalogBtn) newCatalogBtn.addEventListener('click', () => openCatalogModal());
    if (emptyCatalogBtn) emptyCatalogBtn.addEventListener('click', () => openCatalogModal());

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
        if (confirm('Deseja excluir esta campanha?')) {
          try {
            await Api.catalogs.delete(id);
            Toast.show('Campanha removida com sucesso!', 'success');
            await loadAllData();
            render();
          } catch (err) {
            Toast.show(err.message || 'Erro ao excluir campanha.', 'error');
          }
        }
      });
    });

    // --- Clientes: Busca e Bloqueio ---
    const custSearch = container.querySelector('#customerSearchInput');
    if (custSearch) {
      custSearch.addEventListener('input', (e) => {
        customerSearchQuery = e.target.value;
        const main = container.querySelector('#adminMainContent');
        if (main) main.innerHTML = renderCustomersTab();
        attachTabSpecificEvents();
      });
    }

    container.querySelectorAll('.toggle-block-customer-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const isBlocked = btn.dataset.blocked === 'true';
        try {
          await Api.customers.updateStatus(id, isBlocked ? 'active' : 'blocked');
          Toast.show(`Conta de cliente ${isBlocked ? 'desbloqueada' : 'bloqueada'}.`, 'info');
          await loadAllData();
          render();
        } catch (err) {
          Toast.show(err.message || 'Erro ao alterar status do cliente.', 'error');
        }
      });
    });

    // --- Estoque ---
    const recordStockBtn = container.querySelector('#openRecordStockModalBtn');
    if (recordStockBtn) recordStockBtn.addEventListener('click', () => openStockMovementModal());

    container.querySelectorAll('.quick-add-stock-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        openStockMovementModal({ product_id: id, movement_type: 'in' });
      });
    });

    // --- Configurações da Loja ---
    const storeForm = container.querySelector('#storeSettingsForm');
    if (storeForm) {
      storeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          store_name: container.querySelector('#setStoreName').value.trim(),
          slogan: container.querySelector('#setSlogan').value.trim(),
          phone: container.querySelector('#setPhone').value.trim(),
          whatsapp: container.querySelector('#setWhatsapp').value.trim(),
          email: container.querySelector('#setEmail').value.trim(),
          address: container.querySelector('#setAddress').value.trim(),
          shipping_price_normal: Number(container.querySelector('#setShippingNormal').value),
          shipping_price_express: Number(container.querySelector('#setShippingExpress').value),
          free_shipping_threshold: Number(container.querySelector('#setFreeShipping').value)
        };

        try {
          await Api.settings.save('general', payload);
          Toast.show('Configurações salvas com sucesso!', 'success');
          await loadAllData();
          render();
        } catch (err) {
          Toast.show(err.message || 'Erro ao salvar configurações.', 'error');
        }
      });
    }
  }

  // ===================================================================
  // MODAIS OPERACIONAIS COMPLETOS
  // ===================================================================

  // 1. Modal de Pedido
  function openOrderDetailsModal(order) {
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog">
        <div class="admin-modal-header">
          <div>
            <h3 class="admin-modal-title">Pedido ${order.order_code}</h3>
            <span style="font-size: 0.75rem; color: #64748b;">Realizado em ${formatDate(order.created_at)}</span>
          </div>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>

        <div class="admin-modal-body">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
            <h4 style="font-size: 0.8125rem; font-weight: 800; color: #0f172a; margin-bottom: 8px;">
              Dados do Comprador
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; font-size: 0.8125rem;">
              <div><strong>Nome:</strong> ${order.customer_name}</div>
              <div><strong>Telefone:</strong> ${order.customer_phone || 'Não informado'}</div>
              <div><strong>E-mail:</strong> ${order.customer_email || 'Não informado'}</div>
              <div><strong>Método Pagamento:</strong> ${order.payment_method?.toUpperCase()}</div>
            </div>
            <div style="margin-top: 8px; font-size: 0.8125rem;">
              <strong>Endereço de Entrega:</strong> ${order.shipping_address || 'Entrega padrão Luanda'}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Atualizar Status Operacional do Pedido</label>
            <select id="modalOrderStatusSelect" class="admin-filter-select" style="width: 100%;">
              <option value="received" ${order.status === 'received' ? 'selected' : ''}>Recebido</option>
              <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmado / Pago</option>
              <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Em Separação</option>
              <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Enviado / Saiu para Entrega</option>
              <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Entregue ao Cliente</option>
              <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
            </select>
          </div>

          <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background: #ffffff;">
            <div style="font-size: 0.8125rem; font-weight: 800; margin-bottom: 8px;">Resumo Financeiro</div>
            <div style="display:flex; justify-content:space-between; font-size:0.875rem; margin-bottom:4px;">
              <span>Subtotal:</span>
              <strong>${formatPrice(order.subtotal || order.total)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:1rem; font-weight:900; color:#1d4ed8; border-top:1px solid #f1f5f9; padding-top:6px;">
              <span>Total Oficial:</span>
              <span>${formatPrice(order.total)}</span>
            </div>
          </div>

          <div class="admin-modal-footer" style="padding: 0; margin-top: 10px;">
            <button class="btn btn-secondary close-modal-btn">Fechar</button>
            <button id="saveOrderStatusBtn" class="btn btn-primary">Salvar Novo Status</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#saveOrderStatusBtn').addEventListener('click', async () => {
      const newStatus = modal.querySelector('#modalOrderStatusSelect').value;
      try {
        await Api.orders.updateStatus(order.id, newStatus);
        Toast.show('Status do pedido atualizado com sucesso!', 'success');
        modal.remove();
        await loadAllData();
        render();
      } catch (err) {
        Toast.show(err.message || 'Erro ao atualizar pedido.', 'error');
      }
    });
  }

  // 2. Modal de Produto
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
                <label class="form-label" style="margin-bottom:0;">Código SKU</label>
                <button type="button" id="btnGenSku" style="background:none; border:none; color:#2563eb; font-size:0.75rem; font-weight:700; cursor:pointer;">
                  ⚡ Gerar SKU
                </button>
              </div>
              <input type="text" id="pSku" class="form-input" value="${prod?.sku || ''}" placeholder="NV-APL-IP16-256" required />
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
              <label class="form-label">Estoque Mínimo</label>
              <input type="number" id="pStockMin" class="form-input" value="${prod?.stock_min || 2}" required />
            </div>
          </div>

          <!-- Componente de Upload Direto da Foto com Pré-visualização -->
          <div id="productImageUploaderMount" style="margin-bottom: 6px;"></div>

          <div class="form-group">
            <label class="form-label">Descrição do Produto</label>
            <textarea id="pDesc" class="form-input" rows="3" placeholder="Detalhes, especificações e diferenciais do produto...">${prod?.description || ''}</textarea>
          </div>

          <!-- Destaques -->
          <div style="display: flex; gap: 14px; flex-wrap: wrap; background: #f8fafc; padding: 12px; border-radius: 10px;">
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8125rem; font-weight: 700; cursor: pointer;">
              <input type="checkbox" id="pIsDeal" ${prod?.is_deal ? 'checked' : ''} />
              <span>Oferta Especial</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8125rem; font-weight: 700; cursor: pointer;">
              <input type="checkbox" id="pIsNew" ${prod?.is_new ? 'checked' : ''} />
              <span>Novidade</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8125rem; font-weight: 700; cursor: pointer;">
              <input type="checkbox" id="pIsFeatured" ${prod?.is_featured ? 'checked' : ''} />
              <span>Destaque na Vitrine</span>
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

    const prodImgUploader = createImageUploader({
      id: 'prodImgUpload',
      label: 'Foto Principal do Produto',
      initialUrl: prod?.image || '',
      helperText: 'Tire uma foto ou escolha da galeria/computador. Compressão automática ativada.',
      maxDimension: 1200
    });
    modal.querySelector('#productImageUploaderMount').appendChild(prodImgUploader.element);

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
      const payload = {
        name: modal.querySelector('#pName').value.trim(),
        sku: modal.querySelector('#pSku').value.trim(),
        brand: modal.querySelector('#pBrand').value.trim(),
        price: Number(modal.querySelector('#pPrice').value),
        old_price: modal.querySelector('#pOldPrice').value ? Number(modal.querySelector('#pOldPrice').value) : null,
        category_id: modal.querySelector('#pCategory').value ? Number(modal.querySelector('#pCategory').value) : null,
        stock: Number(modal.querySelector('#pStock').value),
        stock_min: Number(modal.querySelector('#pStockMin').value),
        image: prodImgUploader.getValue().trim() || null,
        description: modal.querySelector('#pDesc').value.trim(),
        is_deal: modal.querySelector('#pIsDeal').checked,
        is_new: modal.querySelector('#pIsNew').checked,
        is_featured: modal.querySelector('#pIsFeatured').checked,
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

  // 3. Duplicar Produto Rápido
  async function duplicateProduct(prod) {
    try {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const payload = {
        ...prod,
        name: `${prod.name} (Cópia)`,
        sku: `${prod.sku || 'NV'}-CPY-${rand}`,
        id: undefined
      };
      await Api.products.create(payload);
      Toast.show('Produto duplicado com sucesso!', 'success');
      await loadAllData();
      render();
    } catch (err) {
      Toast.show(err.message || 'Erro ao duplicar produto.', 'error');
    }
  }

  // 4. Modal de Categoria
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
                <option value="package" ${cat?.icon_name === 'package' ? 'selected' : ''}>Geral / Variados</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Ordem de Exibição</label>
            <input type="number" id="catOrder" class="form-input" value="${cat?.display_order || (categoriesList.length + 1)}" required />
          </div>

          <div id="categoryImageUploaderMount" style="margin-bottom: 8px;"></div>

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

    const catImgUploader = createImageUploader({
      id: 'catImgUpload',
      label: 'Foto ou Ícone Gráfico da Categoria',
      initialUrl: cat?.image_url || '',
      helperText: 'Tire uma foto ou escolha da galeria/computador. Formatos: JPG, PNG, WEBP.',
      maxDimension: 800
    });
    modal.querySelector('#categoryImageUploaderMount').appendChild(catImgUploader.element);

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

  // 5. Modal de Banner (Arte Gráfica Limpa)
  function openBannerModal(banner = null) {
    const isEdit = Boolean(banner);
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog">
        <div class="admin-modal-header">
          <div>
            <span class="badge" style="background:#2563eb; color:#fff; font-size:0.6875rem;">ARTE DA VITRINE</span>
            <h3 class="admin-modal-title" style="margin-top: 4px;">${isEdit ? 'Editar Banner' : 'Novo Banner da Vitrine'}</h3>
          </div>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>

        <form id="bannerForm" class="admin-modal-body">
          <div class="form-group">
            <label class="form-label">Identificação / Título da Campanha</label>
            <input 
              type="text" 
              id="bnTitle" 
              class="form-input" 
              value="${banner?.title || ''}" 
              placeholder="Ex: Campanha Especial iPhone 16 & Apple" 
              required 
            />
            <small style="color: #64748b; font-size: 0.75rem; margin-top: 2px; display: block;">
              Identificação interna do banner e acessibilidade (alt text). A arte do banner é exibida limpa na vitrine.
            </small>
          </div>

          <div id="bannerImageUploaderMount" style="margin-bottom: 8px;"></div>

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
              <option value="true" ${banner?.is_active !== false ? 'selected' : ''}>✓ Ativo na Vitrine (Visível para clientes)</option>
              <option value="false" ${banner?.is_active === false ? 'selected' : ''}>✕ Oculto / Rascunho</option>
            </select>
          </div>

          <div class="admin-modal-footer" style="padding: 0; margin-top: 10px;">
            <button type="button" class="btn btn-secondary close-modal-btn">Cancelar</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar Alterações' : 'Publicar Banner'}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const bnImgUploader = createImageUploader({
      id: 'bnImgUpload',
      label: 'Arte do Banner Promocional',
      initialUrl: banner?.image_url || '',
      helperText: 'Tire uma foto ou suba a arte feita no Canva/Photoshop. Formato panorâmico (JPG, PNG, WEBP).',
      maxDimension: 1920
    });
    modal.querySelector('#bannerImageUploaderMount').appendChild(bnImgUploader.element);

    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#bannerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const imageUrl = bnImgUploader.getValue().trim();

      if (!imageUrl) {
        Toast.show('Por favor, selecione ou envie a imagem do banner.', 'warning');
        return;
      }

      const payload = {
        title: modal.querySelector('#bnTitle').value.trim() || 'Banner Promocional',
        image_url: imageUrl,
        button_link: modal.querySelector('#bnButtonLink').value.trim() || '#/catalogo',
        display_order: Number(modal.querySelector('#bnOrder').value) || 1,
        is_active: modal.querySelector('#bnIsActive').value === 'true',
        highlight: '',
        subtitle: '',
        badge_text: '',
        button_text: '',
        price: null,
        old_price: null,
        tag_badge: '',
        specs_badge: '',
        accent_color: '#2563eb'
      };

      try {
        if (isEdit) {
          await Api.banners.update(banner.id, payload);
          Toast.show('Banner atualizado com sucesso!', 'success');
        } else {
          await Api.banners.create(payload);
          Toast.show('Novo banner publicado na vitrine!', 'success');
        }
        modal.remove();
        await loadAllData();
        render();
      } catch (err) {
        Toast.show(err.message || 'Erro ao salvar banner.', 'error');
      }
    });
  }

  // 6. Modal de Cupom
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
              <input type="text" id="cpCode" class="form-input" placeholder="Ex: NOVATECH10" style="text-transform:uppercase; font-weight:800;" required />
            </div>
            <div class="form-group">
              <label class="form-label">Tipo de Desconto</label>
              <select id="cpType" class="admin-filter-select" style="width:100%;">
                <option value="percent">Porcentagem (%)</option>
                <option value="fixed">Valor Fixo em Kwanzas (Kz)</option>
                <option value="free_shipping">Frete Grátis</option>
              </select>
            </div>
          </div>

          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Valor do Desconto</label>
              <input type="number" id="cpValue" class="form-input" placeholder="Ex: 10 para 10% ou 5000 para Kz 5.000" required />
            </div>
            <div class="form-group">
              <label class="form-label">Valor Mínimo do Pedido (Kz)</label>
              <input type="number" id="cpMinOrder" class="form-input" placeholder="0 = Sem mínimo" />
            </div>
          </div>

          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Limite Total de Usos</label>
              <input type="number" id="cpLimit" class="form-input" placeholder="Ex: 100 (vazio = ilimitado)" />
            </div>
            <div class="form-group">
              <label class="form-label">Data de Expiração</label>
              <input type="date" id="cpExpiry" class="form-input" />
            </div>
          </div>

          <div class="admin-modal-footer" style="padding: 0;">
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
        min_order_value: modal.querySelector('#cpMinOrder').value ? Number(modal.querySelector('#cpMinOrder').value) : 0,
        usage_limit: modal.querySelector('#cpLimit').value ? Number(modal.querySelector('#cpLimit').value) : null,
        expires_at: modal.querySelector('#cpExpiry').value || null,
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

  // 7. Modal de Catálogo / Campanha
  function openCatalogModal(cat = null) {
    const isEdit = Boolean(cat);
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog">
        <div class="admin-modal-header">
          <h3 class="admin-modal-title">${isEdit ? 'Editar Campanha' : 'Nova Campanha Comercial'}</h3>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>

        <form id="catalogForm" class="admin-modal-body">
          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Nome da Campanha</label>
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
            <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Criar Campanha'}</button>
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
          Toast.show('Campanha atualizada!', 'success');
        } else {
          await Api.catalogs.create(payload);
          Toast.show('Campanha criada com sucesso!', 'success');
        }
        modal.remove();
        await loadAllData();
        render();
      } catch (err) {
        Toast.show(err.message || 'Erro ao salvar campanha.', 'error');
      }
    });
  }

  // 8. Modal de Movimentação de Estoque
  function openStockMovementModal(preset = {}) {
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog">
        <div class="admin-modal-header">
          <h3 class="admin-modal-title">Movimentação de Estoque</h3>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>

        <form id="stockMovementForm" class="admin-modal-body">
          <div class="form-group">
            <label class="form-label">Produto</label>
            <select id="smProduct" class="admin-filter-select" style="width:100%;" required>
              <option value="">Selecione o produto</option>
              ${productsList.map(p => `
                <option value="${p.id}" ${preset?.product_id === p.id ? 'selected' : ''}>
                  ${p.name} (Atual: ${p.stock} un)
                </option>
              `).join('')}
            </select>
          </div>

          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Tipo de Movimento</label>
              <select id="smType" class="admin-filter-select" style="width:100%;">
                <option value="in" ${preset?.movement_type === 'in' ? 'selected' : ''}>▲ Entrada (Adicionar ao depósito)</option>
                <option value="out" ${preset?.movement_type === 'out' ? 'selected' : ''}>▼ Saída (Remover do depósito)</option>
                <option value="adjustment">● Balanço / Ajuste Geral</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Quantidade</label>
              <input type="number" id="smQty" class="form-input" min="1" placeholder="Ex: 5" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Motivo ou Observação</label>
            <input type="text" id="smReason" class="form-input" placeholder="Ex: Chegada de remessa de fornecedor" required />
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
        product_id: Number(modal.querySelector('#smProduct').value),
        movement_type: modal.querySelector('#smType').value,
        quantity: Number(modal.querySelector('#smQty').value),
        reason: modal.querySelector('#smReason').value.trim()
      };

      try {
        await Api.stock.registerMovement(payload);
        Toast.show('Movimentação registrada com sucesso!', 'success');
        modal.remove();
        await loadAllData();
        render();
      } catch (err) {
        Toast.show(err.message || 'Erro ao registrar estoque.', 'error');
      }
    });
  }

  // Executa checagem inicial
  init();

  return container;
}
