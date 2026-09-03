import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { location } = req.body || {};
    if (!location || typeof location !== 'string') {
      res.status(400).json({ error: 'Location is required' });
      return;
    }

    // Log presence of keys (do not log secrets themselves)
    console.log('OPENROUTER_API_KEY present:', Boolean(process.env.OPENROUTER_API_KEY));
    console.log('GEMINI_API_KEY present:', Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY));

    // Minimal inline generateSkeleton implementation to avoid cross-file imports in serverless functions
    function cleanJsonText(raw: string): string {
      let cleaned = (raw || '').trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      }
      return cleaned;
    }

    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
    if (OPENROUTER_KEY) {
      try {
        const prompt = `You are an expert cultural tour guide and historian planning an efficient walking tour. Create a logical, engaging itinerary for "${location}" where checkpoints are visited in a walkable sequence to minimize travel time. Output strictly JSON matching this structure: { "location_intro": "One short, evocative sentence introducing the destination.", "checkpoints": [ { "id": 1, "title": "Name of landmark or stop", "short_label": "Short label (1-3 words)", "order": 1 } ] } Include between 5 and 7 must-see spots ordered strictly by their geographic walking path.`;

        const messages = [
          { role: 'system', content: 'You are an expert cultural tour guide and historian. You always respond strictly in valid JSON without markdown wrapping.' },
          { role: 'user', content: prompt },
        ];

        const payload: any = {
          model: 'google/gemini-2.5-flash',
          messages,
          max_tokens: 1500,
          temperature: 0.3,
          response_format: { type: 'json_object' },
        };

        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENROUTER_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (r.ok) {
          const data = await r.json();
          const content = data.choices?.[0]?.message?.content;
          if (content && typeof content === 'string') {
            const parsed = JSON.parse(cleanJsonText(content));
            let checkpoints = Array.isArray(parsed?.checkpoints) ? parsed.checkpoints : [];
            if (checkpoints.length === 0 && Array.isArray(parsed)) checkpoints = parsed;
            if (checkpoints.length === 0) throw new Error('No checkpoints in response');
            const normalized = checkpoints.map((cp: any, idx: number) => ({
              id: typeof cp.id === 'number' ? cp.id : idx + 1,
              title: cp.title || `Stop ${idx + 1}`,
              short_label: cp.short_label || cp.title || `Stop ${idx + 1}`,
              order: typeof cp.order === 'number' ? cp.order : idx + 1,
            }));
            res.json({ location_intro: parsed.location_intro || `An evocative journey through the highlights of ${location}.`, checkpoints: normalized });
            return;
          }
        } else {
          const errTxt = await r.text().catch(() => '');
          console.warn('OpenRouter returned non-OK:', r.status, errTxt);
        }
      } catch (e: any) {
        console.warn('OpenRouter call failed:', e?.message || e);
      }
    }

    // Fallback itinerary if OpenRouter unavailable
    const fallback = {
      location_intro: `Explore the celebrated landmarks and cultural heritage of ${location}.`,
      checkpoints: [
        { id: 1, title: `${location} Historic Center`, short_label: 'Historic Center', order: 1 },
        { id: 2, title: `Main Plaza & Grand Architecture`, short_label: 'Grand Plaza', order: 2 },
        { id: 3, title: `Cultural Monument & Heritage Site`, short_label: 'Monument', order: 3 },
        { id: 4, title: `Artisan Promenade & Local Quarter`, short_label: 'Artisan Quarter', order: 4 },
        { id: 5, title: `Scenic Overlook & Promenade`, short_label: 'Scenic Overlook', order: 5 },
      ],
    };

    res.json(fallback);
  } catch (err: any) {
    console.error('API /api/gemini/skeleton error:', err && (err.stack || err.message || err));
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
