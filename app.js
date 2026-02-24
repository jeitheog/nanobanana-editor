// ── State ──────────────────────────────────────────────────
const state = {
    isGenerating: false,
    history: [],
    products: [],
    selectedIndices: new Set(),
    isBulkProcessing: false
};

// ── DOM Elements ──────────────────────────────────────────
const dom = {
    generatedImage: document.getElementById('generatedImage'),
    emptyState: document.getElementById('dropZone'),
    loader: document.getElementById('loader'),
    btnDownload: document.getElementById('btnDownload'),
    imageContainer: document.getElementById('imageContainer'),
    imgFileInput: document.getElementById('imgFileInput'),
    // CSV & Gallery Refs
    btnUploadCSV: document.getElementById('btnUploadCSV'),
    csvFileInput: document.getElementById('csvFileInput'),
    gallerySection: document.getElementById('gallerySection'),
    galleryGrid: document.getElementById('galleryGrid'),
    galleryCount: document.getElementById('galleryCount'),
    btnReplaceCSV: document.getElementById('btnReplaceCSV'),
    btnTranslateImage: document.getElementById('btnTranslateImage'),
    // History Refs
    btnHistory: document.getElementById('btnHistory'),
    historyPanel: document.getElementById('historyPanel'),
    historyGrid: document.getElementById('historyGrid'),
    closeHistory: document.getElementById('closeHistory'),
    // Bulk DOM
    btnSelectAllGallery: document.getElementById('btnSelectAllGallery'),
    bulkActions: document.getElementById('bulkActions'),
    btnBulkDownload: document.getElementById('btnBulkDownload'),
    btnBulkProcess: document.getElementById('btnBulkProcess'),
    selectedCount: document.getElementById('selectedCount'),
    bulkProgressBar: document.getElementById('bulkProgressBar'),
    bulkProgressFill: document.getElementById('bulkProgressFill')
};

// ── Initialization ────────────────────────────────────────
function init() {
    attachEventListeners();
}

function attachEventListeners() {
    dom.btnDownload.addEventListener('click', downloadImage);

    // Image drop zone
    dom.emptyState.addEventListener('click', () => dom.imgFileInput.click());
    dom.imgFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) loadImageFile(file);
    });

    dom.imageContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.imageContainer.classList.add('drop-active');
    });
    dom.imageContainer.addEventListener('dragleave', () => {
        dom.imageContainer.classList.remove('drop-active');
    });
    dom.imageContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.imageContainer.classList.remove('drop-active');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            loadImageFile(file);
            return;
        }
        const url = e.dataTransfer.getData('text/plain');
        if (url && url.startsWith('http')) {
            selectImageFromGallery(url);
        }
    });

    // Paste image (Ctrl+V)
    document.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                loadImageFile(item.getAsFile());
                break;
            }
        }
    });

    // History Listeners
    dom.btnHistory.addEventListener('click', () => {
        renderHistory();
        dom.historyPanel.classList.toggle('hidden');
    });
    dom.closeHistory.addEventListener('click', () => dom.historyPanel.classList.add('hidden'));

    // CSV & Gallery Listeners
    dom.btnUploadCSV.addEventListener('click', () => {
        if (state.products.length > 0) {
            dom.gallerySection.classList.toggle('hidden');
        } else {
            dom.csvFileInput.click();
        }
    });
    dom.csvFileInput.addEventListener('change', handleCSVUpload);
    dom.btnReplaceCSV.addEventListener('click', () => dom.csvFileInput.click());
    dom.btnTranslateImage.addEventListener('click', async () => {
        try {
            await translateTextImage();
        } catch (err) {
            console.error('Error traducción:', err);
            alert(`Error al traducir imagen:\n${err.message}`);
        }
    });

    // Bulk Event Listeners
    dom.btnSelectAllGallery.addEventListener('click', selectAllInGallery);
    dom.btnBulkDownload.addEventListener('click', bulkDownload);
    dom.btnBulkProcess.addEventListener('click', bulkProcess);

    // CSV Drag and Drop onto the button
    dom.btnUploadCSV.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.btnUploadCSV.classList.add('drag-over');
    });
    dom.btnUploadCSV.addEventListener('dragleave', () => {
        dom.btnUploadCSV.classList.remove('drag-over');
    });
    dom.btnUploadCSV.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.btnUploadCSV.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            processFile(file);
        }
    });
}

function loadImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        dom.emptyState.classList.add('hidden');
        dom.loader.classList.add('hidden');
        dom.generatedImage.classList.remove('hidden');
        dom.generatedImage.src = e.target.result;
        dom.btnDownload.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

// ── Core Functions ────────────────────────────────────────
async function translateTextImage() {
    if (dom.generatedImage.classList.contains('hidden') || !dom.generatedImage.src) {
        throw new Error('Primero selecciona una imagen.');
    }

    setGenerating(true);
    try {
        const { base64, mimeType } = getImageBase64(dom.generatedImage);

        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64, mimeType })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            throw new Error(err.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const item = data.data?.[0];
        if (!item?.b64_json) throw new Error('No se recibió imagen.');

        displayFinalImage(`data:image/png;base64,${item.b64_json}`, 'traducción al español');

    } finally {
        setGenerating(false);
    }
}

function getImageBase64(imgElement) {
    const canvas = document.createElement('canvas');
    const w = imgElement.naturalWidth || 1024;
    const h = imgElement.naturalHeight || 1024;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
}

async function generateWithDalle3(prompt) {
    setGenerating(true);
    try {
        const response = await fetch('/api/dalle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            throw new Error(err.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const item = data.data?.[0];
        if (!item?.b64_json) throw new Error('No se recibió imagen de DALL-E 3.');

        const imageUrl = `data:image/png;base64,${item.b64_json}`;
        displayFinalImage(imageUrl, prompt);

    } catch (err) {
        console.error('DALL-E 3 error:', err);
        alert(`Error al generar imagen:\n${err.message}`);
    } finally {
        setGenerating(false);
    }
}

function displayFinalImage(imageUrl, prompt) {
    dom.emptyState.classList.add('hidden');
    dom.loader.classList.add('hidden');
    dom.generatedImage.classList.remove('hidden');
    dom.generatedImage.src = imageUrl;
    dom.btnDownload.classList.remove('hidden');

    state.history.unshift({ prompt, image: imageUrl, timestamp: new Date() });
}

function setGenerating(status) {
    state.isGenerating = status;
    dom.loader.classList.toggle('hidden', !status);
    dom.emptyState.classList.toggle('hidden', status);
    dom.generatedImage.classList.toggle('hidden', status);
    if (status) dom.btnDownload.classList.add('hidden');
}

function downloadImage() {
    if (!dom.generatedImage.src) return;
    const link = document.createElement('a');
    link.href = dom.generatedImage.src;
    link.download = 'nano_banana_pro_art.png';
    link.click();
}

// ── CSV & Gallery Logic ────────────────────────────────────
function handleCSVUpload(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
}

function processFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        const products = parseShopifyCSV(text);
        if (products.length > 0) {
            renderGallery(products);
            dom.gallerySection.classList.remove('hidden');
        } else {
            alert('No se encontraron imágenes de productos en el CSV.');
        }
    };
    reader.readAsText(file);
}

function parseShopifyCSV(text) {
    const rows = [];
    let current = '';
    let inQuotes = false;
    let row = [];
    let i = 0;

    while (i < text.length) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') { current += '"'; i += 2; }
                else { inQuotes = false; i++; }
            } else { current += ch; i++; }
        } else {
            if (ch === '"') { inQuotes = true; i++; }
            else if (ch === ',') { row.push(current); current = ''; i++; }
            else if (ch === '\n' || ch === '\r') {
                row.push(current); current = ''; rows.push(row); row = []; i++;
                if (ch === '\r' && text[i] === '\n') i++;
            } else { current += ch; i++; }
        }
    }
    if (row.length > 0) { row.push(current); rows.push(row); }

    const headers = rows[0].map(h => h.trim());
    const titleIdx = headers.indexOf('Title');
    const imageIdx = headers.indexOf('Image Src');
    const handleIdx = headers.indexOf('Handle');

    const products = [];
    rows.slice(1).forEach(r => {
        let src = r[imageIdx];
        if (src && src.startsWith('http')) {
            const proxiedSrc = `https://images.weserv.nl/?url=${encodeURIComponent(src.split('?')[0])}&output=jpg`;
            products.push({
                title: r[titleIdx] || 'Producto sin título',
                handle: r[handleIdx] || '',
                src: proxiedSrc
            });
        }
    });

    return products;
}

function renderGallery(products) {
    state.products = products;
    state.selectedIndices.clear();
    updateBulkUI();
    dom.galleryCount.textContent = `${products.length} productos`;
    dom.galleryGrid.innerHTML = '';

    products.forEach((p, i) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.dataset.index = i;
        item.draggable = true;

        // Checkbox clickeable (selección) + imagen (cargar)
        item.innerHTML = `
            <div class="item-checkbox">✓</div>
            <img src="${p.src}" alt="${p.title}" title="${p.title}" crossorigin="anonymous">
        `;

        // Clic en checkbox → seleccionar (NO carga la imagen)
        item.querySelector('.item-checkbox').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSelection(i, item);
        });

        // Clic en la imagen → cargar en workspace
        item.addEventListener('click', () => {
            selectImageFromGallery(p.src);
        });

        // Long press en móvil → seleccionar
        let touchTimer;
        item.addEventListener('touchstart', () => {
            touchTimer = setTimeout(() => toggleSelection(i, item), 600);
        });
        item.addEventListener('touchend', () => clearTimeout(touchTimer));

        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', p.src);
            e.dataTransfer.effectAllowed = 'copy';
        });

        dom.galleryGrid.appendChild(item);
    });
}

function toggleSelection(index, element) {
    if (state.selectedIndices.has(index)) {
        state.selectedIndices.delete(index);
        element.classList.remove('selected');
    } else {
        state.selectedIndices.add(index);
        element.classList.add('selected');
    }
    updateBulkUI();
}

function updateBulkUI() {
    const count = state.selectedIndices.size;
    dom.selectedCount.textContent = count;
    dom.bulkActions.classList.toggle('hidden', count === 0);
    const allSelected = count === state.products.length && state.products.length > 0;
    dom.btnSelectAllGallery.textContent = allSelected ? '✗ Ninguno' : '✓ Todos';
}

function selectAllInGallery() {
    const shouldDeselect = state.selectedIndices.size === state.products.length;
    const items = dom.galleryGrid.querySelectorAll('.gallery-item');

    state.selectedIndices.clear();
    items.forEach((item, i) => {
        if (!shouldDeselect) {
            state.selectedIndices.add(i);
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    updateBulkUI();
}

async function bulkDownload() {
    const selected = Array.from(state.selectedIndices).map(i => state.products[i]);
    if (selected.length === 0) return;

    for (const [idx, p] of selected.entries()) {
        const link = document.createElement('a');
        link.href = p.src;
        link.download = `banana_${p.handle || idx}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise(r => setTimeout(r, 200));
    }
}

async function bulkProcess() {
    if (state.isBulkProcessing) return;
    const selected = Array.from(state.selectedIndices);
    if (selected.length === 0) return;

    if (!confirm(`¿Procesar ${selected.length} imágenes con IA? Esto usará tu cuota de OpenAI.`)) return;

    state.isBulkProcessing = true;
    dom.btnBulkProcess.disabled = true;
    dom.btnBulkDownload.disabled = true;
    const originalText = dom.btnBulkProcess.textContent;

    dom.bulkProgressBar.classList.remove('hidden');
    updateBulkProgress(0, selected.length);

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < selected.length; i++) {
        const index = selected[i];
        const p = state.products[index];
        dom.btnBulkProcess.textContent = `Procesando ${i + 1}/${selected.length}...`;
        updateBulkProgress(i, selected.length);

        try {
            // 1. Cargar imagen en workspace
            selectImageFromGallery(p.src);

            // 2. Esperar a que cargue
            await new Promise((resolve, reject) => {
                if (dom.generatedImage.complete && dom.generatedImage.naturalHeight > 0) {
                    resolve();
                } else {
                    dom.generatedImage.onload = resolve;
                    dom.generatedImage.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
                }
            });

            // 3. Traducir
            await translateTextImage();

            // 4. Descargar resultado
            const resLink = document.createElement('a');
            resLink.href = dom.generatedImage.src;
            resLink.download = `translated_${p.handle || index}.png`;
            document.body.appendChild(resLink);
            resLink.click();
            document.body.removeChild(resLink);

            succeeded++;
        } catch (err) {
            console.error(`Error imagen ${i + 1} (${p.title}):`, err);
            failed++;
        }

        if (i < selected.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    updateBulkProgress(selected.length, selected.length);
    state.isBulkProcessing = false;
    dom.btnBulkProcess.disabled = false;
    dom.btnBulkDownload.disabled = false;
    dom.btnBulkProcess.textContent = originalText;

    setTimeout(() => dom.bulkProgressBar.classList.add('hidden'), 2000);

    if (failed > 0) {
        alert(`Lote completado:\n✅ ${succeeded} traducidas\n❌ ${failed} fallidas`);
    } else {
        alert(`¡Lote completado! ${succeeded} imágenes traducidas y descargadas.`);
    }
}

function updateBulkProgress(current, total) {
    const pct = total === 0 ? 0 : Math.round((current / total) * 100);
    dom.bulkProgressFill.style.width = `${pct}%`;
}

function selectImageFromGallery(url) {
    dom.emptyState.classList.add('hidden');
    dom.loader.classList.add('hidden');
    dom.generatedImage.classList.remove('hidden');
    dom.generatedImage.crossOrigin = 'anonymous';
    dom.generatedImage.src = url;

    dom.generatedImage.style.opacity = '0';
    setTimeout(() => {
        dom.generatedImage.style.opacity = '1';
        dom.generatedImage.style.transition = 'opacity 0.5s ease';
    }, 50);
}

// ── History Logic ──────────────────────────────────────────
function renderHistory() {
    dom.historyGrid.innerHTML = '';
    if (state.history.length === 0) {
        dom.historyGrid.innerHTML = '<p class="history-empty">Sin historial aún.<br>Traduce o genera una imagen.</p>';
        return;
    }
    state.history.forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        const time = entry.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        item.innerHTML = `<img src="${entry.image}" alt="${entry.prompt}" title="${entry.prompt} · ${time}">`;
        item.addEventListener('click', () => {
            dom.emptyState.classList.add('hidden');
            dom.generatedImage.classList.remove('hidden');
            dom.generatedImage.src = entry.image;
            dom.btnDownload.classList.remove('hidden');
            dom.historyPanel.classList.add('hidden');
        });
        dom.historyGrid.appendChild(item);
    });
}

init();
