// ===================================================================
// TOAST NOTIFICATIONS COMPONENT
// ===================================================================

import { Icons } from '../utils/icons.js';

let toastContainer = null;

function ensureContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
}

export const Toast = {
  show(options, typeFallback = 'success') {
    ensureContainer();

    let title = '';
    let message = '';
    let type = typeFallback;
    let duration = 4000;
    let actionLabel = null;
    let onAction = null;

    if (typeof options === 'string') {
      title = options;
      type = typeFallback;
    } else if (typeof options === 'object' && options !== null) {
      title = options.title || options.message || '';
      message = options.message && options.title && options.title !== options.message ? options.message : (options.description || '');
      type = options.type || typeFallback;
      duration = options.duration || 4000;
      actionLabel = options.actionLabel || null;
      onAction = options.onAction || null;
    }

    if (!title || String(title).trim().toLowerCase() === 'undefined') {
      title = type === 'error' ? 'Não foi possível concluir' : 'Notificação';
    }
    if (String(message).trim().toLowerCase() === 'undefined') {
      message = '';
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' 
      ? Icons.check(18) 
      : type === 'error' 
      ? Icons.alertCircle ? Icons.alertCircle(18) : Icons.close(18) 
      : Icons.shieldCheck(18);

    toast.innerHTML = `
      <div class="toast-icon">
        ${icon}
      </div>
      <div class="toast-content">
        <div class="toast-title">${title || 'Notificação'}</div>
        ${message ? `<div class="toast-desc">${message}</div>` : ''}
        ${actionLabel ? `
          <div class="toast-actions">
            <span class="toast-btn action-link">${actionLabel}</span>
          </div>
        ` : ''}
      </div>
      <button class="toast-close" style="color: #94a3b8; padding: 4px;">
        ${Icons.close(16)}
      </button>
    `;

    if (actionLabel && onAction) {
      toast.querySelector('.action-link').addEventListener('click', () => {
        onAction();
        toast.remove();
      });
    }

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });

    toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }
};
