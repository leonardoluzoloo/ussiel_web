// ===================================================================
// ALL CATEGORIES VIEW (Página "Todas as Categorias" - #/categorias)
// 100% Dinâmico • Dados Reais do Supabase • Cards Compactos
// ===================================================================

import { Icons } from '../utils/icons.js';
import { Api } from '../services/api.js';

export function renderCategoriesView() {
  const container = document.createElement('div');
  container.className = 'container all-categories-page';
  container.style.minHeight = '600px';

  let categories = [];

  function getCategoryIcon(cat) {
    const key = (cat.iconName || cat.icone || cat.slug || cat.name || '').toLowerCase();
    if (key.includes('smart') || key.includes('telef') || key.includes('celul') || key.includes('phone')) return Icons.smartphone ? Icons.smartphone(22) : Icons.package(22);
    if (key.includes('comput') || key.includes('portat') || key.includes('laptop') || key.includes('pc') || key.includes('inform')) return Icons.monitor ? Icons.monitor(22) : Icons.package(22);
    if (key.includes('tv') || key.includes('televis') || key.includes('monitor') || key.includes('ecra')) return Icons.tv ? Icons.tv(22) : Icons.package(22);
    if (key.includes('audi') || key.includes('som') || key.includes('fone') || key.includes('auscult')) return Icons.headphones ? Icons.headphones(22) : Icons.package(22);
    if (key.includes('gam') || key.includes('jog') || key.includes('consol')) return Icons.gamepad ? Icons.gamepad(22) : Icons.package(22);
    if (key.includes('acess') || key.includes('cabo') || key.includes('carreg') || key.includes('plug')) return Icons.plug ? Icons.plug(22) : Icons.package(22);
    if (key.includes('casa') || key.includes('home') || key.includes('segur')) return Icons.home ? Icons.home(22) : Icons.package(22);
    if (key.includes('foto') || key.includes('camar') || key.includes('lens')) return Icons.camera ? Icons.camera(22) : Icons.image(22);
    if (key.includes('wear') || key.includes('relog') || key.includes('watch') || key.includes('pulseir')) return Icons.watch ? Icons.watch(22) : Icons.package(22);
    if (Icons[cat.iconName]) return Icons[cat.iconName](22);
    return Icons.package(22);
  }

  async function loadData() {
    try {
      const realCats = await Api.categories.getAll();
      if (realCats && realCats.length > 0) {
        categories = realCats.filter(c => c.is_active !== false && c.ativo !== false);
        render();
      }
    } catch (e) {
      console.warn('[Categorias] Erro ao carregar dados:', e.message);
    }
  }

  loadData();
  window.addEventListener('categories-updated', loadData);

  function render() {
    container.innerHTML = `
      <!-- Breadcrumb Limpo -->
      <nav class="category-breadcrumb" aria-label="Navegação estrutural" style="margin-top: 18px; margin-bottom: 14px;">
        <a href="#/">Início</a>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">Categorias</span>
      </nav>

      <!-- Cabeçalho Executivo -->
      <header class="all-categories-header" style="margin-bottom: 20px;">
        <h1 style="font-size: 1.6rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; letter-spacing: -0.02em;">Categorias</h1>
        <p style="font-size: 0.9rem; color: #64748b; margin: 0;">Selecione uma categoria para explorar os produtos.</p>
      </header>

      <!-- Grid Compacto de Categorias (Quadrados menores e elegantes) -->
      <div class="all-categories-grid">
        ${categories.length === 0 ? `
          <div class="all-categories-empty" style="padding: 40px; text-align: center; color: #64748b;">
            <p>Nenhuma categoria disponível no momento.</p>
          </div>
        ` : categories.map(cat => {
          const catSlug = cat.slug || cat.uid || cat.id;
          const subs = Array.isArray(cat.subcategories) ? cat.subcategories : (cat.subcategorias || []);
          const activeSubs = subs.filter(s => s && s.is_active !== false && s.ativo !== false);
          // Limita rigorosamente a no máximo 4 subcategorias no quadrado
          const displayedSubs = activeSubs.slice(0, 4);
          const remainingCount = activeSubs.length - 4;
          const catImg = cat.image || cat.image_url;

          return `
            <div class="category-card-pro" data-slug="${catSlug}">
              <div class="category-card-pro-top">
                <div class="category-card-pro-icon-box">
                  ${catImg ? `
                    <img src="${catImg}" alt="${cat.name}" class="category-card-pro-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                    <div class="category-card-pro-icon" style="display: none;">${getCategoryIcon(cat)}</div>
                  ` : `
                    <div class="category-card-pro-icon">${getCategoryIcon(cat)}</div>
                  `}
                </div>
                <div class="category-card-pro-info">
                  <h2 class="category-card-pro-title">
                    <a href="#/categoria/${catSlug}">${cat.name}</a>
                  </h2>
                </div>
              </div>

              ${displayedSubs.length > 0 ? `
                <div class="category-card-pro-subs">
                  ${displayedSubs.map(sub => {
                    const subName = typeof sub === 'string' ? sub : (sub.name || sub.nome || '');
                    const subSlug = typeof sub === 'string' ? sub : (sub.slug || sub.uid || sub.name || '');
                    if (!subName) return '';
                    return `
                      <a href="#/categoria/${catSlug}/${encodeURIComponent(subSlug)}" class="category-card-sub-pill" title="Ver ${subName}">
                        ${subName}
                      </a>
                    `;
                  }).join('')}
                  ${remainingCount > 0 ? `
                    <a href="#/categoria/${catSlug}" class="category-card-sub-pill more-pill" title="Ver mais ${remainingCount} subcategorias">
                      +${remainingCount}
                    </a>
                  ` : ''}
                </div>
              ` : ''}

              <div class="category-card-pro-footer">
                <a href="#/categoria/${catSlug}" class="btn-category-explore">
                  <span>Ver produtos</span>
                  <span class="btn-category-explore-arrow">→</span>
                </a>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  render();
  return container;
}
