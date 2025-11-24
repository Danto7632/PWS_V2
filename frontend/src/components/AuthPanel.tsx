import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

export function AuthPanel() {
  const { login, register, loading } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === 'register';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      if (isRegister) {
        await register(email.trim(), password, displayName.trim());
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setError((err as Error).message ?? '인증 과정에서 오류가 발생했습니다.');
    }
  };

  const canSubmit = email.trim() && password.trim() && (!isRegister || displayName.trim());

  return (
    <div className="auth-panel">
      <div className="auth-card">
        <div className="auth-header">
          <span className="hero-badge">🔐 보안 로그인</span>
          <h1>🍑 실전형 업무 시뮬레이터</h1>
          <p>먼저 계정을 생성하거나 로그인해 개인화된 시뮬레이션을 시작하세요.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="error-banner">{error}</div>}
          <label className="auth-label">
            이메일
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
            />
          </label>
          {isRegister && (
            <label className="auth-label">
              표시 이름
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="홍길동"
                required
              />
            </label>
          )}
          <label className="auth-label">
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8자 이상 입력"
              minLength={8}
              required
            />
          </label>
          <button className="primary-btn" type="submit" disabled={loading || !canSubmit}>
            {loading ? '처리 중...' : isRegister ? '회원가입' : '로그인'}
          </button>
        </form>
        <p className="auth-switcher">
          {isRegister ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?'}
          <button
            type="button"
            className="link-btn"
            onClick={() => setMode(isRegister ? 'login' : 'register')}
            disabled={loading}
          >
            {isRegister ? '로그인하기' : '회원가입'}
          </button>
        </p>
      </div>
    </div>
  );
}
