import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const key = process.env.NVIDIA_API_KEY;
    const url = process.env.NVIDIA_API_URL;
    if (!key || !url) return res.json({ ok: false, hasKey: false, friendly: 'No NVIDIA API key or URL configured' });

    const debug = String(req.query?.debug || '') === 'true';
    const prompt = debug ? (String(req.query?.prompt || 'Debug probe: return a short confirmation and example output') ) : 'You are a terse API key validator. Reply with exactly OK if the API key allows requests.';

    const payload: any = {
      prompt,
      max_tokens: debug ? 200 : 8,
      temperature: 0.0,
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const status = r.status;
    const txt = await r.text().catch(() => '');
    if (debug) {
      const truncated = typeof txt === 'string' ? (txt.length > 2000 ? txt.slice(0, 2000) + '...' : txt) : '';
      return res.json({ ok: r.ok, hasKey: true, probe: { status, sample: truncated } });
    }

    const text = String(txt || '').trim();
    if (text.toUpperCase().startsWith('OK')) return res.json({ ok: true, hasKey: true });
    return res.json({ ok: false, hasKey: true, friendly: `Unexpected response from NVIDIA provider: ${text}`, raw: text.slice(0, 200) });
  } catch (err: any) {
    console.error('/api/ai/validate-nvidia error', err?.message || err);
    return res.status(500).json({ ok: false, friendly: err?.message || 'Internal error' });
  }
}
