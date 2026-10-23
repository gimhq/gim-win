import * as React from 'react'
import { markRead } from '@/lib/api'
import { selectItems, useTimelineStore } from './store'

function isActive(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus()
}

/** Whether the window is visible and focused, re-evaluated on visibility and focus changes. */
function useWindowActive(): boolean {
  const [active, setActive] = React.useState(isActive)
  React.useEffect(() => {
    const update = () => setActive(isActive())
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    window.addEventListener('blur', update)
    return () => {
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
      window.removeEventListener('blur', update)
    }
  }, [])
  return active
}

/**
 * Marks the chat read up to its last item while the window is visible and
 * focused, once per new last message; failures are logged.
 */
export function useMarkRead(chatId: string): void {
  const items = useTimelineStore(selectItems(chatId))
  const active = useWindowActive()
  const markedRef = React.useRef<{ chatId: string, messageId: string } | null>(null)
  const last = items.at(-1)
  const messageId = last?.type === 'Message'
    ? last.item.messageId
    : null

  React.useEffect(() => {
    if (!active || messageId === null)
      return
    if (markedRef.current?.chatId === chatId && markedRef.current.messageId === messageId)
      return
    markedRef.current = { chatId, messageId }
    markRead(chatId, messageId).catch((error: unknown) => {
      console.error('mark_read failed', error)
    })
  }, [active, chatId, messageId])
}
