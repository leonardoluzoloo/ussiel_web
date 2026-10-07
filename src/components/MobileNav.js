import { Icons } from '../utils/icons.js';
import { Storage } from '../services/storage.js';
import { Api } from '../services/api.js';

export function setupMobileNav() {
  let categories = [];

  async function syncCategories() {
    try {
      const realCats = await Api.categories.getAll();
      if (realCats && realCats.length > 0) {
        categories = realCats
          .filter(c => c.is_active !== false && c.ativo !== false)
          .map(c => ({
            ...c,
            iconName: c.icon_name || c.iconName || 'package',
            subcategories: Array.isArray(c.subcategories) ? c.subcategories : (c.subcategories ? (typeof c.subcategories === 'string' ? JSON.parse(c.subcategories) : c.subcategories) : [])
          }));
        renderMobileDrawer();
      }
    } catch (e) {
      console.warn('Erro ao sincronizar categorias mobile:', e.message);
    }
  }
  syncCategories();

  window.addEventListener('categories-updated', () => syncCategories());

  // 1. Mobile Bottom Bar
  const bottomBar = document.createElement('nav');
  bottomBar.className = 'mobile-bottom-bar';

  function renderBottomBar() {
    const currentHash = window.location.hash || '#/';

    if (currentHash.startsWith('#/checkout') || currentHash.startsWith('#/admin') || window.innerWidth > 768) {
      bottomBar.style.display = 'none';
      if (currentHash.startsWith('#/checkout')) document.body.classList.add('checkout-mode');
      return;
    }

    bottomBar.style.display = '';
    document.body.classList.remove('checkout-mode');

    const cartCount = Storage.getCartCount();
    const wishlistCount = Storage.getWishlist().length;

    bottomBar.innerHTML = `
      <a href="#/" class="mobile-nav-item ${currentHash === '#/' || currentHash === '' ? 'active' : ''}">
        ${Icons.home(20)}
        <span>Início</span>
      </a>
      <div class="mobile-nav-item ${currentHash.includes('/categoria') ? 'active' : ''}" id="mobileBottomCategoriesBtn" style="cursor: pointer;">
        ${Icons.grid(20)}
        <span>Categorias</span>
      </div>
      <a href="#/favoritos" class="mobile-nav-item ${currentHash.includes('/favoritos') ? 'active' : ''}">
        ${Icons.heart(20)}
        ${wishlistCount > 0 ? `<span class="mobile-nav-badge">${wishlistCount}</span>` : ''}
        <span>Favoritos</span>
      </a>
      <div class="mobile-nav-item" id="mobileBottomCartBtn">
        ${Icons.cart(22)}
        ${cartCount > 0 ? `<span class="mobile-nav-badge">${cartCount}</span>` : ''}
        <span>Carrinho</span>
      </div>
      <div class="mobile-nav-item" id="mobileBottomUserBtn">
        ${Icons.user(20)}
        <span>Conta</span>
      </div>
    `;

    const catBtn = bottomBar.querySelector('#mobileBottomCategoriesBtn');
    if (catBtn) catBtn.onclick = () => window.dispatchEvent(new CustomEvent('open-mobile-drawer'));

    const cartBtn = bottomBar.querySelector('#mobileBottomCartBtn');
    if (cartBtn) cartBtn.onclick = () => window.dispatchEvent(new CustomEvent('open-mini-cart'));

    const userBtn = bottomBar.querySelector('#mobileBottomUserBtn');
    if (userBtn) {
      userBtn.onclick = () => {
        if (Storage.getUser()) {
          window.location.hash = '/minha-conta';
        } else {
          window.location.hash = '/login';
        }
      };
    }
  }

  // 2. Mobile Drawer (Lateral Menu de Categorias)
  const drawerBackdrop = document.createElement('div');
  drawerBackdrop.className = 'drawer-backdrop';
  drawerBackdrop.id = 'mobileMenuBackdrop';

  const drawer = document.createElement('div');
  drawer.className = 'mobile-categories-drawer';
  drawer.id = 'mobileMenuDrawer';

  function renderMobileDrawer() {
    const user = Storage.getUser();

    drawer.innerHTML = `
      <!-- Header do Menu Lateral -->
      <div class="mobile-drawer-header">
        <div class="mobile-drawer-user-info" id="drawerUserProfileTrigger" style="cursor: pointer;" title="${user ? 'Minha Conta' : 'Iniciar Sessão'}">
          <div class="mobile-drawer-avatar">
            ${Icons.user(20, '#ffffff')}
          </div>
          <div class="mobile-drawer-user-text">
            <div class="mobile-drawer-user-name">${user ? user.name : 'Olá, Visitante'}</div>
            <div class="mobile-drawer-user-sub">${user ? user.email : 'Entre para acompanhar seus pedidos'}</div>
          </div>
        </div>
        <button id="closeMobileDrawerBtn" class="mobile-drawer-close-btn" aria-label="Fechar menu lateral">
          ${Icons.close(18)}
        </button>
      </div>

      <!-- Links Rápidos no Mobile (Rastrear Encomenda) -->
      <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-light); background: var(--bg-alt, #f8fafc); display: flex; flex-direction: column; gap: 8px;">
        <a href="#/pedidos" class="mobile-cat-header" style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 10px 14px; text-decoration: none; color: var(--text-main); font-weight: 700; font-size: 0.875rem;">
          <div class="mobile-cat-left">
            <span class="mobile-cat-icon" style="color: var(--primary-600);">${Icons.package(18)}</span>
            <span>Rastrear Encomendas</span>
          </div>
          <span style="font-size: 0.75rem; color: var(--primary-600); font-weight: 800;">Acompanhar →</span>
        </a>
      </div>

      <!-- Corpo: Categorias de Produtos -->
      <div class="mobile-drawer-body">
        <div class="mobile-drawer-section-label">
          <span>CATEGORIAS</span>
          <span class="mobile-drawer-count-badge">${categories.length}</span>
        </div>

        <div class="mobile-drawer-cat-list">
          ${categories.map(cat => {
            const subs = cat.subcategories || [];
            return `
            <div class="mobile-cat-item" data-cat-item="${cat.slug}">
              <div class="mobile-cat-header" data-cat-accordion="${cat.slug}">
                <div class="mobile-cat-left">
                  <span class="mobile-cat-icon">
                    ${Icons[cat.iconName] ? Icons[cat.iconName](18) : Icons.package(18)}
                  </span>
                  <span class="mobile-cat-title">${cat.name}</span>
                </div>
                <span class="mobile-cat-chevron">
                  ${Icons.chevronDown(15)}
                </span>
              </div>
              <div class="mobile-cat-sub-menu" id="sub-${cat.slug}">
                ${subs.map(sub => {
                  const subName = typeof sub === 'string' ? sub : (sub.name || sub.nome || '');
                  const subSlug = typeof sub === 'string' ? sub : (sub.uid || sub.slug || sub.name || '');
                  if (!subName) return '';
                  return `
                  <a href="#/categoria/${cat.slug || cat.uid}/${encodeURIComponent(subSlug)}" class="mobile-cat-sub-item">
                    <span>${subName}</span>
                  </a>
                  `;
                }).join('')}
                <a href="#/categoria/${cat.slug || cat.uid}" class="mobile-cat-view-all">
                  <span>Ver todos em ${cat.name}</span>
                  <span>→</span>
                </a>
              </div>
            </div>
            `;
          }).join('')}
        </div>

        <div style="padding: 12px 0 6px 0;">
          <a href="#/categorias" class="btn btn-secondary btn-full" style="justify-content: center; gap: 6px; font-weight: 700; font-size: 0.84rem; text-decoration: none;">
            <span>Ver todas as categorias</span>
            <span>→</span>
          </a>
        </div>
      </div>

      <!-- Rodapé: Apenas Iniciar Sessão / Minha Conta -->
      <div class="mobile-drawer-footer">
        ${user ? `
          <a href="#/minha-conta" class="btn btn-primary btn-full mobile-drawer-auth-btn">
            ${Icons.user(18)}
            <span>Minha Conta</span>
          </a>
          <button id="mobileDrawerLogoutBtn" class="mobile-drawer-logout-btn">
            Terminar Sessão
          </button>
        ` : `
          <a href="#/login" class="btn btn-primary btn-full mobile-drawer-auth-btn">
            ${Icons.user(18)}
            <span>Iniciar Sessão / Criar Conta</span>
          </a>
        `}
      </div>
    `;

    // Fechar botão
    const closeBtn = drawer.querySelector('#closeMobileDrawerBtn');
    if (closeBtn) closeBtn.onclick = closeDrawer;

    // Perfil no topo abre login ou conta
    const userProfileTrigger = drawer.querySelector('#drawerUserProfileTrigger');
    if (userProfileTrigger) {
      userProfileTrigger.onclick = () => {
        closeDrawer();
        if (Storage.getUser()) {
          window.location.hash = '/minha-conta';
        } else {
          window.location.hash = '/login';
        }
      };
    }

    // Accordions das categorias
    drawer.querySelectorAll('[data-cat-accordion]').forEach(trigger => {
      trigger.onclick = () => {
        const slug = trigger.dataset.catAccordion;
        const sub = drawer.querySelector(`#sub-${slug}`);
        const item = trigger.closest('.mobile-cat-item');
        if (sub && item) {
          const isOpen = item.classList.contains('open');
          // Fecha outros accordions para manter limpo e focado
          drawer.querySelectorAll('.mobile-cat-item.open').forEach(openItem => {
            if (openItem !== item) {
              openItem.classList.remove('open');
              const s = openItem.querySelector('.mobile-cat-sub-menu');
              if (s) s.style.display = 'none';
            }
          });

          if (isOpen) {
            item.classList.remove('open');
            sub.style.display = 'none';
          } else {
            item.classList.add('open');
            sub.style.display = 'flex';
          }
        }
      };
    });

    // Fechar em qualquer clique de link interno
    drawer.querySelectorAll('a').forEach(a => {
      a.onclick = closeDrawer;
    });

    // Botão de login
    const loginBtn = drawer.querySelector('#mobileDrawerLoginBtn');
    if (loginBtn) {
      loginBtn.onclick = () => {
        closeDrawer();
        window.dispatchEvent(new CustomEvent('open-auth-modal'));
      };
    }

    // Botão de logout
    const logoutBtn = drawer.querySelector('#mobileDrawerLogoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        Storage.logoutUser();
        closeDrawer();
      };
    }
  }

  function openDrawer() {
    renderMobileDrawer();
    drawerBackdrop.classList.add('active');
    drawer.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    drawerBackdrop.classList.remove('active');
    drawer.classList.remove('active');
    document.body.style.overflow = '';
  }

  drawerBackdrop.onclick = closeDrawer;

  document.body.appendChild(bottomBar);
  document.body.appendChild(drawerBackdrop);
  document.body.appendChild(drawer);

  renderBottomBar();

  // Listeners
  window.addEventListener('open-mobile-drawer', openDrawer);
  window.addEventListener('cart-updated', renderBottomBar);
  window.addEventListener('wishlist-updated', renderBottomBar);
  window.addEventListener('hashchange', renderBottomBar);
  window.addEventListener('resize', renderBottomBar);
}
