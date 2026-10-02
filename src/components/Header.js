// ===================================================================
// SITE HEADER COMPONENT (Desktop & Mobile)
// ===================================================================

import { Icons } from '../utils/icons.js';
import { formatPrice } from '../utils/format.js';
import { CategoriesData } from '../data/categories.js';
import { ProductsData } from '../data/products.js';
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

      dynamicCategories = (cats || [])
        .filter(c => c.is_active !== false && c.ativo !== false)
        .map(c => ({
          ...c,
          iconName: c.icon_name || c.iconName || 'package',
          subcategories: Array.isArray(c.subcategories) ? c.subcategories : (c.subcategories ? (typeof c.subcategories === 'string' ? JSON.parse(c.subcategories) : c.subcategories) : [])
        }));
      dynamicProducts = (prods || []).filter(p => p.is_active !== false && p.ativo !== false);
      render();
    } catch {}
  }

  syncHeaderDynamicData();

  window.addEventListener('categories-updated', () => syncHeaderDynamicData());
  window.addEventListener('products-updated', () => syncHeaderDynamicData());

  function render() {
    const cartCount = Storage.getCartCount();
    const cartSubtotal = Storage.getCartSubtotal();
    const wishlistCount = Storage.getWishlist().length;
    const user = Storage.getUser();

    header.innerHTML = `
      <!-- 1. Top Promo Bar -->
      <div class="top-bar">
        <div class="container top-bar-inner">
          <div class="top-bar-left">
            <span class="top-badge">ENTREGAS RÁPIDAS</span>
            <span>Entregas expressas em Luanda em 24h-48h | Todo território nacional</span>
          </div>
          <div class="top-bar-right">
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
            <div class="search-dropdown" id="searchDropdown">
              <!-- Content rendered dynamically -->
            </div>
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
                <span class="action-label-strong">${user ? 'Minha Conta' : 'Entrar / Criar'}</span>
              </div>
            </div>

            <!-- Wishlist -->
            <a href="#/favoritos" class="header-action-btn" title="Meus Favoritos">
              <div class="action-icon-wrap">
                ${Icons.heart(22)}
                <span class="action-badge" id="headerWishlistBadge">${wishlistCount}</span>
              </div>
              <div class="action-text-group" style="display: none;">
                <span class="action-label-small">Favoritos</span>
                <span class="action-label-strong">${wishlistCount} itens</span>
              </div>
            </a>

            <!-- Cart (Super Visível) -->
            <div class="header-action-btn header-cart-highlight" id="headerCartBtn" style="cursor: pointer;" title="Abrir Meu Carrinho">
              <div class="action-icon-wrap">
                ${Icons.cart(28)}
                <span class="action-badge badge-cart" id="headerCartBadge">${cartCount}</span>
              </div>
              <div class="action-text-group">
                <span class="action-label-small">Meu Carrinho</span>
                <span class="action-label-strong" id="headerCartTotal">${formatPrice(cartSubtotal)}</span>
              </div>
            </div>
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
              <div class="nav-link nav-link-special" id="navCategoriesToggle">
                ${Icons.grid(18)}
                <span>CATEGORIAS</span>
                ${Icons.chevronDown(14)}
              </div>

              <!-- Mega Menu Dropdown -->
              <div class="mega-menu" id="megaMenu">
                <div class="container">
                  <div class="mega-menu-grid">
                    ${dynamicCategories.length === 0 ? `
                      <div class="mega-col" style="grid-column: span 3; padding: 20px 0;">
                        <div style="color: var(--text-secondary); font-size: 0.875rem;">
                          Nenhuma categoria disponível no momento. Novidades em breve!
                        </div>
                      </div>
                    ` : dynamicCategories.slice(0, 4).map(cat => `
                      <div class="mega-col">
                        <div class="mega-col-title">
                          <span class="mega-icon">${Icons[cat.iconName] ? Icons[cat.iconName](18) : Icons.package(18)}</span>
                          <a href="#/categoria/${cat.slug}">${cat.name}</a>
                        </div>
                        <ul class="mega-sublist">
                          ${(cat.subcategories || []).map(sub => `
                            <li>
                              <a href="#/?cat=${cat.slug}&sub=${encodeURIComponent(sub)}" class="mega-sublink">
                                <span>${sub}</span>
                              </a>
                            </li>
                          `).join('')}
                        </ul>
                      </div>
                    `).join('')}

                    <!-- Mega Menu Info Box -->
                    <div class="mega-promo-box">
                      <div>
                        <span class="mega-promo-badge">ATENDIMENTO DEDICADO</span>
                        <h4 class="mega-promo-title">Suporte ao Cliente Luanda</h4>
                        <p class="mega-promo-desc">Tire dúvidas sobre especificações técnicas, garantias ou cotações empresariais diretamente com nossos consultores.</p>
                      </div>
                      <a href="https://wa.me/244923179192" target="_blank" class="btn-mega-promo">
                        Falar no WhatsApp
                      </a>
                    </div>
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
              <a href="#/blog" class="nav-link">BLOG</a>
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
    // Cart open
    const cartBtn = header.querySelector('#headerCartBtn');
    if (cartBtn) {
      cartBtn.onclick = () => window.dispatchEvent(new CustomEvent('open-mini-cart'));
    }

    // Account click
    const userBtn = header.querySelector('#headerUserBtn');
    if (userBtn) {
      userBtn.onclick = () => {
        const user = Storage.getUser();
        if (user) {
          window.location.hash = '/minha-conta';
        } else {
          window.location.hash = '/login';
        }
      };
    }

    // Mega Menu Hover / Toggle
    const navCategoriesItem = header.querySelector('#navCategoriesItem');
    const megaMenu = header.querySelector('#megaMenu');
    if (navCategoriesItem && megaMenu) {
      navCategoriesItem.onmouseenter = () => megaMenu.classList.add('active');
      navCategoriesItem.onmouseleave = () => megaMenu.classList.remove('active');
      const toggle = header.querySelector('#navCategoriesToggle');
      if (toggle) {
        toggle.onclick = (e) => {
          e.stopPropagation();
          megaMenu.classList.toggle('active');
        };
      }
    }

    // Search Autocomplete functionality
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
        // Show recent searches and popular categories
        dropdown.innerHTML = `
          <div class="search-dropdown-section">
            <div class="search-dropdown-title">
              <span>Pesquisas Recentes</span>
            </div>
            <div class="search-chips">
              ${recent.map(term => `<span class="search-chip" data-search-term="${term}">${term}</span>`).join('')}
            </div>
          </div>
          <div class="search-dropdown-section">
            <div class="search-dropdown-title">
              <span>Categorias Populares</span>
            </div>
            <div class="search-chips">
              ${dynamicCategories.slice(0, 6).map(c => `<span class="search-chip" data-cat-slug="${c.slug}">${c.name}</span>`).join('')}
            </div>
          </div>
        `;
      } else {
        // Find matching products
        const matches = dynamicProducts.filter(p =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.category && String(p.category).toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q))
        ).slice(0, 5);

        if (matches.length === 0) {
          dropdown.innerHTML = `
            <div class="search-dropdown-section" style="text-align: center; color: var(--text-muted); padding: 24px 16px;">
              <p>Nenhum produto encontrado para "<strong>${query}</strong>"</p>
              <button class="btn btn-secondary" style="margin-top: 10px; font-size: 0.8125rem;" id="seeAllCatalogBtn">
                Ver Todo o Catálogo
              </button>
            </div>
          `;
          const allBtn = dropdown.querySelector('#seeAllCatalogBtn');
          if (allBtn) {
            allBtn.onclick = () => {
              dropdown.classList.remove('active');
              window.location.hash = '/';
            };
          }
        } else {
          dropdown.innerHTML = `
            <div class="search-dropdown-section">
              <div class="search-dropdown-title">
                <span>Produtos Encontrados (${matches.length})</span>
              </div>
              <div class="search-results-list">
                ${matches.map(p => `
                  <div class="search-result-item" data-product-slug="${p.slug}">
                    <img src="${p.image}" alt="${p.name}" class="search-result-img" />
                    <div class="search-result-info">
                      <div class="search-result-name">${p.name}</div>
                      <div class="search-result-price">${formatPrice(p.price)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="search-dropdown-section" style="background: #f8fafc; text-align: center;">
              <span class="search-chip" id="seeAllSearchMatches" style="background: #ffffff; border: 1px solid var(--border-light); font-weight: 600;">
                Ver todos os resultados para "${query}" →
              </span>
            </div>
          `;

          dropdown.querySelectorAll('[data-product-slug]').forEach(item => {
            item.onclick = () => {
              Storage.addRecentSearch(query);
              dropdown.classList.remove('active');
              input.value = '';
              window.location.hash = `/produto/${item.dataset.productSlug}`;
            };
          });

          const seeAllBtn = dropdown.querySelector('#seeAllSearchMatches');
          if (seeAllBtn) {
            seeAllBtn.onclick = () => {
              Storage.addRecentSearch(query);
              dropdown.classList.remove('active');
              window.location.hash = `/?q=${encodeURIComponent(query)}`;
            };
          }
        }
      }

      dropdown.querySelectorAll('[data-search-term]').forEach(chip => {
        chip.onclick = () => {
          input.value = chip.dataset.searchTerm;
          dropdown.classList.remove('active');
          window.location.hash = `/?q=${encodeURIComponent(chip.dataset.searchTerm)}`;
        };
      });

      dropdown.querySelectorAll('[data-cat-slug]').forEach(chip => {
        chip.onclick = () => {
          dropdown.classList.remove('active');
          window.location.hash = `/categoria/${chip.dataset.catSlug}`;
        };
      });

      dropdown.classList.add('active');
    }

    input.onfocus = () => renderDropdown(input.value);
    input.oninput = () => renderDropdown(input.value);

    // Form submit
    form.onsubmit = (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (val) {
        Storage.addRecentSearch(val);
        dropdown.classList.remove('active');
        window.location.hash = `/?q=${encodeURIComponent(val)}`;
      }
    };

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });
  }

  // Reactive listeners
  window.addEventListener('cart-updated', () => {
    const badge = header.querySelector('#headerCartBadge');
    const total = header.querySelector('#headerCartTotal');
    if (badge) badge.textContent = Storage.getCartCount();
    if (total) total.textContent = formatPrice(Storage.getCartSubtotal());
  });

  window.addEventListener('wishlist-updated', () => {
    const badge = header.querySelector('#headerWishlistBadge');
    if (badge) badge.textContent = Storage.getWishlist().length;
  });

  window.addEventListener('user-updated', () => {
    render();
  });

  render();
  return header;
}
