export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64) {
        return res.status(400).json({ error: 'Falta imageBase64.' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'OPENAI_API_KEY no configurada.' });
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
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

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `OpenAI error ${response.status}`);
        }

        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content?.trim().toUpperCase() || 'NO';
        const hasText = answer.startsWith('YES');

        return res.status(200).json({ hasText });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
