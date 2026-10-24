import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { Requirements } from './pages/Requirements';
import { RequirementDetail } from './pages/RequirementDetail';
import { Pipeline } from './pages/Pipeline';
import { Blockages } from './pages/Blockages';
import { Reverify } from './pages/Reverify';
import { Config } from './pages/Config';
import { Knowledge } from './pages/Knowledge';
import { Login } from './pages/Login';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';

// 路由结构（03 X04/D002：四组六页；/ = 工作空间列表；+ /knowledge B3 填充）
// 05 B2（X07 UI 侧/X08）：/login 登录页；MainLayout 组包 RequireAuth（未登录深链一律落 /login，H02）；/login-design 设计稿路由已删（存档=git 历史）
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route element={<MainLayout />}>
              <Route index element={<Requirements />} />
              <Route path="requirements/:name" element={<RequirementDetail />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route path="blockages" element={<Blockages />} />
              <Route path="reverify" element={<Reverify />} />
              <Route path="config" element={<Config />} />
              <Route path="knowledge" element={<Knowledge />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
