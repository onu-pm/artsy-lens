import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { image, context } = req.body || {};
    if (!image) return res.status(400).json({ error: 'Image data is required' });

    // Fallback: no annotation available in serverless mode
    res.json({ imageUrl: null });
  } catch (err: any) {
    console.error('/api/gemini/annotate-image error', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
