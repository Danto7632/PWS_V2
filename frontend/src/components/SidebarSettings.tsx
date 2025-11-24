import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import type {
  ManualStats,
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
  onManualUpload: (files: File[], embedRatio: number) => Promise<void>;
  uploading: boolean;
  manualStats: ManualStats | null;
  providerConfig: ProviderConfig;
  onProviderConfigChange: (config: ProviderConfig) => void;
  embedRatio: number;
  onEmbedRatioChange: (value: number) => void;
  stats: StatsSnapshot;
  ollamaStatus: OllamaStatus | null;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  conversationLoading: boolean;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: (title?: string) => Promise<void>;
  onRenameConversation: (conversationId: string, title: string) => Promise<void>;
  onDeleteConversation: (conversationId: string) => Promise<void>;
};

export function SidebarSettings({
  onManualUpload,
  uploading,
  manualStats,
  providerConfig,
  onProviderConfigChange,
  embedRatio,
  onEmbedRatioChange,
  stats,
  ollamaStatus,
  conversations,
  activeConversationId,
  conversationLoading,
  onSelectConversation,
  onCreateConversation,
  onRenameConversation,
  onDeleteConversation,
}: Props) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [conversationActionLoading, setConversationActionLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) {
      setSelectedFiles([]);
      return;
    }
    setSelectedFiles(Array.from(files));
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (uploading) return;
    const files = Array.from(event.dataTransfer.files);
    if (!files.length) return;
    setSelectedFiles(files);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

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

  const resetSelection = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!selectedFiles.length) {
      setError('업로드할 파일을 선택해주세요.');
      return;
    }
    try {
      await onManualUpload(selectedFiles, embedRatio);
      resetSelection();
      (event.target as HTMLFormElement).reset();
    } catch (err) {
      setError((err as Error).message);
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

  return (
    <aside className="sidebar">
      <div className="sidebar-section conversation-section">
        <div className="conversation-header">
          <h2>💬 대화 목록</h2>
          <button
            type="button"
            className="ghost-btn"
            onClick={handleCreateConversation}
            disabled={conversationLoading || conversationActionLoading}
          >
            ➕ 새 대화
          </button>
        </div>
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
      </div>

      <div className="sidebar-section">
        <h2>📚 업무 매뉴얼 업로드</h2>
        <form onSubmit={handleSubmit} className="upload-form">
          <label
            className="file-dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.xls,.xlsx"
              onChange={handleFileChange}
              disabled={uploading}
              className="sr-only"
            />
            <div className="file-dropzone__body">
              <p>Drag and drop files here</p>
              <span>Limit 200MB per file · PDF, TXT, Excel</span>
              <button
                type="button"
                className="file-browse-btn"
                onClick={(event) => {
                  event.preventDefault();
                  openFilePicker();
                }}
                disabled={uploading}
              >
                Browse files
              </button>
            </div>
          </label>
          {selectedFiles.length > 0 && (
            <ul className="selected-files">
              {selectedFiles.map((file) => (
                <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>
              ))}
            </ul>
          )}
          <label className="slider-label">
            임베딩 학습 수준: {Math.round(embedRatio * 100)}%
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.1}
              value={embedRatio}
              onChange={(event) => onEmbedRatioChange(Number(event.target.value))}
              disabled={uploading}
            />
          </label>
          <button type="submit" className="primary-btn" disabled={uploading}>
            {uploading ? '학습 중...' : '매뉴얼 학습 시작'}
          </button>
          {error && <p className="error-text">{error}</p>}
          {manualStats && (
            <div className="manual-summary">
              <p>파일: {manualStats.fileCount}개</p>
              <p>생성된 청크: {manualStats.chunkCount}개</p>
              <p>임베딩 적용: {manualStats.embeddedChunks}개</p>
            </div>
          )}
        </form>
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
