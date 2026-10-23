import * as React from 'react'
import { setTyping, stopTyping } from '@/lib/api'

/** Typing is reported at most this often while the user types. */
export const TYPING_THROTTLE_MS = 3000

function ignore(): void {}

/** Reports typing for `chatId`: `onInput` after each change of the input, `stop` on send. */
export function useTyping(chatId: string): { onInput: (text: string) => void, stop: () => void } {
  const lastSentRef = React.useRef<number | null>(null)

  const stop = React.useCallback(() => {
    lastSentRef.current = null
    stopTyping(chatId).catch(ignore)
  }, [chatId])

  const onInput = React.useCallback((text: string) => {
    if (!text) {
      stop()
      return
    }
    const now = Date.now()
    if (lastSentRef.current !== null && now - lastSentRef.current < TYPING_THROTTLE_MS)
      return
    lastSentRef.current = now
    setTyping(chatId, true).catch(ignore)
  }, [chatId, stop])

  React.useEffect(() => stop, [stop])

  return { onInput, stop }
}
