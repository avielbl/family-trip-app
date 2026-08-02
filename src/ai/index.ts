import { anthropicProvider } from './anthropic';
import { geminiProvider } from './gemini';
import type { AiImageInput, AiProvider, AiProviderId, AiSettings } from './types';

export type { AiSettings, AiProviderId, AiImageInput } from './types';

export const AI_MODELS: Record<AiProviderId, { default: string; suggestions: string[] }> = {
  anthropic: {
    default: 'claude-sonnet-5',
    suggestions: ['claude-sonnet-5', 'claude-haiku-4-5', 'claude-opus-5'],
  },
  gemini: {
    default: 'gemini-3.5-flash',
    suggestions: ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro'],
  },
};

const PROVIDER_KEY = 'aiProvider';
const MODEL_KEY_PREFIX = 'aiModel:';
const API_KEY_PREFIX = 'aiApiKey:';
const LEGACY_CLAUDE_KEY = 'claudeApiKey';

const providers: Record<AiProviderId, AiProvider> = {
  anthropic: anthropicProvider,
  gemini: geminiProvider,
};

function migrateLegacyKey(): void {
  const legacy = localStorage.getItem(LEGACY_CLAUDE_KEY);
  if (legacy && !localStorage.getItem(API_KEY_PREFIX + 'anthropic')) {
    localStorage.setItem(API_KEY_PREFIX + 'anthropic', legacy);
  }
  if (legacy) {
    localStorage.removeItem(LEGACY_CLAUDE_KEY);
  }
}

export function getAiSettings(): AiSettings {
  migrateLegacyKey();
  const stored = localStorage.getItem(PROVIDER_KEY);
  const provider: AiProviderId = stored === 'gemini' ? 'gemini' : 'anthropic';
  const model = localStorage.getItem(MODEL_KEY_PREFIX + provider) || AI_MODELS[provider].default;
  const apiKey = localStorage.getItem(API_KEY_PREFIX + provider) || '';
  if (apiKey) return { provider, model, apiKey };

  // No key configured here — inherit the shared trip AI config (admin page,
  // synced from the server), so one configured key powers every AI feature.
  const shared = getSharedAiConfig();
  if (shared) return shared;

  return { provider, model, apiKey };
}

function getSharedAiConfig(): AiSettings | null {
  try {
    const raw = localStorage.getItem('aiConfig');
    if (!raw) return null;
    const cfg = JSON.parse(raw) as { provider?: string; model?: string; apiKey?: string };
    if (!cfg.apiKey) return null;
    if (cfg.provider === 'claude') {
      return {
        provider: 'anthropic',
        model: cfg.model || AI_MODELS.anthropic.default,
        apiKey: cfg.apiKey,
      };
    }
    if (cfg.provider === 'gemini') {
      return {
        provider: 'gemini',
        model: cfg.model || AI_MODELS.gemini.default,
        apiKey: cfg.apiKey,
      };
    }
    return null; // e.g. groq — not supported by these providers
  } catch {
    return null;
  }
}

export function saveAiSettings(s: AiSettings): void {
  localStorage.setItem(PROVIDER_KEY, s.provider);
  localStorage.setItem(MODEL_KEY_PREFIX + s.provider, s.model);
  localStorage.setItem(API_KEY_PREFIX + s.provider, s.apiKey);
}

/**
 * Switch the active provider, keeping each provider's stored model/key intact.
 * Returns the freshly loaded settings for the new provider.
 */
export function setAiProvider(provider: AiProviderId): AiSettings {
  localStorage.setItem(PROVIDER_KEY, provider);
  return getAiSettings();
}

export function hasAiKey(): boolean {
  return getAiSettings().apiKey.length > 0;
}

export async function generateText(
  prompt: string,
  maxTokens?: number,
  settings?: AiSettings
): Promise<string> {
  const s = settings ?? getAiSettings();
  return providers[s.provider].generateText(s, prompt, maxTokens);
}

export async function extractFromImages(
  prompt: string,
  images: AiImageInput[],
  maxTokens?: number,
  settings?: AiSettings
): Promise<string> {
  const s = settings ?? getAiSettings();
  return providers[s.provider].extractFromImages(s, prompt, images, maxTokens);
}

export function buildBookingPrompt(startDate: string, endDate: string): string {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

  return `Extract all travel booking information from these confirmation screenshots/PDFs. Return a JSON object with the following structure:
{
  "flights": [{ "id": "flight-1", "dayIndex": 0, "airline": "", "flightNumber": "", "departureAirport": "", "departureAirportCode": "", "arrivalAirport": "", "arrivalAirportCode": "", "departureTime": "ISO datetime", "arrivalTime": "ISO datetime", "terminal": "", "gate": "", "confirmationCode": "" }],
  "hotels": [{ "id": "hotel-1", "dayIndexStart": 0, "dayIndexEnd": 3, "name": "", "address": "", "city": "", "checkIn": "ISO datetime", "checkOut": "ISO datetime", "confirmationCode": "" }]
}

Trip starts ${startDate} (dayIndex 0) and ends ${endDate} (dayIndex ${dayCount - 1}).
Calculate dayIndex based on dates relative to ${startDate}.
Only include fields you can extract. Return ONLY valid JSON, no markdown.`;
}

export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return match ? match[1].trim() : trimmed;
}
