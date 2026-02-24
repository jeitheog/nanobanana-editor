export const config = { maxDuration: 60 };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const shop = req.headers['x-shopify-shop'] || process.env.SHOPIFY_SHOP;
    const token = req.headers['x-shopify-token'] || process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
        return res.status(500).json({ error: 'Shopify no configurado en Vercel ni proporcionado en la solicitud.' });
    }

    const { productId, oldImageId, imageBase64, variantIds } = req.body;

    if (!productId || !imageBase64) {
        return res.status(400).json({ error: 'Faltan productId o imageBase64.' });
    }

    const isVariantImage = Array.isArray(variantIds) && variantIds.length > 0;

    const baseUrl = `https://${shop}/admin/api/2024-01`;
    const headers = {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
    };

    try {
        // 1. Subir nueva imagen al producto
        // Don't force position:1 for variant images (that would replace the main product image)
        const imagePayload = { attachment: imageBase64, filename: 'translated.png' };
        if (!isVariantImage) imagePayload.position = 1;

        const uploadRes = await fetch(`${baseUrl}/products/${productId}/images.json`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ image: imagePayload })
        });

        if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({}));
            throw new Error(JSON.stringify(err.errors || `Shopify upload error ${uploadRes.status}`));
        }

        const { image: newImage } = await uploadRes.json();

        // 2. Asociar la nueva imagen a sus variantes (si es imagen de variante)
        if (isVariantImage) {
            for (const variantId of variantIds) {
                await fetch(`${baseUrl}/variants/${variantId}.json`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ variant: { id: variantId, image_id: newImage.id } })
                });
            }
        }

        // 3. Eliminar imagen anterior (si existe)
        if (oldImageId) {
            await fetch(`${baseUrl}/products/${productId}/images/${oldImageId}.json`, {
                method: 'DELETE',
                headers
            });
        }

        return res.status(200).json({ success: true, newImageId: newImage.id, newImageSrc: newImage.src });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
