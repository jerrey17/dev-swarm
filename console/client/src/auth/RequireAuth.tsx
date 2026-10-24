// RequireAuth — 05 B2（H02）：session 未决渲染空白加载态（不闪现正文）；未登录连来源 location 一起送去 /login
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequireAuth() {
  const { authenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="h-screen skin-bg-content" />;
  if (!authenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
