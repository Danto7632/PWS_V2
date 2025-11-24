export type Role = 'customer' | 'employee';

export type LlmProvider = 'ollama' | 'openai' | 'gemini';

export interface ProviderConfig {
  provider: LlmProvider;
  model: string;
  apiKey?: string;
}

export interface ManualStats {
  fileCount: number;
  chunkCount: number;
  embeddedChunks: number;
}

export interface Scenario {
  situation: string;
  customerType: string;
  firstMessage: string;
}

export interface Evaluation {
  feedback: string;
  score: number;
  maxScore: number;
}

export interface ChatMessage {
  id: string;
  author: 'user' | 'assistant';
  role: Role | 'system';
  text: string;
  timestamp: string;
}

export interface StatsSnapshot {
  totalSimulations: number;
  customerRoleCount: number;
  employeeRoleCount: number;
  totalScore: number;
}

export interface OllamaStatus {
  connected: boolean;
  models?: string[];
  error?: string;
}
