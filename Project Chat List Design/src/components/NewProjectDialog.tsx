import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { FolderOpen, Settings, Sparkles, CalendarDays, Briefcase, Plane, X } from 'lucide-react';

const categories = [
  { id: 'work', label: '본주', icon: Briefcase },
  { id: 'study', label: '솜비', icon: Sparkles },
  { id: 'writing', label: '알쓰기', icon: Settings },
  { id: 'health', label: '건강', icon: CalendarDays },
  { id: 'travel', label: '여행', icon: Plane },
];

interface NewProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (name: string, category?: string) => void;
}

export function NewProjectDialog({ isOpen, onClose, onCreateProject }: NewProjectDialogProps) {
  const [projectName, setProjectName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleCreate = () => {
    if (projectName.trim()) {
      onCreateProject(projectName, selectedCategory || undefined);
      setProjectName('');
      setSelectedCategory(null);
      onClose();
    }
  };

  const handleClose = () => {
    setProjectName('');
    setSelectedCategory(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FolderOpen className="size-5" />
              프로젝트 이름
            </span>
            <button
              onClick={handleClose}
              className="rounded-lg p-1 hover:bg-gray-100 transition-colors"
            >
              <X className="size-4" />
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Project Name Input */}
          <div className="space-y-2">
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="프로젝트의 이름"
              className="text-base"
              autoFocus
            />
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const Icon = category.icon;
              const isSelected = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(isSelected ? null : category.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="text-sm">{category.label}</span>
                </button>
              );
            })}
          </div>

          {/* Description */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-600 flex items-start gap-2">
              <span className="text-lg">💡</span>
              <span>
                프로젝트마다 각 공백 파일, 독립된 지침들을 보관합니다. 지속적으로 만들어는 작업에, 또는 
                작업을 완전한 정리에 생산기록 추가...
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end">
          <Button 
            onClick={handleCreate}
            disabled={!projectName.trim()}
            className="bg-gray-900 hover:bg-gray-800"
          >
            프로젝트 만들기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
