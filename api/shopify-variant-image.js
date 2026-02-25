export const config = { maxDuration: 20 };

export default async function handler(req, res) {
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

    const shop = req.headers['x-shopify-shop'] || process.env.SHOPIFY_SHOP;
    const token = req.headers['x-shopify-token'] || process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) return res.status(500).json({ error: 'Shopify no configurado.' });

    const { variantId, imageId } = req.body;
    if (!variantId || !imageId) return res.status(400).json({ error: 'Faltan variantId o imageId.' });

    const res2 = await fetch(`https://${shop}/admin/api/2024-01/variants/${variantId}.json`, {
        method: 'PUT',
        headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ variant: { id: variantId, image_id: imageId } })
    });

    if (!res2.ok) {
        const err = await res2.json().catch(() => ({}));
        return res.status(res2.status).json({ error: err.errors || `HTTP ${res2.status}` });
    }

    return res.status(200).json({ success: true });
}
