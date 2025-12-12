import { useEffect, useRef, useState } from 'react';
import { Mic, Plus, Send, Volume2 } from 'lucide-react';
import type { Role, ChatMessage } from '../types';

type Props = {
  activeRole: Role | null;
  messages: ChatMessage[];
  onSend: (message: string) => Promise<void>;
  disabled: boolean;
  loading: boolean;
  placeholderTitle?: string;
};

export function ChatWindow({
  activeRole,
  messages,
  onSend,
  disabled,
  loading,
  placeholderTitle,
}: Props) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const aiRole: Role | null = activeRole
    ? activeRole === 'customer'
      ? 'employee'
      : 'customer'
    : null;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || disabled || loading || !activeRole) return;
    await onSend(input.trim());
    setInput('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendMessage();
  };

  return (
    <div className="chat-window">
      <div className="chat-window__history" ref={listRef}>
        {messages.map((message) => {
          const isUser = activeRole && message.role === activeRole;
          const variant = message.role === 'system' ? 'system' : isUser ? 'user' : 'assistant';
          const label =
            message.role === 'customer'
              ? '고객'
              : message.role === 'employee'
                ? '직원'
                : '시스템';
          return (
            <div key={message.id} className={`chat-message chat-message--${variant}`}>
              <div className="chat-message__avatar">{label.slice(0, 1)}</div>
              <div className="chat-message__bubble">
                <div className="chat-message__meta">{label}</div>
                <p>{message.text}</p>
              </div>
            </div>
          );
        })}
        {loading && (
          <div className={`chat-message chat-message--${aiRole ? 'assistant' : 'system'}`}>
            <div className="chat-message__avatar">
              {aiRole ? (aiRole === 'customer' ? 'C' : 'E') : 'AI'}
            </div>
            <div className="chat-message__bubble">
              <div className="chat-message__meta">
                {aiRole ? (aiRole === 'customer' ? 'AI 고객' : 'AI 직원') : 'AI'}
              </div>
              <div className="typing-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
        {!messages.length && (
          <div className="chat-window__empty">
            <p className="chat-window__empty-title">{placeholderTitle ?? '새 시뮬레이션을 시작해보세요'}</p>
            <p className="chat-window__empty-text">
              {activeRole
                ? activeRole === 'customer'
                  ? 'AI 직원에게 문의 내용을 보내면 시뮬레이션이 시작됩니다.'
                  : 'AI 고객의 질문에 응답하면 시뮬레이션이 진행됩니다.'
                : '역할을 선택하면 메시지를 작성할 수 있어요.'}
            </p>
          </div>
        )}
      </div>
      <form className="chat-window__composer" onSubmit={handleSubmit}>
        <div className="composer-field">
          <button type="button" className="composer-icon" disabled>
            <Plus className="h-5 w-5" />
          </button>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={async (event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                await sendMessage();
              }
            }}
            rows={1}
            placeholder={
              activeRole
                ? activeRole === 'customer'
                  ? '고객으로서 문의 내용을 입력하세요...'
                  : '직원으로서 응답을 입력하세요...'
                : '역할을 선택하면 입력할 수 있어요.'
            }
            disabled={disabled || loading || !activeRole}
          />
          <div className="composer-tools">
            <button type="button" className="composer-icon" disabled>
              <Mic className="h-5 w-5" />
            </button>
            <button type="button" className="composer-icon" disabled>
              <Volume2 className="h-5 w-5" />
            </button>
            <button
              type="submit"
              className="composer-send"
              disabled={disabled || loading || !activeRole || !input.trim()}
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
        <p className="composer-hint">Extended thinking</p>
      </form>
    </div>
  );
}
