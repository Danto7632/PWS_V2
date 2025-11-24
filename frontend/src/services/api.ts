import type {
  ManualStats,
  ProviderConfig,
  Scenario,
  Evaluation,
  OllamaStatus,
  AuthResponse,
  ConversationDetail,
  ConversationMessage,
  ConversationSummary,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

type ApiRequestInit = RequestInit & { auth?: boolean };

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { auth = true, headers, ...rest } = init;
  const finalHeaders = new Headers(headers ?? {});
  if (auth && authToken) {
    finalHeaders.set('Authorization', `Bearer ${authToken}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
  });

  if (response.status === 401) {
    unauthorizedHandler?.();
    throw new Error('세션이 만료되었습니다. 다시 로그인하세요.');
  }

  if (!response.ok) {
    const text = await response.text();
    let message = '요청 처리 중 오류가 발생했습니다.';
    if (text) {
      try {
        const parsed = JSON.parse(text) as { message?: string; error?: string };
        message = parsed.message || parsed.error || text;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  return response.text() as Promise<T>;
}
type CustomerResponse = {
  aiResponse: string;
  context: string[];
};

type EmployeeResponse = {
  evaluation: Evaluation;
  nextScenario: Scenario;
  nextCustomerMessage: string;
  context: string[];
};

type GuestOptions = {
  guest?: boolean;
};

export async function uploadManuals(
  conversationId: string,
  files: File[],
  embedRatio: number,
  instructionText?: string,
  options?: GuestOptions,
): Promise<ManualStats> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.append('conversationId', conversationId);
  formData.append('embedRatio', embedRatio.toString());
  if (instructionText?.trim()) {
    formData.append('instructionText', instructionText.trim());
  }
  const guest = Boolean(options?.guest);
  const path = guest ? '/api/guest/manuals' : '/api/manuals';
  return request<ManualStats>(path, {
    method: 'POST',
    body: formData,
    auth: !guest,
  });
}

export async function generateScenario(
  conversationId: string,
  providerConfig: ProviderConfig,
  options?: GuestOptions,
): Promise<Scenario> {
  const guest = Boolean(options?.guest);
  const path = guest
    ? '/api/guest/simulations/scenario'
    : '/api/simulations/scenario';
  return request<Scenario>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, providerConfig }),
    auth: !guest,
  });
}

export async function respondAsCustomer(
  conversationId: string,
  message: string,
  providerConfig: ProviderConfig,
  options?: GuestOptions,
): Promise<CustomerResponse> {
  const guest = Boolean(options?.guest);
  const path = guest
    ? '/api/guest/simulations/customer/respond'
    : '/api/simulations/customer/respond';
  return request<CustomerResponse>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, message, providerConfig }),
    auth: !guest,
  });
}

export async function respondAsEmployee(
  conversationId: string,
  message: string,
  providerConfig: ProviderConfig,
  options?: GuestOptions,
): Promise<EmployeeResponse> {
  const guest = Boolean(options?.guest);
  const path = guest
    ? '/api/guest/simulations/employee/respond'
    : '/api/simulations/employee/respond';
  return request<EmployeeResponse>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, message, providerConfig }),
    auth: !guest,
  });
}

export async function fetchOllamaStatus(): Promise<OllamaStatus> {
  return request<OllamaStatus>('/api/system/ollama');
}

export function registerUser(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
    auth: false,
  });
}

export function loginUser(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    auth: false,
  });
}

export function fetchConversations(): Promise<ConversationSummary[]> {
  return request<ConversationSummary[]>('/api/conversations');
}

export function createConversation(title?: string): Promise<ConversationDetail> {
  return request<ConversationDetail>('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
}

export function renameConversation(
  conversationId: string,
  title: string,
): Promise<ConversationDetail> {
  return request<ConversationDetail>(`/api/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
}

export function updateConversationInstruction(
  conversationId: string,
  instructionText?: string,
): Promise<ConversationDetail> {
  return request<ConversationDetail>(`/api/conversations/${conversationId}/instruction`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instructionText }),
  });
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await request<{ success: boolean }>(`/api/conversations/${conversationId}`, {
    method: 'DELETE',
  });
}

export function fetchConversationMessages(
  conversationId: string,
): Promise<ConversationMessage[]> {
  return request<ConversationMessage[]>(`/api/conversations/${conversationId}/messages`);
}
