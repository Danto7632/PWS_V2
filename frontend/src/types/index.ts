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

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends ConversationSummary {
  instruction_text?: string | null;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: Role | 'system';
  content: string;
  created_at: string;
}
