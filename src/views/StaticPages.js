import { Icons } from '../utils/icons.js';
import { Toast } from '../components/Toast.js';
import { Api } from '../services/api.js';
import { Storage } from '../services/storage.js';

export function renderAboutView() {
  const el = document.createElement('div');
  el.className = 'about-view-wrapper';
  el.style.cssText = 'width: 100%; min-height: 100vh; background: #fafafa; color: #1e293b; padding: 24px 16px 80px 16px; box-sizing: border-box;';

  el.innerHTML = `
    <div style="max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 40px;">
      
      <!-- NAVEGAÇÃO SUPERIOR SUTIL -->
      <nav style="display: flex; align-items: center; gap: 8px; font-size: 0.8125rem; color: #64748b; padding-top: 8px;">
        <a href="#/" style="color: #64748b; text-decoration: none;">Início</a>
        <span style="opacity: 0.4;">/</span>
        <span style="color: #0f172a; font-weight: 600;">Sobre Nós</span>
      </nav>

      <!-- APRESENTAÇÃO PRINCIPAL (SEM BORDAS, SÓBRIA E HUMANA) -->
      <section style="display: flex; flex-direction: column; gap: 18px; max-width: 860px;">
        <span style="font-size: 0.8125rem; font-weight: 700; color: #2563eb; letter-spacing: 0.05em; text-transform: uppercase;">
          Quem Somos
        </span>
        <h1 style="font-family: var(--font-display, sans-serif); font-size: clamp(2rem, 4vw, 3rem); font-weight: 800; color: #0f172a; line-height: 1.2; letter-spacing: -0.02em; margin: 0;">
          A sua loja online de compras e variedades em Angola
        </h1>
        <p style="font-size: 1.0625rem; color: #475569; line-height: 1.8; margin: 0;">
          A <strong>NovaTech</strong> é uma loja de comércio eletrónico angolana criada para que você possa comprar com tranquilidade sem sair de casa. Reunimos num único catálogo artigos de diversos departamentos — incluindo perfumes originais, jóias e ouro autêntico, vestuário, calçado, utilidades para o lar, beleza e artigos de tecnologia do dia a dia.
        </p>
        <p style="font-size: 0.9375rem; color: #64748b; line-height: 1.7; margin: 0;">
          Trabalhamos com fornecedores de confiança, preços transparentes em Kwanzas e pagamento prático por Multicaixa Express ou transferência bancária. O nosso compromisso é simples: você escolhe o produto na plataforma e nós cuidamos da entrega direta na sua morada, com seriedade e acompanhamento real.
        </p>
      </section>

      <!-- PONTOS DE CONFIANÇA (SEM BORDAS, CARDS NEUTROS E ELEGANTES) -->
      <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
        <div style="background: #ffffff; padding: 22px 20px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); display: flex; flex-direction: column; gap: 6px;">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; margin-bottom: 4px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
          </div>
          <strong style="color: #0f172a; font-size: 0.9375rem;">Artigos Originais</strong>
          <span style="font-size: 0.8125rem; color: #64748b; line-height: 1.5;">Trabalhamos apenas com produtos legítimos, de boa procedência e com descrição fiel.</span>
        </div>

        <div style="background: #ffffff; padding: 22px 20px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); display: flex; flex-direction: column; gap: 6px;">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; margin-bottom: 4px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
          </div>
          <strong style="color: #0f172a; font-size: 0.9375rem;">Variedade de Artigos</strong>
          <span style="font-size: 0.8125rem; color: #64748b; line-height: 1.5;">Perfumaria, ouro, vestuário, utilidades, eletrónicos e itens para a sua rotina.</span>
        </div>

        <div style="background: #ffffff; padding: 22px 20px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); display: flex; flex-direction: column; gap: 6px;">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: #ecfdf5; color: #059669; display: flex; align-items: center; justify-content: center; margin-bottom: 4px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11"/><path d="M14 9h4l4 4v4c0 .6-.4 1-1 1h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
          </div>
          <strong style="color: #0f172a; font-size: 0.9375rem;">Entregas em Angola</strong>
          <span style="font-size: 0.8125rem; color: #64748b; line-height: 1.5;">Atendimento em Luanda e expedição segura para as restantes províncias.</span>
        </div>

        <div style="background: #ffffff; padding: 22px 20px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); display: flex; flex-direction: column; gap: 6px;">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: #f1f5f9; color: #475569; display: flex; align-items: center; justify-content: center; margin-bottom: 4px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          </div>
          <strong style="color: #0f172a; font-size: 0.9375rem;">Pagamento Seguro</strong>
          <span style="font-size: 0.8125rem; color: #64748b; line-height: 1.5;">Multicaixa Express com notificação direta e transferências bancárias protegidas.</span>
        </div>
      </section>

      <!-- OS 3 PILARES: MISSÃO, VISÃO E OBJECTIVOS (SEM BORDAS, LINGUAGEM HUMANA) -->
      <section style="display: flex; flex-direction: column; gap: 20px;">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Princípios</span>
          <h2 style="font-family: var(--font-display, sans-serif); font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0;">
            A nossa forma de trabalhar
          </h2>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px;">
          
          <!-- MISSÃO -->
          <div style="background: #ffffff; padding: 28px 24px; border-radius: 18px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); display: flex; flex-direction: column; gap: 10px;">
            <span style="font-size: 0.75rem; font-weight: 700; color: #2563eb; text-transform: uppercase;">Missão</span>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">
              Simplificar as suas compras
            </h3>
            <p style="font-size: 0.875rem; color: #475569; line-height: 1.7; margin: 0;">
              Proporcionar aos angolanos uma experiência de compra online segura e conveniente, oferecendo uma grande variedade de produtos autênticos com pagamento em Kwanzas e entrega garantida na morada indicada.
            </p>
          </div>

          <!-- VISÃO -->
          <div style="background: #ffffff; padding: 28px 24px; border-radius: 18px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); display: flex; flex-direction: column; gap: 10px;">
            <span style="font-size: 0.75rem; font-weight: 700; color: #059669; text-transform: uppercase;">Visão</span>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">
              Ser a loja online de preferência
            </h3>
            <p style="font-size: 0.875rem; color: #475569; line-height: 1.7; margin: 0;">
              Ser a primeira opção de compra para quem busca diversidade e confiança em Angola, construindo relações duradouras com os nossos clientes através de seriedade, atendimento atencioso e pontualidade.
            </p>
          </div>

          <!-- OBJECTIVOS -->
          <div style="background: #ffffff; padding: 28px 24px; border-radius: 18px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); display: flex; flex-direction: column; gap: 10px;">
            <span style="font-size: 0.75rem; font-weight: 700; color: #d97706; text-transform: uppercase;">Objectivos</span>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">
              Expandir categorias e agilizar entregas
            </h3>
            <p style="font-size: 0.875rem; color: #475569; line-height: 1.7; margin: 0;">
              Manter o catálogo sempre atualizado com produtos úteis e procurados, assegurar que cada item seja entregue em perfeito estado e estreitar prazos de entrega em Luanda e nas restantes províncias.
            </p>
          </div>

        </div>
      </section>

      <!-- VARIEDADE DE PRODUTOS: LOJA DE DIVERSOS (SEM BORDA) -->
      <section style="background: #ffffff; padding: 36px 28px; border-radius: 20px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); display: flex; flex-direction: column; gap: 24px;">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Categorias</span>
          <h2 style="font-family: var(--font-display, sans-serif); font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0;">
            O que você encontra na nossa loja
          </h2>
          <p style="font-size: 0.875rem; color: #64748b; margin: 0;">
            Não somos uma loja focada apenas num segmento. O nosso objetivo é que você encontre diversas opções para uso pessoal, para a sua família ou para oferecer como presente.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px;">
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 14px; display: flex; flex-direction: column; gap: 8px;">
            <strong style="color: #0f172a; font-size: 0.9375rem;">Perfumes & Cosmética</strong>
            <p style="font-size: 0.8125rem; color: #64748b; line-height: 1.6; margin: 0;">
              Fragrâncias masculinas e femininas importadas, perfumes árabes consagrados, cremes e artigos de cuidados pessoais com fragrâncias duradouras.
            </p>
          </div>

          <div style="background: #f8fafc; padding: 20px; border-radius: 14px; display: flex; flex-direction: column; gap: 8px;">
            <strong style="color: #0f172a; font-size: 0.9375rem;">Ouro & Joalharia</strong>
            <p style="font-size: 0.8125rem; color: #64748b; line-height: 1.6; margin: 0;">
              Cordões, pulseiras, anéis, brincos e peças em ouro autêntico e semijoias com acabamento fino e envio discreto e seguro.
            </p>
          </div>

          <div style="background: #f8fafc; padding: 20px; border-radius: 14px; display: flex; flex-direction: column; gap: 8px;">
            <strong style="color: #0f172a; font-size: 0.9375rem;">Moda, Calçado & Malas</strong>
            <p style="font-size: 0.8125rem; color: #64748b; line-height: 1.6; margin: 0;">
              Roupas, sapatos, tênis, carteiras, malas de viagem e acessórios para o dia a dia e momentos especiais.
            </p>
          </div>

          <div style="background: #f8fafc; padding: 20px; border-radius: 14px; display: flex; flex-direction: column; gap: 8px;">
            <strong style="color: #0f172a; font-size: 0.9375rem;">Casa, Decoração & Utilidades</strong>
            <p style="font-size: 0.8125rem; color: #64748b; line-height: 1.6; margin: 0;">
              Artigos práticos para o lar, utensílios de cozinha, iluminação, presentes e facilidades para a sua casa.
            </p>
          </div>

          <div style="background: #f8fafc; padding: 20px; border-radius: 14px; display: flex; flex-direction: column; gap: 8px;">
            <strong style="color: #0f172a; font-size: 0.9375rem;">Eletrónicos & Acessórios</strong>
            <p style="font-size: 0.8125rem; color: #64748b; line-height: 1.6; margin: 0;">
              Telemóveis, fones sem fios, colunas de som, carregadores rápidos, relógios inteligentes e periféricos com garantia.
            </p>
          </div>

          <div style="background: #f8fafc; padding: 20px; border-radius: 14px; display: flex; flex-direction: column; gap: 8px;">
            <strong style="color: #0f172a; font-size: 0.9375rem;">E Muito Mais</strong>
            <p style="font-size: 0.8125rem; color: #64748b; line-height: 1.6; margin: 0;">
              Novas opções e produtos adicionados frequentemente para você encontrar tudo o que precisa sem precisar procurar em vários lugares.
            </p>
          </div>

        </div>
      </section>

      <!-- ATENDIMENTO 100% ONLINE E LOGÍSTICA (SEM SHOWROOM FÍSICO) -->
      <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; align-items: stretch;">
        
        <div style="background: #0f172a; color: #ffffff; padding: 32px 28px; border-radius: 20px; display: flex; flex-direction: column; justify-content: space-between; gap: 20px;">
          <div>
            <span style="font-size: 0.6875rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Operação 100% Online</span>
            <h3 style="font-family: var(--font-display, sans-serif); font-size: 1.45rem; font-weight: 800; margin: 6px 0 10px 0; line-height: 1.3;">
              Foco exclusivo em vendas online e entregas
            </h3>
            <p style="font-size: 0.875rem; color: #cbd5e1; line-height: 1.7; margin: 0;">
              Optamos por não manter showroom físico aberto ao público para concentrar todos os nossos recursos na qualidade do catálogo, em preços mais acessíveis e numa logística rápida que leva a sua compra diretamente até você.
            </p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 16px;">
            <div>
              <strong style="font-size: 0.9375rem; color: #ffffff; display: block;">Luanda</strong>
              <span style="font-size: 0.75rem; color: #94a3b8;">Entrega ao domicílio em 24h a 48h</span>
            </div>
            <div>
              <strong style="font-size: 0.9375rem; color: #ffffff; display: block;">Outras Províncias</strong>
              <span style="font-size: 0.75rem; color: #94a3b8;">Envio seguro com parceiros de transporte</span>
            </div>
          </div>
        </div>

        <div style="background: #ffffff; padding: 32px 28px; border-radius: 20px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); display: flex; flex-direction: column; justify-content: space-between; gap: 20px;">
          <div>
            <span style="font-size: 0.6875rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Atendimento</span>
            <h3 style="font-family: var(--font-display, sans-serif); font-size: 1.45rem; font-weight: 800; color: #0f172a; margin: 6px 0 10px 0; line-height: 1.3;">
              Apoio direto à sua disposição
            </h3>
            <p style="font-size: 0.875rem; color: #475569; line-height: 1.7; margin: 0;">
              Se tiver dúvidas sobre algum produto, tamanhos, detalhes de perfumes ou sobre o estado da sua encomenda, a nossa equipa atende diretamente pelo WhatsApp e telefone para ajudar em tudo o que precisar.
            </p>
          </div>

          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <a href="#/catalogo" class="btn btn-primary" style="padding: 10px 20px; font-weight: 600; font-size: 0.8125rem; border-radius: 10px; text-decoration: none;">
              Ver Catálogo
            </a>
            <a href="https://wa.me/244923179192" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="padding: 10px 18px; font-weight: 600; font-size: 0.8125rem; border-radius: 10px; text-decoration: none; color: #047857; background: #ecfdf5;">
              Falar pelo WhatsApp
            </a>
          </div>
        </div>

      </section>

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
    } catch { }
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
    {
      q: 'Onde a NovaTech realiza entregas?',
      a: 'Nesta fase, as nossas entregas estão disponíveis <strong>exclusivamente na província de Luanda</strong> (incluindo Talatona, Belas, Maianga, Kilamba, Viana, Cazenga, Morro Bento, Centro da Cidade e arredores). Estamos a preparar a expansão logística para as demais províncias em breve.'
    },
    {
      q: 'Como funciona o Frete Grátis?',
      a: 'Oferecemos <strong>Frete Grátis automático</strong> para qualquer compra a partir de <strong>Kz 100.000</strong> (cem mil Kwanzas) dentro da província de Luanda. Para valores inferiores, a taxa de envio é calculada de forma acessível na finalização da compra.'
    },
    {
      q: 'Qual é o prazo de entrega em Luanda?',
      a: 'Para Luanda, o prazo habitual de entrega é de <strong>24h a 48h úteis</strong> após a confirmação do pagamento. A nossa equipa de estafetas entra em contacto por telefone ou WhatsApp antes de se deslocar à sua morada.'
    },
    {
      q: 'Qual é a garantia dos produtos?',
      a: 'Todos os produtos vendidos na NovaTech possuem <strong>3 meses (90 dias) de garantia</strong> contra defeitos de fabrico. Caso o seu produto apresente qualquer problema de fábrica nesse período, oferecemos suporte directo para reparação ou troca.'
    },
    {
      q: 'Quais são as formas de pagamento aceites?',
      a: 'Aceitamos pagamentos práticos e seguros em Angola: <strong>Multicaixa Express</strong> (com validação imediata pelo app), <strong>Transferência Bancária / Depósito</strong> (BAI, BFA, BIC, com envio do comprovativo) e <strong>Pagamento por TPA na Entrega</strong> em Luanda.'
    },
    {
      q: 'Quais tipos de produtos posso comprar na NovaTech?',
      a: 'Somos uma loja online completa de variedades: comercializamos perfumes e cosméticos, peças em ouro e joalharia, artigos de moda e calçado, produtos para o lar, eletrónicos e acessórios diversos.'
    },
    {
      q: 'A loja possui espaço físico para levantamento?',
      a: 'Operamos como uma <strong>loja 100% online</strong>, o que nos permite oferecer maior variedade e preços mais competitivos. Não dispomos de loja física de atendimento ao público; todas as encomendas são entregues diretamente na morada ou local de trabalho indicado.'
    },
    {
      q: 'Como posso acompanhar o estado da minha encomenda?',
      a: 'Pode acompanhar o estado do pedido diretamente no site na aba <strong>Minha Conta > Meus Pedidos</strong> ou entrar em contacto com o nosso apoio ao cliente no <strong>WhatsApp (+244 923 179 192)</strong> informando o número da sua encomenda.'
    }
  ];

  el.innerHTML = `
    <div style="margin: 48px auto; max-width: 840px;">
      <h1 style="font-family: var(--font-display); font-size: 2.25rem; font-weight: 900; margin-bottom: 8px;">
        Perguntas Frequentes (FAQ)
      </h1>
      <p style="color: var(--text-secondary); margin-bottom: 32px;">
        Tudo o que precisa saber sobre compras, entregas e garantias na NovaTech Angola.
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
    title = 'Política de Envio e Entregas em Luanda';
    content = `
      <p>A NovaTech Angola realiza entregas rápidas, cómodas e seguras directamente ao seu endereço.</p>
      <h3 style="margin: 16px 0 8px 0; font-weight: 700;">1. Área de Cobertura</h3>
      <p>Actualmente, as nossas entregas operam <strong>exclusivamente na província de Luanda</strong> (Talatona, Belas, Maianga, Kilamba, Viana, Cazenga, Morro Bento, Centro da Cidade e demais zonas metropolitanas). O envio para as restantes províncias de Angola estará disponível em breve.</p>
      <h3 style="margin: 16px 0 8px 0; font-weight: 700;">2. Frete Grátis a Partir de Kz 100.000</h3>
      <p>Todas as compras com valor igual ou superior a <strong>Kz 100.000</strong> (cem mil Kwanzas) contam com <strong>Frete Grátis automático</strong> para qualquer endereço em Luanda.</p>
      <h3 style="margin: 16px 0 8px 0; font-weight: 700;">3. Prazos de Entrega</h3>
      <p>As encomendas normais são entregues no prazo de <strong>24h a 48h úteis</strong> após a confirmação do pagamento. O nosso estafeta entra em contacto telefónico ou via WhatsApp antes da deslocação para coordenar a entrega.</p>
      <h3 style="margin: 16px 0 8px 0; font-weight: 700;">4. Rastreio e Apoio</h3>
      <p>Pode acompanhar o estado da encomenda no seu painel de cliente ou solicitar informações directamente pelo nosso WhatsApp de suporte.</p>
    `;
  } else if (type === 'devolucao') {
    title = 'Política de Garantia e Devolução';
    content = `
      <p>A sua satisfação e confiança são fundamentais para nós.</p>
      <h3 style="margin: 16px 0 8px 0; font-weight: 700;">1. Garantia de 3 Meses (90 Dias)</h3>
      <p>Todos os artigos vendidos pela NovaTech possuem <strong>3 meses de garantia</strong> contra defeitos de fabricação a partir da data de receção da encomenda.</p>
      <h3 style="margin: 16px 0 8px 0; font-weight: 700;">2. Trocas e Resolução de Avarias</h3>
      <p>Caso o artigo apresente anomalia ou defeito de fabrico nos primeiros 7 dias após o recebimento, garantimos prioridade máxima na troca por um artigo novo em stock ou reembolso integral, mediante apresentação da encomenda completa.</p>
      <h3 style="margin: 16px 0 8px 0; font-weight: 700;">3. Condições Gerais</h3>
      <p>A garantia não cobre danos decorrentes de mau uso, quedas, contacto acidental com líquidos em artigos não resistentes ou intervenção técnica não autorizada.</p>
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

