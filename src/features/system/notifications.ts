import type { ChatSummary } from '@/lib/api'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useSettingsStore } from '@/features/settings/store'
import { notify } from '@/features/settings/system-api'
import { i18n } from '@/i18n'
import { useUnreadStore } from './unread-store'

/** Emitted by the Rust side when a notification is clicked; payload `{chatId}`. */
export const NOTIFICATION_CLICKED = 'notification-clicked'

export interface WindowState {
  hidden: boolean
  focused: boolean
}

export interface MessageNotificationOptions {
  getWindowState?: () => Promise<WindowState>
  /** Called with the chat id of a clicked notification. */
  onOpenChat: (chatId: string) => void
}

/** The main window state; `document.hasFocus()` when no Tauri window is available. */
export async function currentWindowState(): Promise<WindowState> {
  try {
    const window = getCurrentWindow()
    const [visible, focused] = await Promise.all([
      window.isVisible(),
      window.isFocused(),
    ])
    return { hidden: !visible, focused }
  }
  catch {
    const focused = document.hasFocus()
    return { hidden: false, focused }
  }
}

interface Seen {
  sentAtMs: number
  unreadCount: number
}

function isNewIncoming(chat: ChatSummary, seen: Seen | undefined): boolean {
  const message = chat.lastMessage
  if (!message || message.isOwn)
    return false
  if (chat.mutedUntilMs > Date.now())
    return false
  return message.sentAtMs > (seen?.sentAtMs ?? 0) && chat.unreadCount > (seen?.unreadCount ?? 0)
}

function bodyFor(chat: ChatSummary, showText: boolean): string {
  const message = chat.lastMessage!
  if (!showText)
    return i18n.t('common:notifications.newMessage')
  return chat.kind === 'Group'
    ? `${message.senderName}: ${message.text}`
    : message.text
}

async function show(chat: ChatSummary, getWindowState: () => Promise<WindowState>): Promise<void> {
  if (!useSettingsStore.getState().settings.notifications.enabled)
    return
  const { hidden, focused } = await getWindowState()
  if (!hidden && focused)
    return
  const { showText } = useSettingsStore.getState().settings.notifications
  await notify(chat.name, bodyFor(chat, showText), chat.chatId)
}

/**
 * Shows an OS notification for each new incoming message of the chat list
 * while the window is hidden or unfocused, per the Notifications settings,
 * and forwards notification clicks to `onOpenChat`. Returns the cleanup.
 */
export function installMessageNotifications({
  getWindowState = currentWindowState,
  onOpenChat,
}: MessageNotificationOptions): () => void {
  const seen = new Map<string, Seen>()
  const remember = (chats: ChatSummary[]) => {
    seen.clear()
    for (const chat of chats)
      seen.set(chat.chatId, { sentAtMs: chat.lastMessage?.sentAtMs ?? 0, unreadCount: chat.unreadCount })
  }
  remember(useUnreadStore.getState().chats)

  const unsubscribe = useUnreadStore.subscribe((state, previous) => {
    if (state.chats === previous.chats)
      return
    // The first load is the existing backlog, not new messages.
    const fresh = previous.loaded
      ? state.chats.filter(chat => isNewIncoming(chat, seen.get(chat.chatId)))
      : []
    remember(state.chats)
    for (const chat of fresh) {
      show(chat, getWindowState).catch((error: unknown) => {
        console.error('notify failed', error)
      })
    }
  })

  let disposed = false
  let unlisten: (() => void) | null = null
  listen<{ chatId: string }>(NOTIFICATION_CLICKED, ({ payload }) => onOpenChat(payload.chatId))
    .then((fn) => {
      if (disposed)
        fn()
      else
        unlisten = fn
    })
    .catch((error: unknown) => {
      console.error(`listen ${NOTIFICATION_CLICKED} failed`, error)
    })

  return () => {
    disposed = true
    unsubscribe()
    unlisten?.()
  }
}
