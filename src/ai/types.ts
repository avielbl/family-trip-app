export type AiProviderId = 'anthropic' | 'gemini';

export interface AiSettings {
  provider: AiProviderId;
  apiKey: string;
  model: string;
}

export interface AiImageInput {
  mediaType: string;
  base64: string;
}

export interface AiProvider {
  generateText(settings: AiSettings, prompt: string, maxTokens?: number): Promise<string>;
  extractFromImages(
    settings: AiSettings,
    prompt: string,
    images: AiImageInput[],
    maxTokens?: number
  ): Promise<string>;
}
