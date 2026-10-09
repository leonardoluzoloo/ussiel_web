import { Icons } from '../utils/icons.js';
import { Storage } from '../services/storage.js';
import { Api } from '../services/api.js';
import { Toast } from './Toast.js';

// ===================================================================
// MODAL ESTÉTICO DE AVALIAÇÃO DE PRODUTO (COMPARTILHADO)
// ===================================================================
export function showProductReviewModal({ productId, productName, productImage, onSuccess }) {
  const existing = document.querySelector('.product-review-modal-overlay');
  if (existing) existing.remove();

  let selectedRating = 5;
  const ratingLabels = {
    1: '★☆☆☆☆ 1 estrela • Muito Ruim',
    2: '★★☆☆☆ 2 estrelas • Ruim',
    3: '★★★☆☆ 3 estrelas • Razoável',
    4: '★★★★☆ 4 estrelas • Muito Bom',
    5: '★★★★★ 5 estrelas • Excelente!'
  };

  const overlay = document.createElement('div');
  overlay.className = 'product-review-modal-overlay';
  overlay.innerHTML = `
    <div class="product-review-modal-card">
      <div class="product-review-modal-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="color:#f59e0b; font-size:1.25rem;">★</span>
          <h3>Avaliar Produto</h3>
        </div>
        <button type="button" class="product-review-modal-close" id="closeReviewModalBtn" aria-label="Fechar">&times;</button>
      </div>

      <div class="product-review-modal-body">
        <div class="product-review-target-prod">
          ${productImage ? `
            <img src="${productImage}" alt="${productName}" class="product-review-target-thumb" />
          ` : `
            <div class="product-review-target-thumb" style="display:flex;align-items:center;justify-content:center;color:#94a3b8;">
              ${Icons.package(20)}
            </div>
          `}
          <div>
            <div class="product-review-target-name">${productName}</div>
            <div style="font-size: 0.75rem; color: #059669; font-weight: 700; margin-top: 2px;">
              ✓ Compra Verificada em Luanda
            </div>
          </div>
        </div>

        <div>
          <label style="font-size: 0.8125rem; font-weight: 700; color: #0f172a; display: block; margin-bottom: 4px;">
            Qual é a sua nota?
          </label>
          <div class="review-stars-interactive" id="reviewInteractiveStars">
            ${[1, 2, 3, 4, 5].map(s => `
              <span class="review-star-interactive-item ${s <= 5 ? 'active' : ''}" data-star="${s}">★</span>
            `).join('')}
          </div>
          <div class="review-star-label-text" id="reviewRatingLabel">★★★★★ 5 estrelas • Excelente!</div>
        </div>

        <div>
          <label for="reviewCommentText" style="font-size: 0.8125rem; font-weight: 700; color: #0f172a; display: block; margin-bottom: 6px;">
            Seu Comentário ou Avaliação
          </label>
          <textarea id="reviewCommentText" rows="3" class="form-input" placeholder="Conte como foi sua experiência com este produto (qualidade, acabamento, funcionamento)..." style="height: auto; padding: 12px; font-size: 0.875rem; resize: vertical; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%; box-sizing: border-box;"></textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px;">
          <button type="button" class="btn btn-secondary" id="cancelReviewBtn" style="font-size: 0.875rem;">
            Cancelar
          </button>
          <button type="button" class="btn btn-primary" id="submitReviewActionBtn" style="font-size: 0.875rem; font-weight: 700; background: #f59e0b; border-color: #f59e0b;">
            Publicar Avaliação
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const starElements = overlay.querySelectorAll('.review-star-interactive-item');
  const labelEl = overlay.querySelector('#reviewRatingLabel');

  function updateStars(starVal) {
    selectedRating = starVal;
    starElements.forEach(el => {
      const s = Number(el.dataset.star);
      if (s <= starVal) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
    if (labelEl) {
      labelEl.textContent = ratingLabels[starVal] || `${starVal} estrelas`;
    }
  }

  starElements.forEach(el => {
    el.onclick = () => {
      const s = Number(el.dataset.star);
      updateStars(s);
    };
    el.onmouseenter = () => {
      const s = Number(el.dataset.star);
      starElements.forEach(item => {
        item.style.color = Number(item.dataset.star) <= s ? '#f59e0b' : '#cbd5e1';
      });
    };
  });

  const starsContainer = overlay.querySelector('#reviewInteractiveStars');
  if (starsContainer) {
    starsContainer.onmouseleave = () => {
      starElements.forEach(item => {
        item.style.color = '';
      });
      updateStars(selectedRating);
    };
  }

  const closeFn = () => {
    overlay.remove();
    document.removeEventListener('keydown', handleKeydown);
  };
  const handleKeydown = (e) => {
    if (e.key === 'Escape') closeFn();
  };
  document.addEventListener('keydown', handleKeydown);

  overlay.querySelector('#closeReviewModalBtn').onclick = closeFn;
  overlay.querySelector('#cancelReviewBtn').onclick = closeFn;
  overlay.onclick = (e) => {
    if (e.target === overlay) closeFn();
  };

  const submitBtn = overlay.querySelector('#submitReviewActionBtn');
  submitBtn.onclick = async () => {
    const comment = overlay.querySelector('#reviewCommentText').value.trim();
    if (!comment) {
      Toast.show('Por favor, escreva uma breve opinião sobre o produto.', 'warning');
      return;
    }

    const user = Storage.getUser() || {};
    const author = user.name || 'Cliente Verificado';
    const email = user.email || '';

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    try {
      let targetProdId = Number(productId);
      if (isNaN(targetProdId) || !targetProdId) {
        try {
          const found = await Api.products.getBySlug(String(productId));
          if (found?.id) targetProdId = Number(found.id);
        } catch {}
      }

      const newReview = await Api.reviews.create({
        productId: targetProdId || productId,
        author,
        comment,
        rating: selectedRating,
        email
      });
      Toast.show('Muito obrigado! Sua avaliação foi enviada com sucesso.', 'success');
      closeFn();
      if (typeof onSuccess === 'function') {
        onSuccess(newReview);
      }
    } catch (err) {
      Toast.show(err.message || 'Erro ao publicar avaliação.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Publicar Avaliação';
    }
  };
}
