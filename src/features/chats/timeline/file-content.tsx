import type { MessageContent } from '@/lib/api'
import { FileIcon } from 'lucide-react'
import { formatBytes } from '@/lib/format'

/** A placeholder for a file attachment; the media subtask adds download and open. */
export function FileContent({ content }: { content: Extract<MessageContent, { type: 'File' }> }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 rounded-md bg-background/60 px-3 py-2 text-sm text-foreground">
        <FileIcon className="size-4 shrink-0" />
        <span className="truncate">{content.fileName}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(content.media.size)}</span>
      </div>
      {content.caption && <p className="break-words whitespace-pre-wrap">{content.caption}</p>}
    </div>
  )
}
