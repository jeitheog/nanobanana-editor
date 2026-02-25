import { Buffer } from 'node:buffer';

export const config = {
    maxDuration: 60
};

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY no configurado' });

    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 es requerido' });

    try {
        const buffer = Buffer.from(imageBase64, 'base64');
        const blob = new Blob([buffer], { type: mimeType });

        const form = new FormData();
        form.append('model', 'gpt-image-1');
        form.append('image', blob, 'product.jpg');
        form.append('prompt', 'Translate all visible text in this image to Spanish. Preserve every visual detail exactly: the product, background, colors, lighting, shadows, textures, and composition must remain photorealistic and identical to the original. The output must look like a real photograph, not a drawing, illustration, painting, or 3D render. Only change the language of the text labels.');
        form.append('n', '1');
        form.append('size', '1024x1024');
        form.append('quality', 'high');

        const response = await fetch('https://api.openai.com/v1/images/edits', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
            body: form
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        res.json(data);

    } catch (err) {
        console.error('Error traducción:', err);
        res.status(500).json({ error: err.message });
    }
}
