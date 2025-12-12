import { useState } from 'react';
import type { ConversationSummary } from '../types';
import { ChatLogo } from './ChatLogo';

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
  userName?: string;
  userEmail?: string;
  onToggleSidebar: () => void;
};

import { Edit3, Trash2 } from 'lucide-react';
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
  userName,
  userEmail,
  onToggleSidebar,
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
          <button type="button" className="primary-outline-btn" onClick={() => onRequestAuth?.()}>
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
              <div
                key={conversation.id}
                role="button"
                tabIndex={0}
                className={`conversation-item minimal ${
                  conversation.id === activeConversationId ? 'active' : ''
                } ${conversationActionLoading ? 'disabled' : ''}`}
                onClick={() => {
                  if (conversationActionLoading) return;
                  onSelectConversation(conversation.id);
                }}
                onKeyDown={(event) => {
                  if (conversationActionLoading) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectConversation(conversation.id);
                  }
                }}
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
                    className="icon-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRenameConversation(conversation.id, conversation.title);
                    }}
                    disabled={conversationActionLoading}
                  >
                    <Edit3 className="h-4 w-4" />
                    <span className="sr-only">대화 제목 편집</span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteConversation(conversation.id, conversation.title);
                    }}
                    disabled={conversationActionLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">대화 삭제</span>
                  </button>
                </div>
              </div>
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
      <div className="sidebar-brand">
        <div className="sidebar-brand__logo" aria-label="메인 로고" role="img">
          <ChatLogo className="chat-logo-icon" />
        </div>
        <button
          type="button"
          className="sidebar-toggle inline"
          onClick={onToggleSidebar}
          aria-label="사이드바 닫기"
          title="사이드바 닫기"
        >
          <span className="sidebar-toggle-icon" aria-hidden="true">
            <span />
            <span />
          </span>
          <span className="sr-only">사이드바 닫기</span>
        </button>
      </div>
      <div className="sidebar-header">
        <div>
          <p className="sidebar-label">대화 기록</p>
        </div>
        {!isGuestMode && (
          <button
            type="button"
            className="ghost-btn rounded-full text-sm font-semibold"
            onClick={handleCreateConversation}
            disabled={conversationLoading || conversationActionLoading}
          >
            + 새 채팅
          </button>
        )}
      </div>
      {renderConversationSection()}
      <div className="sidebar-divider" role="presentation" />
      <footer className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {(userName?.[0] ?? (isGuestMode ? 'G' : 'U')).toUpperCase()}
          </div>
          <div>
            <strong>{userName ?? (isGuestMode ? '게스트' : '사용자')}</strong>
            <span>{isGuestMode ? '로그인 필요' : userEmail ?? ''}</span>
          </div>
        </div>
        <div className="sidebar-footer-actions">
          <button type="button" className="link-btn" onClick={() => onRequestAuth?.()}>
            계정 관리
          </button>
        </div>
      </footer>
    </aside>
  );
}
