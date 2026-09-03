import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { checkpoint, messages, message } = req.body || {};
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Message is required' });

    // Minimal conversational fallback
    const text = `I hear you about "${message}". ${checkpoint?.title ? `At ${checkpoint.title},` : ''} here's a thoughtful short reply.`;
    res.json({ text });
  } catch (err: any) {
    console.error('/api/gemini/chat error', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
