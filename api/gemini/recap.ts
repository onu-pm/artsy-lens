import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { location, checkpoints } = req.body || {};
    if (!checkpoints || !Array.isArray(checkpoints)) return res.status(400).json({ error: 'Checkpoints array is required' });

    const summary = `Journey through ${location || 'the location'} complete.`;
    const journalStory = `Walking through ${location || 'the location'}.`;
    const entries: Record<number, string> = {};
    res.json({ summary, journalStory, entries });
  } catch (err: any) {
    console.error('/api/gemini/recap error', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
