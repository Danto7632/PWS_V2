import type {
  ManualStats,
  ProviderConfig,
  Scenario,
  Evaluation,
  OllamaStatus,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

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

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || '요청 처리 중 오류가 발생했습니다.');
  }
  return response.json() as Promise<T>;
}

export async function uploadManuals(
  conversationId: string,
  files: File[],
  embedRatio: number,
  instructionText?: string,
): Promise<ManualStats> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.append('conversationId', conversationId);
  formData.append('embedRatio', embedRatio.toString());
  if (instructionText?.trim()) {
    formData.append('instructionText', instructionText.trim());
  }

  const response = await fetch(`${BASE_URL}/api/manuals`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<ManualStats>(response);
}

export async function generateScenario(
  conversationId: string,
  providerConfig: ProviderConfig,
): Promise<Scenario> {
  const response = await fetch(`${BASE_URL}/api/simulations/scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, providerConfig }),
  });
  return handleResponse<Scenario>(response);
}

export async function respondAsCustomer(
  conversationId: string,
  message: string,
  providerConfig: ProviderConfig,
): Promise<CustomerResponse> {
  const response = await fetch(`${BASE_URL}/api/simulations/customer/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, message, providerConfig }),
  });
  return handleResponse<CustomerResponse>(response);
}

export async function respondAsEmployee(
  conversationId: string,
  message: string,
  providerConfig: ProviderConfig,
): Promise<EmployeeResponse> {
  const response = await fetch(`${BASE_URL}/api/simulations/employee/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, message, providerConfig }),
  });
  return handleResponse<EmployeeResponse>(response);
}

export async function fetchOllamaStatus(): Promise<OllamaStatus> {
  const response = await fetch(`${BASE_URL}/api/system/ollama`);
  if (!response.ok) {
    return { connected: false, error: '연결 확인 실패' };
  }
  return response.json() as Promise<OllamaStatus>;
}
