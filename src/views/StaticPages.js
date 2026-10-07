// ===================================================================
// STATIC & INSTITUTIONAL VIEWS (Sobre, Contactos, FAQ, Políticas)
// ===================================================================

import { Icons } from '../utils/icons.js';
import { Toast } from '../components/Toast.js';

export function renderAboutView() {
  const el = document.createElement('div');
  el.className = 'container';
  el.innerHTML = `
    <div class="static-page-card">
      <span class="badge" style="background: var(--primary-600); color: #ffffff; margin-bottom: 12px; display: inline-block;">SOBRE A NOVATECH</span>
      <h1 style="font-family: var(--font-display); font-size: 2.25rem; font-weight: 900; margin-bottom: 16px;">
        A Maior Referência em Tecnologia & Eletrônicos em Angola
      </h1>
      <p style="font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.8; margin-bottom: 24px;">
        Fundada em Luanda com o compromisso de democratizar o acesso à tecnologia topo de gama, a <strong>NovaTech Angola</strong> é pioneira no comércio eletrônico profissional de tecnologia, oferecendo marcas globais como Apple, Samsung, Sony, Dell, Microsoft e Asus com garantia oficial e suporte humanizado.
      </p>

      <div class="about-mission-grid">
        <div style="background: #f8fafc; padding: 24px; border-radius: var(--radius-md); border-left: 4px solid var(--primary-600);">
          <h3 style="font-weight: 800; margin-bottom: 8px;">Nossa Missão</h3>
          <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6;">
            Entregar inovação e velocidade para transformar a vida e os negócios dos angolanos através de produtos autênticos e entrega ultrarrápida.
          </p>
        </div>
        <div style="background: #f8fafc; padding: 24px; border-radius: var(--radius-md); border-left: 4px solid var(--accent-emerald);">
          <h3 style="font-weight: 800; margin-bottom: 8px;">Nossa Visão</h3>
          <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6;">
            Ser reconhecida como a plataforma de compras tecnológicas mais confiável, moderna e transparente de toda a África Austral.
          </p>
        </div>
      </div>

      <h2 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; margin-bottom: 12px;">Nosso Showroom Físico</h2>
      <p style="font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.6;">
        Visite o nosso espaço em <strong>Talatona, Luanda - Angola</strong>. Aberto de Segunda a Sábado das 08:30 às 19:00.
      </p>
    </div>
  `;
  return el;
}

export function renderContactView() {
  const el = document.createElement('div');
  el.className = 'container';
  el.innerHTML = `
    <div style="margin: 32px auto 48px auto; max-width: 960px;">
      <h1 style="font-family: var(--font-display); font-size: 2.25rem; font-weight: 900; margin-bottom: 8px;">
        Fale com a Nossa Equipa
      </h1>
      <p style="color: var(--text-secondary); margin-bottom: 24px;">
        Estamos sempre disponíveis para esclarecer dúvidas sobre produtos, entregas e suporte técnico.
      </p>

      <div class="contact-layout-grid">
        <!-- Contact Form -->
        <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 32px;">
          <h3 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 16px;">Envie uma Mensagem</h3>
          <form id="contactForm" onsubmit="event.preventDefault();" style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label class="form-label">Nome Completo</label>
              <input type="text" id="cntName" class="form-input" required placeholder="Seu nome" />
            </div>
            <div class="form-group">
              <label class="form-label">E-mail</label>
              <input type="email" id="cntEmail" class="form-input" required placeholder="seu.email@exemplo.com" />
            </div>
            <div class="form-group">
              <label class="form-label">Telefone / WhatsApp</label>
              <input type="tel" id="cntPhone" class="form-input" required placeholder="+244 923 179 192" />
            </div>
            <div class="form-group">
              <label class="form-label">Mensagem ou Dúvida</label>
              <textarea id="cntMsg" rows="4" class="form-input" style="height: auto; padding: 10px;" required placeholder="Como podemos ajudar você hoje?"></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-full">
              Enviar Mensagem
            </button>
          </form>
        </div>

        <!-- Contact Cards -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 24px; display: flex; align-items: flex-start; gap: 16px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: #ecfdf5; color: #047857; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${Icons.whatsapp(24, '#047857')}
            </div>
            <div>
              <h4 style="font-weight: 700; margin-bottom: 4px;">WhatsApp Direto</h4>
              <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 6px;">Atendimento em tempo real de Segunda a Sábado.</p>
              <a href="https://wa.me/244923179192" target="_blank" style="color: var(--primary-600); font-weight: 700; font-size: 0.9375rem;">+244 923 179 192 →</a>
            </div>
          </div>

          <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 24px; display: flex; align-items: flex-start; gap: 16px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: #eff6ff; color: #1e40af; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${Icons.phone(24, '#1e40af')}
            </div>
            <div>
              <h4 style="font-weight: 700; margin-bottom: 4px;">Linha Telefônica</h4>
              <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 6px;">Para compras corporativas e pedidos de empresas.</p>
              <strong style="color: var(--text-main); font-size: 0.9375rem;">+244 923 179 192</strong>
            </div>
          </div>

          <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 24px; display: flex; align-items: flex-start; gap: 16px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: #fdf2f8; color: #be185d; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${Icons.mapPin(24, '#be185d')}
            </div>
            <div>
              <h4 style="font-weight: 700; margin-bottom: 4px;">Showroom NovaTech</h4>
              <p style="font-size: 0.875rem; color: var(--text-secondary);">Talatona, Luanda - Angola</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const form = el.querySelector('#contactForm');
  if (form) {
    form.onsubmit = () => {
      Toast.show({ title: 'Mensagem enviada com sucesso! Responderemos em breve.', type: 'success' });
      form.reset();
    };
  }

  return el;
}

export function renderFAQView() {
  const el = document.createElement('div');
  el.className = 'container';

  const faqs = [
    { q: 'Quais são as formas de pagamento aceitas em Angola?', a: 'Aceitamos Multicaixa Express (com notificação direta no app), Transferência Bancária Imediata (IBAN dos bancos BAI, BFA e BIC com envio do comprovativo), Pagamento por Referência Multicaixa e Pagamento na Entrega por TPA em Luanda.' },
    { q: 'Qual é o prazo de entrega em Luanda?', a: 'Para Luanda (Talatona, Belas, Maianga, Morro Bento, Kilamba, etc.), os pedidos normais são entregues em 24h a 48h. Temos também a modalidade Expressa Mesmo Dia para compras finalizadas até às 13h.' },
    { q: 'Vocês realizam entregas para outras províncias?', a: 'Sim! Entregamos em Benguela, Huambo, Huíla, Cabinda, Cuanza Sul e todas as demais províncias de Angola via parceiros logísticos com prazo de 3 a 5 dias úteis.' },
    { q: 'Os produtos possuem garantia oficial?', a: 'Todos os produtos vendidos pela NovaTech possuem 12 meses de garantia integral contra defeitos de fabricação, com cobertura e assistência técnica em Luanda.' },
    { q: 'Como funciona o Frete Grátis?', a: 'Compras a partir de Kz 1.000.000 (um milhão de Kwanzas) contam com Frete Grátis automático para toda a província de Luanda.' },
    { q: 'Posso retirar o produto pessoalmente na loja?', a: 'Com certeza! Selecione a opção "Levantamento na Loja NovaTech" durante o checkout e retire gratuitamente no nosso Showroom em Talatona, Luanda - Angola.' }
  ];

  el.innerHTML = `
    <div style="margin: 48px auto; max-width: 840px;">
      <h1 style="font-family: var(--font-display); font-size: 2.25rem; font-weight: 900; margin-bottom: 8px;">
        Perguntas Frequentes (FAQ)
      </h1>
      <p style="color: var(--text-secondary); margin-bottom: 32px;">
        Tudo o que você precisa saber sobre compras, entregas e garantias na NovaTech Angola.
      </p>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${faqs.map((f, i) => `
          <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); overflow: hidden;">
            <button class="faq-question-btn" style="width: 100%; text-align: left; padding: 18px 24px; font-size: 1rem; font-weight: 700; color: var(--text-main); display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
              <span>${f.q}</span>
              ${Icons.chevronDown(18, 'var(--primary-600)')}
            </button>
            <div class="faq-answer" style="display: ${i === 0 ? 'block' : 'none'}; padding: 0 24px 20px 24px; font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.6;">
              ${f.a}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  el.querySelectorAll('.faq-question-btn').forEach(btn => {
    btn.onclick = () => {
      const ans = btn.nextElementSibling;
      const isVisible = ans.style.display === 'block';
      ans.style.display = isVisible ? 'none' : 'block';
    };
  });

  return el;
}

export function renderPolicyView(type) {
  const el = document.createElement('div');
  el.className = 'container';

  let title = 'Política de Entrega';
  let content = '';

  if (type === 'entrega') {
    title = 'Política de Envio e Entregas em Angola';
    content = `
      <p>A NovaTech Angola realiza entregas rápidas e seguras em Luanda e em todas as 18 províncias de Angola.</p>
      <h3 style="margin: 16px 0 8px 0; font-weight: 700;">1. Prazos para Luanda</h3>
      <p>Entregas padrão ocorrem em 24h a 48h úteis após a confirmação do pagamento. Entregas expressas no mesmo dia são válidas para pedidos concluídos até às 13:00.</p>
      <h3 style="margin: 16px 0 8px 0; font-weight: 700;">2. Províncias</h3>
      <p>Benguela, Huíla, Huambo, Cabinda: 3 a 5 dias úteis através de transporte aéreo ou rodoviário parceiro devidamente assegurado.</p>
      <h3 style="margin: 16px 0 8px 0; font-weight: 700;">3. Rastreamento</h3>
      <p>Você receberá o código de rastreamento por e-mail e WhatsApp para acompanhar o seu estafeta em tempo real.</p>
    `;
  } else if (type === 'devolucao') {
    title = 'Política de Garantia e Devolução';
    content = `
      <p>A sua satisfação é a nossa prioridade número um.</p>
      <h3 style="margin: 16px 0 8px 0; font-weight: 700;">1. Garantia Oficial de 12 Meses</h3>
      <p>Todos os aparelhos eletrônicos novos contam com 1 ano de garantia contra defeitos técnicos.</p>
      <h3 style="margin: 16px 0 8px 0; font-weight: 700;">2. Prazo de Troca Imediata</h3>
      <p>Em caso de avaria constatada nos primeiros 15 dias após o recebimento, efetuamos a troca imediata por um aparelho novo em stock.</p>
    `;
  } else {
    title = 'Termos de Serviço & Privacidade';
    content = `
      <p>Na NovaTech Angola respeitamos a sua privacidade e garantimos sigilo total dos seus dados de compra e pagamento em conformidade com as leis vigentes da República de Angola.</p>
    `;
  }

  el.innerHTML = `
    <div class="static-page-card">
      <h1 style="font-family: var(--font-display); font-size: 2rem; font-weight: 900; margin-bottom: 20px;">
        ${title}
      </h1>
      <div style="font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.8;">
        ${content}
      </div>
    </div>
  `;
  return el;
}

