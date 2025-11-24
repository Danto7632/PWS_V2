import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import type {
  ProviderConfig,
  StatsSnapshot,
  OllamaStatus,
  ConversationSummary,
} from '../types';

const PROVIDER_LABELS = {
  ollama: '로컬 (Ollama)',
  openai: 'OpenAI GPT',
  gemini: 'Google Gemini',
};

const OLLAMA_DEFAULT_MODELS = [
  'exaone3.5:2.4b-jetson',
  'llama3.2',
  'gemma2',
];

const OPENAI_MODELS = ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o'];
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

type Props = {
  providerConfig: ProviderConfig;
  onProviderConfigChange: (config: ProviderConfig) => void;
  stats: StatsSnapshot;
  ollamaStatus: OllamaStatus | null;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  conversationLoading: boolean;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: (title?: string) => Promise<void>;
  onRenameConversation: (conversationId: string, title: string) => Promise<void>;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  isGuestMode: boolean;
  onRequestAuth?: () => void;
};

export function SidebarSettings({
  providerConfig,
  onProviderConfigChange,
  stats,
  ollamaStatus,
  conversations,
  activeConversationId,
  conversationLoading,
  onSelectConversation,
  onCreateConversation,
  onRenameConversation,
  onDeleteConversation,
  isGuestMode,
  onRequestAuth,
}: Props) {
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [conversationActionLoading, setConversationActionLoading] = useState(false);

  const ollamaModels = useMemo(() => {
    if (ollamaStatus?.connected && ollamaStatus.models?.length) {
      return ollamaStatus.models;
    }
    return OLLAMA_DEFAULT_MODELS;
  }, [ollamaStatus]);

  const providerModels = useMemo(() => {
    switch (providerConfig.provider) {
      case 'openai':
        return OPENAI_MODELS;
      case 'gemini':
        return GEMINI_MODELS;
      default:
        return ollamaModels;
    }
  }, [providerConfig.provider, ollamaModels]);

  const handleConversationError = (err: unknown) => {
    setConversationError((err as Error).message ?? '대화 작업 중 오류가 발생했습니다.');
  };

  const handleCreateConversation = async () => {
    const title = window.prompt('새 대화 제목을 입력하세요', '새 시뮬레이션');
    if (title === null) return;
    setConversationError(null);
    setConversationActionLoading(true);
    try {
      await onCreateConversation(title.trim() || undefined);
    } catch (err) {
      handleConversationError(err);
    } finally {
      setConversationActionLoading(false);
    }
  };

  const handleRenameConversation = async (
    conversationId: string,
    currentTitle: string,
  ) => {
    const title = window.prompt('새 제목을 입력하세요', currentTitle);
    if (title === null || title.trim() === currentTitle.trim()) return;
    setConversationError(null);
    setConversationActionLoading(true);
    try {
      await onRenameConversation(conversationId, title.trim() || currentTitle);
    } catch (err) {
      handleConversationError(err);
    } finally {
      setConversationActionLoading(false);
    }
  };

  const handleDeleteConversation = async (conversationId: string, title: string) => {
    const confirmed = window.confirm(`'${title}' 대화를 삭제하시겠습니까?`);
    if (!confirmed) return;
    setConversationError(null);
    setConversationActionLoading(true);
    try {
      await onDeleteConversation(conversationId);
    } catch (err) {
      handleConversationError(err);
    } finally {
      setConversationActionLoading(false);
    }
  };

  const handleProviderChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const provider = event.target.value as ProviderConfig['provider'];
    const nextModels = (() => {
      if (provider === 'openai') return OPENAI_MODELS;
      if (provider === 'gemini') return GEMINI_MODELS;
      return ollamaModels;
    })();
    onProviderConfigChange({
      ...providerConfig,
      provider,
      model: nextModels[0],
      apiKey: provider === 'ollama' ? undefined : providerConfig.apiKey,
    });
  };

  const handleModelChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onProviderConfigChange({ ...providerConfig, model: event.target.value });
  };

  const handleApiKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    onProviderConfigChange({ ...providerConfig, apiKey: event.target.value });
  };

  const renderConversationSection = () => {
    if (isGuestMode) {
      return (
        <div className="guest-conversation-placeholder">
          <p>게스트 모드에서는 대화와 업로드 이력이 저장되지 않습니다.</p>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => onRequestAuth?.()}
          >
            🔐 로그인하고 저장하기
          </button>
        </div>
      );
    }
    return (
      <>
        <div className="conversation-list">
          {conversationLoading && !conversations.length ? (
            <p className="conversation-placeholder">대화를 불러오는 중...</p>
          ) : conversations.length ? (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={`conversation-item ${
                  conversation.id === activeConversationId ? 'active' : ''
                }`}
                onClick={() => onSelectConversation(conversation.id)}
                disabled={conversationActionLoading}
              >
                <div>
                  <strong>{conversation.title}</strong>
                  <span>
                    {new Date(conversation.updated_at).toLocaleString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="conversation-actions">
                  <button
                    type="button"
                    className="text-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRenameConversation(conversation.id, conversation.title);
                    }}
                    disabled={conversationActionLoading}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteConversation(conversation.id, conversation.title);
                    }}
                    disabled={conversationActionLoading}
                  >
                    🗑️
                  </button>
                </div>
              </button>
            ))
          ) : (
            <p className="conversation-placeholder">아직 생성된 대화가 없습니다.</p>
          )}
        </div>
        {conversationError && <p className="error-text">{conversationError}</p>}
      </>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-section conversation-section">
        <div className="conversation-header">
          <h2>💬 대화 목록</h2>
          {!isGuestMode && (
            <button
              type="button"
              className="ghost-btn"
              onClick={handleCreateConversation}
              disabled={conversationLoading || conversationActionLoading}
            >
              ➕ 새 대화
            </button>
          )}
        </div>
        {renderConversationSection()}
      </div>

      <div className="sidebar-section">
        <h2>⚙️ AI 설정</h2>
        <label className="select-label">
          공급자
          <select value={providerConfig.provider} onChange={handleProviderChange}>
            {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="select-label">
          모델
          <select value={providerConfig.model} onChange={handleModelChange}>
            {providerModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
        {providerConfig.provider !== 'ollama' && (
          <label className="select-label">
            API Key
            <input
              type="password"
              placeholder="API Key 입력"
              value={providerConfig.apiKey ?? ''}
              onChange={handleApiKeyChange}
            />
          </label>
        )}
        {ollamaStatus && (
          <div className={`ollama-status ${ollamaStatus.connected ? 'ok' : 'warn'}`}>
            {ollamaStatus.connected ? '✅ Ollama 연결됨' : '⚠️ Ollama 연결 실패'}
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <h2>📊 학습 통계</h2>
        <div className="stats-grid">
          <div className="stats-card">
            <span>총 시뮬레이션</span>
            <strong>{stats.totalSimulations}</strong>
          </div>
          <div className="stats-card">
            <span>고객 역할</span>
            <strong>{stats.customerRoleCount}</strong>
          </div>
          <div className="stats-card">
            <span>직원 역할</span>
            <strong>{stats.employeeRoleCount}</strong>
          </div>
          <div className="stats-card">
            <span>평균 점수</span>
            <strong>
              {stats.totalSimulations
                ? `${Math.round((stats.totalScore / stats.totalSimulations) * 10) / 10}/15`
                : ' - '}
            </strong>
          </div>
        </div>
      </div>
    </aside>
  );
}
