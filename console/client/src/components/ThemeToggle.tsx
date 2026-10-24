// ── 主题 + 皮肤切换组件（迁移自 claude-board） ──

import type { Theme, Skin } from '../hooks/useTheme';
import { SKIN_OPTIONS } from '../hooks/useTheme';

interface ThemeToggleProps {
  readonly theme: Theme;
  readonly onToggle: () => void;
  readonly skin: Skin;
  readonly onSkinChange: (skin: Skin) => void;
}

export function ThemeToggle({ theme, onToggle, skin, onSkinChange }: ThemeToggleProps) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] text-gray-400 dark:text-gray-600 mb-1.5 uppercase tracking-wider">
          Theme
        </div>
        <div className="flex gap-1.5">
          {SKIN_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onSkinChange(opt.id)}
              className={`w-6 h-6 rounded-full border-2 transition-all ${
                skin === opt.id
                  ? 'border-gray-800 dark:border-white scale-110 shadow-sm'
                  : 'border-transparent hover:scale-105 opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: opt.color }}
              title={opt.label}
            />
          ))}
        </div>
      </div>

      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs
                   text-gray-500 hover:text-gray-800 hover:bg-gray-100
                   dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800/50
                   transition-colors"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
        <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
      </button>
    </div>
  );
}
