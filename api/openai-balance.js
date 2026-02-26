export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada.' });

    const headers = { 'Authorization': `Bearer ${apiKey}` };

    try {
        // ── Try prepaid credit grants first ──────────────────
        const grantsRes = await fetch('https://api.openai.com/dashboard/billing/credit_grants', { headers });
        if (grantsRes.ok) {
            const d = await grantsRes.json();
            return res.json({
                type: 'credits',
                total: d.total_granted,
                used: d.total_used,
                remaining: d.total_available
            });
        }

        // ── Fallback: subscription + monthly usage ────────────
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const [subRes, usageRes] = await Promise.all([
            fetch('https://api.openai.com/dashboard/billing/subscription', { headers }),
            fetch(`https://api.openai.com/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`, { headers })
        ]);

        if (!subRes.ok) {
            const err = await subRes.json().catch(() => ({}));
            return res.status(subRes.status).json({ error: err.error?.message || `OpenAI ${subRes.status}` });
        }

        const sub = await subRes.json();
        const usageData = usageRes.ok ? await usageRes.json() : null;
        const usedThisMonth = usageData ? (usageData.total_usage / 100) : null; // cents → dollars

        return res.json({
            type: 'subscription',
            plan: sub.plan?.title || 'Pay as you go',
            hardLimit: sub.hard_limit_usd,
            softLimit: sub.soft_limit_usd,
            usedThisMonth
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
