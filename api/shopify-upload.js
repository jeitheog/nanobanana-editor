export const config = { maxDuration: 60 };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const shop = process.env.SHOPIFY_SHOP;
    const token = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
        return res.status(500).json({ error: 'Shopify no configurado en Vercel.' });
    }

    const { productId, oldImageId, imageBase64 } = req.body;

    if (!productId || !imageBase64) {
        return res.status(400).json({ error: 'Faltan productId o imageBase64.' });
    }

    const baseUrl = `https://${shop}/admin/api/2024-01`;
    const headers = {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
    };

    try {
        // 1. Subir nueva imagen al producto
        const uploadRes = await fetch(`${baseUrl}/products/${productId}/images.json`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                image: {
                    attachment: imageBase64,
                    filename: 'translated.png',
                    position: 1
                }
            })
        });

        if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({}));
            throw new Error(JSON.stringify(err.errors || `Shopify upload error ${uploadRes.status}`));
        }

        const { image: newImage } = await uploadRes.json();

        // 2. Eliminar imagen anterior (si existe)
        if (oldImageId) {
            await fetch(`${baseUrl}/products/${productId}/images/${oldImageId}.json`, {
                method: 'DELETE',
                headers
            });
        }

        return res.status(200).json({ success: true, newImageId: newImage.id });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
