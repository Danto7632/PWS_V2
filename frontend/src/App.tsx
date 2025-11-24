import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from './services/api';
import { AuthPanel } from './components/AuthPanel';
import { useAuth } from './context/AuthContext';

const DEFAULT_PROVIDER: ProviderConfig = {
  provider: 'ollama',
  model: 'exaone3.5:2.4b-jetson',
};

const INITIAL_STATS: StatsSnapshot = {
  totalSimulations: 0,
  customerRoleCount: 0,
  employeeRoleCount: 0,
  totalScore: 0,
};

const GUIDE_STEPS = [
  {
    title: '1단계: 업무 매뉴얼 업로드',
    description: '왼쪽 패널에서 업무 매뉴얼 파일을 업로드하면 맞춤 시뮬레이션이 시작됩니다.',
    details: [
      '지원 형식: PDF, TXT, Excel',
      '예시: 고객 응대 매뉴얼, FAQ, 서비스 안내서',
    ],
  },
  {
    title: '2단계: 역할 선택',
    description: '고객 또는 직원 역할을 선택하고 각 입장에서 상황을 체험하세요.',
    details: [
      '고객 역할: AI 직원과 대화하며 고객 시선을 경험',
      '직원 역할: AI 고객의 문의에 응답하며 실전 감각 강화',
    ],
  },
  {
    title: '3단계: 실전 연습',
    description: '시나리오별 대화와 피드백으로 바로 개선점을 확인합니다.',
    details: [
      'AI의 즉각 피드백으로 응대 품질을 정량 평가',
      '반복 학습으로 자신감과 해결력 강화',
    ],
  },
];

const sortConversationsByUpdated = (items: ConversationSummary[]) =>
  [...items].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

function App() {
  const { user, isAuthenticated, logout } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [manualStats, setManualStats] = useState<ManualStats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>(DEFAULT_PROVIDER);
  const [embedRatio, setEmbedRatio] = useState(1);
  const [role, setRole] = useState<Role | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const typingTimers = useRef<Map<string, number>>(new Map());
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [stats, setStats] = useState<StatsSnapshot>(INITIAL_STATS);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guestConversationId, setGuestConversationId] = useState(() => crypto.randomUUID());
  const isGuestMode = !isAuthenticated;
  const sessionConversationId = isGuestMode ? guestConversationId : activeConversationId;
  const [showAuthPanel, setShowAuthPanel] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setConversations([]);
      setActiveConversationId(null);
      setConversationLoading(false);
      setManualStats(null);
      setMessages([]);
      setScenario(null);
      setEvaluation(null);
      setMessagesLoading(false);
      setGuestConversationId(crypto.randomUUID());
    } else {
      setShowAuthPanel(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchOllamaStatus()
      .then(setOllamaStatus)
      .catch(() => setOllamaStatus({ connected: false, error: '연결 실패' }));
  }, []);

  const handleRequestAuth = useCallback(() => {
    setShowAuthPanel(true);
  }, []);

  const handleCloseAuthPanel = useCallback(() => {
    setShowAuthPanel(false);
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
    setManualStats(null);
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
    setMessages([]);
    setEvaluation(null);
    setScenario(null);
    setError(null);
  }, []);

  const handleManualUpload = async (files: File[], ratio: number) => {
    const targetConversationId = sessionConversationId;
    if (!targetConversationId) {
      setError('대화를 선택하거나 생성한 후 매뉴얼을 업로드하세요.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const result = await uploadManuals(targetConversationId, files, ratio, undefined, {
        guest: isGuestMode,
      });
      setManualStats(result);
      setRole(null);
      resetSession();
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

  const startRole = async (nextRole: Role) => {
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
  };

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

  const handleReset = () => {
    setRole(null);
    resetSession();
  };

  const canStart = Boolean(manualStats) && !uploading;

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
        onManualUpload={handleManualUpload}
        uploading={uploading}
        manualStats={manualStats}
        providerConfig={providerConfig}
        onProviderConfigChange={setProviderConfig}
        embedRatio={embedRatio}
        onEmbedRatioChange={setEmbedRatio}
        stats={stats}
        ollamaStatus={ollamaStatus}
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
        <header className="hero">
          <span className="hero-badge">🚀 AI 기반 고객 응대 실전 연습</span>
          <h1>🍑 실전형 업무 시뮬레이터 for 신입</h1>
          <p>업무 매뉴얼을 업로드하고 역할별 시나리오를 반복 연습하며 피드백으로 역량을 높이세요.</p>
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

        {!manualStats && (
          <section className="guide-panel">
            <div className="guide-header">
              <p>신입 직원을 위한 고객 응대 연습 도구</p>
              <h2>시작하기</h2>
            </div>
            <div className="guide-steps">
              {GUIDE_STEPS.map((step, index) => (
                <article className="guide-step" key={step.title}>
                  <div className="guide-step-number">{index + 1}</div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    <ul>
                      {step.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {manualStats && (
          <section className="roles-section">
            <RoleCard
              label="👤 고객 역할"
              description="AI 직원에게 문의하며 고객 입장을 체험합니다."
              icon="🧑"
              onClick={() => startRole('customer')}
              disabled={!canStart}
            />
            <RoleCard
              label="👔 직원 역할"
              description="AI 고객의 다양한 질문에 응답하며 실전 연습을 진행합니다."
              icon="💼"
              onClick={() => startRole('employee')}
              disabled={!canStart}
            />
          </section>
        )}

        {role && (
          <section className="simulation-section">
            <div className="section-header">
              <span className={`role-pill ${role}`}>
                {role === 'customer' ? '고객 모드' : '직원 모드'}
              </span>
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
                <button type="button" className="ghost-btn" onClick={handleReset}>
                  ❌ 시뮬레이션 종료
                </button>
              </div>
            </div>

            {currentScenarioDetails}

            <div className="simulation-grid">
              <ChatWindow
                role={role}
                messages={messages}
                onSend={handleSendMessage}
                disabled={!manualStats || messagesLoading}
                loading={loadingResponse}
              />
              {role === 'employee' && <EvaluationPanel evaluation={evaluation} />}
            </div>
          </section>
        )}
        </main>
      </div>
    </>
  );
}

export default App;
