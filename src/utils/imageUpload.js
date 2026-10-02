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
    helperText = 'Formatos suportados: JPG, PNG, WEBP. Você pode tirar foto com o celular ou escolher da galeria/computador.',
    aspectRatio = 'auto', // 'auto', '16/9', '4/3', '1/1'
    maxDimension = 1400,
    onChange = () => {}
  } = config;

  let currentImage = initialUrl || '';
  const container = document.createElement('div');
  container.className = 'corporate-image-uploader-wrap';
  container.id = `${id}_wrapper`;

  function renderUploader() {
    const hasImage = Boolean(currentImage && currentImage.trim());

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
