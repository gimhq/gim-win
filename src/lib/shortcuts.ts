/**
 * Keyboard shortcut registry with stacked scopes.
 *
 * Combos are written as modifiers joined with "+" and a key name per
 * `KeyboardEvent.key`: "Mod+K", "Ctrl+Shift+Enter", "Escape", "Mod+,".
 * "Mod" is Ctrl on Windows and Linux and Meta on macOS.
 */

export type ShortcutHandler = (event: KeyboardEvent) => boolean | undefined | void
export type ShortcutPlatform = 'mac' | 'other'

export const GLOBAL_SCOPE = 'global'

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const
type Modifier = (typeof MODIFIER_ORDER)[number]

const MODIFIER_ALIASES: Record<string, Modifier | 'Mod'> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
  super: 'Meta',
  win: 'Meta',
  mod: 'Mod',
}

const KEY_NAMES = [
  'Enter',
  'Escape',
  'Tab',
  'Space',
  'Backspace',
  'Delete',
  'Insert',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
]
const KEY_NAME_BY_LOWER = new Map(KEY_NAMES.map(name => [
  name.toLowerCase(),
  name,
]))

const MODIFIER_KEYS = new Set([
  'Control',
  'Alt',
  'Shift',
  'Meta',
  'OS',
])

let platform: ShortcutPlatform = detectPlatform()

function detectPlatform(): ShortcutPlatform {
  if (typeof navigator === 'undefined')
    return 'other'
  return /mac|iphone|ipad/i.test(navigator.platform ?? navigator.userAgent ?? '')
    ? 'mac'
    : 'other'
}

/** Overrides platform detection (tests, or the bridge telling us the OS). */
export function setShortcutPlatform(next: ShortcutPlatform): void {
  platform = next
}

export function shortcutPlatform(): ShortcutPlatform {
  return platform
}

function canonicalKey(raw: string): string {
  if (raw === ' ')
    return 'Space'
  if (raw.length === 1)
    return raw.toLowerCase()
  return KEY_NAME_BY_LOWER.get(raw.toLowerCase()) ?? raw
}

function joinCombo(modifiers: Set<Modifier>, key: string): string {
  return [
    ...MODIFIER_ORDER.filter(m => modifiers.has(m)),
    key,
  ].join('+')
}

/** Canonical form: modifiers in a fixed order, Mod resolved, letters lower-case. */
export function normalizeCombo(combo: string): string {
  const parts = combo.split('+').map(part => part.trim()).filter(Boolean)
  // "Mod+," splits cleanly; a trailing "+" means the key itself is "+".
  if (combo.trim().endsWith('+'))
    parts.push('+')
  if (parts.length === 0)
    throw new Error(`Empty shortcut combo: "${combo}"`)

  const modifiers = new Set<Modifier>()
  const key = parts.pop()!
  for (const part of parts) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()]
    if (!modifier)
      throw new Error(`Unknown modifier "${part}" in combo "${combo}"`)
    modifiers.add(modifier === 'Mod'
      ? (platform === 'mac'
          ? 'Meta'
          : 'Ctrl')
      : modifier)
  }
  return joinCombo(modifiers, canonicalKey(key))
}

/** The normalised combo for a key event, or null for a lone modifier press. */
export function comboFromEvent(event: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(event.key))
    return null
  const modifiers = new Set<Modifier>()
  if (event.ctrlKey)
    modifiers.add('Ctrl')
  if (event.altKey)
    modifiers.add('Alt')
  if (event.shiftKey)
    modifiers.add('Shift')
  if (event.metaKey)
    modifiers.add('Meta')
  return joinCombo(modifiers, canonicalKey(event.key))
}

// scope -> combo -> handlers, most recently registered first
const registry = new Map<string, Map<string, ShortcutHandler[]>>()
// bottom to top; "global" is always index 0
const scopeStack: string[] = [GLOBAL_SCOPE]

export function register(scope: string, combo: string, handler: ShortcutHandler): () => void {
  const key = normalizeCombo(combo)
  let combos = registry.get(scope)
  if (!combos) {
    combos = new Map()
    registry.set(scope, combos)
  }
  const handlers = combos.get(key) ?? []
  handlers.unshift(handler)
  combos.set(key, handlers)
  return () => {
    const current = registry.get(scope)?.get(key)
    if (!current)
      return
    const index = current.indexOf(handler)
    if (index !== -1)
      current.splice(index, 1)
    if (current.length === 0)
      registry.get(scope)?.delete(key)
  }
}

/** Makes `scope` the topmost scope; re-pushing an active scope moves it to the top. */
export function pushScope(scope: string): void {
  if (scope === GLOBAL_SCOPE)
    return
  popScope(scope)
  scopeStack.push(scope)
}

export function popScope(scope: string): void {
  if (scope === GLOBAL_SCOPE)
    return
  const index = scopeStack.indexOf(scope)
  if (index !== -1)
    scopeStack.splice(index, 1)
}

/** Active scopes from bottom ("global") to top. */
export function activeScopes(): readonly string[] {
  return [...scopeStack]
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement))
    return false
  if (target.isContentEditable)
    return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** Dispatches a key event; exported for tests and for callers that own their own listener. */
export function dispatchShortcut(event: KeyboardEvent): boolean {
  const combo = comboFromEvent(event)
  if (!combo)
    return false
  const hasCommandModifier = event.ctrlKey || event.metaKey || event.altKey
  if (isEditable(event.target) && !hasCommandModifier && event.key !== 'Escape')
    return false

  for (let i = scopeStack.length - 1; i >= 0; i--) {
    const handlers = registry.get(scopeStack[i]!)?.get(combo)
    if (!handlers)
      continue
    for (const handler of [...handlers]) {
      if (handler(event) !== false) {
        event.preventDefault()
        return true
      }
    }
  }
  return false
}

/** Installs the single window keydown listener; returns its cleanup. */
export function installShortcuts(target: Window = window): () => void {
  const listener = (event: KeyboardEvent) => {
    dispatchShortcut(event)
  }
  target.addEventListener('keydown', listener)
  return () => target.removeEventListener('keydown', listener)
}

/** Clears every registration and scope; for tests. */
export function resetShortcuts(): void {
  registry.clear()
  scopeStack.splice(1)
}
