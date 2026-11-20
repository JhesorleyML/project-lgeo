import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useMapFilterStore } from '../../store/useMapFilterStore';

export const ThemeToggleButton: React.FC = () => {
  const { themeMode, toggleThemeMode } = useMapFilterStore();
  const isLight = themeMode === 'light';

  return (
    <button
      type="button"
      onClick={toggleThemeMode}
      title={
        isLight
          ? 'Switch to Dark Mode (Obsidian Theme)'
          : 'Switch to Light Mode (Daylight Theme)'
      }
      aria-label={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/90 px-2.5 py-1.5 text-xs font-semibold text-slate-100 shadow-sm transition hover:border-sky-500/60 hover:bg-slate-800"
    >
      {isLight ? (
        <>
          <Sun className="h-4 w-4 text-amber-500" />
          <span className="hidden md:inline">Light</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 text-sky-400" />
          <span className="hidden md:inline">Dark</span>
        </>
      )}
    </button>
  );
};
