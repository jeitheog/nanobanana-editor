export const config = { maxDuration: 30 };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const shop = req.headers['x-shopify-shop'] || process.env.SHOPIFY_SHOP;
    const token = req.headers['x-shopify-token'] || process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
        return res.status(500).json({ error: 'Shopify no configurado.' });
    }

    const { productId, body_html } = req.body;

    if (!productId || body_html === undefined) {
        return res.status(400).json({ error: 'Faltan productId o body_html.' });
    }

    try {
        const updateRes = await fetch(`https://${shop}/admin/api/2024-01/products/${productId}.json`, {
            method: 'PUT',
            headers: {
                'X-Shopify-Access-Token': token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ product: { id: productId, body_html } })
        });

        if (!updateRes.ok) {
            const err = await updateRes.json().catch(() => ({}));
            throw new Error(JSON.stringify(err.errors || `HTTP ${updateRes.status}`));
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
