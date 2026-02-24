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

    const { productId, imageIds } = req.body;

    if (!productId || !Array.isArray(imageIds) || imageIds.length === 0) {
        return res.status(400).json({ error: 'Faltan productId o imageIds.' });
    }

    const baseUrl = `https://${shop}/admin/api/2024-01`;
    const headers = { 'X-Shopify-Access-Token': token };

    const results = { deleted: [], failed: [] };

    for (const imageId of imageIds) {
        const r = await fetch(`${baseUrl}/products/${productId}/images/${imageId}.json`, {
            method: 'DELETE',
            headers
        });
        if (r.ok || r.status === 404) {
            results.deleted.push(imageId);
        } else {
            results.failed.push(imageId);
        }
    }

    return res.status(200).json(results);
}
