import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import './App.css';
import type {
  ManualStats,
  ProviderConfig,
  Role,
  ChatMessage,
  Evaluation,
  Scenario,
  StatsSnapshot,
  OllamaStatus,
  ConversationSummary,
} from './types';
import { SidebarSettings } from './components/SidebarSettings';
import { RoleCard } from './components/RoleCard';
import { ChatWindow } from './components/ChatWindow';
import { EvaluationPanel } from './components/EvaluationPanel';
import {
  uploadManuals,
  generateScenario,
  respondAsCustomer,
  respondAsEmployee,
  fetchOllamaStatus,
  fetchConversations,
  createConversation,
  renameConversation,
  deleteConversation,
  fetchConversationMessages,
  fetchManualStatus,
} from './services/api';
import { AuthPanel } from './components/AuthPanel';
import { ManualWorkspace } from './components/ManualWorkspace';
import { useAuth } from './context/AuthContext';

const DEFAULT_PROVIDER: ProviderConfig = {
  provider: 'ollama',
  model: 'exaone3.5:2.4b-jetson',
};

const PROVIDER_LABELS: Record<ProviderConfig['provider'], string> = {
  ollama: '로컬 (Ollama)',
  openai: 'OpenAI GPT',
  gemini: 'Google Gemini',
};

const OPENAI_MODELS = ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o'];
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro'];
const OLLAMA_DEFAULT_MODELS = ['exaone3.5:2.4b-jetson', 'llama3.2', 'gemma2'];

const INITIAL_STATS: StatsSnapshot = {
  totalSimulations: 0,
  customerRoleCount: 0,
  employeeRoleCount: 0,
  totalScore: 0,
};

const PROMPT_SUGGESTIONS = [
  {
    title: '고객 불만 응대',
    description: '감정 완화용 스크립트를 추천받으세요.',
  },
  {
    title: '상품 업셀링 멘트',
    description: '친절한 보조 상품 제안법을 연습해보세요.',
  },
  {
    title: 'CS FAQ 작성',
    description: '반복 질문을 자동화할 답변을 만들어보세요.',
  },
];

const sortConversationsByUpdated = (items: ConversationSummary[]) =>
  [...items].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

const GUEST_STORAGE_KEY = 'pws_guest_session_v1';

type GuestSessionSnapshot = {
  conversationId: string;
  messages: ChatMessage[];
  manualStats: ManualStats | null;
  role: Role | null;
};

const createGuestSnapshot = (): GuestSessionSnapshot => ({
  conversationId: crypto.randomUUID(),
  messages: [],
  manualStats: null,
  role: null,
});

const readGuestSnapshot = (): GuestSessionSnapshot => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createGuestSnapshot();
  }
  const raw = window.localStorage.getItem(GUEST_STORAGE_KEY);
  if (!raw) {
    const fallback = createGuestSnapshot();
    window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<GuestSessionSnapshot>;
    return {
      conversationId: parsed.conversationId ?? crypto.randomUUID(),
      messages: Array.isArray(parsed.messages) ? (parsed.messages as ChatMessage[]) : [],
      manualStats: parsed.manualStats ?? null,
      role: (parsed.role as Role | null | undefined) ?? null,
    };
  } catch {
    const fallback = createGuestSnapshot();
    window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
};

const writeGuestSnapshot = (snapshot: GuestSessionSnapshot) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(snapshot));
};

function App() {
  const { user, isAuthenticated, logout } = useAuth();
  const initialGuestSnapshot = useMemo(() => readGuestSnapshot(), []);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [manualStats, setManualStats] = useState<ManualStats | null>(
    initialGuestSnapshot.manualStats ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>(DEFAULT_PROVIDER);
  const [embedRatio, setEmbedRatio] = useState(1);
  const [role, setRole] = useState<Role | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialGuestSnapshot.messages ?? [],
  );
  const typingTimers = useRef<Map<string, number>>(new Map());
  const roleInitRef = useRef(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [stats, setStats] = useState<StatsSnapshot>(INITIAL_STATS);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guestConversationId, setGuestConversationId] = useState(
    initialGuestSnapshot.conversationId,
  );
  const [conversationRoleMap, setConversationRoleMap] = useState<Record<string, Role>>(
    initialGuestSnapshot.role
      ? { [initialGuestSnapshot.conversationId]: initialGuestSnapshot.role }
      : {},
  );
  const isGuestMode = !isAuthenticated;
  const sessionConversationId = isGuestMode ? guestConversationId : activeConversationId;
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const guestRememberedRole = guestConversationId
    ? conversationRoleMap[guestConversationId] ?? null
    : null;
  const manualStatusSessionRef = useRef<string | null>(sessionConversationId);
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

  useEffect(() => {
    if (isAuthenticated) {
      setShowAuthPanel(false);
      setRole(null);
      setManualStats(null);
      setMessages([]);
      setScenario(null);
      setEvaluation(null);
      setMessagesLoading(false);
      setConversationRoleMap({});
      return;
    }
    const snapshot = readGuestSnapshot();
    setRole(null);
    setConversations([]);
    setActiveConversationId(null);
    setConversationLoading(false);
    setManualStats(snapshot.manualStats ?? null);
    setMessages(snapshot.messages ?? []);
    setScenario(null);
    setEvaluation(null);
    setMessagesLoading(false);
    setGuestConversationId(snapshot.conversationId);
    setConversationRoleMap(
      snapshot.role ? { [snapshot.conversationId]: snapshot.role } : {},
    );
  }, [isAuthenticated]);

  useEffect(() => {
    fetchOllamaStatus()
      .then(setOllamaStatus)
      .catch(() => setOllamaStatus({ connected: false, error: '연결 실패' }));
  }, []);

  useEffect(() => {
    if (!isGuestMode) {
      return;
    }
    writeGuestSnapshot({
      conversationId: guestConversationId,
      messages,
      manualStats,
      role: guestRememberedRole,
    });
  }, [isGuestMode, guestConversationId, messages, manualStats, guestRememberedRole]);

  const handleRequestAuth = useCallback(() => {
    setShowAuthPanel(true);
  }, []);

  const handleCloseAuthPanel = useCallback(() => {
    setShowAuthPanel(false);
  }, []);

  const handleProviderChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const provider = event.target.value as ProviderConfig['provider'];
      const nextModels = (() => {
        if (provider === 'openai') return OPENAI_MODELS;
        if (provider === 'gemini') return GEMINI_MODELS;
        return ollamaModels;
      })();
      setProviderConfig((prev) => ({
        ...prev,
        provider,
        model: nextModels[0],
        apiKey: provider === 'ollama' ? undefined : prev.apiKey,
      }));
    },
    [ollamaModels],
  );

  const handleModelChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setProviderConfig((prev) => ({ ...prev, model: value }));
  }, []);

  const handleApiKeyChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setProviderConfig((prev) => ({ ...prev, apiKey: value }));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setConversationLoading(true);
      try {
        const list = await fetchConversations();
        if (cancelled) return;
        if (list.length) {
          setConversations(list);
          setActiveConversationId((current) => {
            if (current && list.some((item) => item.id === current)) {
              return current;
            }
            return list[0].id;
          });
        } else {
          const created = await createConversation();
          if (cancelled) return;
          setConversations([created]);
          setActiveConversationId(created.id);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setConversationLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const timers = typingTimers.current;
    return () => {
      timers.forEach((timer) => window.clearInterval(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !activeConversationId) {
      setMessagesLoading(false);
      return;
    }
    typingTimers.current.forEach((timer) => window.clearInterval(timer));
    typingTimers.current.clear();
    let cancelled = false;
    setMessages([]);
    setRole(null);
    setEvaluation(null);
    setScenario(null);
    setMessagesLoading(true);
    const loadMessages = async () => {
      try {
        const history = await fetchConversationMessages(activeConversationId);
        if (cancelled) return;
        setMessages(
          history.map((message) => ({
            id: message.id,
            role: message.role,
            text: message.content,
            timestamp: message.created_at,
          })),
        );
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setMessagesLoading(false);
        }
      }
    };
    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId, isAuthenticated]);

  useEffect(() => {
    if (!sessionConversationId) {
      setManualStats(null);
      manualStatusSessionRef.current = null;
      roleInitRef.current = false;
      return;
    }
    if (manualStatusSessionRef.current !== sessionConversationId) {
      setManualStats(null);
      roleInitRef.current = false;
    }
    manualStatusSessionRef.current = sessionConversationId;
    let cancelled = false;
    const loadManualStatus = async () => {
      try {
        const stats = await fetchManualStatus(sessionConversationId, { guest: isGuestMode });
        if (!cancelled) {
          setManualStats(stats);
        }
      } catch (err) {
        if (!cancelled && !isGuestMode) {
          setError((err as Error).message);
        }
      }
    };
    void loadManualStatus();
    return () => {
      cancelled = true;
    };
  }, [sessionConversationId, isGuestMode]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const updateMessageText = useCallback((messageId: string, text: string) => {
    setMessages((prev) =>
      prev.map((message) => (message.id === messageId ? { ...message, text } : message)),
    );
  }, []);

  const animateAssistantMessage = useCallback(
    (messageId: string, fullText: string) => {
      if (!fullText) {
        updateMessageText(messageId, '');
        return;
      }
      const existing = typingTimers.current.get(messageId);
      if (existing) {
        window.clearInterval(existing);
      }
      let index = 0;
      const intervalDuration = fullText.length > 120 ? 8 : 18;
      const timer = window.setInterval(() => {
        index += 1;
        updateMessageText(messageId, fullText.slice(0, index));
        if (index >= fullText.length) {
          window.clearInterval(timer);
          typingTimers.current.delete(messageId);
        }
      }, intervalDuration);
      typingTimers.current.set(messageId, timer);
    },
    [updateMessageText],
  );

  const createMessage = useCallback(
    (messageRole: ChatMessage['role'], text: string): ChatMessage => ({
      id: crypto.randomUUID(),
      role: messageRole,
      text,
      timestamp: new Date().toISOString(),
    }),
    [],
  );

  const addAssistantMessage = useCallback(
    (text: string, activeRole: Role) => {
      const assistantRole: Role = activeRole === 'customer' ? 'employee' : 'customer';
      const pendingMessage = createMessage(assistantRole, '');
      appendMessage(pendingMessage);
      animateAssistantMessage(pendingMessage.id, text);
    },
    [animateAssistantMessage, appendMessage, createMessage],
  );

  const touchActiveConversation = useCallback(() => {
    if (!isAuthenticated || !activeConversationId) return;
    const timestamp = new Date().toISOString();
    setConversations((prev) =>
      sortConversationsByUpdated(
        prev.map((item) =>
          item.id === activeConversationId ? { ...item, updated_at: timestamp } : item,
        ),
      ),
    );
  }, [activeConversationId, isAuthenticated]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
  }, []);

  const handleCreateConversation = useCallback(async (title?: string) => {
    const created = await createConversation(title);
    setConversations((prev) => sortConversationsByUpdated([created, ...prev]));
    setActiveConversationId(created.id);
  }, []);

  const handleRenameConversation = useCallback(
    async (conversationId: string, title: string) => {
      const updated = await renameConversation(conversationId, title);
      setConversations((prev) =>
        sortConversationsByUpdated(
          prev.map((item) => (item.id === conversationId ? updated : item)),
        ),
      );
    },
    [],
  );

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      await deleteConversation(conversationId);
      let shouldCreateReplacement = false;
      setConversations((prev) => {
        const nextList = prev.filter((item) => item.id !== conversationId);
        if (!nextList.length) {
          shouldCreateReplacement = true;
        }
        setActiveConversationId((current) => {
          if (current && current !== conversationId && nextList.some((item) => item.id === current)) {
            return current;
          }
          return nextList[0]?.id ?? null;
        });
        return sortConversationsByUpdated(nextList);
      });
      if (shouldCreateReplacement) {
        const created = await createConversation();
        setConversations([created]);
        setActiveConversationId(created.id);
      }
    },
    [],
  );

  const resetSession = useCallback(() => {
    typingTimers.current.forEach((timer) => window.clearInterval(timer));
    typingTimers.current.clear();
    setMessages([]);
    setEvaluation(null);
    setScenario(null);
    setError(null);
  }, []);

  const handleManualUpload = async (
    files: File[],
    ratio: number,
    instructionText?: string,
  ) => {
    const targetConversationId = sessionConversationId;
    if (!targetConversationId) {
      setError('대화를 선택하거나 생성한 후 매뉴얼을 업로드하세요.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const result = await uploadManuals(
        targetConversationId,
        files,
        ratio,
        instructionText,
        { guest: isGuestMode },
      );
      setManualStats(result);
      setRole(null);
      resetSession();
      setConversationRoleMap((prev) => {
        if (!targetConversationId || !(targetConversationId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[targetConversationId];
        return next;
      });
      roleInitRef.current = false;
      if (!isGuestMode) {
        touchActiveConversation();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const ensureManualReady = useCallback(() => {
    if (!manualStats) {
      throw new Error('먼저 업무 매뉴얼을 업로드하세요.');
    }
  }, [manualStats]);

  const startRole = useCallback(
    async (nextRole: Role) => {
      if (!sessionConversationId) {
        setError('대화 세션을 준비하는 중입니다. 잠시 후 다시 시도하세요.');
        return;
      }
      try {
        ensureManualReady();
      } catch (err) {
        setError((err as Error).message);
        return;
      }
      setRole(nextRole);
      setConversationRoleMap((prev) =>
        sessionConversationId ? { ...prev, [sessionConversationId]: nextRole } : prev,
      );
      resetSession();
      setStats((prev) => ({
        ...prev,
        customerRoleCount: nextRole === 'customer' ? prev.customerRoleCount + 1 : prev.customerRoleCount,
        employeeRoleCount: nextRole === 'employee' ? prev.employeeRoleCount + 1 : prev.employeeRoleCount,
      }));

      if (nextRole === 'employee') {
        setLoadingResponse(true);
        try {
          const scenarioData = await generateScenario(
            sessionConversationId,
            providerConfig,
            { guest: isGuestMode },
          );
          setScenario(scenarioData);
          addAssistantMessage(scenarioData.firstMessage, nextRole);
          if (!isGuestMode) {
            touchActiveConversation();
          }
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setLoadingResponse(false);
        }
      }
    },
    [
      sessionConversationId,
      ensureManualReady,
      resetSession,
      addAssistantMessage,
      isGuestMode,
      providerConfig,
      touchActiveConversation,
    ],
  );

  const handleSendMessage = async (text: string) => {
    if (!role || !text.trim() || !sessionConversationId) return;
    setError(null);
    const userMessage = createMessage(role, text);
    appendMessage(userMessage);
    setLoadingResponse(true);

    try {
      if (role === 'customer') {
        const response = await respondAsCustomer(
          sessionConversationId,
          text,
          providerConfig,
          { guest: isGuestMode },
        );
        addAssistantMessage(response.aiResponse, role);
      } else {
        const response = await respondAsEmployee(
          sessionConversationId,
          text,
          providerConfig,
          { guest: isGuestMode },
        );
        setEvaluation(response.evaluation);
        setScenario(response.nextScenario);
        if (response.nextCustomerMessage) {
          addAssistantMessage(response.nextCustomerMessage, role);
        }
        setStats((prev) => ({
          ...prev,
          totalSimulations: prev.totalSimulations + 1,
          totalScore: prev.totalScore + response.evaluation.score,
        }));
      }
      if (!isGuestMode) {
        touchActiveConversation();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingResponse(false);
    }
  };

  useEffect(() => {
    if (!manualStats || !sessionConversationId) {
      roleInitRef.current = false;
      return;
    }
    if (role) {
      roleInitRef.current = true;
      return;
    }
    if (roleInitRef.current) {
      return;
    }
    roleInitRef.current = true;
    void startRole('employee');
  }, [manualStats, sessionConversationId, role, startRole]);

  const displayRole = role ?? (sessionConversationId ? conversationRoleMap[sessionConversationId] ?? null : null);

  const handleReset = () => {
    setRole(null);
    resetSession();
  };

  const handleToggleRole = () => {
    if (!manualStats || loadingResponse) return;
    const currentRole = displayRole;
    if (!currentRole) return;
    const nextRole: Role = currentRole === 'customer' ? 'employee' : 'customer';
    void startRole(nextRole);
  };

  const canStart = Boolean(manualStats) && !uploading;
  const manualWorkspaceDisabled = !sessionConversationId || conversationLoading;
  const showSimulationPanel = Boolean(manualStats || messages.length);
  const showEvaluationPanel = role === 'employee';
  const simulationGridClass = showEvaluationPanel ? 'simulation-grid' : 'simulation-grid single-column';

  const currentScenarioDetails = useMemo(() => {
    if (role !== 'employee' || !scenario) return null;
    return (
      <div className="scenario-strip">
        <p>
          <strong>상황:</strong> {scenario.situation}
        </p>
        <p>
          <strong>고객 유형:</strong> {scenario.customerType}
        </p>
        <p>
          <strong>고객 첫 말:</strong> {scenario.firstMessage}
        </p>
      </div>
    );
  }, [role, scenario]);

  return (
    <>
      {showAuthPanel && (
        <div
          className="auth-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={handleCloseAuthPanel}
        >
          <div
            className="auth-modal"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <AuthPanel onClose={handleCloseAuthPanel} />
          </div>
        </div>
      )}
      <div className="app-shell">
      <SidebarSettings
        conversations={conversations}
        activeConversationId={activeConversationId}
        conversationLoading={conversationLoading}
        onSelectConversation={handleSelectConversation}
        onCreateConversation={handleCreateConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
          isGuestMode={isGuestMode}
          onRequestAuth={handleRequestAuth}
      />
      <main className="main-panel">
        <div className="auth-topbar">
            <div className={`user-chip ${isGuestMode ? 'guest' : ''}`}>
              <span className="user-avatar">
                {((isGuestMode ? 'G' : user?.displayName?.slice(0, 1)) ?? 'U').toUpperCase()}
              </span>
            <div>
                <strong>{isGuestMode ? '게스트 모드' : user?.displayName}</strong>
                <p>
                  {isGuestMode
                    ? '로그인 시 대화와 업로드 내역이 저장됩니다.'
                    : user?.email}
                </p>
            </div>
          </div>
            <div className="topbar-actions">
              {isGuestMode ? (
                <button type="button" className="primary-outline-btn" onClick={handleRequestAuth}>
                  🔐 로그인 / 회원가입
                </button>
              ) : (
                <button type="button" className="ghost-btn" onClick={logout}>
                  🔓 로그아웃
                </button>
              )}
            </div>
        </div>
        <header className="hero hero-gpt">
          <div className="hero-heading">
            <span className="hero-badge subtle">ChatGPT 5.1 Thinking Inspired</span>
            <h1>무엇을 도와드릴까요?</h1>
            <p>업무 매뉴얼을 불러오고 역할별 대화를 바로 시작해보세요.</p>
          </div>
          <div className="prompt-shell">
            <span>무엇이든 물어보세요</span>
            <div className="prompt-controls">
              <select value={providerConfig.provider} onChange={handleProviderChange}>
                {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select value={providerConfig.model} onChange={handleModelChange}>
                {providerModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              {providerConfig.provider !== 'ollama' && (
                <input
                  type="password"
                  placeholder="API Key"
                  value={providerConfig.apiKey ?? ''}
                  onChange={handleApiKeyChange}
                />
              )}
            </div>
          </div>
          <div className="prompt-chips">
            {PROMPT_SUGGESTIONS.map((item) => (
              <button type="button" key={item.title} className="prompt-chip">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
          <div className="hero-membership">
            <div>
              <span className="hero-label">워크스페이스 상태</span>
              <strong>{isGuestMode ? '게스트 · 임시 저장' : '직원 워크스페이스'}</strong>
              <p>
                {isGuestMode
                  ? '로그인하면 모든 대화와 파일이 안전하게 보관됩니다.'
                  : `${user?.email ?? '연결된 계정'} · 매뉴얼과 대화가 동기화됩니다.`}
              </p>
            </div>
            <button
              type="button"
              className="ghost-btn"
              onClick={isGuestMode ? handleRequestAuth : undefined}
              disabled={!isGuestMode}
            >
              {isGuestMode ? '로그인하고 동기화' : '연결됨'}
            </button>
          </div>
          <p className="hero-storage">
            {isGuestMode
              ? '게스트 모드는 이 브라우저에만 기록이 저장됩니다.'
              : '로그인 상태에서는 모든 대화와 매뉴얼이 안전하게 DB에 저장됩니다.'}
          </p>
        </header>

        {isGuestMode && (
          <div className="guest-banner">
            <span>현재 게스트 모드입니다. 페이지를 새로고침하면 대화와 업로드한 파일이 초기화됩니다.</span>
            <button type="button" className="link-btn" onClick={handleRequestAuth}>
              로그인하고 저장하기
            </button>
          </div>
        )}

        {error && <div className="error-banner">{error}</div>}

        <section className="home-grid">
          <ManualWorkspace
            manualStats={manualStats}
            uploading={uploading}
            embedRatio={embedRatio}
            onEmbedRatioChange={setEmbedRatio}
            onUpload={handleManualUpload}
            disabled={manualWorkspaceDisabled}
            isGuestMode={isGuestMode}
            onRequestAuth={isGuestMode ? handleRequestAuth : undefined}
          />
          <div className="home-side-panel">
            <article className="home-panel-card">
              <div className="home-panel-header">
                <div>
                  <h3>역할 시뮬레이션</h3>
                  <p>업로드한 자료를 바탕으로 고객/직원 역할을 연습하세요.</p>
                </div>
                <span className={`status-pill ${manualStats ? 'ready' : 'idle'}`}>
                  {manualStats ? 'Ready' : '자료 필요'}
                </span>
              </div>
              {manualStats ? (
                <div className="roles-list">
                  <RoleCard
                    label="👤 고객 역할"
                    description="AI 직원에게 문의하며 고객 시선을 체험합니다."
                    icon="🧑"
                    onClick={() => startRole('customer')}
                    disabled={!canStart}
                  />
                  <RoleCard
                    label="👔 직원 역할"
                    description="AI 고객 문의에 응답하며 실전 감각을 키워보세요."
                    icon="💼"
                    onClick={() => startRole('employee')}
                    disabled={!canStart}
                  />
                </div>
              ) : (
                <div className="home-placeholder">
                  <p>왼쪽에서 매뉴얼을 업로드하면 역할 모드를 바로 실행할 수 있어요.</p>
                </div>
              )}
            </article>
            <article className="home-panel-card stats-panel">
              <div className="home-panel-header">
                <div>
                  <h3>진행 현황</h3>
                  <p>연습 기록이 누적될수록 개인화가 정교해집니다.</p>
                </div>
              </div>
              <div className="mini-stats-grid">
                <div>
                  <span>총 시뮬레이션</span>
                  <strong>{stats.totalSimulations}</strong>
                </div>
                <div>
                  <span>고객 역할</span>
                  <strong>{stats.customerRoleCount}</strong>
                </div>
                <div>
                  <span>직원 역할</span>
                  <strong>{stats.employeeRoleCount}</strong>
                </div>
                <div>
                  <span>평균 점수</span>
                  <strong>
                    {stats.totalSimulations
                      ? `${Math.round((stats.totalScore / stats.totalSimulations) * 10) / 10}/15`
                      : '-'}
                  </strong>
                </div>
              </div>
            </article>
          </div>
        </section>

        {showSimulationPanel && (
          <section className="simulation-section">
            <div className="section-header">
              <div className="section-title">
                {displayRole ? (
                  <span className={`role-pill ${displayRole}`}>
                    {displayRole === 'customer' ? '고객 모드' : '직원 모드'}
                  </span>
                ) : (
                  <span className="role-pill neutral">대화 기록</span>
                )}
                <button
                  type="button"
                  className={`role-toggle ${displayRole ?? 'neutral'}`}
                  onClick={handleToggleRole}
                  disabled={!manualStats || loadingResponse || !displayRole}
                >
                  <span className={`toggle-icon ${displayRole === 'customer' ? 'flipped' : ''}`}>
                    ↺
                  </span>
                  <span>
                    {displayRole
                      ? displayRole === 'customer'
                        ? '직원 모드로 전환'
                        : '고객 모드로 전환'
                      : '역할 선택 필요'}
                  </span>
                </button>
              </div>
              <div className="section-actions">
                {role === 'employee' && (
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={loadingResponse}
                    onClick={() => startRole('employee')}
                  >
                    🔄 새 시나리오
                  </button>
                )}
                {role && (
                  <button type="button" className="ghost-btn" onClick={handleReset}>
                    ❌ 시뮬레이션 종료
                  </button>
                )}
              </div>
            </div>

            {!displayRole && (
              <p className="section-subtext">역할을 선택하면 새 메시지를 보낼 수 있어요.</p>
            )}

            {currentScenarioDetails}

            <div className={simulationGridClass}>
              <ChatWindow
                activeRole={displayRole}
                messages={messages}
                onSend={handleSendMessage}
                disabled={!manualStats || messagesLoading || !role}
                loading={loadingResponse}
              />
              {showEvaluationPanel && <EvaluationPanel evaluation={evaluation} />}
            </div>
          </section>
        )}
        </main>
      </div>
    </>
  );
}

export default App;
