import { useMemo, useState } from 'react';
import type { ConversationSummary, ProjectSummary } from '../../types';
import { Plus, Search, MessageSquare, FolderKanban, ChevronDown } from 'lucide-react';

interface ProjectSidebarProps {
  projects: ProjectSummary[];
  conversations: ConversationSummary[];
  activeProjectId: string | null;
  activeConversationId: string | null;
  loading?: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectProject: (projectId: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onCreateProject: () => void;
}

export function ProjectSidebar({
  projects,
  conversations,
  activeProjectId,
  activeConversationId,
  loading,
  collapsed,
  onToggleCollapse,
  onSelectProject,
  onSelectConversation,
  onCreateProject,
}: ProjectSidebarProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return projects;
    return projects.filter((project) =>
      [project.name, project.description, project.instruction_text]
        .filter(Boolean)
        .some((text) => text?.toLowerCase().includes(query.trim().toLowerCase())),
    );
  }, [projects, query]);

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[280px]';

  return (
    <aside
      className={`flex h-screen flex-shrink-0 flex-col border-r border-gray-200 bg-[#f9f9f9] transition-all duration-200 ${sidebarWidth}`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        {collapsed ? (
          <button
            type="button"
            className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm"
            onClick={onToggleCollapse}
            aria-label="사이드바 열기"
          >
            <MessageSquare className="h-5 w-5 text-gray-700" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <FolderKanban className="h-5 w-5 text-gray-700" />
              프로젝트
            </div>
            <button
              type="button"
              className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm"
              onClick={onToggleCollapse}
              aria-label="사이드바 접기"
            >
              <ChevronDown className="h-5 w-5 rotate-90 text-gray-600" />
            </button>
          </>
        )}
      </div>

      {collapsed ? (
        <div className="flex flex-1 flex-col items-center gap-3 px-2 py-4">
          <button
            type="button"
            className="h-12 w-12 rounded-2xl border border-gray-200 bg-white text-gray-700 shadow-sm"
            onClick={onCreateProject}
            title="새 프로젝트"
          >
            <Plus className="mx-auto h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="space-y-3 px-4">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-gray-300"
              onClick={onCreateProject}
            >
              <Plus className="h-4 w-4" /> 새 프로젝트
            </button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="프로젝트 검색"
                className="w-full rounded-2xl border border-gray-200 bg-white px-9 py-2 text-sm text-gray-800 outline-none transition focus:border-gray-400"
              />
            </div>
          </div>
          <div className="mt-4 flex-1 overflow-y-auto px-2">
            {loading && !projects.length ? (
              <p className="px-2 text-sm text-gray-500">프로젝트를 불러오는 중...</p>
            ) : filtered.length ? (
              <ul className="space-y-2">
                {filtered.map((project) => {
                  const isActive = project.id === activeProjectId;
                  return (
                    <li key={project.id}>
                      <button
                        type="button"
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                          isActive
                            ? 'border-gray-900 bg-white shadow-md'
                            : 'border-transparent bg-white/70 hover:border-gray-200'
                        }`}
                        onClick={() => onSelectProject(project.id)}
                      >
                        <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                          <span>{project.name}</span>
                          <span className="text-xs text-gray-500">
                            {project.chat_count ?? 0} 채팅
                          </span>
                        </div>
                        {project.description && (
                          <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                        <p className="mt-2 text-[11px] text-gray-400">
                          최근 {new Date(project.updated_at).toLocaleDateString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </button>
                      {isActive && conversations.length > 0 && (
                        <div className="mt-2 space-y-1 pl-2">
                          {conversations.map((conversation) => {
                            const selected = conversation.id === activeConversationId;
                            return (
                              <button
                                key={conversation.id}
                                type="button"
                                className={`flex w-full flex-col rounded-2xl border px-3 py-2 text-left text-sm transition ${
                                  selected
                                    ? 'border-gray-900 bg-white shadow-sm'
                                    : 'border-gray-100 bg-white/80 hover:border-gray-300'
                                }`}
                                onClick={() => onSelectConversation(conversation.id)}
                              >
                                <div className="flex items-center justify-between text-gray-900">
                                  <span className="line-clamp-1 text-sm font-semibold">
                                    {conversation.title}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {conversation.role === 'customer' ? '고객' : '직원'}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500">
                                  {new Date(conversation.updated_at).toLocaleString('ko-KR', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 px-4 py-6 text-center text-sm text-gray-500">
                검색 결과가 없습니다.
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
