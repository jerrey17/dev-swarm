// Login — 05 B2（F01/F03/F04）：版 C 上线稿（拆自设计稿 LoginDesign.tsx·SplitBackdrop，git 历史存档）
// 裁剪（03 §四/X06）：无审核顶栏与三版链接；表单接真校验（POST /api/auth/login）；主题控件=表单卡片下方色点组+亮暗
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { SKIN_OPTIONS, useTheme } from '../hooks/useTheme';
import { useAuth } from '../auth/AuthProvider';

// BUG-001：原目标路由复原（pathname+search+hash 全量；无 from 回 '/'）——导出供单测
export function targetFrom(state: unknown): string {
  const from = (state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
  if (!from?.pathname) return '/';
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}

function MarkBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute left-[62%] top-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            'radial-gradient(circle, rgb(var(--skin-primary) / 0.28) 0%, rgb(var(--skin-primary) / 0.08) 42%, transparent 70%)',
        }}
      />
      <svg
        className="absolute left-[68%] top-1/2 w-[min(1120px,190%)] max-w-none -translate-x-1/2 -translate-y-1/2 text-[rgb(var(--skin-primary))] opacity-[0.42]"
        viewBox="0 0 32 32"
        fill="none"
      >
        <path d="M10.6 9.8 L19.4 14.6" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M10.6 22.2 L19.4 17.4" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="23.4" cy="16" r="3.7" fill="currentColor" />
        <circle cx="8.5" cy="8.2" r="2.45" fill="currentColor" />
        <circle cx="8.5" cy="23.8" r="2.45" fill="currentColor" />
      </svg>
    </div>
  );
}

export function Login() {
  const { authenticated, loading, refresh } = useAuth();
  const { theme, toggleTheme, skin, setSkin } = useTheme();
  const location = useLocation();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hint, setHint] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = targetFrom(location.state);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setHint('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ account, password }),
      });
      if (res.ok) {
        // BUG-001：跳转统一由下方短路接管——此处只刷新登录态，不再 navigate（双导航竞争会让 Navigate to='/' 盖掉原目标）
        await refresh();
        return;
      }
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setHint(json?.error ?? '登录失败，请稍后再试');
    } catch {
      setHint('无法连接控制台服务，请确认本机 console 已启动。');
    } finally {
      setSubmitting(false);
    }
  }

  if (!loading && authenticated) return <Navigate to={from} replace />;

  return (
    <div className="min-h-screen skin-bg-content grid lg:grid-cols-2">
      <section className="relative overflow-hidden skin-bg-sidebar border-b lg:border-b-0 lg:border-r skin-border-sidebar min-h-[28rem] lg:min-h-screen">
        <MarkBackdrop />
        <div className="relative z-10 px-8 py-16 lg:px-16 h-full min-h-[28rem] lg:min-h-screen flex flex-col justify-center">
          <p className="text-5xl lg:text-6xl font-semibold tracking-tight skin-text leading-none">dev-swarm</p>
          <h1 className="mt-8 text-2xl font-medium skin-text leading-snug max-w-md">控制台改为登录后才能查看</h1>
          <ul className="mt-6 space-y-3 max-w-md text-sm leading-6 skin-text-secondary">
            <li>需求正文、技术方案、TAPD 和研发计划地址，登录后才显示。</li>
            <li>账号由管理员发放，不开放自助注册。</li>
            <li>退出后，这台浏览器不再保留控制台页面。</li>
          </ul>
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-lg font-medium skin-text mb-1">登录</h2>
          <p className="text-xs skin-text-secondary mb-6">使用管理员发给你的账号。</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-xs skin-text-secondary mb-1.5">账号</span>
              <input
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                autoComplete="username"
                placeholder="公司邮箱或工号"
                className="w-full rounded-md border skin-border skin-bg-content px-3 py-2 text-sm skin-text outline-none focus:border-[rgb(var(--skin-primary))]"
              />
            </label>
            <label className="block">
              <span className="block text-xs skin-text-secondary mb-1.5">密码</span>
              <span className="flex rounded-md border skin-border skin-bg-content focus-within:border-[rgb(var(--skin-primary))]">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="管理员发放的密码"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm skin-text outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="shrink-0 px-3 text-xs skin-text-muted hover:skin-text"
                >
                  {showPassword ? '隐藏' : '显示'}
                </button>
              </span>
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="skin-btn-primary w-full rounded-md py-2 text-sm font-medium disabled:opacity-60"
            >
              {submitting ? '登录中…' : '登录'}
            </button>
            {hint ? <p className="text-xs leading-5 skin-primary">{hint}</p> : null}
          </form>
          <div className="mt-6 flex items-center justify-between">
            <span className="flex items-center gap-1.5" aria-label="配色">
              {SKIN_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSkin(opt.id)}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    skin === opt.id ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: opt.color }}
                  title={opt.label}
                  aria-label={opt.label}
                  aria-pressed={skin === opt.id}
                />
              ))}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              className="text-xs skin-text-secondary hover:underline"
              aria-label={theme === 'dark' ? '切换亮色' : '切换暗色'}
            >
              {theme === 'dark' ? '亮色' : '暗色'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
