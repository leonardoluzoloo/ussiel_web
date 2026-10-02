// ===================================================================
// SITE FOOTER COMPONENT
// ===================================================================

import { Icons } from '../utils/icons.js';
import { Toast } from './Toast.js';

export function createFooter() {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';

  footer.innerHTML = `
    <!-- Newsletter Section -->
    <div class="footer-newsletter-wrap">
      <div class="container footer-newsletter-inner">
        <div class="footer-newsletter-text">
          <h3>Receba as Nossas Ofertas Exclusivas</h3>
          <p style="color: #bfdbfe; font-size: 0.9375rem;">
            Inscreva-se e ganhe <strong>Kz 10.000 OFF</strong> na sua primeira compra com o cupom <strong>NOVATECH10</strong>.
          </p>
        </div>
        <form class="newsletter-form" id="newsletterForm" onsubmit="event.preventDefault();">
          <input 
            type="email" 
            id="newsletterEmail" 
            placeholder="Digite o seu melhor e-mail..." 
            class="newsletter-input" 
            required 
          />
          <button type="submit" class="newsletter-btn">
            Inscrever-me
          </button>
        </form>
      </div>
    </div>

    <!-- Main Footer Columns -->
    <div class="footer-main">
      <div class="container footer-grid">
        <!-- Brand / About Col -->
        <div class="footer-brand-col">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--primary-600); display: flex; align-items: center; justify-content: center; color: #ffffff;">
              ${Icons.cpu(22, '#ffffff')}
            </div>
            <span style="font-family: var(--font-display); font-size: 1.35rem; font-weight: 800; color: #ffffff;">NOVA<span style="color: var(--primary-500);">TECH</span></span>
          </div>
          <p class="footer-desc">
            A sua principal referência em tecnologia, smartphones topo de gama, computadores profissionais e gaming em Luanda. Garantia oficial e suporte de excelência.
          </p>
          <div class="footer-contact-item">
            ${Icons.mapPin(18, '#38bdf8')}
            <span>Talatona, Luanda - Angola</span>
          </div>
          <div class="footer-contact-item">
            ${Icons.phone(18, '#38bdf8')}
            <span>+244 923 179 192</span>
          </div>
        </div>

        <!-- Col 1: A Loja -->
        <div class="footer-nav-card">
          <h4 class="footer-col-title">A Loja</h4>
          <ul class="footer-links-list">
            <li><a href="#/sobre" class="footer-link">Sobre Nós</a></li>
            <li><a href="#/contacto" class="footer-link">Lojas Físicas</a></li>
            <li><a href="#/politica-entrega" class="footer-link">Entregas em Luanda</a></li>
          </ul>
        </div>

        <!-- Col 2: Compras -->
        <div class="footer-nav-card">
          <h4 class="footer-col-title">Compras</h4>
          <ul class="footer-links-list">
            <li><a href="#/" class="footer-link">Início</a></li>
            <li><a href="#/ofertas" class="footer-link">Ofertas</a></li>
            <li><a href="#/novidades" class="footer-link">Lançamentos</a></li>
            <li><a href="#/favoritos" class="footer-link">Favoritos</a></li>
            <li><a href="#/carrinho" class="footer-link">Carrinho</a></li>
          </ul>
        </div>

        <!-- Col 3: Atendimento -->
        <div class="footer-nav-card">
          <h4 class="footer-col-title">Atendimento</h4>
          <ul class="footer-links-list">
            <li><a href="https://wa.me/244923179192" target="_blank" class="footer-link">WhatsApp</a></li>
            <li><a href="tel:+244923179192" class="footer-link">Ligar</a></li>
            <li><a href="#/faq" class="footer-link">Dúvidas / FAQ</a></li>
            <li><a href="#/minha-conta/pedidos" class="footer-link">Rastreamento</a></li>
            <li><a href="#/contacto" class="footer-link">Suporte Técnico</a></li>
          </ul>
        </div>

        <!-- Col 4: Políticas -->
        <div class="footer-nav-card">
          <h4 class="footer-col-title">Políticas</h4>
          <ul class="footer-links-list">
            <li><a href="#/politica-entrega" class="footer-link">Entregas</a></li>
            <li><a href="#/politica-devolucao" class="footer-link">Garantias</a></li>
            <li><a href="#/privacidade" class="footer-link">Privacidade</a></li>
            <li><a href="#/termos" class="footer-link">Termos</a></li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Bottom / Payment & Copyright -->
    <div class="footer-bottom">
      <div class="container footer-bottom-inner">
        <div>
          © 2026 <strong>NovaTech Angola</strong>. Todos os direitos reservados.
        </div>
        <div class="payment-methods-row">
          <span style="font-size: 0.75rem; color: #cbd5e1; font-weight: 600;">Métodos de Pagamento:</span>
          <span class="payment-pill">MULTICAIXA EXPRESS</span>
          <span class="payment-pill">TRANSFERÊNCIA (IBAN)</span>
          <span class="payment-pill">PAGAMENTO NA ENTREGA (TPA)</span>
          <span class="payment-pill">VISA / MASTERCARD</span>
        </div>
      </div>
    </div>
  `;

  // Newsletter submit
  const form = footer.querySelector('#newsletterForm');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const input = footer.querySelector('#newsletterEmail');
      if (input && input.value) {
        Toast.show({
          title: 'Inscrição realizada com sucesso! 🎉',
          message: `Enviamos o cupom de boas-vindas para ${input.value}. Use NOVATECH10.`,
          type: 'success',
          duration: 5000
        });
        input.value = '';
      }
    };
  }

  return footer;
}
