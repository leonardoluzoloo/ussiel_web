// ===================================================================
// FLOATING WHATSAPP BUTTON WITH INTERACTIVE SUPPORT POPUP
// ===================================================================

import { Icons } from '../utils/icons.js';

export function setupWhatsAppButton() {
  const wrap = document.createElement('div');
  wrap.className = 'whatsapp-float-wrap';

  wrap.innerHTML = `
    <!-- Chat Popup -->
    <div class="whatsapp-chat-popup" id="whatsappPopup">
      <div class="whatsapp-popup-header">
        <div class="whatsapp-avatar">
          ${Icons.whatsapp(24, '#ffffff')}
        </div>
        <div>
          <div class="whatsapp-agent-name">NovaTech Atendimento</div>
          <div class="whatsapp-agent-status">● Online agora (Luanda)</div>
        </div>
        <button id="closeWhatsappPopup" style="margin-left: auto; color: #ffffff; padding: 4px;">
          ${Icons.close(16)}
        </button>
      </div>

      <div class="whatsapp-popup-body">
        <div class="whatsapp-bubble">
          Olá! 👋 Bem-vindo à NovaTech Angola. Como podemos ajudar hoje?
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
          <button class="quick-wa-btn" data-msg="Olá! Gostaria de tirar dúvidas sobre um produto." style="text-align: left; background: #ffffff; border: 1px solid var(--border-light); padding: 6px 10px; border-radius: 8px; font-size: 0.75rem; color: var(--text-main); cursor: pointer;">
            💬 Saber mais sobre um produto
          </button>
          <button class="quick-wa-btn" data-msg="Olá! Como funcionam as entregas em Luanda e províncias?" style="text-align: left; background: #ffffff; border: 1px solid var(--border-light); padding: 6px 10px; border-radius: 8px; font-size: 0.75rem; color: var(--text-main); cursor: pointer;">
            🚚 Prazos e custos de entrega
          </button>
          <button class="quick-wa-btn" data-msg="Olá! Quero pagar com Multicaixa Express ou Transferência." style="text-align: left; background: #ffffff; border: 1px solid var(--border-light); padding: 6px 10px; border-radius: 8px; font-size: 0.75rem; color: var(--text-main); cursor: pointer;">
            💳 Dúvidas sobre pagamentos
          </button>
        </div>
      </div>

      <div class="whatsapp-popup-footer">
        <a href="https://wa.me/244923179192?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20os%20produtos%20da%20NovaTech." target="_blank" class="btn btn-full" style="background: #25d366; color: #ffffff; font-size: 0.8125rem; padding: 10px 14px;">
          ${Icons.whatsapp(18, '#ffffff')}
          <span>Conversar no WhatsApp</span>
        </a>
      </div>
    </div>

    <!-- Floating Trigger Button (Super visível no Desktop e Mobile) -->
    <div class="whatsapp-btn" id="whatsappTriggerBtn" title="Fale conosco no WhatsApp">
      <div class="whatsapp-pulse"></div>
      ${Icons.whatsapp(30, '#ffffff')}
      <div class="whatsapp-btn-text">
        <span class="whatsapp-btn-title">Falar no WhatsApp</span>
        <span class="whatsapp-btn-sub">● Suporte Online Luanda</span>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  const trigger = wrap.querySelector('#whatsappTriggerBtn');
  const popup = wrap.querySelector('#whatsappPopup');
  const closeBtn = wrap.querySelector('#closeWhatsappPopup');

  trigger.onclick = () => {
    popup.classList.toggle('active');
  };

  closeBtn.onclick = () => {
    popup.classList.remove('active');
  };

  wrap.querySelectorAll('.quick-wa-btn').forEach(btn => {
    btn.onclick = () => {
      const msg = encodeURIComponent(btn.dataset.msg);
      window.open(`https://wa.me/244923179192?text=${msg}`, '_blank');
      popup.classList.remove('active');
    };
  });
}
