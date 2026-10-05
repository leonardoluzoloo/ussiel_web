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

  let selectedCategories = categorySlug ? [categorySlug] : [];
  let selectedSubcategories = subcategorySlug ? [subcategorySlug] : [];
  let expandedCategoryIds = new Set(); // Controle de categorias expandidas/recolhidas
  let selectedBrands = [];
  let maxPrice = 6000000;
  let onlyInStock = false;
  let onlyDeals = isDeals;
  let minRating = 0;
  let sortBy = 'relevant';
  let viewMode = 'grid'; // 'grid' | 'list'

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

      if (categorySlug && !selectedCategories.includes(categorySlug)) {
        selectedCategories.push(categorySlug);
      }
      if (subcategorySlug && !selectedSubcategories.includes(subcategorySlug)) {
        selectedSubcategories.push(subcategorySlug);
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
      } else if (isDatabaseLoaded && (!realProds || realProds.length === 0)) {
        activeProducts = [];
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

      // Category & Subcategory Filter via Checkboxes
      const prodCatId = String(product.category_id || product.categoria_id || '');
      const prodCatSlug = String(product.category || product.category_slug || '');
      const prodSubId = String(product.subcategory_id || product.subcategoria_id || product.specs?.subcategory_id || '');
      const prodSubSlug = String(product.subcategory || product.subcategory_slug || product.specs?.subcategory || '');

      const hasCategoryFilter = selectedCategories.length > 0;
      const hasSubcategoryFilter = selectedSubcategories.length > 0;

      if (hasCategoryFilter || hasSubcategoryFilter) {
        let matchesCat = false;
        let matchesSub = false;

        if (hasCategoryFilter) {
          matchesCat = selectedCategories.some(catVal => {
            const cleanVal = String(catVal).toLowerCase();
            return cleanVal === prodCatSlug.toLowerCase() ||
                   cleanVal === prodCatId ||
                   cleanVal === String(product.category_uid || '').toLowerCase() ||
                   activeCategories.find(c => String(c.id) === cleanVal || (c.uid && c.uid.toLowerCase() === cleanVal) || (c.slug && c.slug.toLowerCase() === cleanVal))?.name?.toLowerCase() === (product.category || '').toLowerCase();
          });
        }

        if (hasSubcategoryFilter) {
          matchesSub = selectedSubcategories.some(subVal => {
            const cleanSub = String(subVal).toLowerCase();
            return cleanSub === prodSubSlug.toLowerCase() ||
                   cleanSub === prodSubId ||
                   cleanSub === String(product.subcategory_uid || '').toLowerCase();
          });
        }

        if (hasCategoryFilter && hasSubcategoryFilter) {
          if (!matchesCat && !matchesSub) return false;
        } else if (hasCategoryFilter) {
          if (!matchesCat) return false;
        } else if (hasSubcategoryFilter) {
          if (!matchesSub) return false;
        }
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
      // New filter (Novidades)
      const isProductNew = Boolean(product.is_new || product.novo || (product.badges && product.badges.includes('NOVO')));
      if (isNew && !isProductNew) {
        return false;
      }
      // Brand filter (100% Real Brands from Database)
      if (selectedBrands.length > 0) {
        const prodBrand = (product.brand || '').trim().toLowerCase();
        const matchBrand = selectedBrands.some(b => b.trim().toLowerCase() === prodBrand);
        if (!matchBrand) return false;
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
      const aIsNew = Boolean(a.is_new || a.novo || (a.badges && a.badges.includes('NOVO')));
      const bIsNew = Boolean(b.is_new || b.novo || (b.badges && b.badges.includes('NOVO')));
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'newest') return (bIsNew ? 1 : 0) - (aIsNew ? 1 : 0);
      return 0; // relevant
    });
  }


  // Banner institucional oficial quando o admin ainda não cadastrou banners
  const defaultInstitutionalBanner = [
    {
      id: 'banner-institutional',
      tag: 'LOJA OFICIAL',
      badge_text: 'TECNOLOGIA & INOVAÇÃO',
      title: 'NovaTech Angola • Smartphones & Eletrônicos',
      highlight: 'Tecnologia de Alta Performance com Garantia Oficial',
      desc: 'Smartphones, computadores e eletrônicos de alto desempenho com garantia oficial, assistência técnica autorizada e pronta entrega em Luanda.',
      button_text: 'Explorar Catálogo',
      button_link: '#/catalogo',
      tag_badge: 'Garantia NovaTech',
      specs_badge: 'Entregas Rápidas',
      accent_color: '#0071e3',
      image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=1600&auto=format&fit=crop',
      image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=1600&auto=format&fit=crop'
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
    const isHomePage = selectedCategories.length === 0 && selectedSubcategories.length === 0 && !searchQuery && !isDeals && !isNew;
    const hasActiveBanners = activeBanners && activeBanners.length > 0;
    const currentBannerList = hasActiveBanners ? activeBanners : defaultInstitutionalBanner;
    const f = currentBannerList.length > 0 ? currentBannerList[activeFlagshipIndex % currentBannerList.length] : null;

    const bannerTitle = f?.title || 'NovaTech Angola';
    const bannerImg = f ? (f.image_url || f.imagem_url || f.image) : '';
    const bannerLink = f ? (f.button_link || (f.slug ? `#/produto/${f.slug}` : '#/catalogo')) : '#/catalogo';

    const existingBrands = Array.from(new Set(
      activeProducts
        .map(p => (p.brand || '').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }));

    const selectedCatNames = selectedCategories.map(catVal => {
      const c = activeCategories.find(item => item.slug === catVal || String(item.id) === String(catVal));
      return c ? c.name : catVal;
    });

    const titleText = isDeals ? 'Ofertas & Promoções da Semana' :
      isNew ? 'Lançamentos & Novidades Tecnológicas' :
        searchQuery ? `Resultados da busca por "${searchQuery}"` :
          selectedCatNames.length > 0 ? selectedCatNames.join(', ') : 'Catálogo Completo';

    const descText = isDeals ? 'Aproveite descontos especiais em smartphones, gaming e áudio por tempo limitado.' :
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
                    <div class="hero-fallback-brand-badge">TECNOLOGIA & INOVAÇÃO</div>
                    <h2 class="hero-fallback-title">${bannerTitle}</h2>
                    <p class="hero-fallback-sub">Equipamentos e eletrônicos de alto desempenho com garantia oficial e entrega rápida.</p>
                    <span class="btn btn-primary" style="margin-top: 14px; padding: 10px 24px; font-weight: 700; border-radius: 8px;">Explorar Catálogo →</span>
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
        <div style="margin-top: 16px; margin-bottom: 20px; background: linear-gradient(135deg, #090d16 0%, #1e293b 100%); color: #ffffff; padding: 22px 28px; border-radius: 12px; position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 4px 16px rgba(0,0,0,0.12);">
          <div style="position: relative; z-index: 2; max-width: 700px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 0.6875rem; font-weight: 800; text-transform: uppercase; color: #38bdf8; letter-spacing: 0.08em; background: rgba(56, 189, 248, 0.15); padding: 3px 8px; border-radius: 4px;">
                ${selectedCategories.length > 0 ? 'Filtro Ativo' : isDeals ? 'Ofertas' : isNew ? 'Lançamentos' : 'Catálogo'}
              </span>
            </div>
            <h1 style="font-family: var(--font-display); font-size: 1.75rem; font-weight: 900; margin: 0 0 4px 0; letter-spacing: -0.02em;">
              ${titleText}
            </h1>
            <p style="color: #cbd5e1; font-size: 0.875rem; line-height: 1.4; margin: 0;">
              ${descText || `Produtos oficiais com garantia e assistência técnica especializada.`}
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
        <!-- Sidebar Filters (Design Minimalista Apple / World-Class E-Commerce) -->
        <aside class="catalog-sidebar" id="catalogSidebar">
          <div class="catalog-sidebar-header">
            <span class="catalog-sidebar-title">Filtros</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button type="button" id="clearFiltersBtn" class="catalog-clear-btn" title="Limpar todos os filtros">
                Limpar tudo
              </button>
              <button type="button" id="closeMobileFiltersBtn" class="mobile-sidebar-close" aria-label="Fechar Filtros">
                ${Icons.close(18)}
              </button>
            </div>
          </div>

          <!-- Category and Subcategory Selector (Checkboxes with Expand/Collapse) -->
          <div class="filter-group">
            <div class="filter-group-header">
              <span>Categorias</span>
            </div>
            <div class="filter-group-content" style="max-height: 340px; overflow-y: auto; padding-right: 2px;">
              ${activeCategories.map(c => {
                const isChecked = selectedCategories.includes(c.slug) || selectedCategories.includes(String(c.id));
                const catProdCount = activeProducts.filter(p => String(p.category_id || p.categoria_id) === String(c.id) || p.category === c.slug).length;
                const subs = (Array.isArray(c.subcategories) ? c.subcategories : (Array.isArray(c.subcategorias) ? c.subcategorias : [])).filter(s => s.is_active !== false);
                const isExpanded = expandedCategoryIds.has(String(c.id));

                return `
                  <div class="filter-cat-tree-node" style="margin-bottom: 6px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 6px; padding: 2px 0;">
                      <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                        <input 
                          type="checkbox" 
                          class="apple-checkbox category-check" 
                          value="${c.slug || c.id}" 
                          data-cat-id="${c.id}"
                          ${isChecked ? 'checked' : ''} 
                        />
                        <div class="cat-expand-trigger" data-cat-id="${c.id}" style="display: flex; align-items: center; justify-content: space-between; flex: 1; cursor: pointer; user-select: none;">
                          <span class="filter-checkbox-label" style="font-weight: ${isChecked ? '700' : '500'};">${c.name}</span>
                          <span class="filter-checkbox-count">(${catProdCount})</span>
                        </div>
                      </div>

                      ${subs.length > 0 ? `
                        <button 
                          type="button" 
                          class="btn-toggle-subcat" 
                          data-cat-id="${c.id}" 
                          aria-label="Expandir ou recolher subcategorias" 
                          title="${isExpanded ? 'Recolher subcategorias' : 'Expandir subcategorias'}"
                          style="background: none; border: none; padding: 6px; cursor: pointer; color: #86868b; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; transition: all 0.2s ease;"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transform: rotate(${isExpanded ? '180deg' : '0deg'}); transition: transform 0.25s ease;">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>
                      ` : ''}
                    </div>

                    ${(subs.length > 0 && isExpanded) ? `
                      <div class="filter-subcat-list" style="margin-left: 20px; padding-left: 10px; border-left: 1.5px solid #e5e5e7; margin-top: 4px; display: flex; flex-direction: column; gap: 4px;">
                        ${subs.map(s => {
                          const isSubChecked = selectedSubcategories.includes(s.slug) || selectedSubcategories.includes(String(s.id));
                          const subProdCount = activeProducts.filter(p => 
                            String(p.subcategory_id || p.subcategoria_id || p.specs?.subcategory_id) === String(s.id) || 
                            p.subcategory === s.slug
                          ).length;

                          return `
                            <label class="filter-checkbox-row" style="font-size: 0.8125rem;">
                              <input 
                                type="checkbox" 
                                class="apple-checkbox subcategory-check" 
                                value="${s.slug || s.id}" 
                                data-parent-cat="${c.slug || c.id}"
                                ${isSubChecked ? 'checked' : ''} 
                              />
                              <span class="filter-checkbox-label" style="color: #424245;">${s.name || s.nome}</span>
                              <span class="filter-checkbox-count">(${subProdCount})</span>
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

          <!-- Brand Checkbox Filter (100% Real Brands Read From Database) -->
          ${existingBrands.length > 0 ? `
            <div class="filter-group">
              <div class="filter-group-header">
                <span>Marcas</span>
              </div>
              <div class="filter-group-content" style="max-height: 220px; overflow-y: auto; padding-right: 2px;">
                ${existingBrands.map(b => {
                  const count = activeProducts.filter(p => (p.brand || '').trim().toLowerCase() === b.toLowerCase()).length;
                  const isChecked = selectedBrands.map(x => x.toLowerCase()).includes(b.toLowerCase());

                  return `
                    <label class="filter-checkbox-row">
                      <input 
                        type="checkbox" 
                        class="apple-checkbox brand-check" 
                        value="${b}" 
                        ${isChecked ? 'checked' : ''} 
                      />
                      <span class="filter-checkbox-label">${b}</span>
                      <span class="filter-checkbox-count">(${count})</span>
                    </label>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Price Filter -->
          <div class="filter-group">
            <div class="filter-group-header">
              <span>Faixa de Preço</span>
            </div>
            <div class="filter-group-content">
              <div class="filter-price-summary">
                <span class="price-val-label">Até</span>
                <span class="price-val-amount" id="priceDisplay">${formatPrice(maxPrice)}</span>
              </div>
              <input 
                type="range" 
                id="priceRangeSlider" 
                class="apple-range-slider"
                min="100000" 
                max="6000000" 
                step="50000" 
                value="${maxPrice}" 
              />
              <div class="price-range-limits">
                <span>Kz 100.000</span>
                <span>Kz 6.000.000</span>
              </div>
            </div>
          </div>

          <!-- Availability & Deals -->
          <div class="filter-group">
            <div class="filter-group-header">
              <span>Disponibilidade</span>
            </div>
            <div class="filter-group-content">
              <label class="filter-checkbox-row">
                <input type="checkbox" class="apple-checkbox" id="checkInStock" ${onlyInStock ? 'checked' : ''} />
                <span class="filter-checkbox-label">Apenas em estoque</span>
                <span class="filter-checkbox-count">(${activeProducts.filter(p => p.stock > 0).length})</span>
              </label>
              <label class="filter-checkbox-row">
                <input type="checkbox" class="apple-checkbox" id="checkDeals" ${onlyDeals ? 'checked' : ''} />
                <span class="filter-checkbox-label">Apenas com desconto</span>
                <span class="filter-checkbox-count">(${activeProducts.filter(p => p.oldPrice && p.oldPrice > p.price).length})</span>
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

    // Toggle Expand/Collapse Subcategories (Chevron + Category Text Click)
    const toggleCatExpand = (catId) => {
      const idStr = String(catId);
      if (expandedCategoryIds.has(idStr)) {
        expandedCategoryIds.delete(idStr);
      } else {
        expandedCategoryIds.add(idStr);
      }
      render();
    };

    container.querySelectorAll('.btn-toggle-subcat').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCatExpand(btn.dataset.catId);
      };
    });

    container.querySelectorAll('.cat-expand-trigger').forEach(trigger => {
      trigger.onclick = (e) => {
        const catId = trigger.dataset.catId;
        const cat = activeCategories.find(c => String(c.id) === String(catId));
        const subs = cat ? (Array.isArray(cat.subcategories) ? cat.subcategories : (Array.isArray(cat.subcategorias) ? cat.subcategorias : [])).filter(s => s.is_active !== false) : [];
        if (subs.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          toggleCatExpand(catId);
        } else {
          const cb = trigger.closest('.filter-cat-tree-node')?.querySelector('.category-check');
          if (cb) {
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
          }
        }
      };
    });

    // Category Checkboxes
    container.querySelectorAll('.category-check').forEach(cb => {
      cb.onchange = () => {
        const val = cb.value;
        if (cb.checked) {
          if (!selectedCategories.includes(val)) selectedCategories.push(val);
        } else {
          selectedCategories = selectedCategories.filter(c => c !== val);
        }
        render();
      };
    });

    // Subcategory Checkboxes
    container.querySelectorAll('.subcategory-check').forEach(cb => {
      cb.onchange = () => {
        const val = cb.value;
        if (cb.checked) {
          if (!selectedSubcategories.includes(val)) selectedSubcategories.push(val);
        } else {
          selectedSubcategories = selectedSubcategories.filter(s => s !== val);
        }
        render();
      };
    });

    // Price Slider (Apple Range Slider)
    const priceSlider = container.querySelector('#priceRangeSlider');
    if (priceSlider) {
      priceSlider.oninput = () => {
        maxPrice = Number(priceSlider.value);
        const display = container.querySelector('#priceDisplay');
        if (display) display.textContent = formatPrice(maxPrice);
      };
      priceSlider.onchange = () => render();
    }

    // Brand Checkboxes (100% Real Brands)
    container.querySelectorAll('.brand-check').forEach(cb => {
      cb.onchange = () => {
        const val = cb.value;
        if (cb.checked) {
          if (!selectedBrands.includes(val)) selectedBrands.push(val);
        } else {
          selectedBrands = selectedBrands.filter(b => b.toLowerCase() !== val.toLowerCase());
        }
        render();
      };
    });

    // In Stock & Deals Checkboxes
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

    // Clear Filters
    const clearBtn = container.querySelector('#clearFiltersBtn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        selectedCategories = [];
        selectedSubcategories = [];
        selectedBrands = [];
        maxPrice = 6000000;
        onlyInStock = false;
        onlyDeals = false;
        minRating = 0;
        render();
      };
    }

    const emptyClearBtn = container.querySelector('#emptyClearFiltersBtn');
    if (emptyClearBtn) {
      emptyClearBtn.onclick = () => {
        selectedCategories = [];
        selectedSubcategories = [];
        selectedBrands = [];
        maxPrice = 6000000;
        onlyInStock = false;
        onlyDeals = false;
        minRating = 0;
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
    const isHomePageNow = selectedCategories.length === 0 && selectedSubcategories.length === 0 && !searchQuery && !isDeals && !isNew;
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
