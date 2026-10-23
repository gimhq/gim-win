import type { MediaRef } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { convertFileSrc } from '@tauri-apps/api/core'
import { Loader2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { fetchMedia } from '@/lib/api'
import { extensionForMime } from '../lib/mime'
import { mediaCachePath } from './media-path'

interface MediaViewerProps {
  media: MediaRef
  caption: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The full-size image, downloaded into the media cache on first open. */
export function MediaViewer({ media, caption, open, onOpenChange }: MediaViewerProps) {
  const { t } = useTranslation('chat')
  const full = useQuery({
    queryKey: ['media', media.messageId],
    queryFn: async () => fetchMedia(
      media.chatId,
      media.messageId,
      await mediaCachePath(media.chatId, media.messageId, extensionForMime(media.mime)),
    ),
    enabled: open,
    staleTime: Infinity,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-auto max-w-[90vw] flex-col items-center gap-2 sm:max-w-[90vw]">
        <DialogTitle className="sr-only">{caption || t('media.image')}</DialogTitle>
        {full.isPending && (
          <div role="status" className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
            {t('media.downloading')}
          </div>
        )}
        {full.isError && (
          <div className="flex flex-col items-center gap-2 p-8">
            <p role="alert" className="text-sm text-destructive">{t('media.failed')}</p>
            <Button variant="outline" onClick={() => void full.refetch()}>{t('common:actions.retry')}</Button>
          </div>
        )}
        {full.data && (
          <img
            src={convertFileSrc(full.data)}
            alt={caption || t('media.image')}
            className="max-h-[80vh] max-w-full object-contain"
          />
        )}
        {caption && <p className="text-sm break-words whitespace-pre-wrap">{caption}</p>}
      </DialogContent>
    </Dialog>
  )
}
