/**
 * VDAJ Services — Theme Context
 * 3-mode: dark (default) | light | colorful
 * Applies CSS custom properties via data-theme on <html>
 * Persists to localStorage
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export const THEMES = {
  dark:     { id: 'dark',     label: 'Dark',     icon: '🌙' },
  light:    { id: 'light',    label: 'Light',    icon: '☀️' },
  colorful: { id: 'colorful', label: 'Colorful', icon: '🎨' },
};

const STORAGE_KEY = 'vdaj_theme';

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  });

  const applyTheme = useCallback((t) => {
    document.documentElement.setAttribute('data-theme', t);
    // Also set color-scheme for native browser elements
    document.documentElement.style.colorScheme = t === 'light' ? 'light' : 'dark';
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  const setTheme = useCallback((t) => {
    if (!THEMES[t]) return;
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  }, [applyTheme]);

  const cycleTheme = useCallback(() => {
    const order = ['dark', 'light', 'colorful'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
};

export default ThemeContext;
