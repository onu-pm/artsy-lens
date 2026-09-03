// OpenRouter AI Service
// Implements tour itinerary generation, checkpoint enrichment, interactive guide chat, vision analysis, and recap storytelling

import {
  generateSkeleton as geminiSkeleton,
  enrichCheckpointData as geminiEnrich,
  chatWithGuide as geminiChat,
  analyzeImage as geminiAnalyze,
  annotateImageStudy as geminiAnnotate,
  recapTour as geminiRecap,
} from "./geminiService";

const DEFAULT_OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

export function getOpenRouterApiKey(): string {
  return process.env.OPENROUTER_API_KEY || DEFAULT_OPENROUTER_KEY;
}

const OPENROUTER_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.0-flash-001",
  "meta-llama/llama-3.3-70b-instruct",
  "mistralai/mistral-small-24b-instruct-2501",
];

function cleanJsonText(raw: string): string {
  let cleaned = (raw || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  return cleaned;
}

async function callOpenRouter(
  messages: Array<{ role: string; content: any }>,
  options: {
    jsonMode?: boolean;
    maxTokens?: number;
    temperature?: number;
    model?: string;
  } = {}
): Promise<string> {
  const apiKey = getOpenRouterApiKey();
  const maxTokens = options.maxTokens || 1500;
  const temperature = options.temperature ?? 0.3;

  const candidateModels = options.model ? [options.model, ...OPENROUTER_MODELS] : OPENROUTER_MODELS;

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const payload: any = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      };

      if (options.jsonMode) {
        payload.response_format = { type: "json_object" };
      }

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://what-the-art.ai",
          "X-Title": "What The Art Tour Guide",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`[OpenRouter] ${model} returned HTTP ${res.status}: ${errorText}`);
        lastError = new Error(`OpenRouter (${model}) status ${res.status}: ${errorText}`);
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content && typeof content === "string") {
        return content;
      }
    } catch (err: any) {
      console.warn(`[OpenRouter] ${model} failed:`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error("All OpenRouter models failed to respond");
}

export async function generateSkeleton(location: string) {
  try {
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

    const raw = await callOpenRouter(
      [
        {
          role: "system",
          content: "You are an expert cultural tour guide and historian. You always respond strictly in valid JSON without markdown wrapping.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      { jsonMode: true, maxTokens: 1500, temperature: 0.3 }
    );

    const parsed = JSON.parse(cleanJsonText(raw));
    let checkpoints = Array.isArray(parsed?.checkpoints) ? parsed.checkpoints : [];

    if (checkpoints.length === 0 && Array.isArray(parsed)) {
      checkpoints = parsed;
    }

    if (checkpoints.length === 0) {
      throw new Error("No checkpoints in OpenRouter response");
    }

    const normalizedCheckpoints = checkpoints.map((cp: any, idx: number) => ({
      id: typeof cp.id === "number" ? cp.id : idx + 1,
      title: cp.title || `Stop ${idx + 1}`,
      short_label: cp.short_label || cp.title || `Stop ${idx + 1}`,
      order: typeof cp.order === "number" ? cp.order : idx + 1,
    }));

    return {
      location_intro: parsed.location_intro || `An evocative journey through the highlights of ${location}.`,
      checkpoints: normalizedCheckpoints,
    };
  } catch (err) {
    console.warn("[OpenRouter] Skeleton generation failed, attempting fallback:", err);
    return await geminiSkeleton(location);
  }
}

export async function enrichCheckpointData(
  locationName: string,
  checkpoint: { id: number; title: string; order?: number }
) {
  try {
    const prompt = `You are an expert cultural guide and historian enriching the checkpoint "${checkpoint.title}" at "${locationName}".
Tasks:
1. summary: Write 2 vivid, engaging sentences (approx 30-40 words) about this specific spot.
2. things_to_notice: 2-3 specific visual architectural, stylistic, or historical details for a visitor standing here to spot.
3. questions: 3 short, intriguing questions for the visitor to ask.
Output strictly JSON matching:
{
  "summary": "...",
  "things_to_notice": ["...", "..."],
  "questions": ["...", "..."]
}`;

    const raw = await callOpenRouter(
      [
        {
          role: "system",
          content: "You are an expert cultural and architectural guide. Output strictly valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      { jsonMode: true, maxTokens: 1500, temperature: 0.3 }
    );

    const parsed = JSON.parse(cleanJsonText(raw));
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
  } catch (err) {
    console.warn(`[OpenRouter] Enrichment failed for ${checkpoint.title}, attempting fallback:`, err);
    return await geminiEnrich(locationName, checkpoint);
  }
}

export async function chatWithGuide(
  checkpoint: { title: string; summary?: string; detailedDescription?: string },
  history: Array<{ role: "user" | "model"; text: string }>,
  message: string
) {
  try {
    const systemPrompt = `You are ArtsyLens, an insightful, warm, and observant cultural and architectural tour guide.
Your current location is: ${checkpoint.title}.
Background context: ${checkpoint.detailedDescription || checkpoint.summary || ""}.
The visitor is currently standing here exploring.
Tone & Guidelines:
- Answer their questions about what they are seeing, historical significance, architectural techniques, or stories.
- Keep responses concise (2 to 3 sentences maximum) unless the visitor asks for an in-depth story or comprehensive explanation.
- Speak with natural curiosity, clarity, and observational charm. Never sound robotic or like a generic encyclopedia.`;

    const formattedMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    for (const h of history) {
      if (h.text && h.text.trim()) {
        formattedMessages.push({
          role: h.role === "model" ? "assistant" : "user",
          content: h.text,
        });
      }
    }

    formattedMessages.push({ role: "user", content: message });

    const text = await callOpenRouter(formattedMessages, {
      maxTokens: 500,
      temperature: 0.7,
    });

    return { text: text || "I see what you mean. What aspect would you like to explore further?" };
  } catch (err) {
    console.warn("[OpenRouter] Chat failed, attempting fallback:", err);
    return await geminiChat(checkpoint, history, message);
  }
}

export async function analyzeImage(
  image: string,
  context: string,
  promptOverride?: string
) {
  try {
    let imageUrl = image;
    if (!image.startsWith("data:")) {
      imageUrl = `data:image/jpeg;base64,${image}`;
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

    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: promptText },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ];

    const text = await callOpenRouter(messages, {
      maxTokens: 800,
      temperature: 0.4,
      model: "google/gemini-2.5-flash",
    });

    return { text: text || "I see the photo, but could not discern specific details." };
  } catch (err) {
    console.warn("[OpenRouter] Image analysis failed, attempting fallback:", err);
    return await geminiAnalyze(image, context, promptOverride);
  }
}

export async function annotateImageStudy(image: string, context?: string) {
  // Delegate sketch generation to the specialized image model
  return await geminiAnnotate(image, context);
}

export async function recapTour(
  location: string,
  checkpoints: Array<{ id: number; title: string; summary?: string }>
) {
  try {
    const simplifiedCheckpoints = checkpoints.map((c) => ({
      id: c.id,
      title: c.title,
      desc: c.summary,
    }));

    const prompt = `Role: You are an evocative travel writer creating a field journal summary of a completed journey.
Input Checkpoints: ${JSON.stringify(simplifiedCheckpoints)}
Output strictly JSON:
{
  "summary": "Max 12 words capturing the essence of the journey.",
  "journalStory": "Max 10 words.",
  "entries": [
    { "id": 1, "text": "Written in First Person (max 20 words per checkpoint)" }
  ]
}`;

    const raw = await callOpenRouter(
      [
        {
          role: "system",
          content: "You are an evocative travel writer. Output strictly valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      { jsonMode: true, maxTokens: 1500, temperature: 0.6 }
    );

    const parsed = JSON.parse(cleanJsonText(raw));
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
  } catch (err) {
    console.warn("[OpenRouter] Recap failed, attempting fallback:", err);
    return await geminiRecap(location, checkpoints);
  }
}
