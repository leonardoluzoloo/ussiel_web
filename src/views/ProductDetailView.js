import { Icons } from '../utils/icons.js';
import { formatPrice, calcDiscountPercent, renderStars, formatDate } from '../utils/format.js';
import { Storage } from '../services/storage.js';
import { Toast } from '../components/Toast.js';
import { createProductCard } from '../components/ProductCard.js';
import { Api, findIdByStableUid } from '../services/api.js';

export function renderProductDetailView(productSlug) {
  const container = document.createElement('div');
  container.className = 'container';

  let product = null; // Carregado dinamicamente via Supabase
  let allProducts = []; // Para produtos relacionados
  let allCategories = []; // Para resolução de nomes e links limpos
  let isLoading = true;
  let isNotFound = false;
  let currentPrice = 0;
  let currentOldPrice = null;
  let discountPct = 0;

  // Pré-carregamento imediato do cache local para eliminar delay e piscadas
  try {
    const cachedCatsRaw = localStorage.getItem('novatech_admin_categorias_v4_clean') || localStorage.getItem('novatech_categories_v1');
    allCategories = cachedCatsRaw ? JSON.parse(cachedCatsRaw) : [];
    if (!Array.isArray(allCategories)) allCategories = [];

    const mappedId = findIdByStableUid('produtos', productSlug);
    const cachedRaw = localStorage.getItem('novatech_admin_produtos_v4_clean') || localStorage.getItem('novatech_products_v1');
    const cachedProds = cachedRaw ? JSON.parse(cachedRaw) : [];
    const initialCached = (Array.isArray(cachedProds) ? cachedProds : []).find(p => 
      p.uid === productSlug || 
      p.slug === productSlug || 
      String(p.id) === String(productSlug) ||
      (mappedId && String(p.id) === String(mappedId))
    );
    if (initialCached) {
      const cachedGal = Array.isArray(initialCached.gallery) ? initialCached.gallery.filter(Boolean) : [];
      if (cachedGal.length === 0 && initialCached.image) cachedGal.push(initialCached.image);
      product = {
        ...initialCached,
        gallery: cachedGal
      };
      isLoading = false;
    }
  } catch {}

  // State
  let selectedColor = product?.variants?.colors?.[0]?.name || '';
  let selectedStorage = product?.variants?.storage?.[0] || '';
  let quantity = 1;
  let activeTab = 'desc'; // 'desc' | 'specs' | 'reviews' | 'shipping'
  let currentImage = product?.gallery?.[0] || product?.image || '';
  let reviewRating = 5; // estrelas selecionadas pelo usuário no form
  let hasPurchasedProduct = false; // apenas quem comprou o produto pode avaliar

  async function syncProduct() {
    try {
      let realProd = await Api.products.getBySlug(productSlug);
      if (!realProd) {
        realProd = await Api.products.getById(productSlug);
      }
      if (!realProd) {
        const all = await Api.products.getAll({ all: true });
        realProd = (all || []).find(p =>
          p.uid === productSlug ||
          p.slug === productSlug ||
          String(p.id) === String(productSlug) ||
          p.sku === productSlug
        );
      }

      if (realProd) {
        const rawGal = Array.isArray(realProd.gallery)
          ? realProd.gallery
          : (realProd.gallery && typeof realProd.gallery === 'string')
            ? (JSON.parse(realProd.gallery) || [])
            : [];
        const cleanGal = (Array.isArray(rawGal) ? rawGal : []).filter(Boolean);
        if (cleanGal.length === 0 && realProd.image) {
          cleanGal.push(realProd.image);
        }

        product = {
          ...realProd,
          oldPrice: realProd.old_price !== undefined ? realProd.old_price : realProd.oldPrice,
          badges: Array.isArray(realProd.badges) ? realProd.badges : (realProd.badges ? (typeof realProd.badges === 'string' ? JSON.parse(realProd.badges) : realProd.badges) : []),
          gallery: cleanGal,
          variants: (typeof realProd.variants === 'object' && realProd.variants !== null) ? realProd.variants : (realProd.variants ? JSON.parse(realProd.variants) : {}),
          specs: (typeof realProd.specs === 'object' && realProd.specs !== null) ? realProd.specs : (realProd.specs ? JSON.parse(realProd.specs) : {})
        };
        isLoading = false;
        isNotFound = false;

        // Carregar avaliações do Supabase (fonte de verdade)
        try {
          product.reviews = await Api.reviews.getByProduct(product.id);
        } catch {
          product.reviews = [];
        }
        product.reviewCount = product.reviews.length;
        product.reviewsCount = product.reviews.length;
        // Recalcular rating médio localmente com dados frescos
        if (product.reviews.length > 0) {
          product.rating = product.reviews.reduce((sum, r) => sum + (r.rating || 5), 0) / product.reviews.length;
        }

        // Checagem de comprador verificado (apenas quem comprou pode avaliar)
        try {
          const curUser = Storage.getUser();
          if (curUser) {
            const userOrders = await Api.orders.getMyOrders(curUser);
            const targetProdId = String(product.id || '').toLowerCase();
            const targetSku = String(product.sku || '').toLowerCase();
            const targetName = String(product.name || '').toLowerCase();
            const targetUid = String(product.uid || '').toLowerCase();

            hasPurchasedProduct = (userOrders || []).some(order => {
              const status = String(order.status || '').toLowerCase();
              if (status === 'cancelled' || status === 'cancelado') return false;
              const items = Array.isArray(order.items) ? order.items : (Array.isArray(order.itens) ? order.itens : []);
              return items.some(item => {
                const iId = String(item.product_id || item.productId || item.id || '').toLowerCase();
                const iSku = String(item.sku || '').toLowerCase();
                const iName = String(item.name || item.nome || item.product_name || '').toLowerCase();
                const iUid = String(item.uid || '').toLowerCase();
                return (targetProdId && iId === targetProdId) ||
                       (targetSku && iSku === targetSku) ||
                       (targetUid && iUid === targetUid) ||
                       (targetName && iName === targetName);
              });
            });
          } else {
            hasPurchasedProduct = false;
          }
        } catch {
          hasPurchasedProduct = false;
        }
        if (!selectedColor && product.variants?.colors?.[0]?.name) selectedColor = product.variants.colors[0].name;
        if (!selectedStorage && product.variants?.storage?.[0]) selectedStorage = product.variants.storage[0];
        currentImage = product.gallery?.[0] || product.image || '';
        // Carregar categorias para breadcrumbs e links
        try {
          const freshCats = await Api.categories.getAll();
          if (freshCats && freshCats.length > 0) allCategories = freshCats;
        } catch {}

        // Carregar todos os produtos para relacionados
        try {
          allProducts = await Api.products.getAll({ all: false });
        } catch {
          allProducts = [];
        }
        render();
      } else {
        isLoading = false;
        isNotFound = true;
        render();
      }
    } catch (e) {
      isLoading = false;
      isNotFound = true;
      render();
    }
  }

  syncProduct();

  // Sincronização em tempo real das alterações do Admin (Preço, Estoque, Imagens, Status)
  const onProductUpdated = (e) => {
    const detail = e.detail;
    if (!detail || !detail.product || String(detail.product.id) === String(product?.id) || detail.product.slug === productSlug) {
      syncProduct();
    }
  };
  window.addEventListener('products-updated', onProductUpdated);
  window.addEventListener('stock-updated', syncProduct);

  function render() {
    if (isLoading) {
      container.innerHTML = `
        <div style="padding: 32px 0 64px 0; max-width: 1200px; margin: 0 auto;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 40px; align-items: start;">
            <div style="background: #f1f5f9; border-radius: var(--radius-lg); height: 460px; animation: pulse 1.5s infinite;"></div>
            <div style="display: flex; flex-direction: column; gap: 18px;">
              <div style="height: 24px; width: 35%; background: #e2e8f0; border-radius: 6px;"></div>
              <div style="height: 40px; width: 90%; background: #e2e8f0; border-radius: 8px;"></div>
              <div style="height: 32px; width: 45%; background: #e2e8f0; border-radius: 6px;"></div>
              <div style="height: 90px; width: 100%; background: #f1f5f9; border-radius: 8px;"></div>
              <div style="height: 52px; width: 100%; background: #e2e8f0; border-radius: 10px;"></div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    if (!product || isNotFound) {
      container.innerHTML = `
        <div style="max-width: 540px; margin: 64px auto; background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 48px 32px; text-align: center; box-shadow: var(--shadow-sm);">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: #f1f5f9; color: var(--text-muted); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto;">
            ${Icons.package(32)}
          </div>
          <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">
            Produto não encontrado
          </h2>
          <p style="color: var(--text-secondary); font-size: 0.9375rem; margin-bottom: 24px; line-height: 1.6;">
            O produto selecionado não está disponível no catálogo da loja no momento.
          </p>
          <a href="#/" class="btn btn-primary" style="padding: 12px 28px;">
            Explorar Loja
          </a>
        </div>
      `;
      return;
    }

    const isWishlisted = Storage.isInWishlist(product.id);
    const basePrice = Number(product.price || product.preco || 0);
    currentPrice = (selectedStorage && product.variants?.storagePrices?.[selectedStorage])
      ? Number(product.variants.storagePrices[selectedStorage])
      : basePrice;

    currentOldPrice = (product.oldPrice && basePrice > 0)
      ? Math.round(currentPrice * (Number(product.oldPrice) / basePrice))
      : null;

    discountPct = (currentOldPrice && currentOldPrice > currentPrice) ? calcDiscountPercent(currentOldPrice, currentPrice) : 0;

    // Resolução precisa da categoria para Breadcrumbs e Links
    const prodCatIdentifier = String(product.category_id || product.category || '').toLowerCase();
    const resolvedCat = (allCategories || []).find(c =>
      String(c.id).toLowerCase() === prodCatIdentifier ||
      String(c.uid || '').toLowerCase() === prodCatIdentifier ||
      String(c.slug || '').toLowerCase() === prodCatIdentifier ||
      String(c.name || '').toLowerCase() === prodCatIdentifier
    );

    let catDisplayName = resolvedCat?.name || product.category_name || '';
    if (!catDisplayName || !isNaN(catDisplayName)) {
      catDisplayName = (product.brand ? product.brand : 'Produtos');
    }
    const catSlug = resolvedCat?.slug || (resolvedCat?.id ? String(resolvedCat.id) : '') || product.category_slug || (typeof product.category === 'string' ? product.category : '') || '';

    const productReviews = Array.isArray(product.reviews) ? product.reviews : [];
    const totalReviewsCount = productReviews.length > 0 ? productReviews.length : Number(product.reviewsCount || 0);
    const calculatedRating = productReviews.length > 0
      ? Number((productReviews.reduce((sum, r) => sum + Number(r.rating || r.avaliacao || 0), 0) / productReviews.length).toFixed(1))
      : (product.rating ? Number(product.rating) : 0);
    const hasReviews = totalReviewsCount > 0 && calculatedRating > 0;

    const productDesc = (product.description && product.description !== 'undefined' && product.description !== 'null' && product.description.trim() !== '')
      ? product.description
      : ((product.descricao && product.descricao !== 'undefined' && product.descricao !== 'null' && product.descricao.trim() !== '')
        ? product.descricao
        : ((product.detalhes && product.detalhes !== 'undefined' && product.detalhes.trim() !== '')
          ? product.detalhes
          : ''));

    container.innerHTML = `
      <!-- Breadcrumbs -->
      <nav style="display: flex; align-items: center; gap: 8px; font-size: 0.8125rem; color: var(--text-muted); margin-top: 18px; margin-bottom: 6px; flex-wrap: wrap;">
        <a href="#/" style="color: var(--text-secondary); text-decoration: none;">Início</a>
        ${catDisplayName ? `
          <span>/</span>
          <a href="${catSlug ? `#/categoria/${catSlug}` : '#/catalogo'}" style="color: var(--text-secondary); text-decoration: none;">${catDisplayName}</a>
        ` : ''}
        ${product.brand && product.brand.toLowerCase() !== catDisplayName.toLowerCase() ? `
          <span>/</span>
          <span style="color: var(--text-secondary);">${product.brand}</span>
        ` : ''}
        <span>/</span>
        <span style="color: var(--text-main); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px;">${product.name || 'Produto'}</span>
      </nav>

      <!-- Main PDP Grid -->
      <div class="pdp-grid">
        <!-- Gallery (Left) -->
        <div class="pdp-gallery">
          <div class="pdp-main-image-wrap" id="mainImageWrap">
            ${currentImage ? `
              <img src="${currentImage}" alt="${product.name || 'Produto'}" class="pdp-main-image" id="mainPdpImage" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
              <div style="display: none; width: 100%; height: 100%; min-height: 280px; background: #f8fafc; align-items: center; justify-content: center; color: var(--text-muted);">
                ${Icons.package(48)}
              </div>
            ` : `
              <div style="display: flex; width: 100%; height: 100%; min-height: 280px; background: #f8fafc; align-items: center; justify-content: center; color: var(--text-muted);">
                ${Icons.package(48)}
              </div>
            `}
          </div>

          ${(product.gallery && product.gallery.length > 1) ? `
            <div class="pdp-thumbs-row">
              ${product.gallery.map(img => `
                <div class="pdp-thumb ${img === currentImage ? 'active' : ''}" data-thumb-src="${img}">
                  <img src="${img}" alt="${product.name}" />
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Details (Right) -->
        <div class="pdp-details">
          <div class="pdp-meta-row" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
            ${product.brand ? `
              <span class="pdp-badge-brand" style="font-size: 0.75rem; font-weight: 700; color: #1e293b; background: #f1f5f9; padding: 3px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">${product.brand}</span>
            ` : ''}
            ${(product.is_active === false || product.ativo === false) ? `
              <span style="color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; font-weight: 700; font-size: 0.75rem; padding: 3px 8px; border-radius: 6px;">Indisponível</span>
            ` : (product.stock > 0) ? `
              <span style="color: #15803d; background: #f0fdf4; border: 1px solid #bbf7d0; font-weight: 700; font-size: 0.75rem; padding: 3px 8px; border-radius: 6px;">● Em estoque (${product.stock} un.)</span>
            ` : `
              <span style="color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; font-weight: 700; font-size: 0.75rem; padding: 3px 8px; border-radius: 6px;">Esgotado</span>
            `}
          </div>

          <h1 class="pdp-title">${product.name}</h1>

          <!-- Price Section -->
          <div class="pdp-price-section" style="margin-bottom: 18px;">
            ${currentOldPrice ? `
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                <span class="pdp-old-price">${formatPrice(currentOldPrice)}</span>
                <span class="pdp-discount-tag" style="background: #fee2e2; color: #dc2626; font-size: 0.75rem; font-weight: 800; padding: 2px 7px; border-radius: 4px;">-${discountPct}% OFF</span>
              </div>
            ` : ''}
            <div class="pdp-current-price" style="font-family: var(--font-display); font-size: 2rem; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">
              ${formatPrice(currentPrice)}
            </div>
          </div>

          <!-- Variants Selection -->
          <div class="pdp-variants-section">
            <!-- Colors -->
            ${product.variants?.colors ? `
              <div>
                <div class="variant-group-title">
                  Cor: <strong>${selectedColor}</strong>
                </div>
                <div class="color-swatches">
                  ${product.variants.colors.map(c => `
                    <div 
                      class="color-swatch ${c.name === selectedColor ? 'active' : ''}" 
                      style="background-color: ${c.hex};" 
                      title="${c.name}"
                      data-color-name="${c.name}"
                    ></div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Storage -->
            ${product.variants?.storage ? `
              <div>
                <div class="variant-group-title">
                  Capacidade: <strong>${selectedStorage}</strong>
                </div>
                <div class="variant-pills">
                  ${product.variants.storage.map(s => {
                    const sPrice = product.variants.storagePrices?.[s];
                    return `
                      <div class="variant-pill ${s === selectedStorage ? 'active' : ''}" data-storage-val="${s}">
                        <span style="font-weight: 700;">${s}</span>
                        ${sPrice ? `
                          <span style="display: block; font-size: 0.75rem; color: ${s === selectedStorage ? '#ffffff' : 'var(--primary-600)'}; font-weight: 600; margin-top: 2px;">
                            ${formatPrice(sPrice)}
                          </span>
                        ` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Quantity and Action Buttons -->
          <div class="pdp-cta-row">
            ${(product.is_active !== false && product.ativo !== false && (product.stock > 0 || product.allow_out_of_stock_sales)) ? `
              <div class="pdp-actions-grid">
                <!-- Linha 1: [ - 1 + ] + [ ❤️ Favoritos ] + [ 🛒 Adicionar ao Carrinho depois do coração ] -->
                <div class="pdp-main-actions-row">
                  <div class="pdp-qty-wrap">
                    <button type="button" class="pdp-qty-btn" id="pdpQtyDec" aria-label="Diminuir">-</button>
                    <input type="text" class="pdp-qty-input" id="pdpQtyVal" value="${quantity}" readonly aria-label="Quantidade" />
                    <button type="button" class="pdp-qty-btn" id="pdpQtyInc" aria-label="Aumentar">+</button>
                  </div>

                  <button type="button" class="btn-pdp-wishlist ${isWishlisted ? 'active' : ''}" id="pdpWishlistBtn" title="Favoritar">
                    ${Icons.heart(16, isWishlisted ? '#ef4444' : 'currentColor', isWishlisted ? '#ef4444' : 'none')}
                  </button>

                  <button type="button" class="btn-pdp-cart" id="pdpAddToCartBtn">
                    <span>Adicionar ao carrinho</span>
                  </button>
                </div>

                <!-- Linha 2: Comprar Agora -->
                <button type="button" class="btn-pdp-buy-now" id="pdpBuyNowBtn">
                  <span>Comprar Agora</span>
                </button>
              </div>
            ` : `
              <button class="btn-pdp-cart" disabled style="opacity: 0.6; cursor: not-allowed; background: #94a3b8; border-color: #94a3b8;">
                <span>${(product.is_active === false || product.ativo === false) ? 'Produto Desativado' : 'Produto Esgotado'}</span>
              </button>
            `}
          </div>

          <!-- Professional Benefits Strip -->
          <div class="pdp-benefits-strip" style="display: flex; flex-direction: column; gap: 8px; margin-top: 18px; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.8125rem; font-weight: 600; color: #334155;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: #eff6ff; color: #2563eb; flex-shrink: 0;">
                ${Icons.truck(16)}
              </span>
              <span>Entrega Grátis em Luanda</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: #f0fdf4; color: #16a34a; flex-shrink: 0;">
                ${Icons.shieldCheck(16)}
              </span>
              <span>3 Meses de Garantia</span>
            </div>
          </div>

          <!-- Botão Fora da Borda de Entregas: Ver Detalhes do Produto (Abre Modal com Descrição e Ficha Técnica) -->
          <button type="button" class="btn-pdp-view-details" id="pdpOpenDetailsModalBtn" style="margin-top: 12px; width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 11px 16px; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 0.875rem; font-weight: 700; color: #0f172a; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: flex; align-items: center; color: var(--primary-600);">${Icons.fileText(18)}</span>
              <span>Ver Detalhes do Produto</span>
            </div>
            <span style="display: flex; align-items: center; color: #64748b;">${Icons.chevronRight(16)}</span>
          </button>
        </div>
      </div>

      <!-- Modal de Detalhes do Produto (Abas lado a lado: Descrição e Ficha Técnica) -->
      <div class="pdp-details-modal-overlay" id="pdpDetailsModal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px); z-index: 99999; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;">
        <div class="pdp-details-modal-box" style="background: #ffffff; border-radius: 14px; width: 100%; max-width: 760px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.25); border: 1px solid #e2e8f0; overflow: hidden;">
          <!-- Header do Modal -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid #f1f5f9; background: #ffffff;">
            <div>
              <h3 style="font-size: 1.125rem; font-weight: 800; color: #0f172a; margin: 0;">Detalhes do Produto</h3>
              <p style="font-size: 0.8125rem; color: #64748b; margin: 2px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 480px;">${product.name || 'Produto'}</p>
            </div>
            <button type="button" id="pdpCloseDetailsModalBtn" aria-label="Fechar" style="background: #f1f5f9; border: none; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; color: #64748b; cursor: pointer; transition: all 0.15s; flex-shrink: 0;">
              ${Icons.close(16)}
            </button>
          </div>

          <!-- Abas Navegáveis lado a lado (Side-by-side tabs) -->
          <div class="pdp-modal-tabs-bar" style="display: flex; border-bottom: 1px solid #e2e8f0; background: #f8fafc; padding: 0 20px; gap: 8px;">
            <button type="button" class="pdp-modal-tab-btn active" data-tab-target="desc" id="pdpModalTabBtnDesc" style="padding: 13px 18px; font-size: 0.875rem; font-weight: 700; color: var(--primary-700); background: transparent; border: none; border-bottom: 2.5px solid var(--primary-600); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.15s; outline: none;">
              ${Icons.fileText(16)}
              <span>Descrição</span>
            </button>
            <button type="button" class="pdp-modal-tab-btn" data-tab-target="specs" id="pdpModalTabBtnSpecs" style="padding: 13px 18px; font-size: 0.875rem; font-weight: 600; color: #64748b; background: transparent; border: none; border-bottom: 2.5px solid transparent; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.15s; outline: none;">
              ${Icons.sliders(16)}
              <span>Ficha Técnica & Especificações</span>
            </button>
          </div>

          <!-- Corpo do Modal com Painéis Alternáveis -->
          <div style="padding: 24px; overflow-y: auto; flex: 1;">
            <!-- Painel 1: Descrição do Produto -->
            <div id="pdpModalPanelDesc" style="display: block;">
              ${productDesc ? `
                <div style="font-size: 0.9375rem; line-height: 1.8; color: #334155; white-space: pre-line;">
                  ${productDesc}
                </div>
              ` : `
                <div style="font-size: 0.875rem; color: #94a3b8; font-style: italic; padding: 24px 0; text-align: center;">
                  Nenhuma descrição detalhada informada para este produto.
                </div>
              `}
            </div>

            <!-- Painel 2: Ficha Técnica & Especificações -->
            <div id="pdpModalPanelSpecs" style="display: none;">
              ${(() => {
                const validSpecs = Object.entries(product.specs || {}).filter(([key, val]) => {
                  const lower = key.toLowerCase().trim();
                  return !['subcategory', 'subcategoria', 'subcategory_id', 'subcategoria_id', 'subcategory_name', 'subcategoria_nome', 'id', 'category_id', 'catalog_id', '_descricao'].includes(lower) &&
                         val !== undefined && val !== null && String(val).trim() !== '';
                });

                if (validSpecs.length === 0) {
                  return `
                    <div style="padding: 24px; color: #64748b; text-align: center; font-size: 0.875rem;">
                      As especificações técnicas detalhadas deste item estão sendo catalogadas. Para cotações empresariais e dúvidas técnicas, fale com nossa equipa no WhatsApp.
                    </div>
                  `;
                }

                return `
                  <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                      <tbody>
                        ${validSpecs.map(([key, val], idx) => {
                          const formattedLabel = key
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase());
                          return `
                            <tr style="border-bottom: 1px solid #f1f5f9; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                              <td style="font-weight: 700; width: 35%; color: #0f172a; padding: 11px 16px; font-size: 0.875rem; border-right: 1px solid #f1f5f9;">${formattedLabel}</td>
                              <td style="color: #475569; padding: 11px 16px; font-size: 0.875rem;">${val}</td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                `;
              })()}
            </div>
          </div>

          <!-- Rodapé do Modal -->
          <div style="padding: 12px 24px; border-top: 1px solid #f1f5f9; background: #f8fafc; display: flex; justify-content: flex-end;">
            <button type="button" id="pdpCloseDetailsModalFooterBtn" class="btn btn-secondary" style="padding: 8px 20px; font-size: 0.875rem; font-weight: 700; border-radius: 8px;">
              Fechar
            </button>
          </div>
        </div>
      </div>

      <!-- Seção Dedicada de Avaliações dos Clientes (Parte Inferior) -->
      <section class="pdp-reviews-section" style="margin: 48px 0; background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 32px 28px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px;">
          <div>
            <h2 style="font-size: 1.375rem; font-weight: 800; color: var(--text-main); margin: 0 0 6px 0;">
              Avaliações dos Clientes
            </h2>
            ${hasReviews ? `
              <div style="display: flex; align-items: center; gap: 10px;">
                <div class="stars">${renderStars(calculatedRating)}</div>
                <span style="font-weight: 800; font-size: 1rem; color: #0f172a;">${calculatedRating.toFixed(1)} / 5.0</span>
                <span style="font-size: 0.875rem; color: var(--text-muted);">(${totalReviewsCount} ${totalReviewsCount === 1 ? 'avaliação' : 'avaliações'})</span>
              </div>
            ` : `
              <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0;">Ainda não há avaliações para este produto.</p>
            `}
          </div>

          ${hasPurchasedProduct ? `
            <button class="btn btn-primary btn-sm" id="openReviewFormBtn" style="display: flex; align-items: center; gap: 8px;">
              ${Icons.edit(15)}
              <span>Escrever Avaliação</span>
            </button>
          ` : ''}
        </div>

        <!-- Form de Avaliação para Comprador Verificado -->
        ${hasPurchasedProduct ? `
          <div id="reviewFormBox" style="display: none; background: #f8fafc; border: 1px solid var(--border-light); padding: 20px; border-radius: var(--radius-md); margin-bottom: 24px;">
            <h4 style="font-weight: 700; font-size: 0.9375rem; color: #0f172a; margin-bottom: 12px;">Deixe a sua opinião sobre este produto</h4>
            <div style="display: flex; flex-direction: column; gap: 14px;">
              <input type="text" id="newReviewName" placeholder="Seu nome completo" class="form-input" value="${(Storage.getUser()?.name || '').replace(/"/g, '&quot;')}" />
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <label style="font-size: 0.8125rem; font-weight: 600; color: var(--text-main);">Sua nota</label>
                <div id="reviewStarPicker" style="display: flex; gap: 6px; cursor: pointer;">
                  ${[1,2,3,4,5].map(s => `
                    <span class="review-star-pick" data-star="${s}" style="font-size: 1.5rem; color: ${s <= reviewRating ? '#f59e0b' : '#d1d5db'}; transition: color 0.15s; user-select: none;">★</span>
                  `).join('')}
                </div>
                <input type="hidden" id="newReviewRating" value="${reviewRating}" />
              </div>
              <textarea id="newReviewComment" rows="3" placeholder="Conte a sua experiência com o produto..." class="form-input" style="height: auto; padding: 12px; font-size: 0.875rem;"></textarea>
              <button class="btn btn-accent btn-sm" id="submitReviewBtn" style="align-self: flex-start;">
                Publicar Avaliação
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Lista de Avaliações -->
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${(product.reviews || []).length === 0 ? `
            <div style="background: #f8fafc; border: 1px dashed var(--border-light); border-radius: var(--radius-md); padding: 36px 20px; text-align: center; color: var(--text-muted);">
              <p style="font-size: 0.9375rem; color: #64748b; margin: 0;">Nenhuma avaliação registrada para este produto no momento.</p>
              ${hasPurchasedProduct ? `
                <button class="btn btn-primary btn-sm" id="emptyStateReviewBtn" style="margin-top: 14px;">
                  Seja o primeiro a avaliar
                </button>
              ` : ''}
            </div>
          ` : (product.reviews || []).map(r => `
            <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 18px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <strong style="color: var(--text-main); font-size: 0.875rem;">${r.author}</strong>
                  <span style="font-size: 0.6875rem; background: #ecfdf5; color: #047857; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Compra Verificada ✓</span>
                </div>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(r.date)}</span>
              </div>
              <div class="stars" style="margin-bottom: 8px;">${renderStars(r.rating || 5)}</div>
              <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; margin: 0;">${r.comment}</p>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Related Products: "Você Também Pode Gostar" -->
      <section style="margin-bottom: 48px;" id="relatedSection">
        <div class="section-head">
          <div class="section-title-wrap">
            <span class="section-tag">Recomendações</span>
            <h2 class="section-title">Você Também Pode Gostar</h2>
          </div>
          <a href="#/categoria/${catSlug}" class="section-view-all">
            <span>Ver mais em ${catDisplayName}</span>
            ${Icons.arrowRight(18)}
          </a>
        </div>
        <div class="products-grid" id="relatedProductsGrid"></div>
      </section>

      <!-- Complementary Products: "Quem Comprou Este Produto Também Comprou" -->
      <section style="margin-bottom: 64px;" id="alsoBoughtSection">
        <div class="section-head">
          <div class="section-title-wrap">
            <span class="section-tag">Combinações Perfeitas</span>
            <h2 class="section-title">Quem Comprou Este, Também Comprou</h2>
          </div>
        </div>
        <div class="products-grid" id="alsoBoughtProductsGrid"></div>
      </section>
    `;

    // Render related products (dinâmico via Supabase)
    const relatedSection = container.querySelector('#relatedSection');
    const relatedGrid = container.querySelector('#relatedProductsGrid');
    if (relatedGrid && relatedSection) {
      const related = allProducts
        .filter(p => p.is_active !== false && p.ativo !== false &&
          (String(p.category_id) === String(product.category_id) || p.category === product.category) &&
          String(p.id) !== String(product.id))
        .slice(0, 4);
      const relatedToShow = related.length > 0 ? related : allProducts.filter(p => p.is_active !== false && p.ativo !== false && String(p.id) !== String(product.id)).slice(0, 4);
      if (relatedToShow.length > 0) {
        relatedToShow.forEach(p => relatedGrid.appendChild(createProductCard(p)));
        relatedSection.style.display = 'block';
      } else {
        relatedSection.style.display = 'none';
      }
    }

    const alsoBoughtSection = container.querySelector('#alsoBoughtSection');
    const alsoBoughtGrid = container.querySelector('#alsoBoughtProductsGrid');
    if (alsoBoughtGrid && alsoBoughtSection) {
      const alsoBought = allProducts
        .filter(p => p.is_active !== false && p.ativo !== false && String(p.id) !== String(product.id))
        .slice(0, 4);
      if (alsoBought.length > 0) {
        alsoBought.forEach(p => alsoBoughtGrid.appendChild(createProductCard(p)));
        alsoBoughtSection.style.display = 'block';
      } else {
        alsoBoughtSection.style.display = 'none';
      }
    }

    try {
      attachPDPEvents();
    } catch (err) {
      console.error('Erro ao conectar eventos da PDP:', err);
    }
  }

  function attachPDPEvents() {
    // Thumbnail click
    container.querySelectorAll('.pdp-thumb').forEach(thumb => {
      thumb.onclick = () => {
        currentImage = thumb.dataset.thumbSrc;
        const mainImg = container.querySelector('#mainPdpImage');
        if (mainImg) mainImg.src = currentImage;
        container.querySelectorAll('.pdp-thumb').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      };
    });

    // Image Zoom hover
    const imageWrap = container.querySelector('#mainImageWrap');
    const mainImg = container.querySelector('#mainPdpImage');
    if (imageWrap && mainImg) {
      imageWrap.onmousemove = (e) => {
        const rect = imageWrap.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        mainImg.style.transformOrigin = `${x}% ${y}%`;
        mainImg.style.transform = 'scale(1.5)';
      };
      imageWrap.onmouseleave = () => {
        mainImg.style.transform = 'scale(1)';
      };
    }

    // Color Swatches
    container.querySelectorAll('.color-swatch').forEach(sw => {
      sw.onclick = () => {
        selectedColor = sw.dataset.colorName;
        render();
      };
    });

    // Storage Pills
    container.querySelectorAll('.variant-pill').forEach(pill => {
      pill.onclick = () => {
        selectedStorage = pill.dataset.storageVal;
        render();
      };
    });

    // Quantity modifiers
    const decBtn = container.querySelector('#pdpQtyDec');
    const incBtn = container.querySelector('#pdpQtyInc');
    const valInput = container.querySelector('#pdpQtyVal');
    if (decBtn && incBtn && valInput) {
      decBtn.onclick = () => {
        if (quantity > 1) {
          quantity--;
          valInput.value = quantity;
        }
      };
      incBtn.onclick = () => {
        if (quantity < product.stock) {
          quantity++;
          valInput.value = quantity;
        } else {
          Toast.show({ title: 'Limite de stock atingido', message: `Temos ${product.stock} unidades disponíveis.`, type: 'warning' });
        }
      };
    }

    // Add to Cart
    const addBtn = container.querySelector('#pdpAddToCartBtn');
    if (addBtn) {
      addBtn.onclick = () => {
        try {
          if (product.is_active === false || product.ativo === false) {
            Toast.show({ title: 'Produto Indisponível', message: 'Este produto foi desativado temporariamente pela loja.', type: 'error' });
            return;
          }
          if (product.stock <= 0 && !product.allow_out_of_stock_sales) {
            Toast.show({ title: 'Produto Esgotado', message: 'Este produto está sem unidades em estoque no momento.', type: 'warning' });
            return;
          }

          const currentQty = Math.max(1, Number(valInput?.value || quantity || 1));
          const itemProduct = {
            ...product,
            price: currentPrice
          };
          Storage.addToCart(itemProduct, currentQty, { color: selectedColor, storage: selectedStorage });
          Toast.show({
            title: 'Produto adicionado ao carrinho ✓',
            message: `${currentQty} un. • ${product.name} ${selectedStorage ? `(${selectedStorage})` : ''}`,
            type: 'success',
            actionLabel: 'Ver Carrinho →',
            onAction: () => window.dispatchEvent(new CustomEvent('open-mini-cart'))
          });
          window.dispatchEvent(new CustomEvent('open-mini-cart'));
        } catch (err) {
          Toast.show({ title: 'Atenção ao Adicionar', message: err.message || 'Erro ao adicionar item ao carrinho.', type: 'warning' });
        }
      };
    }

    // Buy Now (Garante a quantidade exata selecionada sem duplicar caso já tenha adicionado antes)
    const buyBtn = container.querySelector('#pdpBuyNowBtn');
    if (buyBtn) {
      buyBtn.onclick = () => {
        try {
          if (product.is_active === false || product.ativo === false) {
            Toast.show({ title: 'Produto Indisponível', message: 'Este produto foi desativado temporariamente pela loja.', type: 'error' });
            return;
          }
          if (product.stock <= 0 && !product.allow_out_of_stock_sales) {
            Toast.show({ title: 'Produto Esgotado', message: 'Este produto está sem unidades em estoque no momento.', type: 'warning' });
            return;
          }

          const currentQty = Math.max(1, Number(valInput?.value || quantity || 1));
          const itemProduct = {
            ...product,
            price: currentPrice
          };
          Storage.addToCart(itemProduct, currentQty, { color: selectedColor, storage: selectedStorage }, { overwriteQty: true });
          window.location.hash = '#/checkout';
        } catch (err) {
          Toast.show({ title: 'Erro ao Comprar', message: err.message || 'Não foi possível avançar para o checkout.', type: 'error' });
        }
      };
    }

    // Wishlist
    const wishBtn = container.querySelector('#pdpWishlistBtn');
    if (wishBtn) {
      wishBtn.onclick = () => {
        const added = Storage.toggleWishlist(product.id);
        wishBtn.classList.toggle('active', added);
        wishBtn.innerHTML = Icons.heart(20, added ? '#ef4444' : 'currentColor', added ? '#ef4444' : 'none');
        Toast.show({
          title: added ? 'Adicionado aos Favoritos ❤️' : 'Removido dos Favoritos',
          type: 'success'
        });
      };
    }

    // Modal Detalhes do Produto (Abertura e Fechamento)
    const openDetailsModalBtn = container.querySelector('#pdpOpenDetailsModalBtn');
    const detailsModal = container.querySelector('#pdpDetailsModal');
    const closeDetailsModalBtn = container.querySelector('#pdpCloseDetailsModalBtn');
    const closeDetailsModalFooterBtn = container.querySelector('#pdpCloseDetailsModalFooterBtn');

    const openDetailsModal = () => {
      if (detailsModal) {
        detailsModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      }
    };

    const closeDetailsModal = () => {
      if (detailsModal) {
        detailsModal.style.display = 'none';
        document.body.style.overflow = '';
      }
    };

    if (openDetailsModalBtn) openDetailsModalBtn.onclick = openDetailsModal;
    if (closeDetailsModalBtn) closeDetailsModalBtn.onclick = closeDetailsModal;
    if (closeDetailsModalFooterBtn) closeDetailsModalFooterBtn.onclick = closeDetailsModal;
    if (detailsModal) {
      detailsModal.onclick = (e) => {
        if (e.target === detailsModal) closeDetailsModal();
      };
    }

    // Alternância de abas lado a lado dentro do Modal
    const tabBtnDesc = container.querySelector('#pdpModalTabBtnDesc');
    const tabBtnSpecs = container.querySelector('#pdpModalTabBtnSpecs');
    const panelDesc = container.querySelector('#pdpModalPanelDesc');
    const panelSpecs = container.querySelector('#pdpModalPanelSpecs');

    if (tabBtnDesc && tabBtnSpecs && panelDesc && panelSpecs) {
      tabBtnDesc.onclick = () => {
        tabBtnDesc.classList.add('active');
        tabBtnDesc.style.color = 'var(--primary-700)';
        tabBtnDesc.style.borderBottomColor = 'var(--primary-600)';
        tabBtnDesc.style.fontWeight = '700';

        tabBtnSpecs.classList.remove('active');
        tabBtnSpecs.style.color = '#64748b';
        tabBtnSpecs.style.borderBottomColor = 'transparent';
        tabBtnSpecs.style.fontWeight = '600';

        panelDesc.style.display = 'block';
        panelSpecs.style.display = 'none';
      };

      tabBtnSpecs.onclick = () => {
        tabBtnSpecs.classList.add('active');
        tabBtnSpecs.style.color = 'var(--primary-700)';
        tabBtnSpecs.style.borderBottomColor = 'var(--primary-600)';
        tabBtnSpecs.style.fontWeight = '700';

        tabBtnDesc.classList.remove('active');
        tabBtnDesc.style.color = '#64748b';
        tabBtnDesc.style.borderBottomColor = 'transparent';
        tabBtnDesc.style.fontWeight = '600';

        panelSpecs.style.display = 'block';
        panelDesc.style.display = 'none';
      };
    }

    // Review form toggle
    const openReviewBtn = container.querySelector('#openReviewFormBtn');
    const reviewBox = container.querySelector('#reviewFormBox');
    if (openReviewBtn && reviewBox) {
      openReviewBtn.onclick = () => {
        reviewBox.style.display = reviewBox.style.display === 'none' ? 'block' : 'none';
      };
    }

    // Seleção de estrelas no form
    const starPicker = container.querySelector('#reviewStarPicker');
    if (starPicker) {
      starPicker.querySelectorAll('.review-star-pick').forEach(star => {
        star.onmouseenter = () => {
          const hoverVal = Number(star.dataset.star);
          starPicker.querySelectorAll('.review-star-pick').forEach(s => {
            s.style.color = Number(s.dataset.star) <= hoverVal ? '#f59e0b' : '#d1d5db';
          });
        };
        star.onmouseleave = () => {
          starPicker.querySelectorAll('.review-star-pick').forEach(s => {
            s.style.color = Number(s.dataset.star) <= reviewRating ? '#f59e0b' : '#d1d5db';
          });
        };
        star.onclick = () => {
          reviewRating = Number(star.dataset.star);
          const ratingInput = container.querySelector('#newReviewRating');
          if (ratingInput) ratingInput.value = reviewRating;
          starPicker.querySelectorAll('.review-star-pick').forEach(s => {
            s.style.color = Number(s.dataset.star) <= reviewRating ? '#f59e0b' : '#d1d5db';
          });
        };
      });
    }

    const submitReviewBtn = container.querySelector('#submitReviewBtn');
    if (submitReviewBtn) {
      submitReviewBtn.onclick = async () => {
        if (!hasPurchasedProduct) {
          Toast.show({ title: 'Ação não permitida', message: 'Apenas compradores verificados deste produto podem enviar avaliações.', type: 'warning' });
          return;
        }

        const name = container.querySelector('#newReviewName').value.trim();
        const comment = container.querySelector('#newReviewComment').value.trim();
        const ratingVal = Number(container.querySelector('#newReviewRating')?.value || reviewRating);

        if (!name || !comment) {
          Toast.show({ title: 'Preencha o seu nome e comentário', type: 'warning' });
          return;
        }

        submitReviewBtn.disabled = true;
        submitReviewBtn.textContent = 'Publicando...';

        try {
          // Salvar no Supabase como fonte de verdade
          const newReview = await Api.reviews.create({
            productId: product.id,
            author: name,
            comment,
            rating: ratingVal
          });

          // Atualizar estado local com os dados frescos do banco
          if (!Array.isArray(product.reviews)) product.reviews = [];
          product.reviews.unshift(newReview);
          product.reviewCount = product.reviews.length;
          // Recalcular rating médio localmente
          if (product.reviews.length > 0) {
            product.rating = Number((product.reviews.reduce((sum, r) => sum + (r.rating || 5), 0) / product.reviews.length).toFixed(1));
          }

          Toast.show({ title: 'Avaliação publicada com sucesso! 🎉', message: 'Obrigado pelo seu feedback.', type: 'success' });
          reviewRating = 5; // reset
          render();
        } catch (err) {
          Toast.show({ title: 'Erro ao publicar avaliação', message: err.message, type: 'error' });
          submitReviewBtn.disabled = false;
          submitReviewBtn.textContent = 'Publicar Avaliação';
        }
      };
    }

    const emptyReviewBtn = container.querySelector('#emptyStateReviewBtn');
    if (emptyReviewBtn) {
      emptyReviewBtn.onclick = () => {
        if (openReviewBtn) openReviewBtn.click();
      };
    }
  }

  render();
  return container;
}

