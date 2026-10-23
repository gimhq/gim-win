/* eslint-disable react-refresh/only-export-components -- the hook and the theme constants belong next to the provider */
import type { ReactNode } from 'react'
import * as React from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'gim.theme'
export const THEMES: readonly Theme[] = ['light', 'dark', 'system']

export interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

const DARK_QUERY = '(prefers-color-scheme: dark)'

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return THEMES.includes(stored as Theme)
    ? (stored as Theme)
    : 'system'
}

function toResolved(dark: boolean): ResolvedTheme {
  return dark ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = React.useState<Theme>(readStoredTheme)
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>(
    () => toResolved(window.matchMedia(DARK_QUERY).matches),
  )

  // Follow the OS preference while in system mode.
  React.useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(toResolved(event.matches))
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme: ResolvedTheme = selected === 'system'
    ? systemTheme
    : selected

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setTheme = React.useCallback((next: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, next)
    setSelected(next)
  }, [])

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme: selected, resolvedTheme, setTheme }),
    [selected, resolvedTheme, setTheme],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const context = React.use(ThemeContext)
  if (!context)
    throw new Error('useTheme must be used within ThemeProvider')
  return context
}
