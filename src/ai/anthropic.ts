import type { AiImageInput, AiProvider, AiSettings } from './types';

const API_URL = 'https://api.anthropic.com/v1/messages';

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

type MessageContent =
  | string
  | Array<
      | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
      | { type: 'text'; text: string }
    >;

async function callAnthropic(
  settings: AiSettings,
  content: MessageContent,
  maxTokens: number
): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${body}`);
  }

  const data = await response.json();
  const blocks: AnthropicContentBlock[] = Array.isArray(data.content) ? data.content : [];
  const textBlock = blocks.find((b) => b.type === 'text' && typeof b.text === 'string' && b.text.length > 0);
  return textBlock?.text ?? '';
}

export const anthropicProvider: AiProvider = {
  generateText(settings, prompt, maxTokens = 1024) {
    return callAnthropic(settings, prompt, maxTokens);
  },

  extractFromImages(settings, prompt, images: AiImageInput[], maxTokens = 4096) {
    const content: MessageContent = [
      ...images.map((img) => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: img.mediaType,
          data: img.base64,
        },
      })),
      { type: 'text' as const, text: prompt },
    ];
    return callAnthropic(settings, content, maxTokens);
  },
};
