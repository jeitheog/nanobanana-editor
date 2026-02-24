export const config = { maxDuration: 30 };

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const shop = process.env.SHOPIFY_SHOP;
    const token = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
        return res.status(500).json({
            error: 'Faltan variables de entorno: SHOPIFY_SHOP y SHOPIFY_ACCESS_TOKEN deben estar configuradas en Vercel.'
        });
    }

    try {
        const url = `https://${shop}/admin/api/2024-01/products.json?fields=id,title,handle,images&limit=250&status=active`;
        const response = await fetch(url, {
            headers: { 'X-Shopify-Access-Token': token }
        });

        if (!response.ok) {
            const text = await response.text();
            return res.status(response.status).json({ error: `Shopify API error: ${text}` });
        }

        const { products } = await response.json();

        // Solo productos con al menos una imagen
        const result = products
            .filter(p => p.images && p.images.length > 0)
            .map(p => ({
                id: p.id,
                title: p.title,
                handle: p.handle,
                imageId: p.images[0].id,
                imageSrc: p.images[0].src
            }));

        return res.status(200).json({ products: result });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
