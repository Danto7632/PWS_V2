import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, ChevronRight } from 'lucide-react';

interface Model {
  id: string;
  provider: string;
  name: string;
  description?: string;
}

interface ModelGroup {
  provider: string;
  models: Model[];
}

const modelGroups: ModelGroup[] = [
  {
    provider: 'GPT',
    models: [
      { id: 'gpt-5.1-thinking', provider: 'GPT', name: '5.1 Thinking', description: '좋은 답변을 위해 더 오래 생각' },
      { id: 'gpt-5.1-auto', provider: 'GPT', name: '5.1 Auto', description: '생각하는 시간을 정해세요' },
      { id: 'gpt-5.1-instant', provider: 'GPT', name: '5.1 Instant', description: '즉시 대답' },
      { id: 'gpt-4.0', provider: 'GPT', name: '4.0', description: '이전 버전 모델' },
    ]
  },
  {
    provider: 'Gemini',
    models: [
      { id: 'gemini-2.5', provider: 'Gemini', name: '2.5', description: 'Google의 최신 모델' },
      { id: 'gemini-1.5', provider: 'Gemini', name: '1.5', description: 'Google의 이전 모델' },
    ]
  },
  {
    provider: 'Ollama',
    models: [
      { id: 'ollama-exaone3.5:2.4b', provider: 'Ollama', name: 'exaone3.5:2.4b', description: '로컬 LLM 모델' },
      { id: 'ollama-llama3.2', provider: 'Ollama', name: 'llama3.2', description: '로컬 LLM 모델' },
    ]
  }
];

interface ModelSelectorProps {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
}

export function ModelSelector({ selectedModel, onSelectModel }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allModels = modelGroups.flatMap(group => group.models);
  const currentModel = allModels.find(m => m.id === selectedModel) || modelGroups[0].models[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <span className="text-gray-900">{currentModel.provider}</span>
        <span className="text-gray-500">{currentModel.name}</span>
        <ChevronDown className="size-4 text-gray-600" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[400px] bg-white rounded-2xl shadow-lg border border-gray-200 py-3 z-50">
          {modelGroups.map((group, idx) => (
            <div key={group.provider}>
              {idx > 0 && <div className="my-2 border-t border-gray-200" />}
              <div className="px-4 py-2 text-sm text-gray-500">{group.provider}</div>
              
              <div className="space-y-1 px-2">
                {group.models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onSelectModel(model.id);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-3 hover:bg-gray-100 rounded-lg transition-colors text-left"
                  >
                    <div>
                      <div className="text-gray-900 mb-0.5">{model.name}</div>
                      {model.description && (
                        <div className="text-sm text-gray-500">{model.description}</div>
                      )}
                    </div>
                    {selectedModel === model.id && (
                      <Check className="size-5 text-gray-900 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}