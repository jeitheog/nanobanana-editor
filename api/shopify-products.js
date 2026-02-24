export const config = { maxDuration: 30 };

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const shop = req.headers['x-shopify-shop'] || process.env.SHOPIFY_SHOP;
    const token = req.headers['x-shopify-token'] || process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shop || !token) {
        return res.status(500).json({
            error: 'Faltan variables de entorno: SHOPIFY_SHOP y SHOPIFY_ACCESS_TOKEN deben estar configuradas en Vercel o proporcionadas en la UI.'
        });
    }

    try {
        // Include variants to map variant names to their images
        const url = `https://${shop}/admin/api/2024-01/products.json?fields=id,title,handle,images,variants&limit=250&status=active`;
        const response = await fetch(url, {
            headers: { 'X-Shopify-Access-Token': token }
        });

        if (!response.ok) {
            const text = await response.text();
            return res.status(response.status).json({ error: `Shopify API error: ${text}` });
        }

        const { products } = await response.json();

        // Build a flat list of ALL images across all products, with variant info
        const result = [];

        products.forEach(p => {
            if (!p.images || p.images.length === 0) return;

            // Map imageId → variant titles that use it
            const imageVariantMap = {};
            (p.variants || []).forEach(v => {
                if (v.image_id) {
                    if (!imageVariantMap[v.image_id]) imageVariantMap[v.image_id] = [];
                    imageVariantMap[v.image_id].push(v.title);
                }
            });

            p.images.forEach((img, imgIndex) => {
                const variantTitles = imageVariantMap[img.id];
                const isVariantImage = !!(variantTitles && variantTitles.length > 0);

                result.push({
                    id: p.id,
                    title: p.title,
                    handle: p.handle,
                    imageId: img.id,
                    imageSrc: img.src,
                    imageLabel: isVariantImage
                        ? `${p.title} — ${variantTitles.join(' / ')}`
                        : p.images.length > 1
                            ? `${p.title} (${imgIndex + 1}/${p.images.length})`
                            : p.title,
                    isVariantImage,
                    variantTitles: variantTitles || []
                });
            });
        });

        return res.status(200).json({ products: result });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
