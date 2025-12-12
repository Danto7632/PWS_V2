import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { X } from 'lucide-react';

interface GuidelineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (guideline: string) => void;
  currentGuideline?: string;
}

export function GuidelineDialog({ isOpen, onClose, onSave, currentGuideline = '' }: GuidelineDialogProps) {
  const [guideline, setGuideline] = useState(currentGuideline);

  const handleSave = () => {
    onSave?.(guideline);
    onClose();
  };

  const handleClose = () => {
    setGuideline(currentGuideline);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>지침</DialogTitle>
          <DialogDescription className="sr-only">
            프로젝트에 대한 지침을 설정하여 AI 응답을 최적화할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm">
              이렇게 하면 ChatGPT가 이 프로젝트를 최대한 도와줄 수 있습니다
            </p>
            <p className="text-sm text-gray-600">
              ChatGPT에게 특정 톤/목소리를 만들 수 있거나, 특정한 토픽이나 목적으로 응답을 한정할 수 있습니다.
            </p>
          </div>

          <textarea
            value={guideline}
            onChange={(e) => setGuideline(e.target.value)}
            placeholder='예: "스페인어로 대답해 줘. 친한 JavaScript 문서를 레퍼런스로 삼아 줘. 다만을 간결한 단어로 해 줘."'
            className="w-full min-h-[200px] p-4 border border-gray-300 rounded-lg resize-none outline-none focus:border-gray-400 transition-colors"
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={handleClose}
            >
              취소
            </Button>
            <Button
              onClick={handleSave}
              className="bg-black text-white hover:bg-gray-800"
            >
              저장
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}