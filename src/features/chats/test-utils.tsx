import type { EventCallback } from '@tauri-apps/api/event'
import type { ChatSummary, StartupInfo } from '@/lib/api'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { act, render, waitFor } from '@testing-library/react'
import { Providers } from '@/app/providers'
import { routeTree } from '@/app/routeTree.gen'
import { EVENT_CHAT_LIST_DIFF } from '@/lib/api'
import { resetShortcuts, setShortcutPlatform } from '@/lib/shortcuts'
import { useNewChatDialog } from './hooks/use-new-chat-dialog'
import { chatListStore } from './store'
import { timelineStore } from './timeline/store'

export const SESSION: NonNullable<StartupInfo['session']> = {
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

/** Bridge commands answered by the test; the shell's own commands have defaults. */
export type CommandHandlers = Record<string, (args: Record<string, unknown> | undefined) => unknown>

let listeners: Record<string, EventCallback<unknown>> = {}

/** Renders the whole app at `path` with a signed-in session and a mocked bridge. */
export function renderShell(path: string, commands: CommandHandlers = {}) {
  listeners = {}
  setShortcutPlatform('other')
  resetShortcuts()
  chatListStore.getState().reset()
  timelineStore.setState({ byChat: {} })
  useNewChatDialog.setState({ open: false })
  vi.mocked(listen).mockImplementation(async (event, handler) => {
    listeners[event] = handler as EventCallback<unknown>
    return () => {}
  })
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command in commands)
      return commands[command](args as Record<string, unknown> | undefined)
    switch (command) {
      case 'startup':
        return {
          serverUrl: 'https://hub.example',
          clientReady: true,
          localStateReset: false,
          session: SESSION,
          error: null,
        } satisfies StartupInfo
      case 'session':
        return SESSION
      case 'subscribe_chat_list':
        return 'sub-1'
      default:
        return null
    }
  })
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [path],
    }),
  })
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  )
  return router
}

/** Delivers a chat list `Reset` once the shell has subscribed. */
export async function resetChatList(chats: ChatSummary[]): Promise<void> {
  await waitFor(() => expect(listeners[EVENT_CHAT_LIST_DIFF]).toBeDefined())
  act(() => {
    listeners[EVENT_CHAT_LIST_DIFF]({
      event: EVENT_CHAT_LIST_DIFF,
      id: 1,
      payload: {
        subscriptionId: 'sub-1',
        diffs: [
          { type: 'Reset', values: chats },
        ],
      },
    })
  })
}
