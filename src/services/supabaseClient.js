// ===================================================================
// SUPABASE CLIENT (Direct HTTPS REST & Auth Client - Zero Port Issues)
// ===================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://emdqkhiahkildtmhdrxk.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const REMEMBER_ME_STORAGE_KEY = 'novatech_remember_me';

/**
 * Smart Auth Storage Adapter:
 * Implementa a Regra 2 de Alto Padrão da Indústria:
 * 1. Administrador (role === 'admin'):
 *    - NUNCA persiste em localStorage. Armazenamento 100% restrito a sessionStorage.
 *    - Ao fechar o navegador/aba, a sessão encerra imediatamente por segurança corporativa.
 * 2. Cliente Comum (role === 'customer'):
 *    - Se 'Lembrar de mim' estiver ativado (novatech_remember_me === 'true'): persiste em localStorage.
 *    - Se 'Lembrar de mim' estiver desativado: reside estritamente em sessionStorage (modo computador público).
 */
export const smartAuthStorageAdapter = {
  getItem(key) {
    if (typeof window === 'undefined') return null;
    try {
      // 1. Sempre prioriza a sessão volátil em sessionStorage (utilizada por admin ou clientes sem 'lembrar')
      const sessionVal = window.sessionStorage.getItem(key);
      if (sessionVal) return sessionVal;

      // 2. Se não estiver no sessionStorage, checa se 'Lembrar de mim' está ativo para cliente
      const isRememberMe = window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY) === 'true';
      if (isRememberMe) {
        const localVal = window.localStorage.getItem(key);
        if (localVal) {
          // Hardening de Segurança: valida se porventura contém privilégio de admin no payload
          if (localVal.includes('"role":"admin"') || localVal.includes('"role": "admin"')) {
            // ADMIN NUNCA DEVE ESTAR NO LOCALSTORAGE. Purga imediata!
            window.localStorage.removeItem(key);
            window.localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
            return null;
          }
          return localVal;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  setItem(key, value) {
    if (typeof window === 'undefined') return;
    try {
      // Verifica se o valor contém privilégio administrativo ou se há sessão de admin ativa
      const isAdminSession = (
        (value && (value.includes('"role":"admin"') || value.includes('"role": "admin"'))) ||
        Boolean(window.sessionStorage.getItem('novatech_admin_user_v1'))
      );

      if (isAdminSession) {
        // ADMIN: Salva estritamente em sessionStorage e garante que localStorage não tenha resíduos
        window.sessionStorage.setItem(key, value);
        window.localStorage.removeItem(key);
        window.localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
        return;
      }

      // CLIENTES: Verifica se marcou 'Lembrar de mim'
      const isRememberMe = window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY) === 'true';
      if (isRememberMe) {
        window.localStorage.setItem(key, value);
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, value);
        window.localStorage.removeItem(key);
      }
    } catch {}
  },

  removeItem(key) {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(key);
      window.localStorage.removeItem(key);
    } catch {}
  }
};

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: typeof window !== 'undefined' ? smartAuthStorageAdapter : undefined,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export const isSupabaseConfigured = () => {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 20);
};

// Cliente isolado em memória (sem persistência no localStorage) para registrar novos usuários/admins
// sem derrubar a sessão ativa do administrador autenticado no navegador
export const createIsolatedAuthClient = () => {
  if (!isSupabaseConfigured()) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
};
