import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { NewProjectDialog } from './components/NewProjectDialog';
import { Project, Message, ProjectFile } from './types';

const mockProjects: Project[] = [
  {
    id: 'project-1',
    name: '디버깅 시각화 알고리즘',
    conversations: [
      {
        id: '1',
        title: '포스터 구성안 제시',
        preview: '그림 실체화만프로/JSON 이미지 까지 포함해서 포스터 구성을 다시 제안...',
        date: '11월 25일',
        projectId: 'project-1'
      },
      {
        id: '2',
        title: 'Flask 서버 코드 실행',
        preview: '구조를 json 으로 제공해서',
        date: '11월 12일',
        projectId: 'project-1'
      },
      {
        id: '3',
        title: 'DV-Flow 개요 및 활용',
        preview: '프런트는 React SPA+Monaco로 편집·재생 UI를 개발하고, Spring Boot가 인증...',
        date: '11월 6일',
        projectId: 'project-1'
      },
    ]
  },
  {
    id: 'project-2',
    name: '강진대륙 포스터',
    conversations: [
      {
        id: '4',
        title: '강진대륙 포스터 작성',
        preview: '1번 사진은 Dv-flow, 2번 사진은 물류앱, 3번 사진은 시스템구조도를 넣으면 괜찮을까?',
        date: '11월 6일',
        projectId: 'project-2'
      },
      {
        id: '5',
        title: '포스터 초안 작성',
        preview: '강진대륙 포스터를 만들어야하는데, 어떤거를 구성이어야겠어? 초안을 작성해서 줘...',
        date: '11월 6일',
        projectId: 'project-2'
      },
      {
        id: '6',
        title: '본문 300자 이내',
        preview: '1. 지금 구조를 알고리즘 수업을 듣고 글쓰러면서 개발자에도 되었지만, 실무를 내가...',
        date: '11월 6일',
        projectId: 'project-2'
      },
    ]
  },
  {
    id: 'project-3',
    name: '김익성 작업',
    conversations: [
      {
        id: '7',
        title: '김익성 작업 정리',
        preview: '봄바람과 문장도로 말장하지',
        date: '10월 29일',
        projectId: 'project-3'
      },
      {
        id: '8',
        title: '브랜치 · 김익성 작업 정리',
        preview: '머기게 있는 내용의 비들을 가까이 작성해도 좋은 것 같아, 핵심기술를 데이요로',
        date: '10월 29일',
        projectId: 'project-3'
      },
    ]
  },
  {
    id: 'project-4',
    name: 'OIBC 2025',
    conversations: [
      {
        id: '9',
        title: '2025 OIBC',
        preview: 'OIBC 2025 경진대회 관련',
        date: '10월 20일',
        projectId: 'project-4'
      },
    ]
  },
  {
    id: 'project-5',
    name: '프로젝트 관리',
    conversations: [
      {
        id: '10',
        title: '프로젝트일주간기',
        preview: '프로젝트 일정 및 진행상황 정리',
        date: '10월 15일',
        projectId: 'project-5'
      },
    ]
  }
];

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>('1');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectsState, setProjectsState] = useState(mockProjects);
  const [apiKeys, setApiKeys] = useState({ gpt: '', gemini: '' });
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [isApiKeySettingsOpen, setIsApiKeySettingsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'user',
      content: '디버깅 시각화 알고리즘에 대해 설명해줘',
      timestamp: new Date()
    },
    {
      id: '2',
      role: 'assistant',
      content: '디버깅 시각화 알고리즘은 프로그램의 실행 과정을 시각적으로 표현하여 이해하기 쉽게 만드는 기술입니다.\\n\\n주요 특징:\\n1. 실행 흐름을 그래프나 다이어그램으로 표현\\n2. 변수의 변화를 실시간으로 추적\\n3. 코드의 각 단계를 단계별로 시각화\\n\\n이를 통해 개발자는 복잡한 알고리즘의 동작을 더 쉽게 이해하고 버그를 찾을 수 있습니다.',
      timestamp: new Date()
    }
  ]);

  // Find active conversation across all projects
  const findActiveConversation = () => {
    for (const project of projectsState) {
      const conv = project.conversations.find(c => c.id === activeConversationId);
      if (conv) return conv;
    }
    return null;
  };

  // Find active project
  const findActiveProject = () => {
    return projectsState.find(p => p.id === activeProjectId);
  };

  const activeConversation = findActiveConversation();
  const activeProject = findActiveProject();

  const handleSendMessage = (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);

    // 시뮬레이션된 AI 응답
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '네, 도와드리겠습니다. 무엇을 도와드릴까요?',
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 1000);
  };

  const handleNewProject = () => {
    setMessages([]);
    setActiveConversationId(null);
    setActiveProjectId(null);
    setIsNewProjectDialogOpen(true);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setActiveProjectId(null);
    // 실제 앱에서는 여기서 해당 대화의 메시지를 로드
  };

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    setActiveConversationId(null);
    setMessages([]);
  };

  const handleToggleProject = (id: string) => {
    setProjectsState(prev => prev.map(project => 
      project.id === id 
        ? { ...project, isExpanded: !project.isExpanded }
        : project
    ));
  };

  const handleCreateProject = (name: string, category?: string) => {
    const newProject: Project = {
      id: `project-${Date.now()}`,
      name,
      conversations: [],
      isExpanded: true,
      category,
      files: []
    };
    
    setProjectsState(prev => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    setActiveConversationId(null);
    setMessages([]);
  };

  const handleAddFiles = (projectId: string, files: ProjectFile[]) => {
    setProjectsState(prev => prev.map(project =>
      project.id === projectId
        ? { ...project, files }
        : project
    ));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar
        projects={projectsState}
        activeConversationId={activeConversationId}
        activeProjectId={activeProjectId}
        onSelectConversation={handleSelectConversation}
        onSelectProject={handleSelectProject}
        onToggleProject={handleToggleProject}
        onNewProject={handleNewProject}
        onApiKeySettings={() => setIsApiKeySettingsOpen(true)}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isCollapsed={sidebarCollapsed}
        onCollapsedToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <ChatArea
        conversationTitle={activeConversation?.title}
        projectTitle={activeProject?.name}
        projectConversations={activeProject?.conversations}
        projectFiles={activeProject?.files}
        messages={messages}
        onSendMessage={handleSendMessage}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onSelectConversation={handleSelectConversation}
        onAddFiles={(files) => activeProjectId && handleAddFiles(activeProjectId, files)}
        apiKeys={apiKeys}
        onSaveApiKeys={setApiKeys}
        isApiKeySettingsOpen={isApiKeySettingsOpen}
        onApiKeySettingsOpenChange={setIsApiKeySettingsOpen}
      />
      <NewProjectDialog
        isOpen={isNewProjectDialogOpen}
        onClose={() => setIsNewProjectDialogOpen(false)}
        onCreateProject={handleCreateProject}
      />
    </div>
  );
}