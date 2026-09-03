import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { image, context } = req.body || {};
    if (!image) return res.status(400).json({ error: 'Image data is required' });

    // Simple fallback analysis
    const text = `This looks like a detailed scene from ${context || 'the location'}. Notice materials, patterning, and composition.`;
    res.json({ data: { text }, provider: 'fallback', usedFallback: true });
  } catch (err: any) {
    console.error('/api/gemini/analyze-image error', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
