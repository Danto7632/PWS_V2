import { useState } from 'react';
import { ChevronDown, ChevronRight, FolderOpen, Folder } from 'lucide-react';
import { Project } from '../types';
import { ConversationItem } from './ConversationItem';

interface ProjectSectionProps {
  project: Project;
  activeConversationId: string | null;
  activeProjectId: string | null;
  onSelectConversation: (id: string) => void;
  onSelectProject: (id: string) => void;
  onToggleProject: (id: string) => void;
  isExpanded: boolean;
}

export function ProjectSection({ 
  project, 
  activeConversationId, 
  activeProjectId,
  onSelectConversation,
  onSelectProject,
  onToggleProject,
  isExpanded
}: ProjectSectionProps) {
  const isProjectActive = activeProjectId === project.id && !activeConversationId;

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isFolderIcon = target.closest('[data-folder-icon]');
    
    if (isFolderIcon) {
      onToggleProject(project.id);
    } else {
      onSelectProject(project.id);
    }
  };

  return (
    <div>
      <button 
        onClick={handleClick}
        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors text-left ${
          isProjectActive ? 'bg-gray-200' : 'hover:bg-gray-200'
        }`}
      >
        <div data-folder-icon className="flex-shrink-0 p-0.5">
          {isExpanded ? (
            <FolderOpen className="size-4 text-gray-600" />
          ) : (
            <Folder className="size-4 text-gray-600" />
          )}
        </div>
        <span className="text-sm flex-1 truncate">{project.name}</span>
        <span className="text-xs text-gray-400">{project.conversations.length}</span>
      </button>
      
      {isExpanded && (
        <div className="ml-6 mt-1 space-y-1">
          {project.conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === activeConversationId}
              onClick={() => onSelectConversation(conversation.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}