import type { Attachment } from './store'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { open } from '@tauri-apps/plugin-dialog'
import * as React from 'react'
import { stageAttachment } from '@/lib/api'
import { extensionForMime, fileName, isImageMime, mimeFromFileName } from '../lib/mime'
import { composerStore, useComposerStore } from './store'

let nextId = 0

function attachment(path: string, name: string, mime: string, previewable: boolean): Attachment {
  nextId += 1
  return {
    id: `attachment-${nextId}`,
    path,
    name,
    mime,
    caption: '',
    previewable,
  }
}

/** Adds files picked or dropped from anywhere; outside the asset scope, so they show as icons. */
export function addPaths(paths: string[]): void {
  composerStore.getState().addAttachments(paths.map(path => attachment(path, fileName(path), mimeFromFileName(path), false)))
}

/** Opens the system file picker and adds the chosen files. */
export async function pickAttachments(): Promise<void> {
  const picked = await open({ multiple: true })
  if (picked)
    addPaths(picked)
}

/** Stages pasted images to files (inside the asset scope) and adds them. */
export async function addPastedImages(files: File[]): Promise<void> {
  for (const file of files) {
    const extension = extensionForMime(file.type)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const path = await stageAttachment(bytes, extension)
    composerStore.getState().addAttachments([
      attachment(path, file.name || `image.${extension}`, file.type, isImageMime(file.type)),
    ])
  }
}

export function useAttachments(): Attachment[] {
  return useComposerStore(state => state.attachments)
}

/** Files dropped on the window become attachments while `enabled`; true while files are dragged over it. */
export function useFileDrop(enabled: boolean): boolean {
  const [dragging, setDragging] = React.useState(false)

  React.useEffect(() => {
    if (!enabled)
      return
    let disposed = false
    let unlisten: (() => void) | null = null
    let webview: ReturnType<typeof getCurrentWebview>
    try {
      webview = getCurrentWebview()
    }
    catch {
      // Outside the Tauri webview (the browser dev server) there is no file drop.
      return
    }
    webview.onDragDropEvent((event) => {
      switch (event.payload.type) {
        case 'enter':
        case 'over':
          setDragging(true)
          break
        case 'drop':
          setDragging(false)
          addPaths(event.payload.paths)
          break
        case 'leave':
          setDragging(false)
          break
      }
    }).then((stop) => {
      if (disposed)
        stop()
      else
        unlisten = stop
    }).catch((error: unknown) => {
      console.error('drag and drop listener failed', error)
    })
    return () => {
      disposed = true
      unlisten?.()
      setDragging(false)
    }
  }, [enabled])

  return enabled && dragging
}
