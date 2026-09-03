// server/apiEntry.ts
import express2 from "express";

// server/apiRouter.ts
import express from "express";

// server/nvidiaService.ts
function getNvidiaApiKey() {
  return (process.env.NVIDIA_API_KEY || process.env.NVIDIA_KEY || process.env.NV_API_KEY || "").trim();
}
var NVIDIA_CHAT_MODELS = [
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "mistralai/mistral-large"
];
var NVIDIA_VISION_MODELS = [
  "meta/llama-3.2-11b-vision-instruct",
  "meta/llama-3.2-90b-vision-instruct"
];
function extractJson(raw) {
  const text = (raw || "").trim();
  try {
    return JSON.parse(text);
  } catch {
  }
  const matchFenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (matchFenced) {
    try {
      return JSON.parse(matchFenced[1].trim());
    } catch {
    }
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch {
    }
  }
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(text.substring(firstBracket, lastBracket + 1));
    } catch {
    }
  }
  throw new Error("Could not parse JSON from model output: " + text.slice(0, 150));
}
async function callNvidia(messages, options = {}) {
  const apiKey = getNvidiaApiKey();
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured.");
  }
  const maxTokens = options.maxTokens || 1500;
  const temperature = options.temperature ?? 0.3;
  const candidateModels = options.model ? [options.model, ...NVIDIA_CHAT_MODELS] : NVIDIA_CHAT_MODELS;
  let lastError = null;
  for (const model of candidateModels) {
    for (const tryJsonFormat of options.jsonMode ? [true, false] : [false]) {
      try {
        const payload = {
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
          top_p: 1
        };
        if (tryJsonFormat) {
          payload.response_format = { type: "json_object" };
        }
        const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(4e3)
        });
        if (!res.ok) {
          const errorText = await res.text();
          console.warn(`[NVIDIA] ${model} (jsonFormat=${tryJsonFormat}) HTTP ${res.status}: ${errorText}`);
          lastError = new Error(`NVIDIA (${model}) status ${res.status}: ${errorText}`);
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
      } catch (err) {
        console.warn(`[NVIDIA] ${model} failed:`, err?.message || err);
        lastError = err;
        break;
      }
    }
  }
  throw lastError || new Error("All NVIDIA models failed or returned empty content");
}
async function nvidiaGenerateSkeleton(location) {
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
      { role: "user", content: userPrompt }
    ],
    { jsonMode: true, maxTokens: 2500, temperature: 0.3 }
  );
  const parsed = extractJson(raw);
  const checkpoints = Array.isArray(parsed?.checkpoints) ? parsed.checkpoints : Array.isArray(parsed) ? parsed : [];
  if (checkpoints.length === 0) {
    throw new Error("Invalid itinerary structure from NVIDIA");
  }
  const normalized = checkpoints.map((cp, index) => ({
    id: typeof cp.id === "number" ? cp.id : index + 1,
    title: cp.title || `Stop ${index + 1}`,
    short_label: cp.short_label || cp.title || `Stop ${index + 1}`,
    order: typeof cp.order === "number" ? cp.order : index + 1,
    summary: cp.summary || "A significant cultural landmark along the trail.",
    things_to_notice: Array.isArray(cp.things_to_notice) && cp.things_to_notice.length > 0 ? cp.things_to_notice : ["Notice the craftsmanship and proportion", "Observe the ambient local atmosphere"],
    questions: Array.isArray(cp.questions) && cp.questions.length > 0 ? cp.questions : ["What history defined this place?", "What details are easy to miss?"]
  }));
  return {
    location_intro: parsed.location_intro || parsed.intro || `A curated cultural journey through ${location}.`,
    checkpoints: normalized
  };
}
async function nvidiaEnrichCheckpoint(locationName, checkpoint) {
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
      { role: "user", content: prompt }
    ],
    { jsonMode: true, maxTokens: 1200, temperature: 0.3 }
  );
  const parsed = extractJson(raw);
  return {
    id: checkpoint.id,
    summary: parsed.summary || checkpoint.summary,
    things_to_notice: parsed.things_to_notice || checkpoint.things_to_notice,
    questions: parsed.questions || checkpoint.questions
  };
}
async function nvidiaChatWithGuide(checkpoint, history, message) {
  const systemPrompt = `You are ArtsyLens, an observant, warm, and insightful cultural and architectural guide.
Current stop: ${checkpoint.title}.
Context: ${checkpoint.detailedDescription || checkpoint.summary || ""}.
Visitor is standing here exploring with you.
- Keep answers concise (2 to 3 sentences) unless they ask for a deeper dive.
- Warm, curious, perceptive tone. Never sound like a generic brochure.`;
  const messages = [
    { role: "system", content: systemPrompt }
  ];
  for (const h of history) {
    if (h.text && h.text.trim()) {
      messages.push({
        role: h.role === "model" ? "assistant" : "user",
        content: h.text
      });
    }
  }
  messages.push({ role: "user", content: message });
  const reply = await callNvidia(messages, { maxTokens: 400, temperature: 0.6 });
  return { text: reply };
}
async function nvidiaAnalyzeImage(image, context, promptOverride) {
  let imageUrl = image;
  if (!image.startsWith("data:")) {
    imageUrl = `data:image/jpeg;base64,${image}`;
  }
  const promptText = promptOverride || `Analyze this image captured at "${context}" as a thoughtful cultural guide and visual historian.

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
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }
  ];
  let lastErr = null;
  for (const model of NVIDIA_VISION_MODELS) {
    try {
      const apiKey = getNvidiaApiKey();
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 800,
          temperature: 0.4
        }),
        signal: AbortSignal.timeout(8e3)
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
async function nvidiaRecapTour(location, checkpoints) {
  const prompt = `Location: ${location}
Checkpoints: ${JSON.stringify(checkpoints.map((c) => ({ id: c.id, title: c.title, summary: c.summary })))}

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
      { role: "user", content: prompt }
    ],
    { jsonMode: true, maxTokens: 1200, temperature: 0.6 }
  );
  const parsed = extractJson(raw);
  const entryMap = {};
  if (Array.isArray(parsed.entries)) {
    parsed.entries.forEach((e) => {
      entryMap[e.id] = e.text;
    });
  }
  return {
    summary: parsed.summary || `Exploration of ${location} complete.`,
    journalStory: parsed.journalStory || `Memories gathered across ${location}.`,
    entries: entryMap
  };
}

// server/geminiService.ts
import { GoogleGenAI, Type } from "@google/genai";
var aiClient = null;
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
var CANDIDATE_TEXT_MODELS = [
  "gemini-2.5-flash",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest"
];
async function callWithModelFallback(fn, models = CANDIDATE_TEXT_MODELS) {
  let lastError = null;
  for (const model of models) {
    try {
      return await fn(model);
    } catch (err) {
      console.warn(`[Gemini] Call with model '${model}' failed:`, err?.message || err);
      lastError = err;
    }
  }
  throw lastError;
}
function cleanJsonText(raw) {
  let cleaned = (raw || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  return cleaned;
}
async function generateSkeleton(location) {
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
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              location_intro: {
                type: Type.STRING,
                description: "One short, evocative sentence describing the location."
              },
              checkpoints: {
                type: Type.ARRAY,
                description: "List of checkpoints",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    short_label: { type: Type.STRING },
                    order: { type: Type.INTEGER }
                  },
                  required: ["id", "title"]
                }
              }
            },
            required: ["location_intro", "checkpoints"]
          },
          temperature: 0.4
        }
      });
      const text = cleanJsonText(response.text || "{}");
      return JSON.parse(text);
    });
    let checkpoints = Array.isArray(parsed?.checkpoints) ? parsed.checkpoints : [];
    if (checkpoints.length === 0 && Array.isArray(parsed)) {
      checkpoints = parsed;
    }
    if (checkpoints.length === 0) {
      throw new Error("No checkpoints returned by the model");
    }
    const normalizedCheckpoints = checkpoints.map((cp, idx) => ({
      id: typeof cp.id === "number" ? cp.id : idx + 1,
      title: cp.title || `Stop ${idx + 1}`,
      short_label: cp.short_label || cp.title || `Stop ${idx + 1}`,
      order: typeof cp.order === "number" ? cp.order : idx + 1
    }));
    return {
      location_intro: parsed.location_intro || `An evocative journey through the highlights of ${location}.`,
      checkpoints: normalizedCheckpoints
    };
  } catch (err) {
    console.error(`Error generating skeleton for ${location}:`, err);
    return {
      location_intro: `Explore the celebrated landmarks and cultural heritage of ${location}.`,
      checkpoints: [
        { id: 1, title: `${location} Historic Center`, short_label: "Historic Center", order: 1 },
        { id: 2, title: `Main Plaza & Grand Architecture`, short_label: "Grand Plaza", order: 2 },
        { id: 3, title: `Cultural Monument & Heritage Site`, short_label: "Monument", order: 3 },
        { id: 4, title: `Artisan Promenade & Local Quarter`, short_label: "Artisan Quarter", order: 4 },
        { id: 5, title: `Scenic Overlook & Promenade`, short_label: "Scenic Overlook", order: 5 }
      ]
    };
  }
}
async function enrichCheckpointData(locationName, checkpoint) {
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
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              summary: { type: Type.STRING },
              things_to_notice: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              questions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["summary", "things_to_notice", "questions"]
          },
          temperature: 0.3
        }
      });
      const text = cleanJsonText(response.text || "{}");
      const parsed = JSON.parse(text);
      return {
        id: checkpoint.id,
        summary: parsed.summary || `${checkpoint.title} is an essential landmark in ${locationName}.`,
        things_to_notice: Array.isArray(parsed.things_to_notice) && parsed.things_to_notice.length > 0 ? parsed.things_to_notice : ["Intricate period craftsmanship", "Historic architectural proportions", "Distinctive atmospheric details"],
        questions: Array.isArray(parsed.questions) && parsed.questions.length > 0 ? parsed.questions : ["What is the origin story here?", "What architectural style is highlighted?", "Why is this significant to locals?"]
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
        "The surrounding historic streetscape"
      ],
      questions: [
        "What is the story behind this landmark?",
        "When was this originally constructed?",
        "What should visitors not miss here?"
      ]
    };
  }
}
async function chatWithGuide(checkpoint, history, message) {
  try {
    const ai = getAiClient();
    const systemInstruction = `You are ArtsyLens, an insightful, warm, and observant cultural and architectural tour guide.
Your current location is: ${checkpoint.title}.
Background context: ${checkpoint.detailedDescription || checkpoint.summary || ""}.
The visitor is currently standing here exploring.
Tone & Guidelines:
- Answer their questions about what they are seeing, historical significance, architectural techniques, or stories.
- Keep responses concise (2 to 3 sentences maximum) unless the visitor asks for an in-depth story or comprehensive explanation.
- Speak with natural curiosity, clarity, and observational charm. Never sound robotic or like a generic encyclopedia.`;
    const contents = [
      ...history.filter((h) => h.text && h.text.trim()).map((h) => ({
        role: h.role === "model" ? "model" : "user",
        parts: [{ text: h.text }]
      })),
      {
        role: "user",
        parts: [{ text: message }]
      }
    ];
    return await callWithModelFallback(async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.7
        }
      });
      return { text: response.text || "I see what you mean. What aspect would you like to explore further?" };
    });
  } catch (err) {
    console.warn("Chat guide key error or fallback:", err?.message || err);
    return {
      text: `Standing before ${checkpoint.title}, take note of its remarkable proportions and craftsmanship. What specific story or detail would you like to uncover?`
    };
  }
}
async function analyzeImage(image, context, promptOverride) {
  try {
    const ai = getAiClient();
    let mimeType = "image/jpeg";
    let base64Data = image;
    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }
    const promptText = promptOverride || `Analyze this image captured at "${context}" as a thoughtful cultural guide and visual historian.

Respond in clean Markdown with the following structure:

**What You're Seeing**  
1\u20132 vivid sentences that ground the viewer in the scene and briefly situate it in its architectural or historical context.

**Key Features to Notice**  
3\u20135 concise bullet points highlighting visually important elements such as materials, forms, motifs, construction techniques, or stylistic influences.

**A Detail Most Visitors Miss**  
One subtle or easily overlooked detail, explained in a way that makes the viewer feel observant, curious, and rewarded for noticing it.

Tone & Constraints:
- Friendly, calm, and curious \u2014 never academic or robotic
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
                data: base64Data
              }
            },
            { text: promptText }
          ]
        }
      });
      return { text: response.text || "I see the photo, but could not discern specific details." };
    });
  } catch (err) {
    console.warn("Image analysis fallback used:", err?.message || err);
    return {
      text: `**What You're Seeing**
A captivating visual captured at ${context}, exemplifying the heritage craftsmanship and geometric proportions of the site.

**Key Features to Notice**
- Harmonic structural balance and focal framing
- Distinct surface textures shaped by historical techniques
- Fine articulation along the edges and moldings

**A Detail Most Visitors Miss**
Notice the rhythm of the shadow-lines across the stonework, deliberate choices made by historical builders to accentuate depth during changing daylight.`
    };
  }
}
async function annotateImageStudy(image, context) {
  const ai = getAiClient();
  let mimeType = "image/jpeg";
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
${context || "Historical site"}`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        imageConfig: { aspectRatio: "4:3" }
      }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        const outMime = part.inlineData.mimeType || "image/png";
        return { imageUrl: `data:${outMime};base64,${part.inlineData.data}` };
      }
    }
  } catch (err) {
    console.warn("Annotate image generation note:", err?.message || err);
  }
  return { imageUrl: null };
}
async function recapTour(location, checkpoints) {
  const ai = getAiClient();
  const simplifiedCheckpoints = checkpoints.map((c) => ({ id: c.id, title: c.title, desc: c.summary }));
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
          responseMimeType: "application/json",
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
                    text: { type: Type.STRING }
                  },
                  required: ["id", "text"]
                }
              }
            },
            required: ["summary", "journalStory", "entries"]
          }
        }
      });
      const text = cleanJsonText(response.text || "{}");
      const parsed = JSON.parse(text);
      const entryMap = {};
      if (parsed.entries && Array.isArray(parsed.entries)) {
        parsed.entries.forEach((e) => {
          entryMap[e.id] = e.text;
        });
      }
      return {
        summary: parsed.summary || `Journey through ${location} complete.`,
        journalStory: parsed.journalStory || `Walking through the wonders of ${location}.`,
        entries: entryMap
      };
    });
  } catch (err) {
    console.warn("Recap fallback triggered:", err);
    const entryMap = {};
    checkpoints.forEach((c) => {
      entryMap[c.id] = `Explored ${c.title}, absorbing its historical character and architectural nuances.`;
    });
    return {
      summary: `A memorable voyage through ${location}.`,
      journalStory: `History and art uncovered step by step.`,
      entries: entryMap
    };
  }
}

// server/openrouterService.ts
function getOpenRouterApiKey() {
  return (process.env.OPENROUTER_API_KEY || "").trim();
}
var OPENROUTER_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.0-flash-001",
  "meta-llama/llama-3.3-70b-instruct",
  "mistralai/mistral-small-24b-instruct-2501"
];
function cleanJsonText2(raw) {
  let cleaned = (raw || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  return cleaned;
}
async function callOpenRouter(messages, options = {}) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }
  const maxTokens = options.maxTokens || 1500;
  const temperature = options.temperature ?? 0.3;
  const candidateModels = options.model ? [options.model, ...OPENROUTER_MODELS] : OPENROUTER_MODELS;
  let lastError = null;
  for (const model of candidateModels) {
    try {
      const payload = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature
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
          "X-Title": "What The Art Tour Guide"
        },
        body: JSON.stringify(payload)
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
    } catch (err) {
      console.warn(`[OpenRouter] ${model} failed:`, err?.message || err);
      lastError = err;
    }
  }
  throw lastError || new Error("All OpenRouter models failed to respond");
}
async function generateSkeleton2(location) {
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
          content: "You are an expert cultural tour guide and historian. You always respond strictly in valid JSON without markdown wrapping."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      { jsonMode: true, maxTokens: 1500, temperature: 0.3 }
    );
    const parsed = JSON.parse(cleanJsonText2(raw));
    let checkpoints = Array.isArray(parsed?.checkpoints) ? parsed.checkpoints : [];
    if (checkpoints.length === 0 && Array.isArray(parsed)) {
      checkpoints = parsed;
    }
    if (checkpoints.length === 0) {
      throw new Error("No checkpoints in OpenRouter response");
    }
    const normalizedCheckpoints = checkpoints.map((cp, idx) => ({
      id: typeof cp.id === "number" ? cp.id : idx + 1,
      title: cp.title || `Stop ${idx + 1}`,
      short_label: cp.short_label || cp.title || `Stop ${idx + 1}`,
      order: typeof cp.order === "number" ? cp.order : idx + 1
    }));
    return {
      location_intro: parsed.location_intro || `An evocative journey through the highlights of ${location}.`,
      checkpoints: normalizedCheckpoints
    };
  } catch (err) {
    console.warn("[OpenRouter] Skeleton generation failed, attempting fallback:", err);
    return await generateSkeleton(location);
  }
}
async function enrichCheckpointData2(locationName, checkpoint) {
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
          content: "You are an expert cultural and architectural guide. Output strictly valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      { jsonMode: true, maxTokens: 1500, temperature: 0.3 }
    );
    const parsed = JSON.parse(cleanJsonText2(raw));
    return {
      id: checkpoint.id,
      summary: parsed.summary || `${checkpoint.title} is an essential landmark in ${locationName}.`,
      things_to_notice: Array.isArray(parsed.things_to_notice) && parsed.things_to_notice.length > 0 ? parsed.things_to_notice : ["Intricate period craftsmanship", "Historic architectural proportions", "Distinctive atmospheric details"],
      questions: Array.isArray(parsed.questions) && parsed.questions.length > 0 ? parsed.questions : ["What is the origin story here?", "What architectural style is highlighted?", "Why is this significant to locals?"]
    };
  } catch (err) {
    console.warn(`[OpenRouter] Enrichment failed for ${checkpoint.title}, attempting fallback:`, err);
    return await enrichCheckpointData(locationName, checkpoint);
  }
}
async function chatWithGuide2(checkpoint, history, message) {
  try {
    const systemPrompt = `You are ArtsyLens, an insightful, warm, and observant cultural and architectural tour guide.
Your current location is: ${checkpoint.title}.
Background context: ${checkpoint.detailedDescription || checkpoint.summary || ""}.
The visitor is currently standing here exploring.
Tone & Guidelines:
- Answer their questions about what they are seeing, historical significance, architectural techniques, or stories.
- Keep responses concise (2 to 3 sentences maximum) unless the visitor asks for an in-depth story or comprehensive explanation.
- Speak with natural curiosity, clarity, and observational charm. Never sound robotic or like a generic encyclopedia.`;
    const formattedMessages = [
      { role: "system", content: systemPrompt }
    ];
    for (const h of history) {
      if (h.text && h.text.trim()) {
        formattedMessages.push({
          role: h.role === "model" ? "assistant" : "user",
          content: h.text
        });
      }
    }
    formattedMessages.push({ role: "user", content: message });
    const text = await callOpenRouter(formattedMessages, {
      maxTokens: 500,
      temperature: 0.7
    });
    return { text: text || "I see what you mean. What aspect would you like to explore further?" };
  } catch (err) {
    console.warn("[OpenRouter] Chat failed, attempting fallback:", err);
    return await chatWithGuide(checkpoint, history, message);
  }
}
async function analyzeImage2(image, context, promptOverride) {
  try {
    let imageUrl = image;
    if (!image.startsWith("data:")) {
      imageUrl = `data:image/jpeg;base64,${image}`;
    }
    const promptText = promptOverride || `Analyze this image captured at "${context}" as a thoughtful cultural guide and visual historian.

Respond in clean Markdown with the following structure:

**What You're Seeing**  
1\u20132 vivid sentences that ground the viewer in the scene and briefly situate it in its architectural or historical context.

**Key Features to Notice**  
3\u20135 concise bullet points highlighting visually important elements such as materials, forms, motifs, construction techniques, or stylistic influences.

**A Detail Most Visitors Miss**  
One subtle or easily overlooked detail, explained in a way that makes the viewer feel observant, curious, and rewarded for noticing it.

Tone & Constraints:
- Friendly, calm, and curious \u2014 never academic or robotic
- No unnecessary technical jargon
- Avoid generic or obvious descriptions
- Prioritize clarity and insight over exhaustiveness
- Total response up to 150 words`;
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: promptText },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      }
    ];
    const text = await callOpenRouter(messages, {
      maxTokens: 800,
      temperature: 0.4,
      model: "google/gemini-2.5-flash"
    });
    return { text: text || "I see the photo, but could not discern specific details." };
  } catch (err) {
    console.warn("[OpenRouter] Image analysis failed, attempting fallback:", err);
    return await analyzeImage(image, context, promptOverride);
  }
}
async function annotateImageStudy2(image, context) {
  return await annotateImageStudy(image, context);
}
async function recapTour2(location, checkpoints) {
  try {
    const simplifiedCheckpoints = checkpoints.map((c) => ({
      id: c.id,
      title: c.title,
      desc: c.summary
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
          content: "You are an evocative travel writer. Output strictly valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      { jsonMode: true, maxTokens: 1500, temperature: 0.6 }
    );
    const parsed = JSON.parse(cleanJsonText2(raw));
    const entryMap = {};
    if (parsed.entries && Array.isArray(parsed.entries)) {
      parsed.entries.forEach((e) => {
        entryMap[e.id] = e.text;
      });
    }
    return {
      summary: parsed.summary || `Journey through ${location} complete.`,
      journalStory: parsed.journalStory || `Walking through the wonders of ${location}.`,
      entries: entryMap
    };
  } catch (err) {
    console.warn("[OpenRouter] Recap failed, attempting fallback:", err);
    return await recapTour(location, checkpoints);
  }
}

// server/aiDispatcher.ts
function getActiveProviders() {
  const hasNvidia = Boolean(getNvidiaApiKey());
  const hasOpenRouter = Boolean(getOpenRouterApiKey());
  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY);
  const primary = hasNvidia ? "nvidia" : hasOpenRouter ? "openrouter" : hasGemini ? "gemini" : "fallback";
  return {
    provider: primary,
    hasKey: hasNvidia || hasOpenRouter || hasGemini,
    hasNvidiaKey: hasNvidia,
    hasOpenRouterKey: hasOpenRouter,
    hasGeminiKey: hasGemini
  };
}
async function dispatchSkeleton(location) {
  if (getNvidiaApiKey()) {
    try {
      return await nvidiaGenerateSkeleton(location);
    } catch (err) {
      console.warn("[Dispatcher] NVIDIA skeleton failed, falling back to OpenRouter/Gemini:", err);
    }
  }
  if (getOpenRouterApiKey()) {
    try {
      return await generateSkeleton2(location);
    } catch (err) {
      console.warn("[Dispatcher] OpenRouter skeleton failed, falling back to Gemini:", err);
    }
  }
  return await generateSkeleton(location);
}
async function dispatchEnrich(locationName, checkpoint) {
  if (getNvidiaApiKey()) {
    try {
      return await nvidiaEnrichCheckpoint(locationName, checkpoint);
    } catch (err) {
      console.warn("[Dispatcher] NVIDIA enrich failed, falling back to OpenRouter/Gemini:", err);
    }
  }
  if (getOpenRouterApiKey()) {
    try {
      return await enrichCheckpointData2(locationName, checkpoint);
    } catch (err) {
      console.warn("[Dispatcher] OpenRouter enrich failed, falling back to Gemini:", err);
    }
  }
  return await enrichCheckpointData(locationName, checkpoint);
}
async function dispatchChat(checkpoint, messages, message) {
  if (getNvidiaApiKey()) {
    try {
      return await nvidiaChatWithGuide(checkpoint, messages, message);
    } catch (err) {
      console.warn("[Dispatcher] NVIDIA chat failed, falling back to OpenRouter/Gemini:", err);
    }
  }
  if (getOpenRouterApiKey()) {
    try {
      return await chatWithGuide2(checkpoint, messages, message);
    } catch (err) {
      console.warn("[Dispatcher] OpenRouter chat failed, falling back to Gemini:", err);
    }
  }
  return await chatWithGuide(checkpoint, messages, message);
}
async function dispatchAnalyzeImage(image, context, promptOverride) {
  if (getNvidiaApiKey()) {
    try {
      return await nvidiaAnalyzeImage(image, context, promptOverride);
    } catch (err) {
      console.warn("[Dispatcher] NVIDIA vision failed, falling back to OpenRouter/Gemini:", err);
    }
  }
  if (getOpenRouterApiKey()) {
    try {
      return await analyzeImage2(image, context, promptOverride);
    } catch (err) {
      console.warn("[Dispatcher] OpenRouter vision failed, falling back to Gemini:", err);
    }
  }
  return await analyzeImage(image, context, promptOverride);
}
async function dispatchAnnotateImage(image, context) {
  if (getOpenRouterApiKey()) {
    try {
      return await annotateImageStudy2(image, context);
    } catch (err) {
      console.warn("[Dispatcher] OpenRouter annotate failed:", err);
    }
  }
  return await annotateImageStudy(image, context);
}
async function dispatchRecap(location, checkpoints) {
  if (getNvidiaApiKey()) {
    try {
      return await nvidiaRecapTour(location, checkpoints);
    } catch (err) {
      console.warn("[Dispatcher] NVIDIA recap failed, falling back to OpenRouter/Gemini:", err);
    }
  }
  if (getOpenRouterApiKey()) {
    try {
      return await recapTour2(location, checkpoints);
    } catch (err) {
      console.warn("[Dispatcher] OpenRouter recap failed, falling back to Gemini:", err);
    }
  }
  return await recapTour(location, checkpoints);
}

// server/apiRouter.ts
function createApiRouter() {
  const router = express.Router();
  router.get("/health", (req, res) => {
    const providers = getActiveProviders();
    res.json({
      status: "ok",
      ...providers
    });
  });
  router.post("/gemini/skeleton", async (req, res) => {
    try {
      const { location } = req.body || {};
      if (!location || typeof location !== "string") {
        return res.status(400).json({ error: "Location is required" });
      }
      const data = await dispatchSkeleton(location);
      res.json(data);
    } catch (error) {
      console.error("Skeleton generation error:", error);
      res.status(500).json({
        error: error?.message || "Failed to generate tour itinerary skeleton"
      });
    }
  });
  router.post("/gemini/enrich", async (req, res) => {
    try {
      const { locationName, checkpoint } = req.body || {};
      if (!checkpoint || !checkpoint.id || !checkpoint.title) {
        return res.status(400).json({ error: "Valid checkpoint is required" });
      }
      const data = await dispatchEnrich(locationName || "the location", checkpoint);
      res.json(data);
    } catch (error) {
      console.error("Checkpoint enrichment error:", error);
      res.status(500).json({
        error: error?.message || "Failed to enrich checkpoint"
      });
    }
  });
  router.post("/gemini/chat", async (req, res) => {
    try {
      const { checkpoint, messages, message } = req.body || {};
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }
      const reply = await dispatchChat(
        checkpoint || { title: "Location" },
        messages || [],
        message
      );
      res.json(reply);
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({
        error: error?.message || "Failed to communicate with tour guide"
      });
    }
  });
  router.post("/gemini/analyze-image", async (req, res) => {
    try {
      const { image, context, promptOverride } = req.body || {};
      if (!image) {
        return res.status(400).json({ error: "Image data is required" });
      }
      const result = await dispatchAnalyzeImage(image, context || "monument", promptOverride);
      res.json(result);
    } catch (error) {
      console.error("Image analysis error:", error);
      res.status(500).json({
        error: error?.message || "Failed to analyze image"
      });
    }
  });
  router.post("/gemini/annotate-image", async (req, res) => {
    try {
      const { image, context } = req.body || {};
      if (!image) {
        return res.status(400).json({ error: "Image data is required" });
      }
      const result = await dispatchAnnotateImage(image, context);
      res.json(result);
    } catch (error) {
      console.error("Annotate image error:", error);
      res.status(500).json({
        error: error?.message || "Failed to annotate image"
      });
    }
  });
  router.post("/gemini/recap", async (req, res) => {
    try {
      const { location, checkpoints } = req.body || {};
      if (!checkpoints || !Array.isArray(checkpoints)) {
        return res.status(400).json({ error: "Checkpoints array is required" });
      }
      const data = await dispatchRecap(location || "Journey", checkpoints);
      res.json(data);
    } catch (error) {
      console.error("Recap error:", error);
      res.status(500).json({
        error: error?.message || "Failed to generate recap"
      });
    }
  });
  return router;
}

// server/apiEntry.ts
var app = express2();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});
app.use(express2.json({ limit: "25mb" }));
app.use((req, _res, next) => {
  if (typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body);
    } catch (_) {
    }
  }
  next();
});
var apiRouter = createApiRouter();
app.use("/api", apiRouter);
app.use("/", apiRouter);
app.use((err, _req, res, _next) => {
  console.error("Vercel Serverless API Error:", err);
  res.status(500).json({
    error: err?.message || "Internal server error"
  });
});
var apiEntry_default = app;
export {
  apiEntry_default as default
};
