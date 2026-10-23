import type { MessageContent } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { convertFileSrc } from '@tauri-apps/api/core'
import { ImageIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { fetchThumbnail } from '@/lib/api'
import { fitImage, mediaCachePath } from './media-path'
import { MediaViewer } from './media-viewer'

/** The image's thumbnail in a box of its final size; a click opens the full image. */
export function ImageContent({ content, uploading = false }: {
  content: Extract<MessageContent, { type: 'Image' }>
  /** Own message still `Pending`. */
  uploading?: boolean
}) {
  const { t } = useTranslation('chat')
  const [viewing, setViewing] = React.useState(false)
  const { media } = content
  const size = fitImage(content.width, content.height)
  const thumb = useQuery({
    queryKey: ['thumb', media.messageId],
    queryFn: async () => fetchThumbnail(
      media.chatId,
      media.messageId,
      await mediaCachePath(media.chatId, media.messageId, 'thumb'),
    ),
    enabled: media.hasThumbnail,
    staleTime: Infinity,
  })

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-label={t('media.view')}
        className="relative flex items-center justify-center overflow-hidden rounded-md bg-background/60 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={size}
        onClick={() => setViewing(true)}
      >
        {thumb.data
          ? <img src={convertFileSrc(thumb.data)} alt={t('media.image')} className="size-full object-cover" />
          : <ImageIcon className="size-6" aria-hidden="true" />}
        {uploading && (
          <span className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-0.5 text-xs text-white">{t('media.uploading')}</span>
        )}
      </button>
      {content.caption && <p className="break-words whitespace-pre-wrap">{content.caption}</p>}
      {viewing && <MediaViewer media={media} caption={content.caption} open={viewing} onOpenChange={setViewing} />}
    </div>
  )
}
