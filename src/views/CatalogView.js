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

  // Pré-carregamento imediato do cache local persistente para eliminar qualquer flash ou layout shift no F5
  const getCachedList = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {}
    return [];
  };

  const cachedBanners = getCachedList('novatech_admin_banners_v4_clean').filter(b => b.is_active !== false && (b.image_url || b.image));
  const cachedProds = getCachedList('novatech_admin_produtos_v4_clean').filter(p => p.is_active !== false);
  const cachedCats = getCachedList('novatech_admin_categorias_v4_clean').filter(c => c.is_active !== false);

  let activeProducts = cachedProds.map(p => ({
    ...p,
    oldPrice: p.old_price !== undefined ? p.old_price : p.oldPrice,
    badges: Array.isArray(p.badges) ? p.badges : (p.badges ? (typeof p.badges === 'string' ? JSON.parse(p.badges) : p.badges) : []),
    gallery: Array.isArray(p.gallery) ? p.gallery : (p.gallery ? (typeof p.gallery === 'string' ? JSON.parse(p.gallery) : p.gallery) : [p.image]),
    variants: (typeof p.variants === 'object' && p.variants !== null) ? p.variants : (p.variants ? JSON.parse(p.variants) : {}),
    specs: (typeof p.specs === 'object' && p.specs !== null) ? p.specs : (p.specs ? JSON.parse(p.specs) : {})
  }));
  let activeCategories = cachedCats;
  let activeBanners = cachedBanners;
  let isDatabaseLoaded = false;

  let currentCategory = null;
  let currentSubcategory = null; // subcategoria ativa
  let expandedCategoryIds = new Set(); // controle de categorias expandidas
  let selectedBrands = [];
  let maxPrice = 6000000;
  let onlyInStock = false;
  let onlyDeals = isDeals;
  let minRating = 0;
  let sortBy = 'relevant';
  let viewMode = 'grid'; // 'grid' | 'list'
  let allBrands = [...new Set(activeProducts.map(p => p.brand).filter(Boolean))];

  // Pré-resolve categoria pelo slug imediatamente se já estiver em cache
  if (categorySlug && activeCategories.length > 0) {
    currentCategory = activeCategories.find(c => c.slug === categorySlug) || null;
    if (currentCategory) expandedCategoryIds.add(currentCategory.id);
  }

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

      isDatabaseLoaded = true;
      activeCategories = realCats || [];

      // Resolve categoria ativa pelo slug
      if (categorySlug && activeCategories.length > 0) {
        currentCategory = activeCategories.find(c => c.slug === categorySlug) || null;
        if (currentCategory) expandedCategoryIds.add(currentCategory.id);
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
            if (cat) expandedCategoryIds.add(cat.id);
            break;
          }
        }
      }

      activeBanners = (realBanners && realBanners.length > 0) ? realBanners : activeBanners;

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
      } else if (isDatabaseLoaded && (!realProds || realProds.length === 0)) {
        activeProducts = [];
        allBrands = [];
      }
      render();
    } catch (e) {
      console.warn('[Catálogo] Sincronização:', e.message);
      isDatabaseLoaded = true;
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
      const hasActiveBanners = activeBanners && activeBanners.length > 0;
      const currentList = hasActiveBanners ? activeBanners : (isDatabaseLoaded ? defaultInstitutionalBanner : []);
      if (currentList.length <= 1) return;
      goToSlide(activeFlagshipIndex + 1);
    }, AUTOPLAY_INTERVAL);
  }

  function goToSlide(newIndex) {
    const hasActiveBanners = activeBanners && activeBanners.length > 0;
    const list = hasActiveBanners ? activeBanners : (isDatabaseLoaded ? defaultInstitutionalBanner : []);
    if (!list || list.length === 0) return;

    activeFlagshipIndex = ((newIndex % list.length) + list.length) % list.length;
    const f = list[activeFlagshipIndex];

    const heroBox = container.querySelector('#heroCommercialBox');
    if (!heroBox) return;

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
      } else {
        heroLink.innerHTML = `
          <div class="hero-clean-fallback-banner">
            <div class="hero-fallback-brand-badge">NOVATECH ANGOLA</div>
            <h2 class="hero-fallback-title">${bannerTitle}</h2>
            <p class="hero-fallback-sub">Tecnologia de Ponta, Smartphones e Acessórios com Entrega em Luanda</p>
            <span class="btn btn-primary" style="margin-top: 12px; padding: 10px 24px; font-weight: 700;">Conferir Novidades →</span>
          </div>
        `;
      }
    }

    // Atualiza indicadores de bolinhas
    const dots = container.querySelectorAll('.hero-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === activeFlagshipIndex);
    });
  }

  function render() {
    const filtered = getFilteredProducts();
    const isHomePage = !currentCategory && !searchQuery && !isDeals && !isNew;
    const hasActiveBanners = activeBanners && activeBanners.length > 0;
    const currentBannerList = hasActiveBanners ? activeBanners : (isDatabaseLoaded ? defaultInstitutionalBanner : []);
    const f = currentBannerList.length > 0 ? currentBannerList[activeFlagshipIndex % currentBannerList.length] : null;

    const bannerTitle = f?.title || 'NovaTech Angola';
    const bannerImg = f ? (f.image_url || f.image) : '';
    const bannerLink = f ? (f.button_link || (f.slug ? `#/produto/${f.slug}` : '#/catalogo')) : '#/catalogo';

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
            ${f ? `
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
            ` : `
              <div class="hero-clean-banner-skeleton" style="width: 100%; height: 320px; background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%); background-size: 200% 100%; animation: adminShimmer 1.5s infinite; border-radius: 16px;"></div>
            `}

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
        <div style="margin-top: 20px; margin-bottom: 24px; background: linear-gradient(135deg, #090d16 0%, #1e293b 100%); color: #ffffff; padding: 28px 32px; border-radius: var(--radius-lg); position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
          <div style="position: absolute; right: -20px; bottom: -20px; opacity: 0.08; color: #ffffff; pointer-events: none;">
            ${Icons.package(180)}
          </div>
          <div style="position: relative; z-index: 2; max-width: 700px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
              <span style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #38bdf8; letter-spacing: 0.1em; background: rgba(56, 189, 248, 0.15); padding: 4px 10px; border-radius: 9999px;">
                ${currentCategory ? 'Departamento Oficial' : isDeals ? 'Ofertas Especiais' : isNew ? 'Lançamentos' : 'Catálogo'}
              </span>
              ${currentSubcategory ? `<span style="color: #94a3b8; font-size: 0.8125rem;">/ ${currentSubcategory.name || currentSubcategory.nome}</span>` : ''}
            </div>
            <h1 style="font-family: var(--font-display); font-size: 2.25rem; font-weight: 900; margin-bottom: 8px; letter-spacing: -0.02em;">
              ${titleText}
            </h1>
            <p style="color: #cbd5e1; font-size: 0.9375rem; line-height: 1.5; margin: 0;">
              ${descText || `Explore todos os produtos originais de alta tecnologia da linha ${titleText} com pronta entrega em Luanda.`}
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

          <!-- Category Selector (Com suporte a expandir/recolher subcategorias e scroll limitado) -->
          <div class="filter-section">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
              <h4 class="filter-title" style="margin: 0;">Categorias</h4>
              <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${activeCategories.length} disponíveis</span>
            </div>
            <div class="filter-options-list" style="max-height: 380px; overflow-y: auto; padding-right: 4px;">
              <label class="filter-label" style="cursor: pointer;">
                <span class="filter-left-inline">
                  <input type="radio" name="catRadio" value="all" ${!currentCategory ? 'checked' : ''} />
                  <span style="font-weight: ${!currentCategory ? '700' : '500'};">Todas as Categorias</span>
                </span>
                <span class="filter-count">(${activeProducts.length})</span>
              </label>

              ${activeCategories.length === 0 ? `
                <div style="font-size: 0.75rem; color: var(--text-muted); padding: 4px 0;">
                  Nenhuma categoria cadastrada ainda.
                </div>
              ` : activeCategories.map(c => {
                const subs = Array.isArray(c.subcategories) ? c.subcategories : [];
                const isSelected = currentCategory?.slug === c.slug || String(currentCategory?.id) === String(c.id);
                const isExpanded = expandedCategoryIds.has(c.id) || isSelected;
                const catProdCount = activeProducts.filter(p => String(p.category_id) === String(c.id) || p.category === c.slug).length;

                return `
                  <div class="cat-accordion-item" style="margin-bottom: 4px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; border-radius: 6px; padding: 2px 0;">
                      <label class="filter-label" style="flex: 1; margin: 0; cursor: pointer;">
                        <span class="filter-left-inline">
                          <input type="radio" name="catRadio" value="${c.slug}" ${isSelected ? 'checked' : ''} />
                          <span style="font-weight: ${isSelected ? '700' : '500'}; color: ${isSelected ? 'var(--primary-700)' : 'var(--text-main)'};">${c.name}</span>
                        </span>
                        <span class="filter-count">(${catProdCount})</span>
                      </label>
                      ${subs.length > 0 ? `
                        <button type="button" class="btn-toggle-subcat" data-cat-id="${c.id}" aria-label="Expandir ou recolher subcategorias" title="${isExpanded ? 'Recolher' : 'Expandir'} subcategorias" style="background: none; border: none; padding: 4px 6px; cursor: pointer; color: #64748b; font-size: 0.75rem; display: flex; align-items: center;">
                          ${isExpanded ? '▲' : '▼'}
                        </button>
                      ` : ''}
                    </div>

                    <!-- Subcategorias Aninhadas Expansíveis -->
                    ${(subs.length > 0 && isExpanded) ? `
                      <div class="nested-subcats" style="margin-left: 20px; padding-left: 8px; border-left: 2px solid var(--primary-100, #e2e8f0); margin-top: 4px; margin-bottom: 6px; display: flex; flex-direction: column; gap: 4px;">
                        <label class="filter-label" style="font-size: 0.8125rem; margin: 0; cursor: pointer;">
                          <span class="filter-left-inline">
                            <input type="radio" name="subcatRadio" value="all_${c.id}" data-parent-cat="${c.slug}" ${isSelected && !currentSubcategory ? 'checked' : ''} />
                            <span style="color: #64748b;">Todas de ${c.name}</span>
                          </span>
                        </label>
                        ${subs.map(s => {
                          const isSubSelected = currentSubcategory?.slug === s.slug || String(currentSubcategory?.id) === String(s.id);
                          const subProdCount = activeProducts.filter(p => String(p.subcategory_id) === String(s.id) || p.subcategory === s.slug).length;
                          return `
                            <label class="filter-label" style="font-size: 0.8125rem; margin: 0; cursor: pointer;">
                              <span class="filter-left-inline">
                                <input type="radio" name="subcatRadio" value="${s.slug || s.id}" data-parent-cat="${c.slug}" ${isSubSelected ? 'checked' : ''} />
                                <span style="font-weight: ${isSubSelected ? '700' : '400'}; color: ${isSubSelected ? 'var(--primary-600)' : 'var(--text-secondary)'};">${s.name || s.nome}</span>
                              </span>
                              <span class="filter-count" style="font-size: 0.7rem;">(${subProdCount})</span>
                            </label>
                          `;
                        }).join('')}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

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

          <!-- Avaliação -->
          <div class="filter-section">
            <h4 class="filter-title">Avaliação</h4>
            <div class="filter-options-list">
              <label class="filter-label">
                <span class="filter-left-inline">
                  <input type="radio" name="ratingRadio" value="0" ${minRating === 0 ? 'checked' : ''} />
                  <span>Todas as avaliações</span>
                </span>
              </label>
              <label class="filter-label">
                <span class="filter-left-inline">
                  <input type="radio" name="ratingRadio" value="4" ${minRating === 4 ? 'checked' : ''} />
                  <span>4 estrelas ou mais</span>
                </span>
              </label>
            </div>
          </div>

          <div class="mobile-sidebar-footer mobile-only" style="display: none;">
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
              Mostrando <strong>${filtered.length}</strong> ${filtered.length === 1 ? 'produto' : 'produtos'}
            </div>

            <div class="catalog-controls" style="display:flex; align-items:center; gap:12px;">
              <div style="display:flex; align-items:center; gap:6px;">
                <label style="font-size: 0.8125rem; color: var(--text-secondary); font-weight: 600;">Ordenar por:</label>
                <select class="sort-select" id="catalogSortSelect">
                  <option value="relevant" ${sortBy === 'relevant' ? 'selected' : ''}>Mais Relevantes</option>
                  <option value="price_asc" ${sortBy === 'price_asc' ? 'selected' : ''}>Menor Preço</option>
                  <option value="price_desc" ${sortBy === 'price_desc' ? 'selected' : ''}>Maior Preço</option>
                  <option value="rating" ${sortBy === 'rating' ? 'selected' : ''}>Melhor Avaliados</option>
                  <option value="newest" ${sortBy === 'newest' ? 'selected' : ''}>Novidades</option>
                </select>
              </div>

              <!-- View Mode Toggle: Grid ou Lista -->
              <div class="catalog-view-toggle">
                <button type="button" class="catalog-view-btn ${viewMode === 'grid' ? 'active' : ''}" id="viewGridBtn" title="Visualização em Grade">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                </button>
                <button type="button" class="catalog-view-btn ${viewMode === 'list' ? 'active' : ''}" id="viewListBtn" title="Visualização em Lista">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  </svg>
                </button>
              </div>
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
            <div class="${viewMode === 'list' ? 'products-list' : 'products-grid'}" id="catalogProductsGrid">
              <!-- Appended via JS -->
            </div>
          `}
        </main>
      </div>
    `;

    // Append Product Cards
    const grid = container.querySelector('#catalogProductsGrid');
    if (grid) {
      filtered.forEach(p => grid.appendChild(createProductCard(p, viewMode)));
    }

    attachFilterEvents();
  }

  function attachFilterEvents() {
    // View Mode Toggle (Grid vs Lista)
    const gridBtn = container.querySelector('#viewGridBtn');
    const listBtn = container.querySelector('#viewListBtn');
    if (gridBtn) {
      gridBtn.onclick = () => {
        if (viewMode !== 'grid') {
          viewMode = 'grid';
          render();
        }
      };
    }
    if (listBtn) {
      listBtn.onclick = () => {
        if (viewMode !== 'list') {
          viewMode = 'list';
          render();
        }
      };
    }

    // Sort Select
    const sortSelect = container.querySelector('#catalogSortSelect');
    if (sortSelect) {
      sortSelect.onchange = () => {
        sortBy = sortSelect.value;
        render();
      };
    }

    // Toggle Category Expansion
    container.querySelectorAll('.btn-toggle-subcat').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const catId = Number(btn.dataset.catId);
        if (expandedCategoryIds.has(catId)) {
          expandedCategoryIds.delete(catId);
        } else {
          expandedCategoryIds.add(catId);
        }
        render();
      };
    });

    // Category Radio
    container.querySelectorAll('input[name="catRadio"]').forEach(radio => {
      radio.onchange = () => {
        currentSubcategory = null; // Reseta subcategoria ao mudar de categoria
        if (radio.value === 'all') {
          currentCategory = null;
        } else {
          currentCategory = activeCategories.find(c => c.slug === radio.value) || null;
          if (currentCategory) {
            expandedCategoryIds.add(currentCategory.id);
          }
        }
        render();
      };
    });

    // Subcategory Radio
    container.querySelectorAll('input[name="subcatRadio"]').forEach(radio => {
      radio.onchange = () => {
        const parentSlug = radio.dataset.parentCat;
        if (parentSlug && (!currentCategory || currentCategory.slug !== parentSlug)) {
          currentCategory = activeCategories.find(c => c.slug === parentSlug) || currentCategory;
          if (currentCategory) expandedCategoryIds.add(currentCategory.id);
        }

        if (radio.value.startsWith('all_')) {
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
