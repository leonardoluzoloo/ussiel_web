// ===================================================================
// IMAGE UPLOAD & OPTIMIZATION UTILITY
// Permite upload direto do dispositivo (Celular / Computador) com
// compressão via Canvas (Base64) e suporte a URL externa.
// ===================================================================

import { Icons } from './icons.js';

/**
 * Converte um File (imagem) em Data URL Base64 com redimensionamento e compressão.
 * Evita sobrecarga de memória e localStorage garantindo performance ultra-rápida.
 */
export function compressImageFile(file, options = {}) {
  const {
    maxWidth = 1400,
    maxHeight = 1400,
    quality = 0.85,
    mimeType = 'image/jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('O arquivo selecionado não é uma imagem válida.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo de imagem.'));
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao processar a imagem selecionada.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcula proporção para não distorcer
        if (width > maxWidth || height > maxHeight) {
          if (width / maxWidth > height / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(mimeType, quality);
        resolve({
          dataUrl,
          width,
          height,
          originalName: file.name,
          approxSizeKb: Math.round(dataUrl.length / 1024 * 0.75)
        });
      };
      img.src = readerEvent.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Renderiza um componente completo de Upload de Imagem interativo
 * com dropzone, botão de arquivo do dispositivo, preview e input de URL opcional.
 */
export function createImageUploader(config) {
  const {
    id = 'imgUploader_' + Math.random().toString(36).substring(2, 8),
    label = 'Imagem',
    initialUrl = '',
    helperText = 'Formatos suportados: JPG, PNG, WEBP.',
    aspectRatio = 'auto', // 'auto', '16/9', '4/3', '1/1'
    minimal = false,
    maxDimension = 1400,
    onChange = () => {}
  } = config;

  let currentImage = initialUrl || '';
  const container = document.createElement('div');
  container.className = 'corporate-image-uploader-wrap';
  container.id = `${id}_wrapper`;

  function renderUploader() {
    const hasImage = Boolean(currentImage && currentImage.trim());

    if (minimal) {
      container.innerHTML = `
        <div class="form-group" style="margin-bottom: 0;">
          <input type="hidden" id="${id}_value" value="${currentImage}" />
          <input type="file" id="${id}_fileInput" accept="image/*" style="display: none;" />

          ${hasImage ? `
            <div class="uploader-preview-card" style="position: relative; border-radius: 8px; border: 1px solid #e2e8f0; background: #0f172a; height: 140px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
              <img 
                id="${id}_previewImg" 
                src="${currentImage}" 
                alt="Prévia" 
                style="width: 100%; height: 100%; object-fit: cover; display: block;" 
              />
              <div style="position: absolute; bottom: 8px; right: 8px; display: flex; gap: 6px;">
                <button type="button" id="${id}_changeBtn" class="btn btn-secondary btn-sm" style="font-size: 0.6875rem; padding: 4px 10px; background: rgba(15,23,42,0.85); color: #fff; border: 1px solid rgba(255,255,255,0.2); font-weight: 600; cursor: pointer; border-radius: 4px;">
                  Substituir
                </button>
                <button type="button" id="${id}_clearBtn" class="btn btn-secondary btn-sm" style="font-size: 0.6875rem; padding: 4px 10px; background: rgba(220,38,38,0.85); color: #fff; border: none; font-weight: 600; cursor: pointer; border-radius: 4px;">
                  Remover
                </button>
              </div>
            </div>
          ` : `
            <div class="uploader-dropzone" id="${id}_dropzone" style="border: 1.5px dashed #cbd5e1; border-radius: 8px; padding: 18px 12px; background: #f8fafc; text-align: center; cursor: pointer; transition: all 0.15s ease;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 4px;">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
              <div style="font-size: 0.8125rem; font-weight: 600; color: #1e293b;">
                Clique para selecionar a arte ou arraste o arquivo
              </div>
              <div style="font-size: 0.6875rem; color: #94a3b8; margin-top: 2px;">
                Formato panorâmico recomendado (1920x600 px ou 16:9)
              </div>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <input 
                type="url" 
                id="${id}_urlInput" 
                class="form-input" 
                placeholder="Ou cole a URL direta da imagem..." 
                value="${currentImage.startsWith('http') ? currentImage : ''}" 
                style="height: 32px !important; font-size: 0.75rem !important; flex: 1;"
              />
              <button type="button" id="${id}_applyUrlBtn" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 4px 10px; font-weight: 600; white-space: nowrap; cursor: pointer;">
                Aplicar URL
              </button>
            </div>
          `}
        </div>
      `;
      attachEvents();
      return;
    }

    container.innerHTML = `
      <div class="form-group" style="margin-bottom: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <label class="form-label" style="margin-bottom: 0; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px;">
            <span>${label}</span>
            <span style="font-size: 0.75rem; color: #64748b; font-weight: normal;">(Upload direto ou Link)</span>
          </label>
          ${hasImage ? `
            <button type="button" class="btn-clear-img" id="${id}_clearBtn" style="background: none; border: none; font-size: 0.75rem; color: #ef4444; font-weight: 700; cursor: pointer; padding: 2px 6px;">
              ✕ Remover Imagem
            </button>
          ` : ''}
        </div>

        <input type="hidden" id="${id}_value" value="${currentImage}" />
        <input type="file" id="${id}_fileInput" accept="image/*" style="display: none;" />

        <!-- Preview ou Dropzone -->
        ${hasImage ? `
          <div class="uploader-preview-card" style="position: relative; border: 2px solid #e2e8f0; border-radius: 12px; background: #0f172a; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 160px; max-height: 280px;">
            <img 
              id="${id}_previewImg" 
              src="${currentImage}" 
              alt="Pré-visualização" 
              style="max-width: 100%; max-height: 240px; object-fit: contain; display: block; border-radius: 8px; padding: 6px;" 
            />
            <div style="width: 100%; background: rgba(15, 23, 42, 0.9); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1);">
              <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                ✓ Imagem carregada pronta para salvar
              </span>
              <button type="button" id="${id}_changeBtn" class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 0.75rem; background: #ffffff; color: #0f172a; font-weight: 700;">
                🔄 Substituir Imagem
              </button>
            </div>
          </div>
        ` : `
          <div class="uploader-dropzone" id="${id}_dropzone" style="border: 2px dashed #94a3b8; border-radius: 12px; padding: 24px 16px; background: #f8fafc; text-align: center; cursor: pointer; transition: all 0.2s ease;">
            <div style="width: 52px; height: 52px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <div style="font-weight: 700; color: #0f172a; font-size: 0.9375rem; margin-bottom: 4px;">
              Clique para selecionar imagem do seu dispositivo
            </div>
            <p style="font-size: 0.8125rem; color: #64748b; margin-bottom: 12px; max-width: 440px; margin-left: auto; margin-right: auto;">
              ${helperText}
            </p>
            <button type="button" id="${id}_selectBtn" class="btn btn-primary" style="padding: 8px 18px; font-size: 0.8125rem; font-weight: 700; gap: 6px; display: inline-flex; align-items: center;">
              📁 Escolher do Computador / Celular
            </button>
          </div>
        `}

        <!-- Toggle para Colar URL Externa -->
        <div style="margin-top: 8px;">
          <details style="font-size: 0.75rem; color: #64748b;">
            <summary style="cursor: pointer; font-weight: 600; color: #2563eb; user-select: none;">
              ↳ Ou colar link direto de imagem externa (URL)
            </summary>
            <div style="display: flex; gap: 8px; margin-top: 6px;">
              <input 
                type="url" 
                id="${id}_urlInput" 
                class="form-input" 
                placeholder="https://exemplo.com/foto.jpg" 
                value="${currentImage.startsWith('http') ? currentImage : ''}" 
                style="font-size: 0.8125rem; padding: 6px 10px;"
              />
              <button type="button" id="${id}_applyUrlBtn" class="btn btn-secondary btn-sm" style="flex-shrink: 0; padding: 6px 12px; font-size: 0.75rem;">
                Aplicar Link
              </button>
            </div>
          </details>
        </div>
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    const fileInput = container.querySelector(`#${id}_fileInput`);
    const selectBtn = container.querySelector(`#${id}_selectBtn`);
    const changeBtn = container.querySelector(`#${id}_changeBtn`);
    const dropzone = container.querySelector(`#${id}_dropzone`);
    const clearBtn = container.querySelector(`#${id}_clearBtn`);
    const urlInput = container.querySelector(`#${id}_urlInput`);
    const applyUrlBtn = container.querySelector(`#${id}_applyUrlBtn`);

    function triggerFilePicker(e) {
      e?.preventDefault();
      fileInput?.click();
    }

    if (selectBtn) selectBtn.addEventListener('click', triggerFilePicker);
    if (changeBtn) changeBtn.addEventListener('click', triggerFilePicker);

    if (dropzone) {
      dropzone.addEventListener('click', (e) => {
        if (e.target !== selectBtn) triggerFilePicker(e);
      });

      // Drag and drop
      ['dragenter', 'dragover'].forEach(evName => {
        dropzone.addEventListener(evName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.style.borderColor = '#0284c7';
          dropzone.style.background = '#f0f9ff';
        });
      });

      ['dragleave', 'drop'].forEach(evName => {
        dropzone.addEventListener(evName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.style.borderColor = '#94a3b8';
          dropzone.style.background = '#f8fafc';
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          handleFile(files[0]);
        }
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          handleFile(file);
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        setImage('');
      });
    }

    if (applyUrlBtn && urlInput) {
      applyUrlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const val = urlInput.value.trim();
        if (val) {
          setImage(val);
        }
      });
      urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = urlInput.value.trim();
          if (val) setImage(val);
        }
      });
    }
  }

  async function handleFile(file) {
    try {
      const dropzone = container.querySelector(`#${id}_dropzone`);
      if (dropzone) {
        dropzone.innerHTML = `
          <div style="padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
            <div style="width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #0284c7; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            <span style="font-size: 0.8125rem; font-weight: 600; color: #0284c7;">Comprimindo e carregando foto...</span>
          </div>
        `;
      }

      const res = await compressImageFile(file, {
        maxWidth: maxDimension,
        maxHeight: maxDimension,
        quality: 0.84
      });

      setImage(res.dataUrl);
    } catch (err) {
      alert(err.message || 'Erro ao carregar a imagem.');
      renderUploader();
    }
  }

  function setImage(newVal) {
    currentImage = newVal;
    const hiddenVal = container.querySelector(`#${id}_value`);
    if (hiddenVal) hiddenVal.value = newVal;
    renderUploader();
    onChange(newVal);
  }

  renderUploader();

  return {
    element: container,
    getValue: () => currentImage,
    setValue: (val) => setImage(val)
  };
}

/**
 * Componente corporativo de upload e gestão de múltiplas imagens (Galeria).
 * Suporta múltiplos arquivos simultâneos com compressão automática,
 * definição da foto de capa (principal), remoção e adição por link externo.
 */
export function createMultiImageUploader(config = {}) {
  const {
    id = 'multiImgUploader_' + Math.random().toString(36).substring(2, 8),
    label = 'Fotos',
    initialImages = [],
    helperText = '',
    minimal = false,
    maxDimension = 1200,
    onChange = () => {}
  } = config;

  let images = Array.isArray(initialImages)
    ? initialImages.filter(img => typeof img === 'string' && img.trim())
    : (typeof initialImages === 'string' && initialImages.trim() ? [initialImages.trim()] : []);

  const container = document.createElement('div');
  container.className = 'corporate-multi-image-uploader';
  container.id = `${id}_wrapper`;

  function render() {
    const wrapStyle = minimal
      ? 'background: transparent; border: none; padding: 0;'
      : 'background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 14px;';

    container.innerHTML = `
      <div style="${wrapStyle}">
        ${!minimal ? `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 8px;">
            <div>
              <div style="font-weight: 700; color: #0f172a; font-size: 0.875rem; display: flex; align-items: center; gap: 8px;">
                <span>${label}</span>
                <span style="font-size: 0.75rem; font-weight: 600; padding: 2px 7px; border-radius: 4px; background: ${images.length > 0 ? '#e0f2fe' : '#f1f5f9'}; color: ${images.length > 0 ? '#0284c7' : '#64748b'};">
                  ${images.length}
                </span>
              </div>
              ${helperText ? `<p style="font-size: 0.75rem; color: #64748b; margin: 3px 0 0 0;">${helperText}</p>` : ''}
            </div>
            <div style="display: flex; gap: 6px; flex-shrink: 0;">
              <button type="button" id="${id}_addBtn" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; font-weight: 600; padding: 5px 12px; display: inline-flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                <span>Upload</span>
              </button>
            </div>
          </div>
        ` : ''}

        <input type="file" id="${id}_fileInput" accept="image/*" multiple style="display: none;" />

        <!-- Grid de Fotos -->
        <div id="${id}_grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px; margin-bottom: 8px;">
          ${images.map((img, idx) => `
            <div class="multi-img-item" data-idx="${idx}" style="position: relative; border-radius: 6px; border: 1.5px solid ${idx === 0 ? '#2563eb' : '#e2e8f0'}; aspect-ratio: 1/1; background: #f8fafc; overflow: hidden; display: flex; align-items: center; justify-content: center;">
              <img src="${img}" alt="Foto ${idx + 1}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src=''; this.alt='Erro ao carregar';" />
              
              <!-- Badge de Capa -->
              ${idx === 0 ? `
                <span style="position: absolute; top: 4px; left: 4px; background: #2563eb; color: #ffffff; font-size: 0.625rem; font-weight: 700; padding: 2px 5px; border-radius: 3px; letter-spacing: 0.3px;">
                  CAPA
                </span>
              ` : `
                <button type="button" class="btn-make-cover" data-idx="${idx}" title="Definir como foto principal" style="position: absolute; bottom: 4px; left: 4px; background: rgba(15,23,42,0.85); color: #ffffff; border: none; font-size: 0.625rem; font-weight: 600; padding: 2px 6px; border-radius: 3px; cursor: pointer;">
                  Capa
                </button>
              `}

              <!-- Botão Excluir Foto -->
              <button type="button" class="btn-del-img" data-idx="${idx}" title="Remover foto" style="position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%; background: rgba(15,23,42,0.65); color: #ffffff; border: none; font-size: 0.6875rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">
                ✕
              </button>
            </div>
          `).join('')}

          <!-- Botão Dropzone / Adicionar Rápido -->
          <div id="${id}_addSlot" style="border: 1.5px dashed #cbd5e1; border-radius: 6px; aspect-ratio: 1/1; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; background: #f8fafc; color: #64748b; transition: all 0.15s ease; padding: 6px; text-align: center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 2px;"><path d="M12 5v14M5 12h14"/></svg>
            <span style="font-size: 0.6875rem; font-weight: 600;">+ Foto</span>
          </div>
        </div>

        <!-- Indicador de Carregamento -->
        <div id="${id}_loading" style="display: none; padding: 6px 10px; background: #eff6ff; border-radius: 6px; margin-bottom: 8px; font-size: 0.75rem; color: #1d4ed8; font-weight: 600; align-items: center; gap: 8px;">
          <div style="width: 12px; height: 12px; border: 2px solid #93c5fd; border-top-color: #1d4ed8; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
          <span>Carregando foto...</span>
        </div>

        <!-- Inserir por URL externa -->
        <div style="display: flex; gap: 6px; align-items: center; margin-top: 6px;">
          <input type="url" id="${id}_urlInput" class="form-input" placeholder="Cole o link da imagem (URL)..." style="font-size: 0.75rem; padding: 5px 9px; flex: 1;" />
          <button type="button" id="${id}_addUrlBtn" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 5px 10px; font-weight: 600; white-space: nowrap; cursor: pointer;">
            Adicionar URL
          </button>
        </div>
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    const fileInput = container.querySelector(`#${id}_fileInput`);
    const addBtn = container.querySelector(`#${id}_addBtn`);
    const addSlot = container.querySelector(`#${id}_addSlot`);
    const loadingEl = container.querySelector(`#${id}_loading`);
    const urlInput = container.querySelector(`#${id}_urlInput`);
    const addUrlBtn = container.querySelector(`#${id}_addUrlBtn`);

    const triggerPicker = (e) => {
      e?.preventDefault();
      fileInput?.click();
    };

    if (addBtn) addBtn.addEventListener('click', triggerPicker);
    if (addSlot) addSlot.addEventListener('click', triggerPicker);

    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (loadingEl) loadingEl.style.display = 'flex';

        for (const file of files) {
          try {
            const res = await compressImageFile(file, {
              maxWidth: maxDimension,
              maxHeight: maxDimension,
              quality: 0.85
            });
            if (res && res.dataUrl) {
              images.push(res.dataUrl);
            }
          } catch (err) {
            console.error('Erro ao comprimir imagem:', err);
          }
        }

        fileInput.value = '';
        if (loadingEl) loadingEl.style.display = 'none';
        render();
        onChange(images);
      });
    }

    if (addUrlBtn && urlInput) {
      const handleAddUrl = () => {
        const val = urlInput.value.trim();
        if (val) {
          images.push(val);
          urlInput.value = '';
          render();
          onChange(images);
        }
      };
      addUrlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleAddUrl();
      });
      urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAddUrl();
        }
      });
    }

    // Tornar Capa
    container.querySelectorAll('.btn-make-cover').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(btn.dataset.idx);
        if (!isNaN(idx) && idx >= 0 && idx < images.length) {
          const [selected] = images.splice(idx, 1);
          images.unshift(selected);
          render();
          onChange(images);
        }
      });
    });

    // Excluir
    container.querySelectorAll('.btn-del-img').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(btn.dataset.idx);
        if (!isNaN(idx) && idx >= 0 && idx < images.length) {
          images.splice(idx, 1);
          render();
          onChange(images);
        }
      });
    });
  }

  render();

  return {
    element: container,
    getImages: () => [...images],
    getCover: () => (images.length > 0 ? images[0] : null),
    setImages: (newImages) => {
      images = Array.isArray(newImages) ? newImages.filter(Boolean) : (newImages ? [newImages] : []);
      render();
      onChange(images);
    }
  };
}

