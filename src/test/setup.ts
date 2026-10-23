import '@testing-library/jest-dom/vitest'

// The Tauri bridge is not available in jsdom; tests drive `invoke` and `listen`
// through these mocks (vi.mocked(invoke).mockResolvedValue(...)).
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve(null)),
}))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
}))

// jsdom does not implement scrolling; the router's scroll restoration calls it.
vi.stubGlobal('scrollTo', () => {})

// jsdom has no matchMedia; the theme provider queries the colour scheme.
vi.stubGlobal('matchMedia', (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}))
