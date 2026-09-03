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

    // Dynamic import so import-time errors surface in the try/catch
    const mod = await import('../../server/openrouterService');
    const generateSkeleton = mod.generateSkeleton;

    const data = await generateSkeleton(location);
    res.json(data);
  } catch (err: any) {
    console.error('API /api/gemini/skeleton error:', err && (err.stack || err.message || err));
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
