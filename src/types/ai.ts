export type AIProvider = 'gemini' | 'groq' | 'claude';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

export type ImportTarget = 'restaurant' | 'highlight' | 'hotel' | 'flight';

export interface AIImportResult {
  id: string;
  data: Record<string, any>;
  accepted: boolean;
  edited: boolean;
}

export interface AISuggestion {
  id: string;
  type: 'restaurant' | 'highlight' | 'passport-stamp';
  data: Record<string, any>;
  rationale: string;
  accepted: boolean;
}

export interface PassportStamp {
  id: string;
  dayIndex: number;
  title: string;
  titleHe?: string;
  description: string;
  descriptionHe?: string;
  icon: string;          // emoji
  location: string;
  earnCondition: string;
  highlightId?: string;  // if set, auto-earned when linked highlight completed
}

export interface EarnedStamp {
  id: string;            // `${memberId}_${stampId}`
  stampId: string;
  memberId: string;
  earnedAt: string;
}
