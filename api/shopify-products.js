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
        const url = `https://${shop}/admin/api/2024-01/products.json?fields=id,title,handle,images,variants,body_html&limit=250&status=active`;
        const response = await fetch(url, {
            headers: { 'X-Shopify-Access-Token': token }
        });

        if (!response.ok) {
            const text = await response.text();
            return res.status(response.status).json({ error: `Shopify API error: ${text}` });
        }

        const { products } = await response.json();

        // One entry per product; each has an `images` array with ALL its images
        const result = products
            .filter(p => p.images && p.images.length > 0)
            .map(p => {
                // Map imageId → [{id: variantId, title: variantTitle}]
                const imageVariantMap = {};
                (p.variants || []).forEach(v => {
                    if (v.image_id) {
                        if (!imageVariantMap[v.image_id]) imageVariantMap[v.image_id] = [];
                        imageVariantMap[v.image_id].push({ id: v.id, title: v.title });
                    }
                });

                return {
                    id: p.id,
                    title: p.title,
                    handle: p.handle,
                    imageSrc: p.images[0].src,
                    imageId: p.images[0].id,
                    body_html: p.body_html || '',
                    images: p.images.map(img => {
                        const variants = imageVariantMap[img.id] || [];
                        return {
                            id: img.id,
                            src: img.src,
                            isVariantImage: variants.length > 0,
                            variantTitles: variants.map(v => v.title),
                            variantIds: variants.map(v => v.id)
                        };
                    })
                };
            });

        return res.status(200).json({ products: result });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
