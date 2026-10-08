// ===================================================================
// PRODUCT CARD COMPONENT (Grid & List View Modes)
// ===================================================================

import { Icons } from '../utils/icons.js';
import { formatPrice, calcDiscountPercent, renderStars, getProductSocialStats } from '../utils/format.js';
import { Storage } from '../services/storage.js';
import { Toast } from './Toast.js';

export function createProductCard(product, viewMode = 'grid') {
  if (viewMode === 'list') {
    return createProductListCard(product);
  }

  const isWishlisted = Storage.isInWishlist(product.id);
  const discountPct = calcDiscountPercent(product.oldPrice, product.price);
  const socialStats = getProductSocialStats(product);

  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.productId = product.id;

  card.innerHTML = `
    <!-- Card Badges -->
    <div class="card-badges">
      ${discountPct > 0 ? `<span class="badge badge-discount">-${discountPct}%</span>` : ''}
      ${(product.is_new || product.novo || (product.badges && product.badges.includes('NOVO'))) ? `<span class="badge badge-new">NOVO</span>` : ''}
      ${(product.is_deal || product.oferta || (product.badges && product.badges.includes('OFERTA'))) ? `<span class="badge badge-offer">OFERTA</span>` : ''}
    </div>

    <!-- Wishlist Button -->
    <button class="btn-wishlist ${isWishlisted ? 'active' : ''}" title="Adicionar aos Favoritos" data-wishlist-id="${product.id}">
      ${Icons.heart(16, isWishlisted ? '#ef4444' : 'currentColor', isWishlisted ? '#ef4444' : 'none')}
    </button>

    <!-- Product Image -->
    <div class="card-img-wrap" data-link="/produto/${product.uid || product.slug || product.id}">
      ${product.image ? `
        <img src="${product.image}" alt="${product.name}" class="card-img" loading="lazy" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
        <div style="display: none; width: 100%; height: 100%; min-height: 150px; background: #f8fafc; align-items: center; justify-content: center; color: var(--text-muted);">
          ${Icons.package(32)}
        </div>
      ` : `
        <div style="display: flex; width: 100%; height: 100%; min-height: 150px; background: #f8fafc; align-items: center; justify-content: center; color: var(--text-muted);">
          ${Icons.package(32)}
        </div>
      `}
    </div>

    <!-- Product Meta -->
    <div class="card-meta">
      <span class="card-brand">${(product.brand || product.subcategory_name || 'NOVATECH').toUpperCase()}</span>
      <span class="card-stock">${product.stock > 0 ? 'Em Stock' : 'Esgotado'}</span>
    </div>

    <!-- Title -->
    <h3 class="card-title" data-link="/produto/${product.uid || product.slug || product.id}" title="${(product.name || '').toUpperCase()}">
      ${(product.name || '').toUpperCase()}
    </h3>

    <!-- Ratings & Vendas Reais -->
    <div class="card-rating">
      ${socialStats.hasSales ? `<span class="card-sold-count">${socialStats.soldFormatted}</span>` : ''}
      <div class="stars">${renderStars(socialStats.rating)}</div>
      ${socialStats.hasReviews ? `
        <span class="card-rating-score">${socialStats.rating.toFixed(1)}</span>
        <span class="rating-count">(${socialStats.reviewsCount})</span>
      ` : `
        <span class="card-rating-score card-rating-zero">0.0</span>
        <span class="rating-count">(0)</span>
      `}
    </div>

    <!-- Price Section -->
    <div class="card-price-wrap">
      ${(product.oldPrice && Number(product.oldPrice) > Number(product.price)) ? `<span class="price-old">${formatPrice(product.oldPrice)}</span>` : ''}
      <div style="display: flex; align-items: baseline; gap: 4px;">
        <span class="price-current">${formatPrice((product.variants?.storage && product.variants?.storagePrices?.[product.variants.storage[0]]) ? product.variants.storagePrices[product.variants.storage[0]] : product.price)}</span>
      </div>
      ${product.variants?.storage && product.variants.storage.length > 1 ? `
        <span style="font-size: 0.7rem; color: var(--primary-600); font-weight: 600; display: block; margin-top: 2px;">
          ${product.variants.storage.length} opções de capacidade
        </span>
      ` : ''}
    </div>

    <!-- Add to Cart CTA -->
    <button class="btn-card-add" data-add-id="${product.id}">
      ${Icons.cart(16, '#ffffff')}
      <span>Adicionar</span>
    </button>
  `;

  // Wishlist click handler
  const wishlistBtn = card.querySelector('.btn-wishlist');
  wishlistBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const added = Storage.toggleWishlist(product.id);
    wishlistBtn.classList.toggle('active', added);
    wishlistBtn.innerHTML = Icons.heart(18, added ? '#ef4444' : 'currentColor', added ? '#ef4444' : 'none');

    Toast.show({
      title: added ? 'Adicionado aos Favoritos ❤️' : 'Removido dos Favoritos',
      message: product.name,
      type: 'success',
      duration: 3000
    });
  });

  // Quick Add click handler (apenas adiciona ao carrinho, sem redirecionar)
  const addBtn = card.querySelector('.btn-card-add');
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    try {
      // Pick default variant if available
      const defaultColor = product.variants?.colors?.[0]?.name || '';
      const defaultStorage = product.variants?.storage?.[0] || '';
      const itemPrice = (defaultStorage && product.variants?.storagePrices?.[defaultStorage])
        ? product.variants.storagePrices[defaultStorage]
        : product.price;

      Storage.addToCart({ ...product, price: itemPrice }, 1, { color: defaultColor, storage: defaultStorage });

      // Feedback visual momentâneo no botão
      const originalContent = addBtn.innerHTML;
      addBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Adicionado</span>
      `;
      addBtn.style.background = '#16a34a';
      addBtn.style.borderColor = '#16a34a';

      setTimeout(() => {
        addBtn.innerHTML = originalContent;
        addBtn.style.background = '';
        addBtn.style.borderColor = '';
      }, 1400);

      Toast.show({
        title: 'Adicionado ao Carrinho 🛒',
        message: `${product.name} foi adicionado ao seu carrinho.`,
        type: 'success',
        duration: 2500
      });
    } catch (err) {
      Toast.show({
        title: 'Atenção ao Adicionar',
        message: err.message || 'Não foi possível adicionar o produto.',
        type: 'warning',
        duration: 3000
      });
    }
  });

    // Navigation click (no card inteiro e nos elementos data-link)
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-wishlist') || e.target.closest('.btn-card-add') || e.target.closest('button')) {
        return;
      }
      const prodTarget = product.uid || product.slug || product.id;
      window.location.hash = `/produto/${encodeURIComponent(prodTarget)}`;
    });

    return card;
  }

export function createProductListCard(product) {
  const isWishlisted = Storage.isInWishlist(product.id);
  const discountPct = calcDiscountPercent(product.oldPrice, product.price);
  const socialStats = getProductSocialStats(product);

  const card = document.createElement('div');
  card.className = 'product-card-list';
  card.dataset.productId = product.id;

  const curPrice = (product.variants?.storage && product.variants?.storagePrices?.[product.variants.storage[0]])
    ? product.variants.storagePrices[product.variants.storage[0]]
    : product.price;

  card.innerHTML = `
    <!-- Thumbnail -->
    <div class="list-img-wrap" data-link="/produto/${product.uid || product.slug || product.id}">
      ${product.image ? `
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
      ` : `
        <div style="color:#94a3b8; display:flex; align-items:center; justify-content:center; width:100%; height:100%;">
          ${Icons.package(24)}
        </div>
      `}
    </div>

    <!-- Info Column -->
    <div class="list-info-col">
      <div class="list-brand-stock">
        <span class="list-brand-tag">
          ${(product.brand || product.subcategory_name || 'NOVATECH').toUpperCase()}
        </span>
        <span class="list-stock-tag" style="color:${product.stock > 0 ? '#16a34a' : '#ef4444'};">
          <span style="width:6px; height:6px; border-radius:50%; background:${product.stock > 0 ? '#16a34a' : '#ef4444'};"></span>
          ${product.stock > 0 ? 'Em Stock' : 'Esgotado'}
        </span>
        ${(product.is_new || product.novo || (product.badges && product.badges.includes('NOVO'))) ? `<span class="badge badge-new" style="font-size:0.6875rem; padding:1px 6px;">NOVO</span>` : ''}
        ${discountPct > 0 ? `<span class="badge badge-discount">-${discountPct}%</span>` : ''}
      </div>

      <h3 class="list-title" data-link="/produto/${product.uid || product.slug || product.id}" title="${(product.name || '').toUpperCase()}">
        ${(product.name || '').toUpperCase()}
      </h3>

      <div class="list-meta-row" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
        ${socialStats.hasSales ? `<span class="card-sold-count">${socialStats.soldFormatted}</span>` : ''}
        <div class="stars" style="display:inline-flex; gap:1px;">${renderStars(socialStats.rating)}</div>
        ${socialStats.hasReviews ? `
          <span class="card-rating-score">${socialStats.rating.toFixed(1)}</span>
          <span class="rating-count">(${socialStats.reviewsCount})</span>
        ` : `
          <span class="card-rating-score card-rating-zero">0.0</span>
          <span class="rating-count">(0)</span>
        `}
        ${product.variants?.storage && product.variants.storage.length > 1 ? `
          <span class="list-variants-badge">
            ${product.variants.storage.length} opções
          </span>
        ` : ''}
      </div>

      <!-- Price for Mobile Screen (Hidden on Desktop) -->
      <div class="list-price-mobile">
        <div class="list-cur-price">${formatPrice(curPrice)}</div>
        ${(product.oldPrice && Number(product.oldPrice) > Number(product.price)) ? `
          <div class="list-old-price">${formatPrice(product.oldPrice)}</div>
        ` : ''}
      </div>
    </div>

    <!-- Price Column (Desktop) -->
    <div class="list-price-col">
      ${(product.oldPrice && Number(product.oldPrice) > Number(product.price)) ? `
        <div class="list-old-price">${formatPrice(product.oldPrice)}</div>
      ` : ''}
      <div class="list-cur-price">${formatPrice(curPrice)}</div>
    </div>

    <!-- Actions Column -->
    <div class="list-action-col">
      <button class="btn-wishlist ${isWishlisted ? 'active' : ''}" title="Adicionar aos Favoritos" data-wishlist-id="${product.id}" aria-label="Favoritar">
        ${Icons.heart(16, isWishlisted ? '#ef4444' : 'currentColor', isWishlisted ? '#ef4444' : 'none')}
      </button>
      <button class="btn btn-primary btn-sm btn-card-add" data-add-id="${product.id}">
        ${Icons.cart(16, '#ffffff')}
        <span>Adicionar</span>
      </button>
    </div>
  `;

  // Wishlist handler
  const wishlistBtn = card.querySelector('.btn-wishlist');
  wishlistBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const added = Storage.toggleWishlist(product.id);
    wishlistBtn.classList.toggle('active', added);
    wishlistBtn.innerHTML = Icons.heart(16, added ? '#ef4444' : 'currentColor', added ? '#ef4444' : 'none');

    Toast.show({
      title: added ? 'Adicionado aos Favoritos ❤️' : 'Removido dos Favoritos',
      message: product.name,
      type: 'success',
      duration: 3000
    });
  });

  // Quick Add click handler (apenas adiciona ao carrinho, sem redirecionar)
  const addBtn = card.querySelector('.btn-card-add');
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    try {
      const defaultColor = product.variants?.colors?.[0]?.name || '';
      const defaultStorage = product.variants?.storage?.[0] || '';
      const itemPrice = (defaultStorage && product.variants?.storagePrices?.[defaultStorage])
        ? product.variants.storagePrices[defaultStorage]
        : product.price;

      Storage.addToCart({ ...product, price: itemPrice }, 1, { color: defaultColor, storage: defaultStorage });

      const originalContent = addBtn.innerHTML;
      addBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Adicionado</span>
      `;
      addBtn.style.background = '#16a34a';
      addBtn.style.borderColor = '#16a34a';

      setTimeout(() => {
        addBtn.innerHTML = originalContent;
        addBtn.style.background = '';
        addBtn.style.borderColor = '';
      }, 1400);

      Toast.show({
        title: 'Adicionado ao Carrinho 🛒',
        message: `${product.name} foi adicionado ao seu carrinho.`,
        type: 'success',
        duration: 2500
      });
    } catch (err) {
      Toast.show({
        title: 'Atenção ao Adicionar',
        message: err.message || 'Não foi possível adicionar o produto.',
        type: 'warning',
        duration: 3000
      });
    }
  });

    // Navigation click (no card de lista inteiro)
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-wishlist') || e.target.closest('.btn-card-add') || e.target.closest('button')) {
        return;
      }
      const prodTarget = product.uid || product.slug || product.id;
      window.location.hash = `/produto/${encodeURIComponent(prodTarget)}`;
    });

    return card;
  }
