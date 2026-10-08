// ===================================================================
// SITE HEADER COMPONENT (Desktop & Mobile)
// 100% Dinâmico • Dados Reais do Supabase • Alta Performance
// ===================================================================

import { Icons } from '../utils/icons.js';
import { formatPrice } from '../utils/format.js';
import { Storage } from '../services/storage.js';
import { Api } from '../services/api.js';

export function createHeader() {
  const header = document.createElement('header');
  header.className = 'site-header';

  let dynamicCategories = [];
  let dynamicProducts = [];

  async function syncHeaderDynamicData() {
    try {
      const [cats, prods] = await Promise.all([
        Api.categories.getAll().catch(() => []),
        Api.products.getAll({ all: true }).catch(() => [])
      ]);

      const activeCats = (cats || []).filter(c => c.is_active !== false && c.ativo !== false);
      dynamicCategories = activeCats.map(c => ({
        id: c.id,
        name: c.name || c.nome || '',
        slug: c.slug || (c.name ? c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : ''),
        iconName: c.iconName || c.icon_name || c.icone || 'package',
        subcategories: (Array.isArray(c.subcategories) ? c.subcategories : (c.subcategorias ? (typeof c.subcategorias === 'string' ? JSON.parse(c.subcategorias) : c.subcategorias) : [])).filter(s => s && s.is_active !== false && s.ativo !== false)
      }));
      dynamicProducts = (prods || []).filter(p => p.is_active !== false && p.ativo !== false);
      render();
    } catch {}
  }

  // Render inicial imediato e sincronização em segundo plano
  render();
  syncHeaderDynamicData();

  function updateCartHeader() {
    const cartCount = Storage.getCartCount();
    const cartSubtotal = Storage.getCartSubtotal();

    const cartBadge = header.querySelector('#headerCartBadge');
    if (cartBadge) {
      cartBadge.textContent = cartCount;
    }

    const cartTotal = header.querySelector('#headerCartTotal');
    if (cartTotal) {
      cartTotal.textContent = formatPrice(cartSubtotal);
    }
  }

  function updateWishlistHeader() {
    const wishlistCount = Storage.getWishlist().length;
    const wishlistBadge = header.querySelector('#headerWishlistBadge');
    if (wishlistBadge) {
      wishlistBadge.textContent = wishlistCount;
    }
  }

  window.addEventListener('categories-updated', () => syncHeaderDynamicData());
  window.addEventListener('products-updated', () => syncHeaderDynamicData());
  window.addEventListener('cart-updated', updateCartHeader);
  window.addEventListener('wishlist-updated', updateWishlistHeader);
  window.addEventListener('user-updated', () => render());
  window.addEventListener('hashchange', () => {
    updateCartHeader();
    updateWishlistHeader();
  });

  function render() {
    const cartCount = Storage.getCartCount();
    const cartSubtotal = Storage.getCartSubtotal();
    const wishlistCount = Storage.getWishlist().length;
    const user = Storage.getUser();
    const adminUser = Storage.getAdminUser ? Storage.getAdminUser() : null;
    const isLoggedAdmin = adminUser || (user && (user.role === 'admin' || user.nivel_acesso === 'admin'));

    header.innerHTML = `
      <!-- 1. Top Promo Bar -->
      <div class="top-bar">
        <div class="container top-bar-inner">
          <div class="top-bar-left">
            <span class="top-badge">ENTREGAS RÁPIDAS</span>
            <span>Entregas em Luanda em 24–48h • Enviamos para todo o país</span>
          </div>
          <div class="top-bar-right">
            ${isLoggedAdmin ? `
              <a href="#/admin" class="top-link" style="color: #38bdf8; font-weight: 700; background: rgba(56,189,248,0.12); padding: 2px 8px; border-radius: 4px;" title="Ir para Painel Administrativo">
                ⚡ Painel Administrativo
              </a>
            ` : ''}
            <a href="https://wa.me/244923179192" target="_blank" class="top-link">
              ${Icons.whatsapp(14, '#25d366')}
              <span>WhatsApp: +244 923 179 192</span>
            </a>
            <a href="#/minha-conta/pedidos" class="top-link">
              ${Icons.package(14)}
              <span>Rastrear Pedido</span>
            </a>
          </div>
        </div>
      </div>

      <!-- 2. Main Header -->
      <div class="main-header">
        <div class="container main-header-inner">
          <div class="brand-group">
            <!-- Mobile Menu Toggle -->
            <button id="mobileMenuOpenBtn" class="mobile-only-btn" aria-label="Abrir menu">
              ${Icons.menu(24)}
            </button>

            <!-- Logo -->
            <a href="#/" class="brand-logo">
              <div class="brand-icon-box">
                ${Icons.cpu(24, '#ffffff')}
              </div>
              <div class="brand-text">
                <span class="brand-name">NOVA<span>TECH</span></span>
                <span class="brand-tagline">Tecnologia & Eletrônicos</span>
              </div>
            </a>
          </div>

          <!-- Big Search Bar -->
          <div class="search-container">
            <form class="search-form" id="globalSearchForm" onsubmit="event.preventDefault();">
              <span class="search-icon-left">${Icons.search(18)}</span>
              <input 
                type="text" 
                id="globalSearchInput" 
                class="search-input" 
                placeholder="Pesquisar produtos, marcas..." 
                autocomplete="off"
              />
              <button type="submit" class="search-btn-submit" id="globalSearchSubmit">
                <span>Buscar</span>
              </button>
            </form>

            <!-- Autocomplete Dropdown -->
            <div class="search-dropdown" id="searchDropdown"></div>
          </div>

          <!-- Header Actions -->
          <div class="header-actions">
            <!-- Account -->
            <div class="header-action-btn" id="headerUserBtn" style="cursor: pointer;">
              <div class="action-icon-wrap">
                ${Icons.user(22)}
              </div>
              <div class="action-text-group">
                <span class="action-label-small">${user ? `Olá, ${user.name.split(' ')[0]}` : 'Bem-vindo'}</span>
                <span class="action-label-strong">${user ? (isLoggedAdmin ? 'Painel Gestor' : 'Minha Conta') : 'Entrar / Criar'}</span>
              </div>
            </div>

            <!-- Wishlist -->
            <a href="#/favoritos" class="header-action-btn" title="Meus Favoritos">
              <div class="action-icon-wrap">
                ${Icons.heart(22)}
                <span class="action-badge" id="headerWishlistBadge">${wishlistCount}</span>
              </div>
            </a>

            <!-- Cart -->
            <a href="#/carrinho" class="header-action-btn header-cart-highlight" id="headerCartBtn" style="cursor: pointer; text-decoration: none;" title="Ver Carrinho">
              <div class="action-icon-wrap">
                ${Icons.cart(22, 'currentColor')}
                <span class="action-badge badge-cart" id="headerCartBadge">${cartCount}</span>
              </div>
            </a>
          </div>
        </div>
      </div>

      <!-- 3. Horizontal Navigation Bar -->
      <nav class="nav-bar">
        <div class="container nav-bar-inner">
          <ul class="nav-menu">
            <li class="nav-item">
              <a href="#/" class="nav-link">INÍCIO</a>
            </li>
            <li class="nav-item">
              <a href="#/novidades" class="nav-link">NOVIDADES</a>
            </li>
            <li class="nav-item" id="navCategoriesItem">
              <a href="#/categorias" class="nav-link nav-link-special" id="navCategoriesToggle">
                ${Icons.grid(18)}
                <span>CATEGORIAS</span>
                ${Icons.chevronDown(14)}
              </a>

              <!-- Dropdown com Categorias Reais do Supabase -->
              <div class="mega-menu" id="megaMenu">
                <div class="container mega-menu-container" style="max-width: 900px; padding: 20px 24px;">
                  <div class="mega-menu-grid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px 28px;">
                    ${dynamicCategories.length === 0 ? `
                      <div class="mega-col" style="grid-column: 1 / -1; padding: 12px 0; color: #64748b;">
                        Nenhuma categoria cadastrada no momento.
                      </div>
                    ` : dynamicCategories.map(cat => {
                      const subs = cat.subcategories || [];
                      const catSlug = cat.slug || cat.id;
                      return `
                        <div class="mega-col">
                          <div class="mega-col-header" style="margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1.5px solid #e2e8f0;">
                            <a href="#/categoria/${catSlug}" class="mega-col-title-link" style="font-weight: 800; font-size: 0.85rem; color: #0f172a;">
                              <span class="mega-icon">${Icons[cat.iconName] ? Icons[cat.iconName](16) : Icons.package(16)}</span>
                              <span class="mega-title-text">${cat.name.toUpperCase()}</span>
                            </a>
                          </div>
                          ${subs.length > 0 ? `
                            <ul class="mega-sublist" style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px;">
                              ${subs.map(sub => {
                                const subName = typeof sub === 'string' ? sub : (sub.name || sub.nome || '');
                                const subSlug = typeof sub === 'string' ? sub : (sub.slug || sub.uid || sub.name || '');
                                if (!subName) return '';
                                return `
                                  <li class="mega-subitem">
                                    <a href="#/categoria/${catSlug}/${encodeURIComponent(subSlug)}" class="mega-sublink" style="font-size: 0.825rem; color: #475569; padding: 2px 0; display: block;">
                                      ${subName}
                                    </a>
                                  </li>
                                `;
                              }).join('')}
                            </ul>
                          ` : ''}
                        </div>
                      `;
                    }).join('')}
                  </div>
                  
                  <div class="mega-menu-footer" style="margin-top: 16px; padding-top: 10px; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end;">
                    <a href="#/categorias" class="mega-view-all-link" style="font-size: 0.825rem; font-weight: 700; color: #2563eb;">
                      <span>Ver todas as categorias</span>
                      <span>→</span>
                    </a>
                  </div>
                </div>
              </div>
            </li>
            <li class="nav-item">
              <a href="#/ofertas" class="nav-link" style="color: #fb923c;">
                <span>OFERTAS</span>
                <span class="nav-badge-pill">HOT</span>
              </a>
            </li>
            <li class="nav-item">
              <a href="#/contacto" class="nav-link">CONTACTO</a>
            </li>
          </ul>

          <div class="nav-right-help">
            ${Icons.phone(16, '#38bdf8')}
            <span>Atendimento: <strong>+244 923 179 192</strong></span>
          </div>
        </div>
      </nav>
    `;

    attachHeaderEvents();
  }

  function attachHeaderEvents() {
    // Cart open -> Navega direto para o carrinho completo
    const cartBtn = header.querySelector('#headerCartBtn');
    if (cartBtn) {
      cartBtn.onclick = () => { window.location.hash = '/carrinho'; };
    }

    // Account click
    const userBtn = header.querySelector('#headerUserBtn');
    if (userBtn) {
      userBtn.onclick = () => {
        const adminUser = Storage.getAdminUser ? Storage.getAdminUser() : null;
        const generalUser = Storage.getUser();
        if (adminUser || generalUser?.role === 'admin') {
          window.location.hash = '/admin';
        } else if (generalUser) {
          window.location.hash = '/minha-conta';
        } else {
          window.location.hash = '/login';
        }
      };
    }

    // Mega Menu Hover / Toggle / Close on click
    const navCategoriesItem = header.querySelector('#navCategoriesItem');
    const megaMenu = header.querySelector('#megaMenu');
    if (navCategoriesItem && megaMenu) {
      let closeTimeout = null;

      navCategoriesItem.onmouseenter = () => {
        if (closeTimeout) clearTimeout(closeTimeout);
        megaMenu.classList.add('active');
      };

      navCategoriesItem.onmouseleave = () => {
        closeTimeout = setTimeout(() => {
          megaMenu.classList.remove('active');
        }, 120);
      };

      // Fecha imediatamente ao clicar em qualquer link
      navCategoriesItem.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
          megaMenu.classList.remove('active');
        });
      });

      // Fecha ao clicar fora
      document.addEventListener('click', (e) => {
        if (!navCategoriesItem.contains(e.target)) {
          megaMenu.classList.remove('active');
        }
      });
    }

    // Search Autocomplete
    setupSearchAutocomplete();

    // Mobile menu open
    const mobileBtn = header.querySelector('#mobileMenuOpenBtn');
    if (mobileBtn) {
      mobileBtn.onclick = () => window.dispatchEvent(new CustomEvent('open-mobile-drawer'));
    }
  }

  function setupSearchAutocomplete() {
    const input = header.querySelector('#globalSearchInput');
    const dropdown = header.querySelector('#searchDropdown');
    const form = header.querySelector('#globalSearchForm');

    if (!input || !dropdown) return;

    function renderDropdown(query = '') {
      const recent = Storage.getRecentSearches();
      const q = query.trim().toLowerCase();

      if (!q) {
        if (recent.length === 0) {
          dropdown.classList.remove('active');
          return;
        }

        dropdown.innerHTML = `
          <div class="search-section-title">
            <span>Buscas Recentes</span>
            <button type="button" class="search-clear-recent" id="clearRecentSearchesBtn">Limpar</button>
          </div>
          <div class="search-recent-list">
            ${recent.map(term => `
              <div class="search-recent-item" data-search="${term}">
                <div class="recent-left">
                  ${Icons.clock(14)}
                  <span>${term}</span>
                </div>
                <button type="button" class="recent-remove-btn" data-remove="${term}">
                  ${Icons.close(12)}
                </button>
              </div>
            `).join('')}
          </div>
        `;
        dropdown.classList.add('active');
        attachDropdownEvents();
        return;
      }

      // Filter products & categories
      const matchedProducts = dynamicProducts.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q)
      ).slice(0, 4);

      const matchedCategories = dynamicCategories.filter(c =>
        (c.name || '').toLowerCase().includes(q)
      ).slice(0, 2);

      if (matchedProducts.length === 0 && matchedCategories.length === 0) {
        dropdown.innerHTML = `
          <div class="search-empty-state">
            <p>Nenhum produto encontrado para "<strong>${query}</strong>"</p>
          </div>
        `;
        dropdown.classList.add('active');
        return;
      }

      let html = '';

      if (matchedCategories.length > 0) {
        html += `
          <div class="search-section-title">Categorias</div>
          <div class="search-cats-list">
            ${matchedCategories.map(c => `
              <a href="#/categoria/${c.slug}" class="search-cat-item">
                ${Icons.grid(14)}
                <span>${c.name}</span>
              </a>
            `).join('')}
          </div>
        `;
      }

      if (matchedProducts.length > 0) {
        html += `
          <div class="search-section-title">Produtos Sugeridos</div>
          <div class="search-prods-list">
            ${matchedProducts.map(p => `
              <a href="#/produto/${p.slug || p.id}" class="search-prod-item">
                <img src="${p.image || (Array.isArray(p.gallery) ? p.gallery[0] : '')}" alt="${p.name}" class="search-prod-thumb" onerror="this.style.display='none'" />
                <div class="search-prod-info">
                  <span class="search-prod-name">${p.name}</span>
                  <span class="search-prod-price">${formatPrice(p.price)}</span>
                </div>
              </a>
            `).join('')}
          </div>
        `;
      }

      html += `
        <a href="#/catalogo?q=${encodeURIComponent(query)}" class="search-view-all-link">
          Ver todos os resultados para "${query}" →
        </a>
      `;

      dropdown.innerHTML = html;
      dropdown.classList.add('active');
      attachDropdownEvents();
    }

    function attachDropdownEvents() {
      dropdown.querySelectorAll('.search-recent-item').forEach(item => {
        item.onclick = (e) => {
          if (e.target.closest('.recent-remove-btn')) return;
          const term = item.dataset.search;
          input.value = term;
          dropdown.classList.remove('active');
          window.location.hash = `#/catalogo?q=${encodeURIComponent(term)}`;
        };
      });

      dropdown.querySelectorAll('.recent-remove-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const term = btn.dataset.remove;
          Storage.removeRecentSearch(term);
          renderDropdown(input.value);
        };
      });

      const clearBtn = dropdown.querySelector('#clearRecentSearchesBtn');
      if (clearBtn) {
        clearBtn.onclick = (e) => {
          e.stopPropagation();
          Storage.clearRecentSearches();
          dropdown.classList.remove('active');
        };
      }
    }

    input.oninput = () => renderDropdown(input.value);
    input.onfocus = () => renderDropdown(input.value);

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });

    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const query = input.value.trim();
        if (query) {
          Storage.addRecentSearch(query);
          dropdown.classList.remove('active');
          window.location.hash = `#/catalogo?q=${encodeURIComponent(query)}`;
        }
      };
    }
  }

  return header;
}
