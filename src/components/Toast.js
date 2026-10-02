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
  show({ title, message, type = 'success', duration = 4000, actionLabel, onAction }) {
    ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? Icons.check(18) : Icons.shieldCheck(18);

    toast.innerHTML = `
      <div class="toast-icon">
        ${icon}
      </div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
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
