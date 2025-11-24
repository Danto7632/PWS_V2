import { useState } from 'react';
import type { ConversationSummary } from '../types';

type Props = {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  conversationLoading: boolean;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: (title?: string) => Promise<void>;
  onRenameConversation: (conversationId: string, title: string) => Promise<void>;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  isGuestMode: boolean;
  onRequestAuth?: () => void;
};

export function SidebarSettings({
  conversations,
  activeConversationId,
  conversationLoading,
  onSelectConversation,
  onCreateConversation,
  onRenameConversation,
  onDeleteConversation,
  isGuestMode,
  onRequestAuth,
}: Props) {
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [conversationActionLoading, setConversationActionLoading] = useState(false);

  const handleConversationError = (err: unknown) => {
    setConversationError((err as Error).message ?? '대화 작업 중 오류가 발생했습니다.');
  };

  const handleCreateConversation = async () => {
    const title = window.prompt('새 대화 제목을 입력하세요', '새 시뮬레이션');
    if (title === null) return;
    setConversationError(null);
    setConversationActionLoading(true);
    try {
      await onCreateConversation(title.trim() || undefined);
    } catch (err) {
      handleConversationError(err);
    } finally {
      setConversationActionLoading(false);
    }
  };

  const handleRenameConversation = async (
    conversationId: string,
    currentTitle: string,
  ) => {
    const title = window.prompt('새 제목을 입력하세요', currentTitle);
    if (title === null || title.trim() === currentTitle.trim()) return;
    setConversationError(null);
    setConversationActionLoading(true);
    try {
      await onRenameConversation(conversationId, title.trim() || currentTitle);
    } catch (err) {
      handleConversationError(err);
    } finally {
      setConversationActionLoading(false);
    }
  };

  const handleDeleteConversation = async (conversationId: string, title: string) => {
    const confirmed = window.confirm(`'${title}' 대화를 삭제하시겠습니까?`);
    if (!confirmed) return;
    setConversationError(null);
    setConversationActionLoading(true);
    try {
      await onDeleteConversation(conversationId);
    } catch (err) {
      handleConversationError(err);
    } finally {
      setConversationActionLoading(false);
    }
  };

  const renderConversationSection = () => {
    if (isGuestMode) {
      return (
        <div className="guest-conversation-placeholder">
          <p>게스트 모드는 하나의 임시 대화만 제공합니다.</p>
          <button type="button" className="ghost-btn" onClick={() => onRequestAuth?.()}>
            🔐 로그인하고 저장하기
          </button>
        </div>
      );
    }
    return (
      <>
        <div className="conversation-list sleek">
          {conversationLoading && !conversations.length ? (
            <p className="conversation-placeholder">대화를 불러오는 중...</p>
          ) : conversations.length ? (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={`conversation-item minimal ${
                  conversation.id === activeConversationId ? 'active' : ''
                }`}
                onClick={() => onSelectConversation(conversation.id)}
                disabled={conversationActionLoading}
              >
                <div>
                  <strong>{conversation.title}</strong>
                  <span>
                    {new Date(conversation.updated_at).toLocaleString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="conversation-actions">
                  <button
                    type="button"
                    className="text-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRenameConversation(conversation.id, conversation.title);
                    }}
                    disabled={conversationActionLoading}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteConversation(conversation.id, conversation.title);
                    }}
                    disabled={conversationActionLoading}
                  >
                    🗑️
                  </button>
                </div>
              </button>
            ))
          ) : (
            <p className="conversation-placeholder">아직 생성된 대화가 없습니다.</p>
          )}
        </div>
        {conversationError && <p className="error-text">{conversationError}</p>}
      </>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <strong>ChatGPT 5.1 Thinking</strong>
          <p>대화 기록</p>
        </div>
        {!isGuestMode && (
          <button
            type="button"
            className="new-chat-btn"
            onClick={handleCreateConversation}
            disabled={conversationLoading || conversationActionLoading}
          >
            + 새 채팅
          </button>
        )}
      </div>
      {renderConversationSection()}
      <footer className="sidebar-footer">
        <span>© {new Date().getFullYear()} Genius Otter</span>
        <button type="button" className="link-btn" onClick={() => onRequestAuth?.()}>
          계정 관리
        </button>
      </footer>
    </aside>
  );
}
