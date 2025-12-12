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
  ManualStatusResponse,
  ProjectSummary,
  Role,
} from '../types';
import { normalizeManualStats, type ManualStatsLike } from '../utils/manuals';

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
  const response = await request<ManualStatsLike>(path, {
    method: 'POST',
    body: formData,
    auth: !guest,
  });
  const normalized = normalizeManualStats(response);
  if (!normalized) {
    throw new Error('매뉴얼 정보를 불러오지 못했습니다.');
  }
  return normalized;
}

export async function fetchManualStatus(
  conversationId: string,
  options?: GuestOptions,
): Promise<ManualStats | null> {
  const guest = Boolean(options?.guest);
  const path = guest
    ? `/api/guest/manuals/${conversationId}/status`
    : `/api/manuals/${conversationId}/status`;
  const response = await request<ManualStatusResponse<ManualStatsLike>>(path, {
    auth: !guest,
  });
  return response.hasManual ? normalizeManualStats(response.stats ?? null) : null;
}

export async function deleteManualSource(
  conversationId: string,
  sourceId: string,
  options?: GuestOptions,
): Promise<ManualStats | null> {
  const guest = Boolean(options?.guest);
  const path = guest
    ? `/api/guest/manuals/${conversationId}/sources/${sourceId}`
    : `/api/manuals/${conversationId}/sources/${sourceId}`;
  const response = await request<ManualStatusResponse<ManualStatsLike>>(path, {
    method: 'DELETE',
    auth: !guest,
  });
  return response.hasManual ? normalizeManualStats(response.stats ?? null) : null;
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
  projectId: string,
  conversationId: string,
): Promise<ConversationMessage[]> {
  return request<ConversationMessage[]>(
    `/api/projects/${projectId}/chats/${conversationId}/messages`,
  );
}

export function fetchProjects(): Promise<ProjectSummary[]> {
  return request<ProjectSummary[]>('/api/projects');
}

export function createProject(payload: {
  name: string;
  description?: string;
  instruction_text?: string;
}): Promise<ProjectSummary> {
  return request<ProjectSummary>('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateProject(
  projectId: string,
  payload: {
    name?: string;
    description?: string | null;
    instruction_text?: string | null;
  },
): Promise<ProjectSummary> {
  return request<ProjectSummary>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  await request<{ success: boolean }>(`/api/projects/${projectId}`, {
    method: 'DELETE',
  });
}

export function fetchProjectChats(
  projectId: string,
): Promise<ConversationSummary[]> {
  return request<ConversationSummary[]>(`/api/projects/${projectId}/chats`);
}

export function createProjectChat(
  projectId: string,
  payload: { title?: string; role: Role },
): Promise<ConversationDetail> {
  return request<ConversationDetail>(`/api/projects/${projectId}/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function renameProjectChat(
  projectId: string,
  conversationId: string,
  title: string,
): Promise<ConversationDetail> {
  return request<ConversationDetail>(
    `/api/projects/${projectId}/chats/${conversationId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    },
  );
}

export async function deleteProjectChat(
  projectId: string,
  conversationId: string,
): Promise<void> {
  await request<{ success: boolean }>(
    `/api/projects/${projectId}/chats/${conversationId}`,
    {
      method: 'DELETE',
    },
  );
}

export async function uploadProjectManuals(
  projectId: string,
  files: File[],
  embedRatio: number,
  instructionText?: string,
): Promise<ManualStats> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.append('embedRatio', embedRatio.toString());
  if (instructionText?.trim()) {
    formData.append('instructionText', instructionText.trim());
  }
  const response = await request<ManualStatsLike>(
    `/api/projects/${projectId}/manuals`,
    {
      method: 'POST',
      body: formData,
    },
  );
  const normalized = normalizeManualStats(response);
  if (!normalized) {
    throw new Error('프로젝트 매뉴얼 정보를 불러오지 못했습니다.');
  }
  return normalized;
}

export async function fetchProjectManualStatus(
  projectId: string,
): Promise<ManualStats | null> {
  const response = await request<ManualStatusResponse<ManualStatsLike>>(
    `/api/projects/${projectId}/manuals/status`,
  );
  return response.hasManual
    ? normalizeManualStats(response.stats ?? null)
    : null;
}

export async function deleteProjectManualSource(
  projectId: string,
  sourceId: string,
): Promise<ManualStats | null> {
  const response = await request<ManualStatusResponse<ManualStatsLike>>(
    `/api/projects/${projectId}/manuals/sources/${sourceId}`,
    {
      method: 'DELETE',
    },
  );
  return response.hasManual
    ? normalizeManualStats(response.stats ?? null)
    : null;
}
