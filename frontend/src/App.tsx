import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import './App.css';
import type {
  ManualStats,
  ProviderConfig,
  Role,
  ChatMessage,
  Evaluation,
  Scenario,
  OllamaStatus,
  ConversationSummary,
} from './types';
import { SidebarSettings } from './components/SidebarSettings';
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
  deleteManualSource,
} from './services/api';
import { AuthPanel } from './components/AuthPanel';
import { ManualWorkspace } from './components/ManualWorkspace';
import { useAuth } from './context/AuthContext';
import { normalizeManualStats } from './utils/manuals';
import { ChatLogo } from './components/ChatLogo';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Card } from './components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';
import { Input } from './components/ui/input';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { BookMarked, Check, ChevronDown, Edit3, Search, TriangleAlert, UserRound } from 'lucide-react';

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
    const normalizedManualStats = normalizeManualStats(
      parsed.manualStats as ManualStats | undefined,
    );
    return {
      conversationId: parsed.conversationId ?? crypto.randomUUID(),
      messages: Array.isArray(parsed.messages) ? (parsed.messages as ChatMessage[]) : [],
      manualStats: normalizedManualStats,
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [manualEditorOpen, setManualEditorOpen] = useState(false);
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

  const changeProvider = useCallback(
    (provider: ProviderConfig['provider']) => {
      const nextModels = (() => {
        if (provider === 'openai') return OPENAI_MODELS;
        if (provider === 'gemini') return GEMINI_MODELS;
        return ollamaModels.length ? ollamaModels : OLLAMA_DEFAULT_MODELS;
      })();
      setProviderConfig((prev) => {
        const fallbackModel = nextModels.includes(prev.model) ? prev.model : nextModels[0];
        return {
          ...prev,
          provider,
          model: fallbackModel,
          apiKey: provider === 'ollama' ? undefined : prev.apiKey,
        };
      });
    },
    [ollamaModels],
  );

  const changeModel = useCallback((model: string) => {
    setProviderConfig((prev) => ({ ...prev, model }));
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

  useEffect(() => {
    if (!manualStats) {
      setManualEditorOpen(false);
    }
  }, [manualStats]);

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
      setManualEditorOpen(false);
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

  const handleCollapsedNewChat = useCallback(() => {
    if (isGuestMode) {
      handleRequestAuth();
      return;
    }
    void handleCreateConversation();
  }, [handleCreateConversation, handleRequestAuth, isGuestMode]);

  const handleCollapsedSearch = useCallback(() => {
    setSidebarOpen(true);
  }, [setSidebarOpen]);

  const handleCollapsedManual = useCallback(() => {
    if (!manualStats) {
      setError('업로드된 매뉴얼이 없습니다. 자료를 추가해 주세요.');
      return;
    }
    setManualEditorOpen(true);
  }, [manualStats, setError, setManualEditorOpen]);

  const handleCollapsedAuth = useCallback(() => {
    if (isGuestMode) {
      handleRequestAuth();
      return;
    }
    logout();
  }, [handleRequestAuth, isGuestMode, logout]);

  const handleRemoveManualSource = useCallback(
    async (sourceId: string) => {
      const targetConversationId = sessionConversationId;
      if (!targetConversationId) {
        const err = new Error('대화를 선택하거나 생성한 후 자료를 삭제하세요.');
        setError(err.message);
        throw err;
      }
      try {
        const stats = await deleteManualSource(targetConversationId, sourceId, {
          guest: isGuestMode,
        });
        setManualStats(stats);
        if (!stats) {
          setRole(null);
          resetSession();
        }
        if (!isGuestMode) {
          touchActiveConversation();
        }
      } catch (err) {
        setError((err as Error).message);
        throw err;
      }
    },
    [isGuestMode, resetSession, sessionConversationId, touchActiveConversation],
  );

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

  const handleQuickRoleSelect = useCallback(
    (selected: Role) => {
      if (!manualStats || loadingResponse) return;
      if (displayRole === selected && role === selected) {
        return;
      }
      void startRole(selected);
    },
    [displayRole, loadingResponse, manualStats, role, startRole],
  );

  const manualWorkspaceDisabled = !sessionConversationId || conversationLoading;
  const hasManualData = Boolean(manualStats);
  const showManualInline = !hasManualData;
  const showManualModal = hasManualData && manualEditorOpen;
  const showSimulationPanel = hasManualData;
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

  const collapsedActions = useMemo(
    () => [
      {
        key: 'new',
        icon: <Edit3 className="h-5 w-5" />,
        label: '새 채팅',
        onClick: handleCollapsedNewChat,
        disabled: false,
      },
      {
        key: 'search',
        icon: <Search className="h-5 w-5" />,
        label: '채팅 목록 보기',
        onClick: handleCollapsedSearch,
        disabled: false,
      },
      {
        key: 'library',
        icon: <BookMarked className="h-5 w-5" />,
        label: manualStats ? '자료 관리' : '자료 업로드 필요',
        onClick: handleCollapsedManual,
        disabled: !manualStats,
      },
      {
        key: 'account',
        icon: <UserRound className="h-5 w-5" />,
        label: isGuestMode ? '로그인 / 회원가입' : '계정 설정',
        onClick: handleCollapsedAuth,
        disabled: false,
      },
    ],
    [
      handleCollapsedAuth,
      handleCollapsedManual,
      handleCollapsedNewChat,
      handleCollapsedSearch,
      isGuestMode,
      manualStats,
    ],
  );

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
      <div className={`app-shell${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
        <div className={`sidebar-panel ${sidebarOpen ? 'open' : 'collapsed'}`}>
          {sidebarOpen ? (
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
              userName={user?.displayName ?? undefined}
              userEmail={user?.email ?? undefined}
              onToggleSidebar={() => setSidebarOpen(false)}
            />
          ) : (
            <div className="mini-sidebar" aria-label="사이드바 단축 메뉴">
              <div className="mini-sidebar__logo" aria-label="메인 메뉴">
                <button
                  type="button"
                  className="mini-sidebar__logo-button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="사이드바 열기"
                >
                  <ChatLogo className="chat-logo-icon" />
                </button>
                <button
                  type="button"
                  className="mini-sidebar__flyout"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="사이드바 열기"
                >
                  <span className="sidebar-toggle-icon" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                  <span>사이드바 열기</span>
                </button>
              </div>
              {collapsedActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className="mini-sidebar__btn"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  title={action.label}
                  aria-label={action.label}
                >
                  <span aria-hidden="true" className="mini-sidebar__icon">
                    {action.icon}
                  </span>
                  <span className="sr-only">{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <main className="main-panel">
          <div className="main-surface">
          <header className="main-topbar">
            <div className="topbar-left gpt-topbar">
              <div className="topbar-brand">
                <ChatLogo className="chat-logo-icon" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="topbar-model-btn gap-2"
                      aria-label="모델 선택"
                    >
                      <span className="topbar-model-main">ChatGPT</span>
                      <span className="topbar-model-sub">5.1 Thinking</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={12} className="model-dropdown">
                    <div className="model-dropdown__section">
                      <DropdownMenuLabel className="model-dropdown__label">플랫폼</DropdownMenuLabel>
                      <div className="model-dropdown__list">
                        {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
                          <DropdownMenuItem
                            key={key}
                            onSelect={(event) => {
                              event.preventDefault();
                              changeProvider(key as ProviderConfig['provider']);
                            }}
                            className={`model-option ${
                              providerConfig.provider === key ? 'is-active' : ''
                            }`}
                          >
                            <span>{label}</span>
                            {providerConfig.provider === key && <Check className="h-4 w-4" />}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </div>
                    <div className="model-dropdown__section">
                      <DropdownMenuLabel className="model-dropdown__label">모델</DropdownMenuLabel>
                      <div className="model-dropdown__scroll">
                        {providerModels.map((model) => (
                          <DropdownMenuItem
                            key={model}
                            onSelect={() => changeModel(model)}
                            className={`model-option ${
                              providerConfig.model === model ? 'is-active' : ''
                            }`}
                          >
                            <span>{model}</span>
                            {providerConfig.model === model && <Check className="h-4 w-4" />}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </div>
                    {providerConfig.provider !== 'ollama' && (
                      <div
                        className="model-dropdown__section model-dropdown__section--input"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <label className="model-dropdown__label" htmlFor="provider-api-key">
                          API Key
                        </label>
                        <Input
                          id="provider-api-key"
                          type="password"
                          placeholder="필요 시 입력"
                          value={providerConfig.apiKey ?? ''}
                          onChange={handleApiKeyChange}
                        />
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="topbar-actions">
              {isGuestMode ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full px-5"
                  onClick={handleRequestAuth}
                >
                  🔐 로그인 / 회원가입
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  onClick={logout}
                >
                  🔓 로그아웃
                </Button>
              )}
            </div>
          </header>

          {isGuestMode && (
            <div className="guest-banner">
              <span>현재 게스트 모드입니다. 페이지를 새로고침하면 대화와 업로드한 파일이 초기화됩니다.</span>
              <button type="button" className="link-btn" onClick={handleRequestAuth}>
                로그인하고 저장하기
              </button>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="error-alert">
              <TriangleAlert className="h-5 w-5" />
              <div>
                <AlertTitle>Internal server error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </div>
            </Alert>
          )}

          {showManualInline && (
            <section className="manual-intro" aria-label="매뉴얼 업로드">
              <ManualWorkspace
                manualStats={manualStats}
                uploading={uploading}
                embedRatio={embedRatio}
                onEmbedRatioChange={setEmbedRatio}
                onUpload={handleManualUpload}
                onRemoveSource={handleRemoveManualSource}
                disabled={manualWorkspaceDisabled}
                isGuestMode={isGuestMode}
                onRequestAuth={isGuestMode ? handleRequestAuth : undefined}
              />
            </section>
          )}

          {showSimulationPanel && (
            <>
              <div className="chat-toolbar">
                <div>
                  <Badge variant="secondary" className="chat-toolbar__badge">
                    시뮬레이션
                  </Badge>
                  <strong>시뮬레이션 준비 완료</strong>
                  <span>업로드한 자료를 바탕으로 고객/직원 역할을 전환하며 연습하세요.</span>
                </div>
                <div className="chat-toolbar__actions">
                  <button type="button" className="ghost-btn" onClick={() => setManualEditorOpen(true)}>
                    📚 자료 관리
                  </button>
                </div>
              </div>
              <Card
                className="simulation-section"
                role="region"
                aria-labelledby="simulation-section-title"
              >
                <div className="section-header">
                  <div className="section-title">
                    <Badge
                      variant="secondary"
                      className={`role-badge ${displayRole ?? 'neutral'}`}
                    >
                      {displayRole
                        ? displayRole === 'customer'
                          ? '고객 모드'
                          : '직원 모드'
                        : '대화 기록'}
                    </Badge>
                    <p id="simulation-section-title" className="section-subtitle">
                      업로드한 자료를 바탕으로 고객/직원 역할을 전환하며 연습하세요.
                    </p>
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

                <div className="role-switch" role="group" aria-label="역할 선택">
                  <Button
                    type="button"
                    variant={displayRole === 'employee' ? 'default' : 'outline'}
                    className={`role-switch-btn ${displayRole === 'employee' ? 'is-active' : ''}`}
                    onClick={() => handleQuickRoleSelect('employee')}
                    disabled={!manualStats || loadingResponse}
                  >
                    직원 모드
                  </Button>
                  <Button
                    type="button"
                    variant={displayRole === 'customer' ? 'default' : 'outline'}
                    className={`role-switch-btn ${displayRole === 'customer' ? 'is-active' : ''}`}
                    onClick={() => handleQuickRoleSelect('customer')}
                    disabled={!manualStats || loadingResponse}
                  >
                    {displayRole === 'customer' ? '고객 모드' : '고객 모드 전환'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="role-switch-btn subtle"
                    onClick={handleToggleRole}
                    disabled={!displayRole || loadingResponse}
                  >
                    ↺ 역할 전환
                  </Button>
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
              </Card>
            </>
          )}
          </div>
        </main>
      </div>
      {showManualModal && (
        <div
          className="manual-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setManualEditorOpen(false)}
        >
          <div
            className="manual-modal"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="manual-modal__header">
              <div>
                <h3>자료 관리</h3>
                <p>추가 업로드, 삭제 또는 프롬프트 수정을 진행하세요.</p>
              </div>
              <button type="button" className="ghost-btn" onClick={() => setManualEditorOpen(false)}>
                닫기
              </button>
            </div>
            <ManualWorkspace
              manualStats={manualStats}
              uploading={uploading}
              embedRatio={embedRatio}
              onEmbedRatioChange={setEmbedRatio}
              onUpload={handleManualUpload}
              onRemoveSource={handleRemoveManualSource}
              disabled={manualWorkspaceDisabled}
              isGuestMode={isGuestMode}
              onRequestAuth={isGuestMode ? handleRequestAuth : undefined}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default App;
