// ===================================================================
// FORMATTING HELPERS (Currency Kz, Stars, Dates)
// ===================================================================

import { Icons } from './icons.js';

export function formatPrice(amount) {
  if (typeof amount !== 'number') {
    amount = Number(amount) || 0;
  }
  // Format as Kz 2.798.750 (with dot for thousands)
  const parts = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Kz ${parts}`;
}

export function calcDiscountPercent(oldPrice, currentPrice) {
  if (!oldPrice || oldPrice <= currentPrice) return 0;
  const pct = Math.round(((oldPrice - currentPrice) / oldPrice) * 100);
  return pct;
}

export function renderStars(rating = 5) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.4;
  let html = '';

  for (let i = 0; i < fullStars; i++) {
    html += Icons.star(15);
  }
  if (hasHalf && fullStars < 5) {
    html += Icons.starHalf(15);
  }
  const remaining = 5 - Math.ceil(rating);
  for (let i = 0; i < remaining; i++) {
    html += Icons.star(15, '#cbd5e1');
  }
  return html;
}

export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Converte erros técnicos do Supabase Auth em mensagens claras em português.
 */
export function formatAuthError(error) {
  if (!error) return 'Ocorreu um erro inesperado. Tente novamente.';
  const msg = (typeof error === 'string' ? error : error.message || error.error_description || '').toLowerCase();

  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'E-mail ou senha incorretos. Por favor, verifique os dados e tente novamente.';
  }
  if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
    return 'E-mail ainda não confirmado! Por favor, verifique sua caixa de entrada e clique no link de ativação enviado para o seu e-mail.';
  }
  if (msg.includes('user already registered') || msg.includes('already exists') || msg.includes('user_already_exists')) {
    return 'Este e-mail já está cadastrado no sistema. Tente iniciar sessão ou recupere sua senha.';
  }
  if (msg.includes('password should be at least 6 characters') || msg.includes('password is too short')) {
    return 'A senha deve conter no mínimo 6 caracteres.';
  }
  if (msg.includes('signup requires a valid password') || msg.includes('missing password')) {
    return 'Por favor, informe uma senha válida de acesso.';
  }
  if (msg.includes('invalid format') || msg.includes('unable to validate email') || msg.includes('valid email')) {
    return 'O formato do e-mail é inválido. Digite um e-mail no formato seu.nome@exemplo.com.';
  }
  if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit') || msg.includes('too many requests')) {
    return 'Muitas tentativas em pouco tempo. Por motivos de segurança, aguarde alguns instantes antes de tentar novamente.';
  }
  if (msg.includes('only request this once every') || msg.includes('slow down')) {
    return 'Por motivos de segurança, você só pode solicitar um novo e-mail a cada 60 segundos. Verifique sua caixa de entrada.';
  }
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('timeout')) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.';
  }

  return error.message || 'Não foi possível concluir a operação. Verifique os dados e tente novamente.';
}
