import { GoogleGenAI, Type } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

export function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Fallback models for resilience against regional 503 spikes or temporary unavailability
const CANDIDATE_TEXT_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

async function callWithModelFallback<T>(
  fn: (model: string) => Promise<T>,
  models: string[] = CANDIDATE_TEXT_MODELS
): Promise<T> {
  let lastError: any = null;
  for (const model of models) {
    try {
      return await fn(model);
    } catch (err: any) {
      console.warn(`[Gemini] Call with model '${model}' failed:`, err?.message || err);
      lastError = err;
    }
  }
  throw lastError;
}

function cleanJsonText(raw: string): string {
  let cleaned = (raw || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  return cleaned;
}

export async function generateSkeleton(location: string) {
  const ai = getAiClient();
  const prompt = `You are an expert cultural tour guide and historian planning an efficient walking tour. Create a logical, engaging itinerary for "${location}" where checkpoints are visited in a walkable sequence to minimize travel time.
Output strictly JSON matching this structure:
{
  "location_intro": "One short, evocative sentence introducing the destination.",
  "checkpoints": [
    {
      "id": 1,
      "title": "Name of landmark or stop",
      "short_label": "Short label (1-3 words)",
      "order": 1
    }
  ]
}
Include between 5 and 7 must-see spots ordered strictly by their geographic walking path.`;

  try {
    const parsed = await callWithModelFallback(async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              location_intro: {
                type: Type.STRING,
                description: 'One short, evocative sentence describing the location.',
              },
              checkpoints: {
                type: Type.ARRAY,
                description: 'List of checkpoints',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    short_label: { type: Type.STRING },
                    order: { type: Type.INTEGER },
                  },
                  required: ['id', 'title'],
                },
              },
            },
            required: ['location_intro', 'checkpoints'],
          },
          temperature: 0.4,
        },
      });

      const text = cleanJsonText(response.text || "{}");
      return JSON.parse(text);
    });

    // Validate checkpoints array
    let checkpoints = Array.isArray(parsed?.checkpoints) ? parsed.checkpoints : [];
    if (checkpoints.length === 0 && Array.isArray(parsed)) {
      checkpoints = parsed;
    }

    if (checkpoints.length === 0) {
      throw new Error("No checkpoints returned by the model");
    }

    const normalizedCheckpoints = checkpoints.map((cp: any, idx: number) => ({
      id: typeof cp.id === 'number' ? cp.id : (idx + 1),
      title: cp.title || `Stop ${idx + 1}`,
      short_label: cp.short_label || cp.title || `Stop ${idx + 1}`,
      order: typeof cp.order === 'number' ? cp.order : (idx + 1),
    }));

    return {
      location_intro: parsed.location_intro || `An evocative journey through the highlights of ${location}.`,
      checkpoints: normalizedCheckpoints,
    };
  } catch (err: any) {
    console.error(`Error generating skeleton for ${location}:`, err);
    // Intelligent fallback itinerary so the user is never blocked
    return {
      location_intro: `Explore the celebrated landmarks and cultural heritage of ${location}.`,
      checkpoints: [
        { id: 1, title: `${location} Historic Center`, short_label: "Historic Center", order: 1 },
        { id: 2, title: `Main Plaza & Grand Architecture`, short_label: "Grand Plaza", order: 2 },
        { id: 3, title: `Cultural Monument & Heritage Site`, short_label: "Monument", order: 3 },
        { id: 4, title: `Artisan Promenade & Local Quarter`, short_label: "Artisan Quarter", order: 4 },
        { id: 5, title: `Scenic Overlook & Promenade`, short_label: "Scenic Overlook", order: 5 },
      ],
    };
  }
}

export async function enrichCheckpointData(
  locationName: string,
  checkpoint: { id: number; title: string; order?: number }
) {
  const ai = getAiClient();
  const prompt = `You are an expert cultural guide and historian enriching the checkpoint "${checkpoint.title}" at "${locationName}".
Tasks:
1. summary: Write 2 vivid, engaging sentences (approx 30-40 words) about this specific spot.
2. things_to_notice: 2-3 specific visual architectural, stylistic, or historical details for a visitor standing here to spot.
3. questions: 3 short, intriguing questions for the visitor to ask.
Output strictly JSON.`;

  try {
    return await callWithModelFallback(async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              summary: { type: Type.STRING },
              things_to_notice: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              questions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['summary', 'things_to_notice', 'questions'],
          },
          temperature: 0.3,
        },
      });

      const text = cleanJsonText(response.text || "{}");
      const parsed = JSON.parse(text);
      return {
        id: checkpoint.id,
        summary: parsed.summary || `${checkpoint.title} is an essential landmark in ${locationName}.`,
        things_to_notice: Array.isArray(parsed.things_to_notice) && parsed.things_to_notice.length > 0
          ? parsed.things_to_notice
          : ["Intricate period craftsmanship", "Historic architectural proportions", "Distinctive atmospheric details"],
        questions: Array.isArray(parsed.questions) && parsed.questions.length > 0
          ? parsed.questions
          : ["What is the origin story here?", "What architectural style is highlighted?", "Why is this significant to locals?"],
      };
    });
  } catch (err) {
    console.warn(`Fallback enrichment used for ${checkpoint.title}:`, err);
    return {
      id: checkpoint.id,
      summary: `${checkpoint.title} stands as a treasured hallmark of ${locationName}, bearing centuries of design and local tradition.`,
      things_to_notice: [
        "Architectural masonry and stonework",
        "Unique decorative motifs and styling",
        "The surrounding historic streetscape",
      ],
      questions: [
        "What is the story behind this landmark?",
        "When was this originally constructed?",
        "What should visitors not miss here?",
      ],
    };
  }
}

export async function chatWithGuide(
  checkpoint: { title: string; summary?: string; detailedDescription?: string },
  history: Array<{ role: 'user' | 'model'; text: string }>,
  message: string
) {
  const ai = getAiClient();
  const systemInstruction = `You are ArtsyLens, an insightful, warm, and observant cultural and architectural tour guide.
Your current location is: ${checkpoint.title}.
Background context: ${checkpoint.detailedDescription || checkpoint.summary || ''}.
The visitor is currently standing here exploring.
Tone & Guidelines:
- Answer their questions about what they are seeing, historical significance, architectural techniques, or stories.
- Keep responses concise (2 to 3 sentences maximum) unless the visitor asks for an in-depth story or comprehensive explanation.
- Speak with natural curiosity, clarity, and observational charm. Never sound robotic or like a generic encyclopedia.`;

  const contents = [
    ...history.filter(h => h.text && h.text.trim()).map(h => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.text }]
    })),
    {
      role: 'user',
      parts: [{ text: message }]
    }
  ];

  return await callWithModelFallback(async (model) => {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return { text: response.text || "I see what you mean. What aspect would you like to explore further?" };
  });
}

export async function analyzeImage(
  image: string,
  context: string,
  promptOverride?: string
) {
  const ai = getAiClient();
  let mimeType = 'image/jpeg';
  let base64Data = image;

  const match = image.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    base64Data = match[2];
  }

  const promptText = promptOverride || `Analyze this image captured at "${context}" as a thoughtful cultural guide and visual historian.

Respond in clean Markdown with the following structure:

**What You're Seeing**  
1–2 vivid sentences that ground the viewer in the scene and briefly situate it in its architectural or historical context.

**Key Features to Notice**  
3–5 concise bullet points highlighting visually important elements such as materials, forms, motifs, construction techniques, or stylistic influences.

**A Detail Most Visitors Miss**  
One subtle or easily overlooked detail, explained in a way that makes the viewer feel observant, curious, and rewarded for noticing it.

Tone & Constraints:
- Friendly, calm, and curious — never academic or robotic
- No unnecessary technical jargon
- Avoid generic or obvious descriptions
- Prioritize clarity and insight over exhaustiveness
- Total response up to 150 words`;

  return await callWithModelFallback(async (model) => {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          { text: promptText },
        ],
      },
    });

    return { text: response.text || "I see the photo, but could not discern specific details." };
  });
}

export async function annotateImageStudy(
  image: string,
  context?: string
) {
  const ai = getAiClient();
  let mimeType = 'image/jpeg';
  let base64Data = image;

  const match = image.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    base64Data = match[2];
  }

  const prompt = `Role:
You are an expert architectural illustrator, visual historian, and museum sketch artist creating a plate for a high-end historical field journal.

Task:
Reinterpret the provided photograph as an expressive, high-contrast architectural field study illustration that prioritizes storytelling, clarity, and visual hierarchy over realism.

Illustration Style:
- Medium: Graphite + ink sketch on textured, off-white archival paper
- Linework: Confident hand-drawn lines with visible pressure variation; bold primary outlines and finer secondary details
- Shading: Cross-hatching and contour hatching with strong contrast and intentional negative space
- Finish: Clearly hand-drawn, observational in nature

Color & Wash:
- Apply selective, translucent watercolor washes only where they add meaning (sepia, sandstone, subtle terracotta or oxidized patina)
- Keep large areas of white paper visible

Annotations:
- Add 3 or 4 handwritten architectural annotations with delicate pointer arrows indicating key motifs or masonry details

Context:
${context || 'Historical site'}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt },
        ],
      },
      config: {
        imageConfig: { aspectRatio: '4:3' },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        const outMime = part.inlineData.mimeType || 'image/png';
        return { imageUrl: `data:${outMime};base64,${part.inlineData.data}` };
      }
    }
  } catch (err: any) {
    console.warn("Annotate image generation note:", err?.message || err);
  }

  return { imageUrl: null };
}

export async function recapTour(
  location: string,
  checkpoints: Array<{ id: number; title: string; summary?: string }>
) {
  const ai = getAiClient();
  const simplifiedCheckpoints = checkpoints.map(c => ({ id: c.id, title: c.title, desc: c.summary }));

  try {
    return await callWithModelFallback(async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: `
Role: You are an evocative travel writer creating a field journal summary of a completed journey.
Input Checkpoints: ${JSON.stringify(simplifiedCheckpoints)}
Output JSON:
1. summary: Max 12 words capturing the essence of the journey. (e.g., "A timeless pilgrimage through sandstone monuments and whispered centuries.")
2. journalStory: Max 10 words. (e.g., "History unveiled its quietest secrets step by step.")
3. entries: Array of { id: number, text: string } written in First Person ("I saw...", "I stood before..."), max 20 words per checkpoint.
        `,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              journalStory: { type: Type.STRING },
              entries: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    text: { type: Type.STRING },
                  },
                  required: ['id', 'text'],
                },
              },
            },
            required: ['summary', 'journalStory', 'entries'],
          },
        },
      });

      const text = cleanJsonText(response.text || "{}");
      const parsed = JSON.parse(text);
      const entryMap: Record<number, string> = {};
      if (parsed.entries && Array.isArray(parsed.entries)) {
        parsed.entries.forEach((e: any) => {
          entryMap[e.id] = e.text;
        });
      }

      return {
        summary: parsed.summary || `Journey through ${location} complete.`,
        journalStory: parsed.journalStory || `Walking through the wonders of ${location}.`,
        entries: entryMap,
      };
    });
  } catch (err) {
    console.warn("Recap fallback triggered:", err);
    const entryMap: Record<number, string> = {};
    checkpoints.forEach((c) => {
      entryMap[c.id] = `Explored ${c.title}, absorbing its historical character and architectural nuances.`;
    });
    return {
      summary: `A memorable voyage through ${location}.`,
      journalStory: `History and art uncovered step by step.`,
      entries: entryMap,
    };
  }
}
