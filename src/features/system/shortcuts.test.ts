import { invoke } from '@tauri-apps/api/core'
import { dispatchShortcut, resetShortcuts, setShortcutPlatform } from '@/lib/shortcuts'
import { installAppShortcuts } from './shortcuts'

const mockedInvoke = vi.mocked(invoke)

function press(key: string): boolean {
  return dispatchShortcut(new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true }))
}

beforeEach(() => {
  setShortcutPlatform('other')
  resetShortcuts()
  mockedInvoke.mockReset()
  mockedInvoke.mockResolvedValue(null)
})

describe('installAppShortcuts', () => {
  it('maps Ctrl+, Ctrl+Q and Ctrl+W', () => {
    const openSettings = vi.fn()
    installAppShortcuts({ openSettings })

    expect(press(',')).toBe(true)
    expect(openSettings).toHaveBeenCalledTimes(1)

    expect(press('q')).toBe(true)
    expect(mockedInvoke).toHaveBeenCalledWith('quit_app', undefined)

    expect(press('w')).toBe(true)
    expect(mockedInvoke).toHaveBeenCalledWith('hide_to_tray', undefined)
  })

  it('fires nothing after unregister', () => {
    const openSettings = vi.fn()
    const unregister = installAppShortcuts({ openSettings })
    unregister()

    expect(press(',')).toBe(false)
    expect(press('q')).toBe(false)
    expect(press('w')).toBe(false)
    expect(openSettings).not.toHaveBeenCalled()
    expect(mockedInvoke).not.toHaveBeenCalled()
  })
})
