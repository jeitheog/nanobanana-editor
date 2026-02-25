// Atomic endpoint: detect text → translate → upload to Shopify in a single server call.
// If the browser closes mid-process, the server finishes the job anyway.
import { Buffer } from 'node:buffer';

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const {
        productId,
        imageId,          // old image to replace (null for description images)
        imageBase64,
        mimeType = 'image/jpeg',
        variantIds = [],
        shopifyShop,
        shopifyToken,
        returnBase64 = false  // true for description images: return translated base64 instead of uploading
    } = req.body;

    if (!imageBase64) return res.status(400).json({ error: 'Falta imageBase64.' });

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada.' });

    const shop = shopifyShop || process.env.SHOPIFY_SHOP;
    const token = shopifyToken || process.env.SHOPIFY_ACCESS_TOKEN;

    try {
        // ── Step 1: Detect text (gpt-4o-mini, cheap) ──────
        const detectRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                max_tokens: 5,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'low' }
                        },
                        {
                            type: 'text',
                            text: 'Does this image contain visible words, text, labels or titles? Answer only YES or NO.'
                        }
                    ]
                }]
            })
        });

        if (detectRes.ok) {
            const detectData = await detectRes.json();
            const answer = detectData.choices?.[0]?.message?.content?.trim().toUpperCase() || 'YES';
            if (!answer.startsWith('YES')) {
                return res.status(200).json({ result: 'skipped' });
            }
        }
        // On detect error: default to YES (fail-safe, don't skip)

        // ── Step 2: Translate (gpt-image-1) ───────────────
        const buffer = Buffer.from(imageBase64, 'base64');
        const blob = new Blob([buffer], { type: mimeType });
        const form = new FormData();
        form.append('model', 'gpt-image-1');
        form.append('image', blob, 'product.jpg');
        form.append('prompt', 'Translate all visible text in this image to Spanish. Preserve every visual detail exactly: the product, background, colors, lighting, shadows, textures, and composition must remain photorealistic and identical to the original. The output must look like a real photograph, not a drawing, illustration, painting, or 3D render. Only change the language of the text labels.');
        form.append('n', '1');
        form.append('size', '1024x1024');
        form.append('quality', 'high');

        const translateRes = await fetch('https://api.openai.com/v1/images/edits', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}` },
            body: form
        });

        if (!translateRes.ok) {
            const err = await translateRes.json().catch(() => ({}));
            throw new Error(err.error?.message || `OpenAI error ${translateRes.status}`);
        }

        const translateData = await translateRes.json();
        const translatedB64 = translateData.data?.[0]?.b64_json;
        if (!translatedB64) throw new Error('OpenAI no devolvió imagen.');

        // ── Return base64 only (for description images) ───
        if (returnBase64 || !shop || !token || !productId) {
            return res.status(200).json({ result: 'translated', b64: translatedB64 });
        }

        // ── Step 3: Upload to Shopify ──────────────────────
        const isVariantImage = Array.isArray(variantIds) && variantIds.length > 0;
        const baseUrl = `https://${shop}/admin/api/2024-01`;
        const shopifyHeaders = {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json'
        };

        const imagePayload = { attachment: translatedB64, filename: 'translated.png' };
        if (!isVariantImage) imagePayload.position = 1;

        const uploadRes = await fetch(`${baseUrl}/products/${productId}/images.json`, {
            method: 'POST',
            headers: shopifyHeaders,
            body: JSON.stringify({ image: imagePayload })
        });

        if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({}));
            throw new Error(JSON.stringify(err.errors || `Shopify upload error ${uploadRes.status}`));
        }

        const { image: newImage } = await uploadRes.json();

        // ── Step 4: Associate variants ─────────────────────
        if (isVariantImage) {
            await new Promise(r => setTimeout(r, 2000));
            for (const variantId of variantIds) {
                let putRes = await fetch(`${baseUrl}/variants/${variantId}.json`, {
                    method: 'PUT',
                    headers: shopifyHeaders,
                    body: JSON.stringify({ variant: { id: variantId, image_id: newImage.id } })
                });
                if (!putRes.ok) {
                    await new Promise(r => setTimeout(r, 3000));
                    await fetch(`${baseUrl}/variants/${variantId}.json`, {
                        method: 'PUT',
                        headers: shopifyHeaders,
                        body: JSON.stringify({ variant: { id: variantId, image_id: newImage.id } })
                    });
                }
            }
        }

        // ── Step 5: Delete old image ───────────────────────
        if (imageId) {
            await fetch(`${baseUrl}/products/${productId}/images/${imageId}.json`, {
                method: 'DELETE',
                headers: shopifyHeaders
            });
        }

        return res.status(200).json({
            result: 'translated',
            newImageId: newImage.id,
            newImageSrc: newImage.src
        });

    } catch (err) {
        console.error('process-image error:', err);
        return res.status(500).json({ error: err.message });
    }
}
