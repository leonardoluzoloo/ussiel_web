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
    const isAdmin = currentUser && currentUser.role === 'admin' && Boolean(token);
    const isCustomer = currentUser && currentUser.role === 'customer';

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
    if (!subRoute || ['login', 'register', 'forgot-password', 'reset-password'].includes(subRoute)) {
      window.history.replaceState(null, '', window.location.pathname + '#/admin/dashboard');
      currentTab = 'dashboard';
    } else {
      const mappedTab = (subRoute === 'inventory') ? 'stock' : (subRoute === 'campaigns' ? 'catalogs' : subRoute);
      const validTabs = ['dashboard', 'products', 'categories', 'banners', 'orders', 'customers', 'stock', 'coupons', 'catalogs', 'settings', 'profile'];
      currentTab = validTabs.includes(mappedTab) ? mappedTab : 'dashboard';
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
    } catch {}

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
                        ${renderPaymentBadge(o.payment_status, o.payment_method)}
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
                      ${renderPaymentBadge(o.payment_status, o.payment_method)}
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
                    ${renderPaymentBadge(o.payment_status, o.payment_method)}
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
                ${filtered.map(p => {
                  const cat = categoriesList.find(c => String(c.id) === String(p.category_id));
                  const subName = p.subcategory_name || p.subcategory || (cat?.subcategories || []).find(s => String(s.id) === String(p.subcategory_id))?.name || '';
                  return `
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
                      <div style="margin-top: 4px; display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; flex-wrap: wrap;">
                        <span style="background: #eff6ff; color: #1d4ed8; padding: 2px 7px; border-radius: 4px; font-weight: 600;">
                          ${cat ? cat.name : 'Sem categoria'}
                        </span>
                        ${subName ? `
                          <span style="color: #94a3b8; font-weight: bold;">↳</span>
                          <span style="background: #f8fafc; color: #334155; padding: 2px 7px; border-radius: 4px; font-weight: 600; border: 1px solid #e2e8f0;">
                            ${subName}
                          </span>
                        ` : `
                          <span style="color: #ef4444; font-size: 0.6875rem; font-weight: 600;">⚠️ Sem subcategoria</span>
                        `}
                      </div>
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
                      <div style="margin-top: 3px; display: inline-flex; align-items: center; gap: 4px; font-size: 0.6875rem; flex-wrap: wrap;">
                        <span style="background: #eff6ff; color: #1d4ed8; padding: 1px 6px; border-radius: 4px; font-weight: 600;">
                          ${cat ? cat.name : 'Sem categoria'}
                        </span>
                        ${subName ? `
                          <span style="color: #94a3b8;">↳</span>
                          <span style="background: #f1f5f9; color: #334155; padding: 1px 6px; border-radius: 4px; font-weight: 600;">
                            ${subName}
                          </span>
                        ` : ''}
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
  // ===================================================================
  // ABA 4: CATEGORIAS & SUBCATEGORIAS (Estrutura Simples, Direta e Sem Ícones)
  // ===================================================================
  function renderCategoriesTab() {
    const totalSubs = categoriesList.reduce((acc, c) => acc + (Array.isArray(c.subcategories) ? c.subcategories.length : 0), 0);

    return `
      <div class="admin-card">
        <div class="admin-card-header" style="flex-wrap:wrap; gap:16px;">
          <div>
            <h2 class="admin-card-title">
              <span>Categorias & Subcategorias</span>
            </h2>
            <p style="font-size:0.8125rem; color:#64748b; margin-top:2px;">
              Gerencie os departamentos da loja e suas respectivas subcategorias vinculadas.
            </p>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button id="openNewCategoryModalBtn" class="btn btn-primary" style="padding: 10px 18px; font-weight:700;">
              + Nova Categoria
            </button>
            <button id="openNewSubcategoryModalBtn" class="btn btn-secondary" style="padding: 10px 18px; font-weight:700; background:#f8fafc; border:1px solid #cbd5e1; color:#0f172a;">
              + Nova Subcategoria
            </button>
          </div>
        </div>

        <div style="display:flex; gap:16px; margin-bottom:20px; flex-wrap:wrap;">
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 18px; display:flex; align-items:center; gap:12px; min-width:180px;">
            <div>
              <div style="font-size:0.75rem; color:#64748b; font-weight:600; text-transform:uppercase;">Categorias Principais</div>
              <div style="font-size:1.5rem; font-weight:800; color:#0f172a;">${categoriesList.length}</div>
            </div>
          </div>
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 18px; display:flex; align-items:center; gap:12px; min-width:180px;">
            <div>
              <div style="font-size:0.75rem; color:#64748b; font-weight:600; text-transform:uppercase;">Subcategorias Vinculadas</div>
              <div style="font-size:1.5rem; font-weight:800; color:#2563eb;">${totalSubs}</div>
            </div>
          </div>
        </div>

        ${categoriesList.length === 0 ? `
          <div class="admin-empty-state">
            <div class="admin-empty-state-title">Nenhuma categoria cadastrada no banco de dados</div>
            <div class="admin-empty-state-desc">Cadastre categorias como Telefones, Computadores, Acessórios para estruturar a loja.</div>
            <button class="btn btn-primary btn-sm" id="emptyStateNewCatBtn" style="margin-top:10px;">
              + Nova Categoria
            </button>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:16px;">
            ${categoriesList.map(c => {
              const subs = Array.isArray(c.subcategories) ? c.subcategories : [];
              return `
                <div class="admin-category-block" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                  <!-- Cabeçalho da Categoria -->
                  <div style="padding:16px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                      <span style="display:inline-block; font-size:0.75rem; font-weight:700; background:#e2e8f0; color:#475569; padding:4px 8px; border-radius:6px;">
                        Ordem #${c.display_order || 1}
                      </span>
                      <strong style="font-size:1.125rem; color:#0f172a; font-weight:800;">
                        ${c.name}
                      </strong>
                      <span class="badge" style="${c.is_active !== false ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                        ${c.is_active !== false ? 'Ativa' : 'Inativa'}
                      </span>
                      <span class="badge" style="background:#eff6ff; color:#1d4ed8; font-weight:600;">
                        ${subs.length} ${subs.length === 1 ? 'subcategoria' : 'subcategorias'}
                      </span>
                    </div>

                    <div style="display:flex; gap:8px; align-items:center;">
                      <button class="btn btn-sm btn-primary add-sub-to-cat-btn" data-cat-id="${c.id}" data-cat-name="${c.name}" style="padding:6px 12px; font-size:0.8125rem;">
                        + Subcategoria
                      </button>
                      <button class="btn btn-sm btn-secondary edit-category-btn" data-id="${c.id}" style="padding:6px 12px; font-size:0.8125rem;">
                        Editar
                      </button>
                      <button class="btn btn-sm delete-category-btn" data-id="${c.id}" data-cat-name="${c.name}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; padding:6px 10px; font-size:0.8125rem;">
                        Excluir
                      </button>
                    </div>
                  </div>

                  ${c.description ? `
                    <div style="padding:10px 20px; font-size:0.8125rem; color:#64748b; background:#ffffff; border-bottom:1px solid #f1f5f9;">
                      ${c.description}
                    </div>
                  ` : ''}

                  <!-- Listagem de Subcategorias Vinculadas -->
                  <div style="padding:16px 20px;">
                    <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:10px; letter-spacing:0.5px;">
                      Subcategorias Vinculadas a "${c.name}"
                    </div>

                    ${subs.length === 0 ? `
                      <div style="font-size:0.8125rem; color:#94a3b8; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                        <span>Nenhuma subcategoria vinculada ainda a esta categoria.</span>
                        <button class="btn btn-xs btn-secondary add-sub-to-cat-btn" data-cat-id="${c.id}" data-cat-name="${c.name}" style="font-size:0.75rem;">
                          + Vincular Agora
                        </button>
                      </div>
                    ` : `
                      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:10px;">
                        ${subs.map(sub => `
                          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                            <div style="min-width:0; flex:1;">
                              <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.6875rem; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-weight:600;">#${sub.display_order || 1}</span>
                                <strong style="font-size:0.875rem; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sub.name}</strong>
                              </div>
                              ${sub.description ? `<div style="font-size:0.75rem; color:#64748b; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sub.description}</div>` : ''}
                              <div style="margin-top:4px;">
                                <span class="badge" style="font-size:0.6875rem; padding:2px 6px; ${sub.is_active !== false ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                                  ${sub.is_active !== false ? 'Ativa' : 'Inativa'}
                                </span>
                              </div>
                            </div>
                            <div style="display:flex; gap:6px; flex-shrink:0;">
                              <button class="btn btn-secondary btn-xs edit-subcategory-btn" data-cat-id="${c.id}" data-sub-id="${sub.id}" style="padding:4px 8px; font-size:0.75rem;">
                                Editar
                              </button>
                              <button class="btn btn-xs delete-subcategory-btn" data-cat-id="${c.id}" data-sub-id="${sub.id}" data-sub-name="${sub.name}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; padding:4px 8px; font-size:0.75rem;">
                                Excluir
                              </button>
                            </div>
                          </div>
                        `).join('')}
                      </div>
                    `}
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
                      <span style="font-size: 0.8125rem;">${c.total_usado !== undefined ? c.total_usado : (c.times_used || 0)} / ${c.usage_limit || '∞'}</span>
                    </td>
                    <td>
                      <button class="toggle-coupon-active-btn" data-id="${c.id}" data-active="${c.is_active !== false}" style="background: none; border: none; cursor: pointer;">
                        <span class="badge" style="${c.is_active !== false ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#b91c1c;'}">
                          ${c.is_active !== false ? '● Ativo' : '○ Pausado'}
                        </span>
                      </button>
                    </td>
                    <td>
                      <div style="display:flex; gap:6px;">
                        <button class="btn btn-secondary btn-sm edit-coupon-btn" data-id="${c.id}">
                          Editar
                        </button>
                        <button class="btn btn-sm delete-coupon-btn" data-id="${c.id}" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;">
                          Excluir
                        </button>
                      </div>
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
                  <div>Usos: ${c.total_usado !== undefined ? c.total_usado : (c.times_used || 0)} / ${c.usage_limit || 'Ilimitado'}</div>
                </div>
                <div style="display:flex; gap:8px; border-top:1px dashed #cbd5e1; padding-top:10px; margin-top:4px;">
                  <button class="btn btn-secondary btn-sm edit-coupon-btn" data-id="${c.id}" style="flex:1;">
                    Editar
                  </button>
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

  // ===================================================================
  // ABA 11: MINHA CONTA / PERFIL DO ADMINISTRADOR (100% INDEPENDENTE DA LOJA)
  // ===================================================================
  function renderProfileTab() {
    const user = Storage.getUser() || { name: 'Administrador', email: 'admin@novatech.co.ao', role: 'admin' };
    const rawName = (user?.name || 'Administrador').trim();
    const firstName = rawName.split(' ')[0] || 'Administrador';

    return `
      <div style="display:flex; flex-direction:column; gap:20px; max-width:1100px; margin:0 auto; width:100%;">
        <!-- 1. Hero Card de Identificação do Administrador -->
        <div class="admin-profile-hero-card">
          <div class="admin-profile-hero-avatar" style="display:flex; align-items:center; justify-content:center; background:#2563eb; color:#ffffff;">
            ${Icons.user(32)}
          </div>
          <div class="admin-profile-hero-info">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <h2 class="admin-profile-hero-name">${firstName}</h2>
              <span class="badge" style="background:#dbeafe; color:#1e40af; font-size:0.75rem; font-weight:800;">
                Gestor do Sistema
              </span>
            </div>
            <div class="admin-profile-hero-email">${user.email || 'admin@novatech.co.ao'}</div>
            <div class="admin-profile-badges">
              <span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.6875rem; font-weight:700;">
                ● Sessão Ativa
              </span>
              <span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.6875rem;">
                Nível: Administrador do Sistema
              </span>
              <span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.6875rem;">
                Acesso Irrestrito à Plataforma
              </span>
            </div>
          </div>
        </div>

        <!-- 2. Grid de Edição Cadastral e Segurança de Senha -->
        <div class="admin-profile-grid">
          
          <!-- Bloco 1: Dados Pessoais & Login -->
          <div class="admin-card">
            <div class="admin-card-header" style="border-bottom:1px solid #f1f5f9; padding-bottom:12px; margin-bottom:16px;">
              <div>
                <h3 class="admin-card-title" style="font-size:1rem;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  <span>Dados Cadastrais & Acesso</span>
                </h3>
                <p style="font-size:0.8125rem; color:#64748b; margin-top:2px;">
                  Atualize seu nome de exibição e e-mail utilizado para entrar no painel.
                </p>
              </div>
            </div>

            <form id="adminProfileDataForm" style="display:flex; flex-direction:column; gap:14px;">
              <div class="form-group">
                <label class="form-label" for="profileName">Nome Completo</label>
                <input 
                  type="text" 
                  id="profileName" 
                  class="form-input" 
                  value="${user.name || ''}" 
                  placeholder="Ex: Leonardo Adriano" 
                  required 
                  minlength="2"
                  autocomplete="name"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="profileEmail">E-mail de Acesso (Login)</label>
                <input 
                  type="email" 
                  id="profileEmail" 
                  class="form-input" 
                  value="${user.email || ''}" 
                  placeholder="admin@novatech.co.ao" 
                  required 
                  autocomplete="email"
                />
                <small style="font-size:0.75rem; color:#64748b; margin-top:4px; display:block;">
                  Utilizado para autenticação no painel administrativo.
                </small>
              </div>

              <div class="form-group">
                <label class="form-label" for="profilePhone">Telefone / WhatsApp Profissional</label>
                <input 
                  type="tel" 
                  id="profilePhone" 
                  class="form-input" 
                  value="${user.phone || ''}" 
                  placeholder="+244 923 179 192" 
                  autocomplete="tel"
                />
              </div>

              <div style="display:flex; justify-content:flex-end; margin-top:8px;">
                <button type="submit" id="saveProfileDataBtn" class="btn btn-primary" style="padding:10px 20px; font-weight:700;">
                  Salvar Dados Cadastrais
                </button>
              </div>
            </form>
          </div>

          <!-- Bloco 2: Segurança & Alteração de Senha -->
          <div class="admin-card">
            <div class="admin-card-header" style="border-bottom:1px solid #f1f5f9; padding-bottom:12px; margin-bottom:16px;">
              <div>
                <h3 class="admin-card-title" style="font-size:1rem;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  <span>Segurança & Senha de Acesso</span>
                </h3>
                <p style="font-size:0.8125rem; color:#64748b; margin-top:2px;">
                  Modifique sua senha de gestor com confirmação da senha atual.
                </p>
              </div>
            </div>

            <form id="adminPasswordChangeForm" style="display:flex; flex-direction:column; gap:14px;">
              <div class="form-group">
                <label class="form-label" for="pwdCurrent">Senha Atual</label>
                <div style="position:relative; display:flex; align-items:center;">
                  <input 
                    type="password" 
                    id="pwdCurrent" 
                    class="form-input" 
                    placeholder="Digite sua senha atual" 
                    required 
                    autocomplete="current-password"
                    style="padding-right:40px;"
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

              <div class="form-group">
                <label class="form-label" for="pwdNew">Nova Senha de Acesso</label>
                <div style="position:relative; display:flex; align-items:center;">
                  <input 
                    type="password" 
                    id="pwdNew" 
                    class="form-input" 
                    placeholder="Mínimo de 6 caracteres" 
                    required 
                    minlength="6"
                    autocomplete="new-password"
                    style="padding-right:40px;"
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
                <small style="font-size:0.75rem; color:#64748b; margin-top:4px; display:block;">
                  A nova senha deve ter no mínimo 6 dígitos.
                </small>
              </div>

              <div class="form-group">
                <label class="form-label" for="pwdConfirm">Confirmar Nova Senha</label>
                <div style="position:relative; display:flex; align-items:center;">
                  <input 
                    type="password" 
                    id="pwdConfirm" 
                    class="form-input" 
                    placeholder="Repita a nova senha" 
                    required 
                    minlength="6"
                    autocomplete="new-password"
                    style="padding-right:40px;"
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

              <div style="display:flex; justify-content:flex-end; margin-top:8px;">
                <button type="submit" id="savePasswordBtn" class="btn btn-primary" style="padding:10px 20px; font-weight:700;">
                  Atualizar Senha
                </button>
              </div>
            </form>
          </div>

        </div>

        <!-- 3. Sessão Ativa & Encerramento Claro -->
        <div class="admin-card" style="border: 1px dashed #cbd5e1; background: #fafafa;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
            <div>
              <h4 style="font-size:0.9375rem; font-weight:800; color:#0f172a; margin-bottom:4px;">
                Sessão Administrativa Conectada
              </h4>
              <p style="font-size:0.8125rem; color:#64748b;">
                Ao encerrar a sessão, suas credenciais locais serão limpas com segurança e o painel será bloqueado.
              </p>
            </div>
            <button type="button" id="profileLogoutBtn" class="admin-logout-btn" style="padding:10px 18px; font-size:0.875rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              <span>Encerrar Sessão no Painel</span>
            </button>
          </div>
        </div>

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

  function renderPaymentBadge(status, method = '') {
    const s = String(status || '').toLowerCase();
    const methodText = method ? ` (${method.toUpperCase()})` : '';
    if (s === 'paid' || s === 'completed' || s === 'pago') {
      return `<span class="badge" style="background:#dcfce7; color:#15803d; font-size:0.6875rem; font-weight:700;">✓ Pago${methodText}</span>`;
    }
    if (s === 'pending' || s === 'pendente') {
      return `<span class="badge" style="background:#fef3c7; color:#b45309; font-size:0.6875rem; font-weight:700;">⏳ Pendente${methodText}</span>`;
    }
    if (s === 'failed' || s === 'cancelled' || s === 'recusado') {
      return `<span class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.6875rem; font-weight:700;">✕ Recusado${methodText}</span>`;
    }
    return `<span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.6875rem;">${status ? status.toUpperCase() : 'PENDENTE'}${methodText}</span>`;
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

    // --- Categorias & Subcategorias ---
    const newCatBtn = container.querySelector('#openNewCategoryModalBtn');
    const emptyCatBtn = container.querySelector('#emptyStateNewCatBtn');
    if (newCatBtn) newCatBtn.addEventListener('click', () => openCategoryModal());
    if (emptyCatBtn) emptyCatBtn.addEventListener('click', () => openCategoryModal());

    const newSubBtn = container.querySelector('#openNewSubcategoryModalBtn');
    if (newSubBtn) newSubBtn.addEventListener('click', () => openSubcategoryModal());

    container.querySelectorAll('.add-sub-to-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = Number(btn.dataset.catId);
        openSubcategoryModal({ parent_id: catId });
      });
    });

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
        const catName = btn.dataset.catName || 'esta categoria';
        if (confirm(`Tem certeza que deseja excluir permanentemente a categoria "${catName}" e todas as suas subcategorias vinculadas?`)) {
          try {
            await Api.categories.delete(id);
            Toast.show('Categoria excluída com sucesso.', 'success');
            await loadAllData();
            render();
          } catch (err) {
            Toast.show(err.message || 'Erro ao excluir categoria.', 'error');
          }
        }
      });
    });

    container.querySelectorAll('.edit-subcategory-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = Number(btn.dataset.catId);
        const subId = btn.dataset.subId;
        const cat = categoriesList.find(c => c.id === catId);
        const sub = (cat?.subcategories || []).find(s => String(s.id) === String(subId));
        if (cat && sub) {
          openSubcategoryModal({ parent_id: cat.id, sub });
        }
      });
    });

    container.querySelectorAll('.delete-subcategory-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const catId = Number(btn.dataset.catId);
        const subId = btn.dataset.subId;
        const subName = btn.dataset.subName || 'esta subcategoria';
        if (confirm(`Deseja remover a subcategoria "${subName}"?`)) {
          try {
            await Api.categories.deleteSubcategory(catId, subId);
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

    // Encerramento de sessão a partir do card da aba Perfil
    const profileLogoutBtn = container.querySelector('#profileLogoutBtn');
    if (profileLogoutBtn) {
      profileLogoutBtn.addEventListener('click', performAdminLogout);
    }
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

    modal.innerHTML = `
      <div class="admin-modal-dialog" style="max-width: 680px; max-height: 90vh; overflow-y: auto;">
        <div class="admin-modal-header" style="position: sticky; top: 0; background: #ffffff; z-index: 10;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <h3 class="admin-modal-title" style="margin: 0;">Pedido ${order.order_code || order.codigo_pedido || order.id}</h3>
              ${renderStatusBadge(order.status || order.status_pedido)}
            </div>
            <span style="font-size: 0.75rem; color: #64748b;">Registrado em ${formatDate(order.created_at || order.criado_em || order.date)}</span>
          </div>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>

        <div class="admin-modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <!-- 1. Dados do Comprador e Entrega -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h4 style="font-size: 0.8125rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">
                Cliente & Entrega
              </h4>
              ${waLink ? `
                <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="color: #15803d; border-color: #bbf7d0; background: #f0fdf4; font-size: 0.6875rem; padding: 4px 10px;">
                  💬 Conversar no WhatsApp
                </a>
              ` : ''}
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 0.8125rem;">
              <div><strong>Nome:</strong> ${order.customer_name || order.nome_cliente || 'Não informado'}</div>
              <div><strong>Telefone:</strong> ${phone || 'Não informado'}</div>
              <div><strong>E-mail:</strong> ${order.customer_email || order.email_cliente || 'Não informado'}</div>
              <div><strong>Pagamento:</strong> <span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:0.6875rem;">${(order.payment_method || order.metodo_pagamento || 'MULTICAIXA').toUpperCase()}</span></div>
            </div>
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 0.8125rem;">
              <div><strong>Endereço de Entrega:</strong> ${order.shipping_address || order.endereco_entrega || 'Entrega padrão Luanda'}</div>
              ${(order.ponto_referencia) ? `<div style="margin-top: 4px; color: #475569;"><strong>Ponto de Referência:</strong> 📍 ${order.ponto_referencia}</div>` : ''}
              ${order.shipping_method ? `<div style="margin-top: 4px; color: #475569;"><strong>Método de Envio:</strong> ${order.shipping_method === 'express' ? '⚡ Entrega Expressa (até 4h)' : '🚚 Entrega Padrão Luanda (até 24h)'}</div>` : ''}
            </div>
          </div>

          <!-- 2. Lista de Produtos do Pedido -->
          <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; background: #ffffff;">
            <h4 style="font-size: 0.8125rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 10px 0;">
              Produtos Adquiridos (${items.length})
            </h4>

            ${items.length === 0 ? `
              <div style="font-size: 0.8125rem; color: #64748b; text-align: center; padding: 12px 0;">
                Nenhum detalhe de item específico registrado para este pedido.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${items.map(it => {
                  const name = it.product_name || it.name || it.nome_produto || 'Produto';
                  const img = it.product_image || it.image || it.imagem_produto || '';
                  const price = Number(it.unit_price || it.price || it.preco_unitario || 0);
                  const qty = Number(it.quantity || it.quantidade || 1);
                  const itemTotal = Number(it.total_price || it.preco_total || (price * qty));
                  const variant = it.selected_variant || it.variant || {};
                  const variantStr = Object.entries(variant).map(([k, v]) => `${k}: ${v}`).join(' | ');

                  return `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px; border-radius: 8px; background: #f8fafc; border: 1px solid #f1f5f9;">
                      <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                        ${img ? `
                          <img src="${img}" alt="${name}" style="width: 44px; height: 44px; object-fit: contain; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; flex-shrink: 0;" />
                        ` : `
                          <div style="width: 44px; height: 44px; background: #e2e8f0; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #64748b; flex-shrink: 0;">
                            ${Icons.package(20)}
                          </div>
                        `}
                        <div style="min-width: 0;">
                          <div style="font-size: 0.8125rem; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px;" title="${name}">${name}</div>
                          ${it.product_sku ? `<div style="font-size: 0.6875rem; color: #64748b;">SKU: ${it.product_sku}</div>` : ''}
                          ${variantStr ? `<div style="font-size: 0.6875rem; color: #3b82f6;">${variantStr}</div>` : ''}
                          <div style="font-size: 0.75rem; color: #64748b;">${qty}x ${formatPrice(price)}</div>
                        </div>
                      </div>
                      <div style="text-align: right; flex-shrink: 0;">
                        <strong style="font-size: 0.875rem; color: #0f172a;">${formatPrice(itemTotal)}</strong>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

          <!-- 3. Resumo Financeiro -->
          <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; background: #ffffff;">
            <h4 style="font-size: 0.8125rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0;">
              Resumo Financeiro
            </h4>
            <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.8125rem;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Subtotal:</span>
                <strong>${formatPrice(order.subtotal || order.total)}</strong>
              </div>
              ${order.discount ? `
                <div style="display: flex; justify-content: space-between; color: #16a34a;">
                  <span>Desconto Aplicado:</span>
                  <strong>- ${formatPrice(order.discount)}</strong>
                </div>
              ` : ''}
              ${order.shipping_price ? `
                <div style="display: flex; justify-content: space-between; color: #64748b;">
                  <span>Taxa de Entrega:</span>
                  <strong>${formatPrice(order.shipping_price)}</strong>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; font-size: 1rem; font-weight: 900; color: #1d4ed8; border-top: 1px solid #f1f5f9; padding-top: 8px; margin-top: 4px;">
                <span>Total Oficial:</span>
                <span>${formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          <!-- 4. Alteração de Status e Notas Administrativas -->
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px;">
            <h4 style="font-size: 0.8125rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 10px 0;">
              Gestão Operacional de Status
            </h4>

            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label" style="font-size: 0.8125rem; font-weight: 700;">Status do Pedido (Reflete instantaneamente no rastreamento do cliente):</label>
              <select id="modalOrderStatusSelect" class="admin-filter-select" style="width: 100%; font-size: 0.875rem; padding: 8px 12px;">
                <option value="received" ${(order.status === 'received' || order.status_pedido === 'received') ? 'selected' : ''}>Recebido (Aguardando processamento)</option>
                <option value="confirmed" ${(order.status === 'confirmed' || order.status_pedido === 'confirmed') ? 'selected' : ''}>Confirmado / Pago</option>
                <option value="preparing" ${(order.status === 'preparing' || order.status_pedido === 'preparing') ? 'selected' : ''}>Em Separação no Depósito</option>
                <option value="shipped" ${(order.status === 'shipped' || order.status_pedido === 'shipped') ? 'selected' : ''}>Enviado / Em Trânsito para Entrega</option>
                <option value="delivered" ${(order.status === 'delivered' || order.status_pedido === 'delivered') ? 'selected' : ''}>Entregue com Sucesso ao Cliente</option>
                <option value="cancelled" ${(order.status === 'cancelled' || order.status_pedido === 'cancelled') ? 'selected' : ''}>Cancelado</option>
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label" style="font-size: 0.8125rem; font-weight: 700;">Observações / Notas Internas do Admin:</label>
              <textarea id="modalOrderNotesInput" class="form-textarea" rows="2" style="width: 100%; font-size: 0.8125rem;" placeholder="Ex: Código de rastreio da transportadora, confirmação de comprovante via Multicaixa, etc.">${order.admin_notes || order.notas_admin || ''}</textarea>
            </div>

            ${history.length > 0 ? `
              <div style="margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
                <span style="font-size: 0.6875rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Histórico de Alterações:</span>
                <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px; font-size: 0.75rem; color: #475569;">
                  ${history.map(h => `
                    <div>• <strong>${(h.status || '').toUpperCase()}</strong> em ${formatDate(h.timestamp)} ${h.notes ? `(${h.notes})` : ''}</div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <div class="admin-modal-footer" style="padding: 0; margin-top: 4px;">
            <button class="btn btn-secondary close-modal-btn">Fechar</button>
            <button id="saveOrderStatusBtn" class="btn btn-primary" style="padding: 10px 24px; font-weight: 800;">
              Salvar Alterações Operacionais
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
      saveBtn.innerHTML = 'Salvando no banco...';

      try {
        await Api.orders.updateStatus(order.id, newStatus, notes);
        Toast.show('Status do pedido atualizado e sincronizado com o cliente com sucesso!', 'success');
        modal.remove();
        await loadAllData();
        render();
      } catch (err) {
        Toast.show(err.message || 'Erro ao atualizar pedido.', 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Salvar Alterações Operacionais';
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
              <label class="form-label">Nome do Produto *</label>
              <input type="text" id="pName" class="form-input" value="${prod?.name || ''}" placeholder="Ex: iPhone 16 Pro Max 256GB" required />
            </div>
            <div class="form-group">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <label class="form-label" style="margin-bottom:0;">Código SKU *</label>
                <button type="button" id="btnGenSku" style="background:none; border:none; color:#2563eb; font-size:0.75rem; font-weight:700; cursor:pointer;">
                  ⚡ Gerar SKU
                </button>
              </div>
              <input type="text" id="pSku" class="form-input" value="${prod?.sku || ''}" placeholder="NV-APL-IP16-256" required />
            </div>
          </div>

          <!-- Classificação Obrigatória Sequencial: Primeiro a Categoria, e DEPOIS aparece a Subcategoria -->
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="display: flex; align-items: center; justify-content: space-between; font-weight: 700;">
                <span>1. Categoria Principal *</span>
                <span style="font-size: 0.75rem; color: #dc2626; font-weight: 600;">Obrigatório</span>
              </label>
              <select id="pCategory" class="admin-filter-select" style="width: 100%; font-weight: 600;" required>
                <option value="">Selecione primeiro a categoria...</option>
                ${categoriesList.map(c => `
                  <option value="${c.id}" ${String(prod?.category_id) === String(c.id) ? 'selected' : ''}>${c.name}</option>
                `).join('')}
              </select>
            </div>

            <!-- Este bloco fica OCULTO até que a Categoria seja selecionada -->
            <div id="pSubcategoryWrapper" style="display: none; margin-top: 14px; padding-top: 14px; border-top: 1px dashed #cbd5e1;">
              <div class="form-group" style="margin-bottom: 0;">
                <label id="pSubcategoryLabel" class="form-label" style="display: flex; align-items: center; justify-content: space-between; font-weight: 700;">
                  <span>2. Subcategoria Vinculada *</span>
                  <span style="font-size: 0.75rem; color: #dc2626; font-weight: 600;">Obrigatório</span>
                </label>
                <select id="pSubcategory" class="admin-filter-select" style="width: 100%; font-weight: 600;" required>
                  <option value="">Selecione a subcategoria...</option>
                </select>
                <div id="pSubcategoryNotice" style="margin-top: 6px; font-size: 0.75rem;"></div>
              </div>
            </div>
          </div>

          <div class="admin-form-grid-3">
            <div class="form-group">
              <label class="form-label">Marca *</label>
              <input type="text" id="pBrand" class="form-input" value="${prod?.brand || 'NovaTech'}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Preço Normal (Kz) *</label>
              <input type="number" id="pPrice" class="form-input" value="${prod?.price || ''}" placeholder="2798750" required />
            </div>
            <div class="form-group">
              <label class="form-label">Preço Promocional (Kz)</label>
              <input type="number" id="pOldPrice" class="form-input" value="${prod?.old_price || prod?.oldPrice || ''}" placeholder="3100000" />
            </div>
          </div>

          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Estoque Atual *</label>
              <input type="number" id="pStock" class="form-input" value="${prod?.stock !== undefined ? prod.stock : 10}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Estoque Mínimo *</label>
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
            <button type="submit" id="saveProductBtn" class="btn btn-primary">${isEdit ? 'Salvar Alterações' : 'Cadastrar Produto'}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const catSelect = modal.querySelector('#pCategory');
    const subWrapper = modal.querySelector('#pSubcategoryWrapper');
    const subLabel = modal.querySelector('#pSubcategoryLabel');
    const subSelect = modal.querySelector('#pSubcategory');
    const subNotice = modal.querySelector('#pSubcategoryNotice');

    function populateSubcategories(catId, preselectedSubId = null, preselectedSubName = null) {
      if (!catId) {
        // Inicialmente ou se desmarcar categoria: campo de subcategoria fica totalmente OCULTO
        subWrapper.style.display = 'none';
        subSelect.innerHTML = '<option value="">Selecione primeiro a categoria...</option>';
        subSelect.value = '';
        subNotice.innerHTML = '';
        return;
      }

      const category = categoriesList.find(c => String(c.id) === String(catId));
      if (!category) {
        subWrapper.style.display = 'none';
        return;
      }

      // APARECE o campo de subcategoria dinamicamente
      subWrapper.style.display = 'block';
      subLabel.innerHTML = `
        <span>2. Subcategoria de <strong style="color:#2563eb;">${category.name}</strong> *</span>
        <span style="font-size: 0.75rem; color: #dc2626; font-weight: 600;">Obrigatório</span>
      `;

      const subs = Array.isArray(category?.subcategories) ? category.subcategories : [];

      if (subs.length === 0) {
        subSelect.style.display = 'none';
        subSelect.value = '';
        subNotice.innerHTML = `
          <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:10px 12px;">
            <div style="color:#b91c1c; font-weight:700; font-size:0.8125rem;">⚠️ A categoria "${category.name}" não possui nenhuma subcategoria cadastrada.</div>
            <div style="font-size:0.75rem; color:#475569; margin-top:3px;">
              Como o produto exige subcategoria obrigatória, cadastre uma subcategoria para esta categoria:
            </div>
            <button type="button" id="btnQuickAddSubToCat" class="btn btn-primary btn-sm" style="margin-top:8px; font-weight:700; background:#2563eb;">
              + Cadastrar Subcategoria em ${category.name}
            </button>
          </div>
        `;
        const quickAddBtn = subNotice.querySelector('#btnQuickAddSubToCat');
        if (quickAddBtn) {
          quickAddBtn.addEventListener('click', () => {
            openSubcategoryModal({ parent_id: category.id });
          });
        }
        return;
      }

      subSelect.style.display = 'block';
      subSelect.disabled = false;
      subSelect.innerHTML = `<option value="">Selecione a subcategoria de "${category.name}"...</option>` +
        subs.map(s => {
          const isSelected = (preselectedSubId && String(s.id) === String(preselectedSubId)) ||
            (preselectedSubName && s.name.toLowerCase() === preselectedSubName.toLowerCase());
          return `<option value="${s.id}" data-name="${s.name}" ${isSelected ? 'selected' : ''}>${s.name}</option>`;
        }).join('');

      subNotice.innerHTML = `<span style="color:#15803d; font-size:0.75rem; font-weight:600;">✓ Subcategorias de "${category.name}" carregadas (${subs.length} disponíveis).</span>`;
    }

    catSelect.addEventListener('change', () => {
      populateSubcategories(catSelect.value);
    });

    if (prod?.category_id) {
      populateSubcategories(prod.category_id, prod.subcategory_id, prod.subcategory_name || prod.subcategory);
    }

    const onCategoriesUpdated = () => {
      const currentCatVal = catSelect.value;
      const currentSubVal = subSelect.value;
      catSelect.innerHTML = '<option value="">Selecione primeiro a categoria...</option>' +
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

    modal.querySelectorAll('.close-modal-btn').forEach(b => b.addEventListener('click', closeModal));
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    modal.querySelector('#productForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = modal.querySelector('#saveProductBtn');

      const nameVal = modal.querySelector('#pName').value.trim();
      const skuVal = modal.querySelector('#pSku').value.trim();
      const catVal = catSelect.value;
      const subVal = subSelect.value;

      if (!nameVal) {
        Toast.show('O nome do produto é obrigatório.', 'warning');
        modal.querySelector('#pName').focus();
        return;
      }

      if (!skuVal) {
        Toast.show('O código SKU do produto é obrigatório.', 'warning');
        modal.querySelector('#pSku').focus();
        return;
      }

      if (!catVal) {
        Toast.show('Primeiro selecione a Categoria do produto.', 'warning');
        catSelect.focus();
        return;
      }

      if (subWrapper.style.display === 'none' || !subVal || subSelect.style.display === 'none') {
        Toast.show('Selecione obrigatoriamente a Subcategoria vinculada a esta categoria.', 'warning');
        if (subSelect.style.display !== 'none') subSelect.focus();
        return;
      }

      const selectedSubOption = subSelect.options[subSelect.selectedIndex];
      const subName = selectedSubOption?.dataset?.name || selectedSubOption?.text || '';

      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando produto no banco...';

      const payload = {
        name: nameVal,
        sku: skuVal,
        brand: modal.querySelector('#pBrand').value.trim(),
        price: Number(modal.querySelector('#pPrice').value),
        old_price: modal.querySelector('#pOldPrice').value ? Number(modal.querySelector('#pOldPrice').value) : null,
        category_id: Number(catVal),
        subcategory_id: subVal,
        subcategory_name: subName,
        subcategory: subName,
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

  // 4. Modal de Categoria (Simples, Direto e Sem Ícones)
  function openCategoryModal(cat = null) {
    const isEdit = Boolean(cat);
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog" style="max-width:500px;">
        <div class="admin-modal-header">
          <h3 class="admin-modal-title">${isEdit ? 'Editar Categoria' : 'Nova Categoria'}</h3>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>

        <form id="categoryForm" class="admin-modal-body">
          <div class="form-group">
            <label class="form-label">Nome da Categoria *</label>
            <input type="text" id="catName" class="form-input" value="${cat?.name || ''}" placeholder="Ex: Smartphones, Computadores, Acessórios..." required />
          </div>

          <div class="form-group">
            <label class="form-label">Descrição (Opcional)</label>
            <textarea id="catDesc" class="form-input" rows="2" placeholder="Breve descrição dos produtos desta categoria...">${cat?.description || ''}</textarea>
          </div>

          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Ordem de Exibição (Opcional)</label>
              <input type="number" id="catOrder" class="form-input" value="${cat?.display_order !== undefined ? cat.display_order : (categoriesList.length + 1)}" min="1" />
            </div>

            <div class="form-group">
              <label class="form-label">Status *</label>
              <select id="catStatus" class="admin-filter-select" style="width:100%;">
                <option value="true" ${cat?.is_active !== false ? 'selected' : ''}>Ativa</option>
                <option value="false" ${cat?.is_active === false ? 'selected' : ''}>Inativa</option>
              </select>
            </div>
          </div>

          <div class="admin-modal-footer" style="padding: 0; margin-top: 14px;">
            <button type="button" class="btn btn-secondary close-modal-btn">Cancelar</button>
            <button type="submit" id="saveCategoryBtn" class="btn btn-primary" style="padding: 10px 24px; font-weight:700;">
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
          Toast.show('Categoria atualizada com sucesso no banco de dados!', 'success');
        } else {
          await Api.categories.create(payload);
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

  // 4.1. Modal de Subcategoria (Vinculada à Categoria Pai, Sem Ícones)
  function openSubcategoryModal({ parent_id = null, sub = null } = {}) {
    const isEdit = Boolean(sub);
    const selectedParentId = parent_id || (sub ? categoriesList.find(c => (c.subcategories || []).some(s => String(s.id) === String(sub.id)))?.id : '');

    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
      <div class="admin-modal-dialog" style="max-width:500px;">
        <div class="admin-modal-header">
          <h3 class="admin-modal-title">${isEdit ? 'Editar Subcategoria' : 'Nova Subcategoria'}</h3>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>

        <form id="subcategoryForm" class="admin-modal-body">
          <div class="form-group">
            <label class="form-label">Categoria Pai *</label>
            <select id="subParentSelect" class="admin-filter-select" style="width:100%;" required ${isEdit ? 'disabled' : ''}>
              <option value="">Selecione a categoria pai...</option>
              ${categoriesList.map(c => `
                <option value="${c.id}" ${String(c.id) === String(selectedParentId) ? 'selected' : ''}>${c.name}</option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Nome da Subcategoria *</label>
            <input type="text" id="subName" class="form-input" value="${sub?.name || ''}" placeholder="Ex: iPhones, Monitores, Carregadores..." required />
          </div>

          <div class="form-group">
            <label class="form-label">Descrição (Opcional)</label>
            <textarea id="subDesc" class="form-input" rows="2" placeholder="Breve descrição da subcategoria...">${sub?.description || ''}</textarea>
          </div>

          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Ordem de Exibição (Opcional)</label>
              <input type="number" id="subOrder" class="form-input" value="${sub?.display_order !== undefined ? sub.display_order : 1}" min="1" />
            </div>

            <div class="form-group">
              <label class="form-label">Status *</label>
              <select id="subStatus" class="admin-filter-select" style="width:100%;">
                <option value="true" ${sub?.is_active !== false ? 'selected' : ''}>Ativa</option>
                <option value="false" ${sub?.is_active === false ? 'selected' : ''}>Inativa</option>
              </select>
            </div>
          </div>

          <div class="admin-modal-footer" style="padding: 0; margin-top: 14px;">
            <button type="button" class="btn btn-secondary close-modal-btn">Cancelar</button>
            <button type="submit" id="saveSubcategoryBtn" class="btn btn-primary" style="padding: 10px 24px; font-weight:700;">
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
          Toast.show('Subcategoria atualizada com sucesso no banco de dados!', 'success');
        } else {
          await Api.categories.createSubcategory({
            parent_id: parentId,
            ...payload
          });
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

  // 6. Modal de Cupom (Criação & Edição com Validação de Datas - BUG-007, BUG-024, BUG-026)
  function openCouponModal(coupon = null) {
    const isEdit = Boolean(coupon);
    const modal = document.createElement('div');
    modal.className = 'admin-modal-overlay';
    
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
      <div class="admin-modal-dialog" style="max-width:560px;">
        <div class="admin-modal-header">
          <h3 class="admin-modal-title">${isEdit ? `Editar Cupom: ${coupon.code}` : 'Novo Cupom de Desconto'}</h3>
          <button class="btn btn-secondary btn-sm close-modal-btn">✕</button>
        </div>

        <form id="couponForm" class="admin-modal-body">
          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Código do Cupom *</label>
              <input type="text" id="cpCode" class="form-input" value="${coupon?.code || ''}" placeholder="Ex: NOVATECH10" style="text-transform:uppercase; font-weight:800;" required />
            </div>
            <div class="form-group">
              <label class="form-label">Tipo de Desconto *</label>
              <select id="cpType" class="admin-filter-select" style="width:100%;">
                <option value="percent" ${coupon?.discount_type === 'percent' ? 'selected' : ''}>Porcentagem (%)</option>
                <option value="fixed" ${coupon?.discount_type === 'fixed' ? 'selected' : ''}>Valor Fixo em Kwanzas (Kz)</option>
                <option value="free_shipping" ${coupon?.discount_type === 'free_shipping' ? 'selected' : ''}>Frete Grátis</option>
              </select>
            </div>
          </div>

          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label" id="cpValueLabel">Valor do Desconto *</label>
              <input type="number" id="cpValue" class="form-input" value="${coupon?.discount_value !== undefined ? coupon.discount_value : ''}" placeholder="Ex: 10 para 10% ou 5000 para Kz 5.000" ${coupon?.discount_type === 'free_shipping' ? 'disabled value="0"' : 'required'} />
            </div>
            <div class="form-group">
              <label class="form-label">Valor Mínimo do Pedido (Kz)</label>
              <input type="number" id="cpMinOrder" class="form-input" value="${coupon?.min_order_value || 0}" placeholder="0 = Sem mínimo" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Limite Total de Usos</label>
            <input type="number" id="cpLimit" class="form-input" value="${coupon?.usage_limit || ''}" placeholder="Vazio = Ilimitado" />
          </div>

          <div class="admin-form-grid-2">
            <div class="form-group">
              <label class="form-label">Data de Início da Validade</label>
              <input type="date" id="cpStartDate" class="form-input" value="${initialStartDate}" />
            </div>
            <div class="form-group">
              <label class="form-label">Data de Término / Expiração</label>
              <input type="date" id="cpEndDate" class="form-input" value="${initialEndDate}" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Status do Cupom</label>
            <select id="cpIsActive" class="admin-filter-select" style="width:100%;">
              <option value="true" ${coupon?.is_active !== false ? 'selected' : ''}>Ativo (Disponível para clientes)</option>
              <option value="false" ${coupon?.is_active === false ? 'selected' : ''}>Pausado / Inativo</option>
            </select>
          </div>

          <div class="admin-modal-footer" style="padding: 0; margin-top: 14px;">
            <button type="button" class="btn btn-secondary close-modal-btn">Cancelar</button>
            <button type="submit" id="saveCouponBtn" class="btn btn-primary">${isEdit ? 'Salvar Alterações' : 'Criar Cupom'}</button>
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
