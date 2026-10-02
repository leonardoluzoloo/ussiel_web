// ===================================================================
// PRODUCT DETAIL VIEW (PDP: Gallery Zoom, Variants, Tabs, Related)
// ===================================================================

import { Icons } from '../utils/icons.js';
import { formatPrice, calcDiscountPercent, renderStars, formatDate } from '../utils/format.js';
// ProductsData removido: produtos são carregados dinamicamente do Supabase
import { Storage } from '../services/storage.js';
import { Toast } from '../components/Toast.js';
import { createProductCard } from '../components/ProductCard.js';
import { Api } from '../services/api.js';

export function renderProductDetailView(productSlug) {
  const container = document.createElement('div');
  container.className = 'container';

  let product = null; // Carregado dinamicamente via Supabase
  let allProducts = []; // Para produtos relacionados

  // State
  let selectedColor = product?.variants?.colors?.[0]?.name || '';
  let selectedStorage = product?.variants?.storage?.[0] || '';
  let quantity = 1;
  let activeTab = 'desc'; // 'desc' | 'specs' | 'reviews' | 'shipping'
  let currentImage = product?.gallery?.[0] || product?.image || '';
  let reviewRating = 5; // estrelas selecionadas pelo usuário no form

  async function syncProduct() {
    try {
      let realProd = await Api.products.getBySlug(productSlug);
      if (!realProd) {
        realProd = await Api.products.getById(productSlug);
      }

      if (realProd) {
        product = {
          ...realProd,
          oldPrice: realProd.old_price !== undefined ? realProd.old_price : realProd.oldPrice,
          badges: Array.isArray(realProd.badges) ? realProd.badges : (realProd.badges ? (typeof realProd.badges === 'string' ? JSON.parse(realProd.badges) : realProd.badges) : []),
          gallery: Array.isArray(realProd.gallery) ? realProd.gallery : (realProd.gallery ? (typeof realProd.gallery === 'string' ? JSON.parse(realProd.gallery) : realProd.gallery) : [realProd.image]),
          variants: (typeof realProd.variants === 'object' && realProd.variants !== null) ? realProd.variants : (realProd.variants ? JSON.parse(realProd.variants) : {}),
          specs: (typeof realProd.specs === 'object' && realProd.specs !== null) ? realProd.specs : (realProd.specs ? JSON.parse(realProd.specs) : {})
        };
        // Carregar avaliações do Supabase (fonte de verdade)
        try {
          product.reviews = await Api.reviews.getByProduct(product.id);
        } catch {
          product.reviews = [];
        }
        product.reviewCount = product.reviews.length;
        // Recalcular rating médio localmente com dados frescos
        if (product.reviews.length > 0) {
          product.rating = product.reviews.reduce((sum, r) => sum + (r.rating || 5), 0) / product.reviews.length;
        }
        if (!selectedColor && product.variants?.colors?.[0]?.name) selectedColor = product.variants.colors[0].name;
        if (!selectedStorage && product.variants?.storage?.[0]) selectedStorage = product.variants.storage[0];
        if (!currentImage) currentImage = product.gallery?.[0] || product.image;
        // Carregar todos os produtos para relacionados
        try {
          allProducts = await Api.products.getAll({ all: false });
        } catch {
          allProducts = [];
        }
        render();
      }
    } catch (e) {
      console.warn('Erro ao carregar detalhes dinâmicos do produto:', e.message);
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
    if (!product) {
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
    const currentPrice = (selectedStorage && product.variants?.storagePrices?.[selectedStorage])
      ? product.variants.storagePrices[selectedStorage]
      : product.price;

    const currentOldPrice = (product.oldPrice && product.price)
      ? Math.round(currentPrice * (product.oldPrice / product.price))
      : null;

    const discountPct = currentOldPrice ? calcDiscountPercent(currentOldPrice, currentPrice) : 0;

    container.innerHTML = `
      <!-- Breadcrumbs -->
      <nav style="display: flex; align-items: center; gap: 8px; font-size: 0.8125rem; color: var(--text-muted); margin-top: 20px;">
        <a href="#/" style="color: var(--text-secondary);">Início</a>
        <span>/</span>
        <a href="#/categoria/${product.category || 'geral'}" style="color: var(--text-secondary); text-transform: capitalize;">${product.category || 'Catálogo'}</a>
        <span>/</span>
        <span style="color: var(--text-main); font-weight: 600;">${product.brand || 'NovaTech'}</span>
        <span>/</span>
        <span style="color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px;">${product.name}</span>
      </nav>

      <!-- Main PDP Grid -->
      <div class="pdp-grid">
        <!-- Gallery (Left) -->
        <div class="pdp-gallery">
          <div class="pdp-main-image-wrap" id="mainImageWrap">
            ${currentImage ? `
              <img src="${currentImage}" alt="${product.name}" class="pdp-main-image" id="mainPdpImage" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
              <div style="display: none; width: 100%; height: 320px; background: #f8fafc; align-items: center; justify-content: center; color: var(--text-muted);">
                ${Icons.package(48)}
              </div>
            ` : `
              <div style="display: flex; width: 100%; height: 320px; background: #f8fafc; align-items: center; justify-content: center; color: var(--text-muted);">
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
          <div class="pdp-brand-sku">
            <span>Marca: <strong>${product.brand}</strong></span>
            <span>•</span>
            <span>Código / SKU: <strong>${product.sku}</strong></span>
            <span>•</span>
            ${(product.is_active === false || product.ativo === false) ? `
              <span style="color: #ef4444; font-weight: 700;">● INDISPONÍVEL</span>
            ` : (product.stock > 0) ? `
              <span style="color: var(--accent-emerald); font-weight: 700;">● EM STOCK (${product.stock} un.)</span>
            ` : `
              <span style="color: #ef4444; font-weight: 700;">● ESGOTADO</span>
            `}
          </div>

          ${(product.is_active === false || product.ativo === false) ? `
            <div style="background: #fee2e2; border: 1px solid #fecaca; color: #991b1b; padding: 12px 16px; border-radius: var(--radius-sm); font-weight: 700; font-size: 0.875rem; margin-top: 12px;">
              ⚠️ Este produto foi desativado temporariamente pela loja e não está disponível para compra.
            </div>
          ` : (product.stock <= 0) ? `
            <div style="background: #fffbeb; border: 1px solid #fef3c7; color: #b45309; padding: 12px 16px; border-radius: var(--radius-sm); font-weight: 700; font-size: 0.875rem; margin-top: 12px;">
              📦 Produto esgotado no momento. Nova remessa a caminho em Luanda!
            </div>
          ` : ''}

          <h1 class="pdp-title">${product.name}</h1>

          <!-- Ratings -->
          <div class="pdp-rating-row">
            <div class="stars">${renderStars(product.rating)}</div>
            <span style="font-weight: 700; color: var(--text-main); font-size: 0.875rem;">${product.rating.toFixed(1)}</span>
            <span style="color: var(--text-muted); font-size: 0.8125rem;">(${product.reviewCount} avaliações de clientes verificados)</span>
          </div>

          <!-- Price Box -->
          <div class="pdp-price-box">
            ${currentOldPrice ? `
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                <span class="pdp-old-price">${formatPrice(currentOldPrice)}</span>
                <span class="badge badge-discount">-${discountPct}% OFF</span>
              </div>
            ` : ''}
            <div class="pdp-current-price">${formatPrice(currentPrice)}</div>
            <div style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 4px;">
              Preço à vista no Multicaixa Express ou Transferência Imediata
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
                  Capacidade / Armazenamento: <strong>${selectedStorage}</strong>
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
            ${(product.is_active !== false && product.ativo !== false && product.stock > 0) ? `
              <div class="pdp-qty-wrap">
                <button class="pdp-qty-btn" id="pdpQtyDec">-</button>
                <input type="text" class="pdp-qty-input" id="pdpQtyVal" value="${quantity}" readonly />
                <button class="pdp-qty-btn" id="pdpQtyInc">+</button>
              </div>

              <button class="btn-pdp-cart" id="pdpAddToCartBtn">
                ${Icons.cart(20, '#ffffff')}
                <span>Adicionar ao Carrinho</span>
              </button>

              <button class="btn-pdp-buy-now" id="pdpBuyNowBtn">
                Comprar Agora
              </button>
            ` : `
              <button class="btn-pdp-cart" id="pdpAddToCartBtn" disabled style="opacity: 0.6; cursor: not-allowed; background: #94a3b8; border-color: #94a3b8;">
                <span>${(product.is_active === false || product.ativo === false) ? 'Produto Desativado' : 'Produto Esgotado'}</span>
              </button>
              <button class="btn-pdp-buy-now" id="pdpBuyNowBtn" disabled style="opacity: 0.6; cursor: not-allowed; background: #cbd5e1; color: #475569;">
                Sem Disponibilidade
              </button>
            `}

            <button class="btn-pdp-wishlist ${isWishlisted ? 'active' : ''}" id="pdpWishlistBtn" title="Favoritar">
              ${Icons.heart(20, isWishlisted ? '#ef4444' : 'currentColor', isWishlisted ? '#ef4444' : 'none')}
            </button>
          </div>

          <!-- Trust Perks -->
          <div class="pdp-trust-box">
            <div class="pdp-trust-item">
              <span class="pdp-trust-icon">${Icons.truck(20)}</span>
              <span><strong>Entrega Rápida em Luanda:</strong> Receba em 24h a 48h com rastreamento</span>
            </div>
            <div class="pdp-trust-item">
              <span class="pdp-trust-icon">${Icons.shieldCheck(20)}</span>
              <span><strong>Garantia Oficial NovaTech:</strong> 12 meses com troca imediata para defeitos</span>
            </div>
            <div class="pdp-trust-item">
              <span class="pdp-trust-icon">${Icons.whatsapp(20, '#25d366')}</span>
              <span>Dúvidas antes de comprar? <a href="https://wa.me/244923179192" target="_blank" style="color: var(--primary-600); text-decoration: underline;">Converse com um especialista no WhatsApp (+244 923 179 192)</a></span>
            </div>
          </div>
        </div>
      </div>

      <!-- PDP Tabs (Descrição, Ficha Técnica, Avaliações, Entrega) -->
      <div class="pdp-tabs-container">
        <div class="pdp-tabs-header">
          <div class="pdp-tab-btn ${activeTab === 'desc' ? 'active' : ''}" data-tab="desc">Descrição do Produto</div>
          <div class="pdp-tab-btn ${activeTab === 'specs' ? 'active' : ''}" data-tab="specs">Ficha Técnica & Especificações</div>
          <div class="pdp-tab-btn ${activeTab === 'reviews' ? 'active' : ''}" data-tab="reviews">Avaliações (${product.reviews?.length || 0})</div>
          <div class="pdp-tab-btn ${activeTab === 'shipping' ? 'active' : ''}" data-tab="shipping">Entrega & Devoluções</div>
        </div>

        <div class="pdp-tab-content">
          ${activeTab === 'desc' ? `
            <div style="max-width: 840px;">
              <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 12px;">
                Visão Geral: ${product.name}
              </h3>
              <p style="margin-bottom: 16px; font-size: 1rem; line-height: 1.8;">
                ${product.description}
              </p>
              <div style="background: #f8fafc; border-left: 4px solid var(--primary-600); padding: 16px 20px; border-radius: 4px; margin-top: 20px;">
                <h4 style="font-weight: 700; color: var(--text-main); margin-bottom: 6px;">Por que comprar na NovaTech Angola?</h4>
                <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">
                  Somos importadores diretos dos maiores fabricantes globais. Todos os equipamentos acompanham fatura fiscal pro-forma, selo de autenticidade e suporte técnico qualificado em Luanda.
                </p>
              </div>
            </div>
          ` : activeTab === 'specs' ? `
            <div>
              <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 16px;">
                Especificações Técnicas Detalhadas
              </h3>
              <table class="tech-specs-table">
                <tbody>
                  ${Object.entries(product.specs || {}).map(([key, val]) => `
                    <tr>
                      <td>${key}</td>
                      <td>${val}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : activeTab === 'reviews' ? `
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
                <div>
                  <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main);">Avaliações de Clientes Verificados</h3>
                  <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                    <div class="stars">${renderStars(product.rating)}</div>
                    <span style="font-weight: 800;">${product.rating.toFixed(1)} de 5.0 estrelas</span>
                  </div>
                </div>
                <button class="btn btn-primary" id="openReviewFormBtn">
                  Escrever uma Avaliação
                </button>
              </div>

              <!-- New Review Form Modal/Inline -->
              <div id="reviewFormBox" style="display: none; background: #f8fafc; border: 1px solid var(--border-light); padding: 20px; border-radius: var(--radius-md); margin-bottom: 24px;">
                <h4 style="font-weight: 700; margin-bottom: 12px;">Deixe a sua opinião sobre este produto</h4>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                  <input type="text" id="newReviewName" placeholder="Seu nome completo" class="form-input" />
                  <!-- Seleção de estrelas -->
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 0.875rem; font-weight: 600; color: var(--text-main);">Sua avaliação</label>
                    <div id="reviewStarPicker" style="display: flex; gap: 6px; cursor: pointer;">
                      ${[1,2,3,4,5].map(s => `
                        <span class="review-star-pick" data-star="${s}" style="font-size: 1.75rem; color: ${s <= reviewRating ? '#f59e0b' : '#d1d5db'}; transition: color 0.15s; user-select: none;">★</span>
                      `).join('')}
                    </div>
                    <input type="hidden" id="newReviewRating" value="${reviewRating}" />
                  </div>
                  <textarea id="newReviewComment" rows="3" placeholder="O que achou do produto, desempenho e entrega?" class="form-input" style="height: auto; padding: 10px;"></textarea>
                  <button class="btn btn-accent" id="submitReviewBtn" style="align-self: flex-start;">
                    Publicar Avaliação
                  </button>
                </div>
              </div>

              <!-- Reviews List -->
              <div style="display: flex; flex-direction: column; gap: 16px;">
                ${(product.reviews || []).length === 0 ? `
                  <div style="background: #ffffff; border: 1.5px dashed var(--border-light); border-radius: var(--radius-sm); padding: 36px 20px; text-align: center; color: var(--text-muted);">
                    <div style="font-size: 1.5rem; margin-bottom: 8px;">⭐</div>
                    <div style="font-weight: 700; color: var(--text-main); margin-bottom: 4px;">Ainda não há avaliações para este produto</div>
                    <p style="font-size: 0.875rem; margin-bottom: 16px;">Comprou este item? Compartilhe a sua experiência e ajude outros compradores!</p>
                    <button class="btn btn-secondary btn-sm" id="emptyStateReviewBtn">
                      Avaliar este Produto
                    </button>
                  </div>
                ` : (product.reviews || []).map(r => `
                  <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 18px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <strong style="color: var(--text-main); font-size: 0.9375rem;">${r.author}</strong>
                        <span style="font-size: 0.72rem; background: #ecfdf5; color: #047857; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Compra Verificada ✓</span>
                      </div>
                      <span style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(r.date)}</span>
                    </div>
                    <div class="stars" style="margin-bottom: 6px;">${renderStars(r.rating || 5)}</div>
                    <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5;">${r.comment}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : `
            <!-- Shipping Info Tab -->
            <div style="max-width: 800px; display: flex; flex-direction: column; gap: 18px;">
              <div>
                <h4 style="font-weight: 700; font-size: 1.125rem; color: var(--text-main); margin-bottom: 6px;">
                  Prazos e Condições de Entrega em Luanda
                </h4>
                <p style="font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.6;">
                  Entregas em Luanda (Talatona, Belas, Morro Bento, Maianga, Kilamba, Viana e arredores) ocorrem em 24h a 48h úteis após a confirmação do pagamento. Disponibilizamos também o modo <strong>Entrega Expressa Mesmo Dia</strong> para pedidos confirmados até as 13:00.
                </p>
              </div>

              <div>
                <h4 style="font-weight: 700; font-size: 1.125rem; color: var(--text-main); margin-bottom: 6px;">
                  Envio para Outras Províncias de Angola
                </h4>
                <p style="font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.6;">
                  Enviamos via transportadoras parceiras oficiais ou via aérea para Benguela, Huíla, Huambo, Cabinda e demais províncias com prazo de 3 a 5 dias úteis.
                </p>
              </div>

              <div>
                <h4 style="font-weight: 700; font-size: 1.125rem; color: var(--text-main); margin-bottom: 6px;">
                  Política de Trocas e Devoluções
                </h4>
                <p style="font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.6;">
                  Garantimos 15 dias de devolução sem complicações caso o produto apresente defeito ou não corresponda à sua expectativa, desde que mantida a embalagem original intacta.
                </p>
              </div>
            </div>
          `}
        </div>
      </div>

      <!-- Related Products: "Você Também Pode Gostar" -->
      <section style="margin-bottom: 48px;">
        <div class="section-head">
          <div class="section-title-wrap">
            <span class="section-tag">Recomendações</span>
            <h2 class="section-title">Você Também Pode Gostar</h2>
          </div>
          <a href="#/categoria/${product.category}" class="section-view-all">
            <span>Ver mais em ${product.category}</span>
            ${Icons.arrowRight(18)}
          </a>
        </div>
        <div class="products-grid" id="relatedProductsGrid"></div>
      </section>

      <!-- Complementary Products: "Quem Comprou Este Produto Também Comprou" -->
      <section style="margin-bottom: 64px;">
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
    const relatedGrid = container.querySelector('#relatedProductsGrid');
    if (relatedGrid) {
      const related = allProducts
        .filter(p => p.is_active !== false && p.ativo !== false &&
          (String(p.category_id) === String(product.category_id) || p.category === product.category) &&
          String(p.id) !== String(product.id))
        .slice(0, 4);
      const relatedToShow = related.length > 0 ? related : allProducts.filter(p => String(p.id) !== String(product.id)).slice(0, 4);
      relatedToShow.forEach(p => relatedGrid.appendChild(createProductCard(p)));
    }

    const alsoBoughtGrid = container.querySelector('#alsoBoughtProductsGrid');
    if (alsoBoughtGrid) {
      const alsoBought = allProducts
        .filter(p => p.is_active !== false && p.ativo !== false && String(p.id) !== String(product.id))
        .slice(0, 4);
      alsoBought.forEach(p => alsoBoughtGrid.appendChild(createProductCard(p)));
    }

    attachPDPEvents();
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
        if (product.is_active === false || product.ativo === false) {
          Toast.show({ title: 'Produto Indisponível', message: 'Este produto foi desativado temporariamente pela loja.', type: 'error' });
          return;
        }
        if (product.stock <= 0) {
          Toast.show({ title: 'Produto Esgotado', message: 'Este produto está sem unidades em estoque no momento.', type: 'warning' });
          return;
        }

        const itemProduct = {
          ...product,
          price: currentPrice
        };
        Storage.addToCart(itemProduct, quantity, { color: selectedColor, storage: selectedStorage });
        Toast.show({
          title: 'Produto adicionado ao carrinho ✓',
          message: `${quantity}x ${product.name} ${selectedStorage ? `(${selectedStorage})` : ''}`,
          type: 'success',
          actionLabel: 'Ver Carrinho →',
          onAction: () => window.dispatchEvent(new CustomEvent('open-mini-cart'))
        });
      };
    }

    // Buy Now
    const buyBtn = container.querySelector('#pdpBuyNowBtn');
    if (buyBtn) {
      buyBtn.onclick = () => {
        if (product.is_active === false || product.ativo === false) {
          Toast.show({ title: 'Produto Indisponível', message: 'Este produto foi desativado temporariamente pela loja.', type: 'error' });
          return;
        }
        if (product.stock <= 0) {
          Toast.show({ title: 'Produto Esgotado', message: 'Este produto está sem unidades em estoque no momento.', type: 'warning' });
          return;
        }

        const itemProduct = {
          ...product,
          price: currentPrice
        };
        Storage.addToCart(itemProduct, quantity, { color: selectedColor, storage: selectedStorage });
        const user = Storage.getUser();
        if (!user) {
          Toast.show({
            title: 'Identificação Necessária',
            message: 'Inicie sessão ou crie uma conta para finalizar a sua compra.',
            type: 'info'
          });
          window.dispatchEvent(new CustomEvent('open-auth-modal'));
          const onLogin = () => {
            window.removeEventListener('user-updated', onLogin);
            window.location.hash = '/checkout';
          };
          window.addEventListener('user-updated', onLogin);
          return;
        }
        window.location.hash = '/checkout';
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

    // Tabs toggle
    container.querySelectorAll('.pdp-tab-btn').forEach(btn => {
      btn.onclick = () => {
        activeTab = btn.dataset.tab;
        render();
      };
    });

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

