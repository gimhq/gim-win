import type { ReactElement } from 'react'
import type { ChatSummary, Session } from '@/lib/api'
import { invoke } from '@tauri-apps/api/core'
import { render } from '@testing-library/react'
import { Providers } from '@/app/providers'
import { resetShortcuts, setShortcutPlatform } from '@/lib/shortcuts'
import { composerStore } from '../composer/store'
import { chatListStore } from '../store'

// Not shared with ../test-utils on purpose: that module imports the whole route tree,
// which makes every component test file as heavy as a shell test.

export type CommandHandlers = Record<string, (args: Record<string, unknown> | undefined) => unknown>

export const SESSION: Session = {
  userId: 'u-self',
  deviceId: 'device-1',
  handle: 'roy',
  displayName: 'Roy Batty',
}

export function chat(chatId: string, overrides: Partial<ChatSummary> = {}): ChatSummary {
  return {
    chatId,
    kind: 'Direct',
    name: chatId,
    avatar: null,
    lastMessage: null,
    unreadCount: 0,
    updatedAtMs: 0,
    memberCount: 2,
    state: 'Active',
    peer: null,
    mutedUntilMs: 0,
    pinned: false,
    archived: false,
    blocked: false,
    ...overrides,
  }
}

/** Renders `ui` inside the app providers with `chats` listed and a mocked bridge. */
export function renderWithChats(ui: ReactElement, chats: ChatSummary[], commands: CommandHandlers = {}) {
  setShortcutPlatform('other')
  resetShortcuts()
  composerStore.getState().reset()
  chatListStore.setState({ chats, status: 'ready', error: null })
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command in commands)
      return commands[command](args as Record<string, unknown> | undefined)
    return command === 'session'
      ? SESSION
      : null
  })
  const result = render(<Providers>{ui}</Providers>)
  return {
    ...result,
    rerender: (next: ReactElement) => result.rerender(<Providers>{next}</Providers>),
  }
}

/** The arguments of every `invoke` of `command`, in call order. */
export function callsOf(command: string): unknown[] {
  return vi.mocked(invoke).mock.calls.filter(([name]) => name === command).map(([, args]) => args)
}
