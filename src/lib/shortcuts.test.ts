import {
  activeScopes,
  comboFromEvent,
  dispatchShortcut,
  installShortcuts,
  normalizeCombo,
  popScope,
  pushScope,
  register,
  resetShortcuts,
  setShortcutPlatform,
} from './shortcuts'

function keydown(key: string, init: KeyboardEventInit = {}, target: EventTarget = window): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

beforeEach(() => {
  resetShortcuts()
  setShortcutPlatform('other')
})

describe('normalizeCombo', () => {
  it('orders modifiers and lower-cases letters', () => {
    expect(normalizeCombo('shift+ctrl+K')).toBe('Ctrl+Shift+k')
    expect(normalizeCombo('Meta+Alt+p')).toBe('Alt+Meta+p')
  })

  it('canonicalises key names case-insensitively', () => {
    expect(normalizeCombo('escape')).toBe('Escape')
    expect(normalizeCombo('ctrl+arrowup')).toBe('Ctrl+ArrowUp')
    expect(normalizeCombo('Enter')).toBe('Enter')
  })

  it('keeps punctuation keys', () => {
    expect(normalizeCombo('Mod+,')).toBe('Ctrl+,')
    expect(normalizeCombo('Ctrl++')).toBe('Ctrl++')
  })

  it('resolves Mod per platform', () => {
    setShortcutPlatform('other')
    expect(normalizeCombo('Mod+k')).toBe('Ctrl+k')
    setShortcutPlatform('mac')
    expect(normalizeCombo('Mod+k')).toBe('Meta+k')
    expect(normalizeCombo('Cmd+k')).toBe('Meta+k')
  })

  it('rejects unknown modifiers', () => {
    expect(() => normalizeCombo('Hyper+k')).toThrow(/Unknown modifier/)
  })
})

describe('comboFromEvent', () => {
  it('builds the canonical combo', () => {
    const event = new KeyboardEvent('keydown', { key: 'K', ctrlKey: true, shiftKey: true })
    expect(comboFromEvent(event)).toBe('Ctrl+Shift+k')
    expect(comboFromEvent(new KeyboardEvent('keydown', { key: ' ' }))).toBe('Space')
  })

  it('ignores lone modifier presses', () => {
    expect(comboFromEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true }))).toBeNull()
  })
})

describe('registry', () => {
  it('dispatches to a registered handler and prevents default', () => {
    const handler = vi.fn()
    const cleanup = installShortcuts()
    register('global', 'Mod+k', handler)
    const event = keydown('k', { ctrlKey: true })
    expect(handler).toHaveBeenCalledWith(event)
    expect(event.defaultPrevented).toBe(true)
    cleanup()
  })

  it('stops dispatching after unregister and after cleanup', () => {
    const handler = vi.fn()
    const cleanup = installShortcuts()
    const unregister = register('global', 'Escape', handler)
    keydown('Escape')
    unregister()
    keydown('Escape')
    expect(handler).toHaveBeenCalledTimes(1)

    register('global', 'Escape', handler)
    cleanup()
    keydown('Escape')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('prefers the topmost scope and tracks the stack', () => {
    const global = vi.fn()
    const dialog = vi.fn()
    register('global', 'Escape', global)
    register('dialog', 'Escape', dialog)

    dispatchShortcut(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(global).toHaveBeenCalledTimes(1)
    expect(dialog).not.toHaveBeenCalled()

    pushScope('dialog')
    expect(activeScopes()).toEqual(['global', 'dialog'])
    dispatchShortcut(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(dialog).toHaveBeenCalledTimes(1)
    expect(global).toHaveBeenCalledTimes(1)

    popScope('dialog')
    expect(activeScopes()).toEqual(['global'])
    dispatchShortcut(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(global).toHaveBeenCalledTimes(2)
  })

  it('falls through to lower scopes when a handler returns false', () => {
    const global = vi.fn()
    const chat = vi.fn(() => false)
    register('global', 'Mod+f', global)
    register('chat', 'Mod+f', chat)
    pushScope('chat')
    const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, cancelable: true })
    expect(dispatchShortcut(event)).toBe(true)
    expect(chat).toHaveBeenCalledTimes(1)
    expect(global).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('returns false and leaves the event alone when nothing matches', () => {
    const event = new KeyboardEvent('keydown', { key: 'x', cancelable: true })
    expect(dispatchShortcut(event)).toBe(false)
    expect(event.defaultPrevented).toBe(false)
  })

  it('ignores plain keys typed into inputs but not Escape or modified combos', () => {
    const plain = vi.fn()
    const escape = vi.fn()
    const modified = vi.fn()
    register('global', 'j', plain)
    register('global', 'Escape', escape)
    register('global', 'Mod+Enter', modified)
    const cleanup = installShortcuts()

    const input = document.createElement('input')
    document.body.append(input)
    keydown('j', {}, input)
    keydown('Escape', {}, input)
    keydown('Enter', { ctrlKey: true }, input)
    expect(plain).not.toHaveBeenCalled()
    expect(escape).toHaveBeenCalledTimes(1)
    expect(modified).toHaveBeenCalledTimes(1)

    const editable = document.createElement('div')
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    document.body.append(editable)
    keydown('j', {}, editable)
    expect(plain).not.toHaveBeenCalled()

    keydown('j')
    expect(plain).toHaveBeenCalledTimes(1)
    cleanup()
    input.remove()
    editable.remove()
  })

  it('matches Mod against the injected platform', () => {
    setShortcutPlatform('mac')
    const handler = vi.fn()
    register('global', 'Mod+k', handler)
    dispatchShortcut(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    expect(handler).not.toHaveBeenCalled()
    dispatchShortcut(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
