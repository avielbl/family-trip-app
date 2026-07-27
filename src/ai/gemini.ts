import type { AiImageInput, AiProvider, AiSettings } from './types';

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

async function callGemini(
  settings: AiSettings,
  parts: GeminiPart[],
  maxTokens: number
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': settings.apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${body}`);
  }

  const data = await response.json();
  const responseParts: GeminiPart[] = data.candidates?.[0]?.content?.parts ?? [];
  return responseParts
    .map((p) => p.text ?? '')
    .join('');
}

export const geminiProvider: AiProvider = {
  generateText(settings, prompt, maxTokens = 1024) {
    return callGemini(settings, [{ text: prompt }], maxTokens);
  },

  extractFromImages(settings, prompt, images: AiImageInput[], maxTokens = 4096) {
    const parts: GeminiPart[] = [
      ...images.map((img) => ({
        inline_data: { mime_type: img.mediaType, data: img.base64 },
      })),
      { text: prompt },
    ];
    return callGemini(settings, parts, maxTokens);
  },
};
