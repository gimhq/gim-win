import { useQuery } from '@tanstack/react-query'
import { openUrl } from '@tauri-apps/plugin-opener'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchLinkPreview } from '@/lib/api'
import { firstUrl } from '../lib/urls'

/** The preview of the first link in `body`, fetched by the app itself (never through the hub). */
export function LinkPreviewCard({ body }: { body: string }) {
  const url = firstUrl(body)
  if (url === null)
    return null
  return <Card url={url} />
}

function Card({ url }: { url: string }) {
  const { t } = useTranslation('chat')
  const [imageFailed, setImageFailed] = React.useState(false)
  const { data: preview, isPending, isError } = useQuery({
    queryKey: ['linkPreview', url],
    queryFn: () => fetchLinkPreview(url),
    staleTime: Infinity,
  })

  if (isPending) {
    // Fixed height so the virtual list does not jump.
    return <Skeleton className="mt-1.5 h-20 w-64 max-w-full" role="status" aria-label={t('preview.loading')} />
  }
  if (isError || !preview)
    return null

  const imageUrl = preview.imageUrl !== null && /^https?:\/\//i.test(preview.imageUrl) && !imageFailed
    ? preview.imageUrl
    : null

  return (
    <button
      type="button"
      title={t('preview.open')}
      className="mt-1.5 flex h-20 w-64 max-w-full gap-2 overflow-hidden rounded-lg bg-background/80 p-2 text-left text-foreground outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => {
        openUrl(url).catch((error: unknown) => {
          console.error('open_url failed', error)
        })
      }}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {preview.siteName && <span className="truncate text-[0.7rem] text-muted-foreground">{preview.siteName}</span>}
        {preview.title && <span className="truncate text-xs font-medium">{preview.title}</span>}
        {preview.description && <span className="line-clamp-2 text-xs text-muted-foreground">{preview.description}</span>}
      </span>
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-14 shrink-0 rounded-md object-cover"
          onError={() => setImageFailed(true)}
        />
      )}
    </button>
  )
}
