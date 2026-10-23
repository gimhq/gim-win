import { create } from 'zustand'

export interface JumpRequest {
  chatId: string
  messageId: string
}

interface JumpState {
  /** A message to scroll to once the chat's timeline is ready; the message list consumes it. */
  request: JumpRequest | null
  requestJump: (chatId: string, messageId: string) => void
  clear: () => void
}

export const useJumpRequest = create<JumpState>()(set => ({
  request: null,
  requestJump: (chatId, messageId) => set({
    request: { chatId, messageId },
  }),
  clear: () => set({ request: null }),
}))
