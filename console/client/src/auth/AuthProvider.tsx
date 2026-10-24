// AuthProvider — 05 B2（X07 UI 侧）：session 探测上下文；loading 未决期间 RequireAuth 不渲染受护内容（H02 防闪现）
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface AuthState {
  authenticated: boolean;
  account: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const json = (await res.json()) as { authenticated: boolean; account?: string };
      setAuthenticated(json.authenticated);
      setAccount(json.account ?? null);
    } catch {
      setAuthenticated(false);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* console 不可达也照常清态跳转 */ }
    setAuthenticated(false);
    setAccount(null);
  };

  useEffect(() => { void refresh(); }, []);

  return (
    <AuthContext.Provider value={{ authenticated, account, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}
