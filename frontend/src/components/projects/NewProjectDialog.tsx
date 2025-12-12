import { useState } from 'react';
import { FolderKanban, X } from 'lucide-react';

const PROJECT_CATEGORIES = [
  { label: '업무', emoji: '💼' },
  { label: '학습', emoji: '📚' },
  { label: '문서', emoji: '📝' },
  { label: '건강', emoji: '💪' },
  { label: '여행', emoji: '✈️' },
];

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    name: string;
    description?: string;
    instruction_text?: string;
    category?: string;
  }) => Promise<void>;
  loading?: boolean;
}

export function NewProjectDialog({ open, onOpenChange, onSubmit, loading }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instruction, setInstruction] = useState('');
  const [category, setCategory] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const handleClose = () => {
    setError(null);
    setName('');
    setDescription('');
    setInstruction('');
    setCategory('');
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('프로젝트 이름을 입력하세요.');
      return;
    }
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        instruction_text: instruction.trim() || undefined,
        category: category || undefined,
      });
      handleClose();
    } catch (err) {
      setError((err as Error).message ?? '프로젝트 생성 중 오류가 발생했습니다.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gray-100 p-2">
              <FolderKanban className="h-6 w-6 text-gray-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">새 프로젝트 만들기</h2>
              <p className="text-sm text-gray-500">지속적으로 다루는 업무나 학습 주제를 프로젝트로 묶어 관리하세요.</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
            onClick={handleClose}
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-800">프로젝트 이름</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 생성형 AI 활용 개발 실무"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-base outline-none transition focus:border-gray-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-800">카테고리</label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_CATEGORIES.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setCategory((prev) => (prev === option.label ? '' : option.label))}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    category === option.label
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <span className="mr-2">{option.emoji}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-800">설명</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-gray-400"
              placeholder="프로젝트의 목적이나 참고할 내용을 적어두면 좋아요."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-800">맞춤 지침</label>
            <textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-gray-400"
              placeholder="모든 채팅에 자동으로 적용할 프롬프트나 매뉴얼을 입력하세요."
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600"
            onClick={handleClose}
          >
            취소
          </button>
          <button
            type="button"
            className="rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '생성 중...' : '프로젝트 만들기'}
          </button>
        </div>
      </div>
    </div>
  );
}
