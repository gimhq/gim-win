import type { MessageContent } from '@/lib/api'
import { ImageIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatBytes } from '@/lib/format'

/** A placeholder for an image attachment; the media subtask renders the image. */
export function ImageContent({ content }: { content: Extract<MessageContent, { type: 'Image' }> }) {
  const { t } = useTranslation('chat')
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 rounded-md bg-background/60 px-3 py-2 text-sm text-foreground">
        <ImageIcon className="size-4 shrink-0" />
        <span className="truncate">{t('media.image')}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(content.media.size)}</span>
      </div>
      {content.caption && <p className="break-words whitespace-pre-wrap">{content.caption}</p>}
    </div>
  )
}
