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
  ProjectSummary,
} from './types';
import { SidebarSettings } from './components/SidebarSettings';
import { ChatWindow } from './components/ChatWindow';
import { EvaluationPanel } from './components/EvaluationPanel';
import {
  uploadManuals,
  uploadProjectManuals,
  deleteManualSource,
  deleteProjectManualSource,
  generateScenario,
  respondAsCustomer,
  respondAsEmployee,
  fetchOllamaStatus,
  fetchProjects,
  fetchProjectChats,
  fetchConversationMessages,
  fetchProjectManualStatus,
  fetchManualStatus,
  createProject,
  createProjectChat,
  renameProjectChat,
  deleteProjectChat,
} from './services/api';
import { AuthPanel } from './components/AuthPanel';
import { ManualWorkspace } from './components/ManualWorkspace';
import { useAuth } from './context/AuthContext';
import { normalizeManualStats } from './utils/manuals';
import { ChatLogo } from './components/ChatLogo';
import { ProjectSidebar } from './components/projects/ProjectSidebar';
import { NewProjectDialog } from './components/projects/NewProjectDialog';
import { BookMarked, Edit3, FolderOpen, Search, TriangleAlert, UserRound } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';

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

const sortProjectsByUpdated = (items: ProjectSummary[]) =>
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
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
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
  const [projectSidebarCollapsed, setProjectSidebarCollapsed] = useState(false);
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

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  useEffect(() => {
    if (isAuthenticated) {
      setShowAuthPanel(false);
      setRole(null);
      setProjects([]);
      setActiveProjectId(null);
      setProjectDialogOpen(false);
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
    setProjects([]);
    setActiveProjectId(null);
    setProjectDialogOpen(false);
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
    if (!isAuthenticated) {
      return;
    }
    let cancelled = false;
    const loadProjects = async () => {
      setProjectLoading(true);
      try {
        const list = await fetchProjects();
        if (cancelled) return;
        setProjects(list);
        setActiveProjectId((current) => {
          if (current && list.some((project) => project.id === current)) {
            return current;
          }
          return list[0]?.id ?? null;
        });
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setProjectLoading(false);
        }
      }
    };
    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);


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
    if (!isAuthenticated || !activeProjectId) {
      setConversations([]);
      setActiveConversationId(null);
      setConversationLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setConversationLoading(true);
      try {
        const list = await fetchProjectChats(activeProjectId);
        if (cancelled) return;
        setConversations(list);
        setActiveConversationId((current) => {
          if (current && list.some((item) => item.id === current)) {
            return current;
          }
          return list[0]?.id ?? null;
        });
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
  }, [activeProjectId, isAuthenticated]);

  useEffect(() => {
    const timers = typingTimers.current;
    return () => {
      timers.forEach((timer) => window.clearInterval(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !activeConversationId || !activeProjectId) {
      setMessagesLoading(false);
      return;
    }
    const targetConversation = conversations.find((item) => item.id === activeConversationId);
    setRole(targetConversation?.role ?? null);
    typingTimers.current.forEach((timer) => window.clearInterval(timer));
    typingTimers.current.clear();
    let cancelled = false;
    setMessages([]);
    setEvaluation(null);
    setScenario(null);
    setMessagesLoading(true);
    const loadMessages = async () => {
      try {
        const history = await fetchConversationMessages(activeProjectId, activeConversationId);
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
  }, [activeConversationId, activeProjectId, conversations, isAuthenticated]);

  useEffect(() => {
    if (!isGuestMode) {
      manualStatusSessionRef.current = activeProjectId;
      if (!activeProjectId) {
        setManualStats(null);
        return;
      }
      let cancelled = false;
      const loadProjectManual = async () => {
        try {
          const stats = await fetchProjectManualStatus(activeProjectId);
          if (!cancelled) {
            setManualStats(stats);
          }
        } catch (err) {
          if (!cancelled) {
            setError((err as Error).message);
          }
        }
      };
      void loadProjectManual();
      return () => {
        cancelled = true;
      };
    }
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
        if (!cancelled) {
          setError((err as Error).message);
        }
      }
    };
    void loadManualStatus();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, isGuestMode, sessionConversationId]);

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
    if (activeProjectId) {
      setProjects((prev) =>
        sortProjectsByUpdated(
          prev.map((project) =>
            project.id === activeProjectId ? { ...project, updated_at: timestamp } : project,
          ),
        ),
      );
    }
  }, [activeConversationId, activeProjectId, isAuthenticated]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
  }, []);

  const handleSelectProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId);
  }, []);

  const handleCreateProject = useCallback(
    async (payload: {
      name: string;
      description?: string;
      instruction_text?: string;
      category?: string;
    }) => {
      const { category: _category, ...body } = payload;
      try {
        const created = await createProject(body);
        setProjects((prev) => sortProjectsByUpdated([created, ...prev]));
        setActiveProjectId(created.id);
      } catch (err) {
        setError((err as Error).message);
        throw err;
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

  const handleCreateProjectChat = useCallback(
    async (nextRole: Role) => {
      if (!activeProjectId) {
        setError('먼저 프로젝트를 선택하세요.');
        return;
      }
      try {
        const created = await createProjectChat(activeProjectId, { role: nextRole });
        setConversations((prev) => sortConversationsByUpdated([created, ...prev]));
        setActiveConversationId(created.id);
        setRole(created.role);
        resetSession();
        setProjects((prev) =>
          sortProjectsByUpdated(
            prev.map((project) =>
              project.id === activeProjectId
                ? {
                    ...project,
                    chat_count: (project.chat_count ?? 0) + 1,
                    updated_at: created.updated_at,
                  }
                : project,
            ),
          ),
        );
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [activeProjectId, resetSession],
  );

  const handleCreateConversation = useCallback(
    async (_title?: string) => {
      await handleCreateProjectChat('customer');
    },
    [handleCreateProjectChat],
  );

  const handleRenameConversation = useCallback(
    async (conversationId: string, title?: string) => {
      if (!isAuthenticated || !activeProjectId) {
        return;
      }
      const target = conversations.find((item) => item.id === conversationId);
      const fallback = target?.title ?? '새 시뮬레이션';
      const nextTitle = title ?? window.prompt('새 제목을 입력하세요', fallback);
      if (nextTitle === null || nextTitle === undefined) {
        return;
      }
      try {
        const updated = await renameProjectChat(
          activeProjectId,
          conversationId,
          nextTitle.trim() || fallback,
        );
        setConversations((prev) =>
          sortConversationsByUpdated(
            prev.map((item) => (item.id === conversationId ? updated : item)),
          ),
        );
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [activeProjectId, conversations, isAuthenticated],
  );

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      if (!isAuthenticated || !activeProjectId) {
        return;
      }
      const target = conversations.find((item) => item.id === conversationId);
      const confirmed = window.confirm(
        `'${target?.title ?? '채팅'}' 대화를 삭제하시겠습니까?`,
      );
      if (!confirmed) return;
      try {
        await deleteProjectChat(activeProjectId, conversationId);
        setConversations((prev) => {
          const nextList = prev.filter((item) => item.id !== conversationId);
          setActiveConversationId((current) => {
            if (current && current !== conversationId && nextList.some((item) => item.id === current)) {
              return current;
            }
            return nextList[0]?.id ?? null;
          });
          return sortConversationsByUpdated(nextList);
        });
        setProjects((prev) =>
          sortProjectsByUpdated(
            prev.map((project) =>
              project.id === activeProjectId
                ? {
                    ...project,
                    chat_count: Math.max((project.chat_count ?? 1) - 1, 0),
                    updated_at: new Date().toISOString(),
                  }
                : project,
            ),
          ),
        );
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [activeProjectId, conversations, isAuthenticated],
  );

  const handleManualUpload = async (
    files: File[],
    ratio: number,
    instructionText?: string,
  ) => {
    setError(null);
    if (!isGuestMode) {
      if (!activeProjectId) {
        setError('프로젝트를 선택한 뒤 매뉴얼을 업로드하세요.');
        return;
      }
      setUploading(true);
      try {
        const result = await uploadProjectManuals(
          activeProjectId,
          files,
          ratio,
          instructionText,
        );
        setManualStats(result);
        setManualEditorOpen(false);
        resetSession();
        touchActiveConversation();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setUploading(false);
      }
      return;
    }
    const targetConversationId = sessionConversationId;
    if (!targetConversationId) {
      setError('대화를 선택하거나 생성한 후 매뉴얼을 업로드하세요.');
      return;
    }
    setUploading(true);
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
      if (!isGuestMode) {
        if (!activeProjectId) {
          const err = new Error('프로젝트를 선택한 후 자료를 삭제하세요.');
          setError(err.message);
          throw err;
        }
        try {
          const stats = await deleteProjectManualSource(activeProjectId, sourceId);
          setManualStats(stats);
          if (!stats) {
            resetSession();
          }
          touchActiveConversation();
        } catch (err) {
          setError((err as Error).message);
          throw err;
        }
        return;
      }
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
      } catch (err) {
        setError((err as Error).message);
        throw err;
      }
    },
    [
      activeProjectId,
      isGuestMode,
      resetSession,
      sessionConversationId,
      touchActiveConversation,
    ],
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
    if (!isGuestMode) {
      return;
    }
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
  }, [isGuestMode, manualStats, sessionConversationId, role, startRole]);

  const displayRole = role ?? (sessionConversationId ? conversationRoleMap[sessionConversationId] ?? null : null);

  useEffect(() => {
    if (isGuestMode) return;
    if (!manualStats || !sessionConversationId || !displayRole) return;
    if (displayRole !== 'employee') return;
    if (messages.length > 0 || loadingResponse) return;
    roleInitRef.current = true;
    void startRole('employee');
  }, [
    displayRole,
    isGuestMode,
    loadingResponse,
    manualStats,
    messages.length,
    sessionConversationId,
    startRole,
  ]);

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

  const manualWorkspaceDisabled = isGuestMode
    ? !sessionConversationId || conversationLoading
    : !activeProjectId || projectLoading;
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

  const authModal = showAuthPanel ? (
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
  ) : null;

  const manualModal = showManualModal ? (
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
  ) : null;

  if (!isGuestMode) {
    const manualSummary = manualStats ? (
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-gray-900/5 p-3 text-gray-900">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">프로젝트 자료</p>
              <h3 className="text-xl font-semibold text-gray-900">파일 {manualStats.fileCount}개 준비됨</h3>
              <p className="text-sm text-gray-500">
                청크 {manualStats.chunkCount}개 · 임베딩 {manualStats.embeddedChunks}개 · 반영률 {Math.round((manualStats.embedRatio ?? 1) * 100)}%
              </p>
              {manualStats.updatedAt && (
                <p className="text-xs text-gray-400">최근 업데이트 {new Date(manualStats.updatedAt).toLocaleString('ko-KR')}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
              onClick={() => setManualEditorOpen(true)}
            >
              📚 자료 관리
            </button>
            <button
              type="button"
              className="rounded-full border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setManualEditorOpen(true)}
            >
              새 파일 추가
            </button>
          </div>
        </div>
      </section>
    ) : null;

    const conversationList = (
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">대화</p>
            <h3 className="text-2xl font-semibold text-gray-900">최근 진행 중인 채팅</h3>
            <p className="text-sm text-gray-500">프로젝트별 시뮬레이션 기록을 살펴보고 이어서 진행하세요.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
              onClick={() => handleCreateProjectChat('customer')}
            >
              고객 시뮬레이션
            </button>
            <button
              type="button"
              className="rounded-full border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => handleCreateProjectChat('employee')}
            >
              직원 시뮬레이션
            </button>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {conversationLoading ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              채팅을 불러오는 중...
            </div>
          ) : conversations.length ? (
            conversations.map((chat) => {
              const isActive = chat.id === activeConversationId;
              return (
                <button
                  key={chat.id}
                  type="button"
                  className={`w-full rounded-2xl border px-5 py-4 text-left transition ${
                    isActive ? 'border-gray-900 bg-white shadow-sm' : 'border-gray-100 bg-white hover:border-gray-300'
                  }`}
                  onClick={() => handleSelectConversation(chat.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-gray-900">{chat.title}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(chat.updated_at).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      {chat.role === 'customer' ? '고객' : '직원'} 모드
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>시뮬레이션 기록을 이어서 진행</span>
                    <div className="flex gap-2 text-gray-400">
                      <button
                        type="button"
                        className="text-xs hover:text-gray-900"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRenameConversation(chat.id);
                        }}
                      >
                        이름 변경
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        className="text-xs hover:text-red-500"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteConversation(chat.id);
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              아직 채팅이 없습니다. 상단 버튼을 눌러 새 시뮬레이션을 생성하세요.
            </div>
          )}
        </div>
      </section>
    );

    return (
      <>
        {authModal}
        {manualModal}
        <NewProjectDialog
          open={projectDialogOpen}
          onOpenChange={setProjectDialogOpen}
          onSubmit={handleCreateProject}
        />
        <div className="flex h-screen overflow-hidden bg-white">
          <ProjectSidebar
            projects={projects}
            conversations={conversations}
            activeProjectId={activeProjectId}
            activeConversationId={activeConversationId}
            loading={projectLoading}
            collapsed={projectSidebarCollapsed}
            onToggleCollapse={() => setProjectSidebarCollapsed((prev) => !prev)}
            onSelectProject={handleSelectProject}
            onSelectConversation={handleSelectConversation}
            onCreateProject={() => setProjectDialogOpen(true)}
          />
          <div className="flex flex-1 flex-col bg-[#f7f7f8]">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                  <ChatLogo className="h-10 w-10" />
                  <div>
                    <p className="text-xs uppercase text-gray-500">ChatGPT</p>
                    <p className="text-lg font-semibold text-gray-900">5.1 Thinking</p>
                  </div>
                </div>
                <div className="topbar-select-group">
                  <select
                    aria-label="플랫폼 선택"
                    value={providerConfig.provider}
                    onChange={(event) => changeProvider(event.target.value as ProviderConfig['provider'])}
                  >
                    {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="모델 선택"
                    value={providerConfig.model}
                    onChange={(event) => changeModel(event.target.value)}
                  >
                    {providerModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  {providerConfig.provider !== 'ollama' && (
                    <input
                      type="password"
                      className="topbar-api-input"
                      placeholder="API Key"
                      value={providerConfig.apiKey ?? ''}
                      onChange={handleApiKeyChange}
                    />
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
                  onClick={() => setManualEditorOpen(true)}
                >
                  📁 자료 관리
                </button>
                <button
                  type="button"
                  className="rounded-full border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => setProjectDialogOpen(true)}
                >
                  + 새 프로젝트
                </button>
                <div className="flex items-center gap-3 rounded-full border border-gray-100 bg-gray-50 px-4 py-2">
                  <span className="text-sm text-gray-600">{user?.displayName ?? user?.email}</span>
                  <button type="button" className="text-sm font-semibold text-gray-900" onClick={logout}>
                    로그아웃
                  </button>
                </div>
              </div>
            </header>
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-8 py-6">
                {error && (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                    {error}
                  </div>
                )}
                {!activeProject && (
                  <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white/70 p-10 text-center text-gray-500">
                    <p className="text-lg font-semibold text-gray-700">프로젝트를 선택하거나 새로 만들어 시작하세요.</p>
                    <button
                      type="button"
                      className="mt-6 rounded-full border border-gray-900 bg-gray-900 px-6 py-2 text-sm font-semibold text-white"
                      onClick={() => setProjectDialogOpen(true)}
                    >
                      새 프로젝트 만들기
                    </button>
                  </div>
                )}
                {activeProject && !activeConversationId && (
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs uppercase text-gray-500">프로젝트</p>
                          <h1 className="text-3xl font-semibold text-gray-900">{activeProject.name}</h1>
                          {activeProject.description ? (
                            <p className="mt-3 text-base text-gray-600">{activeProject.description}</p>
                          ) : (
                            <p className="mt-3 text-base text-gray-500">
                              이 프로젝트에 대한 설명을 추가하면 협업이 쉬워집니다.
                            </p>
                          )}
                          {activeProject.instruction_text && (
                            <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                              {activeProject.instruction_text}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
                          onClick={() => setManualEditorOpen(true)}
                        >
                          📁 파일 추가
                        </button>
                      </div>
                      {!manualStats && (
                        <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
                          <ManualWorkspace
                            manualStats={manualStats}
                            uploading={uploading}
                            embedRatio={embedRatio}
                            onEmbedRatioChange={setEmbedRatio}
                            onUpload={handleManualUpload}
                            onRemoveSource={handleRemoveManualSource}
                            disabled={manualWorkspaceDisabled}
                            isGuestMode={false}
                          />
                        </div>
                      )}
                    </div>
                    {manualSummary}
                    {conversationList}
                  </div>
                )}
                {activeProject && activeConversationId && (
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="flex flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs text-gray-500">{activeProject.name}</p>
                          <h2 className="text-2xl font-semibold text-gray-900">{activeConversation?.title}</h2>
                        </div>
                        <div className="flex gap-2 text-sm text-gray-500">
                          <button type="button" onClick={() => handleRenameConversation(activeConversationId!)}>
                            이름 변경
                          </button>
                          <span>·</span>
                          <button type="button" onClick={() => handleDeleteConversation(activeConversationId!)}>
                            삭제
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <span className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700">
                          {displayRole ? (displayRole === 'customer' ? '고객' : '직원') : '역할 미선택'}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={`rounded-full px-4 py-1 text-sm font-semibold ${
                              displayRole === 'employee'
                                ? 'bg-gray-900 text-white'
                                : 'border border-gray-200 text-gray-700'
                            }`}
                            onClick={() => handleQuickRoleSelect('employee')}
                            disabled={!manualStats || loadingResponse}
                          >
                            직원 모드
                          </button>
                          <button
                            type="button"
                            className={`rounded-full px-4 py-1 text-sm font-semibold ${
                              displayRole === 'customer'
                                ? 'bg-gray-900 text-white'
                                : 'border border-gray-200 text-gray-700'
                            }`}
                            onClick={() => handleQuickRoleSelect('customer')}
                            disabled={!manualStats || loadingResponse}
                          >
                            고객 모드
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-gray-200 px-4 py-1 text-sm font-semibold text-gray-700"
                            onClick={handleToggleRole}
                            disabled={!displayRole || loadingResponse}
                          >
                            ↺ 역할 전환
                          </button>
                        </div>
                      </div>
                      {role === 'employee' && (
                        <div className="mt-4 flex flex-wrap gap-2 text-sm text-gray-600">
                          <button
                            type="button"
                            className="rounded-full border border-gray-200 px-3 py-1"
                            onClick={() => startRole('employee')}
                            disabled={loadingResponse}
                          >
                            🔄 새 시나리오
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-gray-200 px-3 py-1"
                            onClick={handleReset}
                            disabled={loadingResponse}
                          >
                            ❌ 시뮬레이션 종료
                          </button>
                        </div>
                      )}
                      {currentScenarioDetails && (
                        <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                          {currentScenarioDetails}
                        </div>
                      )}
                      <div className="mt-6 flex-1">
                        <ChatWindow
                          activeRole={displayRole}
                          messages={messages}
                          onSend={handleSendMessage}
                          disabled={!manualStats || messagesLoading || !role}
                          loading={loadingResponse}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-4">
                      {manualSummary ?? (
                        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-5 text-sm text-gray-500">
                          프로젝트 자료를 업로드하면 모든 채팅에 반영됩니다.
                          <button
                            type="button"
                            className="mt-3 inline-flex rounded-full border border-gray-200 px-4 py-1.5 text-sm font-semibold text-gray-700"
                            onClick={() => setManualEditorOpen(true)}
                          >
                            자료 업로드
                          </button>
                        </div>
                      )}
                      {showEvaluationPanel && (
                        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                          <EvaluationPanel evaluation={evaluation} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {authModal}
      {manualModal}
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
                  <div>
                    <div className="topbar-model-main">ChatGPT</div>
                    <div className="topbar-model-sub">5.1 Thinking</div>
                  </div>
                </div>
                <div className="topbar-select-group">
                  <select
                    aria-label="프로바이더 선택"
                    value={providerConfig.provider}
                    onChange={(event) => changeProvider(event.target.value as ProviderConfig['provider'])}
                  >
                    {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="모델 선택"
                    value={providerConfig.model}
                    onChange={(event) => changeModel(event.target.value)}
                  >
                    {providerModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  {providerConfig.provider !== 'ollama' && (
                    <input
                      type="password"
                      className="topbar-api-input"
                      placeholder="API Key"
                      value={providerConfig.apiKey ?? ''}
                      onChange={handleApiKeyChange}
                    />
                  )}
                </div>
              </div>
              <div className="topbar-actions">
                {isGuestMode ? (
                  <button
                    type="button"
                    className="topbar-cta"
                    onClick={handleRequestAuth}
                  >
                    🔐 로그인 / 회원가입
                  </button>
                ) : (
                  <button type="button" className="topbar-cta ghost" onClick={logout}>
                    🔓 로그아웃
                  </button>
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
                  <span className="chat-toolbar__badge">시뮬레이션</span>
                  <strong>시뮬레이션 준비 완료</strong>
                  <span>업로드한 자료를 바탕으로 고객/직원 역할을 전환하며 연습하세요.</span>
                </div>
                <div className="chat-toolbar__actions">
                  <button type="button" className="ghost-btn" onClick={() => setManualEditorOpen(true)}>
                    📚 자료 관리
                  </button>
                </div>
              </div>
              <section
                className="simulation-section"
                role="region"
                aria-labelledby="simulation-section-title"
              >
                <div className="section-header">
                  <div className="section-title">
                    <span className={`role-badge ${displayRole ?? 'neutral'}`}>
                      {displayRole
                        ? displayRole === 'customer'
                          ? '고객 모드'
                          : '직원 모드'
                        : '대화 기록'}
                    </span>
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
                  <button
                    type="button"
                    className={`role-switch-btn ${displayRole === 'employee' ? 'is-active' : ''}`}
                    onClick={() => handleQuickRoleSelect('employee')}
                    disabled={!manualStats || loadingResponse}
                  >
                    직원 모드
                  </button>
                  <button
                    type="button"
                    className={`role-switch-btn ${displayRole === 'customer' ? 'is-active' : ''}`}
                    onClick={() => handleQuickRoleSelect('customer')}
                    disabled={!manualStats || loadingResponse}
                  >
                    {displayRole === 'customer' ? '고객 모드' : '고객 모드 전환'}
                  </button>
                  <button
                    type="button"
                    className="role-switch-btn subtle"
                    onClick={handleToggleRole}
                    disabled={!displayRole || loadingResponse}
                  >
                    ↺ 역할 전환
                  </button>
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
