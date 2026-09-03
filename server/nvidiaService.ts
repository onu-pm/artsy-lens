// NVIDIA NIM AI Service
// Supports NVIDIA AI Foundation Endpoints (integrate.api.nvidia.com)
// Compatible with Llama-3.3-70B, Llama-3.1-Nemotron, and Llama-3.2-Vision

export function getNvidiaApiKey(): string {
  return (
    process.env.NVIDIA_API_KEY ||
    process.env.NVIDIA_KEY ||
    process.env.NV_API_KEY ||
    ""
  ).trim();
}

const NVIDIA_CHAT_MODELS = [
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "mistralai/mistral-large",
];

const NVIDIA_VISION_MODELS = [
  "meta/llama-3.2-11b-vision-instruct",
  "meta/llama-3.2-90b-vision-instruct",
];

function extractJson<T = any>(raw: string): T {
  const text = (raw || "").trim();
  try {
    return JSON.parse(text);
  } catch {}

  const matchFenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (matchFenced) {
    try {
      return JSON.parse(matchFenced[1].trim());
    } catch {}
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch {}
  }

  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(text.substring(firstBracket, lastBracket + 1));
    } catch {}
  }

  throw new Error("Could not parse JSON from model output: " + text.slice(0, 150));
}

export async function callNvidia(
  messages: Array<{ role: string; content: any }>,
  options: {
    jsonMode?: boolean;
    maxTokens?: number;
    temperature?: number;
    model?: string;
  } = {}
): Promise<string> {
  const apiKey = getNvidiaApiKey();
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured.");
  }

  const maxTokens = options.maxTokens || 1500;
  const temperature = options.temperature ?? 0.3;
  const candidateModels = options.model ? [options.model, ...NVIDIA_CHAT_MODELS] : NVIDIA_CHAT_MODELS;

  let lastError: any = null;

  for (const model of candidateModels) {
    for (const tryJsonFormat of options.jsonMode ? [true, false] : [false]) {
      try {
        const payload: any = {
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
          top_p: 1,
        };

        if (tryJsonFormat) {
          payload.response_format = { type: "json_object" };
        }

        const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(4000),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.warn(`[NVIDIA] ${model} (jsonFormat=${tryJsonFormat}) HTTP ${res.status}: ${errorText}`);
          lastError = new Error(`NVIDIA (${model}) status ${res.status}: ${errorText}`);
          // If status is 400 or 422 with json_object, try next without json_object; otherwise skip model
          if (tryJsonFormat && (res.status === 400 || res.status === 422)) {
            continue;
          }
          break;
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content && typeof content === "string") {
          return content;
        }
      } catch (err: any) {
        console.warn(`[NVIDIA] ${model} failed:`, err?.message || err);
        lastError = err;
        break; // don't repeat on timeout or network error
      }
    }
  }

  throw lastError || new Error("All NVIDIA models failed or returned empty content");
}

export async function nvidiaGenerateSkeleton(location: string) {
  const systemPrompt = `You are an expert cultural geographer, architectural historian, and master local guide.
Plan an engaging walking tour for "${location}".
Select 4 to 6 culturally or historically significant checkpoints in a walkable spatial order.
Output strictly JSON matching:
{
  "location_intro": "1-2 evocative sentences capturing the spirit of the destination.",
  "checkpoints": [
    {
      "id": 1,
      "title": "Exact Landmark Name",
      "short_label": "Short Label (1-3 words)",
      "order": 1,
      "summary": "1 sentence why this place matters.",
      "things_to_notice": ["Detail 1", "Detail 2"],
      "questions": ["Question 1", "Question 2"]
    }
  ]
}`;

  const userPrompt = `Generate a JSON walking itinerary for "${location}". Return valid JSON only.`;

  const raw = await callNvidia(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { jsonMode: true, maxTokens: 2500, temperature: 0.3 }
  );

  const parsed = extractJson<any>(raw);
  const checkpoints = Array.isArray(parsed?.checkpoints) ? parsed.checkpoints : Array.isArray(parsed) ? parsed : [];
  if (checkpoints.length === 0) {
    throw new Error("Invalid itinerary structure from NVIDIA");
  }

  const normalized = checkpoints.map((cp: any, index: number) => ({
    id: typeof cp.id === "number" ? cp.id : index + 1,
    title: cp.title || `Stop ${index + 1}`,
    short_label: cp.short_label || cp.title || `Stop ${index + 1}`,
    order: typeof cp.order === "number" ? cp.order : index + 1,
    summary: cp.summary || "A significant cultural landmark along the trail.",
    things_to_notice: Array.isArray(cp.things_to_notice) && cp.things_to_notice.length > 0
      ? cp.things_to_notice
      : ["Notice the craftsmanship and proportion", "Observe the ambient local atmosphere"],
    questions: Array.isArray(cp.questions) && cp.questions.length > 0
      ? cp.questions
      : ["What history defined this place?", "What details are easy to miss?"],
  }));

  return {
    location_intro: parsed.location_intro || parsed.intro || `A curated cultural journey through ${location}.`,
    checkpoints: normalized,
  };
}

export async function nvidiaEnrichCheckpoint(locationName: string, checkpoint: any) {
  const prompt = `Location: ${locationName}
Checkpoint: ${checkpoint.title}
Summary so far: ${checkpoint.summary || ""}

Provide deep enrichment for this tour stop.
Return strictly JSON with this schema:
{
  "id": ${checkpoint.id},
  "summary": "1-2 evocative sentences on why this checkpoint is extraordinary.",
  "things_to_notice": [
    "Specific architectural, material, or sensory detail 1",
    "Specific architectural, material, or sensory detail 2"
  ],
  "questions": [
    "Thought-provoking inquiry 1",
    "Thought-provoking inquiry 2",
    "Thought-provoking inquiry 3"
  ]
}`;

  const raw = await callNvidia(
    [
      { role: "system", content: "You are an architectural historian and curator. Output strictly JSON." },
      { role: "user", content: prompt },
    ],
    { jsonMode: true, maxTokens: 1200, temperature: 0.3 }
  );

  const parsed = extractJson<any>(raw);
  return {
    id: checkpoint.id,
    summary: parsed.summary || checkpoint.summary,
    things_to_notice: parsed.things_to_notice || checkpoint.things_to_notice,
    questions: parsed.questions || checkpoint.questions,
  };
}

export async function nvidiaChatWithGuide(
  checkpoint: { title: string; summary?: string; detailedDescription?: string },
  history: Array<{ role: "user" | "model"; text: string }>,
  message: string
) {
  const systemPrompt = `You are ArtsyLens, an observant, warm, and insightful cultural and architectural guide.
Current stop: ${checkpoint.title}.
Context: ${checkpoint.detailedDescription || checkpoint.summary || ""}.
Visitor is standing here exploring with you.
- Keep answers concise (2 to 3 sentences) unless they ask for a deeper dive.
- Warm, curious, perceptive tone. Never sound like a generic brochure.`;

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  for (const h of history) {
    if (h.text && h.text.trim()) {
      messages.push({
        role: h.role === "model" ? "assistant" : "user",
        content: h.text,
      });
    }
  }

  messages.push({ role: "user", content: message });

  const reply = await callNvidia(messages, { maxTokens: 400, temperature: 0.6 });
  return { text: reply };
}

export async function nvidiaAnalyzeImage(
  image: string,
  context: string,
  promptOverride?: string
) {
  let imageUrl = image;
  if (!image.startsWith("data:")) {
    imageUrl = `data:image/jpeg;base64,${image}`;
  }

  const promptText =
    promptOverride ||
    `Analyze this image captured at "${context}" as a thoughtful cultural guide and visual historian.

Respond in clean Markdown with:
**What You're Seeing**  
1-2 vivid sentences grounding the scene and its context.

**Key Features to Notice**  
3-4 concise bullet points highlighting materials, proportions, motifs, or craftsmanship.

**A Detail Most Visitors Miss**  
One subtle overlooked detail that rewards close observation.`;

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: promptText },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ];

  let lastErr: any = null;
  for (const model of NVIDIA_VISION_MODELS) {
    try {
      const apiKey = getNvidiaApiKey();
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 800,
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return { text: content };
      }
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("NVIDIA vision models unavailable");
}

export async function nvidiaRecapTour(
  location: string,
  checkpoints: Array<{ id: number; title: string; summary?: string }>
) {
  const prompt = `Location: ${location}
Checkpoints: ${JSON.stringify(checkpoints.map(c => ({ id: c.id, title: c.title, summary: c.summary })))}

Write a field journal summary for this completed walking tour.
Return strictly JSON:
{
  "summary": "10-14 words capturing the essence of the journey.",
  "journalStory": "8-10 evocative words.",
  "entries": [
    { "id": 1, "text": "First-person reflective reflection for stop 1 (under 20 words)." }
  ]
}`;

  const raw = await callNvidia(
    [
      { role: "system", content: "You are an evocative travel writer. Output strictly JSON." },
      { role: "user", content: prompt },
    ],
    { jsonMode: true, maxTokens: 1200, temperature: 0.6 }
  );

  const parsed = extractJson<any>(raw);
  const entryMap: Record<number, string> = {};
  if (Array.isArray(parsed.entries)) {
    parsed.entries.forEach((e: any) => {
      entryMap[e.id] = e.text;
    });
  }

  return {
    summary: parsed.summary || `Exploration of ${location} complete.`,
    journalStory: parsed.journalStory || `Memories gathered across ${location}.`,
    entries: entryMap,
  };
}
