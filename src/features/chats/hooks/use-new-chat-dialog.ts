import { create } from 'zustand'

interface NewChatDialogState {
  open: boolean
  setOpen: (open: boolean) => void
}

/** Whether the New chat dialog is open; the sidebar renders it, the empty pane opens it too. */
export const useNewChatDialog = create<NewChatDialogState>()(set => ({
  open: false,
  setOpen: open => set({ open }),
}))
