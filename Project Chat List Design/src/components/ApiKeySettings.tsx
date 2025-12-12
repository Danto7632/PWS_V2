import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Key, Eye, EyeOff } from 'lucide-react';

interface ApiKeys {
  gpt: string;
  gemini: string;
}

interface ApiKeySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: ApiKeys;
  onSaveApiKeys: (keys: ApiKeys) => void;
}

export function ApiKeySettings({ isOpen, onClose, apiKeys, onSaveApiKeys }: ApiKeySettingsProps) {
  const [keys, setKeys] = useState<ApiKeys>(apiKeys);
  const [showGptKey, setShowGptKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  useEffect(() => {
    setKeys(apiKeys);
  }, [apiKeys]);

  const handleSave = () => {
    onSaveApiKeys(keys);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="size-5" />
            API 키 설정
          </DialogTitle>
          <DialogDescription>
            API 키를 설정하여 모델에 접근할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* GPT API Key */}
          <div className="space-y-2">
            <Label htmlFor="gpt-key" className="flex items-center gap-2">
              <span className="text-gray-900">OpenAI API Key</span>
              <span className="text-xs text-gray-500">(GPT 모델용)</span>
            </Label>
            <div className="relative">
              <Input
                id="gpt-key"
                type={showGptKey ? 'text' : 'password'}
                value={keys.gpt}
                onChange={(e) => setKeys({ ...keys, gpt: e.target.value })}
                placeholder="sk-..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowGptKey(!showGptKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showGptKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              OpenAI API 키는{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                platform.openai.com
              </a>
              에서 발급받을 수 있습니다.
            </p>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-2">
            <Label htmlFor="gemini-key" className="flex items-center gap-2">
              <span className="text-gray-900">Google API Key</span>
              <span className="text-xs text-gray-500">(Gemini 모델용)</span>
            </Label>
            <div className="relative">
              <Input
                id="gemini-key"
                type={showGeminiKey ? 'text' : 'password'}
                value={keys.gemini}
                onChange={(e) => setKeys({ ...keys, gemini: e.target.value })}
                placeholder="AI..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showGeminiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Gemini API 키는{' '}
              <a
                href="https://makersuite.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google AI Studio
              </a>
              에서 발급받을 수 있습니다.
            </p>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              <strong>참고:</strong> Ollama 모델은 로컬에서 실행되므로 API 키가 필요하지 않습니다.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSave}>
            저장
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}