import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const IMAGEN_MODEL = 'imagen-3.0-generate-001';

const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

app.post('/api/imagen', async (req, res) => {
    try {
        if (!PROJECT_ID) {
            return res.status(500).json({ error: 'GOOGLE_CLOUD_PROJECT no configurado en .env' });
        }

        const { prompt, sampleCount = 1, aspectRatio = '1:1' } = req.body;
        if (!prompt) return res.status(400).json({ error: 'prompt es requerido' });

        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        const accessToken = tokenResponse.token;

        const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${IMAGEN_MODEL}:predict`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instances: [{ prompt }],
                parameters: { sampleCount, aspectRatio }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            return res.status(response.status).json({ error: errText });
        }

        const data = await response.json();
        res.json(data);

    } catch (err) {
        console.error('Error Imagen 3:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/dalle', async (req, res) => {
    try {
        const OPENAI_KEY = process.env.OPENAI_API_KEY;
        if (!OPENAI_KEY) {
            return res.status(500).json({ error: 'OPENAI_API_KEY no configurado en .env' });
        }

        const { prompt, size = '1024x1024' } = req.body;
        if (!prompt) return res.status(400).json({ error: 'prompt es requerido' });

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
            return res.status(response.status).json({ error: errData.error?.message || `HTTP ${response.status}` });
        }

        const data = await response.json();
        res.json(data);

    } catch (err) {
        console.error('Error DALL-E 3:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Proxy Nano Banana corriendo en http://localhost:${PORT}`);
    console.log(`Proyecto GCP: ${PROJECT_ID || '(no configurado)'}`);
    console.log(`Región Vertex: ${LOCATION}`);
});
