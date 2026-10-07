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
          provincia: realSettings.provincia || storeSettings.provincia,
          cidade: realSettings.cidade || realSettings.municipio || storeSettings.cidade,
          bairro: realSettings.bairro || storeSettings.bairro,
          rua: realSettings.rua || storeSettings.rua,
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

    // Construção do endereço completo em uma única linha
    const addressParts = [];
    if (storeSettings.rua) addressParts.push(storeSettings.rua);
    if (storeSettings.endereco && storeSettings.endereco !== storeSettings.rua) addressParts.push(storeSettings.endereco);
    if (storeSettings.bairro) addressParts.push(storeSettings.bairro);
    if (storeSettings.cidade && storeSettings.cidade !== storeSettings.bairro) addressParts.push(storeSettings.cidade);
    if (storeSettings.provincia && storeSettings.provincia !== storeSettings.cidade) addressParts.push(storeSettings.provincia);
    if (storeSettings.ponto_referencia) addressParts.push(`Ponto de ref.: ${storeSettings.ponto_referencia}`);

    const fullAddress = addressParts.filter(Boolean).join(', ') || 'Luanda, Angola';

    el.innerHTML = `
      <div style="margin: 28px auto 48px auto; max-width: 1000px;">
        <nav class="category-breadcrumb" style="margin-bottom: 14px;" aria-label="Navegação">
          <a href="#/">Início</a>
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-current">Contactos</span>
        </nav>

        <div style="margin-bottom: 24px;">
          <h1 style="font-family: var(--font-display); font-size: 2rem; font-weight: 800; color: #0f172a; margin-bottom: 4px;">
            Contactos
          </h1>
          <p style="color: #64748b; font-size: 0.9375rem;">
            Fale com a nossa equipa de vendas e suporte.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; align-items: start;">
          <!-- Formulário de Mensagem -->
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <h2 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin-bottom: 16px;">
              Enviar mensagem
            </h2>

            <form id="contactForm" onsubmit="event.preventDefault();" style="display: flex; flex-direction: column; gap: 12px;">
              <div class="form-group">
                <label class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #334155;">Nome</label>
                <input type="text" id="cntName" class="form-input" required placeholder="Seu nome" value="${user?.name || ''}" style="height: 40px; font-size: 0.875rem;" />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #334155;">E-mail</label>
                  <input type="email" id="cntEmail" class="form-input" required placeholder="seu@email.com" value="${user?.email || ''}" style="height: 40px; font-size: 0.875rem;" />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #334155;">Telefone</label>
                  <input type="tel" id="cntPhone" class="form-input" required placeholder="+244 923 179 192" value="${user?.phone || user?.whatsapp || ''}" style="height: 40px; font-size: 0.875rem;" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #334155;">Assunto</label>
                <select id="cntSubject" class="form-input" style="height: 40px; font-size: 0.875rem; cursor: pointer;">
                  <option value="Informações sobre Produtos">Informações sobre Produtos</option>
                  <option value="Status do Pedido">Status do Pedido</option>
                  <option value="Vendas Corporativas">Vendas Corporativas</option>
                  <option value="Garantia e Assistência">Garantia e Assistência</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #334155;">Mensagem</label>
                <textarea id="cntMsg" rows="4" class="form-input" style="height: auto; padding: 10px; font-size: 0.875rem; resize: vertical;" required placeholder="Escreva a sua mensagem..."></textarea>
              </div>

              <div style="display: flex; gap: 10px; margin-top: 4px;">
                <button type="submit" class="btn btn-primary" style="flex: 1; height: 42px; font-size: 0.875rem; font-weight: 700; border-radius: 8px;">
                  Enviar
                </button>
                <button type="button" id="sendDirectWhatsAppBtn" class="btn" style="background: #25d366; color: #ffffff; height: 42px; padding: 0 16px; font-size: 0.875rem; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;" title="Conversar no WhatsApp">
                  ${Icons.whatsapp(18, '#ffffff')}
                  <span>WhatsApp</span>
                </button>
              </div>
            </form>
          </div>

          <!-- Informações de Contacto Diretas -->
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <!-- WhatsApp -->
            <a href="https://wa.me/${cleanWaNumber}" target="_blank" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; display: flex; align-items: center; gap: 14px; text-decoration: none; transition: border-color 0.2s ease;">
              <div style="width: 40px; height: 40px; border-radius: 8px; background: #ecfdf5; color: #047857; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${Icons.whatsapp(22, '#047857')}
              </div>
              <div style="flex: 1;">
                <div style="font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase;">WhatsApp</div>
                <div style="font-size: 0.9375rem; font-weight: 700; color: #0f172a;">${storeSettings.whatsapp}</div>
              </div>
              <span style="font-size: 0.8125rem; color: #059669; font-weight: 700;">Abrir →</span>
            </a>

            <!-- Telefone -->
            <a href="tel:${cleanPhone}" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; display: flex; align-items: center; gap: 14px; text-decoration: none; transition: border-color 0.2s ease;">
              <div style="width: 40px; height: 40px; border-radius: 8px; background: #eff6ff; color: #1e40af; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${Icons.phone(20, '#1e40af')}
              </div>
              <div style="flex: 1;">
                <div style="font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Telefone</div>
                <div style="font-size: 0.9375rem; font-weight: 700; color: #0f172a;">${storeSettings.phone}</div>
              </div>
              <span style="font-size: 0.8125rem; color: #2563eb; font-weight: 700;">Ligar →</span>
            </a>

            <!-- E-mail -->
            <a href="mailto:${storeSettings.email}" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; display: flex; align-items: center; gap: 14px; text-decoration: none; transition: border-color 0.2s ease;">
              <div style="width: 40px; height: 40px; border-radius: 8px; background: #f8fafc; color: #475569; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              </div>
              <div style="flex: 1;">
                <div style="font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase;">E-mail</div>
                <div style="font-size: 0.9375rem; font-weight: 700; color: #0f172a;">${storeSettings.email}</div>
              </div>
            </a>

            <!-- Endereço Completo & Horário -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; display: flex; align-items: flex-start; gap: 14px;">
              <div style="width: 40px; height: 40px; border-radius: 8px; background: #fef2f2; color: #dc2626; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${Icons.mapPin(20, '#dc2626')}
              </div>
              <div style="flex: 1;">
                <div style="font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Endereço</div>
                <div style="font-size: 0.9375rem; font-weight: 700; color: #0f172a; margin-top: 2px; line-height: 1.4;">
                  ${fullAddress}
                </div>
                <div style="font-size: 0.8125rem; color: #475569; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f1f5f9;">
                  ${storeSettings.opening_hours}
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
        Toast.show({
          title: 'Mensagem enviada com sucesso.',
          message: 'Retornaremos o contacto em breve.',
          type: 'success',
          duration: 5000
        });
        form.reset();
      };
    }

    // WhatsApp Direto
    const waBtn = el.querySelector('#sendDirectWhatsAppBtn');
    if (waBtn) {
      waBtn.onclick = () => {
        const name = el.querySelector('#cntName')?.value.trim() || 'Cliente';
        const phone = el.querySelector('#cntPhone')?.value.trim() || '';
        const subject = el.querySelector('#cntSubject')?.value || 'Contacto';
        const msg = el.querySelector('#cntMsg')?.value.trim() || '';

        const text = `*Mensagem de Contacto*\n\n*Nome:* ${name}\n*Telefone:* ${phone}\n*Assunto:* ${subject}\n*Mensagem:* ${msg || 'Gostaria de falar com a equipa.'}`;
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

