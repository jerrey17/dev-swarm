import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { SwarmLogo } from '../components/SwarmLogo';
import { ThemeToggle } from '../components/ThemeToggle';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../auth/AuthProvider';

// ── MainLayout 侧边栏（F02/D002 X04：四组六页——工作空间/监控/知识库/系统；流程定义归「系统」组） ──

interface NavItem {
  path: string;
  label: string;
  icon?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  bg: string;
  titleColor: string;
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: '工作空间',
    bg: 'bg-amber-50/50 dark:bg-amber-900/10',
    titleColor: 'text-amber-700 dark:text-amber-300',
    items: [
      { path: '/', label: '工作空间', icon: '工' },
    ],
  },
  {
    title: '监控',
    bg: 'bg-rose-50/50 dark:bg-rose-900/10',
    titleColor: 'text-rose-700 dark:text-rose-300',
    items: [
      { path: '/blockages', label: '阻塞', icon: '阻' },
      { path: '/reverify', label: '待复验', icon: '复' },
    ],
  },
  {
    title: '知识库',
    bg: 'bg-emerald-50/50 dark:bg-emerald-900/10',
    titleColor: 'text-emerald-700 dark:text-emerald-300',
    items: [
      { path: '/knowledge', label: '知识库', icon: '知' },
    ],
  },
  {
    title: '系统',
    bg: 'bg-slate-50/60 dark:bg-slate-800/20',
    titleColor: 'text-slate-600 dark:text-slate-300',
    items: [
      { path: '/pipeline', label: '流程定义', icon: '流' },
      { path: '/config', label: '配置', icon: '置' },
    ],
  },
];

export function MainLayout() {
  const { theme, toggleTheme, skin, setSkin } = useTheme();
  const { account, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // 详情页保持「工作空间」导航高亮（H05：标识符/路由不动，仅文案改名）
  const isRequirementDetail = location.pathname.startsWith('/requirements/');

  return (
    <div className="h-screen flex skin-bg-content skin-text transition-colors">
      {/* Sidebar */}
      <aside
        className={`shrink-0 border-r skin-bg-sidebar skin-border-sidebar flex flex-col transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        {/* Logo + collapse */}
        <div
          className={`py-4 flex ${
            collapsed ? 'flex-col items-center gap-2 px-2' : 'items-center justify-between px-3'
          }`}
        >
          <div className={`flex items-center min-w-0 ${collapsed ? '' : 'gap-2 pl-1'}`}>
            <SwarmLogo />
            {!collapsed && (
              <h1 className="text-lg font-semibold tracking-tight skin-text truncate">dev-swarm</h1>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
                       dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors shrink-0"
            title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        {/* Grouped nav */}
        <nav className="flex-1 px-2 overflow-y-auto space-y-2 thin-scroll">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className={`rounded-lg px-1 py-1.5 ${group.bg}`}>
              {!collapsed && (
                <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${group.titleColor}`}>
                  {group.title}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) => {
                      const active = isActive || (item.path === '/' && isRequirementDetail);
                      return `flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        collapsed ? 'justify-center' : ''
                      } ${
                        active
                          ? 'skin-nav-active'
                          : 'skin-text-secondary hover:skin-text hover:bg-white/60 dark:hover:bg-white/5'
                      }`;
                    }}
                  >
                    {collapsed ? (item.icon || item.label.charAt(0)) : item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: theme + skin toggle + logout（05 B2/F03：退出即失效 H07） */}
        {!collapsed && (
          <div className="px-4 py-3 border-t skin-border-sidebar">
            <ThemeToggle
              theme={theme}
              onToggle={toggleTheme}
              skin={skin}
              onSkinChange={setSkin}
            />
            <button
              onClick={() => void logout()}
              className="mt-2 w-full text-left text-xs skin-text-secondary hover:skin-text"
            >
              退出登录{account ? `（${account}）` : ''}
            </button>
          </div>
        )}
        {collapsed && (
          <div className="px-2 py-3 border-t skin-border-sidebar flex flex-col items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600
                         dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              title={theme === 'dark' ? '切换亮色' : '切换暗色'}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <button
              onClick={() => void logout()}
              className="p-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-600
                         dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              title="退出登录"
            >
              出
            </button>
          </div>
        )}
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
