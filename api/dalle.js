export const config = {
    maxDuration: 60
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
        return res.status(500).json({ error: 'OPENAI_API_KEY no configurado en Vercel' });
    }

    const { prompt, size = '1024x1024' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt es requerido' });

    try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt,
                n: 1,
                size,
                response_format: 'b64_json'
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return res.status(response.status).json({
                error: errData.error?.message || `HTTP ${response.status}`
            });
        }

        const data = await response.json();
        res.json(data);

    } catch (err) {
        console.error('Error DALL-E 3:', err);
        res.status(500).json({ error: err.message });
    }
}
