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
        // Paso 1: GPT-4o analiza la imagen y genera un prompt para DALL-E 3
        const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' }
                        },
                        {
                            type: 'text',
                            text: 'Analiza esta imagen de producto con mucho detalle. Describe: el producto exacto, sus colores, estilo visual, fondo, composición y TODO el texto visible. Luego genera un prompt para DALL-E 3 que recree esta imagen idénticamente pero con todo el texto traducido al español. Devuelve ÚNICAMENTE el prompt de DALL-E 3, sin explicaciones adicionales.'
                        }
                    ]
                }],
                max_tokens: 600
            })
        });

        if (!visionRes.ok) {
            const err = await visionRes.json().catch(() => ({}));
            throw new Error(err.error?.message || `GPT-4o error: ${visionRes.status}`);
        }

        const visionData = await visionRes.json();
        const dallePrompt = visionData.choices?.[0]?.message?.content;
        if (!dallePrompt) throw new Error('GPT-4o no generó un prompt válido');

        // Paso 2: DALL-E 3 genera la imagen con texto en español
        const imageRes = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt: dallePrompt,
                n: 1,
                size: '1024x1024',
                response_format: 'b64_json'
            })
        });

        if (!imageRes.ok) {
            const err = await imageRes.json().catch(() => ({}));
            throw new Error(err.error?.message || `DALL-E 3 error: ${imageRes.status}`);
        }

        const imageData = await imageRes.json();
        res.json(imageData);

    } catch (err) {
        console.error('Error traducción:', err);
        res.status(500).json({ error: err.message });
    }
}
