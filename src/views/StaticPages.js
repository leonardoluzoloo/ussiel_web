import { Icons } from '../utils/icons.js';
import { Toast } from '../components/Toast.js';
import { Api } from '../services/api.js';
import { Storage } from '../services/storage.js';

export function renderAboutView() {
  const el = document.createElement('div');
  el.className = 'container';
  el.innerHTML = `
    <div class="static-page-card" style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 36px 32px; margin: 32px auto 48px auto; max-width: 960px; box-shadow: var(--shadow-sm);">
      <span class="badge" style="background: var(--primary-600); color: #ffffff; margin-bottom: 12px; display: inline-block;">SOBRE A NOVATECH</span>
      <h1 style="font-family: var(--font-display); font-size: 2.25rem; font-weight: 900; margin-bottom: 16px;">
        A Maior Referência em Tecnologia & Eletrônicos em Angola
      </h1>
      <p style="font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.8; margin-bottom: 24px;">
        Fundada em Luanda com o compromisso de democratizar o acesso à tecnologia topo de gama, a <strong>NovaTech Angola</strong> é pioneira no comércio eletrônico profissional de tecnologia, oferecendo marcas globais como Apple, Samsung, Sony, Dell, Microsoft e Asus com garantia oficial e suporte humanizado.
      </p>

      <div class="about-mission-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 28px;">
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
        Visite o nosso espaço em <strong>Talatona, Luanda - Angola</strong>. Aberto de Segunda a Sábado das 08:30 às 19:30 e Domingos das 10:00 às 16:00.
      </p>
    </div>
  `;
  return el;
}

export function renderContactView() {
  const el = document.createElement('div');
  el.className = 'container';

  let storeSettings = {
    store_name: 'NovaTech Angola',
    phone: '+244 923 179 192',
    whatsapp: '+244 923 179 192',
    email: 'contacto@novatech.co.ao',
    provincia: 'Luanda',
    cidade: 'Luanda',
    bairro: 'Talatona',
    rua: 'Av. Luanda Sul',
    endereco: 'Talatona Shopping & Maianga, Loja 12',
    ponto_referencia: 'Próximo ao Belas Shopping',
    opening_hours: 'Seg - Sáb: 08:30 às 19:30 | Dom: 10:00 às 16:00'
  };

  async function syncSettings() {
    try {
      const realSettings = await Api.settings.get();
      if (realSettings) {
        storeSettings = {
          ...storeSettings,
          ...realSettings,
          phone: realSettings.phone || realSettings.telefone || storeSettings.phone,
          whatsapp: realSettings.whatsapp || storeSettings.whatsapp,
          email: realSettings.email || storeSettings.email,
          endereco: realSettings.endereco || realSettings.address || storeSettings.endereco,
          ponto_referencia: realSettings.ponto_referencia || storeSettings.ponto_referencia,
          opening_hours: realSettings.opening_hours || realSettings.horario_funcionamento || storeSettings.opening_hours
        };
        render();
      }
    } catch {}
  }

  syncSettings();
  window.addEventListener('settings-updated', () => syncSettings());

  function render() {
    const user = Storage.getUser();
    const cleanWaNumber = (storeSettings.whatsapp || '+244 923 179 192').replace(/\D/g, '');
    const cleanPhone = (storeSettings.phone || '+244 923 179 192').replace(/\D/g, '');

    el.innerHTML = `
      <div style="margin: 32px auto 48px auto; max-width: 1040px;">
        <!-- Breadcrumbs -->
        <nav class="category-breadcrumb" style="margin-bottom: 16px;" aria-label="Navegação">
          <a href="#/">Início</a>
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-current">Contactos & Localização</span>
        </nav>

        <div style="margin-bottom: 28px;">
          <h1 style="font-family: var(--font-display); font-size: 2.25rem; font-weight: 900; margin-bottom: 8px; color: var(--text-main);">
            Canais de Atendimento Oficial
          </h1>
          <p style="color: var(--text-secondary); font-size: 1rem;">
            Estamos disponíveis para esclarecer dúvidas sobre equipamentos, cotações corporativas, entregas em Luanda e suporte técnico especializado.
          </p>
        </div>

        <div class="contact-layout-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px;">
          <!-- Contact Form Real -->
          <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 32px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column;">
            <div style="margin-bottom: 18px;">
              <span class="badge" style="background: var(--primary-50); color: var(--primary-700); font-weight: 700; margin-bottom: 8px; display: inline-block;">ATENDIMENTO DIGITAL</span>
              <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main);">Envie sua Mensagem</h3>
              <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 4px;">Nossa equipa comercial responderá em tempo hábil.</p>
            </div>

            <form id="contactForm" onsubmit="event.preventDefault();" style="display: flex; flex-direction: column; gap: 14px; flex: 1;">
              <div class="form-group">
                <label class="form-label" style="font-size: 0.8125rem; font-weight: 700;">Nome Completo *</label>
                <input type="text" id="cntName" class="form-input" required placeholder="Insira o seu nome" value="${user?.name || ''}" />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label class="form-label" style="font-size: 0.8125rem; font-weight: 700;">E-mail *</label>
                  <input type="email" id="cntEmail" class="form-input" required placeholder="seu@email.com" value="${user?.email || ''}" />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-size: 0.8125rem; font-weight: 700;">Telefone / WhatsApp *</label>
                  <input type="tel" id="cntPhone" class="form-input" required placeholder="+244 923 179 192" value="${user?.phone || user?.whatsapp || ''}" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.8125rem; font-weight: 700;">Assunto / Departamento</label>
                <select id="cntSubject" class="form-input" style="cursor: pointer;">
                  <option value="Dúvidas sobre Produtos & Especificações">Dúvidas sobre Produtos & Especificações</option>
                  <option value="Acompanhamento e Rastreamento de Pedido">Acompanhamento e Rastreamento de Pedido</option>
                  <option value="Vendas Corporativas & Cotações em Quantidade">Vendas Corporativas & Cotações em Quantidade</option>
                  <option value="Garantia Oficial & Assistência Técnica">Garantia Oficial & Assistência Técnica</option>
                  <option value="Outros Assuntos">Outros Assuntos</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.8125rem; font-weight: 700;">Mensagem ou Dúvida *</label>
                <textarea id="cntMsg" rows="4" class="form-input" style="height: auto; padding: 10px; resize: vertical;" required placeholder="Descreva sua solicitação com o máximo de detalhes..."></textarea>
              </div>

              <div style="display: flex; gap: 10px; margin-top: 6px; flex-wrap: wrap;">
                <button type="submit" class="btn btn-primary" style="flex: 1; min-width: 140px; padding: 12px 18px; font-weight: 700; border-radius: var(--radius-md);">
                  <span>Enviar Mensagem</span>
                </button>
                <button type="button" id="sendDirectWhatsAppBtn" class="btn btn-secondary" style="background: #25d366; color: #ffffff; border: none; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; padding: 12px 16px; border-radius: var(--radius-md);" title="Enviar diretamente pelo WhatsApp">
                  ${Icons.whatsapp(18, '#ffffff')}
                  <span>WhatsApp</span>
                </button>
              </div>
            </form>
          </div>

          <!-- Official Contact Channels Cards -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- WhatsApp Oficial -->
            <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 22px; display: flex; align-items: flex-start; gap: 16px; box-shadow: var(--shadow-sm); transition: transform 0.2s ease;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: #ecfdf5; color: #047857; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${Icons.whatsapp(26, '#047857')}
              </div>
              <div style="flex: 1;">
                <span style="font-size: 0.72rem; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.04em;">ATENDIMENTO RÁPIDO</span>
                <h4 style="font-weight: 800; font-size: 1.05rem; margin-top: 2px; margin-bottom: 4px; color: var(--text-main);">WhatsApp Comercial & Suporte</h4>
                <p style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.4;">
                  Tire dúvidas em tempo real, solicite catálogos e confirme a disponibilidade de estoque.
                </p>
                <a href="https://wa.me/${cleanWaNumber}?text=${encodeURIComponent('Olá! Gostaria de informações sobre produtos e compras na NovaTech Angola.')}" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; color: #059669; font-weight: 800; font-size: 0.9375rem; text-decoration: none;">
                  <span>${storeSettings.whatsapp}</span>
                  <span>→ Iniciar Conversa</span>
                </a>
              </div>
            </div>

            <!-- Central Telefônica -->
            <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 22px; display: flex; align-items: flex-start; gap: 16px; box-shadow: var(--shadow-sm);">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: #eff6ff; color: #1e40af; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${Icons.phone(24, '#1e40af')}
              </div>
              <div style="flex: 1;">
                <span style="font-size: 0.72rem; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.04em;">LIGAÇÃO DIRETA</span>
                <h4 style="font-weight: 800; font-size: 1.05rem; margin-top: 2px; margin-bottom: 4px; color: var(--text-main);">Central Telefônica</h4>
                <p style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.4;">
                  Linha de suporte ao cliente para esclarecimentos, compras corporativas e assistência.
                </p>
                <a href="tel:${cleanPhone}" style="display: inline-flex; align-items: center; gap: 6px; color: var(--primary-700); font-weight: 800; font-size: 0.9375rem; text-decoration: none;">
                  <span>${storeSettings.phone}</span>
                  <span>(Clique para Ligar)</span>
                </a>
              </div>
            </div>

            <!-- E-mail Oficial -->
            <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 22px; display: flex; align-items: flex-start; gap: 16px; box-shadow: var(--shadow-sm);">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: #f5f3ff; color: #6d28d9; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              </div>
              <div style="flex: 1;">
                <span style="font-size: 0.72rem; font-weight: 800; color: #6d28d9; text-transform: uppercase; letter-spacing: 0.04em;">E-MAIL CORPORATIVO</span>
                <h4 style="font-weight: 800; font-size: 1.05rem; margin-top: 2px; margin-bottom: 4px; color: var(--text-main);">Cotações & Faturamento</h4>
                <p style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.4;">
                  Envio de propostas comerciais, comprovativos de pagamento e suporte a faturas.
                </p>
                <a href="mailto:${storeSettings.email}" style="color: #6d28d9; font-weight: 800; font-size: 0.9375rem; text-decoration: none;">
                  ${storeSettings.email}
                </a>
              </div>
            </div>

            <!-- Showroom e Localização Real -->
            <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 22px; display: flex; align-items: flex-start; gap: 16px; box-shadow: var(--shadow-sm);">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: #fff1f2; color: #be123c; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${Icons.mapPin(24, '#be123c')}
              </div>
              <div style="flex: 1;">
                <span style="font-size: 0.72rem; font-weight: 800; color: #be123c; text-transform: uppercase; letter-spacing: 0.04em;">LOCALIZAÇÃO & RETIRADA</span>
                <h4 style="font-weight: 800; font-size: 1.05rem; margin-top: 2px; margin-bottom: 4px; color: var(--text-main);">Showroom & Ponto de Retirada</h4>
                <p style="font-size: 0.875rem; font-weight: 700; color: var(--text-main); margin-bottom: 2px;">
                  ${storeSettings.endereco || 'Talatona, Luanda - Angola'}
                </p>
                <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-bottom: 6px;">
                  ${storeSettings.ponto_referencia ? `Ponto de referência: ${storeSettings.ponto_referencia}` : 'Luanda - Angola'}
                </p>
                <div style="display: flex; align-items: center; gap: 6px; font-size: 0.8125rem; color: #047857; font-weight: 700;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  <span>${storeSettings.opening_hours}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Formulário Submit
    const form = el.querySelector('#contactForm');
    if (form) {
      form.onsubmit = () => {
        const name = el.querySelector('#cntName')?.value.trim();
        const email = el.querySelector('#cntEmail')?.value.trim();
        const subject = el.querySelector('#cntSubject')?.value;
        const msg = el.querySelector('#cntMsg')?.value.trim();

        Toast.show({
          title: 'Mensagem enviada com sucesso! 🎉',
          message: `Obrigado, ${name}. Nossa equipe responderá no e-mail ${email} em breve.`,
          type: 'success',
          duration: 6000
        });

        form.reset();
      };
    }

    // Botão de Envio Direto via WhatsApp
    const waBtn = el.querySelector('#sendDirectWhatsAppBtn');
    if (waBtn) {
      waBtn.onclick = () => {
        const name = el.querySelector('#cntName')?.value.trim() || 'Cliente';
        const phone = el.querySelector('#cntPhone')?.value.trim() || '';
        const subject = el.querySelector('#cntSubject')?.value || 'Atendimento Geral';
        const msg = el.querySelector('#cntMsg')?.value.trim() || '';

        const text = `*Mensagem via Formulário de Contacto - NovaTech Angola*\n\n*Nome:* ${name}\n*Telefone:* ${phone}\n*Assunto:* ${subject}\n*Mensagem:* ${msg || 'Gostaria de falar com um consultor.'}`;
        
        window.open(`https://wa.me/${cleanWaNumber}?text=${encodeURIComponent(text)}`, '_blank');
      };
    }
  }

  render();
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

