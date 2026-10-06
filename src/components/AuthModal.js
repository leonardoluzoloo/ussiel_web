// ===================================================================
// AUTH MODAL COMPONENT (Login, 3-Step Register Wizard, Password Recovery)
// ===================================================================

import { Icons } from '../utils/icons.js';
import { Storage } from '../services/storage.js';
import { Api } from '../services/api.js';
import { Toast } from './Toast.js';
import { formatAuthError } from '../utils/format.js';
import { ANGOLA_PROVINCES } from '../utils/provinces.js';

export function setupAuthModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'authModalBackdrop';

  const modal = document.createElement('div');
  modal.className = 'modal-box';

  let currentTab = 'login'; // 'login' | 'register' | 'forgot'
  let regStep = 1; // 1: Personal Data, 2: Address, 3: Password, 'success_email': Validation Sent

  const regData = {
    name: '',
    email: '',
    phone: '',
    province: 'Luanda',
    city: '',
    neighborhood: '',
    street: '',
    number: '',
    reference: '',
    password: '',
    confirmPassword: ''
  };

  function render() {
    modal.innerHTML = `
      <div class="modal-header">
        <h3 style="font-family: var(--font-display); font-size: 1.25rem; font-weight: 800; color: var(--text-main);">
          ${currentTab === 'login' ? 'Iniciar Sessão' : currentTab === 'register' ? (regStep === 'success_email' ? 'Conta Criada' : 'Criar Nova Conta') : 'Recuperar Senha'}
        </h3>
        <button id="closeAuthModalBtn" style="color: var(--text-muted); padding: 4px; border-radius: 50%;" aria-label="Fechar">
          ${Icons.close(20)}
        </button>
      </div>

      <div class="modal-body">
        ${currentTab === 'login' ? `
          <form id="authLoginForm" onsubmit="event.preventDefault();" style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label class="form-label">E-mail</label>
              <input type="email" id="loginEmail" class="form-input" placeholder="seu.email@exemplo.com" required />
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label class="form-label">Senha</label>
                <button type="button" id="toForgotTabBtn" style="font-size: 0.75rem; color: var(--primary-600); font-weight: 600;">
                  Esqueci minha senha
                </button>
              </div>
              <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" required />
            </div>

            <button type="submit" class="btn btn-primary btn-full" style="margin-top: 6px; font-weight: 700;">
              Entrar na Conta
            </button>

            <div style="text-align: center; font-size: 0.8125rem; color: var(--text-secondary); margin-top: 14px;">
              Ainda não tem conta? 
              <button type="button" id="toRegisterTabBtn" style="color: var(--primary-600); font-weight: 700;">
                Cadastre-se grátis
              </button>
            </div>
          </form>
        ` : currentTab === 'register' ? `
          ${regStep === 'success_email' ? `
            <!-- Tela de Sucesso: E-mail de Validação Enviado -->
            <div style="text-align: center; padding: 16px 8px;">
              <div style="width: 58px; height: 58px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
                ${Icons.mail(30)}
              </div>
              <h4 style="font-size: 1.1875rem; font-weight: 800; color: #0f172a; margin-bottom: 8px;">
                Validação de Conta Enviada! ✉️
              </h4>
              <p style="font-size: 0.875rem; color: #475569; line-height: 1.6; margin-bottom: 20px;">
                Enviamos um link de validação para o e-mail:<br />
                <strong style="color: #0f172a; font-size: 0.9375rem;">${regData.email}</strong><br /><br />
                Por favor, acesse a sua caixa de entrada (ou pasta de spam) e clique no link para ativar a sua conta antes de iniciar sessão.
              </p>
              <button type="button" class="btn btn-primary btn-full" id="regGoToLoginBtn" style="font-weight: 700;">
                Ir para Iniciar Sessão
              </button>
            </div>
          ` : `
            <!-- Wizard de 3 Etapas -->
            <div class="auth-wizard-stepper" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; position: relative;">
              <div style="position: absolute; top: 14px; left: 24px; right: 24px; height: 2px; background: #e2e8f0; z-index: 1;">
                <div style="height: 100%; width: ${regStep === 1 ? '0%' : regStep === 2 ? '50%' : '100%'}; background: var(--primary-600); transition: width 0.3s ease;"></div>
              </div>

              <!-- Passo 1 -->
              <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; z-index: 2; position: relative;">
                <div style="width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; background: ${regStep >= 1 ? 'var(--primary-600)' : '#f1f5f9'}; color: ${regStep >= 1 ? '#ffffff' : '#64748b'}; border: 2px solid ${regStep >= 1 ? 'var(--primary-600)' : '#e2e8f0'};">
                  1
                </div>
                <span style="font-size: 0.6875rem; font-weight: ${regStep === 1 ? '700' : '500'}; color: ${regStep === 1 ? '#0f172a' : '#64748b'};">Dados</span>
              </div>

              <!-- Passo 2 -->
              <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; z-index: 2; position: relative;">
                <div style="width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; background: ${regStep >= 2 ? 'var(--primary-600)' : '#ffffff'}; color: ${regStep >= 2 ? '#ffffff' : '#64748b'}; border: 2px solid ${regStep >= 2 ? 'var(--primary-600)' : '#e2e8f0'};">
                  2
                </div>
                <span style="font-size: 0.6875rem; font-weight: ${regStep === 2 ? '700' : '500'}; color: ${regStep === 2 ? '#0f172a' : '#64748b'};">Endereço</span>
              </div>

              <!-- Passo 3 -->
              <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; z-index: 2; position: relative;">
                <div style="width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; background: ${regStep >= 3 ? 'var(--primary-600)' : '#ffffff'}; color: ${regStep >= 3 ? '#ffffff' : '#64748b'}; border: 2px solid ${regStep >= 3 ? 'var(--primary-600)' : '#e2e8f0'};">
                  3
                </div>
                <span style="font-size: 0.6875rem; font-weight: ${regStep === 3 ? '700' : '500'}; color: ${regStep === 3 ? '#0f172a' : '#64748b'};">Senha</span>
              </div>
            </div>

            ${regStep === 1 ? `
              <!-- Etapa 1: Dados Pessoais & Contato -->
              <form id="regStep1Form" onsubmit="event.preventDefault();" style="display: flex; flex-direction: column; gap: 14px;">
                <div class="form-group">
                  <label class="form-label">Nome Completo *</label>
                  <input type="text" id="regName" class="form-input" placeholder="Ex: Leonardo Manuel" value="${regData.name}" required />
                </div>

                <div class="form-group">
                  <label class="form-label">E-mail *</label>
                  <input type="email" id="regEmail" class="form-input" placeholder="seu.email@exemplo.com" value="${regData.email}" required />
                </div>

                <div class="form-group">
                  <label class="form-label">Telefone / WhatsApp *</label>
                  <input type="tel" id="regPhone" class="form-input" placeholder="+244 923 179 192" value="${regData.phone}" required />
                </div>

                <button type="submit" class="btn btn-primary btn-full" style="margin-top: 6px; font-weight: 700;">
                  Próximo: Endereço de Entrega →
                </button>

                <div style="text-align: center; font-size: 0.8125rem; color: var(--text-secondary); margin-top: 6px;">
                  Já possui uma conta? 
                  <button type="button" id="toLoginTabBtn" style="color: var(--primary-600); font-weight: 700;">
                    Faça login
                  </button>
                </div>
              </form>
            ` : regStep === 2 ? `
              <!-- Etapa 2: Endereço Completo -->
              <form id="regStep2Form" onsubmit="event.preventDefault();" style="display: flex; flex-direction: column; gap: 14px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">Província *</label>
                    <select id="regProvince" class="form-input" required>
                      ${ANGOLA_PROVINCES.map(p => `
                        <option value="${p.name}" ${regData.province === p.name ? 'selected' : ''}>${p.name}</option>
                      `).join('')}
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Cidade / Município *</label>
                    <input type="text" id="regCity" class="form-input" placeholder="Ex: Talatona, Belas" value="${regData.city}" required />
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div class="form-group">
                    <label class="form-label">Bairro *</label>
                    <input type="text" id="regNeighborhood" class="form-input" placeholder="Ex: Morro Bento" value="${regData.neighborhood}" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Número (Casa/Edifício)</label>
                    <input type="text" id="regNumber" class="form-input" placeholder="Ex: Casa 45" value="${regData.number}" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Rua / Avenida *</label>
                  <input type="text" id="regStreet" class="form-input" placeholder="Ex: Rua 12, Próximo à Estrada Principal" value="${regData.street}" required />
                </div>

                <div class="form-group">
                  <label class="form-label">Ponto de Referência</label>
                  <input type="text" id="regReference" class="form-input" placeholder="Ex: Próximo à Farmácia Central ou Supermercado" value="${regData.reference}" />
                </div>

                <div style="display: flex; gap: 10px; margin-top: 6px;">
                  <button type="button" class="btn btn-secondary" id="regBackToStep1Btn" style="flex: 1; font-weight: 700;">
                    ← Voltar
                  </button>
                  <button type="submit" class="btn btn-primary" style="flex: 1.5; font-weight: 700;">
                    Próximo: Senha →
                  </button>
                </div>
              </form>
            ` : `
              <!-- Etapa 3: Definição de Senha & Aceite -->
              <form id="regStep3Form" onsubmit="event.preventDefault();" style="display: flex; flex-direction: column; gap: 14px;">
                <div class="form-group">
                  <label class="form-label">Senha de Acesso *</label>
                  <input type="password" id="regPass" class="form-input" placeholder="Mínimo 6 caracteres" required minlength="6" />
                </div>

                <div class="form-group">
                  <label class="form-label">Confirmar Senha *</label>
                  <input type="password" id="regPassConfirm" class="form-input" placeholder="Repita a senha de acesso" required minlength="6" />
                </div>

                <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 0.75rem; color: var(--text-secondary); cursor: pointer;">
                  <input type="checkbox" id="regTerms" required style="margin-top: 3px; accent-color: var(--primary-600);" checked />
                  <span>Li e concordo com os <a href="#/termos" target="_blank" style="color: var(--primary-600); text-decoration: underline;">Termos de Serviço</a> e <a href="#/privacidade" target="_blank" style="color: var(--primary-600); text-decoration: underline;">Política de Privacidade</a>.</span>
                </label>

                <div style="display: flex; gap: 10px; margin-top: 6px;">
                  <button type="button" class="btn btn-secondary" id="regBackToStep2Btn" style="flex: 1; font-weight: 700;">
                    ← Voltar
                  </button>
                  <button type="submit" class="btn btn-primary" id="regSubmitFinalBtn" style="flex: 1.5; font-weight: 700;">
                    Criar Minha Conta ✓
                  </button>
                </div>
              </form>
            `}
          `}
        ` : `
          <!-- Forgot Password Flow -->
          <form id="authForgotForm" onsubmit="event.preventDefault();" style="display: flex; flex-direction: column; gap: 14px;">
            <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5;">
              Insira o seu e-mail cadastrado para receber um link de verificação para redefinir a sua senha.
            </p>

            <div class="form-group">
              <label class="form-label">E-mail Cadastrado</label>
              <input type="email" id="forgotEmail" class="form-input" placeholder="seu.email@exemplo.com" required />
            </div>

            <button type="submit" class="btn btn-primary btn-full" style="font-weight: 700;">
              Enviar Link de Recuperação
            </button>

            <div style="text-align: center; margin-top: 8px;">
              <button type="button" id="toLoginFromForgotBtn" style="font-size: 0.8125rem; color: var(--text-muted); font-weight: 600;">
                ← Voltar para o Login
              </button>
            </div>
          </form>
        `}
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    const closeBtn = modal.querySelector('#closeAuthModalBtn');
    if (closeBtn) closeBtn.onclick = closeModal;

    // Switch to Register
    const toReg = modal.querySelector('#toRegisterTabBtn');
    if (toReg) {
      toReg.onclick = () => {
        currentTab = 'register';
        regStep = 1;
        window.location.hash = '/cadastro';
        render();
      };
    }

    // Switch to Login
    const toLog = modal.querySelector('#toLoginTabBtn');
    if (toLog) {
      toLog.onclick = () => {
        currentTab = 'login';
        window.location.hash = '/login';
        render();
      };
    }

    const regGoToLog = modal.querySelector('#regGoToLoginBtn');
    if (regGoToLog) {
      regGoToLog.onclick = () => {
        currentTab = 'login';
        window.location.hash = '/login';
        render();
      };
    }

    // Switch to Forgot
    const toForgot = modal.querySelector('#toForgotTabBtn');
    if (toForgot) {
      toForgot.onclick = () => {
        currentTab = 'forgot';
        window.location.hash = '/esqueci-senha';
        render();
      };
    }

    const backToLog = modal.querySelector('#toLoginFromForgotBtn');
    if (backToLog) {
      backToLog.onclick = () => {
        currentTab = 'login';
        window.location.hash = '/login';
        render();
      };
    }

    // Login submit
    const loginForm = modal.querySelector('#authLoginForm');
    if (loginForm) {
      loginForm.onsubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const email = modal.querySelector('#loginEmail').value.trim();
        const password = modal.querySelector('#loginPassword').value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Entrar na Conta';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = 'Validando credenciais...';
        }

        try {
          const result = await Api.auth.login(email, password);
          Storage.saveUser(result.user);
          const userName = result.user?.name || email.split('@')[0];
          Toast.show({
            title: 'Sessão iniciada com sucesso! 🚀',
            message: `Seja bem-vindo de volta, ${userName}!`,
            type: 'success'
          });
          closeModal();
        } catch (err) {
          Toast.show({
            title: 'Erro de Autenticação',
            message: formatAuthError(err),
            type: 'error',
            duration: 6000
          });
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
          }
        }
      };
    }

    // Wizard Register Step 1 -> Step 2
    const step1Form = modal.querySelector('#regStep1Form');
    if (step1Form) {
      step1Form.onsubmit = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const name = modal.querySelector('#regName')?.value.trim() || '';
        const email = modal.querySelector('#regEmail')?.value.trim() || '';
        const phone = modal.querySelector('#regPhone')?.value.trim() || '';

        if (!name) {
          Toast.show({ title: 'Campo Obrigatório', message: 'Por favor, informe seu nome completo.', type: 'warning' });
          return;
        }
        if (!email || !email.includes('@')) {
          Toast.show({ title: 'E-mail Inválido', message: 'Por favor, informe um endereço de e-mail válido.', type: 'warning' });
          return;
        }
        if (!phone) {
          Toast.show({ title: 'Campo Obrigatório', message: 'Por favor, informe seu número de telefone ou WhatsApp.', type: 'warning' });
          return;
        }

        regData.name = name;
        regData.email = email;
        regData.phone = phone;
        regStep = 2;
        render();
      };
    }

    // Wizard Register Step 2: Back to Step 1 & Next to Step 3
    const backToStep1Btn = modal.querySelector('#regBackToStep1Btn');
    if (backToStep1Btn) {
      backToStep1Btn.onclick = () => {
        regData.province = modal.querySelector('#regProvince')?.value || regData.province;
        regData.city = modal.querySelector('#regCity')?.value.trim() || regData.city;
        regData.neighborhood = modal.querySelector('#regNeighborhood')?.value.trim() || regData.neighborhood;
        regData.street = modal.querySelector('#regStreet')?.value.trim() || regData.street;
        regData.number = modal.querySelector('#regNumber')?.value.trim() || regData.number;
        regData.reference = modal.querySelector('#regReference')?.value.trim() || regData.reference;
        regStep = 1;
        render();
      };
    }

    const step2Form = modal.querySelector('#regStep2Form');
    if (step2Form) {
      step2Form.onsubmit = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const province = modal.querySelector('#regProvince')?.value || 'Luanda';
        const city = modal.querySelector('#regCity')?.value.trim() || '';
        const neighborhood = modal.querySelector('#regNeighborhood')?.value.trim() || '';
        const street = modal.querySelector('#regStreet')?.value.trim() || '';
        const number = modal.querySelector('#regNumber')?.value.trim() || '';
        const reference = modal.querySelector('#regReference')?.value.trim() || '';

        if (!city) {
          Toast.show({ title: 'Campo Obrigatório', message: 'Por favor, informe a cidade ou município.', type: 'warning' });
          return;
        }
        if (!neighborhood) {
          Toast.show({ title: 'Campo Obrigatório', message: 'Por favor, informe o bairro.', type: 'warning' });
          return;
        }
        if (!street) {
          Toast.show({ title: 'Campo Obrigatório', message: 'Por favor, informe a rua ou avenida.', type: 'warning' });
          return;
        }

        regData.province = province;
        regData.city = city;
        regData.neighborhood = neighborhood;
        regData.street = street;
        regData.number = number;
        regData.reference = reference;
        regStep = 3;
        render();
      };
    }

    // Wizard Register Step 3: Back to Step 2 & Final Submission
    const backToStep2Btn = modal.querySelector('#regBackToStep2Btn');
    if (backToStep2Btn) {
      backToStep2Btn.onclick = () => {
        regStep = 2;
        render();
      };
    }

    const step3Form = modal.querySelector('#regStep3Form');
    if (step3Form) {
      step3Form.onsubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const pass = modal.querySelector('#regPass')?.value || '';
        const confirmPass = modal.querySelector('#regPassConfirm')?.value || '';
        const submitBtn = modal.querySelector('#regSubmitFinalBtn');

        if (pass.length < 6) {
          Toast.show({
            title: 'Senha muito curta',
            message: 'A senha deve conter no mínimo 6 caracteres.',
            type: 'warning'
          });
          return;
        }

        if (pass !== confirmPass) {
          Toast.show({
            title: 'Senhas divergentes',
            message: 'A confirmação de senha não coincide com a senha digitada.',
            type: 'warning'
          });
          return;
        }

        const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Criar Minha Conta ✓';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = 'Criando conta segura...';
        }

        try {
          const result = await Api.auth.register(regData.name, regData.email, pass, regData.phone, {
            provincia: regData.province,
            cidade: regData.city,
            bairro: regData.neighborhood,
            rua: regData.street,
            numero: regData.number,
            ponto_referencia: regData.reference
          });

          if (result.requiresEmailConfirmation) {
            Toast.show({
              title: 'Conta Criada! Validação Enviada ✉️',
              message: `Enviamos um link de ativação para ${regData.email}. Acesse seu e-mail e clique no link para ativar sua conta.`,
              type: 'info',
              duration: 10000
            });
            regStep = 'success_email';
            render();
          } else {
            Storage.saveUser(result.user);
            Toast.show({
              title: 'Conta criada com sucesso! 🎉',
              message: `Seja muito bem-vindo à NovaTech, ${regData.name || 'Cliente'}!`,
              type: 'success'
            });
            closeModal();
          }
        } catch (err) {
          Toast.show({
            title: 'Erro no Cadastro',
            message: formatAuthError(err),
            type: 'error',
            duration: 6000
          });
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
          }
        }
      };
    }

    // Forgot submit
    const forgotForm = modal.querySelector('#authForgotForm');
    if (forgotForm) {
      forgotForm.onsubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const email = modal.querySelector('#forgotEmail').value.trim();
        const submitBtn = forgotForm.querySelector('button[type="submit"]');

        const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Enviar Link de Recuperação';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = 'Enviando instruções...';
        }

        try {
          await Api.auth.forgotPassword(email);
          Toast.show({
            title: 'Instruções Enviadas! ✉️',
            message: `Enviamos o link de recuperação para ${email}. Verifique a sua caixa de entrada e pasta de spam.`,
            type: 'info',
            duration: 7000
          });
          currentTab = 'login';
          render();
        } catch (err) {
          Toast.show({
            title: 'Erro na Recuperação',
            message: formatAuthError(err),
            type: 'error',
            duration: 6000
          });
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
          }
        }
      };
    }
  }

  function openModal(e) {
    if (e && e.detail && (e.detail.tab === 'register' || e.detail.tab === 'forgot' || e.detail.tab === 'login')) {
      currentTab = e.detail.tab;
    } else {
      currentTab = 'login';
    }
    regStep = 1;
    render();
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    backdrop.classList.remove('active');
    document.body.style.overflow = '';
    // Se a rota era #/login, #/cadastro ou #/esqueci-senha, limpa hash de forma limpa
    const h = window.location.hash || '';
    if (h === '#/login' || h === '#/cadastro' || h === '#/esqueci-senha') {
      window.history.replaceState(null, '', window.location.pathname + '#/');
    }
  }

  backdrop.onclick = (e) => {
    if (e.target === backdrop) closeModal();
  };

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  window.addEventListener('open-auth-modal', openModal);
}
