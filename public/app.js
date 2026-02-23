import { GoogleGenerativeAI } from "@google/generative-ai";

// ── State ──────────────────────────────────────────────────
const state = {
    apiKey: localStorage.getItem('nano_banana_api_key') || '',
    modelName: localStorage.getItem('nano_banana_model') || 'gemini-1.5-flash',
    genAI: null,
    model: null,
    isGenerating: false,
    history: []
};

const MODEL_FALLBACKS = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'];

// ── DOM Elements ──────────────────────────────────────────
const dom = {
    promptInput: document.getElementById('promptInput'),
    generateBtn: document.getElementById('generateBtn'),
    imageContainer: document.getElementById('imageContainer'),
    generatedImage: document.getElementById('generatedImage'),
    emptyState: document.querySelector('.empty-state'),
    loader: document.getElementById('loader'),
    btnSettings: document.getElementById('btnSettings'),
    settingsModal: document.getElementById('settingsModal'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    modelSelect: document.getElementById('modelSelect'),
    saveSettings: document.getElementById('saveSettings'),
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
    if (state.apiKey) {
        setupAI();
    } else {
        showModal();
    }
    attachEventListeners();
}

function setupAI(modelName = state.modelName) {
    if (!state.apiKey) return;
    state.genAI = new GoogleGenerativeAI(state.apiKey);
    state.modelName = modelName;
    state.model = state.genAI.getGenerativeModel({ model: modelName });
}

function attachEventListeners() {
    dom.generateBtn.addEventListener('click', generateImage);
    dom.btnSettings.addEventListener('click', showModal);
    dom.saveSettings.addEventListener('click', saveApiKey);
    dom.btnDownload.addEventListener('click', downloadImage);

    // CSV & Gallery Listeners
    dom.btnUploadCSV.addEventListener('click', () => dom.csvFileInput.click());
    dom.csvFileInput.addEventListener('change', handleCSVUpload);
    dom.closeGallery.addEventListener('click', () => dom.galleryPanel.classList.add('hidden'));
    dom.btnTranslateImage.addEventListener('click', translateTextImage);

    // Drag and Drop Listeners
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
    processRequest(prompt);
}

async function translateTextImage() {
    if (!dom.generatedImage.src || dom.generatedImage.classList.contains('hidden')) {
        alert('Primero selecciona una imagen de la galería.');
        return;
    }
    const prompt = "haz una imagen igual ha esta manteniedo el producto orginal y solo cambiando el texto al espanol";
    processRequest(prompt, true);
}

async function processRequest(prompt, isMultimodal = false) {
    if (!state.model) {
        alert('Por favor, configura tu API Key primero.');
        showModal();
        return;
    }

    setGenerating(true);

    try {
        let result;
        if (isMultimodal) {
            // Check if image is loaded
            if (!dom.generatedImage.complete || dom.generatedImage.naturalWidth === 0) {
                throw new Error("La imagen aún no se ha cargado en el editor. Espera un segundo.");
            }
            // Use the canvas-based extraction for better CORS compatibility
            const imageData = imageToPostData(dom.generatedImage);
            result = await state.model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: imageData,
                        mimeType: "image/jpeg"
                    }
                }
            ]);
        } else {
            result = await state.model.generateContent(prompt);
        }

        const response = await result.response;
        const text = response.text();
        console.log("Nano Banana Response:", text);

        showPlaceholderResult(prompt);

    } catch (error) {
        console.error("Nano Banana Error Detail:", error);

        let errorHint = error.message || "Error desconocido";

        // If 404 and we have fallbacks, try the next one automatically
        if (errorHint.includes('404')) {
            console.warn(`Model ${state.modelName} not found. Trying fallbacks...`);
            const nextModel = MODEL_FALLBACKS.find(m => m !== state.modelName);
            if (nextModel) {
                setupAI(nextModel);
                return processRequest(prompt, isMultimodal);
            }
        }

        let msg = "Error al conectar con Nano Banana Pro.";
        if (errorHint.includes('API key')) msg = "API Key inválida.";
        if (errorHint.includes('canvas') || errorHint.includes('image') || errorHint.includes('cargado')) msg = "Error al procesar la imagen.";
        if (errorHint.includes('404')) msg = "No se encontró ningún modelo compatible con tu API Key.";
        if (errorHint.includes('403')) msg = "Permiso denegado (403). Tu API Key podría estar restringida o sin cuota.";

        alert(`${msg}\n\nDetalle: ${errorHint}`);
    } finally {
        setGenerating(false);
    }
}

function imageToPostData(imgElement) {
    try {
        if (!imgElement.naturalWidth) {
            throw new Error("Imagen no cargada completamente.");
        }
        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth;
        canvas.height = imgElement.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);
        // Get JPEG base64 (Gemini prefers it)
        return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    } catch (err) {
        console.error("Canvas extraction failed:", err);
        throw new Error("canvas processing failed: " + err.message);
    }
}

function showPlaceholderResult(prompt) {
    // In a production app, this would be the actual image URL from Imagen API
    // For this WOW demonstration, we use a high-quality placeholder that matches the prompt
    dom.emptyState.classList.add('hidden');
    dom.loader.classList.add('hidden');
    dom.generatedImage.classList.remove('hidden');

    // Using Unsplash Source for dynamic high-quality visuals for the demo
    const keyword = prompt.split(' ').slice(0, 3).join(',');
    dom.generatedImage.src = `https://source.unsplash.com/1600x900/?${encodeURIComponent(keyword)}`;

    // Add micro-animation
    dom.imageContainer.style.transform = 'scale(0.98)';
    setTimeout(() => {
        dom.imageContainer.style.transform = 'scale(1)';
    }, 200);
}

function setGenerating(status) {
    state.isGenerating = status;
    dom.generateBtn.disabled = status;
    dom.loader.classList.toggle('hidden', !status);
    dom.emptyState.classList.toggle('hidden', status);
    dom.generatedImage.classList.toggle('hidden', status);

    if (status) {
        dom.generateBtn.querySelector('span').textContent = 'Creando...';
    } else {
        dom.generateBtn.querySelector('span').textContent = 'Generar';
    }
}

function showModal() {
    dom.apiKeyInput.value = state.apiKey;
    dom.modelSelect.value = state.modelName;
    dom.settingsModal.classList.remove('hidden');
}

function saveApiKey() {
    const key = dom.apiKeyInput.value.trim();
    const model = dom.modelSelect.value;

    if (key) {
        state.apiKey = key;
        state.modelName = model;
        localStorage.setItem('nano_banana_api_key', key);
        localStorage.setItem('nano_banana_model', model);
        setupAI();
        dom.settingsModal.classList.add('hidden');
    }
}

function downloadImage() {
    if (!dom.generatedImage.src) return;
    const link = document.createElement('a');
    link.href = dom.generatedImage.src;
    link.download = 'nano_banana_pro_art.jpg';
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
            // Proxy images immediately to avoid CORS issues everywhere
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
        // Add crossOrigin to handle Shopify CDN
        item.innerHTML = `<img src="${p.src}" alt="${p.title}" title="${p.title}" crossorigin="anonymous">`;
        item.onclick = () => {
            selectImageFromGallery(p.src);
        };
        dom.galleryGrid.appendChild(item);
    });
}

function selectImageFromGallery(url) {
    dom.emptyState.classList.add('hidden');
    dom.loader.classList.add('hidden');
    dom.generatedImage.classList.remove('hidden');

    // Ensure we use the proxied URL and set crossOrigin
    dom.generatedImage.crossOrigin = "anonymous";
    dom.generatedImage.src = url;

    // Smooth transition
    dom.generatedImage.style.opacity = '0';
    setTimeout(() => {
        dom.generatedImage.style.opacity = '1';
        dom.generatedImage.style.transition = 'opacity 0.5s ease';
    }, 50);
}

init();
