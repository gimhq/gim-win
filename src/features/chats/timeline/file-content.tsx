import type { MessageContent } from '@/lib/api'
import { useMutation } from '@tanstack/react-query'
import { save } from '@tauri-apps/plugin-dialog'
import { openPath } from '@tauri-apps/plugin-opener'
import { DownloadIcon, FileIcon, SaveIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { fetchMedia } from '@/lib/api'
import { formatBytes } from '@/lib/format'
import { extensionOf, mediaCachePath } from './media-path'

/** A file attachment: name and size, Download (then open) and Save as. */
export function FileContent({ content, uploading = false }: {
  content: Extract<MessageContent, { type: 'File' }>
  /** Own message still `Pending`. */
  uploading?: boolean
}) {
  const { t } = useTranslation('chat')
  const { media, fileName } = content
  const download = useMutation({
    mutationFn: async () => {
      const path = await fetchMedia(
        media.chatId,
        media.messageId,
        await mediaCachePath(media.chatId, media.messageId, extensionOf(fileName, media.mime)),
      )
      await openPath(path)
    },
  })
  const saveAs = useMutation({
    mutationFn: async () => {
      const dest = await save({ defaultPath: fileName })
      if (dest)
        await fetchMedia(media.chatId, media.messageId, dest)
    },
  })
  const busy = download.isPending || saveAs.isPending
  const failed = download.isError || saveAs.isError

  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-w-48 flex-col gap-1.5 rounded-md bg-background/60 px-3 py-2 text-sm text-foreground">
        <div className="flex items-center gap-2">
          <FileIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate" title={fileName}>{fileName}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(media.size)}</span>
        </div>
        {uploading
          ? <p className="text-xs text-muted-foreground">{t('media.uploading')}</p>
          : (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="xs" disabled={busy} onClick={() => download.mutate()}>
                  <DownloadIcon />
                  {t('media.download')}
                </Button>
                <Button variant="ghost" size="xs" disabled={busy} onClick={() => saveAs.mutate()}>
                  <SaveIcon />
                  {t('media.saveAs')}
                </Button>
              </div>
            )}
        {busy && <Progress value={null} aria-label={t('media.downloading')} />}
        {failed && !busy && <p role="alert" className="text-xs text-destructive">{t('media.failed')}</p>}
      </div>
      {content.caption && <p className="break-words whitespace-pre-wrap">{content.caption}</p>}
    </div>
  )
}
