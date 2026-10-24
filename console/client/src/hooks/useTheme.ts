import { useState, useEffect } from 'react';

// ── 主题 + 皮肤切换 Hook（迁移自 claude-board，localStorage key 换 dev-swarm 前缀） ──
// theme: dark / light（明暗模式）；skin: blue/green/purple/orange/rose（配色方案）
// 持久化到 localStorage，自动同步 <html> class + data-skin

export type Theme = 'dark' | 'light';
export type Skin = 'blue' | 'green' | 'purple' | 'orange' | 'rose';

export interface SkinOption {
  readonly id: Skin;
  readonly label: string;
  readonly color: string;
}

export const SKIN_OPTIONS: readonly SkinOption[] = [
  { id: 'blue',   label: '默认蓝', color: '#3B82F6' },
  { id: 'green',  label: '极客绿', color: '#10B981' },
  { id: 'purple', label: '商务紫', color: '#8B5CF6' },
  { id: 'orange', label: '暖橙',   color: '#F97316' },
  { id: 'rose',   label: '玫瑰粉', color: '#F43F5E' },
] as const;

const THEME_KEY = 'dev-swarm-theme';
const SKIN_KEY = 'dev-swarm-skin';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem(THEME_KEY) as Theme) ?? 'dark';
  });

  const [skin, setSkin] = useState<Skin>(() => {
    if (typeof window === 'undefined') return 'blue';
    return (localStorage.getItem(SKIN_KEY) as Skin) ?? 'blue';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-skin', skin);
    localStorage.setItem(SKIN_KEY, skin);
  }, [skin]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return { theme, toggleTheme, skin, setSkin } as const;
}
