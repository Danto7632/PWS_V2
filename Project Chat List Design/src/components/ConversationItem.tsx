import { MessageSquare, MoreHorizontal } from 'lucide-react';
import { Conversation } from '../types';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
  return (
    <div
      className={`
        w-full flex items-start gap-2 p-2 rounded-lg transition-colors group cursor-pointer
        ${isActive ? 'bg-gray-200' : 'hover:bg-gray-200'}
      `}
    >
      <div className="flex-1 flex items-start gap-2 min-w-0" onClick={onClick}>
        <MessageSquare className="size-4 text-gray-500 mt-1 flex-shrink-0" />
        <div className="flex-1 text-left overflow-hidden">
          <div className="text-sm truncate">{conversation.title}</div>
          <div className="text-xs text-gray-500 truncate">{conversation.preview}</div>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-xs text-gray-400">{conversation.date}</span>
        <button 
          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-300 rounded transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <MoreHorizontal className="size-3 text-gray-600" />
        </button>
      </div>
    </div>
  );
}