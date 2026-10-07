// ===================================================================
// ADMIN DASHBOARD VIEW (Enterprise Backoffice Suite)
// 100% Responsivo • Mobile-First • Sem SQL Exposto • UX Corporativa
// ===================================================================

import { Icons } from '../utils/icons.js';
import { formatPrice, formatDate, formatAuthError } from '../utils/format.js';
import { Storage } from '../services/storage.js';
import { Api } from '../services/api.js';
import { Toast } from '../components/Toast.js';
import { isSupabaseConfigured } from '../services/supabaseClient.js';
import { createImageUploader, createMultiImageUploader, compressImageFile } from '../utils/imageUpload.js';

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
  let customerStatusFilter = 'all';
  let stockSearchQuery = '';
  let stockStatusFilter = 'all';
  let couponSearchQuery = '';
  let couponStatusFilter = 'all';
  let categorySearchQuery = '';
  let categorySortOrder = 'az'; // 'az' | 'za' | 'subs_desc' | 'recent'
  let expandedCategoryIds = new Set();
  let dashboardPeriod = 'today'; // 'today' | '7d' | '30d' | 'all'
  let profileSubTab = 'data'; // 'data' | 'security'
  let settingsSubTab = 'general'; // 'general' | 'shipping' | 'payments'
  let layoutMounted = false;

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

  // Extração inteligente da sub-rota administrativa a partir do hash da URL
  function getAdminSubRoute() {
    const hash = window.location.hash || '#/admin';
    const clean = hash.replace(/^#\/?/, '').split('?')[0]; // ex: 'admin/login', 'admin/dashboard', 'admin/orders'
    const parts = clean.split('/').filter(Boolean);
    return parts[1] || ''; // 'login' | 'register' | 'forgot-password' | 'reset-password' | 'dashboard' | 'orders' ...
  }

  // 3. Renderizador Principal & AdminRouteGuard
  function render() {
    const subRoute = getAdminSubRoute();
    const currentUser = Storage.getUser();
    const token = Api.getToken();
    const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.nivel_acesso === 'admin') && Boolean(token);
    const isCustomer = currentUser && currentUser.role === 'customer' && !isAdmin;

    if (isLoading) {
      layoutMounted = false;
      container.innerHTML = '';
      renderLoadingSkeleton();
      return;
    }

    // --- PROTEÇÃO DE ROTAS ADMINISTRATIVAS ---
    if (!isAdmin) {
      layoutMounted = false;
      container.innerHTML = '';

      if (subRoute === 'register') {
        renderRegisterScreen();
        return;
      }
      if (subRoute === 'forgot-password') {
        renderForgotPasswordScreen();
        return;
      }
      if (subRoute === 'reset-password') {
        renderResetPasswordScreen();
        return;
      }

      // Se tentar acessar diretamente qualquer rota administrativa sem sessão de admin:
      if (subRoute && !['login', 'register', 'forgot-password', 'reset-password'].includes(subRoute)) {
        if (isCustomer) {
          Toast.show('Você não possui permissão para acessar o painel administrativo.', 'warning');
        }
        window.history.replaceState(null, '', window.location.pathname + '#/admin/login');
      }

      renderLoginScreen(isCustomer ? 'Você está autenticado como cliente. Para acessar a área de gestão, informe uma conta de administrador.' : null);
      return;
    }

    // Se já autenticado como ADMIN e tentar acessar telas de login/register/forgot:
    if (['login', 'register', 'forgot-password', 'reset-password'].includes(subRoute)) {
      window.history.replaceState(null, '', window.location.pathname + `#/admin/${currentTab || 'dashboard'}`);
    } else if (!subRoute) {
      currentTab = currentTab || 'dashboard';
    } else {
      const mappedTab = (subRoute === 'inventory') ? 'stock' : (subRoute === 'campaigns' ? 'catalogs' : subRoute);
      const validTabs = ['dashboard', 'products', 'categories', 'banners', 'orders', 'customers', 'stock', 'coupons', 'catalogs', 'settings', 'profile'];
      currentTab = validTabs.includes(mappedTab) ? mappedTab : (currentTab || 'dashboard');
    }

    // Se já estiver montado o layout admin corporativo, preserva cabeçalho e sidebar
    const mainContent = container.querySelector('#adminMainContent');
    if (layoutMounted && mainContent) {
      mainContent.innerHTML = renderActiveTabContent();
      // Atualiza badges dinâmicos na sidebar sem reconstruir tudo
      const sidebars = container.querySelectorAll('.admin-enterprise-sidebar, .admin-mobile-drawer-content');
      sidebars.forEach(s => {
        s.innerHTML = renderSidebarNavItems();
      });
      container.querySelectorAll('.admin-nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === currentTab);
      });
      const topProfileBtn = container.querySelector('#adminTopProfileBtn');
      if (topProfileBtn) {
        topProfileBtn.classList.toggle('active', currentTab === 'profile');
      }
      attachTabSpecificEvents();
      return;
    }

    layoutMounted = true;
    container.innerHTML = '';
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
            <button type="submit" id="setupSubmitBtn" class="btn btn-primary" style="padding: 12px; font-weight: 700; margin-top: 6px;">
              Criar Conta e Acessar Painel
            </button>
          </form>
        </div>
      </div>
    `;

    container.querySelector('#adminSetupForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = container.querySelector('#setupSubmitBtn');
      const name = container.querySelector('#setupName').value.trim();
      const email = container.querySelector('#setupEmail').value.trim();
      const password = container.querySelector('#setupPassword').value;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Criando conta mestre...';

      try {
        const res = await Api.admin.setup({ name, email, password });
        if (res.requiresEmailConfirmation) {
          Toast.show({
            title: 'Conta criada! Confirme seu e-mail ✉️',
            message: `Enviamos um link de confirmação para ${email}. Acesse sua caixa de entrada para ativar o acesso.`,
            type: 'info',
            duration: 8000
          });
          window.location.hash = '#/admin/login';
          return;
        }

        if (res?.user) {
          Storage.saveUser(res.user);
        }
        Toast.show({
          title: 'Administrador configurado com sucesso! 🎉',
          message: `Bem-vindo(a), ${res?.user?.name || name}!`,
          type: 'success'
        });
        systemStatus.has_admin = true;
        window.location.hash = '#/admin/dashboard';
        await loadAllData();
        render();
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Criar Conta e Acessar Painel';
        Toast.show({
          title: 'Não foi possível criar a conta',
          message: formatAuthError(err),
          type: 'error'
        });
      }
    });
  }

  // 1. Tela de Autenticação Administrativa (Login Real)
  function renderLoginScreen(notice = null) {
    container.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; background: #0b0f19; box-sizing: border-box;">
        <div style="background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 28px 24px; width: 100%; max-width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); color: #f9fafb; box-sizing: border-box;">
          
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #2563eb, #38bdf8); color: #fff; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 10px; box-shadow: 0 4px 15px rgba(37,99,235,0.4);">
              ${Icons.user(24)}
            </div>
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px;">
              <h2 style="font-size: 1.25rem; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; margin: 0;">NOVATECH</h2>
              <span class="badge" style="background: #2563eb; color: #ffffff; font-size: 0.6875rem; font-weight: 800; padding: 2px 8px; border-radius: 6px;">ADMIN</span>
            </div>
            <p style="font-size: 0.8125rem; color: #9ca3af; margin: 0;">Central de Gestão e Controle Corporativo</p>
          </div>

          ${notice ? `
            <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; font-size: 0.8125rem; color: #fca5a5; display: flex; align-items: center; gap: 8px;">
              <span>⚠️</span>
              <span>${notice}</span>
            </div>
          ` : ''}

          <form id="adminLoginForm" style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group" style="margin-bottom: 0; width: 100%;">
              <label class="form-label" style="color: #d1d5db; font-size: 0.8125rem; font-weight: 600; margin-bottom: 6px;">E-mail do Administrador</label>
              <input 
                type="email" 
                id="loginEmail" 
                class="form-input" 
                placeholder="admin@novatech.co.ao" 
                style="background: #1f2937; border: 1px solid #374151; color: #ffffff; width: 100%; padding: 10px 14px; border-radius: 8px; font-size: 0.875rem; box-sizing: border-box;" 
                required 
                autocomplete="email"
              />
            </div>

            <div class="form-group" style="margin-bottom: 0; width: 100%;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="form-label" style="color: #d1d5db; font-size: 0.8125rem; font-weight: 600; margin-bottom: 0;">Senha de Acesso</label>
                <a href="#/admin/forgot-password" style="font-size: 0.75rem; color: #38bdf8; text-decoration: none; font-weight: 600;">
                  Esqueci minha senha
                </a>
              </div>
              <div style="position: relative; width: 100%; display: flex; align-items: center;">
                <input 
                  type="password" 
                  id="loginPassword" 
                  class="form-input" 
                  placeholder="••••••••" 
                  style="background: #1f2937; border: 1px solid #374151; color: #ffffff; width: 100%; padding: 10px 42px 10px 14px; border-radius: 8px; font-size: 0.875rem; box-sizing: border-box;" 
                  required 
                  autocomplete="current-password"
                />
                <button 
                  type="button" 
                  id="toggleLoginPwdBtn" 
                  style="position: absolute; right: 10px; background: none; border: none; color: #9ca3af; cursor: pointer; padding: 4px; font-size: 1rem; line-height: 1;"
                  title="Alternar visualização da senha"
                >
                  👁
                </button>
              </div>
            </div>

            <button type="submit" id="adminLoginSubmitBtn" class="btn btn-primary" style="width: 100%; padding: 11px; font-weight: 700; margin-top: 4px; background: #2563eb; border: none; border-radius: 8px; font-size: 0.875rem; cursor: pointer;">
              Entrar no Painel
            </button>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 0.8125rem; border-top: 1px solid #1f2937; padding-top: 14px;">
              <a href="#/admin/register" style="color: #38bdf8; text-decoration: none; font-weight: 600;">
                + Criar Conta de Gestor
              </a>
              <a href="#/" style="color: #9ca3af; text-decoration: none; font-weight: 500;">
                ← Voltar para a Loja
              </a>
            </div>
          </form>
        </div>
      </div>
    `;

    // Toggle de visualização de senha
    const toggleBtn = container.querySelector('#toggleLoginPwdBtn');
    const pwdInput = container.querySelector('#loginPassword');
    if (toggleBtn && pwdInput) {
      toggleBtn.addEventListener('click', () => {
        const isPwd = pwdInput.type === 'password';
        pwdInput.type = isPwd ? 'text' : 'password';
        toggleBtn.textContent = isPwd ? '🔒' : '👁';
      });
    }

    container.querySelector('#adminLoginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = container.querySelector('#adminLoginSubmitBtn');
      const email = container.querySelector('#loginEmail').value.trim();
      const password = container.querySelector('#loginPassword').value;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Autenticando no servidor...';

      try {
        const res = await Api.auth.adminLogin(email, password);
        Storage.saveUser(res.user);
        const userName = res?.user?.name || 'Administrador';
        Toast.show({
          title: 'Login realizado com sucesso! 🎉',
          message: `Bem-vindo(a), ${userName}!`,
          type: 'success'
        });
        window.location.hash = '#/admin/dashboard';
        await loadAllData();
        render();
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Entrar no Painel';
        Toast.show({
          title: 'Falha no login administrativo',
          message: formatAuthError(err),
          type: 'error'
        });
      }
    });
  }

  // 2. Tela de Criação de Conta Administrativa (#/admin/register)
  async function renderRegisterScreen() {
    container.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 12px; background: #0b0f19; box-sizing: border-box;">
        <div style="background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 28px 24px; width: 100%; max-width: 440px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); color: #f9fafb; box-sizing: border-box; text-align: center;">
          <div style="color: #9ca3af; font-size: 0.875rem;">Verificando permissões de acesso...</div>
        </div>
      </div>
    `;

    let hasAdmin = true;
    try {
      const status = await Api.admin.getStatus();
      hasAdmin = Boolean(status.has_admin);
    } catch { }

    const currentUser = Storage.getUser();
    const isCallerAdmin = currentUser?.role === 'admin';

    // Se já existem administradores configurados e quem acessa NÃO é administrador logado:
    if (hasAdmin && !isCallerAdmin) {
      container.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 12px; background: #0b0f19; box-sizing: border-box;">
          <div style="background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 28px 24px; width: 100%; max-width: 440px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); color: #f9fafb; box-sizing: border-box; text-align: center;">
            <div style="width: 48px; height: 48px; background: #374151; color: #f59e0b; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <h2 style="font-size: 1.1875rem; font-weight: 800; color: #ffffff; margin-bottom: 8px;">Acesso Administrativo Restrito</h2>
            <p style="font-size: 0.8125rem; color: #9ca3af; line-height: 1.6; margin-bottom: 20px;">
              A plataforma já possui administradores configurados. Por segurança e conformidade com as regras de acesso, novas contas administrativas só podem ser cadastradas através do painel por um gestor autenticado.
            </p>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <a href="#/admin/login" class="btn btn-primary" style="padding: 10px; font-weight: 700; background: #2563eb; text-decoration: none; border-radius: 8px; font-size: 0.84375rem; text-align: center; color: #fff;">
                Fazer Login no Painel →
              </a>
              <a href="#/" style="color: #9ca3af; text-decoration: none; font-size: 0.8125rem; margin-top: 6px;">
                ← Voltar para a Loja
              </a>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const titleText = !hasAdmin ? 'Configurar Primeiro Administrador' : 'Criar Conta Administrativa';
    const descText = !hasAdmin ? 'Nenhum administrador detectado. Configure o gestor principal da plataforma.' : 'Cadastre um novo perfil de gestor da plataforma.';

    container.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; background: radial-gradient(circle at 50% 20%, #172554 0%, #080c14 70%); box-sizing: border-box;">
        <div style="background: rgba(17, 24, 39, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 28px 24px; width: 100%; max-width: 440px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); color: #f9fafb; box-sizing: border-box;">
          
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #10b981, #2563eb); color: #fff; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 10px; box-shadow: 0 6px 20px rgba(16,185,129,0.35);">
              ${Icons.user(22)}
            </div>
            <h2 style="font-size: 1.25rem; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; margin-bottom: 4px;">${titleText}</h2>
            <p style="font-size: 0.8125rem; color: #94a3b8; margin: 0; line-height: 1.4;">${descText}</p>
          </div>

          <form id="adminRegisterForm" style="display: flex; flex-direction: column; gap: 12px;">
            <div class="form-group" style="margin-bottom: 0; width: 100%;">
              <label class="form-label" style="color: #cbd5e1; font-size: 0.78125rem; font-weight: 600; margin-bottom: 4px; display: block;">Nome Completo *</label>
              <input 
                type="text" 
                id="regName" 
                class="form-input" 
                placeholder="Ex: Leonardo Adriano" 
                style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; width: 100%; height: 44px; padding: 0 14px; border-radius: 10px; font-size: 0.875rem; box-sizing: border-box;" 
                required 
                minlength="2"
              />
            </div>

            <div class="form-group" style="margin-bottom: 0; width: 100%;">
              <label class="form-label" style="color: #cbd5e1; font-size: 0.78125rem; font-weight: 600; margin-bottom: 4px; display: block;">E-mail Profissional *</label>
              <input 
                type="email" 
                id="regEmail" 
                class="form-input" 
                placeholder="gestor@novatech.co.ao" 
                style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; width: 100%; height: 44px; padding: 0 14px; border-radius: 10px; font-size: 0.875rem; box-sizing: border-box;" 
                required 
              />
            </div>

            <div class="form-group" style="margin-bottom: 0; width: 100%;">
              <label class="form-label" style="color: #cbd5e1; font-size: 0.78125rem; font-weight: 600; margin-bottom: 4px; display: block;">Telefone / WhatsApp</label>
              <input 
                type="tel" 
                id="regPhone" 
                class="form-input" 
                placeholder="+244 923 000 000" 
                style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; width: 100%; height: 44px; padding: 0 14px; border-radius: 10px; font-size: 0.875rem; box-sizing: border-box;" 
              />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; box-sizing: border-box;">
              <div class="form-group" style="margin-bottom: 0; min-width: 0;">
                <label class="form-label" style="color: #cbd5e1; font-size: 0.78125rem; font-weight: 600; margin-bottom: 4px; display: block;">Senha *</label>
                <div style="position: relative; width: 100%; display: flex; align-items: center;">
                  <input 
                    type="password" 
                    id="regPassword" 
                    class="form-input" 
                    placeholder="Mín. 6 dígitos" 
                    style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; width: 100%; height: 44px; padding: 0 36px 0 12px; border-radius: 10px; font-size: 0.875rem; box-sizing: border-box;" 
                    required 
                    minlength="6"
                  />
                  <button type="button" class="toggle-reg-pwd-btn" data-target="regPassword" style="position: absolute; right: 10px; background: none; border: none; color: #94a3b8; cursor: pointer; padding: 2px; font-size: 1rem; line-height: 1;" title="Mostrar/ocultar senha">👁</button>
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 0; min-width: 0;">
                <label class="form-label" style="color: #cbd5e1; font-size: 0.78125rem; font-weight: 600; margin-bottom: 4px; display: block;">Confirmar Senha *</label>
                <div style="position: relative; width: 100%; display: flex; align-items: center;">
                  <input 
                    type="password" 
                    id="regPasswordConfirm" 
                    class="form-input" 
                    placeholder="Repita a senha" 
                    style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; width: 100%; height: 44px; padding: 0 36px 0 12px; border-radius: 10px; font-size: 0.875rem; box-sizing: border-box;" 
                    required 
                    minlength="6"
                  />
                  <button type="button" class="toggle-reg-pwd-btn" data-target="regPasswordConfirm" style="position: absolute; right: 10px; background: none; border: none; color: #94a3b8; cursor: pointer; padding: 2px; font-size: 1rem; line-height: 1;" title="Mostrar/ocultar senha">👁</button>
                </div>
              </div>
            </div>

            <button type="submit" id="adminRegisterSubmitBtn" class="btn btn-primary" style="width: 100%; height: 46px; font-weight: 700; margin-top: 6px; background: linear-gradient(135deg, #2563eb, #1d4ed8); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; font-size: 0.875rem; cursor: pointer; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35); transition: all 0.2s;">
              Cadastrar Administrador
            </button>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 0.8125rem; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 12px;">
              <a href="#/admin/login" style="color: #38bdf8; text-decoration: none; font-weight: 600;">
                Já possuo conta. Entrar →
              </a>
              <a href="#/" style="color: #94a3b8; text-decoration: none; font-weight: 500;">
                ← Voltar para a Loja
              </a>
            </div>
          </form>
        </div>
      </div>
    `;

    container.querySelectorAll('.toggle-reg-pwd-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = container.querySelector(`#${targetId}`);
        if (input) {
          const isPwd = input.type === 'password';
          input.type = isPwd ? 'text' : 'password';
          btn.textContent = isPwd ? '🔒' : '👁';
        }
      });
    });

    container.querySelector('#adminRegisterForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = container.querySelector('#adminRegisterSubmitBtn');
      const name = container.querySelector('#regName').value.trim();
      const email = container.querySelector('#regEmail').value.trim();
      const phone = container.querySelector('#regPhone').value.trim();
      const password = container.querySelector('#regPassword').value;
      const confirmPassword = container.querySelector('#regPasswordConfirm').value;

      if (password !== confirmPassword) {
        Toast.show({
          title: 'Senhas não coincidem',
          message: 'A confirmação de senha digitada não é igual à senha informada.',
          type: 'warning'
        });
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Criando conta administrativa...';

      try {
        const res = await Api.auth.registerAdmin({ name, email, password, phone });
        if (res.requiresEmailConfirmation) {
          Toast.show({
            title: 'Conta criada! Confirme seu e-mail ✉️',
            message: `Enviamos um link de ativação para ${email}. Acesse sua caixa de entrada para liberar o acesso.`,
            type: 'info',
            duration: 8000
          });
          window.location.hash = '#/admin/login';
          return;
        }

        if (res?.user) {
          Storage.saveUser(res.user);
        }
        Toast.show({
          title: 'Conta administrativa criada com sucesso! 🎉',
          message: `Bem-vindo(a), ${res?.user?.name || name}!`,
          type: 'success'
        });
        window.location.hash = '#/admin/dashboard';
        await loadAllData();
        render();
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Cadastrar Administrador';
        Toast.show({
          title: 'Erro ao cadastrar administrador',
          message: formatAuthError(err),
          type: 'error'
        });
      }
    });
  }

  // 3. Tela de Recuperação de Senha (#/admin/forgot-password)
  function renderForgotPasswordScreen() {
    container.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; background: #0b0f19; box-sizing: border-box;">
        <div style="background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 28px 24px; width: 100%; max-width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); color: #f9fafb; box-sizing: border-box;">
          
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #f59e0b, #ef4444); color: #fff; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 10px; box-shadow: 0 4px 15px rgba(245,158,11,0.4);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <h2 style="font-size: 1.25rem; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; margin-bottom: 4px;">Recuperar Senha</h2>
            <p style="font-size: 0.8125rem; color: #9ca3af; margin: 0;">Informe seu e-mail de acesso para redefinir sua senha.</p>
          </div>

          <form id="adminForgotForm" style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group" style="margin-bottom: 0; width: 100%;">
              <label class="form-label" style="color: #d1d5db; font-size: 0.8125rem; font-weight: 600; margin-bottom: 6px;">E-mail Cadastrado *</label>
              <input 
                type="email" 
                id="forgotEmail" 
                class="form-input" 
                placeholder="admin@novatech.co.ao" 
                style="background: #1f2937; border: 1px solid #374151; color: #ffffff; width: 100%; padding: 10px 14px; border-radius: 8px; font-size: 0.875rem; box-sizing: border-box;" 
                required 
              />
            </div>

            <button type="submit" id="adminForgotSubmitBtn" class="btn btn-primary" style="width: 100%; padding: 11px; font-weight: 700; margin-top: 4px; background: #2563eb; border: none; border-radius: 8px; font-size: 0.875rem; cursor: pointer;">
              Enviar Link de Recuperação
            </button>

            <div style="text-align: center; margin-top: 6px; font-size: 0.8125rem; border-top: 1px solid #1f2937; padding-top: 14px;">
              <a href="#/admin/login" style="color: #38bdf8; text-decoration: none; font-weight: 600;">
                ← Voltar para o Login
              </a>
            </div>
          </form>
        </div>
      </div>
    `;

    container.querySelector('#adminForgotForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = container.querySelector('#adminForgotSubmitBtn');
      const email = container.querySelector('#forgotEmail').value.trim();

      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando instruções...';

      try {
        const res = await Api.auth.forgotPassword(email);
        Toast.show({
          title: 'Instruções Enviadas',
          message: res?.message || 'Se existir uma conta associada a este e-mail, enviaremos as instruções.',
          type: 'success'
        });
        container.querySelector('#adminForgotForm').innerHTML = `
          <div style="text-align: center; padding: 10px 0;">
            <div style="font-size: 2rem; margin-bottom: 8px;">📬</div>
            <h3 style="font-size: 1rem; font-weight: 700; color: #ffffff; margin-bottom: 6px;">Instruções Enviadas</h3>
            <p style="font-size: 0.8125rem; color: #9ca3af; line-height: 1.5; margin-bottom: 16px;">
              ${res.message}
            </p>
            <a href="#/admin/login" class="btn btn-primary" style="display: block; text-decoration: none; padding: 10px; font-weight: 700; border-radius: 8px;">
              Voltar ao Login
            </a>
          </div>
        `;
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar Link de Recuperação';
        Toast.show({
          title: 'Erro na solicitação',
          message: formatAuthError(err),
          type: 'error'
        });
      }
    });
  }

  // 4. Tela de Redefinição de Senha (#/admin/reset-password)
  function renderResetPasswordScreen() {
    container.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; background: #0b0f19; box-sizing: border-box;">
        <div style="background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 28px 24px; width: 100%; max-width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); color: #f9fafb; box-sizing: border-box;">
          
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #2563eb, #9333ea); color: #fff; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 10px; box-shadow: 0 4px 15px rgba(37,99,235,0.4);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <h2 style="font-size: 1.25rem; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; margin-bottom: 4px;">Nova Senha de Acesso</h2>
            <p style="font-size: 0.8125rem; color: #9ca3af; margin: 0;">Defina sua nova credencial de segurança.</p>
          </div>

          <form id="adminResetForm" style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group" style="margin-bottom: 0; width: 100%;">
              <label class="form-label" style="color: #d1d5db; font-size: 0.8125rem; font-weight: 600; margin-bottom: 6px;">Nova Senha *</label>
              <input 
                type="password" 
                id="resetPassword" 
                class="form-input" 
                placeholder="Mínimo de 6 caracteres" 
                style="background: #1f2937; border: 1px solid #374151; color: #ffffff; width: 100%; padding: 10px 14px; border-radius: 8px; font-size: 0.875rem; box-sizing: border-box;" 
                required 
                minlength="6"
              />
            </div>

            <div class="form-group" style="margin-bottom: 0; width: 100%;">
              <label class="form-label" style="color: #d1d5db; font-size: 0.8125rem; font-weight: 600; margin-bottom: 6px;">Confirmar Nova Senha *</label>
              <input 
                type="password" 
                id="resetPasswordConfirm" 
                class="form-input" 
                placeholder="Repita a nova senha" 
                style="background: #1f2937; border: 1px solid #374151; color: #ffffff; width: 100%; padding: 10px 14px; border-radius: 8px; font-size: 0.875rem; box-sizing: border-box;" 
                required 
                minlength="6"
              />
            </div>

            <button type="submit" id="adminResetSubmitBtn" class="btn btn-primary" style="width: 100%; padding: 11px; font-weight: 700; margin-top: 4px; background: #2563eb; border: none; border-radius: 8px; font-size: 0.875rem; cursor: pointer;">
              Salvar Nova Senha
            </button>

            <div style="text-align: center; margin-top: 6px; font-size: 0.8125rem; border-top: 1px solid #1f2937; padding-top: 14px;">
              <a href="#/admin/login" style="color: #38bdf8; text-decoration: none; font-weight: 600;">
                ← Voltar para o Login
              </a>
            </div>
          </form>
        </div>
      </div>
    `;

    container.querySelector('#adminResetForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = container.querySelector('#adminResetSubmitBtn');
      const password = container.querySelector('#resetPassword').value;
      const confirmPassword = container.querySelector('#resetPasswordConfirm').value;

      if (password !== confirmPassword) {
        Toast.show({
          title: 'Senhas não coincidem',
          message: 'A confirmação de senha digitada não é igual à senha informada.',
          type: 'warning'
        });
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Atualizando senha...';

      try {
        await Api.auth.resetPassword(password);
        Toast.show({
          title: 'Senha alterada com sucesso! 🎉',
          message: 'Faça login com a sua nova senha.',
          type: 'success'
        });
        window.location.hash = '#/admin/login';
        render();
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar Nova Senha';
        Toast.show({
          title: 'Erro ao redefinir senha',
          message: formatAuthError(err),
          type: 'error'
        });
      }
    });
  }

  // --- LAYOUT DA CENTRAL DE CONTROLE CORPORATIVA ---
  function renderDashboardLayout() {
    const user = Storage.getUser();
    const rawName = (user?.name || 'Administrador').trim();
    const firstName = rawName.split(' ')[0] || 'Administrador';

    container.innerHTML = `
      <!-- 1. Header Corporativo Executivo Equilibrado e Limpo -->
      <header class="admin-enterprise-topbar">
        <div class="admin-enterprise-topbar-inner">
          <div class="admin-enterprise-brand-group">
            <button id="adminMobileDrawerToggleBtn" class="admin-mobile-drawer-btn" aria-label="Abrir Menu de Navegação" title="Navegação">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div class="admin-enterprise-brand">
              <div class="admin-brand-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </div>
              <div class="admin-brand-text">
                <span class="admin-brand-title">NOVATECH</span>
                <span class="admin-brand-badge">ADMIN</span>
              </div>
            </div>
          </div>

          <div class="admin-enterprise-actions">
            <a href="#/" class="admin-topbar-link-store" title="Visualizar a loja oficial como cliente" target="_blank" rel="noopener">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              <span>Ver Loja</span>
            </a>
            
            <div class="admin-topbar-divider"></div>

            <div class="admin-profile-dropdown-wrapper" style="position: relative;">
              <button id="adminTopProfileBtn" class="admin-profile-btn ${currentTab === 'profile' ? 'active' : ''}" title="Menu do Administrador">
                <div class="admin-profile-avatar" style="display:flex; align-items:center; justify-content:center; background:#2563eb; color:#ffffff;">
                  ${Icons.user(16)}
                </div>
                <div class="admin-profile-meta">
                  <span class="admin-profile-name">${firstName}</span>
                  <span class="admin-profile-role">Gestor ▼</span>
                </div>
              </button>

              <div id="adminTopProfileDropdown" class="admin-profile-dropdown-menu" style="display: none; position: absolute; right: 0; top: 100%; margin-top: 8px; width: 220px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); padding: 8px; z-index: 1000;">
                <div style="padding: 8px 10px; border-bottom: 1px solid #f1f5f9; margin-bottom: 4px;">
                  <strong style="font-size: 0.8125rem; color: #0f172a; display: block;">${firstName}</strong>
                  <span style="font-size: 0.75rem; color: #64748b; display: block; word-break: break-all;">${user?.email || 'admin@novatech.co.ao'}</span>
                </div>
                <button class="admin-dropdown-item" data-tab="profile" style="width: 100%; text-align: left; background: none; border: none; padding: 8px 10px; border-radius: 6px; font-size: 0.8125rem; font-weight: 600; color: #334155; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                  ${Icons.user(16)} <span>Meu Perfil</span>
                </button>
                <button class="admin-dropdown-item" data-tab="settings" style="width: 100%; text-align: left; background: none; border: none; padding: 8px 10px; border-radius: 6px; font-size: 0.8125rem; font-weight: 600; color: #334155; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                  ${Icons.settings ? Icons.settings(16) : '⚙️'} <span>Configurações</span>
                </button>
                <div style="border-top: 1px solid #f1f5f9; margin: 4px 0;"></div>
                <button id="adminDropdownLogoutBtn" style="width: 100%; text-align: left; background: none; border: none; padding: 8px 10px; border-radius: 6px; font-size: 0.8125rem; font-weight: 700; color: #ef4444; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  <span>Sair do Painel</span>
                </button>
              </div>
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <strong style="font-size:0.9375rem; color:#fff;">Painel Administrativo</strong>
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
        <div class="admin-nav-item-left">${Icons.image ? Icons.image(18) : '🖼️'}<span>Banners da Vitrine</span></div>
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
        <div class="admin-nav-item-left">${Icons.settings ? Icons.settings(18) : '⚙️'}<span>Configurações da Loja</span></div>
      </div>

      <div class="admin-sidebar-group-title" style="margin-top:14px;">Administrador</div>
      <div class="admin-nav-item ${currentTab === 'profile' ? 'active' : ''}" data-tab="profile">
        <div class="admin-nav-item-left">${Icons.user(18)}<span>Meu Perfil</span></div>
      </div>
      <div class="admin-nav-item admin-nav-item-logout" id="sidebarLogoutBtn" title="Encerrar Sessão">
        <div class="admin-nav-item-left" style="color:#ef4444;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          <span style="font-weight:700;">Sair do Painel</span>
        </div>
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
      case 'profile':
        return renderProfileTab();
      default:
        return renderDashboardTab();
    }
  }

  // ===================================================================
  // ===================================================================
  // ABA 1: VISÃO GERAL (DASHBOARD COMPACTO E RESPONSIVO)
  // ===================================================================
  function renderDashboardTab() {
    // BUG-008: Cálculo de métricas com base no período selecionado
    const now = new Date();
    const periodOrders = ordersList.filter(o => {
      if (dashboardPeriod === 'all') return true;
      const orderDate = new Date(o.created_at || o.criado_em || o.date);
      if (isNaN(orderDate.getTime())) return true;
      if (dashboardPeriod === 'today') {
        return orderDate.toDateString() === now.toDateString();
      }
      if (dashboardPeriod === '7d') {
        const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 7;
      }
      if (dashboardPeriod === '30d') {
        const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 30;
      }
      return true;
    });

    const totalSales = periodOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const lowStock = productsList.filter(p => (p.stock || 0) <= (p.stock_min || 2));
    const pendingOrders = periodOrders.filter(o => o.status === 'received' || o.payment_status === 'pending');

    return `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- Header da Página com Filtro de Período -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h1 style="font-size:1.25rem; font-weight:800; color:#0f172a; margin-bottom:2px;">Visão Geral</h1>
            <p style="font-size:0.8125rem; color:#64748b;">Métricas em tempo real de vendas, pedidos e inventário (${dashboardPeriod === 'today' ? 'Hoje' : dashboardPeriod === '7d' ? 'Últimos 7 dias' : dashboardPeriod === '30d' ? 'Últimos 30 dias' : 'Histórico Completo'}).</p>
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
              <div class="stat-label">Vendas (${dashboardPeriod === 'today' ? 'Hoje' : dashboardPeriod === '7d' ? '7 dias' : dashboardPeriod === '30d' ? '30 dias' : 'Total'})</div>
              <div class="stat-val" style="color:#2563eb;">${formatPrice(totalSales)}</div>
            </div>
            <div style="color:#2563eb;">${Icons.creditCard(22)}</div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-label">Pedidos do Período</div>
              <div class="stat-val">${periodOrders.length}</div>
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
                  <div style="font-size:0.75rem; color:#78350f;">Existem pedidos pendentes ou para conferência.</div>
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
                  ${ordersList.slice(0, 5).map(o => {
      const cleanCode = String(o.order_code || o.codigo_pedido || o.id).replace(/^#/, '');
      return `
                    <tr>
                      <td style="font-family:ui-monospace, monospace; font-size:0.8125rem; font-weight:700; color:#334155;">${cleanCode}</td>
                      <td>
                        <div style="font-weight:600; color:#0f172a; font-size:0.875rem;">${o.customer_name || 'Cliente'}</div>
                        <div style="font-size:0.75rem; color:#64748b;">${o.customer_phone || ''}</div>
                      </td>
                      <td style="font-size:0.8125rem; color:#475569;">${formatDate(o.created_at)}</td>
                      <td><strong style="color:#0f172a; font-size:0.875rem;">${formatPrice(o.total)}</strong></td>
                      <td>
                        ${renderPaymentBadge(o.payment_status, o.payment_method)}
                      </td>
                      <td>${renderStatusBadge(o.status)}</td>
                      <td>
                        <button class="btn btn-secondary btn-sm open-order-modal-btn" data-order-id="${o.id}" style="font-size:0.75rem; padding:4px 10px;">
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  `;
    }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Mobile: Cards Responsivos de Pedidos -->
            <div class="admin-mobile-card-list admin-mobile-only">
              ${ordersList.slice(0, 5).map(o => {
      const cleanCode = String(o.order_code || o.codigo_pedido || o.id).replace(/^#/, '');
      return `
                <div class="admin-res-card">
                  <div class="admin-res-card-header">
                    <div>
                      <strong style="font-family:ui-monospace, monospace; font-size:0.875rem; color:#0f172a;">${cleanCode}</strong>
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
                      <span>Pagamento:</span>
                      ${renderPaymentBadge(o.payment_status, o.payment_method)}
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
              `;
    }).join('')}
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
      const q = orderSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(o =>
        String(o.id).includes(q) ||
        (o.order_code && o.order_code.toLowerCase().includes(q)) ||
        (o.codigo_pedido && o.codigo_pedido.toLowerCase().includes(q)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.customer_phone && o.customer_phone.toLowerCase().includes(q)) ||
        (o.customer_email && o.customer_email.toLowerCase().includes(q))
      );
    }

    return `
      <div class="admin-card" style="display:flex; flex-direction:column; min-height:100%; flex:1; box-sizing:border-box;">
        <div class="admin-card-header" style="margin-bottom:16px;">
          <div>
            <h2 class="admin-card-title">Pedidos (${ordersList.length})</h2>
          </div>
        </div>

        <!-- Filtros Rápidos Minimalistas -->
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:16px; flex-wrap:wrap;">
          <div style="flex:1; min-width:260px; max-width:360px;">
            <input
              type="text"
              id="orderSearchInput"
              class="form-input"
              placeholder="Buscar por código, cliente ou telefone..."
              value="${orderSearchQuery}"
              style="padding:7px 12px; font-size:0.875rem;"
            />
          </div>

          <select id="orderStatusFilterSelect" class="admin-filter-select" style="font-size:0.8125rem; padding:6px 10px;">
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
          <div class="admin-empty-state" style="padding:32px 16px;">
            <div class="admin-empty-state-title" style="font-size:1rem;">Nenhum pedido encontrado</div>
            <div style="font-size:0.8125rem; color:#64748b; margin-top:4px;">Nenhum registro corresponde aos filtros selecionados.</div>
          </div>
        ` : `
          <!-- Desktop: Tabela Corporativa de Pedidos -->
          <div class="admin-table-wrapper admin-desktop-only" style="border:1px solid #e2e8f0; border-radius:8px; overflow-x:auto; -webkit-overflow-scrolling:touch; min-height:300px; flex:1; background:#ffffff;">
            <table class="admin-table" style="min-width: 860px; width: 100%;">
              <thead>
                <tr>
                  <th style="width:110px;">Código</th>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th style="width:110px;">Data</th>
                  <th style="width:120px;">Valor Total</th>
                  <th style="width:130px;">Pagamento</th>
                  <th style="width:130px;">Status</th>
                  <th style="width:52px; text-align:center;">Ações</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(o => {
      const cleanCode = String(o.order_code || o.codigo_pedido || o.id).replace(/^#/, '');
      const itemsCount = (o.items || o.itens_pedido || []).length;
      const phone = o.customer_phone || o.telefone_cliente || '';
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('244') ? cleanPhone : '244' + cleanPhone}` : null;

      return `
                    <tr>
                      <td style="font-family:ui-monospace, monospace; font-size:0.8125rem; font-weight:700; color:#334155;">
                        ${cleanCode}
                      </td>
                      <td>
                        <div style="font-weight:600; color:#0f172a; font-size:0.875rem;">${o.customer_name || 'Cliente'}</div>
                      </td>
                      <td>
                        <div style="font-size:0.8125rem; color:#334155;">${phone || '—'}</div>
                        ${o.customer_email ? `<div style="font-size:0.75rem; color:#64748b;">${o.customer_email}</div>` : ''}
                      </td>
                      <td style="font-size:0.8125rem; color:#475569;">
                        ${formatDate(o.created_at)}
                      </td>
                      <td>
                        <div style="font-weight:700; color:#0f172a; font-size:0.875rem;">${formatPrice(o.total)}</div>
                        <div style="font-size:0.6875rem; color:#64748b;">${itemsCount} item${itemsCount !== 1 ? 's' : ''}</div>
                      </td>
                      <td>
                        ${renderPaymentBadge(o.payment_status, o.payment_method)}
                      </td>
                      <td>
                        ${renderStatusBadge(o.status)}
                      </td>
                      <td style="text-align:center; width:52px;">
                        <div class="admin-actions-dropdown">
                          <button type="button" class="admin-actions-trigger-btn" data-id="${o.id}" title="Ações do pedido">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                              <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
                              <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
                            </svg>
                          </button>
                          <div class="admin-actions-menu">
                            <button type="button" class="admin-action-item open-order-modal-btn" data-order-id="${o.id}">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                              <span>Ver Detalhes</span>
                            </button>
                            ${waLink ? `
                              <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="admin-action-item" style="text-decoration:none;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                <span style="color:#15803d;">WhatsApp</span>
                              </a>
                            ` : ''}
                            <button type="button" class="admin-action-item copy-order-code-btn" data-code="${cleanCode}">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                              <span>Copiar Código</span>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  `;
    }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Mobile: Cards Responsivos de Pedidos -->
          <div class="admin-mobile-card-list admin-mobile-only">
            ${filtered.map(o => {
      const cleanCode = String(o.order_code || o.codigo_pedido || o.id).replace(/^#/, '');
      return `
                <div class="admin-res-card" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:10px;">
                  <div class="admin-res-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                      <strong style="font-family:ui-monospace, monospace; font-size:0.875rem; color:#0f172a;">${cleanCode}</strong>
                      <div style="font-size:0.75rem; color:#64748b;">${formatDate(o.created_at)}</div>
                    </div>
                    ${renderStatusBadge(o.status)}
                  </div>
                  <div class="admin-res-card-body" style="display:flex; flex-direction:column; gap:6px; font-size:0.8125rem; border-top:1px solid #f1f5f9; padding-top:8px;">
                    <div style="display:flex; justify-content:space-between;">
                      <span style="color:#64748b;">Cliente:</span>
                      <strong style="color:#0f172a;">${o.customer_name || 'Cliente'}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <span style="color:#64748b;">Pagamento:</span>
                      ${renderPaymentBadge(o.payment_status, o.payment_method)}
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <span style="color:#64748b;">Total:</span>
                      <strong style="color:#0f172a; font-size:0.9375rem;">${formatPrice(o.total)}</strong>
                    </div>
                  </div>
                  <div class="admin-res-card-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px; padding-top:8px; border-top:1px solid #f1f5f9;">
                    <button class="btn btn-secondary btn-sm open-order-modal-btn" data-order-id="${o.id}" style="font-size:0.8125rem; padding:6px 12px;">
                      Ver Detalhes
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
      const q = productSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(p =>
        String(p.id).includes(q) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      );
    }

    return `
      <div class="admin-card" style="display:flex; flex-direction:column; min-height:100%; flex:1; box-sizing:border-box;">
        <div class="admin-card-header" style="margin-bottom:16px;">
          <div>
            <h2 class="admin-card-title">Produtos (${productsList.length})</h2>
          </div>
          <button id="openNewProductModalBtn" class="btn btn-primary btn-sm" style="font-weight:600; padding:8px 16px;">
            + Novo Produto
          </button>
        </div>

        <!-- Filtros Rápidos Minimalistas -->
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:16px; flex-wrap:wrap;">
          <div style="flex:1; min-width:260px; max-width:360px;">
            <input
              type="text"
              id="productSearchInput"
              class="form-input"
              placeholder="Buscar por ID, nome, marca ou SKU..."
              value="${productSearchQuery}"
              style="padding:7px 12px; font-size:0.875rem;"
            />
          </div>

          <select id="productCatFilterSelect" class="admin-filter-select" style="font-size:0.8125rem; padding:6px 10px;">
            <option value="all">Todas as Categorias</option>
            ${categoriesList.map(c => `
              <option value="${c.id}" ${productCategoryFilter === String(c.id) ? 'selected' : ''}>${c.name}</option>
            `).join('')}
          </select>

          <select id="productStockFilterSelect" class="admin-filter-select" style="font-size:0.8125rem; padding:6px 10px;">
            <option value="all" ${productStockFilter === 'all' ? 'selected' : ''}>Todos os Estoques</option>
            <option value="in_stock" ${productStockFilter === 'in_stock' ? 'selected' : ''}>Em Estoque</option>
            <option value="low" ${productStockFilter === 'low' ? 'selected' : ''}>Estoque Baixo</option>
            <option value="out" ${productStockFilter === 'out' ? 'selected' : ''}>Sem Estoque</option>
          </select>
        </div>

        ${filtered.length === 0 ? `
          <div class="admin-empty-state" style="padding:32px 16px;">
            <div class="admin-empty-state-title" style="font-size:1rem;">Nenhum produto encontrado</div>
            <button class="btn btn-primary btn-sm" id="emptyStateNewProdBtn" style="margin-top:10px;">
              + Cadastrar Produto
            </button>
          </div>
        ` : `
          <!-- Desktop: Tabela Corporativa de Produtos -->
          <div class="admin-table-wrapper admin-desktop-only" style="border:1px solid #e2e8f0; border-radius:8px; overflow-x:auto; -webkit-overflow-scrolling:touch; min-height:300px; flex:1; background:#ffffff;">
            <table class="admin-table" style="min-width: 860px; width: 100%;">
              <thead>
                <tr>
                  <th style="width:55px;">ID</th>
                  <th style="width:48px;">Foto</th>
                  <th>Produto</th>
                  <th>Marca</th>
                  <th>Categoria</th>
                  <th>Subcategoria</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Status</th>
                  <th style="width:52px; text-align:center;">Ações</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(p => {
      const cat = categoriesList.find(c => String(c.id) === String(p.category_id));
      const subName = p.subcategory_name || p.subcategory || (cat?.subcategories || []).find(s => String(s.id) === String(p.subcategory_id))?.name || '';
      const isBlocked = p.is_active === false;

      return `
                    <tr style="${isBlocked ? 'background:#fafafa; opacity:0.85;' : ''}">
                      <td style="font-family:ui-monospace, monospace; font-size:0.8125rem; font-weight:700; color:#64748b;">
                        ${p.id}
                      </td>
                      <td style="width:48px;">
                        ${p.image ? `
                          <img
                            src="${p.image}"
                            alt="${p.name}"
                            style="width:40px; height:40px; object-fit:contain; border-radius:6px; border:1px solid #e2e8f0; background:#ffffff;"
                          />
                        ` : `
                          <div style="width:40px; height:40px; background:#f8fafc; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#94a3b8; border:1px solid #e2e8f0; font-size:0.65rem; text-align:center;">
                            Sem foto
                          </div>
                        `}
                      </td>
                      <td>
                        <div style="font-weight:600; color:#0f172a; font-size:0.875rem;">${p.name}</div>
                        <div style="font-family:ui-monospace, monospace; font-size:0.75rem; color:#64748b; margin-top:2px;">
                          SKU: <span style="font-weight:600; color:#475569;">${p.sku || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <span style="font-size:0.8125rem; font-weight:600; color:#334155; background:#f1f5f9; padding:2px 8px; border-radius:4px; border:1px solid #e2e8f0; display:inline-block; white-space:nowrap;">
                          ${p.brand || '—'}
                        </span>
                      </td>
                      <td>
                        <span style="font-size:0.8125rem; color:#334155; font-weight:500;">
                          ${cat ? cat.name : '—'}
                        </span>
                      </td>
                      <td>
                        <span style="font-size:0.8125rem; color:#64748b;">
                          ${subName || '—'}
                        </span>
                      </td>
                      <td>
                        <div style="font-weight:700; color:#0f172a; font-size:0.875rem;">${formatPrice(p.price)}</div>
                        ${p.old_price ? `<div style="font-size:0.6875rem; text-decoration:line-through; color:#94a3b8;">${formatPrice(p.old_price)}</div>` : ''}
                      </td>
                      <td>
                        <span class="badge" style="font-size:0.75rem; ${(p.stock || 0) <= 0 ? 'background:#fee2e2; color:#b91c1c;' : ((p.stock || 0) <= (p.stock_min || 2) ? 'background:#fef3c7; color:#b45309;' : 'background:#dcfce7; color:#15803d;')}">
                          ${p.stock || 0} un
                        </span>
                      </td>
                      <td>
                        ${!isBlocked ? `
                          <span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.75rem;">Ativo</span>
                        ` : `
                          <span class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.75rem;">Bloqueado</span>
                        `}
                      </td>
                      <td style="text-align:center; width:52px;">
                        <div class="admin-actions-dropdown">
                          <button type="button" class="admin-actions-trigger-btn" data-id="${p.id}" title="Ações do produto">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                              <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
                              <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
                            </svg>
                          </button>
                          <div class="admin-actions-menu">
                            <button type="button" class="admin-action-item edit-product-btn" data-id="${p.id}">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                              <span>Editar</span>
                            </button>
                            <button type="button" class="admin-action-item toggle-product-block-btn" data-id="${p.id}" data-active="${!isBlocked}">
                              ${!isBlocked ? `
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
                                <span style="color:#c2410c;">Bloquear</span>
                              ` : `
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                <span style="color:#15803d;">Desbloquear</span>
                              `}
                            </button>
                            <button type="button" class="admin-action-item duplicate-product-btn" data-id="${p.id}">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                              <span>Copiar</span>
                            </button>
                            <div class="admin-action-divider"></div>
                            <button type="button" class="admin-action-item delete-product-btn danger" data-id="${p.id}">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                              <span>Excluir</span>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  `;
    }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Mobile: Cards Responsivos de Produtos -->
          <div class="admin-mobile-card-list admin-mobile-only">
            ${filtered.map(p => {
      const cat = categoriesList.find(c => String(c.id) === String(p.category_id));
      const subName = p.subcategory_name || p.subcategory || (cat?.subcategories || []).find(s => String(s.id) === String(p.subcategory_id))?.name || '';
      const isBlocked = p.is_active === false;

      return `
                <div class="admin-res-card" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:14px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,0.02); box-sizing:border-box; width:100%;">
                  <!-- Topo: ID + Marca + Status -->
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:8px;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                      <span style="font-family:ui-monospace, monospace; font-size:0.75rem; font-weight:700; color:#64748b; background:#f1f5f9; padding:2px 8px; border-radius:5px; border:1px solid #e2e8f0;">
                        ID ${p.id}
                      </span>
                      ${p.brand ? `<span style="font-size:0.75rem; color:#475569; font-weight:600; background:#f8fafc; padding:2px 8px; border-radius:5px; border:1px solid #e2e8f0;">${p.brand}</span>` : ''}
                    </div>
                    <div>
                      ${!isBlocked ? `
                        <span class="badge" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; font-size:0.6875rem; font-weight:700; padding:3px 9px; border-radius:6px;">ATIVO</span>
                      ` : `
                        <span class="badge" style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; font-size:0.6875rem; font-weight:700; padding:3px 9px; border-radius:6px;">BLOQUEADO</span>
                      `}
                    </div>
                  </div>

                  <!-- Centro: Imagem + Nome + Categoria + Preço + Estoque -->
                  <div style="display:flex; gap:12px; align-items:center;">
                    ${p.image ? `
                      <img src="${p.image}" alt="${p.name}" style="width:60px; height:60px; object-fit:contain; border-radius:10px; border:1px solid #e2e8f0; background:#ffffff; padding:2px; flex-shrink:0;" />
                    ` : `
                      <div style="width:60px; height:60px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:0.7rem; flex-shrink:0;">
                        Sem foto
                      </div>
                    `}
                    <div style="flex:1; min-width:0;">
                      <strong style="font-size:0.9375rem; color:#0f172a; font-weight:700; display:block; line-height:1.3; margin-bottom:3px; word-break:break-word;">
                        ${p.name}
                      </strong>
                      <div style="font-size:0.75rem; color:#64748b; margin-bottom:6px;">
                        ${cat ? cat.name : '—'} ${subName ? `• ${subName}` : ''} ${p.sku ? `• <span style="font-family:ui-monospace, monospace; font-weight:600; color:#475569;">SKU: ${p.sku}</span>` : ''}
                      </div>
                      <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                        <div>
                          <span style="font-size:1rem; font-weight:800; color:#0f172a;">${formatPrice(p.price)}</span>
                          ${p.old_price ? `<span style="font-size:0.75rem; text-decoration:line-through; color:#94a3b8; margin-left:6px;">${formatPrice(p.old_price)}</span>` : ''}
                        </div>
                        <span class="badge" style="font-size:0.6875rem; font-weight:700; padding:2px 8px; border-radius:6px; ${(p.stock || 0) <= 0 ? 'background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;' : ((p.stock || 0) <= (p.stock_min || 2) ? 'background:#fef3c7; color:#b45309; border:1px solid #fde68a;' : 'background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0;')}">
                          ${p.stock || 0} UN
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Rodapé: Ações Diretas Touch sem Corte de Menu -->
                  <div style="display:grid; grid-template-columns: 1.2fr 1fr 1fr 1fr; gap:6px; margin-top:12px; padding-top:10px; border-top:1px solid #f1f5f9;">
                    <button type="button" class="btn btn-secondary btn-sm edit-product-btn" data-id="${p.id}" style="padding:6px 4px; font-size:0.75rem; font-weight:600; justify-content:center; border-radius:6px;">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                      Editar
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm toggle-product-block-btn" data-id="${p.id}" data-active="${!isBlocked}" style="padding:6px 4px; font-size:0.75rem; font-weight:600; justify-content:center; border-radius:6px; ${!isBlocked ? 'color:#c2410c;' : 'color:#15803d;'}">
                      ${!isBlocked ? 'Bloquear' : 'Ativar'}
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm duplicate-product-btn" data-id="${p.id}" style="padding:6px 4px; font-size:0.75rem; font-weight:600; justify-content:center; border-radius:6px;">
                      Copiar
                    </button>
                    <button type="button" class="btn btn-sm delete-product-btn danger" data-id="${p.id}" style="padding:6px 4px; font-size:0.75rem; font-weight:600; justify-content:center; border-radius:6px; background:#fff1f2; color:#e11d48; border:1px solid #fecdd3;">
                      Excluir
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
  // ABA 4: CATEGORIAS & SUBCATEGORIAS (Minimalista, Limpo e Direto)
  function renderCategoriesTab() {
    let filteredCats = [...categoriesList];
    if (categorySearchQuery.trim()) {
      const q = categorySearchQuery.toLowerCase().trim();
      filteredCats = filteredCats.filter(c => {
        const matchCat = (c.name && c.name.toLowerCase().includes(q)) || (c.description && c.description.toLowerCase().includes(q));
        const matchSub = Array.isArray(c.subcategories) && c.subcategories.some(s =>
          (s.name && s.name.toLowerCase().includes(q)) || (s.description && s.description.toLowerCase().includes(q))
        );
        return matchCat || matchSub;
      });
    }

    if (categorySortOrder === 'az') {
      filteredCats.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt', { sensitivity: 'base' }));
    } else if (categorySortOrder === 'za') {
      filteredCats.sort((a, b) => (b.name || '').localeCompare(a.name || '', 'pt', { sensitivity: 'base' }));
    } else if (categorySortOrder === 'subs_desc') {
      filteredCats.sort((a, b) => (b.subcategories?.length || 0) - (a.subcategories?.length || 0));
    } else if (categorySortOrder === 'recent') {
      filteredCats.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    }

    return `
      <div class="admin-card" style="box-sizing:border-box; width:100%;">
        <div class="admin-card-header" style="margin-bottom:16px;">
          <h2 class="admin-card-title">Categorias & Subcategorias</h2>
          <button id="openNewCategoryModalBtn" class="btn btn-primary btn-sm" style="font-weight:600; padding:8px 16px;">
            + Nova Categoria
          </button>
        </div>

        <!-- Filtro Rápido Minimalista -->
        <div style="display:flex; gap:10px; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap;">
          <div style="flex:1; min-width:180px;">
            <input 
              type="text" 
              id="categorySearchInput" 
              class="form-input" 
              placeholder="Buscar categoria..." 
              value="${categorySearchQuery}" 
              style="padding:7px 12px; font-size:0.875rem; width:100%; box-sizing:border-box;"
            />
          </div>
          <div style="flex-shrink:0;">
            <select id="categorySortSelect" class="admin-filter-select" style="font-size:0.8125rem; padding:6px 10px;">
              <option value="az" ${categorySortOrder === 'az' ? 'selected' : ''}>A → Z</option>
              <option value="za" ${categorySortOrder === 'za' ? 'selected' : ''}>Z → A</option>
              <option value="subs_desc" ${categorySortOrder === 'subs_desc' ? 'selected' : ''}>Mais Subcategorias</option>
              <option value="recent" ${categorySortOrder === 'recent' ? 'selected' : ''}>Mais Recentes</option>
            </select>
          </div>
        </div>

        ${filteredCats.length === 0 ? `
          <div class="admin-empty-state" style="padding:32px 16px;">
            <div class="admin-empty-state-title" style="font-size:1rem;">Nenhuma categoria</div>
            <button class="btn btn-primary btn-sm" id="emptyStateNewCatBtn" style="margin-top:10px;">
              + Nova Categoria
            </button>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box;">
            ${filteredCats.map(c => {
      const subs = Array.isArray(c.subcategories) ? [...c.subcategories] : [];
      subs.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt', { sensitivity: 'base' }));
      const isExpanded = expandedCategoryIds.has(c.id);

      return `
                <div class="admin-category-block" style="background:#ffffff; border:1px solid ${isExpanded ? '#cbd5e1' : '#e2e8f0'}; border-radius:10px; overflow:hidden; box-sizing:border-box; width:100%;">
                  <!-- Linha da Categoria Responsiva -->
                  <div class="category-accordion-header" data-cat-id="${c.id}" style="padding:12px 14px; background:${isExpanded ? '#f8fafc' : '#ffffff'}; border-bottom:${isExpanded ? '1px solid #f1f5f9' : 'none'}; cursor:pointer; box-sizing:border-box;">
                    <div class="category-header-top" style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                      <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                        <span class="category-chevron-icon" style="color:#64748b; font-size:0.75rem; transition:transform 0.15s ease; display:inline-block; transform:${isExpanded ? 'rotate(90deg)' : 'none'}; flex-shrink:0;">
                          ▶
                        </span>
                        <strong style="font-size:0.9375rem; color:#0f172a; font-weight:700; word-break:break-word;">
                          ${c.name}
                        </strong>
                        <span style="font-size:0.75rem; color:#64748b; background:#f1f5f9; padding:2px 8px; border-radius:10px; font-weight:700; flex-shrink:0;">
                          ${subs.length}
                        </span>
                        ${c.is_active === false ? `<span class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.6875rem; font-weight:700; flex-shrink:0;">Inativa</span>` : ''}
                      </div>

                      <div class="category-header-actions" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;" onclick="event.stopPropagation()">
                        <button class="btn btn-xs btn-primary add-sub-to-cat-btn" data-cat-id="${c.id}" data-cat-name="${c.name}" style="padding:5px 10px; font-size:0.75rem; font-weight:600; border-radius:6px; white-space:nowrap;">
                          + Subcategoria
                        </button>
                        <button class="btn btn-xs btn-secondary edit-category-btn" data-id="${c.id}" style="padding:5px 8px; font-size:0.75rem; border-radius:6px; white-space:nowrap;">
                          Editar
                        </button>
                        <button class="btn btn-xs delete-category-btn" data-id="${c.id}" data-cat-name="${c.name}" style="background:#fff1f2; color:#e11d48; border:1px solid #fecdd3; padding:5px 8px; font-size:0.75rem; border-radius:6px; white-space:nowrap;">
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Subcategorias (Aninhadas e Diretas) -->
                  ${isExpanded ? `
                    <div style="background:#fafafa; padding:6px 14px 12px 24px; box-sizing:border-box;">
                      ${subs.length === 0 ? `
                        <div style="padding:8px 0; font-size:0.8125rem; color:#94a3b8; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                          <span>Nenhuma subcategoria vinculada.</span>
                          <button class="btn btn-xs btn-primary add-sub-to-cat-btn" data-cat-id="${c.id}" data-cat-name="${c.name}" style="padding:3px 8px; font-size:0.75rem; border-radius:4px;">
                            + Adicionar
                          </button>
                        </div>
                      ` : `
                        <div>
                          ${subs.map((sub, idx) => `
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 0; flex-wrap:wrap; ${idx < subs.length - 1 ? 'border-bottom:1px solid #f1f5f9;' : ''}">
                              <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                                <span style="color:#94a3b8; font-size:0.65rem;">•</span>
                                <span style="font-size:0.84rem; color:#1e293b; font-weight:600; word-break:break-word;">
                                  ${sub.name}
                                </span>
                                ${sub.is_active === false ? `<span style="font-size:0.65rem; color:#b91c1c; background:#fee2e2; padding:1px 5px; border-radius:4px;">Inativa</span>` : ''}
                              </div>
                              <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
                                <button class="btn btn-xs edit-subcategory-btn" data-cat-id="${c.id}" data-sub-id="${sub.id}" style="background:#ffffff; border:1px solid #e2e8f0; color:#475569; font-size:0.75rem; padding:3px 8px; border-radius:4px; cursor:pointer;">
                                  Editar
                                </button>
                                <button class="btn btn-xs delete-subcategory-btn" data-cat-id="${c.id}" data-sub-id="${sub.id}" data-sub-name="${sub.name}" style="background:#fff1f2; border:1px solid #fecdd3; color:#e11d48; font-size:0.75rem; padding:3px 8px; border-radius:4px; cursor:pointer;">
                                  Excluir
                                </button>
                              </div>
                            </div>
                          `).join('')}
                          <div style="padding-top:8px;">
                            <button class="btn btn-xs add-sub-to-cat-btn" data-cat-id="${c.id}" data-cat-name="${c.name}" style="background:#ffffff; border:1px dashed #cbd5e1; color:#2563eb; font-size:0.75rem; padding:5px 12px; border-radius:6px; font-weight:600;">
                              + Nova Subcategoria
                            </button>
                          </div>
                        </div>
                      `}
                    </div>
                  ` : ''}
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
              ${Icons.image ? Icons.image(20) : '🖼️'}
              <span>Banners da Vitrine (${bannersList.length})</span>
            </h2>
          </div>
          <button id="openNewBannerModalBtn" class="btn btn-primary" style="gap:6px;">
            ${Icons.plus(15)}
            <span>Novo Banner</span>
          </button>
        </div>

        ${bannersList.length === 0 ? `
          <div class="admin-empty-state">
            <div class="admin-empty-state-icon">🖼️</div>
            <div class="admin-empty-state-title">Nenhum banner cadastrado</div>
            <div class="admin-empty-state-desc">Cadastre um banner promocional para a página inicial com link direto para ofertas ou lançamentos.</div>
            <button class="btn btn-primary btn-sm" id="emptyStateNewBannerBtn" style="margin-top:6px;">
              + Novo Banner
            </button>
          </div>
        ` : `
          <!-- Grid Visual de Banners -->
          <div class="admin-banners-grid">
            ${bannersList.map(b => `
              <div class="admin-banner-card">
                <div class="admin-banner-card-img-wrap">
                  <span class="admin-banner-card-order-badge">Ordem ${b.display_order || 1}</span>
                  <img
                    src="${b.image_url}"
                    alt="${b.title}"
                    class="admin-banner-card-img"
                    onerror="this.onerror=null; this.style.opacity='0.4';"
                  />
                </div>
                <div class="admin-banner-card-body">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                    <div class="admin-banner-card-title">${b.title}</div>
                    <button class="btn btn-sm toggle-banner-active-btn" data-id="${b.id}" data-active="${b.is_active !== false}" style="font-size:0.6875rem; padding:2px 8px; border-radius:999px; cursor:pointer; ${b.is_active !== false ? 'background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;' : 'background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0;'}">
                      <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${b.is_active !== false ? '#16a34a' : '#94a3b8'}; margin-right:4px;"></span>${b.is_active !== false ? 'Ativo' : 'Pausado'}
                    </button>
                  </div>
                  <div class="admin-banner-card-link" style="display:flex; align-items:center; gap:4px; color:#64748b; font-size:0.75rem;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    <span>${b.button_link || '#/catalogo'}</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; border-top:1px solid #f1f5f9; padding-top:8px;">
                    <span style="font-size:0.75rem; color:#94a3b8; font-family:monospace;">ID: ${b.id}</span>
                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-secondary btn-sm edit-banner-btn" data-id="${b.id}" style="padding:4px 10px; font-size:0.75rem; font-weight:600;">
                        Editar
                      </button>
                      <button class="btn btn-secondary btn-sm delete-banner-btn" data-id="${b.id}" title="Excluir banner" style="padding:4px 8px; font-size:0.75rem; color:#dc2626; border-color:#fecaca; background:#fff5f5;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
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
  // ===================================================================
  // ABA 6: CUPONS DE DESCONTO
  // ===================================================================
  function renderCouponsTab() {
    let filtered = couponsList.filter(c => {
      if (couponStatusFilter === 'active') return c.is_active !== false;
      if (couponStatusFilter === 'paused') return c.is_active === false;
      return true;
    });

    if (couponSearchQuery.trim()) {
      const q = couponSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(c =>
        (c.code && c.code.toLowerCase().includes(q)) ||
        String(c.id).includes(q) ||
        String(c.discount_value).includes(q)
      );
    }

    return `
      <div class="admin-card" style="display:flex; flex-direction:column; min-height:100%; flex:1; box-sizing:border-box;">
        <div class="admin-card-header" style="margin-bottom:16px;">
          <div>
            <h2 class="admin-card-title">Cupons (${couponsList.length})</h2>
          </div>
          <button id="openNewCouponModalBtn" class="btn btn-primary btn-sm" style="font-weight:600; padding:8px 16px;">
            + Novo Cupom
          </button>
        </div>

        <!-- Filtros Rápidos Minimalistas -->
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:16px; flex-wrap:wrap;">
          <div style="flex:1; min-width:260px; max-width:360px;">
            <input
              type="text"
              id="couponSearchInput"
              class="form-input"
              placeholder="Buscar por código ou valor..."
              value="${couponSearchQuery}"
              style="padding:7px 12px; font-size:0.875rem;"
            />
          </div>

          <select id="couponStatusFilterSelect" class="admin-filter-select" style="font-size:0.8125rem; padding:6px 10px;">
            <option value="all" ${couponStatusFilter === 'all' ? 'selected' : ''}>Todos os Status</option>
            <option value="active" ${couponStatusFilter === 'active' ? 'selected' : ''}>Ativos</option>
            <option value="paused" ${couponStatusFilter === 'paused' ? 'selected' : ''}>Pausados</option>
          </select>
        </div>

        ${filtered.length === 0 ? `
          <div class="admin-empty-state" style="padding:32px 16px;">
            <div class="admin-empty-state-title" style="font-size:1rem;">Nenhum cupom encontrado</div>
            <button class="btn btn-primary btn-sm" id="emptyStateNewCouponBtn" style="margin-top:10px;">
              + Criar Cupom
            </button>
          </div>
        ` : `
          <!-- Desktop: Tabela de Cupons -->
          <div class="admin-table-wrapper admin-desktop-only" style="border:1px solid #e2e8f0; border-radius:8px; overflow-x:auto; -webkit-overflow-scrolling:touch; min-height:300px; flex:1; background:#ffffff;">
            <table class="admin-table" style="min-width:760px; width:100%;">
              <thead>
                <tr>
                  <th style="width:55px;">ID</th>
                  <th>Código</th>
                  <th>Desconto</th>
                  <th>Pedido Mínimo</th>
                  <th>Usos / Limite</th>
                  <th>Status</th>
                  <th style="width:52px; text-align:center;">Ações</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(c => `
                  <tr>
                    <td style="font-family:ui-monospace, monospace; font-size:0.8125rem; font-weight:700; color:#64748b;">
                      ${c.id}
                    </td>
                    <td>
                      <span style="font-family:ui-monospace, monospace; font-weight:700; font-size:0.875rem; background:#f1f5f9; padding:3px 8px; border-radius:5px; border:1px solid #e2e8f0; color:#1e293b;">
                        ${c.code}
                      </span>
                    </td>
                    <td>
                      <strong style="color:#0f172a; font-size:0.875rem;">
                        ${c.discount_type === 'percent' ? `${c.discount_value}% OFF` : (c.discount_type === 'free_shipping' ? 'Frete Grátis' : formatPrice(c.discount_value))}
                      </strong>
                    </td>
                    <td style="font-size:0.8125rem; color:#475569;">
                      ${Number(c.min_order_value) > 0 ? formatPrice(c.min_order_value) : '—'}
                    </td>
                    <td style="font-size:0.8125rem; color:#475569;">
                      ${c.total_usado !== undefined ? c.total_usado : (c.times_used || 0)} / ${c.usage_limit || '∞'}
                    </td>
                    <td>
                      ${c.is_active !== false ? `
                        <span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.75rem;">Ativo</span>
                      ` : `
                        <span class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.75rem;">Pausado</span>
                      `}
                    </td>
                    <td style="text-align:center; width:52px;">
                      <div class="admin-actions-dropdown">
                        <button type="button" class="admin-actions-trigger-btn" data-id="${c.id}" title="Ações">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                            <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
                            <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
                          </svg>
                        </button>
                        <div class="admin-actions-menu">
                          <button type="button" class="admin-action-item edit-coupon-btn" data-id="${c.id}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                            <span>Editar</span>
                          </button>
                          <button type="button" class="admin-action-item toggle-coupon-active-btn" data-id="${c.id}" data-active="${c.is_active !== false}">
                            ${c.is_active !== false ? `
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>
                              <span style="color:#c2410c;">Pausar</span>
                            ` : `
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="#16a34a"/></svg>
                              <span style="color:#15803d;">Ativar</span>
                            `}
                          </button>
                          <div class="admin-action-divider"></div>
                          <button type="button" class="admin-action-item delete-coupon-btn danger" data-id="${c.id}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Mobile: Cards Responsivos de Cupons -->
          <div class="admin-mobile-card-list admin-mobile-only">
            ${filtered.map(c => `
              <div class="admin-res-card" style="padding:14px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <span style="font-family:ui-monospace, monospace; font-weight:700; font-size:0.9375rem; color:#1e293b; background:#f1f5f9; padding:2px 8px; border-radius:4px; border:1px solid #e2e8f0;">
                    ${c.code}
                  </span>
                  <div style="display:flex; align-items:center; gap:8px;">
                    ${c.is_active !== false ? `
                      <span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.75rem;">Ativo</span>
                    ` : `
                      <span class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.75rem;">Pausado</span>
                    `}
                    <div class="admin-actions-dropdown">
                      <button type="button" class="admin-actions-trigger-btn" data-id="${c.id}" title="Ações">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                          <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
                          <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
                        </svg>
                      </button>
                      <div class="admin-actions-menu">
                        <button type="button" class="admin-action-item edit-coupon-btn" data-id="${c.id}">
                          <span>Editar</span>
                        </button>
                        <button type="button" class="admin-action-item toggle-coupon-active-btn" data-id="${c.id}" data-active="${c.is_active !== false}">
                          <span>${c.is_active !== false ? 'Pausar' : 'Ativar'}</span>
                        </button>
                        <div class="admin-action-divider"></div>
                        <button type="button" class="admin-action-item delete-coupon-btn danger" data-id="${c.id}">
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; font-size:0.875rem;">
                  <span style="color:#64748b;">Desconto:</span>
                  <strong style="color:#0f172a;">${c.discount_type === 'percent' ? `${c.discount_value}% OFF` : (c.discount_type === 'free_shipping' ? 'Frete Grátis' : formatPrice(c.discount_value))}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; font-size:0.8125rem; color:#64748b;">
                  <span>Pedido Mínimo:</span>
                  <span>${Number(c.min_order_value) > 0 ? formatPrice(c.min_order_value) : 'Sem mínimo'}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; font-size:0.8125rem; color:#64748b;">
                  <span>Usos:</span>
                  <span>${c.total_usado !== undefined ? c.total_usado : (c.times_used || 0)} / ${c.usage_limit || '∞'}</span>
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
      <div class="admin-card" style="display:flex; flex-direction:column; min-height:100%; flex:1; box-sizing:border-box;">
        <div class="admin-card-header" style="margin-bottom:16px;">
          <div>
            <h2 class="admin-card-title">Campanhas (${catalogsList.length})</h2>
          </div>
          <button id="openNewCatalogModalBtn" class="btn btn-primary btn-sm" style="font-weight:600; padding:8px 16px;">
            + Nova Campanha
          </button>
        </div>

        ${catalogsList.length === 0 ? `
          <div class="admin-empty-state" style="padding:32px 16px;">
            <div class="admin-empty-state-title" style="font-size:1rem;">Nenhuma campanha cadastrada</div>
            <button class="btn btn-primary btn-sm" id="emptyStateNewCatalogBtn" style="margin-top:10px;">
              + Nova Campanha
            </button>
          </div>
        ` : `
          <!-- Desktop: Tabela de Campanhas -->
          <div class="admin-table-wrapper admin-desktop-only" style="border:1px solid #e2e8f0; border-radius:8px; overflow-x:auto; -webkit-overflow-scrolling:touch; min-height:300px; flex:1; background:#ffffff;">
            <table class="admin-table" style="min-width:760px; width:100%;">
              <thead>
                <tr>
                  <th style="width:55px;">ID</th>
                  <th>Campanha</th>
                  <th>Slug URL</th>
                  <th>Badge</th>
                  <th>Ordem</th>
                  <th>Status</th>
                  <th style="width:52px; text-align:center;">Ações</th>
                </tr>
              </thead>
              <tbody>
                ${catalogsList.map(c => `
                  <tr>
                    <td style="font-family:ui-monospace, monospace; font-size:0.8125rem; font-weight:700; color:#64748b;">
                      ${c.id}
                    </td>
                    <td>
                      <div style="font-weight:600; color:#0f172a; font-size:0.875rem;">${c.name}</div>
                      ${c.description ? `<div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${c.description}</div>` : ''}
                    </td>
                    <td>
                      <span style="font-family:ui-monospace, monospace; font-size:0.8125rem; color:#475569;">
                        ${c.slug || '—'}
                      </span>
                    </td>
                    <td>
                      ${c.badge_text ? `
                        <span class="badge" style="background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; font-weight:600; font-size:0.75rem;">
                          ${c.badge_text}
                        </span>
                      ` : `
                        <span style="color:#94a3b8; font-size:0.75rem;">—</span>
                      `}
                    </td>
                    <td style="font-size:0.8125rem; color:#475569;">
                      ${c.display_order || 1}
                    </td>
                    <td>
                      ${c.is_active !== false ? `
                        <span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.75rem;">Ativa</span>
                      ` : `
                        <span class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.75rem;">Inativa</span>
                      `}
                    </td>
                    <td style="text-align:center; width:52px;">
                      <div class="admin-actions-dropdown">
                        <button type="button" class="admin-actions-trigger-btn" data-id="${c.id}" title="Ações">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                            <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
                            <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
                          </svg>
                        </button>
                        <div class="admin-actions-menu">
                          <button type="button" class="admin-action-item edit-catalog-btn" data-id="${c.id}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                            <span>Editar</span>
                          </button>
                          <div class="admin-action-divider"></div>
                          <button type="button" class="admin-action-item delete-catalog-btn danger" data-id="${c.id}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Mobile: Cards Responsivos de Campanhas -->
          <div class="admin-mobile-card-list admin-mobile-only">
            ${catalogsList.map(c => `
              <div class="admin-res-card" style="padding:14px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                  <div>
                    <strong style="color:#0f172a; font-size:0.9375rem;">${c.name}</strong>
                    <div style="font-family:ui-monospace, monospace; font-size:0.75rem; color:#64748b; margin-top:2px;">${c.slug || '—'}</div>
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    ${c.is_active !== false ? `
                      <span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.75rem;">Ativa</span>
                    ` : `
                      <span class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.75rem;">Inativa</span>
                    `}
                    <div class="admin-actions-dropdown">
                      <button type="button" class="admin-actions-trigger-btn" data-id="${c.id}" title="Ações">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                          <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
                          <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
                        </svg>
                      </button>
                      <div class="admin-actions-menu">
                        <button type="button" class="admin-action-item edit-catalog-btn" data-id="${c.id}">
                          <span>Editar</span>
                        </button>
                        <div class="admin-action-divider"></div>
                        <button type="button" class="admin-action-item delete-catalog-btn danger" data-id="${c.id}">
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                ${c.description ? `
                  <div style="font-size:0.8125rem; color:#475569; margin-top:6px; line-height:1.4;">
                    ${c.description}
                  </div>
                ` : ''}
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
    if (customerStatusFilter === 'active') {
      filtered = filtered.filter(c => c.status !== 'blocked');
    } else if (customerStatusFilter === 'blocked') {
      filtered = filtered.filter(c => c.status === 'blocked');
    }
    if (customerSearchQuery) {
      const q = customerSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(c =>
        String(c.id).includes(q) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
      );
    }

    return `
      <div class="admin-card" style="display:flex; flex-direction:column; min-height:100%; flex:1; box-sizing:border-box;">
        <div class="admin-card-header" style="margin-bottom:16px;">
          <div>
            <h2 class="admin-card-title">Clientes (${customersList.length})</h2>
          </div>
        </div>

        <!-- Filtros Rápidos Minimalistas -->
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:16px; flex-wrap:wrap;">
          <div style="flex:1; min-width:260px; max-width:360px;">
            <input
              type="text"
              id="customerSearchInput"
              class="form-input"
              placeholder="Buscar por ID, nome, e-mail ou telefone..."
              value="${customerSearchQuery}"
              style="padding:7px 12px; font-size:0.875rem;"
            />
          </div>

          <select id="customerStatusFilterSelect" class="admin-filter-select" style="font-size:0.8125rem; padding:6px 10px;">
            <option value="all" ${customerStatusFilter === 'all' ? 'selected' : ''}>Todos os Status</option>
            <option value="active" ${customerStatusFilter === 'active' ? 'selected' : ''}>Ativos</option>
            <option value="blocked" ${customerStatusFilter === 'blocked' ? 'selected' : ''}>Bloqueados</option>
          </select>
        </div>

        ${filtered.length === 0 ? `
          <div class="admin-empty-state" style="padding:32px 16px;">
            <div class="admin-empty-state-title" style="font-size:1rem;">Nenhum cliente encontrado</div>
            <div style="font-size:0.8125rem; color:#64748b; margin-top:4px;">Nenhum registro corresponde aos filtros selecionados.</div>
          </div>
        ` : `
          <!-- Desktop: Tabela Corporativa de Clientes -->
          <div class="admin-table-wrapper admin-desktop-only" style="border:1px solid #e2e8f0; border-radius:8px; overflow-x:auto; -webkit-overflow-scrolling:touch; min-height:300px; flex:1; background:#ffffff;">
            <table class="admin-table" style="min-width: 860px; width: 100%;">
              <thead>
                <tr>
                  <th style="width:55px;">ID</th>
                  <th>Cliente</th>
                  <th>E-mail</th>
                  <th>Telefone</th>
                  <th>Endereço em Luanda</th>
                  <th style="width:120px;">Total Comprado</th>
                  <th style="width:95px;">Status</th>
                  <th style="width:52px; text-align:center;">Ações</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(c => {
      const phone = c.phone || c.telefone || '';
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('244') ? cleanPhone : '244' + cleanPhone}` : null;
      const isBlocked = c.status === 'blocked';

      return `
                    <tr style="${isBlocked ? 'background:#fafafa; opacity:0.85;' : ''}">
                      <td style="font-family:ui-monospace, monospace; font-size:0.8125rem; font-weight:700; color:#64748b;">
                        ${c.id}
                      </td>
                      <td>
                        <div style="font-weight:600; color:#0f172a; font-size:0.875rem;">${c.name}</div>
                      </td>
                      <td>
                        <span style="font-size:0.8125rem; color:#475569;">${c.email}</span>
                      </td>
                      <td>
                        <span style="font-size:0.8125rem; color:#475569;">${phone || '—'}</span>
                      </td>
                      <td>
                        <div style="font-size:0.8125rem; max-width:200px; color:#475569; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                          ${c.endereco || '—'}
                        </div>
                      </td>
                      <td>
                        <strong style="color:#0f172a; font-size:0.875rem;">${formatPrice(c.total_spent || 0)}</strong>
                      </td>
                      <td>
                        ${!isBlocked ? `
                          <span class="badge" style="display:inline-flex; align-items:center; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:5px;">
                            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#16a34a; margin-right:5px;"></span>Ativo
                          </span>
                        ` : `
                          <span class="badge" style="display:inline-flex; align-items:center; background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:5px;">
                            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#ef4444; margin-right:5px;"></span>Bloqueado
                          </span>
                        `}
                      </td>
                      <td style="text-align:center; width:52px;">
                        <div class="admin-actions-dropdown">
                          <button type="button" class="admin-actions-trigger-btn" data-id="${c.id}" title="Ações do cliente">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                              <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
                              <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
                            </svg>
                          </button>
                          <div class="admin-actions-menu">
                            <button type="button" class="admin-action-item open-customer-modal-btn" data-id="${c.id}">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                              <span>Ver Detalhes</span>
                            </button>
                            ${waLink ? `
                              <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="admin-action-item" style="text-decoration:none;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                <span style="color:#15803d;">WhatsApp</span>
                              </a>
                            ` : ''}
                            <div class="admin-action-divider"></div>
                            <button type="button" class="admin-action-item toggle-block-customer-btn ${!isBlocked ? 'danger' : ''}" data-id="${c.id}" data-blocked="${isBlocked}">
                              ${!isBlocked ? `
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
                                <span style="color:#dc2626;">Bloquear Conta</span>
                              ` : `
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                <span style="color:#15803d;">Desbloquear</span>
                              `}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  `;
    }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Mobile: Cards de Clientes -->
          <div class="admin-mobile-card-list admin-mobile-only">
            ${filtered.map(c => {
      const isBlocked = c.status === 'blocked';
      const phone = c.phone || c.telefone || '';
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('244') ? cleanPhone : '244' + cleanPhone}` : null;

      return `
                <div class="admin-res-card" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:10px; box-shadow:0 1px 3px rgba(0,0,0,0.02); box-sizing:border-box; width:100%;">
                  <div class="admin-res-card-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:8px;">
                    <div style="min-width:0; flex:1;">
                      <strong style="font-size:0.9375rem; color:#0f172a; font-weight:700; word-break:break-word;">${c.name}</strong>
                      <div style="font-size:0.75rem; color:#64748b; word-break:break-all; margin-top:1px;">${c.email}</div>
                    </div>
                    ${!isBlocked ? `
                      <span class="badge" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; font-size:0.6875rem; font-weight:700; padding:2px 8px; border-radius:6px; flex-shrink:0;">ATIVO</span>
                    ` : `
                      <span class="badge" style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; font-size:0.6875rem; font-weight:700; padding:2px 8px; border-radius:6px; flex-shrink:0;">BLOQUEADO</span>
                    `}
                  </div>
                  <div class="admin-res-card-body" style="display:flex; flex-direction:column; gap:6px; font-size:0.8125rem; border-top:1px solid #f1f5f9; padding-top:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <span style="color:#64748b;">Telefone:</span>
                      <span style="font-weight:600; color:#0f172a;">${phone || '—'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <span style="color:#64748b;">Endereço:</span>
                      <span style="max-width:180px; text-align:right; color:#475569; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.endereco || '—'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed #f1f5f9; padding-top:6px; margin-top:2px;">
                      <span style="color:#64748b; font-weight:600;">Total Comprado:</span>
                      <strong style="color:#0f172a; font-size:0.95rem; font-weight:800;">${formatPrice(c.total_spent || 0)}</strong>
                    </div>
                  </div>
                  <div class="admin-res-card-actions" style="display:flex; gap:8px; margin-top:10px; padding-top:10px; border-top:1px solid #f1f5f9;">
                    ${waLink ? `
                      <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="flex:1; display:inline-flex; align-items:center; justify-content:center; gap:6px; color:#15803d; border-color:#bbf7d0; background:#f0fdf4; font-size:0.8125rem; font-weight:600; padding:8px 12px; text-decoration:none; border-radius:8px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        WhatsApp
                      </a>
                    ` : ''}
                    <button class="btn btn-secondary btn-sm open-customer-modal-btn" data-id="${c.id}" style="flex:1; font-size:0.8125rem; font-weight:600; padding:8px 12px; border-radius:8px;">
                      Ver Detalhes
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
  // ===================================================================
  // ABA 9: GESTÃO DE ESTOQUE
  // ===================================================================
  function renderStockTab() {
    const outOfStock = productsList.filter(p => (p.stock || 0) === 0);
    const lowStock = productsList.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= (p.stock_min || 2));
    const totalUnits = productsList.reduce((sum, p) => sum + (p.stock || 0), 0);

    let filtered = productsList.filter(p => {
      const stock = p.stock || 0;
      const minStock = p.stock_min || 2;
      if (stockStatusFilter === 'out') return stock === 0;
      if (stockStatusFilter === 'low') return stock > 0 && stock <= minStock;
      if (stockStatusFilter === 'in_stock') return stock > minStock;
      return true;
    });

    if (stockSearchQuery.trim()) {
      const q = stockSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(p =>
        String(p.id).includes(q) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      );
    }

    return `
      <div style="display:flex; flex-direction:column; gap:16px; min-height:100%; flex:1;">
        <!-- 3 KPIs Corporativos de Estoque -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#64748b;">Total em Depósito</div>
              <div style="font-size:1.375rem; font-weight:800; color:#0f172a; margin-top:2px;">${totalUnits} <span style="font-size:0.875rem; font-weight:600; color:#64748b;">unidades</span></div>
            </div>
            <div style="width:36px; height:36px; border-radius:8px; background:#eff6ff; display:flex; align-items:center; justify-content:center; color:#2563eb;">
              ${Icons.package(18)}
            </div>
          </div>

          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#64748b;">Nível Crítico / Baixo</div>
              <div style="font-size:1.375rem; font-weight:800; color:#d97706; margin-top:2px;">${lowStock.length} <span style="font-size:0.875rem; font-weight:600; color:#64748b;">produtos</span></div>
            </div>
            <div style="width:36px; height:36px; border-radius:8px; background:#fffbeb; display:flex; align-items:center; justify-content:center; color:#d97706;">
              ${Icons.truck(18)}
            </div>
          </div>

          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#64748b;">Sem Estoque / Zerado</div>
              <div style="font-size:1.375rem; font-weight:800; color:#dc2626; margin-top:2px;">${outOfStock.length} <span style="font-size:0.875rem; font-weight:600; color:#64748b;">produtos</span></div>
            </div>
            <div style="width:36px; height:36px; border-radius:8px; background:#fef2f2; display:flex; align-items:center; justify-content:center; color:#dc2626;">
              ${Icons.close(18)}
            </div>
          </div>
        </div>

        <!-- Tabela e Lista de Estoque -->
        <div class="admin-card" style="display:flex; flex-direction:column; min-height:100%; flex:1; box-sizing:border-box;">
          <div class="admin-card-header" style="margin-bottom:16px;">
            <div>
              <h2 class="admin-card-title">Gestão de Estoque (${productsList.length})</h2>
            </div>
            <button id="openRecordStockModalBtn" class="btn btn-primary btn-sm" style="font-weight:600; padding:8px 16px;">
              + Movimentar Estoque
            </button>
          </div>

          <!-- Filtros Rápidos Minimalistas -->
          <div style="display:flex; gap:10px; align-items:center; margin-bottom:16px; flex-wrap:wrap;">
            <div style="flex:1; min-width:260px; max-width:360px;">
              <input
                type="text"
                id="stockSearchInput"
                class="form-input"
                placeholder="Buscar por ID ou nome do produto..."
                value="${stockSearchQuery}"
                style="padding:7px 12px; font-size:0.875rem;"
              />
            </div>

            <select id="stockStatusFilterSelect" class="admin-filter-select" style="font-size:0.8125rem; padding:6px 10px;">
              <option value="all" ${stockStatusFilter === 'all' ? 'selected' : ''}>Todos os Saldos</option>
              <option value="in_stock" ${stockStatusFilter === 'in_stock' ? 'selected' : ''}>Em Estoque</option>
              <option value="low" ${stockStatusFilter === 'low' ? 'selected' : ''}>Nível Crítico</option>
              <option value="out" ${stockStatusFilter === 'out' ? 'selected' : ''}>Sem Estoque</option>
            </select>
          </div>

          ${filtered.length === 0 ? `
            <div class="admin-empty-state" style="padding:32px 16px;">
              <div class="admin-empty-state-title" style="font-size:1rem;">Nenhum produto correspondente ao filtro</div>
            </div>
          ` : `
            <!-- Desktop: Tabela de Estoque -->
            <div class="admin-table-wrapper admin-desktop-only" style="border:1px solid #e2e8f0; border-radius:8px; overflow-x:auto; -webkit-overflow-scrolling:touch; min-height:300px; flex:1; background:#ffffff;">
              <table class="admin-table" style="min-width:720px; width:100%;">
                <thead>
                  <tr>
                    <th style="width:55px;">ID</th>
                    <th style="width:48px;">Foto</th>
                    <th>Produto</th>
                    <th>Estoque Atual</th>
                    <th>Estoque Mínimo</th>
                    <th>Status</th>
                    <th style="width:52px; text-align:center;">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered.map(p => {
      const stock = p.stock || 0;
      const minStock = p.stock_min || 2;
      const isOut = stock <= 0;
      const isLow = stock > 0 && stock <= minStock;

      return `
                      <tr>
                        <td style="font-family:ui-monospace, monospace; font-size:0.8125rem; font-weight:700; color:#64748b;">
                          ${p.id}
                        </td>
                        <td style="width:48px;">
                          ${p.image ? `
                            <img
                              src="${p.image}"
                              alt="${p.name}"
                              style="width:38px; height:38px; object-fit:contain; border-radius:6px; border:1px solid #e2e8f0; background:#ffffff;"
                            />
                          ` : `
                            <div style="width:38px; height:38px; background:#f8fafc; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#94a3b8; border:1px solid #e2e8f0; font-size:0.65rem;">
                              Sem foto
                            </div>
                          `}
                        </td>
                        <td>
                          <div style="font-weight:600; color:#0f172a; font-size:0.875rem;">${p.name}</div>
                        </td>
                        <td>
                          <span style="font-weight:700; font-size:0.9375rem; color:#0f172a;">${stock}</span>
                          <span style="font-size:0.75rem; color:#64748b;"> un</span>
                        </td>
                        <td style="font-size:0.8125rem; color:#475569;">
                          ${minStock} un
                        </td>
                        <td>
                          ${isOut ? `
                            <span class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.75rem;">Sem Estoque</span>
                          ` : (isLow ? `
                            <span class="badge" style="background:#fef3c7; color:#b45309; font-size:0.75rem;">Nível Baixo</span>
                          ` : `
                            <span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.75rem;">Normal</span>
                          `)}
                        </td>
                        <td style="text-align:center; width:52px;">
                          <div class="admin-actions-dropdown">
                            <button type="button" class="admin-actions-trigger-btn" data-id="${p.id}" title="Ações">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                                <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
                                <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
                              </svg>
                            </button>
                            <div class="admin-actions-menu">
                              <button type="button" class="admin-action-item quick-add-stock-btn" data-id="${p.id}" data-name="${p.name}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                                <span>Ajustar Saldo</span>
                              </button>
                              <button type="button" class="admin-action-item edit-product-btn" data-id="${p.id}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                                <span>Editar Produto</span>
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    `;
    }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Mobile: Cards de Estoque -->
            <div class="admin-mobile-card-list admin-mobile-only">
              ${filtered.map(p => {
      const stock = p.stock || 0;
      const minStock = p.stock_min || 2;
      const isOut = stock <= 0;
      const isLow = stock > 0 && stock <= minStock;

      return `
                  <div class="admin-res-card" style="padding:14px; border:1px solid #e2e8f0; border-radius:12px; background:#fff; margin-bottom:10px; box-shadow:0 1px 3px rgba(0,0,0,0.02); box-sizing:border-box; width:100%;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; gap:8px;">
                      <div style="display:flex; gap:10px; align-items:center; min-width:0; flex:1;">
                        ${p.image ? `
                          <img src="${p.image}" alt="${p.name}" style="width:44px; height:44px; object-fit:contain; border-radius:8px; border:1px solid #e2e8f0; background:#fff; flex-shrink:0;" />
                        ` : ''}
                        <div style="min-width:0;">
                          <strong style="color:#0f172a; font-size:0.9375rem; display:block; word-break:break-word;">${p.name}</strong>
                          <span style="font-family:ui-monospace, monospace; font-size:0.75rem; color:#64748b; background:#f1f5f9; padding:1px 6px; border-radius:4px; border:1px solid #e2e8f0;">ID ${p.id}</span>
                        </div>
                      </div>
                      <div style="flex-shrink:0;">
                        ${isOut ? `
                          <span class="badge" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; font-size:0.6875rem; font-weight:700; padding:3px 8px; border-radius:6px;">SEM ESTOQUE</span>
                        ` : (isLow ? `
                          <span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-size:0.6875rem; font-weight:700; padding:3px 8px; border-radius:6px;">BAIXO</span>
                        ` : `
                          <span class="badge" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; font-size:0.6875rem; font-weight:700; padding:3px 8px; border-radius:6px;">NORMAL</span>
                        `)}
                      </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:8px; font-size:0.875rem;">
                      <span style="color:#64748b;">Saldo em Estoque:</span>
                      <strong style="color:#0f172a; font-size:0.95rem;">${stock} unidades</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; font-size:0.8125rem; color:#64748b;">
                      <span>Estoque Mínimo:</span>
                      <span>${minStock} unidades</span>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:10px; padding-top:10px; border-top:1px solid #f1f5f9;">
                      <button type="button" class="btn btn-secondary btn-sm quick-add-stock-btn" data-id="${p.id}" data-name="${p.name}" style="font-size:0.8125rem; font-weight:600; padding:7px 12px; justify-content:center; border-radius:8px;">
                        Ajustar Saldo
                      </button>
                      <button type="button" class="btn btn-secondary btn-sm edit-product-btn" data-id="${p.id}" style="font-size:0.8125rem; font-weight:600; padding:7px 12px; justify-content:center; border-radius:8px;">
                        Editar Produto
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }

  // ===================================================================
  // ABA 10: CONFIGURAÇÕES DA LOJA (Minimalista & Executivo)
  // ===================================================================
  function renderSettingsTab() {
    const s = storeSettings || {};
    return `
      <div class="admin-settings-wrapper" style="display:flex; flex-direction:column; gap:14px; max-width:1080px; margin:0 auto; width:100%; box-sizing:border-box;">
        <h1 style="font-size:1.25rem; font-weight:800; color:#0f172a; margin:0;">Configuração da Loja</h1>

        <!-- 2. Card Unificado com Sub-Abas e Formulário -->
        <div class="admin-settings-card">
          <div class="admin-settings-subnav">
            <button
              type="button"
              class="admin-settings-subtab-btn ${settingsSubTab === 'general' ? 'active' : ''}"
              data-settings-subtab="general"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
              <span>Empresa</span>
            </button>

            <button
              type="button"
              class="admin-settings-subtab-btn ${settingsSubTab === 'shipping' ? 'active' : ''}"
              data-settings-subtab="shipping"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 17h4V5H2v12h3"></path><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2"></path><circle cx="7.5" cy="17.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>
              <span>Envio</span>
            </button>

            <button
              type="button"
              class="admin-settings-subtab-btn ${settingsSubTab === 'payments' ? 'active' : ''}"
              data-settings-subtab="payments"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
              <span>Pagamentos</span>
            </button>
          </div>

          <!-- Conteúdo da Sub-Aba Ativa -->
          <form id="storeSettingsForm" class="admin-settings-body" style="padding:18px;">
            ${settingsSubTab === 'general' ? `
              <!-- SUB-ABA 1: EMPRESA -->
              <div>
                <div style="margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid #f1f5f9;">
                  <h3 style="font-size:0.95rem; font-weight:700; color:#0f172a; margin:0;">Empresa</h3>
                </div>

                <div class="admin-form-grid-2">
                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Nome da Loja *</label>
                    <input type="text" id="setStoreName" class="form-input" value="${s.store_name || 'NovaTech Angola'}" placeholder="Nome da Loja" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Slogan</label>
                    <input type="text" id="setSlogan" class="form-input" value="${s.slogan || 'Loja de Tecnologia, Smartphones e Eletrônicos Premium'}" placeholder="Slogan da loja" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                  </div>
                </div>

                <div class="admin-form-grid-3" style="margin-top:10px;">
                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Telefone *</label>
                    <input type="tel" id="setPhone" class="form-input" value="${s.phone || '+244 923 179 192'}" placeholder="+244 923 179 192" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">WhatsApp *</label>
                    <input type="tel" id="setWhatsapp" class="form-input" value="${s.whatsapp || '+244 923 179 192'}" placeholder="+244 923 179 192" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">E-mail *</label>
                    <input type="email" id="setEmail" class="form-input" value="${s.email || 'contacto@novatech.co.ao'}" placeholder="contacto@novatech.co.ao" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" required />
                  </div>
                </div>
              </div>

              <!-- Bloco B: Endereço -->
              <div style="padding-top:10px; border-top:1px solid #f1f5f9;">
                <div style="margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid #f1f5f9;">
                  <h3 style="font-size:0.95rem; font-weight:700; color:#0f172a; margin:0;">Endereço</h3>
                </div>

                <div class="admin-form-grid-2">
                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Província *</label>
                    <select id="setProvincia" class="form-input" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" required>
                      ${[
                        'Luanda', 'Bengo', 'Benguela', 'Bié', 'Cabinda', 'Cuando', 'Cuanza Norte',
                        'Cuanza Sul', 'Cubango', 'Cunene', 'Huambo', 'Huíla', 'Ícolo e Bengo',
                        'Lunda Norte', 'Lunda Sul', 'Malanje', 'Moxico', 'Moxico Leste',
                        'Namibe', 'Uíge', 'Zaire'
                      ].map(p => `<option value="${p}" ${(s.provincia || 'Luanda') === p ? 'selected' : ''}>${p}</option>`).join('')}
                    </select>
                  </div>

                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Município / Cidade *</label>
                    <input type="text" id="setCity" class="form-input" value="${s.cidade || 'Luanda'}" placeholder="Cidade / Município" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" required />
                  </div>
                </div>

                <div class="admin-form-grid-2" style="margin-top:10px;">
                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Bairro *</label>
                    <input type="text" id="setNeighborhood" class="form-input" value="${s.bairro || 'Talatona'}" placeholder="Bairro / Distrito" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" required />
                  </div>

                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Rua / Avenida *</label>
                    <input type="text" id="setStreet" class="form-input" value="${s.rua || 'Av. Luanda Sul'}" placeholder="Rua / Avenida" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" required />
                  </div>
                </div>

                <div class="admin-form-grid-2" style="margin-top:10px;">
                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Nº / Edifício / Sede *</label>
                    <input type="text" id="setAddress" class="form-input" value="${s.endereco || 'Talatona Shopping, Loja 12'}" placeholder="Nº da Casa / Edifício / Loja" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" required />
                  </div>

                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Ponto de Referência</label>
                    <input type="text" id="setReference" class="form-input" value="${s.ponto_referencia || 'Próximo ao Belas Shopping'}" placeholder="Ponto de referência" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                  </div>
                </div>
              </div>

              <div class="admin-settings-action-row">
                <button type="submit" class="btn btn-primary" style="padding:11px 24px; font-weight:700; font-size:0.875rem; border-radius:6px;">
                  Salvar Empresa
                </button>
              </div>
            ` : settingsSubTab === 'shipping' ? `
              <!-- SUB-ABA 2: ENVIO -->
              <div>
                <div style="margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid #f1f5f9;">
                  <h3 style="font-size:0.95rem; font-weight:700; color:#0f172a; margin:0;">Tarifas de Envio</h3>
                </div>

                <div class="admin-form-grid-3">
                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Entrega Normal (Kz) *</label>
                    <input type="number" id="setShippingNormal" class="form-input" value="${s.shipping_price_normal !== undefined ? s.shipping_price_normal : 3500}" min="0" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" required />
                  </div>

                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Entrega Expresso (Kz) *</label>
                    <input type="number" id="setShippingExpress" class="form-input" value="${s.shipping_price_express !== undefined ? s.shipping_price_express : 6500}" min="0" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" required />
                  </div>

                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Frete Grátis Acima de (Kz) *</label>
                    <input type="number" id="setFreeShipping" class="form-input" value="${s.free_shipping_threshold !== undefined ? s.free_shipping_threshold : 1000000}" min="0" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" required />
                  </div>
                </div>

                <div class="admin-settings-action-row">
                  <button type="submit" class="btn btn-primary" style="padding:11px 24px; font-weight:700; font-size:0.875rem; border-radius:6px;">
                    Salvar Envio
                  </button>
                </div>
              </div>
            ` : `
              <!-- SUB-ABA 3: PAGAMENTOS -->
              <div>
                <div style="margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid #f1f5f9;">
                  <h3 style="font-size:0.95rem; font-weight:700; color:#0f172a; margin:0;">Contas & Pagamentos</h3>
                </div>

                <div class="admin-form-grid-2">
                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Titular da Conta</label>
                    <input type="text" id="setBankHolder" class="form-input" value="${s.bank_holder || 'NovaTech Comércio & Serviços, Lda'}" placeholder="Nome do Titular" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Banco Principal</label>
                    <input type="text" id="setBankName" class="form-input" value="${s.bank_name || 'Banco Angolano de Investimentos (BAI)'}" placeholder="Ex: BAI / BFA" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                  </div>
                </div>

                <div class="admin-form-grid-2" style="margin-top:10px;">
                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">IBAN Oficial</label>
                    <input type="text" id="setBankIban" class="form-input" value="${s.bank_iban || 'AO06 0040 0000 1234 5678 9012 3'}" placeholder="AO06 0000..." style="font-family:ui-monospace, monospace; font-weight:700; height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px; display:block;">Multicaixa Express (MCX)</label>
                    <input type="tel" id="setMcxPhone" class="form-input" value="${s.mcx_phone || s.phone || '+244 923 179 192'}" placeholder="+244 923 179 192" style="height:40px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;" />
                  </div>
                </div>

                <div class="admin-settings-action-row">
                  <button type="submit" class="btn btn-primary" style="padding:11px 24px; font-weight:700; font-size:0.875rem; border-radius:6px;">
                    Salvar Pagamentos
                  </button>
                </div>
              </div>
            `}
          </form>
        </div>
      </div>
    `;
  }

  // ===================================================================
  // ABA 11: MINHA CONTA / PERFIL DO ADMINISTRADOR (Enterprise Executive Edition)
  // 100% Corporativo • Separado por Abas: Dados Cadastrais & Segurança
  // ===================================================================
  function renderProfileTab() {
    const user = Storage.getUser() || { name: 'Administrador', email: 'admin@novatech.co.ao', role: 'admin' };
    const rawName = (user?.name || 'Administrador').trim();
    const firstName = rawName.split(' ')[0] || 'Administrador';
    const initials = rawName.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'AD';

    return `
      <div class="admin-profile-wrapper" style="display:flex; flex-direction:column; gap:18px; max-width:1080px; margin:0 auto; width:100%; box-sizing:border-box;">
        <!-- 1. Header Corporativo de Identificação do Gestor -->
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:18px 22px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; box-shadow:0 1px 3px rgba(15,23,42,0.04);">
          <div style="display:flex; align-items:center; gap:16px;">
            <div style="width:52px; height:52px; border-radius:10px; background:#0f172a; color:#ffffff; font-size:1.2rem; font-weight:800; display:flex; align-items:center; justify-content:center; letter-spacing:0.05em; flex-shrink:0; border:1px solid #334155;">
              ${initials}
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <h2 style="font-size:1.15rem; font-weight:800; color:#0f172a; margin:0; letter-spacing:-0.01em;">${rawName}</h2>
                <span class="badge" style="background:#f1f5f9; color:#0f172a; font-size:0.6875rem; font-weight:700; border:1px solid #e2e8f0; padding:2px 8px; border-radius:5px; text-transform:uppercase; letter-spacing:0.04em;">
                  Gestor Master
                </span>
              </div>
              <div style="font-size:0.8125rem; color:#64748b; margin-top:3px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <span>${user.email || 'admin@novatech.co.ao'}</span>
                <span style="color:#cbd5e1;">•</span>
                <span style="display:inline-flex; align-items:center; color:#15803d; font-weight:600; font-size:0.8125rem;">
                  <span style="width:6px; height:6px; border-radius:50%; background:#16a34a; margin-right:5px; display:inline-block;"></span>
                  Sessão Autenticada
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Card Unificado de Perfil com Sub-Abas -->
        <div class="admin-profile-card">
          <div class="admin-profile-subnav">
            <button
              type="button"
              class="admin-profile-subtab-btn ${profileSubTab === 'data' ? 'active' : ''}"
              data-profile-subtab="data"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span>Dados Cadastrais</span>
            </button>

            <button
              type="button"
              class="admin-profile-subtab-btn ${profileSubTab === 'security' ? 'active' : ''}"
              data-profile-subtab="security"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <span>Segurança de Acesso</span>
            </button>
          </div>

          <!-- Conteúdo da Aba Selecionada -->
          ${profileSubTab === 'data' ? `
            <!-- ABA 1: DADOS CADASTRAIS -->
            <div class="admin-profile-body">
              <div style="margin-bottom:8px; padding-bottom:12px; border-bottom:1px solid #f1f5f9;">
                <h3 style="font-size:1rem; font-weight:700; color:#0f172a; margin:0 0 4px 0;">Informações Pessoais & Contato Profissional</h3>
                <p style="font-size:0.8125rem; color:#64748b; margin:0;">Mantenha seus dados de identificação e contato atualizados para comunicações corporativas.</p>
              </div>

              <form id="adminProfileDataForm" style="display:flex; flex-direction:column; gap:16px;">
                <div class="admin-form-grid-2">
                  <div class="form-group">
                    <label class="form-label" for="profileName" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">
                      Nome Completo <span style="color:#ef4444;">*</span>
                    </label>
                    <input 
                      type="text" 
                      id="profileName" 
                      class="form-input" 
                      value="${user.name || ''}" 
                      placeholder="Ex: Leonardo Adriano" 
                      required 
                      minlength="2"
                      autocomplete="name"
                      style="height:42px; font-size:0.875rem; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;"
                    />
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="profileEmail" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">
                      E-mail Institucional (Login) <span style="color:#ef4444;">*</span>
                    </label>
                    <input 
                      type="email" 
                      id="profileEmail" 
                      class="form-input" 
                      value="${user.email || ''}" 
                      placeholder="admin@novatech.co.ao" 
                      required 
                      autocomplete="email"
                      style="height:42px; font-size:0.875rem; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;"
                    />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="profilePhone" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">
                    Telefone / WhatsApp Profissional
                  </label>
                  <input 
                    type="tel" 
                    id="profilePhone" 
                    class="form-input" 
                    value="${user.phone || ''}" 
                    placeholder="+244 923 179 192" 
                    autocomplete="tel"
                    style="height:42px; font-size:0.875rem; border-radius:8px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 12px;"
                  />
                </div>

                <div class="admin-profile-action-row">
                  <button type="submit" id="saveProfileDataBtn" class="btn btn-primary" style="padding:11px 24px; font-weight:700; font-size:0.875rem; border-radius:8px;">
                    Salvar Alterações Cadastrais
                  </button>
                </div>
              </form>
            </div>
          ` : `
            <!-- ABA 2: SEGURANÇA DE ACESSO -->
            <div class="admin-profile-body">
              <div style="margin-bottom:8px; padding-bottom:12px; border-bottom:1px solid #f1f5f9;">
                <h3 style="font-size:1rem; font-weight:700; color:#0f172a; margin:0 0 4px 0;">Atualização de Senha de Acesso</h3>
                <p style="font-size:0.8125rem; color:#64748b; margin:0;">Para sua proteção, confirme a senha atual antes de cadastrar uma nova chave de acesso.</p>
              </div>rgba(15,23,42,0.04);">
              <div style="margin-bottom:20px; padding-bottom:12px; border-bottom:1px solid #f1f5f9;">
                <h3 style="font-size:1rem; font-weight:700; color:#0f172a; margin:0 0 4px 0;">Atualização de Senha de Acesso</h3>
                <p style="font-size:0.8125rem; color:#64748b; margin:0;">Para sua proteção, confirme a senha atual antes de cadastrar uma nova chave de acesso.</p>
              </div>

              <form id="adminPasswordChangeForm" style="display:flex; flex-direction:column; gap:16px; max-width:680px;">
                <div class="form-group">
                  <label class="form-label" for="pwdCurrent" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">
                    Senha Atual <span style="color:#ef4444;">*</span>
                  </label>
                  <div style="position:relative; display:flex; align-items:center;">
                    <input 
                      type="password" 
                      id="pwdCurrent" 
                      class="form-input" 
                      placeholder="Digite sua senha atual" 
                      required 
                      autocomplete="current-password"
                      style="height:38px; font-size:0.875rem; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:6px 40px 6px 12px;"
                    />
                    <button 
                      type="button" 
                      class="toggle-pwd-visibility-btn" 
                      data-target="pwdCurrent" 
                      style="position:absolute; right:10px; background:none; border:none; color:#64748b; cursor:pointer; padding:4px;"
                      title="Alternar visualização da senha"
                    >
                      👁
                    </button>
                  </div>
                </div>

                <div class="admin-form-grid-2" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                  <div class="form-group">
                    <label class="form-label" for="pwdNew" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">
                      Nova Senha <span style="color:#ef4444;">*</span>
                    </label>
                    <div style="position:relative; display:flex; align-items:center;">
                      <input 
                        type="password" 
                        id="pwdNew" 
                        class="form-input" 
                        placeholder="Mínimo de 6 caracteres" 
                        required 
                        minlength="6"
                        autocomplete="new-password"
                        style="height:38px; font-size:0.875rem; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:6px 40px 6px 12px;"
                      />
                      <button 
                        type="button" 
                        class="toggle-pwd-visibility-btn" 
                        data-target="pwdNew" 
                        style="position:absolute; right:10px; background:none; border:none; color:#64748b; cursor:pointer; padding:4px;"
                        title="Alternar visualização da senha"
                      >
                        👁
                      </button>
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="pwdConfirm" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">
                      Confirmar Nova Senha <span style="color:#ef4444;">*</span>
                    </label>
                    <div style="position:relative; display:flex; align-items:center;">
                      <input 
                        type="password" 
                        id="pwdConfirm" 
                        class="form-input" 
                        placeholder="Repita a nova senha" 
                        required 
                        minlength="6"
                        autocomplete="new-password"
                        style="height:38px; font-size:0.875rem; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:6px 40px 6px 12px;"
                      />
                      <button 
                        type="button" 
                        class="toggle-pwd-visibility-btn" 
                        data-target="pwdConfirm" 
                        style="position:absolute; right:10px; background:none; border:none; color:#64748b; cursor:pointer; padding:4px;"
                        title="Alternar visualização da senha"
                      >
                        👁
                      </button>
                    </div>
                  </div>
                </div>

                <div style="display:flex; justify-content:flex-end; margin-top:8px; padding-top:16px; border-top:1px solid #f1f5f9;">
                  <button type="submit" id="savePasswordBtn" class="btn btn-primary" style="padding:10px 24px; font-weight:700; font-size:0.875rem; border-radius:6px;">
                    Atualizar Senha de Acesso
                  </button>
                </div>
              </form>
            </div>
          </div>
        `}
      </div>
    `;
  }

  // --- HELPERS E BADGES ---
  function renderStatusBadge(status) {
    const s = String(status || '').toLowerCase();
    const dot = (color) => `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${color}; margin-right:5px; flex-shrink:0;"></span>`;

    switch (s) {
      case 'received':
        return `<span class="badge" style="display:inline-flex; align-items:center; background:#fffbeb; color:#b45309; border:1px solid #fef3c7; font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:5px;">${dot('#f59e0b')}Recebido</span>`;
      case 'confirmed':
        return `<span class="badge" style="display:inline-flex; align-items:center; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:5px;">${dot('#16a34a')}Confirmado</span>`;
      case 'preparing':
        return `<span class="badge" style="display:inline-flex; align-items:center; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:5px;">${dot('#3b82f6')}Em Separação</span>`;
      case 'shipped':
        return `<span class="badge" style="display:inline-flex; align-items:center; background:#f5f3ff; color:#6d28d9; border:1px solid #ddd6fe; font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:5px;">${dot('#8b5cf6')}Enviado</span>`;
      case 'delivered':
        return `<span class="badge" style="display:inline-flex; align-items:center; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:5px;">${dot('#10b981')}Entregue</span>`;
      case 'cancelled':
        return `<span class="badge" style="display:inline-flex; align-items:center; background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:5px;">${dot('#ef4444')}Cancelado</span>`;
      default:
        return `<span class="badge" style="display:inline-flex; align-items:center; background:#f8fafc; color:#475569; border:1px solid #e2e8f0; font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:5px;">${status || '—'}</span>`;
    }
  }

  function renderPaymentBadge(status, method = '') {
    const s = String(status || '').toLowerCase();
    const methodText = method ? ` · ${method.toUpperCase()}` : '';
    const dot = (color) => `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${color}; margin-right:5px; flex-shrink:0;"></span>`;

    if (s === 'paid' || s === 'completed' || s === 'pago') {
      return `<span class="badge" style="display:inline-flex; align-items:center; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; font-size:0.6875rem; font-weight:600; padding:2px 7px; border-radius:5px;">${dot('#16a34a')}Pago${methodText}</span>`;
    }
    if (s === 'pending' || s === 'pendente') {
      return `<span class="badge" style="display:inline-flex; align-items:center; background:#fffbeb; color:#b45309; border:1px solid #fef3c7; font-size:0.6875rem; font-weight:600; padding:2px 7px; border-radius:5px;">${dot('#f59e0b')}Pendente${methodText}</span>`;
    }
    if (s === 'failed' || s === 'cancelled' || s === 'recusado') {
      return `<span class="badge" style="display:inline-flex; align-items:center; background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; font-size:0.6875rem; font-weight:600; padding:2px 7px; border-radius:5px;">${dot('#ef4444')}Recusado${methodText}</span>`;
    }
    return `<span class="badge" style="display:inline-flex; align-items:center; background:#f8fafc; color:#475569; border:1px solid #e2e8f0; font-size:0.6875rem; font-weight:600; padding:2px 7px; border-radius:5px;">${status ? status.toUpperCase() : 'PENDENTE'}${methodText}</span>`;
  }

  // --- LOGOUT UNIFICADO COM PROTEÇÃO DE HISTÓRICO ---
  async function performAdminLogout(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    try {
      await Api.auth.logout();
    } catch (err) {
      console.warn('Erro ao chamar logout da API:', err.message);
    }

    Storage.logoutUser();
    sessionStorage.clear();
    Api.removeToken();

    // Reset de dados em memória
    stats = null;
    ordersList = [];
    productsList = [];
    categoriesList = [];

    // IMPEDE RETORNO PELO BOTÃO "VOLTAR" DO NAVEGADOR
    window.location.hash = '#/admin/login';
    window.history.replaceState({ adminLoggedOut: true }, '', window.location.pathname + '#/admin/login');

    Toast.show('Sessão administrativa encerrada com sucesso.', 'info');
    render();
  }

  // Guardião do evento popstate para impedir retorno ao painel via botão "Voltar"
  const handleAdminPopStateGuard = () => {
    const user = Storage.getUser();
    const token = Api.getToken();
    if (!user || user.role !== 'admin' || !token) {
      const sub = getAdminSubRoute();
      if (sub && !['login', 'register', 'forgot-password', 'reset-password'].includes(sub)) {
        window.history.replaceState({ adminLoggedOut: true }, '', window.location.pathname + '#/admin/login');
        render();
      }
    }
  };
  window.removeEventListener('popstate', handleAdminPopStateGuard);
  window.addEventListener('popstate', handleAdminPopStateGuard);

  // Sincronizador de rotas com evento hashchange
  const handleAdminHashSync = () => {
    const hash = window.location.hash || '';
    if (hash.startsWith('#/admin')) {
      render();
    }
  };
  window.removeEventListener('hashchange', handleAdminHashSync);
  window.addEventListener('hashchange', handleAdminHashSync);

  // --- CENTRALIZAÇÃO DE NAVEGAÇÃO ENTRE ABAS DO ADMIN ---
  function switchTab(tab) {
    if (!tab) return;
    currentTab = tab;

    // Atualiza a URL com a rota correspondente
    if (window.location.hash !== `#/admin/${tab}`) {
      window.history.pushState(null, '', window.location.pathname + `#/admin/${tab}`);
    }

    const main = container.querySelector('#adminMainContent');
    if (main) {
      main.innerHTML = renderActiveTabContent();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Atualiza estado ativo nos menus lateral e superior
    container.querySelectorAll('.admin-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === currentTab);
    });
    const topProfileBtn = container.querySelector('#adminTopProfileBtn');
    if (topProfileBtn) {
      topProfileBtn.classList.toggle('active', currentTab === 'profile');
    }
    // Fecha dropdown e gaveta mobile se abertos
    const profileDropdown = container.querySelector('#adminTopProfileDropdown');
    if (profileDropdown) profileDropdown.style.display = 'none';

    const drawer = container.querySelector('#adminMobileDrawer');
    const drawerOverlay = container.querySelector('#adminMobileDrawerOverlay');
    drawer?.classList.remove('open');
    drawerOverlay?.classList.remove('open');

    attachTabSpecificEvents();
  }

  // --- EVENT LISTENERS GLOBAIS DA ESTRUTURA DO ADMIN ---
  function attachLayoutEvents() {
    // Delegação de cliques para botões e atalhos de navegação [data-tab]
    container.addEventListener('click', (e) => {
      const tabTarget = e.target.closest('[data-tab]');
      if (tabTarget) {
        const tab = tabTarget.dataset.tab;
        if (tab && tab !== currentTab) {
          e.preventDefault();
          switchTab(tab);
        }
      }
    });

    // Toggle do Dropdown Executivo no Topbar
    const profileBtn = container.querySelector('#adminTopProfileBtn');
    const profileDropdown = container.querySelector('#adminTopProfileDropdown');
    if (profileBtn && profileDropdown) {
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = profileDropdown.style.display === 'block';
        profileDropdown.style.display = isOpen ? 'none' : 'block';
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.admin-profile-dropdown-wrapper')) {
          if (profileDropdown) profileDropdown.style.display = 'none';
        }
        if (!e.target.closest('.admin-actions-dropdown')) {
          container.querySelectorAll('.admin-actions-dropdown.is-open').forEach(d => {
            d.classList.remove('is-open');
          });
        }
      });
    }

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

    // Logout em todos os pontos acessíveis do painel
    const logoutBtns = container.querySelectorAll('#adminLogoutBtn, #sidebarLogoutBtn, #adminDropdownLogoutBtn, .admin-nav-item-logout');
    logoutBtns.forEach(btn => {
      btn.addEventListener('click', performAdminLogout);
    });

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
        const id = btn.dataset.orderId;
        const order = ordersList.find(o => String(o.id) === String(id) || o.order_code === id || o.codigo_pedido === id);
        if (order) openOrderDetailsModal(order);
      });
    });

    container.querySelectorAll('.copy-order-code-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const code = btn.dataset.code;
        if (code) {
          navigator.clipboard.writeText(code);
          Toast.show(`Código ${code} copiado!`, 'success');
        }
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

    // Dropdown de Ações dos Produtos (Desktop e Mobile)
    container.querySelectorAll('.admin-actions-trigger-btn').forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dropdown = trigger.closest('.admin-actions-dropdown');
        const menu = dropdown?.querySelector('.admin-actions-menu');
        if (!dropdown || !menu) return;

        const isOpen = dropdown.classList.contains('is-open');

        // Fecha todos os outros menus de ações abertos
        container.querySelectorAll('.admin-actions-dropdown.is-open').forEach(d => {
          if (d !== dropdown) {
            d.classList.remove('is-open');
          }
        });

        if (!isOpen) {
          dropdown.classList.add('is-open');

          const rect = trigger.getBoundingClientRect();
          const tr = trigger.closest('tr');
          const isTable = Boolean(tr);
          const tableWrapper = trigger.closest('.admin-table-wrapper');

          let shouldOpenUp = false;
          if (isTable && tableWrapper) {
            const wrapRect = tableWrapper.getBoundingClientRect();
            const spaceInsideWrapBelow = wrapRect.bottom - rect.bottom;
            const spaceInsideWrapAbove = rect.top - wrapRect.top;
            // Só abre para cima se estiver na parte inferior da tabela E com espaço suficiente acima E não for primeira ou segunda linha
            if (spaceInsideWrapBelow < 90 && spaceInsideWrapAbove > 120 && (tr.rowIndex || 0) > 2) {
              shouldOpenUp = true;
            }
          } else {
            // Em cards mobile ou listas soltas
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            if (spaceBelow < 110 && spaceAbove > 130) {
              shouldOpenUp = true;
            }
          }

          if (shouldOpenUp) {
            menu.classList.add('open-up');
          } else {
            menu.classList.remove('open-up');
          }
        } else {
          dropdown.classList.remove('is-open');
        }
      });
    });

    // Fechar menu de ação ao clicar em qualquer item dentro dele
    container.querySelectorAll('.admin-actions-menu .admin-action-item').forEach(item => {
      item.addEventListener('click', () => {
        const dropdown = item.closest('.admin-actions-dropdown');
        if (dropdown) dropdown.classList.remove('is-open');
      });
    });

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

    container.querySelectorAll('.toggle-product-block-btn, .toggle-product-active-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const id = Number(btn.dataset.id);
        const isActive = btn.dataset.active === 'true';
        try {
          await Api.products.update(id, { is_active: !isActive });
          Toast.show(`Produto ${id} ${!isActive ? 'desbloqueado e ativado' : 'bloqueado'} com sucesso!`, 'info');
          await loadAllData();
          render();
        } catch (err) {
          Toast.show(err.message || 'Erro ao alterar status do produto.', 'error');
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

    // --- Categorias & Subcategorias (Aninhamento e Acordeão Interativo) ---
    const catSearch = container.querySelector('#categorySearchInput');
    if (catSearch) {
      catSearch.addEventListener('input', (e) => {
        categorySearchQuery = e.target.value;
        if (categorySearchQuery.trim()) {
          const q = categorySearchQuery.toLowerCase().trim();
          categoriesList.forEach(c => {
            const matchCat = (c.name && c.name.toLowerCase().includes(q)) || (c.description && c.description.toLowerCase().includes(q));
            const matchSub = Array.isArray(c.subcategories) && c.subcategories.some(s =>
              (s.name && s.name.toLowerCase().includes(q)) || (s.description && s.description.toLowerCase().includes(q))
            );
            if (matchCat || matchSub) {
              expandedCategoryIds.add(c.id);
            }
          });
        }
        const main = container.querySelector('#adminMainContent');
        if (main && currentTab === 'categories') {
          main.innerHTML = renderCategoriesTab();
          attachTabSpecificEvents();
        }
      });
    }

    const catSort = container.querySelector('#categorySortSelect');
    if (catSort) {
      catSort.addEventListener('change', (e) => {
        categorySortOrder = e.target.value;
        const main = container.querySelector('#adminMainContent');
        if (main && currentTab === 'categories') {
          main.innerHTML = renderCategoriesTab();
          attachTabSpecificEvents();
        }
      });
    }

    const newCatBtn = container.querySelector('#openNewCategoryModalBtn');
    const emptyCatBtn = container.querySelector('#emptyStateNewCatBtn');
    if (newCatBtn) newCatBtn.addEventListener('click', () => openCategoryModal());
    if (emptyCatBtn) emptyCatBtn.addEventListener('click', () => openCategoryModal());

    // Toggle do Acordeão: Clicar no cabeçalho da categoria abre ou fecha suas subcategorias
    container.querySelectorAll('.category-accordion-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('.btn')) return;
        const catId = Number(header.dataset.catId);
        if (expandedCategoryIds.has(catId)) {
          expandedCategoryIds.delete(catId);
        } else {
          expandedCategoryIds.add(catId);
        }
        const main = container.querySelector('#adminMainContent');
        if (main && currentTab === 'categories') {
          main.innerHTML = renderCategoriesTab();
          attachTabSpecificEvents();
        }
      });
    });

    // Botão de Adicionar Subcategoria em Categoria Específica
    container.querySelectorAll('.add-sub-to-cat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const catId = Number(btn.dataset.catId);
        expandedCategoryIds.add(catId); // Garante que a categoria pai fique expandida
        openSubcategoryModal({ parent_id: catId });
      });
    });

    // Botão de Editar Categoria
    container.querySelectorAll('.edit-category-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        const cat = categoriesList.find(c => c.id === id);
        if (cat) openCategoryModal(cat);
      });
    });

    // Botão de Excluir Categoria
    container.querySelectorAll('.delete-category-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        const catName = btn.dataset.catName || 'esta categoria';
        if (confirm(`Tem certeza que deseja excluir permanentemente a categoria "${catName}" e todas as suas subcategorias vinculadas?`)) {
          try {
            await Api.categories.delete(id);
            expandedCategoryIds.delete(id);
            Toast.show('Categoria excluída com sucesso.', 'success');
            await loadAllData();
            render();
          } catch (err) {
            Toast.show(err.message || 'Erro ao excluir categoria.', 'error');
          }
        }
      });
    });

    // Botão de Editar Subcategoria
    container.querySelectorAll('.edit-subcategory-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const catId = Number(btn.dataset.catId);
        const subId = btn.dataset.subId;
        const cat = categoriesList.find(c => c.id === catId);
        const sub = (cat?.subcategories || []).find(s => String(s.id) === String(subId));
        if (cat && sub) {
          openSubcategoryModal({ parent_id: cat.id, sub });
        }
      });
    });

    // Botão de Excluir Subcategoria
    container.querySelectorAll('.delete-subcategory-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const catId = Number(btn.dataset.catId);
        const subId = btn.dataset.subId;
        const subName = btn.dataset.subName || 'esta subcategoria';
        if (confirm(`Deseja remover a subcategoria "${subName}"?`)) {
          try {
            await Api.categories.deleteSubcategory(catId, subId);
            expandedCategoryIds.add(catId); // Mantém a categoria aberta para conferência imediata
            Toast.show('Subcategoria removida com sucesso.', 'success');
            await loadAllData();
            render();
          } catch (err) {
            Toast.show(err.message || 'Erro ao remover subcategoria.', 'error');
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

    const cpSearch = container.querySelector('#couponSearchInput');
    if (cpSearch) {
      cpSearch.addEventListener('input', (e) => {
        couponSearchQuery = e.target.value;
        const main = container.querySelector('#adminMainContent');
        if (main && currentTab === 'coupons') {
          main.innerHTML = renderCouponsTab();
          attachTabSpecificEvents();
        }
      });
    }

    const cpStatus = container.querySelector('#couponStatusFilterSelect');
    if (cpStatus) {
      cpStatus.addEventListener('change', (e) => {
        couponStatusFilter = e.target.value;
        const main = container.querySelector('#adminMainContent');
        if (main && currentTab === 'coupons') {
          main.innerHTML = renderCouponsTab();
          attachTabSpecificEvents();
        }
      });
    }

    container.querySelectorAll('.edit-coupon-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const cp = couponsList.find(c => c.id === id);
        if (cp) openCouponModal(cp);
      });
    });

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

    const custStatus = container.querySelector('#customerStatusFilterSelect');
    if (custStatus) {
      custStatus.addEventListener('change', (e) => {
        customerStatusFilter = e.target.value;
        const main = container.querySelector('#adminMainContent');
        if (main) main.innerHTML = renderCustomersTab();
        attachTabSpecificEvents();
      });
    }

    container.querySelectorAll('.open-customer-modal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const cust = customersList.find(c => c.id === id);
        if (cust) openCustomerDetailsModal(cust);
      });
    });

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

    const stkSearch = container.querySelector('#stockSearchInput');
    if (stkSearch) {
      stkSearch.addEventListener('input', (e) => {
        stockSearchQuery = e.target.value;
        const main = container.querySelector('#adminMainContent');
        if (main && currentTab === 'stock') {
          main.innerHTML = renderStockTab();
          attachTabSpecificEvents();
        }
      });
    }

    const stkStatus = container.querySelector('#stockStatusFilterSelect');
    if (stkStatus) {
      stkStatus.addEventListener('change', (e) => {
        stockStatusFilter = e.target.value;
        const main = container.querySelector('#adminMainContent');
        if (main && currentTab === 'stock') {
          main.innerHTML = renderStockTab();
          attachTabSpecificEvents();
        }
      });
    }

    container.querySelectorAll('.quick-add-stock-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        openStockMovementModal({ product_id: id, movement_type: 'in' });
      });
    });

    // Alternância de Sub-Abas das Configurações da Loja
    container.querySelectorAll('.admin-settings-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetSub = btn.dataset.settingsSubtab;
        if (targetSub && targetSub !== settingsSubTab) {
          settingsSubTab = targetSub;
          render();
        }
      });
    });

    // --- Configurações da Loja ---
    const storeForm = container.querySelector('#storeSettingsForm');
    if (storeForm) {
      storeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          ...storeSettings,
          store_name: container.querySelector('#setStoreName')?.value.trim() ?? storeSettings.store_name,
          slogan: container.querySelector('#setSlogan')?.value.trim() ?? storeSettings.slogan,
          phone: container.querySelector('#setPhone')?.value.trim() ?? storeSettings.phone,
          whatsapp: container.querySelector('#setWhatsapp')?.value.trim() ?? storeSettings.whatsapp,
          email: container.querySelector('#setEmail')?.value.trim() ?? storeSettings.email,
          provincia: container.querySelector('#setProvincia')?.value ?? (storeSettings.provincia || 'Luanda'),
          cidade: container.querySelector('#setCity')?.value.trim() ?? (storeSettings.cidade || 'Luanda'),
          bairro: container.querySelector('#setNeighborhood')?.value.trim() ?? (storeSettings.bairro || 'Talatona'),
          rua: container.querySelector('#setStreet')?.value.trim() ?? (storeSettings.rua || 'Av. Luanda Sul'),
          endereco: container.querySelector('#setAddress')?.value.trim() ?? (storeSettings.endereco || ''),
          address: container.querySelector('#setAddress')?.value.trim() ?? (storeSettings.endereco || ''),
          ponto_referencia: container.querySelector('#setReference')?.value.trim() ?? (storeSettings.ponto_referencia || ''),
          shipping_price_normal: container.querySelector('#setShippingNormal') ? Number(container.querySelector('#setShippingNormal').value) : storeSettings.shipping_price_normal,
          shipping_price_express: container.querySelector('#setShippingExpress') ? Number(container.querySelector('#setShippingExpress').value) : storeSettings.shipping_price_express,
          free_shipping_threshold: container.querySelector('#setFreeShipping') ? Number(container.querySelector('#setFreeShipping').value) : storeSettings.free_shipping_threshold,
          bank_holder: container.querySelector('#setBankHolder')?.value.trim() ?? storeSettings.bank_holder,
          bank_name: container.querySelector('#setBankName')?.value.trim() ?? storeSettings.bank_name,
          bank_iban: container.querySelector('#setBankIban')?.value.trim() ?? storeSettings.bank_iban,
          mcx_phone: container.querySelector('#setMcxPhone')?.value.trim() ?? storeSettings.mcx_phone
        };

        try {
          await Api.settings.save('general', payload);
          storeSettings = { ...storeSettings, ...payload };
          Toast.show('Configurações salvas com sucesso!', 'success');
          currentTab = 'dashboard';
          window.history.replaceState(null, '', window.location.pathname + '#/admin/dashboard');
          await loadAllData();
          render();
        } catch (err) {
          Toast.show(err.message || 'Erro ao salvar configurações.', 'error');
        }
      });
    }

    // --- Perfil do Administrador: Dados Cadastrais & Login ---
    const profileForm = container.querySelector('#adminProfileDataForm');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = container.querySelector('#profileName').value.trim();
        const email = container.querySelector('#profileEmail').value.trim();
        const phone = container.querySelector('#profilePhone').value.trim();

        if (name.length < 2) {
          Toast.show('O nome deve conter pelo menos 2 caracteres.', 'warning');
          return;
        }

        if (!email.includes('@') || !email.includes('.')) {
          Toast.show('Por favor, informe um endereço de e-mail válido.', 'warning');
          return;
        }

        const saveBtn = container.querySelector('#saveProfileDataBtn');
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Salvando dados...';
        }

        try {
          const updated = await Api.auth.updateAdminAccount({ name, email, phone });
          const current = Storage.getUser() || {};
          Storage.saveUser({ ...current, ...updated });
          Toast.show('Dados cadastrais atualizados com sucesso!', 'success');
          render();
        } catch (err) {
          Toast.show(err.message || 'Erro ao atualizar dados cadastrais.', 'error');
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar Dados Cadastrais';
          }
        }
      });
    }

    // --- Perfil do Administrador: Alteração de Senha com Validações ---
    const pwdForm = container.querySelector('#adminPasswordChangeForm');
    if (pwdForm) {
      pwdForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = container.querySelector('#pwdCurrent').value;
        const newPassword = container.querySelector('#pwdNew').value;
        const confirmPassword = container.querySelector('#pwdConfirm').value;

        if (!currentPassword) {
          Toast.show('Informe sua senha atual para autorizar a modificação.', 'warning');
          return;
        }

        if (newPassword.length < 6) {
          Toast.show('A nova senha deve ter no mínimo 6 dígitos.', 'warning');
          return;
        }

        if (newPassword !== confirmPassword) {
          Toast.show('A confirmação não coincide com a nova senha digitada.', 'error');
          return;
        }

        if (currentPassword === newPassword) {
          Toast.show('A nova senha deve ser diferente da senha atual.', 'warning');
          return;
        }

        const savePwdBtn = container.querySelector('#savePasswordBtn');
        if (savePwdBtn) {
          savePwdBtn.disabled = true;
          savePwdBtn.textContent = 'Atualizando senha...';
        }

        try {
          await Api.auth.updateAdminAccount({ currentPassword, newPassword });
          Toast.show('Senha de acesso atualizada com sucesso!', 'success');
          pwdForm.reset();
        } catch (err) {
          Toast.show(err.message || 'Erro ao atualizar senha.', 'error');
        } finally {
          if (savePwdBtn) {
            savePwdBtn.disabled = false;
            savePwdBtn.textContent = 'Atualizar Senha';
          }
        }
      });
    }

    // Alternar visibilidade de senhas sem expor dados sensíveis
    container.querySelectorAll('.toggle-pwd-visibility-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = container.querySelector(`#${targetId}`);
        if (input) {
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';
          btn.textContent = isPassword ? '🔒' : '👁';
        }
      });
    });

    // Alternância entre Sub-Abas do Perfil (Dados Cadastrais & Segurança de Acesso)
    container.querySelectorAll('.admin-profile-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetSub = btn.dataset.profileSubtab;
        if (targetSub && targetSub !== profileSubTab) {
          profileSubTab = targetSub;
          render();
        }
      });
    });
  }

  // ===================================================================
  // MODAIS OPERACIONAIS COMPLETOS
  // ===================================================================

  // 1. Modal de Pedido Completo & Operacional
  function openOrderDetailsModal(order) {
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';

    const items = order.items || order.itens_pedido || [];
    const phone = order.customer_phone || order.telefone_cliente || '';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('244') ? cleanPhone : '244' + cleanPhone}` : null;
    const history = Array.isArray(order.status_history) ? order.status_history : [];
    const cleanCode = String(order.order_code || order.codigo_pedido || order.id).replace(/^#/, '');
    const proofUrl = order.receipt_url || order.payment_details?.receipt_url || order.payment_details?.comprovativo_url || null;

    modal.innerHTML = `
      <div class="admin-modal-dialog admin-modal-product-dialog" style="max-width: 680px !important;">
        <!-- Cabeçalho Executivo -->
        <div class="admin-modal-product-header">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <h3 class="admin-modal-title" style="margin: 0; font-size: 1.125rem; font-weight: 700; color: #0f172a;">
              Pedido ${cleanCode}
            </h3>
            <span style="font-size: 0.75rem; color: #64748b;">${formatDate(order.created_at || order.criado_em || order.date)}</span>
            ${renderStatusBadge(order.status || order.status_pedido)}
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${waLink ? `
              <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 5px; color: #15803d; border-color: #bbf7d0; background: #f0fdf4; font-size: 0.75rem; padding: 4px 10px; text-decoration: none;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <span>WhatsApp</span>
              </a>
            ` : ''}
            <button type="button" class="admin-modal-close-icon close-modal-btn" title="Fechar (Esc)">✕</button>
          </div>
        </div>

        <div class="admin-modal-product-body" style="padding: 14px 18px !important; background: #ffffff !important; display: flex; flex-direction: column; gap: 10px;">
          <!-- Grid 2 Colunas: Cliente & Pagamento -->
          <div class="admin-product-bottom-grid">
            <!-- 1. Cliente & Entrega -->
            <div class="admin-card-panel">
              <div class="admin-panel-header">
                <span class="admin-panel-title">Cliente & Envio</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.8125rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">Nome:</span>
                  <strong style="color: #0f172a; text-align: right;">${order.customer_name || order.nome_cliente || 'Não informado'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">Telefone:</span>
                  <span style="color: #0f172a;">${phone || 'Não informado'}</span>
                </div>
                ${(order.customer_email || order.email_cliente) ? `
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #64748b;">E-mail:</span>
                    <span style="color: #0f172a; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${order.customer_email || order.email_cliente}</span>
                  </div>
                ` : ''}
                <div style="border-top: 1px dashed #e2e8f0; padding-top: 6px; margin-top: 2px;">
                  <div style="color: #64748b; font-size: 0.75rem;">Endereço:</div>
                  <div style="color: #0f172a; font-weight: 500; margin-top: 2px;">${order.shipping_address || order.endereco_entrega || 'Entrega padrão Luanda'}</div>
                  ${order.ponto_referencia ? `
                    <div style="color: #64748b; font-size: 0.75rem; margin-top: 3px;">Ref: ${order.ponto_referencia}</div>
                  ` : ''}
                  <div style="color: #475569; font-size: 0.75rem; margin-top: 3px;">
                    Método: ${order.shipping_method === 'express' ? 'Entrega Expressa' : 'Entrega Padrão'}
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. Pagamento & Totais -->
            <div class="admin-card-panel">
              <div class="admin-panel-header">
                <span class="admin-panel-title">Pagamento & Totais</span>
                ${renderPaymentBadge(order.payment_status, order.payment_method)}
              </div>
              <div style="display: flex; flex-direction: column; gap: 5px; font-size: 0.8125rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">Método:</span>
                  <span style="font-weight: 600; color: #0f172a;">${(order.payment_method || order.metodo_pagamento || 'MULTICAIXA').toUpperCase()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #64748b;">Condição:</span>
                  <span style="font-weight: 700; color: #15803d; background: #f0fdf4; padding: 2px 7px; border-radius: 4px; border: 1px solid #bbf7d0; font-size: 0.6875rem;">PRONTO PAGAMENTO (À VISTA)</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">Subtotal:</span>
                  <span>${formatPrice(order.subtotal || order.total)}</span>
                </div>
                ${order.discount ? `
                  <div style="display: flex; justify-content: space-between; color: #16a34a;">
                    <span>Desconto:</span>
                    <span>- ${formatPrice(order.discount)}</span>
                  </div>
                ` : ''}
                ${order.shipping_price ? `
                  <div style="display: flex; justify-content: space-between; color: #64748b;">
                    <span>Taxa Entrega:</span>
                    <span>${formatPrice(order.shipping_price)}</span>
                  </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; align-items: baseline; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 4px;">
                  <span style="font-weight: 700; color: #0f172a;">Total:</span>
                  <strong style="font-size: 1.05rem; color: #0f172a;">${formatPrice(order.total)}</strong>
                </div>
                ${proofUrl ? `
                  <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
                    <a href="${proofUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="width: 100%; justify-content: center; font-size: 0.75rem; padding: 5px;">
                      📄 Ver Comprovativo Bancário
                    </a>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- 3. Itens do Pedido -->
          <div class="admin-card-panel">
            <div class="admin-panel-header">
              <span class="admin-panel-title">Itens do Pedido (${items.length})</span>
            </div>
            ${items.length === 0 ? `
              <div style="font-size: 0.8125rem; color: #94a3b8; text-align: center; padding: 12px 0;">
                Nenhum item detalhado neste pedido.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto;">
                ${items.map(it => {
      const name = it.product_name || it.name || it.nome_produto || 'Produto';
      const img = it.product_image || it.image || it.imagem_produto || '';
      const price = Number(it.unit_price || it.price || it.preco_unitario || 0);
      const qty = Number(it.quantity || it.quantidade || 1);
      const itemTotal = Number(it.total_price || it.preco_total || (price * qty));
      const variant = it.selected_variant || it.variant || {};
      const variantStr = Object.entries(variant).map(([k, v]) => `${k}: ${v}`).join(' · ');

      return `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 8px; border-radius: 6px; background: #f8fafc; border: 1px solid #f1f5f9;">
                      <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                        ${img ? `
                          <img src="${img}" alt="${name}" style="width: 36px; height: 36px; object-fit: contain; background: #fff; border: 1px solid #e2e8f0; border-radius: 5px; flex-shrink: 0;" />
                        ` : `
                          <div style="width: 36px; height: 36px; background: #e2e8f0; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: #94a3b8; flex-shrink: 0;">
                            ${Icons.package(16)}
                          </div>
                        `}
                        <div style="min-width: 0;">
                          <div style="font-size: 0.8125rem; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px;" title="${name}">${name}</div>
                          <div style="display: flex; gap: 8px; align-items: center; font-size: 0.75rem; color: #64748b;">
                            ${it.product_sku ? `<span>SKU: ${it.product_sku}</span>` : ''}
                            ${variantStr ? `<span style="color: #2563eb;">${variantStr}</span>` : ''}
                            <span style="font-weight: 600; color: #334155;">Qtd: ${qty} un. (${formatPrice(price)} / un.)</span>
                          </div>
                        </div>
                      </div>
                      <div style="text-align: right; flex-shrink: 0;">
                        <strong style="font-size: 0.8125rem; color: #0f172a;">${formatPrice(itemTotal)}</strong>
                      </div>
                    </div>
                  `;
    }).join('')}
              </div>
            `}
          </div>

          <!-- 4. Alteração de Status & Notas -->
          <div class="admin-card-panel">
            <div class="admin-panel-header">
              <span class="admin-panel-title">Status Operacional</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.75rem; font-weight: 600; margin-bottom: 4px; color: #475569;">Atualizar Status:</label>
                <select id="modalOrderStatusSelect" class="form-input" style="height: 33px; font-size: 0.8125rem; padding: 4px 8px;">
                  <option value="received" ${(order.status === 'received' || order.status_pedido === 'received') ? 'selected' : ''}>Recebido</option>
                  <option value="confirmed" ${(order.status === 'confirmed' || order.status_pedido === 'confirmed') ? 'selected' : ''}>Confirmado / Pago</option>
                  <option value="preparing" ${(order.status === 'preparing' || order.status_pedido === 'preparing') ? 'selected' : ''}>Em Separação</option>
                  <option value="shipped" ${(order.status === 'shipped' || order.status_pedido === 'shipped') ? 'selected' : ''}>Enviado</option>
                  <option value="delivered" ${(order.status === 'delivered' || order.status_pedido === 'delivered') ? 'selected' : ''}>Entregue</option>
                  <option value="cancelled" ${(order.status === 'cancelled' || order.status_pedido === 'cancelled') ? 'selected' : ''}>Cancelado</option>
                </select>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.75rem; font-weight: 600; margin-bottom: 4px; color: #475569;">Notas Internas / Rastreio:</label>
                <input type="text" id="modalOrderNotesInput" class="form-input" style="height: 33px; font-size: 0.8125rem; padding: 4px 8px;" placeholder="Ex: Código de rastreio, notas..." value="${order.admin_notes || order.notas_admin || ''}" />
              </div>
            </div>

            ${history.length > 0 ? `
              <div style="margin-top: 8px; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
                <span style="font-size: 0.6875rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Histórico:</span>
                <div style="display: flex; flex-direction: column; gap: 3px; margin-top: 3px; font-size: 0.75rem; color: #475569;">
                  ${history.map(h => `
                    <div>• <strong>${(h.status || '').toUpperCase()}</strong> em ${formatDate(h.timestamp)} ${h.notes ? `(${h.notes})` : ''}</div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Rodapé de Ações do Modal -->
          <div class="admin-modal-footer" style="padding: 10px 16px; background: #ffffff; border-top: 1px solid #e2e8f0; margin-top: 4px; border-radius: 8px; display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-sm close-modal-btn" style="height: 33px; padding: 0 16px; font-weight: 600;">Fechar</button>
            <button type="button" id="saveOrderStatusBtn" class="btn btn-primary btn-sm" style="height: 33px; padding: 0 18px; font-weight: 600;">
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#saveOrderStatusBtn').addEventListener('click', async () => {
      const saveBtn = modal.querySelector('#saveOrderStatusBtn');
      const newStatus = modal.querySelector('#modalOrderStatusSelect').value;
      const notes = modal.querySelector('#modalOrderNotesInput')?.value.trim() || '';

      saveBtn.disabled = true;
      saveBtn.innerHTML = 'Salvando...';

      try {
        await Api.orders.updateStatus(order.id, newStatus, notes);
        Toast.show('Status do pedido atualizado!', 'success');
        modal.remove();
        await loadAllData();
        render();
      } catch (err) {
        Toast.show(err.message || 'Erro ao atualizar pedido.', 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Salvar Alterações';
      }
    });
  }

  // Modal de Detalhes do Cliente
  function openCustomerDetailsModal(customer) {
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';

    const phone = customer.phone || customer.telefone || '';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('244') ? cleanPhone : '244' + cleanPhone}` : null;
    const isBlocked = customer.status === 'blocked';

    const cOrders = ordersList.filter(o =>
      (o.customer_email && o.customer_email.toLowerCase() === (customer.email || '').toLowerCase()) ||
      (phone && (o.customer_phone === phone || o.telefone_cliente === phone)) ||
      (o.user_id && String(o.user_id) === String(customer.id))
    );

    const totalSpent = cOrders.length > 0
      ? cOrders.reduce((sum, o) => sum + Number(o.total || 0), 0)
      : Number(customer.total_spent || 0);

    modal.innerHTML = `
      <div class="admin-modal-dialog admin-modal-product-dialog" style="max-width: 660px !important;">
        <div class="admin-modal-product-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <h3 class="admin-modal-title" style="margin: 0; font-size: 1.125rem; font-weight: 700; color: #0f172a;">
              ${customer.name}
            </h3>
            <span style="font-family: ui-monospace, monospace; font-size: 0.75rem; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 2px 7px; border-radius: 4px; border: 1px solid #e2e8f0;">
              ${customer.id}
            </span>
            ${!isBlocked ? `
              <span class="badge" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; font-size:0.75rem;">Ativo</span>
            ` : `
              <span class="badge" style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; font-size:0.75rem;">Bloqueado</span>
            `}
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${waLink ? `
              <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 5px; color: #15803d; border-color: #bbf7d0; background: #f0fdf4; font-size: 0.75rem; padding: 4px 10px; text-decoration: none;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <span>WhatsApp</span>
              </a>
            ` : ''}
            <button type="button" class="admin-modal-close-icon close-modal-btn" title="Fechar (Esc)">✕</button>
          </div>
        </div>

        <div class="admin-modal-product-body" style="padding: 14px 18px !important; background: #ffffff !important; display: flex; flex-direction: column; gap: 10px;">
          <!-- Grid 2 Colunas: Contato & Resumo -->
          <div class="admin-product-bottom-grid">
            <div class="admin-card-panel">
              <div class="admin-panel-header">
                <span class="admin-panel-title">Contato & Endereço</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.8125rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">E-mail:</span>
                  <strong style="color: #0f172a;">${customer.email}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">Telefone:</span>
                  <span style="color: #0f172a;">${phone || 'Não informado'}</span>
                </div>
                <div style="border-top: 1px dashed #e2e8f0; padding-top: 6px; margin-top: 2px;">
                  <div style="color: #64748b; font-size: 0.75rem;">Endereço de Entrega:</div>
                  <div style="color: #0f172a; font-weight: 500; margin-top: 2px;">${customer.endereco || 'Não informado'}</div>
                </div>
              </div>
            </div>

            <div class="admin-card-panel">
              <div class="admin-panel-header">
                <span class="admin-panel-title">Histórico de Compras</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.8125rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">Total de Pedidos:</span>
                  <strong style="color: #0f172a;">${cOrders.length} pedido${cOrders.length !== 1 ? 's' : ''}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: baseline; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 4px;">
                  <span style="font-weight: 700; color: #0f172a;">Volume Total:</span>
                  <strong style="font-size: 1.05rem; color: #0f172a;">${formatPrice(totalSpent)}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- Pedidos Recentes do Cliente -->
          <div class="admin-card-panel">
            <div class="admin-panel-header">
              <span class="admin-panel-title">Pedidos do Cliente (${cOrders.length})</span>
            </div>
            ${cOrders.length === 0 ? `
              <div style="font-size: 0.8125rem; color: #94a3b8; text-align: center; padding: 12px 0;">
                Nenhum pedido registrado para este cliente até o momento.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto;">
                ${cOrders.map(o => {
      const cleanCode = String(o.order_code || o.codigo_pedido || o.id).replace(/^#/, '');
      return `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 10px; border-radius: 6px; background: #f8fafc; border: 1px solid #f1f5f9; font-size: 0.8125rem;">
                      <div>
                        <strong style="font-family: ui-monospace, monospace; color: #0f172a;">${cleanCode}</strong>
                        <span style="font-size: 0.75rem; color: #64748b; margin-left: 6px;">${formatDate(o.created_at)}</span>
                      </div>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <strong style="color: #0f172a;">${formatPrice(o.total)}</strong>
                        ${renderStatusBadge(o.status)}
                      </div>
                    </div>
                  `;
    }).join('')}
              </div>
            `}
          </div>

          <div class="admin-modal-footer" style="padding: 10px 16px; background: #ffffff; border-top: 1px solid #e2e8f0; margin-top: 4px; border-radius: 8px; display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-sm close-modal-btn" style="height: 33px; padding: 0 16px; font-weight: 600;">Fechar</button>
            <button type="button" class="btn btn-sm toggle-block-customer-btn ${!isBlocked ? 'danger' : 'btn-primary'}" data-id="${customer.id}" data-blocked="${isBlocked}" style="height: 33px; padding: 0 16px; font-weight: 600;">
              ${!isBlocked ? 'Bloquear Cliente' : 'Desbloquear Conta'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector('.toggle-block-customer-btn')?.addEventListener('click', () => modal.remove());
  }

  // Função geradora de SKU padronizado e único para o cadastro de produtos
  function generateProductSku(brand = '', name = '') {
    const brandClean = (brand || '').trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
    const brandCode = brandClean.length >= 2 ? brandClean : 'NV';
    const nameClean = (name || '').trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const timeCode = Date.now().toString(36).slice(-3).toUpperCase();
    return nameClean ? `NV-${brandCode}-${nameClean}-${rand}` : `NV-${brandCode}-${timeCode}${rand}`;
  }

  // 2. Modal de Produto
  function openProductModal(prod = null) {
    const isEdit = Boolean(prod);
    const initialSku = (prod?.sku || '').trim() || generateProductSku(prod?.brand, prod?.name);
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog admin-modal-product-dialog">
        <!-- Header Minimalista -->
        <div class="admin-modal-product-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <h3 class="admin-modal-title" style="margin: 0; font-size: 1.125rem; font-weight: 700; color: #0f172a;">
              ${isEdit ? 'Editar Produto' : 'Novo Produto'}
            </h3>
            ${isEdit ? `
              <span style="font-family: ui-monospace, monospace; font-size: 0.75rem; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 2px 7px; border-radius: 4px; border: 1px solid #e2e8f0;">
                ID ${prod.id}
              </span>
            ` : ''}
          </div>
          <button type="button" class="admin-modal-close-icon close-modal-btn" title="Fechar (Esc)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form id="productForm" class="admin-modal-product-body">
          <!-- CARD SUPERIOR: IDENTIFICAÇÃO & DADOS COMERCIAIS -->
          <div class="admin-card-panel" style="margin-bottom: 10px;">
            <div class="admin-panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h4 class="admin-panel-title">Geral & Comercial</h4>
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="hidden" id="pStatus" value="${prod?.is_active !== false ? 'true' : 'false'}" />
                <div class="admin-status-segmented-control">
                  <button type="button" class="admin-status-segmented-btn ${prod?.is_active !== false ? 'active status-active' : ''}" data-status="true">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #16a34a;"></span>
                    <span>Ativo</span>
                  </button>
                  <button type="button" class="admin-status-segmented-btn ${prod?.is_active === false ? 'active status-blocked' : ''}" data-status="false">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #94a3b8;"></span>
                    <span>Pausado</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Linha 1: Nome (2fr), Marca (1fr), SKU Automático (1.2fr) -->
            <div style="display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.2fr); gap: 8px; margin-bottom: 8px;">
              <div class="form-group">
                <label class="admin-form-label" for="pName">Nome do Produto *</label>
                <input type="text" id="pName" class="form-input" value="${prod?.name || ''}" placeholder="Ex: iPhone 16 Pro Max 256GB" required style="font-weight: 600;" />
              </div>

              <div class="form-group">
                <label class="admin-form-label" for="pBrand">Marca *</label>
                <input type="text" id="pBrand" class="form-input" list="mobileBrandSuggestions" value="${prod?.brand || ''}" placeholder="Ex: Apple" required style="font-weight: 600;" />
                <datalist id="mobileBrandSuggestions">
                  <option value="Apple">
                  <option value="Samsung">
                  <option value="Xiaomi">
                  <option value="Motorola">
                  <option value="Huawei">
                  <option value="Google Pixel">
                  <option value="Realme">
                  <option value="Infinix">
                  <option value="Tecno">
                  <option value="OnePlus">
                  <option value="Honor">
                  <option value="Oppo">
                  <option value="Vivo">
                  <option value="Sony">
                  <option value="Nokia">
                  <option value="NovaTech">
                </datalist>
              </div>

              <div class="form-group">
                <label class="admin-form-label" for="pSku" style="display: flex; justify-content: space-between; align-items: center;">
                  <span>Código SKU *</span>
                  <button type="button" id="btnRegenerateSku" title="Gerar novo SKU automático" style="background: none; border: none; color: #2563eb; font-weight: 700; font-size: 0.7rem; cursor: pointer; padding: 0; display: inline-flex; align-items: center; gap: 3px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
                    Regerar
                  </button>
                </label>
                <input type="text" id="pSku" class="form-input" value="${initialSku}" placeholder="Ex: NV-APP-8921" required style="font-family: ui-monospace, monospace; font-weight: 700; letter-spacing: 0.02em; color: #1e293b; background: #f8fafc;" />
              </div>
            </div>

            <!-- Linha 2: Categoria (1fr), Subcategoria (1fr), Preço Venda (1fr), Preço Original (1fr) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px;">
              <div class="form-group">
                <label class="admin-form-label" for="pCategory">Categoria *</label>
                <select id="pCategory" class="form-input" style="font-weight: 600;" required>
                  <option value="">Selecione...</option>
                  ${categoriesList.map(c => `
                    <option value="${c.id}" ${String(prod?.category_id) === String(c.id) ? 'selected' : ''}>${c.name}</option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group" id="pSubcategoryWrapper">
                <label id="pSubcategoryLabel" class="admin-form-label" for="pSubcategory">Subcategoria *</label>
                <select id="pSubcategory" class="form-input" style="font-weight: 600;" required>
                  <option value="">Selecione...</option>
                </select>
                <div id="pSubcategoryNotice" style="margin-top: 2px; font-size: 0.7rem;"></div>
              </div>

              <div class="form-group">
                <label class="admin-form-label" for="pPrice">Preço de Venda *</label>
                <div class="admin-input-affix-group">
                  <span class="admin-input-prefix">Kz</span>
                  <input type="number" id="pPrice" class="form-input has-prefix" value="${prod?.price || ''}" placeholder="0" required style="font-weight: 700;" />
                </div>
              </div>

              <div class="form-group">
                <label class="admin-form-label" for="pOldPrice" style="display: flex; justify-content: space-between;">
                  <span>Preço Original</span>
                  <span id="priceDiscountBadge" style="display: none; font-size: 0.6875rem; font-weight: 700; color: #16a34a;"></span>
                </label>
                <div class="admin-input-affix-group">
                  <span class="admin-input-prefix">Kz</span>
                  <input type="number" id="pOldPrice" class="form-input has-prefix" value="${prod?.old_price || prod?.oldPrice || ''}" placeholder="0" style="color: #64748b;" />
                </div>
              </div>
            </div>

            <!-- Linha 3: Estoque Atual (1fr), Estoque Mínimo (1fr), Descrição (2fr) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 8px; margin-bottom: 8px;">
              <div class="form-group">
                <label class="admin-form-label" for="pStock">Estoque Atual *</label>
                <div class="admin-input-affix-group">
                  <input type="number" id="pStock" class="form-input has-suffix" value="${prod?.stock !== undefined ? prod.stock : 10}" required style="font-weight: 700;" />
                  <span class="admin-input-suffix">un</span>
                </div>
              </div>

              <div class="form-group">
                <label class="admin-form-label" for="pStockMin">Estoque Mínimo *</label>
                <div class="admin-input-affix-group">
                  <input type="number" id="pStockMin" class="form-input has-suffix" value="${prod?.stock_min || 2}" required style="font-weight: 700;" />
                  <span class="admin-input-suffix">un</span>
                </div>
              </div>

              <div class="form-group">
                <label class="admin-form-label" for="pDesc">Descrição do Produto (Texto Real)</label>
                <textarea id="pDesc" class="form-input" rows="3" placeholder="Insira a descrição detalhada e real do produto..." style="font-size: 0.8125rem; resize: vertical; line-height: 1.5;">${prod?.description || prod?.descricao || ''}</textarea>
              </div>
            </div>
          </div>

          <!-- CARD DE CORES DO PRODUTO -->
          <div class="admin-card-panel" style="margin-bottom: 10px;">
            <div class="admin-panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div>
                <h4 class="admin-panel-title" style="margin: 0;">
                  Cores do Produto
                </h4>
              </div>
              <button type="button" id="btnAddColorVariant" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; font-weight: 700; padding: 3px 10px; display: inline-flex; align-items: center; gap: 4px;">
                + Adicionar Cor
              </button>
            </div>

            <!-- Sugestões Rápidas de Cores -->
            <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-size: 0.6875rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Sugestões:</span>
              <button type="button" class="admin-quick-color-btn" data-color-name="Branco" data-color-hex="#ffffff" style="font-size: 0.6875rem; padding: 2px 7px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; cursor: pointer;">⚪ Branco</button>
              <button type="button" class="admin-quick-color-btn" data-color-name="Preto" data-color-hex="#000000" style="font-size: 0.6875rem; padding: 2px 7px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; cursor: pointer;">⚫ Preto</button>
              <button type="button" class="admin-quick-color-btn" data-color-name="Azul" data-color-hex="#2563eb" style="font-size: 0.6875rem; padding: 2px 7px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; cursor: pointer;">🔵 Azul</button>
              <button type="button" class="admin-quick-color-btn" data-color-name="Cinza / Titânio" data-color-hex="#64748b" style="font-size: 0.6875rem; padding: 2px 7px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; cursor: pointer;">🔘 Cinza</button>
              <button type="button" class="admin-quick-color-btn" data-color-name="Dourado" data-color-hex="#d97706" style="font-size: 0.6875rem; padding: 2px 7px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; cursor: pointer;">🟡 Dourado</button>
              <button type="button" class="admin-quick-color-btn" data-color-name="Verde" data-color-hex="#16a34a" style="font-size: 0.6875rem; padding: 2px 7px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; cursor: pointer;">🟢 Verde</button>
              <button type="button" class="admin-quick-color-btn" data-color-name="Vermelho" data-color-hex="#dc2626" style="font-size: 0.6875rem; padding: 2px 7px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; cursor: pointer;">🔴 Vermelho</button>
            </div>

            <!-- Lista de Cores com Foto -->
            <div id="adminColorsList" style="display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto;"></div>
          </div>

          <!-- SEÇÃO INFERIOR: 2 COLUNAS EQUILIBRADAS (FOTOS + DESTAQUES vs FICHA TÉCNICA) -->
          <div class="admin-product-bottom-grid">
            <!-- COLUNA ESQUERDA: FOTOS & DESTAQUES -->
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <!-- Card: Fotos -->
              <div class="admin-card-panel" style="flex: 1; margin-bottom: 0;">
                <div class="admin-panel-header">
                  <h4 class="admin-panel-title">Fotos Gerais do Produto</h4>
                </div>
                <div id="productGalleryUploaderMount"></div>
              </div>

              <!-- Card: Destaques -->
              <div class="admin-card-panel" style="margin-bottom: 0;">
                <div class="admin-panel-header">
                  <h4 class="admin-panel-title">Destaques na Vitrine</h4>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
                  <div class="admin-toggle-switch-card ${prod?.is_featured ? 'checked' : ''}" style="margin-bottom: 0;">
                    <span style="font-size: 0.75rem; font-weight: 600; color: #1e293b;">Vitrine</span>
                    <input type="checkbox" id="pIsFeatured" ${prod?.is_featured ? 'checked' : ''} style="display:none;" />
                    <div class="admin-switch-slider"></div>
                  </div>

                  <div class="admin-toggle-switch-card ${prod?.is_deal ? 'checked' : ''}" style="margin-bottom: 0;">
                    <span style="font-size: 0.75rem; font-weight: 600; color: #1e293b;">Oferta</span>
                    <input type="checkbox" id="pIsDeal" ${prod?.is_deal ? 'checked' : ''} style="display:none;" />
                    <div class="admin-switch-slider"></div>
                  </div>

                  <div class="admin-toggle-switch-card ${prod?.is_new ? 'checked' : ''}" style="margin-bottom: 0;">
                    <span style="font-size: 0.75rem; font-weight: 600; color: #1e293b;">Novo</span>
                    <input type="checkbox" id="pIsNew" ${prod?.is_new ? 'checked' : ''} style="display:none;" />
                    <div class="admin-switch-slider"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- COLUNA DIREITA: FICHA TÉCNICA -->
            <div class="admin-card-panel" style="display: flex; flex-direction: column; margin-bottom: 0;">
              <div class="admin-panel-header">
                <h4 class="admin-panel-title">Ficha Técnica</h4>
                <button type="button" id="btnAddCustomSpec" class="btn btn-secondary btn-sm" style="font-size: 0.6875rem; font-weight: 600; padding: 2px 8px;">
                  + Linha
                </button>
              </div>

              <!-- Tags Rápidas -->
              <div style="margin-bottom: 8px;">
                <div class="admin-quick-spec-wrap">
                  <button type="button" class="admin-quick-spec-btn" data-spec="Processador" data-val-hint="Ex: A18 Pro">Processador</button>
                  <button type="button" class="admin-quick-spec-btn" data-spec="Memória RAM" data-val-hint="Ex: 8 GB">RAM</button>
                  <button type="button" class="admin-quick-spec-btn" data-spec="Armazenamento" data-val-hint="Ex: 256 GB">Armazenamento</button>
                  <button type="button" class="admin-quick-spec-btn" data-spec="Tela" data-val-hint="Ex: 6.7 OLED">Tela</button>
                  <button type="button" class="admin-quick-spec-btn" data-spec="Câmera" data-val-hint="Ex: 48 MP">Câmera</button>
                  <button type="button" class="admin-quick-spec-btn" data-spec="Bateria" data-val-hint="Ex: 4.500 mAh">Bateria</button>
                  <button type="button" class="admin-quick-spec-btn" data-spec="Cor" data-val-hint="Ex: Titânio Natural">Cor</button>
                  <button type="button" class="admin-quick-spec-btn" data-spec="Garantia" data-val-hint="Ex: 12 Meses">Garantia</button>
                </div>
              </div>

              <!-- Lista Chave / Valor -->
              <div id="adminSpecsList" style="display: flex; flex-direction: column; max-height: 220px; overflow-y: auto; flex: 1;"></div>
            </div>
          </div>

          <!-- Rodapé de Ações -->
          <div class="admin-modal-footer" style="padding: 10px 16px; background: #ffffff; border-top: 1px solid #e2e8f0; margin-top: 10px; border-radius: 8px; display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
            <button type="button" class="btn btn-secondary close-modal-btn" style="padding: 6px 14px; font-weight: 600; font-size: 0.8125rem;">
              Cancelar
            </button>
            <button type="submit" id="saveProductBtn" class="btn btn-primary" style="padding: 6px 18px; font-weight: 600; font-size: 0.8125rem;">
              ${isEdit ? 'Salvar Alterações' : 'Salvar Produto'}
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Controle Segmented do Status Ativo / Bloqueado
    const statusValInput = modal.querySelector('#pStatus');
    const statusBtns = modal.querySelectorAll('.admin-status-segmented-btn');
    statusBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        statusBtns.forEach(b => {
          b.classList.remove('active', 'status-active', 'status-blocked');
        });
        const isAct = btn.dataset.status === 'true';
        btn.classList.add('active', isAct ? 'status-active' : 'status-blocked');
        statusValInput.value = btn.dataset.status;
      });
    });

    // Switches Interativos para os Selos Promocionais
    modal.querySelectorAll('.admin-toggle-switch-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        card.classList.toggle('checked', checkbox.checked);
      });
    });

    // Interatividade Dinâmica do SKU (Geração, Re-geração e Edição)
    const skuInput = modal.querySelector('#pSku');
    const brandInput = modal.querySelector('#pBrand');
    const nameInput = modal.querySelector('#pName');
    const btnRegenerateSku = modal.querySelector('#btnRegenerateSku');

    let skuManuallyEdited = isEdit;

    skuInput?.addEventListener('input', () => {
      skuManuallyEdited = true;
    });

    btnRegenerateSku?.addEventListener('click', () => {
      const freshSku = generateProductSku(brandInput?.value, nameInput?.value);
      if (skuInput) {
        skuInput.value = freshSku;
        skuManuallyEdited = false;
        Toast.show(`Novo SKU gerado: ${freshSku}`, 'info');
      }
    });

    if (!isEdit) {
      brandInput?.addEventListener('change', () => {
        if (!skuManuallyEdited && skuInput) {
          skuInput.value = generateProductSku(brandInput.value, nameInput?.value);
        }
      });
    }

    // Calculadora automática de economia / desconto em tempo real
    const priceInput = modal.querySelector('#pPrice');
    const oldPriceInput = modal.querySelector('#pOldPrice');
    const discountBadge = modal.querySelector('#priceDiscountBadge');

    function updateDiscountCalculation() {
      const p = Number(priceInput.value) || 0;
      const old = Number(oldPriceInput.value) || 0;
      if (old > p && p > 0) {
        const diff = old - p;
        const pct = Math.round((diff / old) * 100);
        discountBadge.style.display = 'inline-block';
        discountBadge.textContent = `-${pct}% (${formatPrice(diff)} economia)`;
      } else {
        discountBadge.style.display = 'none';
      }
    }

    priceInput?.addEventListener('input', updateDiscountCalculation);
    oldPriceInput?.addEventListener('input', updateDiscountCalculation);
    updateDiscountCalculation();

    const catSelect = modal.querySelector('#pCategory');
    const subSelect = modal.querySelector('#pSubcategory');
    const subNotice = modal.querySelector('#pSubcategoryNotice');

    function populateSubcategories(catId, preselectedSubId = null, preselectedSubName = null) {
      if (!catId) {
        subSelect.innerHTML = '<option value="">Selecione primeiro a categoria...</option>';
        subSelect.disabled = true;
        subSelect.value = '';
        subNotice.innerHTML = '';
        return;
      }

      const category = categoriesList.find(c => String(c.id) === String(catId));
      if (!category) {
        subSelect.innerHTML = '<option value="">Categoria não encontrada</option>';
        subSelect.disabled = true;
        return;
      }

      const subs = Array.isArray(category?.subcategories) ? category.subcategories : [];

      if (subs.length === 0) {
        subSelect.disabled = false;
        subSelect.innerHTML = '<option value="">Sem subcategorias nesta categoria</option>';
        subNotice.innerHTML = `
          <span style="color:#b45309; font-size:0.75rem;">
            Esta categoria ainda não tem subcategorias cadastradas.
            <button type="button" id="btnQuickAddSub" style="background:none; border:none; color:#2563eb; font-weight:700; cursor:pointer; text-decoration:underline; padding:0; margin-left:4px;">+ Criar subcategoria</button>
          </span>
        `;
        const quickBtn = subNotice.querySelector('#btnQuickAddSub');
        if (quickBtn) {
          quickBtn.addEventListener('click', () => {
            openSubcategoryModal({ parent_id: category.id });
          });
        }
        return;
      }

      subSelect.disabled = false;
      subSelect.innerHTML = `<option value="">Selecione a subcategoria...</option>` +
        subs.map(s => {
          const isSelected = (preselectedSubId && String(s.id) === String(preselectedSubId)) ||
            (preselectedSubName && s.name.toLowerCase() === preselectedSubName.toLowerCase());
          return `<option value="${s.id}" data-name="${s.name}" ${isSelected ? 'selected' : ''}>${s.name}</option>`;
        }).join('');

      subNotice.innerHTML = '';
    }

    catSelect.addEventListener('change', () => {
      populateSubcategories(catSelect.value);
    });

    if (prod?.category_id) {
      populateSubcategories(prod.category_id, prod.subcategory_id, prod.subcategory_name || prod.subcategory);
    } else {
      populateSubcategories('');
    }

    const onCategoriesUpdated = () => {
      const currentCatVal = catSelect.value;
      const currentSubVal = subSelect.value;
      catSelect.innerHTML = '<option value="">Selecione a categoria...</option>' +
        categoriesList.map(c => `
          <option value="${c.id}" ${String(currentCatVal) === String(c.id) ? 'selected' : ''}>${c.name}</option>
        `).join('');
      if (currentCatVal) {
        populateSubcategories(currentCatVal, currentSubVal);
      }
    };
    window.addEventListener('categories-updated', onCategoriesUpdated);

    const closeModal = () => {
      window.removeEventListener('categories-updated', onCategoriesUpdated);
      modal.remove();
    };

    // Galeria Multi-Imagens Minimalista
    const initialGallery = (Array.isArray(prod?.gallery) && prod.gallery.length > 0)
      ? prod.gallery
      : (prod?.image ? [prod.image] : []);

    const multiUploader = createMultiImageUploader({
      id: 'prodGalleryUpload',
      minimal: true,
      initialImages: initialGallery,
      maxDimension: 1200
    });
    modal.querySelector('#productGalleryUploaderMount').appendChild(multiUploader.element);

    // Gerenciador de Cores e Variações com Foto (Padrão Mercado Livre)
    const colorsList = modal.querySelector('#adminColorsList');
    const btnAddColorVariant = modal.querySelector('#btnAddColorVariant');

    function createColorRow(col = { name: '', hex: '#2563eb', image: '' }) {
      const row = document.createElement('div');
      row.className = 'admin-color-row';
      row.style.cssText = 'display: grid; grid-template-columns: 38px minmax(110px, 1.2fr) minmax(170px, 2fr) 34px; gap: 8px; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 10px;';
      
      const currentImg = col.image || '';
      
      const defaultEmptyIcon = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

      row.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center;" title="Seletor de cor">
          <input type="color" class="color-hex" value="${col.hex || '#2563eb'}" style="width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer; padding: 0; background: transparent;" />
        </div>
        <div>
          <input type="text" class="form-input color-name" placeholder="Ex: Branco" value="${(col.name || '').replace(/"/g, '&quot;')}" style="font-size: 0.8125rem; padding: 6px 9px; font-weight: 700; background: #ffffff;" />
        </div>
        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
          <div class="color-img-preview-box" style="width: 34px; height: 34px; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
            ${currentImg ? `<img src="${currentImg}" style="width: 100%; height: 100%; object-fit: cover;" />` : defaultEmptyIcon}
          </div>
          <input type="hidden" class="color-img-val" value="${currentImg.replace(/"/g, '&quot;')}" />
          <input type="file" class="color-file-input" accept="image/*" style="display: none;" />
          <button type="button" class="btn btn-secondary btn-sm btn-upload-color-img" style="font-size: 0.6875rem; font-weight: 600; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
            ${currentImg ? 'Trocar Foto' : 'Carregar Foto'}
          </button>
          ${currentImg ? `
            <button type="button" class="btn-clear-color-img" title="Remover foto" style="background: none; border: none; color: #ef4444; font-size: 13px; font-weight: 700; cursor: pointer; padding: 0 4px;">✕</button>
          ` : ''}
        </div>
        <button type="button" class="admin-spec-del-btn btn-remove-color" title="Remover cor">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;

      const fileInput = row.querySelector('.color-file-input');
      const uploadBtn = row.querySelector('.btn-upload-color-img');
      const previewBox = row.querySelector('.color-img-preview-box');
      const imgValInput = row.querySelector('.color-img-val');
      const removeBtn = row.querySelector('.btn-remove-color');

      uploadBtn?.addEventListener('click', () => fileInput?.click());

      fileInput?.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (file) {
          uploadBtn.disabled = true;
          uploadBtn.textContent = 'Otimizando...';
          try {
            const compressed = await compressImageFile(file, { maxWidth: 1200, quality: 0.85 });
            imgValInput.value = compressed.dataUrl;
            previewBox.innerHTML = `<img src="${compressed.dataUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`;
            uploadBtn.textContent = 'Trocar Foto';
            
            if (!row.querySelector('.btn-clear-color-img')) {
              const clearBtnNew = document.createElement('button');
              clearBtnNew.type = 'button';
              clearBtnNew.className = 'btn-clear-color-img';
              clearBtnNew.title = 'Remover foto';
              clearBtnNew.style.cssText = 'background: none; border: none; color: #ef4444; font-size: 13px; font-weight: 700; cursor: pointer; padding: 0 4px;';
              clearBtnNew.textContent = '✕';
              clearBtnNew.addEventListener('click', () => {
                imgValInput.value = '';
                previewBox.innerHTML = defaultEmptyIcon;
                uploadBtn.textContent = 'Carregar Foto';
                clearBtnNew.remove();
              });
              uploadBtn.after(clearBtnNew);
            }
            Toast.show('Foto da cor carregada com sucesso!', 'success');
          } catch (err) {
            Toast.show(err.message || 'Erro ao processar imagem.', 'error');
          } finally {
            uploadBtn.disabled = false;
          }
        }
      });

      const clearBtn = row.querySelector('.btn-clear-color-img');
      clearBtn?.addEventListener('click', () => {
        imgValInput.value = '';
        previewBox.innerHTML = defaultEmptyIcon;
        uploadBtn.textContent = 'Carregar Foto';
        clearBtn.remove();
      });

      removeBtn?.addEventListener('click', () => row.remove());

      return row;
    }

    if (btnAddColorVariant && colorsList) {
      btnAddColorVariant.addEventListener('click', () => {
        const row = createColorRow({ name: '', hex: '#2563eb', image: '' });
        colorsList.appendChild(row);
        const nameInput = row.querySelector('.color-name');
        if (nameInput) nameInput.focus();
      });
    }

    modal.querySelectorAll('.admin-quick-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.colorName;
        const hex = btn.dataset.colorHex;
        if (colorsList) {
          const row = createColorRow({ name, hex, image: '' });
          colorsList.appendChild(row);
          const nameInput = row.querySelector('.color-name');
          if (nameInput) nameInput.focus();
        }
      });
    });

    // Carregar cores existentes do produto
    const rawVariants = (typeof prod?.variants === 'object' && prod?.variants !== null) ? prod.variants :
      (typeof prod?.variacoes === 'object' && prod?.variacoes !== null ? (typeof prod.variacoes === 'string' ? JSON.parse(prod.variacoes) : prod.variacoes) : {});
    const existingColors = Array.isArray(rawVariants?.colors) ? rawVariants.colors : [];

    if (existingColors.length > 0 && colorsList) {
      existingColors.forEach(c => {
        colorsList.appendChild(createColorRow(c));
      });
    }

    // Gerenciador Dinâmico de Especificações Minimalista
    const specsList = modal.querySelector('#adminSpecsList');
    const btnAddCustomSpec = modal.querySelector('#btnAddCustomSpec');

    function createSpecRow(key = '', val = '', placeholderHint = '') {
      const row = document.createElement('div');
      row.className = 'admin-spec-row-corporate admin-spec-row';
      row.innerHTML = `
        <input type="text" class="form-input spec-key" placeholder="Item (ex: RAM)" value="${key.replace(/"/g, '&quot;')}" style="font-size:0.8125rem; padding:6px 9px; background:#fff; font-weight:600;" />
        <input type="text" class="form-input spec-value" placeholder="${placeholderHint || 'Valor'}" value="${val.replace(/"/g, '&quot;')}" style="font-size:0.8125rem; padding:6px 9px; background:#fff;" />
        <button type="button" class="admin-spec-del-btn btn-remove-spec" title="Remover">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
      row.querySelector('.btn-remove-spec').addEventListener('click', () => row.remove());
      return row;
    }

    if (btnAddCustomSpec && specsList) {
      btnAddCustomSpec.addEventListener('click', () => {
        const row = createSpecRow('', '', 'Valor');
        specsList.appendChild(row);
        const kInput = row.querySelector('.spec-key');
        if (kInput) kInput.focus();
      });
    }

    modal.querySelectorAll('.admin-quick-spec-btn').forEach(chip => {
      chip.addEventListener('click', () => {
        const specName = chip.dataset.spec;
        const hint = chip.dataset.valHint || '';
        if (specsList) {
          const row = createSpecRow(specName, '', hint);
          specsList.appendChild(row);
          const vInput = row.querySelector('.spec-value');
          if (vInput) vInput.focus();
        }
      });
    });

    // Pré-carrega especificações existentes do produto
    const existingSpecs = (typeof prod?.specs === 'object' && prod?.specs !== null) ? prod.specs :
      (typeof prod?.especificacoes === 'object' && prod?.especificacoes !== null ? prod.especificacoes : {});

    let countLoaded = 0;
    if (existingSpecs && typeof existingSpecs === 'object' && specsList) {
      Object.entries(existingSpecs).forEach(([k, v]) => {
        const lower = k.toLowerCase().trim();
        if (!['subcategoria_id', 'subcategory_id', 'subcategoria_nome', 'subcategory_name', 'subcategoria', 'subcategory', 'category_id', 'id', '_descricao'].includes(lower)) {
          if (v !== undefined && v !== null && String(v).trim() !== '') {
            specsList.appendChild(createSpecRow(k, String(v)));
            countLoaded++;
          }
        }
      });
    }

    if (countLoaded === 0 && !isEdit && specsList) {
      specsList.appendChild(createSpecRow('Processador', '', 'Ex: A18 Pro'));
      specsList.appendChild(createSpecRow('Memória RAM', '', 'Ex: 8 GB'));
      specsList.appendChild(createSpecRow('Armazenamento', '', 'Ex: 256 GB'));
    }

    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', closeModal));
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    modal.querySelector('#productForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = modal.querySelector('#saveProductBtn');

      const nameVal = modal.querySelector('#pName').value.trim();
      const catVal = catSelect.value;
      const subVal = subSelect.value;
      const isActiveVal = modal.querySelector('#pStatus').value === 'true';
      const skuVal = (modal.querySelector('#pSku')?.value || '').trim() || generateProductSku(modal.querySelector('#pBrand')?.value, nameVal);

      if (!nameVal) {
        Toast.show('O nome do produto é obrigatório.', 'warning');
        modal.querySelector('#pName').focus();
        return;
      }

      if (!catVal) {
        Toast.show('Selecione a Categoria do produto.', 'warning');
        catSelect.focus();
        return;
      }

      let subName = '';
      if (subSelect && subSelect.value && subSelect.style.display !== 'none') {
        const selectedSubOption = subSelect.options[subSelect.selectedIndex];
        subName = selectedSubOption?.dataset?.name || selectedSubOption?.text || '';
      }

      // Galeria e Capa
      const galleryImages = multiUploader.getImages();
      const coverImage = multiUploader.getCover() || null;

      // Coleta cores com fotos vinculadas (Padrão Mercado Livre)
      const colorsArray = [];
      modal.querySelectorAll('.admin-color-row').forEach(row => {
        const cName = row.querySelector('.color-name')?.value?.trim();
        const cHex = row.querySelector('.color-hex')?.value?.trim() || '#2563eb';
        const cImg = row.querySelector('.color-img-val')?.value?.trim() || '';
        if (cName) {
          colorsArray.push({
            name: cName,
            hex: cHex,
            image: cImg
          });
        }
      });

      const currentVariants = (typeof prod?.variants === 'object' && prod?.variants !== null) ? { ...prod.variants } : {};
      currentVariants.colors = colorsArray;

      // Coleta especificações dinâmicas
      const specsObj = {};
      modal.querySelectorAll('.admin-spec-row').forEach(row => {
        const k = row.querySelector('.spec-key')?.value?.trim();
        const v = row.querySelector('.spec-value')?.value?.trim();
        if (k && v) specsObj[k] = v;
      });

      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando produto no banco...';

      const payload = {
        name: nameVal,
        sku: skuVal,
        brand: modal.querySelector('#pBrand').value.trim() || 'NovaTech',
        price: Number(modal.querySelector('#pPrice').value),
        old_price: modal.querySelector('#pOldPrice').value ? Number(modal.querySelector('#pOldPrice').value) : null,
        category_id: Number(catVal),
        subcategory_id: subVal ? Number(subVal) : null,
        subcategory_name: subName,
        subcategory: subName,
        stock: Number(modal.querySelector('#pStock').value),
        stock_min: Number(modal.querySelector('#pStockMin').value),
        image: coverImage,
        gallery: galleryImages,
        variants: currentVariants,
        description: modal.querySelector('#pDesc').value.trim(),
        specs: specsObj,
        is_deal: modal.querySelector('#pIsDeal').checked,
        is_new: modal.querySelector('#pIsNew').checked,
        is_featured: modal.querySelector('#pIsFeatured').checked,
        is_active: isActiveVal
      };

      try {
        if (isEdit) {
          await Api.products.update(prod.id, payload);
          Toast.show('Produto atualizado com sucesso no banco de dados!', 'success');
        } else {
          await Api.products.create(payload);
          Toast.show('Produto cadastrado com sucesso no banco de dados!', 'success');
        }
        closeModal();
        await loadAllData();
        render();
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Salvar Alterações' : 'Cadastrar Produto';
        Toast.show(err.message || 'Erro ao salvar produto.', 'error');
      }
    });
  }

  // 3. Duplicar Produto Rápido (Preservando Subcategoria e Integridade - BUG-014)
  async function duplicateProduct(prod) {
    try {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const payload = {
        name: `${prod.name} (Cópia)`,
        sku: `${prod.sku || 'NV'}-CPY-${rand}`,
        slug: prod.slug ? `${prod.slug}-copia-${rand}` : undefined,
        brand: prod.brand || 'NovaTech',
        price: Number(prod.price || 0),
        old_price: prod.old_price || prod.oldPrice ? Number(prod.old_price || prod.oldPrice) : null,
        category_id: prod.category_id ? Number(prod.category_id) : null,
        subcategory_id: prod.subcategory_id || prod.subcategoria_id || null,
        subcategory_name: prod.subcategory_name || prod.subcategory || null,
        subcategory: prod.subcategory || prod.subcategory_name || null,
        stock: prod.stock !== undefined ? Number(prod.stock) : 10,
        stock_min: prod.stock_min !== undefined ? Number(prod.stock_min) : 2,
        image: prod.image || null,
        gallery: Array.isArray(prod.gallery) ? prod.gallery : (prod.image ? [prod.image] : []),
        specs: (typeof prod.specs === 'object' && prod.specs !== null) ? prod.specs : {},
        description: prod.description || '',
        is_deal: Boolean(prod.is_deal),
        is_new: Boolean(prod.is_new),
        is_featured: Boolean(prod.is_featured),
        is_active: true
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
      <div class="admin-modal-dialog" style="max-width:480px; width:100%;">
        <div class="admin-modal-header">
          <h3 class="admin-modal-title" style="margin:0; font-size:1.125rem; font-weight:700; color:#0f172a;">${isEdit ? 'Editar Categoria' : 'Nova Categoria'}</h3>
          <button type="button" class="admin-modal-close-icon close-modal-btn" aria-label="Fechar" title="Fechar (Esc)">✕</button>
        </div>

        <form id="categoryForm" class="admin-modal-body" style="padding:16px 20px; display:flex; flex-direction:column; gap:14px; background:#ffffff;">
          <div class="form-group">
            <label class="form-label" style="font-weight:600; font-size:0.8125rem; color:#334155; margin-bottom:6px; display:block;">Nome da Categoria *</label>
            <input type="text" id="catName" class="form-input" value="${cat?.name || ''}" placeholder="Ex: Smartphones, Computadores, Acessórios..." required style="padding:9px 12px; font-size:0.875rem;" />
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight:600; font-size:0.8125rem; color:#334155; margin-bottom:6px; display:block;">Descrição (Opcional)</label>
            <textarea id="catDesc" class="form-input" rows="2" placeholder="Breve descrição dos produtos desta categoria..." style="padding:9px 12px; font-size:0.875rem;">${cat?.description || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight:600; font-size:0.8125rem; color:#334155; margin-bottom:6px; display:block;">Status *</label>
            <select id="catStatus" class="admin-filter-select" style="width:100%; padding:9px 12px; font-size:0.875rem;">
              <option value="true" ${cat?.is_active !== false ? 'selected' : ''}>Ativa (Visível na loja)</option>
              <option value="false" ${cat?.is_active === false ? 'selected' : ''}>Inativa (Oculta da loja)</option>
            </select>
          </div>
          <input type="hidden" id="catOrder" value="${cat?.display_order !== undefined ? cat.display_order : (categoriesList.length + 1)}" />

          <div class="admin-modal-footer" style="padding:12px 0 0 0; margin-top:6px; border-top:1px solid #f1f5f9; display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" class="btn btn-secondary close-modal-btn" style="padding:9px 18px; font-weight:600; font-size:0.875rem; flex:1; justify-content:center;">Cancelar</button>
            <button type="submit" id="saveCategoryBtn" class="btn btn-primary" style="padding:9px 22px; font-weight:700; font-size:0.875rem; flex:1; justify-content:center;">
              ${isEdit ? 'Salvar Alterações' : 'Salvar Categoria'}
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#categoryForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = modal.querySelector('#saveCategoryBtn');
      const name = modal.querySelector('#catName').value.trim();

      if (!name) {
        Toast.show('O nome da categoria é obrigatório.', 'warning');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Gravando no banco...';

      const payload = {
        name,
        description: modal.querySelector('#catDesc').value.trim(),
        display_order: Number(modal.querySelector('#catOrder').value || 1),
        is_active: modal.querySelector('#catStatus').value === 'true'
      };

      try {
        if (isEdit) {
          await Api.categories.update(cat.id, payload);
          expandedCategoryIds.add(Number(cat.id));
          Toast.show('Categoria atualizada com sucesso no banco de dados!', 'success');
        } else {
          const res = await Api.categories.create(payload);
          if (res && res.id) expandedCategoryIds.add(Number(res.id));
          Toast.show('Categoria criada com sucesso no banco de dados!', 'success');
        }
        modal.remove();
        await loadAllData();
        render();
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Salvar Alterações' : 'Salvar Categoria';
        Toast.show(err.message || 'Erro ao gravar categoria.', 'error');
      }
    });
  }

  // 4.1. Modal de Subcategoria
  function openSubcategoryModal({ parent_id = null, sub = null } = {}) {
    const isEdit = Boolean(sub);
    const selectedParentId = parent_id || (sub ? categoriesList.find(c => (c.subcategories || []).some(s => String(s.id) === String(sub.id)))?.id : '');
    const parentCat = categoriesList.find(c => String(c.id) === String(selectedParentId));

    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog" style="max-width:480px; width:100%;">
        <div class="admin-modal-header">
          <h3 class="admin-modal-title" style="margin:0; font-size:1.125rem; font-weight:700; color:#0f172a;">${isEdit ? 'Editar Subcategoria' : 'Nova Subcategoria'}</h3>
          <button type="button" class="admin-modal-close-icon close-modal-btn" aria-label="Fechar" title="Fechar (Esc)">✕</button>
        </div>

        <form id="subcategoryForm" class="admin-modal-body" style="padding:16px 20px; display:flex; flex-direction:column; gap:14px; background:#ffffff;">
          <div class="form-group">
            <label class="form-label" style="font-weight:600; font-size:0.8125rem; color:#334155; margin-bottom:6px; display:block;">Categoria Pai *</label>
            <select id="subParentSelect" class="admin-filter-select" style="width:100%; font-weight:600; padding:9px 12px; font-size:0.875rem;" required ${isEdit ? 'disabled' : ''}>
              <option value="">Selecione a categoria pai...</option>
              ${categoriesList.map(c => `
                <option value="${c.id}" ${String(c.id) === String(selectedParentId) ? 'selected' : ''}>${c.name}</option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight:600; font-size:0.8125rem; color:#334155; margin-bottom:6px; display:block;">Nome da Subcategoria *</label>
            <input type="text" id="subName" class="form-input" value="${sub?.name || ''}" placeholder="Ex: iPhones, Monitores, Carregadores..." required style="padding:9px 12px; font-size:0.875rem;" />
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight:600; font-size:0.8125rem; color:#334155; margin-bottom:6px; display:block;">Descrição (Opcional)</label>
            <textarea id="subDesc" class="form-input" rows="2" placeholder="Breve descrição da subcategoria..." style="padding:9px 12px; font-size:0.875rem;">${sub?.description || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight:600; font-size:0.8125rem; color:#334155; margin-bottom:6px; display:block;">Status *</label>
            <select id="subStatus" class="admin-filter-select" style="width:100%; padding:9px 12px; font-size:0.875rem;">
              <option value="true" ${sub?.is_active !== false ? 'selected' : ''}>Ativa (Visível na loja)</option>
              <option value="false" ${sub?.is_active === false ? 'selected' : ''}>Inativa (Oculta da loja)</option>
            </select>
          </div>
          <input type="hidden" id="subOrder" value="${sub?.display_order !== undefined ? sub.display_order : 1}" />

          <div class="admin-modal-footer" style="padding:12px 0 0 0; margin-top:6px; border-top:1px solid #f1f5f9; display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" class="btn btn-secondary close-modal-btn" style="padding:9px 18px; font-weight:600; font-size:0.875rem; flex:1; justify-content:center;">Cancelar</button>
            <button type="submit" id="saveSubcategoryBtn" class="btn btn-primary" style="padding:9px 22px; font-weight:700; font-size:0.875rem; flex:1; justify-content:center;">
              ${isEdit ? 'Salvar Alterações' : 'Salvar Subcategoria'}
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#subcategoryForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const parentId = modal.querySelector('#subParentSelect').value;
      const name = modal.querySelector('#subName').value.trim();
      const saveBtn = modal.querySelector('#saveSubcategoryBtn');

      if (!parentId) {
        Toast.show('Selecione uma categoria pai obrigatória.', 'warning');
        return;
      }
      if (!name) {
        Toast.show('O nome da subcategoria é obrigatório.', 'warning');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Gravando no banco...';

      const payload = {
        name,
        description: modal.querySelector('#subDesc').value.trim(),
        display_order: Number(modal.querySelector('#subOrder').value || 1),
        is_active: modal.querySelector('#subStatus').value === 'true'
      };

      try {
        if (isEdit) {
          await Api.categories.updateSubcategory({
            category_id: selectedParentId,
            subcategory_id: sub.id,
            ...payload
          });
          expandedCategoryIds.add(Number(selectedParentId));
          Toast.show('Subcategoria atualizada com sucesso no banco de dados!', 'success');
        } else {
          await Api.categories.createSubcategory({
            parent_id: parentId,
            ...payload
          });
          expandedCategoryIds.add(Number(parentId));
          Toast.show('Subcategoria vinculada com sucesso no banco de dados!', 'success');
        }
        modal.remove();
        await loadAllData();
        render();
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Salvar Alterações' : 'Salvar Subcategoria';
        Toast.show(err.message || 'Erro ao gravar subcategoria.', 'error');
      }
    });
  }

  // 5. Modal de Banner (Arte Gráfica Limpa & Minimalista)
  function openBannerModal(banner = null) {
    const isEdit = Boolean(banner);
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog admin-modal-product-dialog" style="max-width: 620px !important;">
        <!-- Header Minimalista -->
        <div class="admin-modal-product-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <h3 class="admin-modal-title" style="margin: 0; font-size: 1.125rem; font-weight: 700; color: #0f172a;">
              ${isEdit ? 'Editar Banner' : 'Novo Banner'}
            </h3>
            ${isEdit ? `
              <span style="font-family: ui-monospace, monospace; font-size: 0.75rem; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 2px 7px; border-radius: 4px; border: 1px solid #e2e8f0;">
                ${banner.id}
              </span>
            ` : ''}
          </div>
          <button type="button" class="admin-modal-close-icon close-modal-btn" title="Fechar (Esc)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form id="bannerForm" class="admin-modal-product-body" style="padding: 14px 18px !important; background: #ffffff !important;">
          <!-- Card Arte do Banner -->
          <div class="admin-card-panel" style="margin-bottom: 10px;">
            <div class="admin-panel-header" style="margin-bottom: 8px;">
              <h4 class="admin-panel-title">Arte do Banner</h4>
            </div>
            <div id="bannerImageUploaderMount"></div>
          </div>

          <!-- Card Configurações da Campanha -->
          <div class="admin-card-panel" style="margin-bottom: 10px;">
            <div class="admin-panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h4 class="admin-panel-title">Configurações</h4>
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="hidden" id="bnIsActive" value="${banner?.is_active !== false ? 'true' : 'false'}" />
                <div class="admin-status-segmented-control">
                  <button type="button" class="admin-status-segmented-btn ${banner?.is_active !== false ? 'active status-active' : ''}" data-status="true">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #16a34a;"></span>
                    <span>Ativo</span>
                  </button>
                  <button type="button" class="admin-status-segmented-btn ${banner?.is_active === false ? 'active status-blocked' : ''}" data-status="false">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #94a3b8;"></span>
                    <span>Pausado</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Linha: Título e Ordem -->
            <div style="display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 1fr); gap: 8px; margin-bottom: 8px;">
              <div class="form-group">
                <label class="admin-form-label" for="bnTitle">Título da Campanha *</label>
                <input 
                  type="text" 
                  id="bnTitle" 
                  class="form-input" 
                  value="${banner?.title || ''}" 
                  placeholder="Ex: Campanha Especial iPhone 16" 
                  required 
                  style="font-weight: 600;"
                />
              </div>

              <div class="form-group">
                <label class="admin-form-label" for="bnOrder">Ordem *</label>
                <input 
                  type="number" 
                  id="bnOrder" 
                  class="form-input" 
                  value="${banner?.display_order || (bannersList.length + 1)}" 
                  min="1" 
                  required 
                  style="font-weight: 600;"
                />
              </div>
            </div>

            <!-- Linha: Link de Destino -->
            <div class="form-group">
              <label class="admin-form-label" for="bnButtonLink">Link de Destino ao Clicar *</label>
              <input 
                type="text" 
                id="bnButtonLink" 
                class="form-input" 
                value="${banner?.button_link || '#/catalogo'}" 
                placeholder="#/catalogo ou link da categoria/produto" 
                required 
              />
            </div>
          </div>

          <!-- Rodapé de Ações -->
          <div class="admin-modal-footer" style="padding: 10px 16px; background: #ffffff; border-top: 1px solid #e2e8f0; margin-top: 10px; border-radius: 8px; display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
            <button type="button" class="btn btn-secondary close-modal-btn" style="padding: 6px 14px; font-weight: 600; font-size: 0.8125rem;">
              Cancelar
            </button>
            <button type="submit" class="btn btn-primary" style="padding: 6px 18px; font-weight: 600; font-size: 0.8125rem;">
              ${isEdit ? 'Salvar Alterações' : 'Publicar Banner'}
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Controle Segmented do Status Ativo / Pausado
    const statusValInput = modal.querySelector('#bnIsActive');
    const statusBtns = modal.querySelectorAll('.admin-status-segmented-btn');
    statusBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        statusBtns.forEach(b => b.classList.remove('active', 'status-active', 'status-blocked'));
        const isAct = btn.dataset.status === 'true';
        btn.classList.add('active', isAct ? 'status-active' : 'status-blocked');
        statusValInput.value = btn.dataset.status;
      });
    });

    const bnImgUploader = createImageUploader({
      id: 'bnImgUpload',
      minimal: true,
      initialUrl: banner?.image_url || '',
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

  // 6. Modal de Cupom (Criação & Edição com Validação de Datas - BUG-007, BUG-024, BUG-026)
  function openCouponModal(coupon = null) {
    const isEdit = Boolean(coupon);
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.padding = '16px';

    // Normalização das datas para o input date (YYYY-MM-DD)
    const formatDateInput = (d) => {
      if (!d) return '';
      try {
        const dt = new Date(d);
        return !isNaN(dt.getTime()) ? dt.toISOString().split('T')[0] : '';
      } catch {
        return '';
      }
    };

    const initialStartDate = formatDateInput(coupon?.start_date || coupon?.data_inicio);
    const initialEndDate = formatDateInput(coupon?.end_date || coupon?.data_fim || coupon?.expires_at);

    modal.innerHTML = `
      <div class="admin-modal-dialog" style="max-width:540px; width:100%; margin:auto; border-radius:14px; box-shadow:0 20px 45px rgba(0,0,0,0.22); overflow:hidden;">
        <div class="admin-modal-header" style="padding:14px 18px; display:flex; justify-content:space-between; align-items:center; background:#ffffff; border-bottom:1px solid #e2e8f0;">
          <h3 class="admin-modal-title" style="font-size:1.125rem; font-weight:700; color:#0f172a; margin:0;">
            ${isEdit ? `Editar Cupom: ${coupon.code}` : 'Novo Cupom de Desconto'}
          </h3>
          <button type="button" class="admin-modal-close-icon close-modal-btn" title="Fechar">✕</button>
        </div>

        <form id="couponForm" class="admin-modal-body" style="padding:18px 20px; background:#ffffff; display:flex; flex-direction:column; gap:14px;">
          <!-- Painel 1: Dados do Cupom -->
          <div class="admin-card-panel" style="border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px; background:#ffffff;">
            <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#64748b; margin-bottom:12px;">
              Regras do Desconto
            </div>
            <div class="admin-form-grid-2">
              <div class="form-group">
                <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px;">Código do Cupom *</label>
                <input type="text" id="cpCode" class="form-input" value="${coupon?.code || ''}" placeholder="Ex: NOVATECH10" style="text-transform:uppercase; font-weight:800; height:33px; font-size:0.875rem;" required />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px;">Tipo de Desconto *</label>
                <select id="cpType" class="admin-filter-select" style="width:100%; height:33px; font-size:0.8125rem;">
                  <option value="percent" ${coupon?.discount_type === 'percent' ? 'selected' : ''}>Porcentagem (%)</option>
                  <option value="fixed" ${coupon?.discount_type === 'fixed' ? 'selected' : ''}>Valor Fixo em Kwanzas (Kz)</option>
                  <option value="free_shipping" ${coupon?.discount_type === 'free_shipping' ? 'selected' : ''}>Frete Grátis</option>
                </select>
              </div>
            </div>

            <div class="admin-form-grid-2" style="margin-top:10px;">
              <div class="form-group">
                <label class="form-label" id="cpValueLabel" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px;">Valor do Desconto *</label>
                <input type="number" id="cpValue" class="form-input" value="${coupon?.discount_value !== undefined ? coupon.discount_value : ''}" placeholder="Ex: 10 ou 5000" style="height:33px; font-size:0.875rem;" ${coupon?.discount_type === 'free_shipping' ? 'disabled value="0"' : 'required'} />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px;">Pedido Mínimo (Kz)</label>
                <input type="number" id="cpMinOrder" class="form-input" value="${coupon?.min_order_value || 0}" placeholder="0 = Sem mínimo" style="height:33px; font-size:0.875rem;" />
              </div>
            </div>
          </div>

          <!-- Painel 2: Limites e Validade -->
          <div class="admin-card-panel" style="border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px; background:#ffffff;">
            <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#64748b; margin-bottom:12px;">
              Validade & Limitações
            </div>
            <div class="admin-form-grid-2">
              <div class="form-group">
                <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px;">Data de Início</label>
                <input type="date" id="cpStartDate" class="form-input" value="${initialStartDate}" style="height:33px; font-size:0.875rem;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px;">Data de Término</label>
                <input type="date" id="cpEndDate" class="form-input" value="${initialEndDate}" style="height:33px; font-size:0.875rem;" />
              </div>
            </div>

            <div class="admin-form-grid-2" style="margin-top:10px;">
              <div class="form-group">
                <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px;">Limite Total de Usos</label>
                <input type="number" id="cpLimit" class="form-input" value="${coupon?.usage_limit || ''}" placeholder="Vazio = Ilimitado" style="height:33px; font-size:0.875rem;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:4px;">Status do Cupom</label>
                <select id="cpIsActive" class="admin-filter-select" style="width:100%; height:33px; font-size:0.8125rem;">
                  <option value="true" ${coupon?.is_active !== false ? 'selected' : ''}>Ativo (Disponível)</option>
                  <option value="false" ${coupon?.is_active === false ? 'selected' : ''}>Pausado / Inativo</option>
                </select>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
            <button type="button" class="btn btn-secondary btn-sm close-modal-btn" style="padding:7px 16px; font-size:0.8125rem;">Cancelar</button>
            <button type="submit" id="saveCouponBtn" class="btn btn-primary btn-sm" style="font-weight:600; padding:7px 18px; font-size:0.8125rem;">
              ${isEdit ? 'Salvar Alterações' : 'Criar Cupom'}
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const typeSelect = modal.querySelector('#cpType');
    const valInput = modal.querySelector('#cpValue');

    typeSelect.addEventListener('change', () => {
      if (typeSelect.value === 'free_shipping') {
        valInput.value = '0';
        valInput.disabled = true;
        valInput.required = false;
      } else {
        valInput.disabled = false;
        valInput.required = true;
        if (valInput.value === '0') valInput.value = '';
      }
    });

    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#couponForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = modal.querySelector('#cpCode').value.trim().toUpperCase();
      const discountType = modal.querySelector('#cpType').value;
      const discountVal = discountType === 'free_shipping' ? 0 : Number(modal.querySelector('#cpValue').value);
      const startDate = modal.querySelector('#cpStartDate').value || null;
      const endDate = modal.querySelector('#cpEndDate').value || null;

      // Validação de datas BUG-026: data_fim >= data_inicio
      if (startDate && endDate) {
        if (new Date(endDate) < new Date(startDate)) {
          Toast.show('A data de término não pode ser anterior à data de início do cupom.', 'warning');
          return;
        }
      }

      const payload = {
        code,
        discount_type: discountType,
        discount_value: discountVal,
        min_order_value: modal.querySelector('#cpMinOrder').value ? Number(modal.querySelector('#cpMinOrder').value) : 0,
        usage_limit: modal.querySelector('#cpLimit').value ? Number(modal.querySelector('#cpLimit').value) : null,
        start_date: startDate,
        end_date: endDate,
        expires_at: endDate,
        is_active: modal.querySelector('#cpIsActive').value === 'true'
      };

      const saveBtn = modal.querySelector('#saveCouponBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando cupom...';

      try {
        if (isEdit) {
          await Api.coupons.update(coupon.id, payload);
          Toast.show('Cupom atualizado com sucesso no banco de dados!', 'success');
        } else {
          await Api.coupons.create(payload);
          Toast.show('Cupom criado com sucesso no banco de dados!', 'success');
        }
        modal.remove();
        await loadAllData();
        render();
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Salvar Alterações' : 'Criar Cupom';
        Toast.show(err.message || 'Erro ao salvar cupom.', 'error');
      }
    });
  }

  // 7. Modal de Catálogo / Campanha Comercial (100% Centralizado em Mobile e Desktop)
  function openCatalogModal(cat = null) {
    const isEdit = Boolean(cat);
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.padding = '16px';

    modal.innerHTML = `
      <div class="admin-modal-dialog" style="max-width:520px; width:100%; margin:auto; border-radius:14px; box-shadow:0 20px 45px rgba(0,0,0,0.22); overflow:hidden;">
        <div class="admin-modal-header" style="padding:14px 18px; display:flex; justify-content:space-between; align-items:center; background:#ffffff; border-bottom:1px solid #e2e8f0;">
          <h3 class="admin-modal-title" style="font-size:1.125rem; font-weight:700; color:#0f172a; margin:0;">
            ${isEdit ? 'Editar Campanha' : 'Nova Campanha Comercial'}
          </h3>
          <button type="button" class="admin-modal-close-icon close-modal-btn" title="Fechar">✕</button>
        </div>

        <form id="catalogForm" style="display:flex; flex-direction:column; margin:0;">
          <div class="admin-modal-body" style="padding:18px 20px; background:#ffffff; display:flex; flex-direction:column; gap:14px;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px;">
              <div class="admin-form-grid-2" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
                <div class="form-group">
                  <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">
                    Nome da Campanha <span style="color:#ef4444;">*</span>
                  </label>
                  <input type="text" id="clName" class="form-input" value="${cat?.name || ''}" placeholder="Ex: Black Friday 2026" style="height:38px; font-size:0.875rem; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:6px 10px;" required />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">
                    Slug URL
                  </label>
                  <input type="text" id="clSlug" class="form-input" value="${cat?.slug || ''}" placeholder="black-friday" style="height:38px; font-size:0.875rem; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:6px 10px;" />
                </div>
              </div>

              <div class="admin-form-grid-2" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
                <div class="form-group">
                  <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">
                    Badge Comercial
                  </label>
                  <input type="text" id="clBadge" class="form-input" value="${cat?.badge_text || ''}" placeholder="Ex: ATÉ 40% OFF" style="height:38px; font-size:0.875rem; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:6px 10px;" />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">
                    Ordem de Exibição <span style="color:#ef4444;">*</span>
                  </label>
                  <input type="number" id="clOrder" class="form-input" value="${cat?.display_order || 1}" min="1" style="height:38px; font-size:0.875rem; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:6px 10px;" required />
                </div>
              </div>

              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">
                  Descrição Comercial
                </label>
                <textarea id="clDesc" class="form-input" rows="3" placeholder="Descrição opcional dos produtos em destaque na campanha..." style="font-size:0.875rem; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:8px 10px;">${cat?.description || ''}</textarea>
              </div>
            </div>
          </div>

          <div class="admin-modal-footer" style="padding:14px 20px; display:flex; justify-content:flex-end; gap:10px; background:#f8fafc; border-top:1px solid #e2e8f0;">
            <button type="button" class="btn btn-secondary btn-sm close-modal-btn" style="padding:8px 18px; font-size:0.875rem; font-weight:600; border-radius:6px;">Cancelar</button>
            <button type="submit" class="btn btn-primary btn-sm" style="font-weight:700; padding:8px 20px; font-size:0.875rem; border-radius:6px;">
              ${isEdit ? 'Salvar Alterações' : 'Criar Campanha'}
            </button>
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

  // 8. Modal de Movimentação de Estoque (100% Centralizado em Mobile e Desktop)
  function openStockMovementModal(preset = {}) {
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.padding = '16px';

    modal.innerHTML = `
      <div class="admin-modal-dialog" style="max-width:480px; width:100%; margin:auto; border-radius:14px; box-shadow:0 20px 45px rgba(0,0,0,0.22); overflow:hidden;">
        <div class="admin-modal-header" style="padding:14px 18px; display:flex; justify-content:space-between; align-items:center; background:#ffffff; border-bottom:1px solid #e2e8f0;">
          <h3 class="admin-modal-title" style="font-size:1.125rem; font-weight:700; color:#0f172a; margin:0;">
            Movimentação de Estoque
          </h3>
          <button type="button" class="admin-modal-close-icon close-modal-btn" title="Fechar">✕</button>
        </div>

        <form id="stockMovementForm" style="display:flex; flex-direction:column; margin:0;">
          <div class="admin-modal-body" style="padding:18px 20px; background:#ffffff; display:flex; flex-direction:column; gap:14px;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px;">
              <div class="form-group" style="margin-bottom:12px;">
                <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">
                  Produto <span style="color:#ef4444;">*</span>
                </label>
                <select id="smProduct" class="admin-filter-select" style="width:100%; height:38px; font-size:0.875rem; border-radius:6px; border:1px solid #cbd5e1; background:#ffffff; padding:6px 10px;" required>
                  <option value="">Selecione o produto</option>
                  ${productsList.map(p => `
                    <option value="${p.id}" ${preset?.product_id === p.id ? 'selected' : ''}>
                      ${p.name} (Atual: ${p.stock || 0} un)
                    </option>
                  `).join('')}
                </select>
              </div>

              <div class="admin-form-grid-2" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
                <div class="form-group">
                  <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">
                    Tipo de Movimento <span style="color:#ef4444;">*</span>
                  </label>
                  <select id="smType" class="admin-filter-select" style="width:100%; height:38px; font-size:0.875rem; border-radius:6px; border:1px solid #cbd5e1; background:#ffffff; padding:6px 10px;">
                    <option value="in" ${preset?.movement_type === 'in' ? 'selected' : ''}>Entrada (+)</option>
                    <option value="out" ${preset?.movement_type === 'out' ? 'selected' : ''}>Saída (-)</option>
                    <option value="adjustment">Ajuste de Balanço</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">
                    Quantidade <span style="color:#ef4444;">*</span>
                  </label>
                  <input type="number" id="smQty" class="form-input" min="1" placeholder="Ex: 5" style="height:38px; font-size:0.875rem; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:6px 10px;" required />
                </div>
              </div>

              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" style="font-size:0.8125rem; font-weight:600; color:#334155; margin-bottom:5px; display:block;">
                  Motivo ou Observação <span style="color:#ef4444;">*</span>
                </label>
                <input type="text" id="smReason" class="form-input" placeholder="Ex: Chegada de remessa de fornecedor" style="height:38px; font-size:0.875rem; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; padding:6px 10px;" required />
              </div>
            </div>
          </div>

          <div class="admin-modal-footer" style="padding:14px 20px; display:flex; justify-content:flex-end; gap:10px; background:#f8fafc; border-top:1px solid #e2e8f0;">
            <button type="button" class="btn btn-secondary btn-sm close-modal-btn" style="padding:8px 18px; font-size:0.875rem; font-weight:600; border-radius:6px;">Cancelar</button>
            <button type="submit" class="btn btn-primary btn-sm" style="font-weight:700; padding:8px 20px; font-size:0.875rem; border-radius:6px;">
              Registrar Movimento
            </button>
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
