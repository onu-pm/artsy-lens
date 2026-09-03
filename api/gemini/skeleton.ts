import { VercelRequest, VercelResponse } from '@vercel/node';
import { generateSkeleton } from '../../../server/openrouterService';

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

    const data = await generateSkeleton(location);
    res.json(data);
  } catch (err: any) {
    console.error('API /api/gemini/skeleton error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
