// ===================================================================
// AUTH MODAL COMPONENT (Login, Register, Password Recovery)
// ===================================================================

import { Icons } from '../utils/icons.js';
import { Storage } from '../services/storage.js';
import { Api } from '../services/api.js';
import { Toast } from './Toast.js';

export function setupAuthModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'authModalBackdrop';

  const modal = document.createElement('div');
  modal.className = 'modal-box';

  let currentTab = 'login'; // 'login' | 'register' | 'forgot'

  function render() {
    modal.innerHTML = `
      <div class="modal-header">
        <h3 style="font-family: var(--font-display); font-size: 1.25rem; font-weight: 800; color: var(--text-main);">
          ${currentTab === 'login' ? 'Iniciar Sessão' : currentTab === 'register' ? 'Criar Nova Conta' : 'Recuperar Senha'}
        </h3>
        <button id="closeAuthModalBtn" style="color: var(--text-muted); padding: 4px; border-radius: 50%;">
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

            <button type="submit" class="btn btn-primary btn-full" style="margin-top: 6px;">
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
          <form id="authRegisterForm" onsubmit="event.preventDefault();" style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label class="form-label">Nome Completo</label>
              <input type="text" id="regName" class="form-input" placeholder="Ex: Seu Nome Completo" required />
            </div>

            <div class="form-group">
              <label class="form-label">E-mail</label>
              <input type="email" id="regEmail" class="form-input" placeholder="seu.email@exemplo.com" required />
            </div>

            <div class="form-group">
              <label class="form-label">Telefone / WhatsApp</label>
              <input type="tel" id="regPhone" class="form-input" placeholder="+244 923 179 192" required />
            </div>

            <div class="form-group">
              <label class="form-label">Endereço Completo</label>
              <input type="text" id="regAddress" class="form-input" placeholder="Ex: Bairro Talatona, Rua 12, Casa 45" />
            </div>

            <div class="form-group">
              <label class="form-label">Ponto de Referência</label>
              <input type="text" id="regReference" class="form-input" placeholder="Ex: Próximo à Escola Primária ou Farmácia Central" />
            </div>

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

            <button type="submit" class="btn btn-primary btn-full">
              Criar Minha Conta
            </button>

            <div style="text-align: center; font-size: 0.8125rem; color: var(--text-secondary); margin-top: 6px;">
              Já possui uma conta? 
              <button type="button" id="toLoginTabBtn" style="color: var(--primary-600); font-weight: 700;">
                Faça login
              </button>
            </div>
          </form>
        ` : `
          <!-- Forgot Password Flow -->
          <form id="authForgotForm" onsubmit="event.preventDefault();" style="display: flex; flex-direction: column; gap: 14px;">
            <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5;">
              Insira o seu e-mail cadastrado para receber um código de verificação para redefinir a sua senha.
            </p>

            <div class="form-group">
              <label class="form-label">E-mail Cadastrado</label>
              <input type="email" id="forgotEmail" class="form-input" placeholder="seu.email@exemplo.com" required />
            </div>

            <button type="submit" class="btn btn-primary btn-full">
              Enviar Código de Recuperação
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
          Toast.show({
            title: 'Sessão iniciada com sucesso!',
            message: `Bem-vindo de volta, ${result.user.name}`,
            type: 'success'
          });
          closeModal();
        } catch (err) {
          Toast.show({
            title: 'Erro de Autenticação',
            message: err.message || 'E-mail ou senha incorretos.',
            type: 'error'
          });
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
          }
        }
      };
    }

    // Register submit (e-mail, senha, telefone, endereco e ponto de referencia)
    const regForm = modal.querySelector('#authRegisterForm');
    if (regForm) {
      regForm.onsubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const name = modal.querySelector('#regName').value.trim();
        const email = modal.querySelector('#regEmail').value.trim();
        const phone = modal.querySelector('#regPhone').value.trim();
        const address = modal.querySelector('#regAddress')?.value.trim() || '';
        const referencePoint = modal.querySelector('#regReference')?.value.trim() || '';
        const password = modal.querySelector('#regPass').value;
        const confirmPassword = modal.querySelector('#regPassConfirm')?.value || '';
        const submitBtn = regForm.querySelector('button[type="submit"]');

        if (password.length < 6) {
          Toast.show({
            title: 'Senha muito curta',
            message: 'A senha deve conter no mínimo 6 caracteres.',
            type: 'warning'
          });
          return;
        }

        if (password !== confirmPassword) {
          Toast.show({
            title: 'Senhas divergentes',
            message: 'A confirmação de senha não coincide com a senha digitada.',
            type: 'warning'
          });
          return;
        }

        const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Criar Minha Conta';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = 'Criando conta segura...';
        }

        try {
          const result = await Api.auth.register(name, email, password, phone, {
            endereco: address,
            ponto_referencia: referencePoint
          });
          Storage.saveUser(result.user);
          Toast.show({
            title: 'Conta criada com sucesso! 🎉',
            message: `Seja muito bem-vindo à NovaTech, ${name}!`,
            type: 'success'
          });
          closeModal();
        } catch (err) {
          Toast.show({
            title: 'Erro no Cadastro',
            message: err.message || 'Não foi possível registrar a conta.',
            type: 'error'
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
      forgotForm.onsubmit = () => {
        const email = modal.querySelector('#forgotEmail').value;
        Toast.show({
          title: 'Código enviado!',
          message: `Instruções de redefinição foram enviadas para ${email}.`,
          type: 'info'
        });
        currentTab = 'login';
        render();
      };
    }
  }

  function openModal(e) {
    if (e && e.detail && (e.detail.tab === 'register' || e.detail.tab === 'forgot' || e.detail.tab === 'login')) {
      currentTab = e.detail.tab;
    } else {
      currentTab = 'login';
    }
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
