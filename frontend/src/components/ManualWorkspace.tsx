import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import type { ManualStats } from '../types';

type Props = {
  manualStats: ManualStats | null;
  uploading: boolean;
  embedRatio: number;
  onEmbedRatioChange: (value: number) => void;
  onUpload: (files: File[], ratio: number, instructionText?: string) => Promise<void>;
  onRemoveSource?: (sourceId: string) => Promise<void>;
  disabled: boolean;
  isGuestMode: boolean;
  onRequestAuth?: () => void;
};

export function ManualWorkspace({
  manualStats,
  uploading,
  embedRatio,
  onEmbedRatioChange,
  onUpload,
  onRemoveSource,
  disabled,
  isGuestMode,
  onRequestAuth,
}: Props) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [instructionText, setInstructionText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasContent = selectedFiles.length > 0 || instructionText.trim().length > 0;
  const canSubmit = !disabled && hasContent && !uploading;
  const storedSources = manualStats?.sources ?? [];
  const summaryEmbedRatio = manualStats?.embedRatio ?? embedRatio;

  const lastUpdatedText = useMemo(() => {
    if (!manualStats?.updatedAt) return null;
    try {
      return new Date(manualStats.updatedAt).toLocaleString('ko-KR');
    } catch {
      return manualStats.updatedAt;
    }
  }, [manualStats]);

  const createFileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

  const appendFiles = (files: File[]) => {
    if (!files.length) return;
    setSelectedFiles((prev) => {
      const existingKeys = new Set(prev.map(createFileKey));
      const next = [...prev];
      files.forEach((file) => {
        const key = createFileKey(file);
        if (existingKeys.has(key)) return;
        existingKeys.add(key);
        next.push(file);
      });
      return next;
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    appendFiles(Array.from(files));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (uploading || disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (!files.length) return;
    appendFiles(files);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveSelectedFile = (fileKey: string) => {
    setSelectedFiles((prev) => prev.filter((file) => createFileKey(file) !== fileKey));
  };

  const resetForm = () => {
    setSelectedFiles([]);
    setInstructionText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasContent || disabled) {
      setError('최소 한 개 이상의 파일을 선택하거나 텍스트를 입력하세요.');
      return;
    }
    setError(null);
    try {
      await onUpload(selectedFiles, embedRatio, instructionText.trim() || undefined);
      resetForm();
    } catch (err) {
      setError((err as Error).message ?? '매뉴얼 업로드 중 오류가 발생했습니다.');
    }
  };

  const handleRemoveSource = async (sourceId: string) => {
    if (!onRemoveSource) return;
    setError(null);
    setRemovingId(sourceId);
    try {
      await onRemoveSource(sourceId);
    } catch (err) {
      setError((err as Error).message ?? '자료 삭제 중 오류가 발생했습니다.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="manual-workspace">
      <header className="manual-workspace__header">
        <div>
          <span className="hero-badge">📚 자료 준비</span>
          <h2>대화용 매뉴얼 업로드 또는 프롬프트 입력</h2>
          <p>
            새 대화를 생성하면 이 영역에서 PDF/TXT/Excel 파일을 업로드하거나 요약 텍스트를 입력해 맞춤 시뮬레이션을 준비할 수 있습니다.
          </p>
        </div>
        {isGuestMode && (
          <button type="button" className="ghost-btn" onClick={onRequestAuth}>
            🔐 로그인하고 저장하기
          </button>
        )}
      </header>

      <form className="manual-grid" onSubmit={handleSubmit}>
        <div className="manual-card">
          <label
            className="file-dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.xls,.xlsx"
              onChange={handleFileChange}
              disabled={uploading || disabled}
              className="sr-only"
            />
            <div className="file-dropzone__body">
              <p>파일을 끌어다 놓거나</p>
              <span>PDF, TXT, Excel 지원 · 최대 200MB</span>
              <button
                type="button"
                className="file-browse-btn"
                onClick={(event) => {
                  event.preventDefault();
                  openFilePicker();
                }}
                disabled={uploading || disabled}
              >
                파일 선택
              </button>
            </div>
          </label>
          {selectedFiles.length > 0 && (
            <ul className="selected-files">
              {selectedFiles.map((file) => {
                const key = createFileKey(file);
                return (
                  <li key={key}>
                    <div>
                      <strong>{file.name}</strong>
                      <span>{(file.size / (1024 * 1024)).toFixed(2)}MB</span>
                    </div>
                    <button type="button" onClick={() => handleRemoveSelectedFile(key)}>
                      제거
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <label className="slider-label">
            임베딩 학습 수준: {Math.round(embedRatio * 100)}%
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.1}
              value={embedRatio}
              onChange={(event) => onEmbedRatioChange(Number(event.target.value))}
              disabled={uploading || disabled}
            />
          </label>
        </div>

        <div className="manual-card">
          <label className="instruction-label" htmlFor="manual-instruction">
            텍스트 프롬프트 입력 (선택)
          </label>
          <textarea
            id="manual-instruction"
            placeholder="매뉴얼 대신 사용할 지침이나 서비스 정보를 텍스트로 입력하세요."
            value={instructionText}
            onChange={(event) => setInstructionText(event.target.value)}
            disabled={uploading || disabled}
          />
          <div className="manual-actions">
            <button type="submit" className="primary-btn" disabled={!canSubmit}>
              {uploading ? '학습 중...' : '매뉴얼 학습 시작'}
            </button>
            {!hasContent && (
              <span className="manual-hint">파일 업로드 또는 텍스트 입력 중 하나는 필수입니다.</span>
            )}
            {error && <span className="error-text">{error}</span>}
          </div>
          {manualStats ? (
            <div className="manual-summary">
              <p>
                최근 학습: <strong>{lastUpdatedText ?? '방금 전'}</strong>
              </p>
              <p>
                파일 {manualStats.fileCount}개 · 청크 {manualStats.chunkCount}개 · 임베딩 {manualStats.embeddedChunks}개 · 반영률{' '}
                {Math.round(summaryEmbedRatio * 100)}%
              </p>
              {storedSources.length > 0 && (
                <div className="manual-sources">
                  <h3>저장된 자료</h3>
                  <ul>
                    {storedSources.map((source) => {
                      let createdText = source.createdAt;
                      try {
                        createdText = new Date(source.createdAt).toLocaleString('ko-KR');
                      } catch {
                        // ignore parsing error
                      }
                      return (
                        <li key={source.id}>
                          <div>
                            <strong>{source.label}</strong>
                            <span>
                              · {source.type === 'instruction' ? '프롬프트' : '파일'} · {createdText}
                            </span>
                            {source.preview && <p className="manual-source-preview">{source.preview}</p>}
                          </div>
                          {onRemoveSource && (
                            <button
                              type="button"
                              className="ghost-btn"
                              disabled={removingId === source.id || uploading}
                              onClick={() => handleRemoveSource(source.id)}
                            >
                              {removingId === source.id ? '삭제 중...' : '삭제'}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="manual-placeholder">아직 업로드된 매뉴얼이 없습니다. 자료를 추가해 시뮬레이션을 시작하세요.</p>
          )}
        </div>
      </form>

      {disabled && (
        <div className="manual-disabled-banner">
          새 대화를 생성하거나 선택한 뒤 매뉴얼을 업로드할 수 있습니다.
        </div>
      )}
    </section>
  );
}
