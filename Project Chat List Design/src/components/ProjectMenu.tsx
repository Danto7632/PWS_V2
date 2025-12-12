import { useState, useRef, useEffect } from 'react';
import { Share2, Settings, ListPlus, Trash2 } from 'lucide-react';

interface ProjectMenuProps {
  onShare?: () => void;
  onSettings?: () => void;
  onAddGuideline?: () => void;
  onDelete?: () => void;
}

export function ProjectMenu({
  onShare,
  onSettings,
  onAddGuideline,
  onDelete
}: ProjectMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <svg 
          className="size-5 text-gray-700" 
          viewBox="0 0 24 24" 
          fill="currentColor"
        >
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-[180px] bg-white rounded-lg shadow-lg border border-gray-200 py-1.5 z-50">
          <button
            onClick={() => {
              onShare?.();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 transition-colors text-left"
          >
            <Share2 className="size-4 text-gray-700" />
            <span className="text-sm text-gray-900">공유하기</span>
          </button>

          <button
            onClick={() => {
              onSettings?.();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 transition-colors text-left"
          >
            <Settings className="size-4 text-gray-700" />
            <span className="text-sm text-gray-900">프로젝트 설정</span>
          </button>

          <button
            onClick={() => {
              onAddGuideline?.();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 transition-colors text-left"
          >
            <ListPlus className="size-4 text-gray-700" />
            <span className="text-sm text-gray-900">지침 추가</span>
          </button>

          <div className="my-1 border-t border-gray-200" />

          <button
            onClick={() => {
              onDelete?.();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 transition-colors text-left"
          >
            <Trash2 className="size-4 text-red-500" />
            <span className="text-sm text-red-500">프로젝트 삭제</span>
          </button>
        </div>
      )}
    </div>
  );
}