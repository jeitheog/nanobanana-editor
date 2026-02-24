// ── State ──────────────────────────────────────────────────
const state = {
    isGenerating: false,
    history: [],
    products: [],        // productos completos (con id, imageId si son de Shopify)
    filteredProducts: [], // productos filtrados por búsqueda
    selectedIndices: new Set(), // índices sobre filteredProducts
    isBulkProcessing: false,
    source: null         // 'shopify' | 'csv'
};

// Nano Banana Pro - v1.0.1 (Shopify Integration Update)
// ── DOM Elements ──────────────────────────────────────────
const dom = {
    generatedImage: document.getElementById('generatedImage'),
    emptyState: document.getElementById('dropZone'),
    loader: document.getElementById('loader'),
    loaderText: document.getElementById('loaderText'),
    statusText: document.getElementById('statusText'),
    btnDownload: document.getElementById('btnDownload'),
    imageContainer: document.getElementById('imageContainer'),
    imgFileInput: document.getElementById('imgFileInput'),
    // Importar
    btnLoadShopify: document.getElementById('btnLoadShopify'),
    btnUploadCSV: document.getElementById('btnUploadCSV'),
    csvFileInput: document.getElementById('csvFileInput'),
    // Explorer / Central Gallery Redesign
    shopifyShop: document.getElementById('shopifyShop'),
    shopifyToken: document.getElementById('shopifyToken'),
    btnVerifyShopify: document.getElementById('btnVerifyShopify'),
    shopifyStatus: document.getElementById('shopifyStatus'),
    shopifyStatusText: document.getElementById('shopifyStatusText'),
    btnImportShopify: document.getElementById('btnImportShopify'),
    btnReloadSource: document.getElementById('btnReloadSource'),
    btnAI: document.getElementById('btnAI'),
    btnTranslateImage: document.getElementById('btnTranslateImage'),
    // History
    btnHistory: document.getElementById('btnHistory'),
    historyPanel: document.getElementById('historyPanel'),
    historyGrid: document.getElementById('historyGrid'),
    closeHistory: document.getElementById('closeHistory'),
    // Explorer / Central Gallery Redesign
    editorView: document.getElementById('editorView'),
    explorerView: document.getElementById('explorerView'),
    centralGalleryGrid: document.getElementById('centralGalleryGrid'),
    centralGalleryCount: document.getElementById('centralGalleryCount'),
    centralSearchInput: document.getElementById('centralSearchInput'),
    btnSelectAllCentral: document.getElementById('btnSelectAllCentral'),
    btnCloseExplorer: document.getElementById('btnCloseExplorer'),
    centralBulkActions: document.getElementById('centralBulkActions'),
    centralSelectedCount: document.getElementById('centralSelectedCount'),
    btnCentralBulkProcess: document.getElementById('btnCentralBulkProcess'),
    btnCentralBulkDownload: document.getElementById('btnCentralBulkDownload'),
    centralBulkProgressBar: document.getElementById('centralBulkProgressBar'),
    centralBulkProgressFill: document.getElementById('centralBulkProgressFill')
};

// ── Initialization ────────────────────────────────────────
function init() {
    loadShopifyCredentials();
    attachEventListeners();
}

function loadShopifyCredentials() {
    const shop = localStorage.getItem('shopify_shop');
    const token = localStorage.getItem('shopify_token');
    if (shop) dom.shopifyShop.value = shop;
    if (token) dom.shopifyToken.value = token;
    if (shop && token) verifyShopifyConnection(true);
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
        if (url && url.startsWith('http')) selectImageFromGallery(url);
    });

    // Paste (Ctrl+V)
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

    // History
    dom.btnHistory.addEventListener('click', () => {
        renderHistory();
        dom.historyPanel.classList.toggle('hidden');
    });
    dom.closeHistory.addEventListener('click', () => dom.historyPanel.classList.add('hidden'));

    // Shopify
    dom.btnLoadShopify.addEventListener('click', loadShopifyProducts);

    // CSV
    dom.btnUploadCSV.addEventListener('click', () => {
        if (state.products.length > 0) {
            switchView('explorer');
        } else {
            dom.csvFileInput.click();
        }
    });
    dom.csvFileInput.addEventListener('change', handleCSVUpload);

    // Reload source button (↺)
    dom.btnReloadSource.addEventListener('click', () => {
        if (state.source === 'shopify') {
            loadShopifyProducts();
        } else {
            dom.csvFileInput.click();
        }
    });

    // Translate
    dom.btnTranslateImage.addEventListener('click', async () => {
        try {
            await translateTextImage();
        } catch (err) {
            console.error('Error traducción:', err);
            alert(`Error al traducir imagen:\n${err.message}`);
        }
    });

    // Shopify credentials buttons
    dom.btnVerifyShopify.addEventListener('click', () => verifyShopifyConnection());
    dom.btnImportShopify.addEventListener('click', bulkImportToShopify);

    // Explorer Listeners
    dom.btnCloseExplorer.addEventListener('click', () => switchView('editor'));
    dom.centralSearchInput.addEventListener('input', (e) => filterGallery(e.target.value.trim()));
    dom.btnSelectAllCentral.addEventListener('click', selectAllInGallery);
    dom.btnCentralBulkDownload.addEventListener('click', bulkDownload);
    dom.btnCentralBulkProcess.addEventListener('click', bulkProcess);
}

function switchView(viewName) {
    if (viewName === 'editor') {
        dom.editorView.classList.remove('hidden');
        dom.explorerView.classList.add('hidden');
        dom.btnAI.classList.add('active');
        dom.btnLoadShopify.classList.remove('active');
        dom.btnUploadCSV.classList.remove('active');
    } else {
        dom.editorView.classList.add('hidden');
        dom.explorerView.classList.remove('hidden');
        dom.btnAI.classList.remove('active');
        if (state.source === 'shopify') {
            dom.btnLoadShopify.classList.add('active');
            dom.btnUploadCSV.classList.remove('active');
        } else if (state.source === 'csv') {
            dom.btnUploadCSV.classList.add('active');
            dom.btnLoadShopify.classList.remove('active');
        }
    }
}

// ── Shopify Integration Logic ──────────────────────────────
async function verifyShopifyConnection(isAuto = false) {
    const shop = dom.shopifyShop.value.trim();
    const token = dom.shopifyToken.value.trim();

    if (!shop || !token) {
        if (!isAuto) alert('Por favor, introduce el dominio de tu tienda y el Access Token.');
        return;
    }

    if (!isAuto) dom.btnVerifyShopify.textContent = 'Verificando...';

    try {
        const res = await fetch('/api/shopify-products', {
            headers: {
                'x-shopify-shop': shop,
                'x-shopify-token': token
            }
        });

        if (!res.ok) throw new Error('Credenciales inválidas o error de conexión.');

        const data = await res.json();

        // Success
        localStorage.setItem('shopify_shop', shop);
        localStorage.setItem('shopify_token', token);

        dom.shopifyStatus.classList.remove('hidden', 'error');
        dom.shopifyStatus.classList.add('connected');
        dom.shopifyStatusText.textContent = `Conectado: ${shop}`;
        dom.btnImportShopify.disabled = false;

        if (data.products && data.products.length > 0) {
            state.source = 'shopify';
            renderGallery(data.products.map(p => ({
                title: p.title,
                handle: p.handle,
                src: `https://images.weserv.nl/?url=${encodeURIComponent(p.imageSrc.split('?')[0])}&output=jpg`,
                id: p.id,
                imageId: p.imageId
            })));
        }
    } catch (err) {
        console.error('Verify error:', err);
        dom.shopifyStatus.classList.remove('hidden', 'connected');
        dom.shopifyStatus.classList.add('error');
        dom.shopifyStatusText.textContent = `Error: ${err.message}`;
        dom.btnImportShopify.disabled = true;
    } finally {
        dom.btnVerifyShopify.textContent = 'Verificar';
    }
}

async function bulkImportToShopify() {
    if (state.isBulkProcessing) return;
    const selected = Array.from(state.selectedIndices);
    if (selected.length === 0) {
        alert('Selecciona productos de la galería primero.');
        return;
    }

    if (!confirm(`¿Subir ${selected.length} productos traducidos directamente a Shopify?`)) return;

    state.isBulkProcessing = true;
    dom.btnImportShopify.disabled = true;
    const originalText = dom.btnImportShopify.textContent;

    try {
        for (let i = 0; i < selected.length; i++) {
            const index = selected[i];
            const p = state.products[index];
            dom.btnImportShopify.textContent = `Subiendo ${i + 1}/${selected.length}...`;

            // 1. Select and Process
            selectImageFromGallery(p.src);
            await new Promise(r => dom.generatedImage.complete ? r() : dom.generatedImage.onload = r);

            await translateTextImage();

            // 2. Upload to Shopify
            const { base64 } = getImageBase64(dom.generatedImage);
            const shop = dom.shopifyShop.value.trim();
            const token = dom.shopifyToken.value.trim();

            const upRes = await fetch('/api/shopify-upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shopify-shop': shop,
                    'x-shopify-token': token
                },
                body: JSON.stringify({
                    productId: p.id,
                    oldImageId: p.imageId,
                    imageBase64: base64
                })
            });

            if (!upRes.ok) {
                const err = await upRes.json().catch(() => ({}));
                console.error('Error subiendo a Shopify:', err);
            }

            await new Promise(r => setTimeout(r, 1000));
        }
        alert('¡Importación completada!');
    } catch (err) {
        console.error('Bulk import error:', err);
        alert(`Error en la importación: ${err.message}`);
    } finally {
        state.isBulkProcessing = false;
        dom.btnImportShopify.disabled = false;
        dom.btnImportShopify.textContent = originalText;
    }
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

// ── Shopify Integration ───────────────────────────────────
async function loadShopifyProducts() {
    setStatus('Cargando productos de Shopify...');
    dom.btnLoadShopify.disabled = true;
    dom.btnLoadShopify.textContent = '⏳ Cargando...';

    try {
        const res = await fetch('/api/shopify-products');
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        const products = data.products.map(p => ({
            id: p.id,
            imageId: p.imageId,
            title: p.title,
            handle: p.handle,
            src: `https://images.weserv.nl/?url=${encodeURIComponent(p.imageSrc.split('?')[0])}&output=jpg`,
            originalSrc: p.imageSrc
        }));

        state.source = 'shopify';
        renderGallery(products);
        setStatus(`${products.length} productos cargados`);

    } catch (err) {
        console.error('Shopify error:', err);
        alert(`Error al conectar con Shopify:\n${err.message}\n\nVerifica que SHOPIFY_SHOP y SHOPIFY_ACCESS_TOKEN están configurados en Vercel.`);
        setStatus('Listo para crear');
    } finally {
        dom.btnLoadShopify.disabled = false;
        dom.btnLoadShopify.innerHTML = '<span class="icon">🛍️</span> Cargar desde Shopify';
    }
}

async function uploadToShopify(productId, oldImageId, imageBase64) {
    const res = await fetch('/api/shopify-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, oldImageId, imageBase64 })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

// ── Core Functions ────────────────────────────────────────
async function translateTextImage() {
    if (dom.generatedImage.classList.contains('hidden') || !dom.generatedImage.src) {
        throw new Error('Primero selecciona una imagen.');
    }

    setLoaderText('Traduciendo texto de la imagen...');
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
    setLoaderText('Generando imagen con DALL-E 3...');
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
        displayFinalImage(`data:image/png;base64,${item.b64_json}`, prompt);

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

function setLoaderText(text) {
    dom.loaderText.textContent = text;
}

function setStatus(text) {
    dom.statusText.textContent = text;
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
            state.source = 'csv';
            renderGallery(products);
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
            products.push({
                title: r[titleIdx] || 'Producto sin título',
                handle: r[handleIdx] || '',
                src: `https://images.weserv.nl/?url=${encodeURIComponent(src.split('?')[0])}&output=jpg`
            });
        }
    });

    return products;
}

function renderGallery(products) {
    state.products = products;
    state.filteredProducts = products;
    state.selectedIndices.clear();
    dom.centralSearchInput.value = '';
    updateBulkUI();
    dom.centralGalleryCount.textContent = `${products.length} productos`;
    renderGalleryItems(products);
    switchView('explorer');
}

function filterGallery(query) {
    if (!query) {
        state.filteredProducts = state.products;
    } else {
        const q = query.toLowerCase();
        state.filteredProducts = state.products.filter(p =>
            p.title.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q)
        );
    }
    state.selectedIndices.clear();
    updateBulkUI();
    renderGalleryItems(state.filteredProducts);
    dom.centralGalleryCount.textContent = `${state.filteredProducts.length} / ${state.products.length} productos`;
}

function renderGalleryItems(products) {
    dom.centralGalleryGrid.innerHTML = '';

    products.forEach((p, i) => {
        const item = document.createElement('div');
        item.className = 'product-card';
        if (state.selectedIndices.has(i)) item.classList.add('selected');
        item.dataset.index = i;

        item.innerHTML = `
            <div class="img-wrapper">
                <img src="${p.src}" alt="${p.title}" crossorigin="anonymous">
                <div class="selection-check"></div>
            </div>
            <div class="info">
                <div class="title">${p.title}</div>
            </div>
        `;

        item.addEventListener('click', (e) => {
            // If dragging would be here, but let's stick to click for selection or load
            toggleSelection(i, item);
        });

        // Double click to load in editor
        item.addEventListener('dblclick', () => {
            selectImageFromGallery(p.src);
            switchView('editor');
        });

        dom.centralGalleryGrid.appendChild(item);
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
    dom.centralSelectedCount.textContent = count;
    dom.centralBulkActions.classList.toggle('hidden', count === 0);
    const allSelected = count === state.filteredProducts.length && state.filteredProducts.length > 0;
    dom.btnSelectAllCentral.textContent = allSelected ? '✗ Ninguno' : '✓ Todos';
}

function selectAllInGallery() {
    const shouldDeselect = state.selectedIndices.size === state.filteredProducts.length;
    const cards = dom.centralGalleryGrid.querySelectorAll('.product-card');

    state.selectedIndices.clear();
    cards.forEach((card, i) => {
        if (!shouldDeselect) {
            state.selectedIndices.add(i);
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
    updateBulkUI();
}

async function bulkDownload() {
    const selected = Array.from(state.selectedIndices).map(i => state.filteredProducts[i]);
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

    const isShopify = state.source === 'shopify';
    const action = isShopify ? 'traducir y subir a Shopify' : 'traducir';
    if (!confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} ${selected.length} imágenes? Esto usará tu cuota de OpenAI.`)) return;

    state.isBulkProcessing = true;
    dom.btnCentralBulkProcess.disabled = true;
    dom.btnCentralBulkDownload.disabled = true;
    const originalText = dom.btnCentralBulkProcess.textContent;

    dom.centralBulkProgressBar.classList.remove('hidden');
    updateBulkProgress(0, selected.length);

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < selected.length; i++) {
        const index = selected[i];
        const p = state.filteredProducts[index];
        dom.btnCentralBulkProcess.textContent = `${i + 1}/${selected.length} — ${p.title.substring(0, 20)}...`;
        updateBulkProgress(i, selected.length);
        setStatus(`Procesando ${i + 1}/${selected.length}: ${p.title.substring(0, 25)}...`);

        try {
            // 1. Cargar imagen
            selectImageFromGallery(p.src);
            await new Promise((resolve, reject) => {
                if (dom.generatedImage.complete && dom.generatedImage.naturalHeight > 0) {
                    resolve();
                } else {
                    dom.generatedImage.onload = resolve;
                    dom.generatedImage.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
                }
            });

            // 2. Traducir
            await translateTextImage();

            if (isShopify && p.id) {
                // 3a. Subir a Shopify
                setLoaderText(`Subiendo a Shopify: ${p.title.substring(0, 25)}...`);
                setGenerating(true);
                const dataUrl = dom.generatedImage.src;
                const base64 = dataUrl.split(',')[1];
                await uploadToShopify(p.id, p.imageId, base64);
                setGenerating(false);
            } else {
                // 3b. Descargar localmente (modo CSV)
                const resLink = document.createElement('a');
                resLink.href = dom.generatedImage.src;
                resLink.download = `translated_${p.handle || index}.png`;
                document.body.appendChild(resLink);
                resLink.click();
                document.body.removeChild(resLink);
            }

            succeeded++;
        } catch (err) {
            console.error(`Error imagen ${i + 1} (${p.title}):`, err);
            setGenerating(false);
            failed++;
        }

        if (i < selected.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    updateBulkProgress(selected.length, selected.length);
    state.isBulkProcessing = false;
    dom.btnCentralBulkProcess.disabled = false;
    dom.btnCentralBulkDownload.disabled = false;
    dom.btnCentralBulkProcess.textContent = originalText;
    setTimeout(() => dom.centralBulkProgressBar.classList.add('hidden'), 2000);

    const verb = isShopify ? 'subidas a Shopify' : 'descargadas';
    setStatus(`Listo — ${succeeded} ${verb}${failed > 0 ? `, ${failed} fallidas` : ''}`);

    if (failed > 0) {
        alert(`Lote completado:\n✅ ${succeeded} ${verb}\n❌ ${failed} fallidas`);
    } else {
        alert(`¡Lote completado! ${succeeded} imágenes ${verb}.`);
    }
}

function updateBulkProgress(current, total) {
    const pct = total === 0 ? 0 : Math.round((current / total) * 100);
    dom.centralBulkProgressFill.style.width = `${pct}%`;
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
