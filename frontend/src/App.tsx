import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from './services/api';

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

function App() {
  const [manualStats, setManualStats] = useState<ManualStats | null>(null);
  const [conversationId] = useState(() => crypto.randomUUID());
  const [uploading, setUploading] = useState(false);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>(DEFAULT_PROVIDER);
  const [embedRatio, setEmbedRatio] = useState(1);
  const [role, setRole] = useState<Role | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [stats, setStats] = useState<StatsSnapshot>(INITIAL_STATS);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOllamaStatus()
      .then(setOllamaStatus)
      .catch(() => setOllamaStatus({ connected: false, error: '연결 실패' }));
  }, []);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const createMessage = useCallback(
    (author: ChatMessage['author'], messageRole: ChatMessage['role'], text: string): ChatMessage => ({
      id: crypto.randomUUID(),
      author,
      role: messageRole,
      text,
      timestamp: new Date().toISOString(),
    }),
    [],
  );

  const addAssistantMessage = useCallback(
    (text: string, activeRole: Role) => {
      const assistantRole: Role = activeRole === 'customer' ? 'employee' : 'customer';
      appendMessage(createMessage('assistant', assistantRole, text));
    },
    [appendMessage, createMessage],
  );

  const resetSession = useCallback(() => {
    setMessages([]);
    setEvaluation(null);
    setScenario(null);
    setError(null);
  }, []);

  const handleManualUpload = async (files: File[], ratio: number) => {
    setUploading(true);
    setError(null);
    try {
      const result = await uploadManuals(conversationId, files, ratio);
      setManualStats(result);
      setRole(null);
      resetSession();
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
        const scenarioData = await generateScenario(conversationId, providerConfig);
        setScenario(scenarioData);
        addAssistantMessage(scenarioData.firstMessage, nextRole);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingResponse(false);
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!role || !text.trim()) return;
    setError(null);
    const userMessage = createMessage('user', role, text);
    appendMessage(userMessage);
    setLoadingResponse(true);

    try {
      if (role === 'customer') {
        const response = await respondAsCustomer(conversationId, text, providerConfig);
        addAssistantMessage(response.aiResponse, role);
      } else {
        const response = await respondAsEmployee(conversationId, text, providerConfig);
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
      />
      <main className="main-panel">
        <header className="hero">
          <span className="hero-badge">🚀 AI 기반 고객 응대 실전 연습</span>
          <h1>🍑 실전형 업무 시뮬레이터 for 신입</h1>
          <p>업무 매뉴얼을 업로드하고 역할별 시나리오를 반복 연습하며 피드백으로 역량을 높이세요.</p>
        </header>

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
                disabled={!manualStats}
                loading={loadingResponse}
              />
              {role === 'employee' && <EvaluationPanel evaluation={evaluation} />}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
