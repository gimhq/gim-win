import type { MessageItem } from '@/lib/api'
import { create } from 'zustand'

export interface Attachment {
  id: string
  path: string
  name: string
  mime: string
  /** Images only; empty when none. */
  caption: string
  /** The file is inside the asset protocol scope (a staged paste), so the strip can show it. */
  previewable: boolean
}

export interface ComposerState {
  text: string
  replyTo: MessageItem | null
  /** The own Text message being edited. */
  editing: MessageItem | null
  attachments: Attachment[]
  setText: (text: string) => void
  setReplyTo: (message: MessageItem | null) => void
  /** Enters edit mode with the message's body in the input. */
  startEdit: (message: MessageItem) => void
  /** Leaves edit mode and clears the input. */
  cancelEdit: () => void
  addAttachments: (attachments: Attachment[]) => void
  removeAttachment: (id: string) => void
  setCaption: (id: string, caption: string) => void
  clearAttachments: () => void
  reset: () => void
}

const INITIAL = {
  text: '',
  replyTo: null,
  editing: null,
  attachments: [],
}

/** The composer of the open chat; reset when the pane changes chat. */
export const useComposerStore = create<ComposerState>()(set => ({
  ...INITIAL,
  setText: text => set({ text }),
  setReplyTo: replyTo => set(state => ({
    replyTo,
    editing: null,
    text: state.editing ? '' : state.text,
  })),
  startEdit: message => set({
    editing: message,
    replyTo: null,
    text: message.content.type === 'Text'
      ? message.content.body
      : '',
  }),
  cancelEdit: () => set({ editing: null, text: '' }),
  addAttachments: attachments => set(state => ({
    attachments: [
      ...state.attachments,
      ...attachments,
    ],
  })),
  removeAttachment: id => set(state => ({
    attachments: state.attachments.filter(a => a.id !== id),
  })),
  setCaption: (id, caption) => set(state => ({
    attachments: state.attachments.map(a => a.id === id
      ? { ...a, caption }
      : a),
  })),
  clearAttachments: () => set({ attachments: [] }),
  reset: () => set(INITIAL),
}))

export const composerStore = useComposerStore
