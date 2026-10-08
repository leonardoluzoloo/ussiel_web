// ===================================================================
// MINI CART REDIRECTOR (Elimina redundância do drawer e leva ao carrinho completo)
// ===================================================================

export function setupMiniCart() {
  window.addEventListener('open-mini-cart', () => {
    window.location.hash = '/carrinho';
  });
}
