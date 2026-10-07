// ===================================================================
// CATALOG & CATEGORY VIEW (Dynamic Filters, Sort, Search, Grid/List)
// 100% Dinâmico • Dados Reais do Supabase • Design Executivo & Limpo
// ===================================================================

import { Icons } from '../utils/icons.js';
import { Api } from '../services/api.js';
import { createProductCard } from '../components/ProductCard.js';
import { formatPrice } from '../utils/format.js';

export function renderCatalogView({ categorySlug = null, subcategorySlug = null, searchQuery = null, isDeals = false, isNew = false } = {}) {
  const container = document.createElement('div');
  container.className = 'container catalog-view-page';
  container.style.minHeight = '650px';

  // Pré-carregamento imediato do cache local persistente para eliminar qualquer flash no F5
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
  let expandedCategoryIds = new Set();
  let selectedBrands = [];
  let minPrice = 0;
  let maxPrice = 6000000;
  let onlyInStock = false;
  let onlyDeals = isDeals;
  let minRating = 0;
  let sortBy = 'relevant';
  let viewMode = 'grid'; // 'grid' | 'list'
  let activeFlagshipIndex = 0;

  async function syncFromDatabase() {
    try {
      const [realProds, realCats, realBanners] = await Promise.all([
        Api.products.getAll({ all: true }),
        Api.categories.getAll(),
        Api.banners.getActive()
      ]);

      isDatabaseLoaded = true;
      activeCategories = realCats || [];

      if (categorySlug && !selectedCategories.includes(categorySlug)) {
        selectedCategories = [categorySlug];
      }
      if (subcategorySlug && !selectedSubcategories.includes(subcategorySlug)) {
        selectedSubcategories = [subcategorySlug];
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

  // Sincronização em tempo real com eventos do sistema
  const onCatalogUpdated = () => syncFromDatabase();
  window.addEventListener('products-updated', onCatalogUpdated);
  window.addEventListener('categories-updated', onCatalogUpdated);
  window.addEventListener('banners-updated', onCatalogUpdated);
  window.addEventListener('stock-updated', onCatalogUpdated);

  // Helper de correspondência de categoria real
  function matchesCategory(product, catObj) {
    if (!catObj) return false;
    const prodCatId = String(product.category_id || product.categoria_id || '');
    const prodCatSlug = String(product.category || product.category_slug || '').toLowerCase().trim();
    const prodCatName = String(product.category_name || '').toLowerCase().trim();
    const targetId = String(catObj.id || '');
    const targetUid = String(catObj.uid || '').toLowerCase().trim();
    const targetSlug = String(catObj.slug || '').toLowerCase().trim();
    const targetName = String(catObj.name || '').toLowerCase().trim();

    if (targetId && prodCatId === targetId) return true;
    if (targetSlug && prodCatSlug === targetSlug) return true;
    if (targetName && prodCatSlug === targetName) return true;
    if (targetUid && prodCatSlug === targetUid) return true;
    if (targetUid && String(product.category_uid || '').toLowerCase().trim() === targetUid) return true;
    if (targetName && prodCatName === targetName) return true;

    return false;
  }

  // Helper de correspondência de subcategoria real
  function matchesSubcategory(product, subVal, subName = '') {
    if (!subVal) return false;
    const cleanSub = String(subVal).toLowerCase().trim();
    const cleanName = String(subName || subVal).toLowerCase().trim();

    const prodSubId = String(product.subcategory_id || product.subcategoria_id || product.specs?.subcategory_id || '').trim();
    const prodSubSlug = String(product.subcategory || product.subcategory_slug || product.specs?.subcategory || '').toLowerCase().trim();
    const prodSubName = String(product.subcategory_name || '').toLowerCase().trim();
    const prodBrand = String(product.brand || '').toLowerCase().trim();

    if (cleanSub === prodSubSlug || cleanSub === prodSubId || cleanName === prodSubSlug || cleanName === prodSubName) return true;
    if (cleanSub === prodBrand || cleanName === prodBrand) return true;

    return false;
  }

  function getFilteredProducts() {
    return activeProducts.filter(product => {
      // Oculta produtos desativados pelo Admin
      if (product.is_active === false || product.ativo === false) {
        return false;
      }

      // 1. Filtro de Categoria
      const hasCategoryFilter = selectedCategories.length > 0;
      if (hasCategoryFilter) {
        const matchesAnyCat = selectedCategories.some(catVal => {
          if (!catVal) return false;
          const cleanVal = String(catVal).toLowerCase().trim();
          const targetCatObj = activeCategories.find(c => 
            String(c.id) === cleanVal || 
            (c.uid && c.uid.toLowerCase() === cleanVal) || 
            (c.slug && c.slug.toLowerCase() === cleanVal) ||
            (c.name && c.name.toLowerCase() === cleanVal)
          );
          return matchesCategory(product, targetCatObj || { slug: cleanVal, name: cleanVal, id: cleanVal });
        });
        if (!matchesAnyCat) return false;
      }

      // 2. Filtro de Subcategoria
      const hasSubcategoryFilter = selectedSubcategories.length > 0;
      if (hasSubcategoryFilter) {
        const matchesAnySub = selectedSubcategories.some(subVal => {
          return matchesSubcategory(product, subVal);
        });
        if (!matchesAnySub) return false;
      }

      // 3. Busca por texto
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          (product.name || '').toLowerCase().includes(q) ||
          (product.brand || '').toLowerCase().includes(q) ||
          (product.category || '').toLowerCase().includes(q) ||
          (product.sku || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      // 4. Promoções & Ofertas
      if (onlyDeals) {
        const isPromo = (product.oldPrice && Number(product.oldPrice) > Number(product.price)) ||
                        Boolean(product.is_deal || product.oferta) ||
                        (Array.isArray(product.badges) && product.badges.includes('OFERTA'));
        if (!isPromo) return false;
      }

      // 5. Novidades (se houver marcados com 'novo' filtra por eles, senão exibe os produtos mais recentes)
      if (isNew) {
        const hasAnyExplicitNew = activeProducts.some(p => Boolean(p.is_new || p.novo || (Array.isArray(p.badges) && p.badges.includes('NOVO'))));
        if (hasAnyExplicitNew) {
          const isProductNew = Boolean(product.is_new || product.novo || (Array.isArray(product.badges) && product.badges.includes('NOVO')));
          if (!isProductNew) return false;
        }
      }

      // 6. Marcas selecionadas
      if (selectedBrands.length > 0) {
        const prodBrand = (product.brand || '').trim().toLowerCase();
        const matchBrand = selectedBrands.some(b => b.trim().toLowerCase() === prodBrand);
        if (!matchBrand) return false;
      }

      // 7. Faixa de Preço (Mínimo e Máximo)
      const prodPrice = Number(product.price || 0);
      if (minPrice > 0 && prodPrice < minPrice) return false;
      if (maxPrice > 0 && prodPrice > maxPrice) return false;

      // 8. Disponibilidade em Estoque
      if (onlyInStock && Number(product.stock || 0) <= 0) return false;

      // 9. Avaliação
      if (minRating > 0 && Number(product.rating || 0) < minRating) return false;

      return true;
    }).sort((a, b) => {
      const aIsNew = Boolean(a.is_new || a.novo || (a.badges && a.badges.includes('NOVO')));
      const bIsNew = Boolean(b.is_new || b.novo || (b.badges && b.badges.includes('NOVO')));
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'newest') return (bIsNew ? 1 : 0) - (aIsNew ? 1 : 0);
      if (sortBy === 'discount') {
        const discA = a.oldPrice ? (a.oldPrice - a.price) : 0;
        const discB = b.oldPrice ? (b.oldPrice - b.price) : 0;
        return discB - discA;
      }
      return 0;
    });
  }

  function render() {
    const filtered = getFilteredProducts();
    const isSingleCategory = selectedCategories.length === 1;

    // Identificação precisa do objeto de categoria atual no banco
    const cleanCat = isSingleCategory ? String(selectedCategories[0]).toLowerCase().trim() : '';
    const currentCategoryObj = isSingleCategory ? activeCategories.find(c => 
      String(c.id) === cleanCat ||
      (c.slug && c.slug.toLowerCase() === cleanCat) ||
      (c.uid && c.uid.toLowerCase() === cleanCat) ||
      (c.name && c.name.toLowerCase() === cleanCat)
    ) : null;

    const rawSubs = currentCategoryObj ? (Array.isArray(currentCategoryObj.subcategories) ? currentCategoryObj.subcategories : (Array.isArray(currentCategoryObj.subcategorias) ? currentCategoryObj.subcategorias : [])) : [];
    const categorySubs = rawSubs.filter(s => s && s.is_active !== false && s.ativo !== false);

    // Identificação da subcategoria atual
    const currentSubcategoryObj = (selectedSubcategories.length > 0 && categorySubs.length > 0) ? categorySubs.find(s => {
      const target = String(selectedSubcategories[0]).toLowerCase().trim();
      return String(s.id) === target || (s.slug && s.slug.toLowerCase() === target) || (s.name && s.name.toLowerCase() === target);
    }) : null;

    // Base de produtos desta categoria para filtros de marca
    const baseCategoryProducts = activeProducts.filter(p => {
      if (p.is_active === false || p.ativo === false) return false;
      if (isSingleCategory && currentCategoryObj) {
        return matchesCategory(p, currentCategoryObj);
      }
      return true;
    });

    const existingBrands = Array.from(new Set(
      baseCategoryProducts
        .map(p => (p.brand || '').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }));

    // Define qual cabeçalho estruturado renderizar
    const isCategoryPage = Boolean(isSingleCategory && currentCategoryObj);
    const isNewPage = Boolean(isNew);
    const isDealsPage = Boolean(isDeals);
    const isSearchPage = Boolean(searchQuery);
    const isHomePage = !isCategoryPage && !isNewPage && !isDealsPage && !isSearchPage && selectedCategories.length === 0;

    container.innerHTML = `
      ${isCategoryPage ? `
        <!-- Cabeçalho de Categoria Real -->
        <section class="category-page-header" style="background: transparent; border: none; padding: 14px 0 16px 0; margin: 0; box-shadow: none;">
          <nav class="category-breadcrumb" aria-label="Navegação estrutural" style="margin-bottom: 12px;">
            <a href="#/">Início</a>
            <span class="breadcrumb-sep">/</span>
            <a href="#/categorias">Categorias</a>
            <span class="breadcrumb-sep">/</span>
            ${currentSubcategoryObj ? `
              <a href="#/categoria/${currentCategoryObj.slug || currentCategoryObj.id}">${currentCategoryObj.name}</a>
              <span class="breadcrumb-sep">/</span>
              <span class="breadcrumb-current">${currentSubcategoryObj.name}</span>
            ` : `
              <span class="breadcrumb-current">${currentCategoryObj.name}</span>
            `}
          </nav>

          <div class="category-title-wrap" style="margin-bottom: 16px;">
            <h1 class="category-main-heading" style="font-size: 1.85rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; letter-spacing: -0.02em;">
              ${currentCategoryObj.name.toUpperCase()}
            </h1>
            <p class="category-desc-text" style="font-size: 0.95rem; color: #475569; margin: 0;">
              Encontre o ${currentCategoryObj.name.toLowerCase()} ideal para si.
            </p>
          </div>

          ${categorySubs.length > 0 ? `
            <div class="category-subchips-bar" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
              <button type="button" class="cat-subchip ${selectedSubcategories.length === 0 ? 'active' : ''}" data-sub-val="">
                Todos
              </button>
              ${categorySubs.map(sub => {
                const subName = typeof sub === 'string' ? sub : (sub.name || sub.nome || '');
                const subSlug = typeof sub === 'string' ? sub : (sub.slug || sub.uid || sub.name || '');
                if (!subName) return '';
                const isSubActive = selectedSubcategories.some(s => 
                  String(s).toLowerCase() === subSlug.toLowerCase() || 
                  String(s).toLowerCase() === subName.toLowerCase()
                );
                return `
                  <button type="button" class="cat-subchip ${isSubActive ? 'active' : ''}" data-sub-val="${subSlug}">
                    ${subName}
                  </button>
                `;
              }).join('')}
            </div>
          ` : ''}
        </section>
      ` : isNewPage ? `
        <!-- Cabeçalho de Novidades -->
        <section class="category-page-header" style="background: transparent; border: none; padding: 14px 0 16px 0; margin: 0; box-shadow: none;">
          <nav class="category-breadcrumb" aria-label="Navegação estrutural" style="margin-bottom: 12px;">
            <a href="#/">Início</a>
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-current">Novidades</span>
          </nav>
          <div class="category-title-wrap" style="margin-bottom: 16px;">
            <h1 class="category-main-heading" style="font-size: 1.85rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; letter-spacing: -0.02em;">
              LANÇAMENTOS & NOVIDADES
            </h1>
            <p class="category-desc-text" style="font-size: 0.95rem; color: #475569; margin: 0;">
              Confira os produtos recém-adicionados ao catálogo.
            </p>
          </div>
        </section>
      ` : isDealsPage ? `
        <!-- Cabeçalho de Ofertas -->
        <section class="category-page-header" style="background: transparent; border: none; padding: 14px 0 16px 0; margin: 0; box-shadow: none;">
          <nav class="category-breadcrumb" aria-label="Navegação estrutural" style="margin-bottom: 12px;">
            <a href="#/">Início</a>
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-current">Ofertas</span>
          </nav>
          <div class="category-title-wrap" style="margin-bottom: 16px;">
            <h1 class="category-main-heading" style="font-size: 1.85rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; letter-spacing: -0.02em;">
              OFERTAS & PROMOÇÕES
            </h1>
            <p class="category-desc-text" style="font-size: 0.95rem; color: #475569; margin: 0;">
              Aproveite os melhores preços com garantia e entrega rápida.
            </p>
          </div>
        </section>
      ` : isSearchPage ? `
        <!-- Cabeçalho de Busca -->
        <section class="category-page-header" style="background: transparent; border: none; padding: 14px 0 16px 0; margin: 0; box-shadow: none;">
          <nav class="category-breadcrumb" aria-label="Navegação estrutural" style="margin-bottom: 12px;">
            <a href="#/">Início</a>
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-current">Busca</span>
          </nav>
          <div class="category-title-wrap" style="margin-bottom: 16px;">
            <h1 class="category-main-heading" style="font-size: 1.85rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; letter-spacing: -0.02em;">
              RESULTADOS PARA "${searchQuery.toUpperCase()}"
            </h1>
            <p class="category-desc-text" style="font-size: 0.95rem; color: #475569; margin: 0;">
              Exibindo produtos correspondentes à pesquisa.
            </p>
          </div>
        </section>
      ` : `
        <!-- Página Inicial: Hero Banner (apenas se houver banners reais cadastrados no admin) -->
        ${activeBanners && activeBanners.length > 0 ? `
          <section class="hero-clean-banner-section" style="margin-top: 16px; margin-bottom: 20px;">
            <div class="hero-clean-banner-box" id="heroCommercialBox">
              <a href="${activeBanners[0].button_link || '#/catalogo'}" class="hero-clean-banner-link">
                <img src="${activeBanners[0].image_url || activeBanners[0].image}" alt="${activeBanners[0].title || 'Banner'}" class="hero-clean-banner-img" />
              </a>
            </div>
          </section>
        ` : `
          <div style="height: 16px;"></div>
        `}
      `}

      <!-- Layout Principal do Catálogo -->
      <div class="catalog-layout">
        <!-- Sidebar de Filtros -->
        <aside class="catalog-sidebar" id="catalogSidebar">
          <div class="catalog-sidebar-header">
            <span class="catalog-sidebar-title">Filtros</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button type="button" id="clearFiltersBtn" class="catalog-clear-btn" title="Limpar todos os filtros">
                Limpar filtros
              </button>
              <button type="button" id="closeMobileFiltersBtn" class="mobile-sidebar-close" aria-label="Fechar Filtros">
                ${Icons.close(18)}
              </button>
            </div>
          </div>

          <!-- Filtro de Categorias Reais -->
          ${activeCategories.length > 0 ? `
            <div class="filter-group">
              <div class="filter-group-header">
                <span>Categorias</span>
              </div>
              <div class="filter-group-content" style="max-height: 280px; overflow-y: auto; padding-right: 2px;">
                ${activeCategories.map(c => {
                  const isChecked = selectedCategories.includes(c.slug) || selectedCategories.includes(String(c.id));
                  const catProdCount = activeProducts.filter(p => matchesCategory(p, c)).length;
                  return `
                    <div class="filter-cat-tree-node" style="margin-bottom: 6px;">
                      <label style="display: flex; align-items: center; gap: 8px; width: 100%; cursor: pointer;">
                        <input 
                          type="checkbox" 
                          class="apple-checkbox category-check" 
                          value="${c.slug || c.id}" 
                          ${isChecked ? 'checked' : ''} 
                        />
                        <span class="filter-checkbox-label" style="font-weight: ${isChecked ? '700' : '500'}; flex: 1;">${c.name}</span>
                        <span class="filter-checkbox-count">(${catProdCount})</span>
                      </label>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Filtro de Marcas -->
          ${existingBrands.length > 0 ? `
            <div class="filter-group">
              <div class="filter-group-header">
                <span>Marcas</span>
              </div>
              <div class="filter-group-content" style="max-height: 220px; overflow-y: auto; padding-right: 2px;">
                ${existingBrands.map(b => {
                  const count = baseCategoryProducts.filter(p => (p.brand || '').trim().toLowerCase() === b.toLowerCase()).length;
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

          <!-- Faixa de Preço -->
          <div class="filter-group">
            <div class="filter-group-header">
              <span>Faixa de Preço</span>
            </div>
            <div class="filter-group-content">
              <div class="filter-price-inputs-grid">
                <div class="filter-price-field">
                  <label class="filter-price-label" for="priceMinInput">Mínimo</label>
                  <input 
                    type="number" 
                    id="priceMinInput" 
                    class="filter-price-input" 
                    placeholder="0 Kz" 
                    min="0"
                    step="10000"
                    value="${minPrice > 0 ? minPrice : ''}" 
                  />
                </div>
                <div class="filter-price-field">
                  <label class="filter-price-label" for="priceMaxInput">Máximo</label>
                  <input 
                    type="number" 
                    id="priceMaxInput" 
                    class="filter-price-input" 
                    placeholder="6.000.000 Kz" 
                    min="0"
                    step="10000"
                    value="${maxPrice < 6000000 ? maxPrice : ''}" 
                  />
                </div>
              </div>

              <div class="filter-price-summary" style="margin-bottom: 6px;">
                <span class="price-val-label">Até:</span>
                <span class="price-val-amount" id="priceDisplay">${formatPrice(maxPrice)}</span>
              </div>
              <input 
                type="range" 
                id="priceRangeSlider" 
                class="apple-range-slider"
                min="0" 
                max="6000000" 
                step="50000" 
                value="${maxPrice}" 
              />
            </div>
          </div>

          <!-- Disponibilidade -->
          <div class="filter-group">
            <div class="filter-group-header">
              <span>Disponibilidade</span>
            </div>
            <div class="filter-group-content">
              <label class="filter-checkbox-row">
                <input type="checkbox" class="apple-checkbox" id="checkInStock" ${onlyInStock ? 'checked' : ''} />
                <span class="filter-checkbox-label">Em stock</span>
                <span class="filter-checkbox-count">(${baseCategoryProducts.filter(p => p.stock > 0).length})</span>
              </label>
              <label class="filter-checkbox-row">
                <input type="checkbox" class="apple-checkbox" id="checkDeals" ${onlyDeals ? 'checked' : ''} />
                <span class="filter-checkbox-label">Em promoção</span>
                <span class="filter-checkbox-count">(${baseCategoryProducts.filter(p => (p.oldPrice && p.oldPrice > p.price) || p.is_deal).length})</span>
              </label>
            </div>
          </div>

          <div class="mobile-sidebar-footer">
            <button id="applyMobileFiltersBtn" class="btn btn-primary btn-full">
              Aplicar Filtros (${filtered.length})
            </button>
          </div>
        </aside>

        <!-- Área de Produtos -->
        <main>
          <!-- Controles de Ordenação & Quantidade -->
          <div class="catalog-header">
            <div class="catalog-results-count" id="catalogResultsCount">
              <strong>${filtered.length}</strong> ${filtered.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
            </div>

            <div class="catalog-controls">
              <div class="catalog-sort-wrapper">
                <label for="catalogSortSelect" class="catalog-sort-label">Ordenar por:</label>
                <select class="sort-select" id="catalogSortSelect">
                  <option value="relevant" ${sortBy === 'relevant' ? 'selected' : ''}>Mais Relevantes</option>
                  <option value="newest" ${sortBy === 'newest' ? 'selected' : ''}>Mais Recentes</option>
                  <option value="price_asc" ${sortBy === 'price_asc' ? 'selected' : ''}>Menor Preço</option>
                  <option value="price_desc" ${sortBy === 'price_desc' ? 'selected' : ''}>Maior Preço</option>
                  <option value="discount" ${sortBy === 'discount' ? 'selected' : ''}>Maior Desconto</option>
                  <option value="rating" ${sortBy === 'rating' ? 'selected' : ''}>Melhor Avaliados</option>
                </select>
              </div>

              <div class="catalog-view-toggle" role="group" aria-label="Modo de exibição">
                <button type="button" class="catalog-view-btn ${viewMode === 'grid' ? 'active' : ''}" id="viewGridBtn" title="Visualização em Grade" aria-label="Grade">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                </button>
                <button type="button" class="catalog-view-btn ${viewMode === 'list' ? 'active' : ''}" id="viewListBtn" title="Visualização em Lista Horizontal" aria-label="Horizontal">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
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

          <!-- Grade de Produtos / Empty State Ampliado -->
          ${filtered.length === 0 ? `
            <div class="catalog-empty-container">
              <div class="catalog-empty-icon-wrap">
                <div class="catalog-empty-icon-bg">
                  ${Icons.package(44, '#2563eb')}
                </div>
              </div>

              <h3 class="catalog-empty-title">
                Nenhum produto encontrado
              </h3>

              <p class="catalog-empty-desc">
                Não encontramos produtos que correspondam aos filtros selecionados.
              </p>

              <div class="catalog-empty-actions">
                <button class="btn btn-primary" id="emptyClearFiltersBtn" style="padding: 13px 36px; font-size: 0.95rem; font-weight: 700; border-radius: 8px;">
                  Limpar filtros
                </button>
              </div>
            </div>
          ` : `
            <div class="${viewMode === 'list' ? 'products-list' : 'products-grid'}" id="catalogProductsGrid"></div>
          `}
        </main>
      </div>
    `;

    // Renderiza os Cards de Produtos Reais
    const grid = container.querySelector('#catalogProductsGrid');
    if (grid) {
      filtered.forEach(p => grid.appendChild(createProductCard(p, viewMode)));
    }

    attachFilterEvents();
  }

  function attachFilterEvents() {
    // Alternância Grade / Lista
    const gridBtn = container.querySelector('#viewGridBtn');
    const listBtn = container.querySelector('#viewListBtn');

    if (gridBtn) {
      gridBtn.onclick = () => {
        viewMode = 'grid';
        render();
      };
    }
    if (listBtn) {
      listBtn.onclick = () => {
        viewMode = 'list';
        render();
      };
    }

    // Ordenação
    const sortSelect = container.querySelector('#catalogSortSelect');
    if (sortSelect) {
      sortSelect.onchange = (e) => {
        sortBy = e.target.value;
        render();
      };
    }

    // Checkboxes de Categoria na Sidebar
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

    // Filtros de Preço
    const minInput = container.querySelector('#priceMinInput');
    const maxInput = container.querySelector('#priceMaxInput');
    const priceSlider = container.querySelector('#priceRangeSlider');

    if (minInput) {
      minInput.oninput = () => {
        const val = minInput.value.trim();
        minPrice = val === '' ? 0 : Math.max(0, Number(val));
      };
      minInput.onchange = () => render();
    }

    if (maxInput) {
      maxInput.oninput = () => {
        const val = maxInput.value.trim();
        maxPrice = val === '' ? 6000000 : Math.max(minPrice, Number(val));
        if (priceSlider) priceSlider.value = maxPrice;
        const display = container.querySelector('#priceDisplay');
        if (display) display.textContent = formatPrice(maxPrice);
      };
      maxInput.onchange = () => render();
    }

    if (priceSlider) {
      priceSlider.oninput = () => {
        maxPrice = Number(priceSlider.value);
        if (maxInput) maxInput.value = maxPrice;
        const display = container.querySelector('#priceDisplay');
        if (display) display.textContent = formatPrice(maxPrice);
      };
      priceSlider.onchange = () => render();
    }

    // Checkboxes de Marca
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

    // Em estoque & Em promoção
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

    // Reset Filters
    const resetFilters = () => {
      selectedBrands = [];
      minPrice = 0;
      maxPrice = 6000000;
      onlyInStock = false;
      onlyDeals = false;
      minRating = 0;
      selectedSubcategories = [];
      if (categorySlug) {
        selectedCategories = [categorySlug];
        window.history.replaceState(null, '', window.location.pathname + `#/categoria/${categorySlug}`);
      } else {
        selectedCategories = [];
        window.history.replaceState(null, '', window.location.pathname + '#/catalogo');
      }
      render();
    };

    const clearBtn = container.querySelector('#clearFiltersBtn');
    if (clearBtn) clearBtn.onclick = resetFilters;

    const emptyClearBtn = container.querySelector('#emptyClearFiltersBtn');
    if (emptyClearBtn) emptyClearBtn.onclick = resetFilters;

    // Subchips
    container.querySelectorAll('.cat-subchip').forEach(btn => {
      btn.onclick = () => {
        const subVal = btn.dataset.subVal;
        if (!subVal) {
          selectedSubcategories = [];
          if (categorySlug) {
            window.location.hash = `#/categoria/${categorySlug}`;
          }
        } else {
          selectedSubcategories = [subVal];
          if (categorySlug) {
            window.location.hash = `#/categoria/${categorySlug}/${encodeURIComponent(subVal)}`;
          }
        }
        render();
      };
    });

    // Mobile Drawer
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
  }

  render();
  return container;
}
