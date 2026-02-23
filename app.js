// ── State ──────────────────────────────────────────────────
const state = {
    isGenerating: false,
    history: []
};

// ── DOM Elements ──────────────────────────────────────────
const dom = {
    promptInput: document.getElementById('promptInput'),
    generateBtn: document.getElementById('generateBtn'),
    generatedImage: document.getElementById('generatedImage'),
    emptyState: document.querySelector('.empty-state'),
    loader: document.getElementById('loader'),
    btnDownload: document.getElementById('btnDownload'),
    // CSV & Gallery Refs
    btnUploadCSV: document.getElementById('btnUploadCSV'),
    csvFileInput: document.getElementById('csvFileInput'),
    galleryPanel: document.getElementById('galleryPanel'),
    galleryGrid: document.getElementById('galleryGrid'),
    closeGallery: document.getElementById('closeGallery'),
    btnTranslateImage: document.getElementById('btnTranslateImage')
};

// ── Initialization ────────────────────────────────────────
function init() {
    attachEventListeners();
}

function attachEventListeners() {
    dom.generateBtn.addEventListener('click', generateImage);
    dom.btnDownload.addEventListener('click', downloadImage);

    // CSV & Gallery Listeners
    dom.btnUploadCSV.addEventListener('click', () => dom.csvFileInput.click());
    dom.csvFileInput.addEventListener('change', handleCSVUpload);
    dom.closeGallery.addEventListener('click', () => dom.galleryPanel.classList.add('hidden'));
    dom.btnTranslateImage.addEventListener('click', translateTextImage);

    // Drag and Drop
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
        } else {
            alert('Por favor, arrastra un archivo CSV válido.');
        }
    });

    // Auto-resize textarea
    dom.promptInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

// ── Core Functions ────────────────────────────────────────
async function generateImage() {
    const prompt = dom.promptInput.value.trim();
    if (!prompt) return;
    generateWithDalle3(prompt);
}

async function translateTextImage() {
    if (dom.generatedImage.classList.contains('hidden') || !dom.generatedImage.src) {
        alert('Primero selecciona una imagen desde el CSV.');
        return;
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

    } catch (err) {
        console.error('Error traducción:', err);
        alert(`Error al traducir imagen:\n${err.message}`);
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
    dom.generateBtn.disabled = status;
    dom.loader.classList.toggle('hidden', !status);
    dom.emptyState.classList.toggle('hidden', status);
    dom.generatedImage.classList.toggle('hidden', status);
    if (status) dom.btnDownload.classList.add('hidden');

    dom.generateBtn.querySelector('span').textContent = status ? 'Creando...' : 'Generar';
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
            dom.galleryPanel.classList.remove('hidden');
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
    dom.galleryGrid.innerHTML = '';
    products.forEach(p => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `<img src="${p.src}" alt="${p.title}" title="${p.title}" crossorigin="anonymous">`;
        item.onclick = () => selectImageFromGallery(p.src);
        dom.galleryGrid.appendChild(item);
    });
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

init();
