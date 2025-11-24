import { useEffect, useRef, useState } from 'react';
import type { Role, ChatMessage } from '../types';

type Props = {
  role: Role;
  messages: ChatMessage[];
  onSend: (message: string) => Promise<void>;
  disabled: boolean;
  loading: boolean;
};

export function ChatWindow({ role, messages, onSend, disabled, loading }: Props) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const aiRole: Role = role === 'customer' ? 'employee' : 'customer';

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || disabled || loading) return;
    await onSend(input.trim());
    setInput('');
  };

  return (
    <div className="chat-window">
      <div className="chat-history" ref={listRef}>
        {messages.map((message) => {
          const bubbleClass =
            message.role === 'customer' ? 'customer' : message.role === 'employee' ? 'employee' : 'system';
          const label =
            message.role === 'customer'
              ? '고객'
              : message.role === 'employee'
                ? '직원'
                : '시스템';
          return (
            <div key={message.id} className={`chat-bubble ${bubbleClass}`}>
              <div className="chat-meta">{label}</div>
              <p>{message.text}</p>
            </div>
          );
        })}
        {loading && (
          <div className={`chat-bubble ${aiRole}`}>
            <div className="chat-meta">{aiRole === 'customer' ? 'AI 고객' : 'AI 직원'}</div>
            <div className="typing-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        {!messages.length && (
          <div className="chat-placeholder">
            {role === 'customer'
              ? 'AI 직원에게 문의해보세요.'
              : 'AI 고객의 질문에 응답해보세요.'}
          </div>
        )}
      </div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder={
            role === 'customer'
              ? '고객으로서 문의 내용을 입력하세요...'
              : '직원으로서 응답을 입력하세요...'
          }
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={disabled || loading}
        />
        <button type="submit" className="primary-btn" disabled={disabled || loading}>
          {loading ? '전송 중...' : '전송'}
        </button>
      </form>
    </div>
  );
}
