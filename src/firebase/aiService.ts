import type { AIConfig, ImportTarget, AIImportResult, AISuggestion } from '../types/ai';
import type { Hotel, DrivingSegment, TripDay } from '../types/trip';

const AI_CONFIG_KEY = 'aiConfig';

const DEFAULT_CONFIG: AIConfig = {
  provider: 'gemini',
  model: 'gemini-2.5-flash-lite',
  apiKey: '',
};

export const PROVIDER_PRESETS: Record<string, string[]> = {
  gemini: ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  groq: ['llama-3.2-11b-vision-preview', 'llama-3.3-70b-versatile'],
  claude: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'],
};

export const PROVIDER_KEY_URLS: Record<string, string> = {
  gemini: 'https://aistudio.google.com/apikey',
  groq: 'https://console.groq.com/keys',
  claude: 'https://console.anthropic.com/',
};

// ─── Config ──────────────────────────────────────────────────────────────────

export function getAIConfig(): AIConfig {
  try {
    const stored = localStorage.getItem(AI_CONFIG_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_CONFIG };
}

export function setAIConfig(config: AIConfig): void {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<{ b64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, b64] = result.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] ?? file.type ?? 'image/jpeg';
      resolve({ b64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function extractJSON(text: string): string {
  // Strip markdown code blocks if present
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  // Find first [ or {
  const arrStart = text.indexOf('[');
  const objStart = text.indexOf('{');
  const start = arrStart !== -1 && (objStart === -1 || arrStart < objStart)
    ? arrStart
    : objStart;
  if (start !== -1) return text.slice(start);
  return text;
}

// ─── Provider Adapters ───────────────────────────────────────────────────────

async function callGemini(config: AIConfig, prompt: string, images?: File[]): Promise<string> {
  const parts: any[] = [];
  if (images?.length) {
    for (const file of images) {
      const { b64, mimeType } = await fileToBase64(file);
      parts.push({ inline_data: { mime_type: mimeType, data: b64 } });
    }
  }
  parts.push({ text: prompt });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const body: any = { contents: [{ parts }] };
  // JSON mode only supported for non-vision requests
  if (!images?.length) {
    body.generationConfig = { responseMimeType: 'application/json' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('RATE_LIMIT');
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callGroq(config: AIConfig, prompt: string, images?: File[]): Promise<string> {
  let messageContent: any;

  if (images?.length) {
    const parts: any[] = [];
    for (const file of images) {
      const { b64, mimeType } = await fileToBase64(file);
      parts.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } });
    }
    parts.push({ type: 'text', text: prompt });
    messageContent = parts;
  } else {
    messageContent = prompt;
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: messageContent }],
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('RATE_LIMIT');
    const err = await res.text();
    throw new Error(`Groq ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callClaude(config: AIConfig, prompt: string, images?: File[]): Promise<string> {
  const content: any[] = [];
  if (images?.length) {
    for (const file of images) {
      const { b64, mimeType } = await fileToBase64(file);
      content.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } });
    }
  }
  content.push({ type: 'text', text: prompt });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('RATE_LIMIT');
    const err = await res.text();
    throw new Error(`Claude ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function callAI(prompt: string, images?: File[]): Promise<string> {
  const config = getAIConfig();
  if (!config.apiKey) throw new Error('NO_KEY');
  switch (config.provider) {
    case 'gemini': return callGemini(config, prompt, images);
    case 'groq':   return callGroq(config, prompt, images);
    case 'claude': return callClaude(config, prompt, images);
    default: throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// ─── Import ──────────────────────────────────────────────────────────────────

const IMPORT_SCHEMAS: Record<ImportTarget, string> = {
  restaurant: `Array of:
{ "name": string, "nameHe": string|null, "cuisine": string|null, "address": string|null,
  "city": string|null, "phone": string|null, "priceRange": "$"|"$$"|"$$$"|null, "notes": string|null }`,

  highlight: `Array of:
{ "name": string, "nameHe": string|null,
  "category": "beach"|"ruins"|"museum"|"food"|"kids-fun"|"nature"|"shopping"|"viewpoint"|"other",
  "description": string|null, "address": string|null, "openingHours": string|null, "ticketInfo": string|null }`,

  hotel: `Array of:
{ "name": string, "address": string, "city": string,
  "checkIn": string (ISO datetime), "checkOut": string (ISO datetime),
  "confirmationCode": string|null, "phone": string|null }`,

  flight: `Array of:
{ "airline": string, "flightNumber": string,
  "departureAirport": string, "departureAirportCode": string (IATA),
  "arrivalAirport": string, "arrivalAirportCode": string (IATA),
  "departureTime": string (ISO), "arrivalTime": string (ISO),
  "terminal": string|null, "confirmationCode": string|null }`,
};

export function buildImportPrompt(target: ImportTarget): string {
  return `You are a travel data extractor for a family trip planning app.

TASK: Extract all ${target} records visible in the provided content.

OUTPUT FORMAT:
${IMPORT_SCHEMAS[target]}

RULES:
- Return ONLY a valid JSON array — no markdown, no explanation
- Include all ${target}s found; return [] if none found
- Use null for fields you cannot determine
- Dates: ISO 8601 format (e.g. "2026-03-24T14:30:00")`;
}

export function parseImport(jsonStr: string, _target: ImportTarget): AIImportResult[] {
  const cleaned = extractJSON(jsonStr);
  let arr: any[];
  try {
    const parsed = JSON.parse(cleaned);
    arr = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    throw new Error('PARSE_ERROR');
  }
  return arr.map((item, i) => ({
    id: `import-${Date.now()}-${i}`,
    data: item,
    accepted: true,
    edited: false,
  }));
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

export interface SuggestContext {
  hotels: Hotel[];
  driving: DrivingSegment[];
  days: TripDay[];
  existing: Array<{ name?: string; title?: string }>;
}

const SUGGEST_SCHEMAS: Record<string, string> = {
  restaurant: `Array of:
{ "name": string, "cuisine": string, "city": string, "address": string|null,
  "priceRange": "$"|"$$"|"$$$", "notes": string, "rationale": string }`,

  highlight: `Array of:
{ "name": string, "category": "beach"|"ruins"|"museum"|"food"|"kids-fun"|"nature"|"shopping"|"viewpoint"|"other",
  "description": string, "city": string|null, "address": string|null, "rationale": string }`,

  'passport-stamp': `Array of:
{ "title": string, "icon": string (single emoji), "location": string,
  "description": string, "earnCondition": string, "dayIndex": number, "rationale": string }`,
};

const SUGGEST_COUNTS: Record<string, string> = {
  restaurant: '3–5 restaurants per hotel location (vary by meal type and price)',
  highlight: '3–5 attractions per location (mix: must-see, kid-friendly, hidden gem)',
  'passport-stamp': 'one unique stamp achievement per trip day',
};

export function buildSuggestPrompt(
  type: 'restaurant' | 'highlight' | 'passport-stamp',
  context: SuggestContext
): string {
  const hotelLines = context.hotels.map(h =>
    `  - ${h.name}, ${h.city} (Days ${h.dayIndexStart + 1}–${h.dayIndexEnd + 1})`
  ).join('\n') || '  (none yet)';

  const driveLines = context.driving.map(d =>
    `  - Day ${d.dayIndex + 1}: ${d.from} → ${d.to}`
  ).join('\n') || '  (none yet)';

  const dayLines = context.days.map(d =>
    `  - Day ${d.dayIndex + 1} (${d.date}): ${d.location}`
  ).join('\n');

  const existingNames = context.existing
    .map(e => e.name ?? e.title)
    .filter(Boolean)
    .join(', ');

  return `You are a travel assistant planning a family Greece trip (2 adults + 4 kids, ages 4–14).

ITINERARY:
${dayLines}

HOTELS:
${hotelLines}

DRIVING ROUTES:
${driveLines}

${existingNames ? `ALREADY IN APP (avoid suggesting these): ${existingNames}\n` : ''}
TASK: Suggest ${SUGGEST_COUNTS[type]}. Use real place names. Be specific and practical.

OUTPUT FORMAT:
${SUGGEST_SCHEMAS[type]}

Return ONLY a valid JSON array — no markdown, no explanation.`;
}

export function extractSuggestions(
  jsonStr: string,
  type: 'restaurant' | 'highlight' | 'passport-stamp'
): AISuggestion[] {
  const cleaned = extractJSON(jsonStr);
  let arr: any[];
  try {
    const parsed = JSON.parse(cleaned);
    arr = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    throw new Error('PARSE_ERROR');
  }
  return arr.map((item, i) => ({
    id: `suggest-${Date.now()}-${i}`,
    type,
    data: item,
    rationale: item.rationale ?? '',
    accepted: false,
  }));
}

// ─── Error helpers ────────────────────────────────────────────────────────────

export function aiErrorMessage(err: unknown, isHe: boolean): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === 'NO_KEY') return isHe
    ? 'הגדר ספק AI בדף הניהול תחילה'
    : 'Configure AI provider in Admin settings first';
  if (msg === 'RATE_LIMIT') return isHe
    ? 'חריגת מגבלת קצב — נסה שוב עוד דקה'
    : 'Rate limit hit — wait a minute and retry';
  if (msg === 'PARSE_ERROR') return isHe
    ? 'לא ניתן לפרסר את תשובת ה-AI'
    : 'Could not parse AI response — try again';
  return msg;
}
