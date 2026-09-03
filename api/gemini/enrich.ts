import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { locationName, checkpoint } = req.body || {};
    if (!checkpoint || !checkpoint.title) return res.status(400).json({ error: 'Valid checkpoint is required' });

    // Simple fallback enrichment
    const response = {
      id: checkpoint.id || 1,
      summary: `${checkpoint.title} is a notable spot in ${locationName || 'this area'}.`,
      things_to_notice: [
        'Observe the materials and textures',
        'Notice decorative motifs and patterns',
      ],
      questions: [
        'What caught your eye here?',
        'Can you spot any unique details?',
        'How might this place have changed over time?'
      ],
    };

    res.json({ data: response, provider: 'fallback', usedFallback: true });
  } catch (err: any) {
    console.error('/api/gemini/enrich error', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
