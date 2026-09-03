import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { checkpoint, messages, message } = req.body || {};
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Message is required' });

    // More helpful conversational fallback with varied templates
    function hashStr(s: string) {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
      return Math.abs(h);
    }

    const base = message.trim().replace(/\s+/g, ' ');
    const place = checkpoint && checkpoint.title ? `At ${checkpoint.title}, ` : '';

    const templates = [
      (m: string) => `I hear you about "${m}". ${place}a short, observant reply: it highlights what makes this spot notable and why it matters.`,
      (m: string) => `Good question — about "${m}", ${place}here's a concise thought to guide your attention and curiosity.`,
      (m: string) => `Thanks for asking about "${m}". ${place}one quick thing to notice is the way local materials or ornamentation tell its story.`,
      (m: string) => `About "${m}": ${place}look for subtle details and historic cues that reveal the site's character; this often points to deeper stories.`,
      (m: string) => `I hear you: "${m}". ${place}in brief — notice scale, texture, and any repeated motifs; they often hint at technique or period.`,
    ];

    const idx = hashStr(base) % templates.length;
    const text = templates[idx](base);
    res.json({ data: { text }, provider: 'fallback', usedFallback: true });
  } catch (err: any) {
    console.error('/api/gemini/chat error', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
