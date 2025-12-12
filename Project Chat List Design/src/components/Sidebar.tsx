import { useState } from 'react';
import { 
  PanelLeft, 
  Plus, 
  Search, 
  Clock, 
  Settings, 
  ChevronDown,
  MoreHorizontal,
  FolderOpen,
  User,
  PenSquare,
  Globe,
  MessageSquare
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { ProjectSection } from './ProjectSection';
import { Project } from '../types';

interface SidebarProps {
  projects: Project[];
  activeConversationId: string | null;
  activeProjectId: string | null;
  onSelectConversation: (id: string) => void;
  onSelectProject: (id: string) => void;
  onToggleProject: (id: string) => void;
  onNewProject: () => void;
  onApiKeySettings: () => void;
  isOpen: boolean;
  onToggle: () => void;
  isCollapsed: boolean;
  onCollapsedToggle: () => void;
}

export function Sidebar({
  projects,
  activeConversationId,
  activeProjectId,
  onSelectConversation,
  onSelectProject,
  onToggleProject,
  onNewProject,
  onApiKeySettings,
  isOpen,
  onToggle,
  isCollapsed,
  onCollapsedToggle
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebarButton, setShowSidebarButton] = useState(false);

  const filteredProjects = searchQuery 
    ? projects.map(project => ({
        ...project,
        conversations: project.conversations.filter(conv =>
          conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          conv.preview.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(project => project.conversations.length > 0)
    : projects;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          ${isCollapsed ? 'w-[68px]' : 'w-[260px]'} bg-[#f9f9f9] border-r border-gray-200
          transform transition-all duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          {isCollapsed ? (
            <div className="flex items-center justify-center p-3">
              <button 
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                onMouseEnter={() => setShowSidebarButton(true)}
                onMouseLeave={() => setShowSidebarButton(false)}
                onClick={onCollapsedToggle}
                title="사이드바 열기"
              >
                {showSidebarButton ? (
                  <PanelLeft className="size-5 text-gray-700" />
                ) : (
                  <MessageSquare className="size-5 text-gray-700" />
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3">
              <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                <Settings className="size-5 text-gray-700" />
              </button>
              <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors" onClick={onCollapsedToggle}>
                <PanelLeft className="size-5 text-gray-700" />
              </button>
            </div>
          )}

          {isCollapsed ? (
            /* Collapsed View - Icons Only */
            <div className="flex-1 flex flex-col items-center py-3 space-y-2 overflow-auto">
              <button 
                onClick={onNewProject}
                className="p-3 hover:bg-gray-200 rounded-lg transition-colors"
                title="새 프로젝트"
              >
                <PenSquare className="size-5 text-gray-700" />
              </button>
              <button 
                className="p-3 hover:bg-gray-200 rounded-lg transition-colors"
                title="채팅 검색"
              >
                <Search className="size-5 text-gray-700" />
              </button>
              <button 
                className="p-3 hover:bg-gray-200 rounded-lg transition-colors"
                title="라이브러리"
              >
                <Globe className="size-5 text-gray-700" />
              </button>
            </div>
          ) : (
            /* Expanded View */
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="px-3 py-3 space-y-6">
                  {/* Actions */}
                  <div className="space-y-2">
                    <button 
                      onClick={onNewProject}
                      className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Plus className="size-4" />
                      <span className="text-sm">새 프로젝트</span>
                    </button>
                    
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
                      <Search className="size-4" />
                      <span className="text-sm">채팅 검색</span>
                    </button>

                    <button className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
                      <Clock className="size-4" />
                      <span className="text-sm">라이브러리</span>
                    </button>

                    <button 
                      onClick={onApiKeySettings}
                      className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Settings className="size-4" />
                      <span className="text-sm">API 키 설정</span>
                    </button>
                  </div>

                  {/* Projects with Conversations */}
                  <div>
                    <div className="text-xs text-gray-500 px-2 mb-2">프로젝트</div>
                    <div className="space-y-1">
                      {filteredProjects.map((project) => (
                        <ProjectSection
                          key={project.id}
                          project={project}
                          activeConversationId={activeConversationId}
                          activeProjectId={activeProjectId}
                          onSelectConversation={onSelectConversation}
                          onSelectProject={onSelectProject}
                          onToggleProject={onToggleProject}
                          isExpanded={project.isExpanded ?? true}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}