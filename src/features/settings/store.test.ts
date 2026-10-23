import { invoke } from '@tauri-apps/api/core'
import { applyFontSize, DEFAULT_SETTINGS, selectFontSize, selectNotifications, selectTrayEnabled, useSettingsStore } from './store'

const mockedInvoke = vi.mocked(invoke)

const stored = {
  notifications: { enabled: false, sound: true, showText: false },
  fontSize: 'large',
  trayEnabled: false,
} as const

beforeEach(() => {
  mockedInvoke.mockReset()
  mockedInvoke.mockImplementation(async (command) => {
    if (command === 'settings_load')
      return stored
    return null
  })
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, loaded: false })
  document.documentElement.style.removeProperty('--app-font-size')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useSettingsStore', () => {
  it('starts with the defaults before load', () => {
    const state = useSettingsStore.getState()
    expect(state.loaded).toBe(false)
    expect(state.settings).toEqual({
      notifications: { enabled: true, sound: true, showText: true },
      fontSize: 'normal',
      trayEnabled: true,
    })
    expect(selectNotifications(state)).toEqual(DEFAULT_SETTINGS.notifications)
    expect(selectFontSize(state)).toBe('normal')
    expect(selectTrayEnabled(state)).toBe(true)
  })

  it('fills the settings from settings_load once', async () => {
    await useSettingsStore.getState().load()
    await useSettingsStore.getState().load()
    expect(mockedInvoke).toHaveBeenCalledTimes(1)
    expect(mockedInvoke).toHaveBeenCalledWith('settings_load', undefined)
    const state = useSettingsStore.getState()
    expect(state.loaded).toBe(true)
    expect(state.settings).toEqual(stored)
    expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('18px')
  })

  it('keeps the defaults and marks loaded when settings_load fails', async () => {
    mockedInvoke.mockRejectedValue(new Error('no store'))
    await useSettingsStore.getState().load()
    const state = useSettingsStore.getState()
    expect(state.loaded).toBe(true)
    expect(state.settings).toEqual(DEFAULT_SETTINGS)
    expect(console.error).toHaveBeenCalled()
  })

  it('merges a patch, applies it at once and saves the whole object', async () => {
    const pending = useSettingsStore.getState().update({
      notifications: { sound: false },
      fontSize: 'small',
    })
    expect(useSettingsStore.getState().settings).toEqual({
      notifications: { enabled: true, sound: false, showText: true },
      fontSize: 'small',
      trayEnabled: true,
    })
    expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('14px')
    await pending
    expect(mockedInvoke).toHaveBeenCalledWith('settings_save', {
      settings: {
        notifications: { enabled: true, sound: false, showText: true },
        fontSize: 'small',
        trayEnabled: true,
      },
    })
  })

  it('accepts an updater function', async () => {
    await useSettingsStore.getState().update(s => ({ ...s, trayEnabled: false }))
    expect(selectTrayEnabled(useSettingsStore.getState())).toBe(false)
    expect(mockedInvoke).toHaveBeenCalledWith('settings_save', {
      settings: { ...DEFAULT_SETTINGS, trayEnabled: false },
    })
  })

  it('keeps the optimistic value when the save is rejected', async () => {
    mockedInvoke.mockRejectedValue({ kind: 'Storage', message: 'disk full', reason: 'disk full' })
    await useSettingsStore.getState().update({ fontSize: 'extraLarge' })
    expect(selectFontSize(useSettingsStore.getState())).toBe('extraLarge')
    expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('20px')
    expect(console.error).toHaveBeenCalled()
  })
})

describe('applyFontSize', () => {
  it.each([
    ['small', '14px'],
    ['normal', '16px'],
    ['large', '18px'],
    ['extraLarge', '20px'],
  ] as const)('maps %s to %s', (fontSize, px) => {
    applyFontSize(fontSize)
    expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe(px)
  })
})
