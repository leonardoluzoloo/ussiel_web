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
