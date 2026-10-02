// ===================================================================
// SITE FOOTER COMPONENT
// ===================================================================

import { Icons } from '../utils/icons.js';
import { Toast } from './Toast.js';

export function createFooter() {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';

  footer.innerHTML = `
    <!-- Newsletter Section Premium -->
    <div class="footer-newsletter-wrap">
      <div class="container footer-newsletter-inner">
        <div class="footer-newsletter-text">
          <div class="footer-newsletter-badge">
            OFERTAS E LANÇAMENTOS EXCLUSIVOS
          </div>
          <h3 class="footer-newsletter-title">Receba Ofertas e Novidades em Primeira Mão</h3>
          <p class="footer-newsletter-desc">
            Cadastre o seu e-mail e ganhe <strong>Kz 10.000 de desconto</strong> na sua primeira compra com o cupom <span class="coupon-chip">NOVATECH10</span>.
          </p>
        </div>
        <form class="newsletter-form" id="newsletterForm" onsubmit="event.preventDefault();">
          <div class="newsletter-input-group">
            <input 
              type="email" 
              id="newsletterEmail" 
              placeholder="Insira o seu e-mail..." 
              class="newsletter-input" 
              required 
            />
          </div>
          <button type="submit" class="newsletter-btn">
            <span>Inscrever-me</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
        </form>
      </div>
    </div>

    <!-- Main Footer Links & Info -->
    <div class="footer-main">
      <div class="container footer-grid">
        <!-- Brand Col -->
        <div class="footer-brand-col">
          <div class="footer-brand-header">
            <div class="footer-brand-logo">
              ${Icons.cpu(22, '#ffffff')}
            </div>
            <div class="footer-brand-name">
              NOVA<span>TECH</span>
            </div>
            <span class="footer-country-badge">🇦🇴 Angola</span>
          </div>
          
          <p class="footer-desc">
            A sua principal referência em tecnologia, smartphones topo de gama, computadores profissionais e gaming em Luanda. Garantia oficial e assistência técnica especializada.
          </p>

          <div class="footer-contacts-list">
            <a href="https://maps.google.com/?q=Talatona,Luanda" target="_blank" class="footer-contact-link">
              <span class="footer-contact-icon">${Icons.mapPin(16, '#38bdf8')}</span>
              <span>Talatona, Luanda - Angola</span>
            </a>
            <a href="tel:+244923179192" class="footer-contact-link">
              <span class="footer-contact-icon">${Icons.phone(16, '#38bdf8')}</span>
              <span>+244 923 179 192</span>
            </a>
            <a href="https://wa.me/244923179192" target="_blank" class="footer-contact-link whatsapp-highlight">
              <span class="footer-contact-icon">${Icons.whatsapp ? Icons.whatsapp(16, '#10b981') : '💬'}</span>
              <span>Atendimento via WhatsApp</span>
            </a>
          </div>
        </div>

        <!-- Col 1: A Loja -->
        <div class="footer-col">
          <h4 class="footer-col-title">A Loja</h4>
          <ul class="footer-links-list">
            <li><a href="#/sobre" class="footer-link">Sobre Nós</a></li>
            <li><a href="#/contacto" class="footer-link">Nossas Lojas</a></li>
            <li><a href="#/politica-entrega" class="footer-link">Entregas em Luanda</a></li>
            <li><a href="#/catalogo" class="footer-link">Catálogo Completo</a></li>
          </ul>
        </div>

        <!-- Col 2: Compras -->
        <div class="footer-col">
          <h4 class="footer-col-title">Compras</h4>
          <ul class="footer-links-list">
            <li><a href="#/" class="footer-link">Início</a></li>
            <li><a href="#/ofertas" class="footer-link">Ofertas da Semana</a></li>
            <li><a href="#/novidades" class="footer-link">Lançamentos</a></li>
            <li><a href="#/favoritos" class="footer-link">Meus Favoritos</a></li>
            <li><a href="#/carrinho" class="footer-link">Carrinho de Compras</a></li>
          </ul>
        </div>

        <!-- Col 3: Atendimento -->
        <div class="footer-col">
          <h4 class="footer-col-title">Atendimento</h4>
          <ul class="footer-links-list">
            <li><a href="https://wa.me/244923179192" target="_blank" class="footer-link">Suporte WhatsApp</a></li>
            <li><a href="tel:+244923179192" class="footer-link">Central Telefônica</a></li>
            <li><a href="#/faq" class="footer-link">Dúvidas Frequentes (FAQ)</a></li>
            <li><a href="#/minha-conta/pedidos" class="footer-link">Rastrear Encomenda</a></li>
            <li><a href="#/contacto" class="footer-link">Fale Conosco</a></li>
          </ul>
        </div>

        <!-- Col 4: Políticas & Segurança -->
        <div class="footer-col">
          <h4 class="footer-col-title">Políticas</h4>
          <ul class="footer-links-list">
            <li><a href="#/politica-entrega" class="footer-link">Prazos de Entrega</a></li>
            <li><a href="#/politica-devolucao" class="footer-link">Garantia & Trocas</a></li>
            <li><a href="#/privacidade" class="footer-link">Privacidade de Dados</a></li>
            <li><a href="#/termos" class="footer-link">Termos de Uso</a></li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Bottom / Payment & Copyright -->
    <div class="footer-bottom">
      <div class="container footer-bottom-inner">
        <div class="footer-copyright">
          © 2026 <strong>NovaTech Angola</strong>. Todos os direitos reservados.
        </div>
        <div class="payment-methods-row">
          <span class="payment-label">Métodos de Pagamento:</span>
          <div class="payment-badges-group">
            <span class="payment-pill"><span class="pill-dot"></span>Multicaixa Express</span>
            <span class="payment-pill">Transferência (IBAN)</span>
            <span class="payment-pill">TPA na Entrega</span>
            <span class="payment-pill">Visa / Mastercard</span>
          </div>
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
