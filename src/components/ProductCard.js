// ===================================================================
// PRODUCT CARD COMPONENT
// ===================================================================

import { Icons } from '../utils/icons.js';
import { formatPrice, calcDiscountPercent, renderStars } from '../utils/format.js';
import { Storage } from '../services/storage.js';
import { Toast } from './Toast.js';

export function createProductCard(product) {
  const isWishlisted = Storage.isInWishlist(product.id);
  const discountPct = calcDiscountPercent(product.oldPrice, product.price);

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
      <div class="stars">${renderStars(product.rating)}</div>
      <span class="rating-count">(${product.reviewCount})</span>
    </div>

    <!-- Price Section -->
    <div class="card-price-wrap">
      ${product.oldPrice ? `<span class="price-old">${formatPrice(product.oldPrice)}</span>` : ''}
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
