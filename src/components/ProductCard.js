// ===================================================================
// PRODUCT CARD COMPONENT (Grid & List View Modes)
// ===================================================================

import { Icons } from '../utils/icons.js';
import { formatPrice, calcDiscountPercent, renderStars } from '../utils/format.js';
import { Storage } from '../services/storage.js';
import { Toast } from './Toast.js';

export function createProductCard(product, viewMode = 'grid') {
  if (viewMode === 'list') {
    return createProductListCard(product);
  }

  const isWishlisted = Storage.isInWishlist(product.id);
  const discountPct = calcDiscountPercent(product.oldPrice, product.price);
  const reviewsCount = product.reviewsCount !== undefined ? product.reviewsCount : (product.reviewCount !== undefined ? product.reviewCount : 0);

  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.productId = product.id;

  card.innerHTML = `
    <!-- Card Badges -->
    <div class="card-badges">
      ${discountPct > 0 ? `<span class="badge badge-discount">-${discountPct}%</span>` : ''}
      ${product.badges && product.badges.includes('NOVO') ? `<span class="badge badge-new">NOVO</span>` : ''}
      ${product.badges && product.badges.includes('OFERTA') ? `<span class="badge badge-offer">OFERTA</span>` : ''}
    </div>

    <!-- Wishlist Button -->
    <button class="btn-wishlist ${isWishlisted ? 'active' : ''}" title="Adicionar aos Favoritos" data-wishlist-id="${product.id}">
      ${Icons.heart(18, isWishlisted ? '#ef4444' : 'currentColor', isWishlisted ? '#ef4444' : 'none')}
    </button>

    <!-- Product Image -->
    <div class="card-img-wrap" data-link="/produto/${product.slug || product.id}">
      ${product.image ? `
        <img src="${product.image}" alt="${product.name}" class="card-img" loading="lazy" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
        <div style="display: none; width: 100%; height: 100%; min-height: 180px; background: #f8fafc; align-items: center; justify-content: center; color: var(--text-muted);">
          ${Icons.package(36)}
        </div>
      ` : `
        <div style="display: flex; width: 100%; height: 100%; min-height: 180px; background: #f8fafc; align-items: center; justify-content: center; color: var(--text-muted);">
          ${Icons.package(36)}
        </div>
      `}
    </div>

    <!-- Product Meta -->
    <div class="card-meta">
      <span class="card-brand">${product.brand || 'NovaTech'}</span>
      <span class="card-stock">${product.stock > 0 ? 'Em Stock' : 'Esgotado'}</span>
    </div>

    <!-- Title -->
    <h3 class="card-title" data-link="/produto/${product.slug || product.id}" title="${product.name}">
      ${product.name}
    </h3>

    <!-- Ratings -->
    <div class="card-rating">
      ${reviewsCount > 0 ? `
        <div class="stars">${renderStars(Number(product.rating) || 5)}</div>
        <span class="rating-count">(${reviewsCount})</span>
      ` : `
        <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 500;">Sem avaliações</span>
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
      ${Icons.cart(18, '#ffffff')}
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

  // Quick Add click handler
  const addBtn = card.querySelector('.btn-card-add');
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    // Pick default variant if available
    const defaultColor = product.variants?.colors?.[0]?.name || '';
    const defaultStorage = product.variants?.storage?.[0] || '';
    const itemPrice = (defaultStorage && product.variants?.storagePrices?.[defaultStorage])
      ? product.variants.storagePrices[defaultStorage]
      : product.price;

    Storage.addToCart({ ...product, price: itemPrice }, 1, { color: defaultColor, storage: defaultStorage });

    // Button animation feedback
    const originalText = addBtn.innerHTML;
    addBtn.innerHTML = `${Icons.check(18, '#ffffff')} <span>Adicionado!</span>`;
    addBtn.style.background = '#10b981';

    setTimeout(() => {
      addBtn.innerHTML = originalText;
      addBtn.style.background = '';
    }, 1500);

    // Toast with action
    Toast.show({
      title: 'Produto adicionado ao carrinho ✓',
      message: product.name,
      type: 'success',
      actionLabel: 'Ver Carrinho →',
      onAction: () => {
        window.dispatchEvent(new CustomEvent('open-mini-cart'));
      }
    });
  });

  // Navigation click
  card.querySelectorAll('[data-link]').forEach(el => {
    el.addEventListener('click', () => {
      window.location.hash = el.dataset.link;
    });
  });

  return card;
}

export function createProductListCard(product) {
  const isWishlisted = Storage.isInWishlist(product.id);
  const discountPct = calcDiscountPercent(product.oldPrice, product.price);
  const reviewsCount = product.reviewsCount !== undefined ? product.reviewsCount : (product.reviewCount !== undefined ? product.reviewCount : 0);

  const card = document.createElement('div');
  card.className = 'product-card-list';
  card.dataset.productId = product.id;

  const curPrice = (product.variants?.storage && product.variants?.storagePrices?.[product.variants.storage[0]])
    ? product.variants.storagePrices[product.variants.storage[0]]
    : product.price;

  card.innerHTML = `
    <!-- Thumbnail -->
    <div class="list-img-wrap" data-link="/produto/${product.slug || product.id}">
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
        <span style="font-size:0.75rem; font-weight:700; color:#2563eb; text-transform:uppercase; letter-spacing:0.04em;">
          ${product.brand || 'NovaTech'}
        </span>
        <span style="font-size:0.75rem; color:${product.stock > 0 ? '#16a34a' : '#ef4444'}; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
          <span style="width:6px; height:6px; border-radius:50%; background:${product.stock > 0 ? '#16a34a' : '#ef4444'};"></span>
          ${product.stock > 0 ? 'Em Stock' : 'Esgotado'}
        </span>
        ${discountPct > 0 ? `<span class="badge badge-discount" style="font-size:0.7rem; padding:1px 6px;">-${discountPct}%</span>` : ''}
      </div>

      <h3 class="list-title" data-link="/produto/${product.slug || product.id}" title="${product.name}">
        ${product.name}
      </h3>

      <div style="display:flex; align-items:center; gap:8px;">
        ${reviewsCount > 0 ? `
          <div class="stars" style="display:inline-flex; gap:2px;">${renderStars(Number(product.rating) || 5)}</div>
          <span style="font-size:0.75rem; color:#64748b;">(${reviewsCount})</span>
        ` : `
          <span style="font-size:0.75rem; color:#94a3b8;">Sem avaliações</span>
        `}
        ${product.variants?.storage && product.variants.storage.length > 1 ? `
          <span style="font-size:0.7rem; color:#64748b; background:#f1f5f9; padding:1px 6px; border-radius:4px;">
            ${product.variants.storage.length} opções
          </span>
        ` : ''}
      </div>
    </div>

    <!-- Price Column -->
    <div class="list-price-col">
      ${(product.oldPrice && Number(product.oldPrice) > Number(product.price)) ? `
        <div class="list-old-price">${formatPrice(product.oldPrice)}</div>
      ` : ''}
      <div class="list-cur-price">${formatPrice(curPrice)}</div>
    </div>

    <!-- Actions Column -->
    <div class="list-action-col">
      <button class="btn-wishlist ${isWishlisted ? 'active' : ''}" title="Adicionar aos Favoritos" data-wishlist-id="${product.id}" style="width:34px; height:34px; border-radius:8px; border:1px solid #e2e8f0; background:#ffffff; display:flex; align-items:center; justify-content:center; cursor:pointer;">
        ${Icons.heart(16, isWishlisted ? '#ef4444' : 'currentColor', isWishlisted ? '#ef4444' : 'none')}
      </button>
      <button class="btn btn-primary btn-sm btn-card-add" data-add-id="${product.id}" style="font-weight:600; padding:8px 14px; font-size:0.8125rem; display:inline-flex; align-items:center; gap:6px;">
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

  // Quick Add click handler
  const addBtn = card.querySelector('.btn-card-add');
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const defaultColor = product.variants?.colors?.[0]?.name || '';
    const defaultStorage = product.variants?.storage?.[0] || '';
    const itemPrice = (defaultStorage && product.variants?.storagePrices?.[defaultStorage])
      ? product.variants.storagePrices[defaultStorage]
      : product.price;

    Storage.addToCart({ ...product, price: itemPrice }, 1, { color: defaultColor, storage: defaultStorage });

    const originalText = addBtn.innerHTML;
    addBtn.innerHTML = `${Icons.check(16, '#ffffff')} <span>Adicionado!</span>`;
    addBtn.style.background = '#10b981';

    setTimeout(() => {
      addBtn.innerHTML = originalText;
      addBtn.style.background = '';
    }, 1500);

    Toast.show({
      title: 'Produto adicionado ao carrinho ✓',
      message: product.name,
      type: 'success',
      actionLabel: 'Ver Carrinho →',
      onAction: () => {
        window.dispatchEvent(new CustomEvent('open-mini-cart'));
      }
    });
  });

  // Navigation click
  card.querySelectorAll('[data-link]').forEach(el => {
    el.addEventListener('click', () => {
      window.location.hash = el.dataset.link;
    });
  });

  return card;
}
