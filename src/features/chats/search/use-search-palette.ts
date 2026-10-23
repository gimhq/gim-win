import { create } from 'zustand'

interface SearchPaletteState {
  open: boolean
  setOpen: (open: boolean) => void
}

/** Whether the search palette is open; Mod+K and the sidebar button open it. */
export const useSearchPalette = create<SearchPaletteState>()(set => ({
  open: false,
  setOpen: open => set({ open }),
}))
