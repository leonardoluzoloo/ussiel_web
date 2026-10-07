// ===================================================================
// MAIN APPLICATION ENTRY POINT & ROUTER
// ===================================================================

import './style.css';
import { createHeader } from './components/Header.js';
import { createFooter } from './components/Footer.js';
import { setupMiniCart } from './components/MiniCart.js';
import { setupMobileNav } from './components/MobileNav.js';
import { setupWhatsAppButton } from './components/WhatsAppButton.js';
import { setupAuthModal } from './components/AuthModal.js';
import { supabase, isSupabaseConfigured } from './services/supabaseClient.js';
import { Storage } from './services/storage.js';
import { Api } from './services/api.js';

import { Toast } from './components/Toast.js';

// Views
import { renderCatalogView } from './views/CatalogView.js';
import { renderCategoriesView } from './views/CategoriesView.js';
import { renderProductDetailView } from './views/ProductDetailView.js';
import { renderCartView } from './views/CartView.js';
import { renderCheckoutView } from './views/CheckoutView.js';
import { renderAccountView } from './views/AccountView.js';
import { renderAdminView } from './views/AdminView.js';
import {
  renderAboutView,
  renderContactView,
  renderFAQView,
  renderPolicyView
} from './views/StaticPages.js';

function initApp() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = '';

  // 1. Create and append Header
  const header = createHeader();
  app.appendChild(header);

  // 2. Create main view container
  const mainContainer = document.createElement('main');
  mainContainer.id = 'mainContentArea';
  app.appendChild(mainContainer);

  // 3. Create and append Footer
  const footer = createFooter();
  app.appendChild(footer);

  // 4. Initialize global overlays & floating widgets
  setupMiniCart();
  setupMobileNav();
  setupWhatsAppButton();
  setupAuthModal();

  // Sincronização e validação de sessão real com o Supabase no ciclo de vida
  if (isSupabaseConfigured() && supabase) {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        try {
          const { data: profile } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', session.user.email)
            .maybeSingle();

          const currentUser = Storage.getUser();
          const isUserAdmin = profile?.nivel_acesso === 'admin' ||
            session.user.user_metadata?.role === 'admin' ||
            session.user.app_metadata?.role === 'admin' ||
            currentUser?.role === 'admin';
          const role = isUserAdmin ? 'admin' : 'customer';

          Storage.saveUser({
            id: profile?.id || session.user.id,
            auth_user_id: session.user.id,
            name: profile?.nome || session.user.user_metadata?.name || '',
            email: profile?.email || session.user.email,
            phone: profile?.telefone || session.user.user_metadata?.phone || '',
            whatsapp: profile?.whatsapp || profile?.telefone || session.user.user_metadata?.phone || '',
            endereco: profile?.endereco || '',
            ponto_referencia: profile?.ponto_referencia || '',
            role
          });
        } catch (e) {
          console.warn('Aviso ao sincronizar sessão ativa com perfil no Supabase:', e.message);
        }
      }
    }).catch(() => {});

    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        Storage.logoutUser();
        window.dispatchEvent(new CustomEvent('user-updated', { detail: { user: null } }));
      }
    });
  }

  // Intercepta e trata retornos de confirmação/recuperação vindos do Supabase Auth via hash
  function checkAuthHashRedirect() {
    const hash = window.location.hash || '';
    if (!hash || (!hash.includes('error=') && !hash.includes('access_token=') && !hash.includes('error_code='))) {
      return false;
    }

    const cleanHash = hash.replace(/^#\/?/, '');
    const params = new URLSearchParams(cleanHash);
    const errorCode = params.get('error_code');
    const errorDesc = params.get('error_description');
    const accessToken = params.get('access_token');
    const type = params.get('type');

    if (errorCode || errorDesc) {
      let msg = 'O link de confirmação é inválido ou expirou.';
      if (errorCode === 'otp_expired') {
        msg = 'O link de confirmação expirou ou já foi utilizado. Solicite um novo link ou entre em contato com o suporte.';
      } else if (errorDesc) {
        msg = decodeURIComponent(errorDesc.replace(/\+/g, ' '));
      }
      setTimeout(() => {
        Toast.show({ title: 'Atenção na Confirmação', message: msg, type: 'warning', duration: 7000 });
      }, 300);
      window.history.replaceState(null, '', window.location.pathname + '#/login');
      return true;
    }

    if (accessToken) {
      if (type === 'recovery') {
        setTimeout(() => {
          Toast.show({ title: 'Redefinição de Senha', message: 'Defina a sua nova senha.', type: 'info', duration: 5000 });
        }, 300);
        window.history.replaceState(null, '', window.location.pathname + '#/admin/reset-password');
        return true;
      }
      setTimeout(() => {
        Toast.show({ title: 'E-mail Confirmado! 🎉', message: 'Sua conta foi ativada com sucesso.', type: 'success', duration: 5000 });
      }, 300);
      window.history.replaceState(null, '', window.location.pathname + '#/');
      return true;
    }

    return false;
  }

  // 5. Router handler
  function handleRoute() {
    if (checkAuthHashRedirect()) {
      handleRoute();
      return;
    }

    const rawHash = window.location.hash || '#/';
    const [pathPart, queryPart] = rawHash.replace(/^#/, '').split('?');
    const path = pathPart || '/';

    // Parse URL query params
    const queryParams = new URLSearchParams(queryPart || '');
    const searchQuery = queryParams.get('q') || queryParams.get('search');
    const categoryQuery = queryParams.get('cat') || queryParams.get('category');
    const subcategoryQuery = queryParams.get('sub') || queryParams.get('subcat') || queryParams.get('subcategory');

    mainContainer.innerHTML = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Toggle distraction-free checkout mode
    if (path.startsWith('/checkout') || path === '/checkout') {
      document.body.classList.add('checkout-mode');
    } else {
      document.body.classList.remove('checkout-mode');
    }

    // Toggle isolated corporate admin backoffice mode (hides all customer store layout elements)
    const isAdminRoute = path === '/admin' || path.startsWith('/admin/');
    if (isAdminRoute) {
      document.body.classList.add('admin-backoffice-mode');
    } else {
      document.body.classList.remove('admin-backoffice-mode');
    }

    // Rotas com ação modal ou de autenticação
    if (path === '/login') {
      mainContainer.appendChild(renderCatalogView());
      setTimeout(() => window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { tab: 'login' } })), 50);
      document.title = 'Entrar na Conta | NovaTech Angola';
      return;
    }
    if (path === '/cadastro') {
      mainContainer.appendChild(renderCatalogView());
      setTimeout(() => window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { tab: 'register' } })), 50);
      document.title = 'Criar Conta Gratuita | NovaTech Angola';
      return;
    }
    if (path === '/esqueci-senha' || path === '/recuperar-senha') {
      mainContainer.appendChild(renderCatalogView());
      setTimeout(() => window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { tab: 'forgot' } })), 50);
      document.title = 'Recuperar Senha | NovaTech Angola';
      return;
    }
    if (path === '/logout') {
      Api.auth.logout().catch(() => {});
      Storage.logoutUser();
      window.location.hash = '#/';
      return;
    }

    // Update document title for SEO
    let pageTitle = 'NovaTech Angola | Loja de Tecnologia e Eletrônicos Premium';

    if (path === '/' || path === '' || path === '/inicio' || path === '/catalogo' || path === '/produtos') {
      mainContainer.appendChild(renderCatalogView({
        searchQuery: searchQuery,
        categorySlug: categoryQuery,
        subcategorySlug: subcategoryQuery
      }));
      pageTitle = searchQuery ? `Busca por "${searchQuery}" | NovaTech Angola` : 'NovaTech Angola | Loja de Tecnologia e Eletrônicos Premium';
    } else if (path === '/categorias') {
      mainContainer.appendChild(renderCategoriesView());
      pageTitle = 'Todas as Categorias | NovaTech Angola';
    } else if (path.startsWith('/categoria/')) {
      const cleanPath = path.replace(/^\/categoria\/?/, '');
      const parts = cleanPath.split('/').filter(Boolean);
      const catSlug = parts[0] || '';
      const subSlug = parts[1] || subcategoryQuery;
      mainContainer.appendChild(renderCatalogView({ categorySlug: catSlug, subcategorySlug: subSlug }));
      const displayTitle = subSlug ? `${subSlug.toUpperCase()} - ${catSlug.toUpperCase()}` : catSlug.toUpperCase();
      pageTitle = `${displayTitle} | NovaTech Angola`;
    } else if (path.startsWith('/subcategoria/')) {
      const slug = path.replace('/subcategoria/', '');
      mainContainer.appendChild(renderCatalogView({ subcategorySlug: slug }));
      pageTitle = `${slug.toUpperCase()} | NovaTech Angola`;
    } else if (path.startsWith('/produto/')) {
      const slug = decodeURIComponent(path.replace(/^\/produto\/?/, '')).trim();
      mainContainer.appendChild(renderProductDetailView(slug));
      pageTitle = 'Detalhes do Produto | NovaTech Angola';
    } else if (path === '/carrinho') {
      mainContainer.appendChild(renderCartView());
      pageTitle = 'Meu Carrinho de Compras | NovaTech Angola';
    } else if (path === '/checkout') {
      mainContainer.appendChild(renderCheckoutView());
      pageTitle = 'Finalizar Pedido Seguro | NovaTech Angola';
    } else if (path === '/minha-conta' || path === '/perfil' || path === '/minha-conta/perfil') {
      mainContainer.appendChild(renderAccountView('profile'));
      pageTitle = 'Meu Perfil | NovaTech Angola';
    } else if (path === '/pedidos' || path === '/minha-conta/pedidos' || path === '/meus-pedidos') {
      mainContainer.appendChild(renderAccountView('orders'));
      pageTitle = 'Rastreamento de Pedidos | NovaTech Angola';
    } else if (path.startsWith('/pedido/')) {
      const orderId = path.replace('/pedido/', '');
      mainContainer.appendChild(renderAccountView('orders', orderId));
      pageTitle = `Pedido #${orderId} | NovaTech Angola`;
    } else if (path === '/enderecos' || path === '/minha-conta/enderecos') {
      mainContainer.appendChild(renderAccountView('addresses'));
      pageTitle = 'Endereços de Entrega | NovaTech Angola';
    } else if (path === '/favoritos') {
      mainContainer.appendChild(renderAccountView('wishlist'));
      pageTitle = 'Meus Favoritos | NovaTech Angola';
    } else if (path === '/ofertas') {
      mainContainer.appendChild(renderCatalogView({ isDeals: true }));
      pageTitle = 'Ofertas da Semana & Promoções | NovaTech Angola';
    } else if (path === '/novidades') {
      mainContainer.appendChild(renderCatalogView({ isNew: true }));
      pageTitle = 'Lançamentos & Novidades | NovaTech Angola';
    } else if (path === '/sobre') {
      mainContainer.appendChild(renderAboutView());
      pageTitle = 'Sobre a Loja | NovaTech Angola';
    } else if (path === '/contacto') {
      mainContainer.appendChild(renderContactView());
      pageTitle = 'Contactos & Localização | NovaTech Angola';
    } else if (path === '/faq') {
      mainContainer.appendChild(renderFAQView());
      pageTitle = 'Perguntas Frequentes (FAQ) | NovaTech Angola';
    } else if (path === '/politica-entrega') {
      mainContainer.appendChild(renderPolicyView('entrega'));
      pageTitle = 'Política de Entrega | NovaTech Angola';
    } else if (path === '/politica-devolucao') {
      mainContainer.appendChild(renderPolicyView('devolucao'));
      pageTitle = 'Política de Devolução | NovaTech Angola';
    } else if (path === '/privacidade' || path === '/termos') {
      mainContainer.appendChild(renderPolicyView('termos'));
      pageTitle = 'Termos e Privacidade | NovaTech Angola';
    } else if (path === '/admin' || path.startsWith('/admin/')) {
      mainContainer.appendChild(renderAdminView(path));
      pageTitle = 'Painel Administrativo | NovaTech Angola';
    } else {
      // 404 Fallback
      mainContainer.appendChild(renderCatalogView());
    }

    document.title = pageTitle;
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();

  // Purge any floating Netlify preview badge overlay
  function purgeNetlifyBadge() {
    const badElements = document.querySelectorAll(
      'a[href*="netlify.com"], [class*="netlify"], [id*="netlify"], netlify-drawer, netlify-feedback, [data-netlify-badge]'
    );
    badElements.forEach(el => {
      if (
        (el.textContent && el.textContent.includes('Powered by Netlify')) ||
        (el.tagName === 'A' && el.href && el.href.includes('netlify.com') && el.textContent.toLowerCase().includes('netlify')) ||
        (el.tagName && el.tagName.toLowerCase().startsWith('netlify-')) ||
        (el.id && el.id.includes('netlify-'))
      ) {
        el.remove();
      }
    });
  }

  purgeNetlifyBadge();
  const netlifyObserver = new MutationObserver(purgeNetlifyBadge);
  netlifyObserver.observe(document.documentElement, { childList: true, subtree: true });
}

// Start app safely regardless of when script is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
