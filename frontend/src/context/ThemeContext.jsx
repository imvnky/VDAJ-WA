/**
 * VDAJ Services — Theme Context
 * 3-mode: dark (default) | light | colorful
 * Applies CSS custom properties via data-theme on <html>
 * Persists to localStorage
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export const THEMES = {
  light: { id: 'light', label: 'Light', icon: '☀️' },
};

const STORAGE_KEY = 'vdaj_theme';

export function ThemeProvider({ children }) {
  const [theme] = useState('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
    localStorage.setItem(STORAGE_KEY, 'light');
  }, []);

  const setTheme = useCallback(() => {}, []);
  const cycleTheme = useCallback(() => {}, []);

  return (
    <ThemeContext.Provider value={{ theme: 'light', setTheme, cycleTheme, themes: THEMES }}>
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
