// ===================================================================
// CATALOG & CATEGORY VIEW (Dynamic Filters, Sort, Search, Grid/List)
// ===================================================================

import { Icons } from '../utils/icons.js';
import { Api } from '../services/api.js';
import { createProductCard } from '../components/ProductCard.js';
import { formatPrice } from '../utils/format.js';

export function renderCatalogView({ categorySlug = null, subcategorySlug = null, searchQuery = null, isDeals = false, isNew = false } = {}) {
  const container = document.createElement('div');
  container.className = 'container';

  // State 100% Zerado (Alimentado pelo Administrador via Supabase)
  let activeProducts = [];
  let activeCategories = [];
  let currentCategory = null;
  let currentSubcategory = null; // subcategoria ativa
  let selectedBrands = [];
  let maxPrice = 6000000;
  let onlyInStock = false;
  let onlyDeals = isDeals;
  let minRating = 0;
  let sortBy = 'relevant';
  let viewMode = 'grid'; // 'grid' | 'list'
  let allBrands = [];

  async function syncFromDatabase() {
    try {
      const [realProds, realCats, realBanners] = await Promise.all([
        Api.products.getAll({
          category: categorySlug,
          search: searchQuery,
          is_deal: isDeals ? true : undefined
        }),
        Api.categories.getAll(),
        Api.banners.getActive()
      ]);

      activeCategories = realCats || [];

      // Resolve categoria ativa pelo slug
      if (categorySlug && activeCategories.length > 0) {
        currentCategory = activeCategories.find(c => c.slug === categorySlug) || null;
      }

      // Resolve subcategoria ativa pelo slug (vem de #/subcategoria/:slug ou filtro)
      if (subcategorySlug && activeCategories.length > 0) {
        for (const cat of activeCategories) {
          const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
          const found = subs.find(s => s.slug === subcategorySlug);
          if (found) {
            currentSubcategory = found;
            // Se veio por rota de subcategoria, ativa também a categoria pai
            if (!currentCategory) currentCategory = cat;
            break;
          }
        }
      }

      activeBanners = realBanners || [];

      if (realProds && realProds.length > 0) {
        activeProducts = realProds.map(p => ({
          ...p,
          oldPrice: p.old_price !== undefined ? p.old_price : p.oldPrice,
          badges: Array.isArray(p.badges) ? p.badges : (p.badges ? (typeof p.badges === 'string' ? JSON.parse(p.badges) : p.badges) : []),
          gallery: Array.isArray(p.gallery) ? p.gallery : (p.gallery ? (typeof p.gallery === 'string' ? JSON.parse(p.gallery) : p.gallery) : [p.image]),
          variants: (typeof p.variants === 'object' && p.variants !== null) ? p.variants : (p.variants ? JSON.parse(p.variants) : {}),
          specs: (typeof p.specs === 'object' && p.specs !== null) ? p.specs : (p.specs ? JSON.parse(p.specs) : {})
        }));
        allBrands = [...new Set(activeProducts.map(p => p.brand).filter(Boolean))];
      } else {
        activeProducts = [];
        allBrands = [];
      }
      render();
    } catch (e) {
      console.warn('[Catálogo] Sincronização:', e.message);
    }
  }

  syncFromDatabase();

  // Sincronização em tempo real com alterações do Admin (Produtos, Categorias, Banners e Estoque)
  const onCatalogUpdated = () => {
    syncFromDatabase();
  };
  window.addEventListener('products-updated', onCatalogUpdated);
  window.addEventListener('categories-updated', onCatalogUpdated);
  window.addEventListener('banners-updated', onCatalogUpdated);
  window.addEventListener('stock-updated', onCatalogUpdated);

  function getFilteredProducts() {
    return activeProducts.filter(product => {
      // Oculta produtos desativados pelo Admin
      if (product.is_active === false || product.ativo === false) {
        return false;
      }

      // Category filter (compara por ID numérico — mais confiável)
      if (currentCategory) {
        const prodCatId = product.category_id || product.categoria_id;
        const catMatches =
          String(prodCatId) === String(currentCategory.id) ||
          product.category === currentCategory.slug ||
          product.category === currentCategory.name;
        if (!catMatches) return false;
      }

      // Subcategory filter
      if (currentSubcategory) {
        const prodSubId = product.subcategory_id || product.subcategoria_id;
        const subMatches =
          String(prodSubId) === String(currentSubcategory.id) ||
          product.subcategory === currentSubcategory.slug ||
          product.subcategory_name === currentSubcategory.name;
        if (!subMatches) return false;
      }

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          (product.name || '').toLowerCase().includes(q) ||
          (product.brand || '').toLowerCase().includes(q) ||
          (product.category || '').toLowerCase().includes(q) ||
          (product.sku || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      // Deals filter
      if (onlyDeals && (!product.oldPrice || product.oldPrice <= product.price)) {
        return false;
      }
      // New filter
      if (isNew && (!product.badges || !product.badges.includes('NOVO'))) {
        return false;
      }
      // Brand filter
      if (selectedBrands.length > 0 && !selectedBrands.includes(product.brand)) {
        return false;
      }
      // Price filter
      if (product.price > maxPrice) {
        return false;
      }
      // In stock
      if (onlyInStock && product.stock <= 0) {
        return false;
      }
      // Rating
      if (minRating > 0 && product.rating < minRating) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'newest') return (b.badges?.includes('NOVO') ? 1 : 0) - (a.badges?.includes('NOVO') ? 1 : 0);
      return 0; // relevant
    });
  }


  // Banner institucional oficial quando o admin ainda não cadastrou banners
  const defaultInstitutionalBanner = [
    {
      id: 'banner-institutional',
      tag: 'LOJA OFICIAL',
      badge_text: 'LOJA OFICIAL',
      title: 'NovaTech Angola',
      highlight: '• TECNOLOGIA & ELETRÔNICOS EM LUANDA',
      desc: 'Smartphones, computadores e eletrônicos de alto desempenho com garantia oficial, assistência técnica especializada e entregas expressas para todo o território nacional.',
      button_text: 'Explorar Catálogo',
      button_link: '#/catalogo',
      tag_badge: 'Garantia NovaTech',
      specs_badge: 'Entregas Rápidas',
      accent_color: '#2563eb',
      image: ''
    }
  ];

  let activeFlagshipIndex = 0;
  let activeBanners = [];
  let autoplayTimer = null;
  const AUTOPLAY_INTERVAL = 5000; // 5 segundos por banner

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();
    const list = (activeBanners && activeBanners.length > 0) ? activeBanners : defaultInstitutionalBanner;
    if (list.length <= 1) return;

    autoplayTimer = setInterval(() => {
      if (!container.isConnected) {
        stopAutoplay();
        return;
      }
      const currentList = (activeBanners && activeBanners.length > 0) ? activeBanners : defaultInstitutionalBanner;
      if (currentList.length <= 1) return;
      goToSlide(activeFlagshipIndex + 1);
    }, AUTOPLAY_INTERVAL);
  }

  function goToSlide(newIndex) {
    const list = (activeBanners && activeBanners.length > 0) ? activeBanners : defaultInstitutionalBanner;
    if (!list || list.length === 0) return;

    activeFlagshipIndex = ((newIndex % list.length) + list.length) % list.length;
    const f = list[activeFlagshipIndex];

    const heroBox = container.querySelector('#heroCommercialBox');
    if (!heroBox) return;

    // Efeito suave de transição
    heroBox.classList.add('slide-transitioning');

    setTimeout(() => {
      const bannerTitle = f.title || 'NovaTech Angola';
      const bannerImg = f.image_url || f.image || '';
      const bannerLink = f.button_link || (f.slug ? `#/produto/${f.slug}` : '#/catalogo');

      const heroLink = container.querySelector('#heroLink');
      if (heroLink) {
        heroLink.href = bannerLink;
        heroLink.title = bannerTitle;
        heroLink.setAttribute('aria-label', bannerTitle);
        if (bannerImg) {
          heroLink.innerHTML = `<img src="${bannerImg}" alt="${bannerTitle}" class="hero-clean-banner-img" id="heroProductImage" />`;
        }
      }

      // Atualiza indicadores de bolinhas
      const dots = container.querySelectorAll('.hero-dot');
      dots.forEach((dot, idx) => {
        if (idx === activeFlagshipIndex) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });

      heroBox.classList.remove('slide-transitioning');
    }, 150);
  }

  function render() {
    const filtered = getFilteredProducts();
    const isHomePage = !currentCategory && !searchQuery && !isDeals && !isNew;
    const currentBannerList = (activeBanners && activeBanners.length > 0) ? activeBanners : defaultInstitutionalBanner;
    const f = currentBannerList[activeFlagshipIndex % currentBannerList.length];

    const bannerTitle = f.title || 'NovaTech Angola';
    const bannerImg = f.image_url || f.image;
    const bannerLink = f.button_link || (f.slug ? `#/produto/${f.slug}` : '#/catalogo');

    const titleText = isDeals ? 'Ofertas & Promoções da Semana' :
      isNew ? 'Lançamentos & Novidades Tecnológicas' :
        searchQuery ? `Resultados da busca por "${searchQuery}"` :
          currentCategory ? currentCategory.name : 'Catálogo Completo';

    const descText = currentCategory ? currentCategory.bannerDesc :
      isDeals ? 'Aproveite descontos especiais em smartphones, gaming e áudio por tempo limitado.' :
        searchQuery ? `Mostrando produtos que correspondem aos seus termos de pesquisa.` :
          'Explore os mais avançados aparelhos eletrônicos, computadores e gadgets disponíveis com pronta entrega em Luanda.';

    container.innerHTML = `
      ${isHomePage ? `
        <!-- Header Hero Banner (Banner Limpo Oficial: Imagem integral com link) -->
        <section class="hero-clean-banner-section" style="margin-top: 16px; margin-bottom: 28px;">
          <div class="hero-clean-banner-box" id="heroCommercialBox">
            <a href="${bannerLink}" class="hero-clean-banner-link" id="heroLink" title="${bannerTitle}" aria-label="${bannerTitle}">
              ${bannerImg ? `
                <img src="${bannerImg}" alt="${bannerTitle}" class="hero-clean-banner-img" id="heroProductImage" />
              ` : `
                <div class="hero-clean-fallback-banner">
                  <div class="hero-fallback-brand-badge">NOVATECH ANGOLA</div>
                  <h2 class="hero-fallback-title">${bannerTitle}</h2>
                  <p class="hero-fallback-sub">Tecnologia de Ponta, Smartphones e Acessórios com Entrega em Luanda</p>
                  <span class="btn btn-primary" style="margin-top: 12px; padding: 10px 24px; font-weight: 700;">Conferir Novidades →</span>
                </div>
              `}
            </a>

            <!-- Setas e Dots condicionais -->
            ${currentBannerList.length > 1 ? `
              <button class="hero-nav-arrow hero-nav-prev" id="heroPrevBtn" aria-label="Voltar para o banner anterior" title="Banner Anterior">
                ${Icons.chevronLeft(26, '#ffffff')}
              </button>
              <button class="hero-nav-arrow hero-nav-next" id="heroNextBtn" aria-label="Avançar para o próximo banner" title="Próximo Banner">
                ${Icons.chevronRight(26, '#ffffff')}
              </button>
              <div class="hero-dots-indicator" id="heroDotsIndicator">
                ${currentBannerList.map((_, idx) => `
                  <button class="hero-dot ${(idx === (activeFlagshipIndex % currentBannerList.length)) ? 'active' : ''}" data-dot-idx="${idx}" aria-label="Slide ${idx + 1}"></button>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </section>
      ` : `
        <!-- Filter Header Banner -->
        <div style="margin-top: 24px; margin-bottom: 24px; background: linear-gradient(135deg, #0b0f19 0%, #1e293b 100%); color: #ffffff; padding: 32px 28px; border-radius: var(--radius-lg); position: relative; overflow: hidden;">
          <div style="position: relative; z-index: 2; max-width: 700px;">
            <div style="font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; color: #38bdf8; letter-spacing: 0.08em; margin-bottom: 8px;">
              ${currentCategory ? 'Departamento' : isDeals ? 'Ofertas Especiais' : isNew ? 'Lançamentos' : 'Pesquisa'}
            </div>
            <h1 style="font-family: var(--font-display); font-size: 2.25rem; font-weight: 900; margin-bottom: 8px;">
              ${titleText}
            </h1>
            <p style="color: #cbd5e1; font-size: 0.9375rem; line-height: 1.5;">
              ${descText}
            </p>
          </div>
        </div>
      `}

      <!-- Mobile Filter Trigger Button -->
      <div class="mobile-filter-bar">
        <button id="mobileFilterToggleBtn" class="btn btn-secondary btn-full" style="gap: 8px;">
          ${Icons.sliders(18)}
          <span>Filtrar Produtos (${filtered.length})</span>
        </button>
      </div>

      <!-- Catalog Main Layout -->
      <div class="catalog-layout">
        <!-- Sidebar Filters -->
        <aside class="catalog-sidebar" id="catalogSidebar">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
            <span style="font-family: var(--font-display); font-size: 1.125rem; font-weight: 800; color: var(--text-main);">
              Filtros
            </span>
            <div style="display: flex; align-items: center; gap: 10px;">
              <button id="clearFiltersBtn" style="font-size: 0.75rem; color: var(--primary-600); font-weight: 700; cursor: pointer;">
                Limpar Tudo
              </button>
              <button id="closeMobileFiltersBtn" class="mobile-sidebar-close" aria-label="Fechar Filtros">
                ${Icons.close(20)}
              </button>
            </div>
          </div>

          <!-- Category Selector -->
          <div class="filter-section">
            <h4 class="filter-title">Categorias</h4>
            <div class="filter-options-list">
              <label class="filter-label">
                <span class="filter-left-inline">
                  <input type="radio" name="catRadio" value="all" ${!currentCategory ? 'checked' : ''} />
                  <span>Todas</span>
                </span>
                <span class="filter-count">(${activeProducts.length})</span>
              </label>
              ${activeCategories.length === 0 ? `
                <div style="font-size: 0.75rem; color: var(--text-muted); padding: 4px 0;">
                  Nenhuma categoria cadastrada ainda.
                </div>
              ` : activeCategories.map(c => `
                <label class="filter-label">
                  <span class="filter-left-inline">
                    <input type="radio" name="catRadio" value="${c.slug}" ${currentCategory?.slug === c.slug ? 'checked' : ''} />
                    <span>${c.name}</span>
                  </span>
                  <span class="filter-count">(${activeProducts.filter(p => String(p.category_id) === String(c.id) || p.category === c.slug).length})</span>
                </label>
              `).join('')}
            </div>
          </div>

          <!-- Subcategory Selector (quando categoria selecionada tem subcategorias) -->
          ${currentCategory && Array.isArray(currentCategory.subcategories) && currentCategory.subcategories.length > 0 ? `
            <div class="filter-section" style="padding-left: 12px; border-left: 2px solid var(--primary-200, #cbd5e1);">
              <h4 class="filter-title" style="font-size: 0.8125rem; color: var(--primary-700);">Subcategorias</h4>
              <div class="filter-options-list">
                <label class="filter-label">
                  <span class="filter-left-inline">
                    <input type="radio" name="subcatRadio" value="all" ${!currentSubcategory ? 'checked' : ''} />
                    <span>Todas de ${currentCategory.name}</span>
                  </span>
                </label>
                ${currentCategory.subcategories.map(s => `
                  <label class="filter-label">
                    <span class="filter-left-inline">
                      <input type="radio" name="subcatRadio" value="${s.slug || s.id}" ${currentSubcategory?.slug === s.slug || currentSubcategory?.id === s.id ? 'checked' : ''} />
                      <span>${s.name || s.nome}</span>
                    </span>
                    <span class="filter-count">(${activeProducts.filter(p => String(p.subcategory_id) === String(s.id) || p.subcategory === s.slug).length})</span>
                  </label>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Price Filter -->
          <div class="filter-section">
            <h4 class="filter-title">Preço Máximo</h4>
            <div style="font-family: var(--font-display); font-size: 1.125rem; font-weight: 800; color: var(--primary-700); margin-bottom: 10px;" id="priceDisplay">
              ${formatPrice(maxPrice)}
            </div>
            <input 
              type="range" 
              id="priceRangeSlider" 
              min="100000" 
              max="6000000" 
              step="50000" 
              value="${maxPrice}" 
              style="width: 100%; accent-color: var(--primary-600); cursor: pointer;" 
            />
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
              <span>Kz 100.000</span>
              <span>Kz 6.000.000</span>
            </div>
          </div>

          <!-- Brand Filter -->
          <div class="filter-section">
            <h4 class="filter-title">Marcas</h4>
            <div class="filter-options-list">
              ${allBrands.length === 0 ? `
                <div style="font-size: 0.75rem; color: var(--text-muted); padding: 4px 0;">
                  Nenhuma marca cadastrada ainda.
                </div>
              ` : allBrands.map(b => {
                const count = activeProducts.filter(p => p.brand === b).length;
                const checked = selectedBrands.includes(b);
                return `
                  <label class="filter-label">
                    <span class="filter-left-inline">
                      <input type="checkbox" class="brand-check" value="${b}" ${checked ? 'checked' : ''} />
                      <span>${b}</span>
                    </span>
                    <span class="filter-count">(${count})</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Availability & Deals -->
          <div class="filter-section">
            <h4 class="filter-title">Condição & Ofertas</h4>
            <div class="filter-options-list">
              <label class="filter-label">
                <span class="filter-left-inline">
                  <input type="checkbox" id="checkInStock" ${onlyInStock ? 'checked' : ''} />
                  <span>Apenas em Stock</span>
                </span>
              </label>
              <label class="filter-label">
                <span class="filter-left-inline">
                  <input type="checkbox" id="checkDeals" ${onlyDeals ? 'checked' : ''} />
                  <span>Apenas com Desconto</span>
                </span>
              </label>
            </div>
          </div>

          <!-- Minimum Rating -->
          <div class="filter-section">
            <h4 class="filter-title">Avaliação Mínima</h4>
            <div class="filter-options-list">
              <label class="filter-label">
                <span class="filter-left-inline">
                  <input type="radio" name="ratingRadio" value="0" ${minRating === 0 ? 'checked' : ''} />
                  <span>Todas as avaliações</span>
                </span>
              </label>
              <label class="filter-label">
                <span class="filter-left-inline">
                  <input type="radio" name="ratingRadio" value="4.8" ${minRating === 4.8 ? 'checked' : ''} />
                  <span style="color: var(--accent-amber);">★★★★★ 4.8+</span>
                </span>
              </label>
            </div>
          </div>

          <div class="mobile-sidebar-footer">
            <button id="applyMobileFiltersBtn" class="btn btn-primary btn-full">
              Aplicar Filtros (${filtered.length})
            </button>
          </div>
        </aside>

        <!-- Catalog Products Area -->
        <main>
          <!-- Controls Bar -->
          <div class="catalog-header">
            <div class="catalog-results-count">
              Mostrando <strong>${filtered.length}</strong> produtos
            </div>

            <div class="catalog-controls">
              <label style="font-size: 0.8125rem; color: var(--text-secondary); font-weight: 600;">Ordenar por:</label>
              <select class="sort-select" id="catalogSortSelect">
                <option value="relevant" ${sortBy === 'relevant' ? 'selected' : ''}>Mais Relevantes</option>
                <option value="price_asc" ${sortBy === 'price_asc' ? 'selected' : ''}>Menor Preço</option>
                <option value="price_desc" ${sortBy === 'price_desc' ? 'selected' : ''}>Maior Preço</option>
                <option value="rating" ${sortBy === 'rating' ? 'selected' : ''}>Melhor Avaliados</option>
                <option value="newest" ${sortBy === 'newest' ? 'selected' : ''}>Novidades</option>
              </select>
            </div>
          </div>

          <!-- Products Grid / Empty state Premium -->
          ${filtered.length === 0 ? `
            <div class="catalog-empty-container">
              <div class="catalog-empty-icon-wrap">
                <div class="catalog-empty-icon-bg">
                  ${Icons.package(36, '#2563eb')}
                </div>
                <span class="catalog-empty-badge">CATÁLOGO EM ATUALIZAÇÃO</span>
              </div>

              <h3 class="catalog-empty-title">
                ${activeProducts.length === 0 ? 'Novidades Tecnológicas Chegando' : 'Nenhum produto com esses filtros'}
              </h3>

              <p class="catalog-empty-desc">
                ${activeProducts.length === 0
                  ? 'Estamos atualizando o estoque com lançamentos e ofertas exclusivas de tecnologia com garantia oficial. Volte a consultar em breve.'
                  : 'Não encontramos nenhum produto que coincida com a pesquisa ou os filtros selecionados.'}
              </p>

              <div class="catalog-empty-actions">
                ${activeProducts.length === 0 ? `
                  <a href="#/" class="btn btn-primary" style="padding: 11px 24px; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; gap: 8px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    Voltar ao Início
                  </a>
                ` : `
                  <button class="btn btn-primary" id="emptyClearFiltersBtn" style="padding: 11px 24px; font-weight: 700; border-radius: 10px;">
                    Limpar Filtros e Ver Todos
                  </button>
                `}
              </div>
            </div>
          ` : `
            <div class="products-grid" id="catalogProductsGrid">
              <!-- Appended via JS -->
            </div>
          `}
        </main>
      </div>
    `;

    // Append Product Cards
    const grid = container.querySelector('#catalogProductsGrid');
    if (grid) {
      filtered.forEach(p => grid.appendChild(createProductCard(p)));
    }

    attachFilterEvents();
  }

  function attachFilterEvents() {
    // Sort Select
    const sortSelect = container.querySelector('#catalogSortSelect');
    if (sortSelect) {
      sortSelect.onchange = () => {
        sortBy = sortSelect.value;
        render();
      };
    }

    // Category Radio
    container.querySelectorAll('input[name="catRadio"]').forEach(radio => {
      radio.onchange = () => {
        currentSubcategory = null; // Reseta subcategoria ao mudar de categoria
        if (radio.value === 'all') {
          currentCategory = null;
        } else {
          currentCategory = activeCategories.find(c => c.slug === radio.value);
        }
        render();
      };
    });

    // Subcategory Radio
    container.querySelectorAll('input[name="subcatRadio"]').forEach(radio => {
      radio.onchange = () => {
        if (radio.value === 'all') {
          currentSubcategory = null;
        } else {
          const subs = currentCategory && Array.isArray(currentCategory.subcategories) ? currentCategory.subcategories : [];
          currentSubcategory = subs.find(s => s.slug === radio.value || String(s.id) === String(radio.value)) || null;
        }
        render();
      };
    });

    // Price Slider
    const priceSlider = container.querySelector('#priceRangeSlider');
    if (priceSlider) {
      priceSlider.oninput = () => {
        maxPrice = Number(priceSlider.value);
        const display = container.querySelector('#priceDisplay');
        if (display) display.textContent = formatPrice(maxPrice);
      };
      priceSlider.onchange = () => render();
    }

    // Brand Checkboxes
    container.querySelectorAll('.brand-check').forEach(cb => {
      cb.onchange = () => {
        if (cb.checked) {
          selectedBrands.push(cb.value);
        } else {
          selectedBrands = selectedBrands.filter(b => b !== cb.value);
        }
        render();
      };
    });

    // In Stock & Deals
    const stockCb = container.querySelector('#checkInStock');
    if (stockCb) {
      stockCb.onchange = () => {
        onlyInStock = stockCb.checked;
        render();
      };
    }

    const dealsCb = container.querySelector('#checkDeals');
    if (dealsCb) {
      dealsCb.onchange = () => {
        onlyDeals = dealsCb.checked;
        render();
      };
    }

    // Rating Radio
    container.querySelectorAll('input[name="ratingRadio"]').forEach(r => {
      r.onchange = () => {
        minRating = Number(r.value);
        render();
      };
    });

    // Clear Filters
    const clearBtn = container.querySelector('#clearFiltersBtn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        selectedBrands = [];
        maxPrice = 6000000;
        onlyInStock = false;
        onlyDeals = false;
        minRating = 0;
        currentCategory = null;
        currentSubcategory = null;
        render();
      };
    }

    const emptyClearBtn = container.querySelector('#emptyClearFiltersBtn');
    if (emptyClearBtn) {
      emptyClearBtn.onclick = () => {
        selectedBrands = [];
        maxPrice = 6000000;
        onlyInStock = false;
        onlyDeals = false;
        minRating = 0;
        currentCategory = null;
        currentSubcategory = null;
        render();
      };
    }

    // Mobile filter toggle & close handlers
    const mobileToggle = container.querySelector('#mobileFilterToggleBtn');
    const closeMobileFilterBtn = container.querySelector('#closeMobileFiltersBtn');
    const applyMobileFilterBtn = container.querySelector('#applyMobileFiltersBtn');
    const sidebar = container.querySelector('#catalogSidebar');
    if (mobileToggle && sidebar) {
      mobileToggle.onclick = () => {
        sidebar.classList.add('mobile-open');
        document.body.style.overflow = 'hidden';
      };
    }
    if (closeMobileFilterBtn && sidebar) {
      closeMobileFilterBtn.onclick = () => {
        sidebar.classList.remove('mobile-open');
        document.body.style.overflow = '';
      };
    }
    if (applyMobileFilterBtn && sidebar) {
      applyMobileFilterBtn.onclick = () => {
        sidebar.classList.remove('mobile-open');
        document.body.style.overflow = '';
      };
    }

    // Hero Banner navigation & Interações do Carrossel Automático
    const isHomePageNow = !currentCategory && !searchQuery && !isDeals && !isNew;
    const heroBox = container.querySelector('#heroCommercialBox');
    if (heroBox && isHomePageNow) {
      // Pausa durante o hover do mouse e retoma ao sair
      heroBox.addEventListener('mouseenter', () => stopAutoplay());
      heroBox.addEventListener('mouseleave', () => startAutoplay());

      // Setas Anterior / Próximo
      const prevBtn = container.querySelector('#heroPrevBtn');
      if (prevBtn) {
        prevBtn.onclick = (e) => {
          e.preventDefault();
          const list = (activeBanners && activeBanners.length > 0) ? activeBanners : defaultInstitutionalBanner;
          goToSlide(activeFlagshipIndex - 1);
          startAutoplay();
        };
      }

      const nextBtn = container.querySelector('#heroNextBtn');
      if (nextBtn) {
        nextBtn.onclick = (e) => {
          e.preventDefault();
          goToSlide(activeFlagshipIndex + 1);
          startAutoplay();
        };
      }

      // Indicadores de bolinhas (Dots)
      container.querySelectorAll('.hero-dot').forEach(dot => {
        dot.onclick = (e) => {
          e.preventDefault();
          goToSlide(Number(dot.dataset.dotIdx));
          startAutoplay();
        };
      });

      // Suporte a Touch Swipe no celular
      let touchStartX = 0;
      let touchEndX = 0;
      heroBox.addEventListener('touchstart', (e) => {
        stopAutoplay();
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      heroBox.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diffX = touchEndX - touchStartX;
        if (Math.abs(diffX) > 40) {
          if (diffX > 0) {
            // Arrastou para a direita -> banner anterior
            goToSlide(activeFlagshipIndex - 1);
          } else {
            // Arrastou para a esquerda -> próximo banner
            goToSlide(activeFlagshipIndex + 1);
          }
        }
        startAutoplay();
      }, { passive: true });

      // Inicia a passagem automática de slides
      startAutoplay();

      // Cancela o timer se a rota mudar para outra página
      window.addEventListener('hashchange', () => stopAutoplay(), { once: true });
    }
  }

  render();
  return container;
}
