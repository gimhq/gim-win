import type { EventCallback } from '@tauri-apps/api/event'
import type { WindowState } from './notifications'
import type { ChatListDiff, ChatSummary, MessagePreview } from '@/lib/api/types'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { chatListStore } from '@/features/chats/store'
import { useSettingsStore } from '@/features/settings/store'
import { DEFAULT_SETTINGS } from '@/features/settings/system-api'
import { currentWindowState, installMessageNotifications, installUnreadBadge, NOTIFICATION_CLICKED } from './notifications'

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(),
}))

const mockedInvoke = vi.mocked(invoke)
const mockedListen = vi.mocked(listen)

function chatSummary(chatId: string, overrides: Partial<ChatSummary> = {}): ChatSummary {
  return {
    chatId,
    kind: 'Direct',
    name: `Chat ${chatId}`,
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

function message(text: string, sentAtMs: number, overrides: Partial<MessagePreview> = {}): MessagePreview {
  return {
    senderName: 'Ana',
    text,
    sentAtMs,
    isOwn: false,
    sendState: null,
    ...overrides,
  }
}

const first = chatSummary('c1', {
  name: 'Ana',
  lastMessage: message('hi', 1),
  unreadCount: 1,
})

let handlers: Record<string, EventCallback<unknown>>
let windowState: WindowState
let stop: () => void

function install(onOpenChat = vi.fn()) {
  stop = installMessageNotifications({
    getWindowState: async () => windowState,
    onOpenChat,
  })
  return onOpenChat
}

function applyDiffs(diffs: ChatListDiff[]): void {
  chatListStore.getState().applyChatListDiffs(diffs)
}

function setChats(chats: ChatSummary[]): void {
  applyDiffs([
    { type: 'Reset', values: chats },
  ])
}

function badgeCalls(): unknown[] {
  return mockedInvoke.mock.calls.filter(([command]) => command === 'set_badge_count').map(([, args]) => args)
}

function notifyCalls(): unknown[] {
  return mockedInvoke.mock.calls.filter(([command]) => command === 'notify').map(([, args]) => args)
}

async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

beforeEach(() => {
  handlers = {}
  windowState = { hidden: true, focused: false }
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS })
  chatListStore.getState().reset()
  setChats([first])
  mockedInvoke.mockReset()
  mockedInvoke.mockResolvedValue(null)
  mockedListen.mockReset()
  mockedListen.mockImplementation(async (event, handler) => {
    handlers[event] = handler as EventCallback<unknown>
    return () => {}
  })
})

afterEach(() => {
  stop()
})

describe('installMessageNotifications', () => {
  it('does not notify while the window is focused', async () => {
    windowState = { hidden: false, focused: true }
    install()
    setChats([
      {
        ...first,
        lastMessage: message('again', 2),
        unreadCount: 2,
      },
    ])
    await settle()
    expect(notifyCalls()).toEqual([])
  })

  it('notifies with the chat name and the text while hidden', async () => {
    install()
    setChats([
      {
        ...first,
        lastMessage: message('again', 2),
        unreadCount: 2,
      },
    ])
    await vi.waitFor(() => expect(notifyCalls()).toEqual([
      { title: 'Ana', body: 'again', chatId: 'c1' },
    ]))
  })

  it('prefixes the sender in a group chat', async () => {
    const group = chatSummary('g1', {
      kind: 'Group',
      name: 'Team',
      lastMessage: message('hi', 1),
      unreadCount: 0,
    })
    setChats([group])
    install()
    setChats([
      {
        ...group,
        lastMessage: message('ship it', 2, { senderName: 'Bo' }),
        unreadCount: 1,
      },
    ])
    await vi.waitFor(() => expect(notifyCalls()).toEqual([
      { title: 'Team', body: 'Bo: ship it', chatId: 'g1' },
    ]))
  })

  it('notifies a chat that appears after the list loaded', async () => {
    install()
    setChats([
      chatSummary('c2', {
        name: 'Bo',
        lastMessage: message('hello', 5),
        unreadCount: 1,
      }),
      first,
    ])
    await vi.waitFor(() => expect(notifyCalls()).toEqual([
      { title: 'Bo', body: 'hello', chatId: 'c2' },
    ]))
  })

  it('uses the generic body when showText is off', async () => {
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        notifications: { ...DEFAULT_SETTINGS.notifications, showText: false },
      },
    })
    install()
    setChats([
      {
        ...first,
        lastMessage: message('secret', 2),
        unreadCount: 2,
      },
    ])
    await vi.waitFor(() => expect(notifyCalls()).toEqual([
      { title: 'Ana', body: 'New message', chatId: 'c1' },
    ]))
  })

  it('never notifies own messages', async () => {
    install()
    setChats([
      {
        ...first,
        lastMessage: message('mine', 2, { isOwn: true }),
        unreadCount: 2,
      },
    ])
    await settle()
    expect(notifyCalls()).toEqual([])
  })

  it('never notifies when notifications are off', async () => {
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        notifications: { ...DEFAULT_SETTINGS.notifications, enabled: false },
      },
    })
    install()
    setChats([
      {
        ...first,
        lastMessage: message('again', 2),
        unreadCount: 2,
      },
    ])
    await settle()
    expect(notifyCalls()).toEqual([])
  })

  it('does not notify when the unread count did not grow', async () => {
    install()
    setChats([
      {
        ...first,
        lastMessage: message('read elsewhere', 2),
        unreadCount: 1,
      },
    ])
    await settle()
    expect(notifyCalls()).toEqual([])
  })

  it('does not notify the first list load', async () => {
    chatListStore.getState().reset()
    install()
    setChats([first])
    await settle()
    expect(notifyCalls()).toEqual([])
  })

  it('opens the chat when a notification is clicked', async () => {
    const onOpenChat = install()
    await vi.waitFor(() => expect(handlers[NOTIFICATION_CLICKED]).toBeDefined())
    handlers[NOTIFICATION_CLICKED]({
      event: NOTIFICATION_CLICKED,
      id: 1,
      payload: { chatId: 'c1' },
    })
    expect(onOpenChat).toHaveBeenCalledWith('c1')
  })
})

describe('installUnreadBadge', () => {
  beforeEach(() => {
    chatListStore.getState().reset()
    stop = installUnreadBadge()
  })

  it('sums the unread counts and follows them on the badge', () => {
    const a = chatSummary('a', { unreadCount: 2 })
    const b = chatSummary('b', { unreadCount: 3 })
    setChats([a, b])
    expect(badgeCalls()).toEqual([
      { count: 5 },
    ])

    applyDiffs([
      {
        type: 'Set',
        index: 0,
        value: { ...a, unreadCount: 0 },
      },
    ])
    expect(badgeCalls()).toEqual([
      { count: 5 },
      { count: 3 },
    ])

    applyDiffs([
      {
        type: 'Set',
        index: 0,
        value: { ...a, unreadCount: 0, name: 'Renamed' },
      },
    ])
    expect(badgeCalls()).toEqual([
      { count: 5 },
      { count: 3 },
    ])
  })

  it('sets the badge on the first reset even when the total is 0', () => {
    setChats([])
    expect(badgeCalls()).toEqual([
      { count: 0 },
    ])
  })

  it('leaves left chats out of the total', () => {
    setChats([
      chatSummary('a', { unreadCount: 2 }),
      chatSummary('b', { unreadCount: 4, state: 'Left' }),
    ])
    expect(badgeCalls()).toEqual([
      { count: 2 },
    ])
  })
})

describe('currentWindowState', () => {
  afterEach(() => {
    stop = () => {}
  })

  it('reads visibility and focus from the Tauri window', async () => {
    vi.mocked(getCurrentWindow).mockReturnValue({
      isVisible: async () => false,
      isFocused: async () => false,
    } as unknown as ReturnType<typeof getCurrentWindow>)
    await expect(currentWindowState()).resolves.toEqual({ hidden: true, focused: false })
  })

  it('falls back to document focus without a Tauri window', async () => {
    vi.mocked(getCurrentWindow).mockImplementation(() => {
      throw new Error('no window')
    })
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    await expect(currentWindowState()).resolves.toEqual({ hidden: false, focused: true })
  })
})
