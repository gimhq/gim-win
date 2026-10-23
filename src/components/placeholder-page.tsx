import { useTranslation } from 'react-i18next'

interface PlaceholderPageProps {
  title: string
  description?: string
}

/** A titled empty page; later workstreams replace it with the real screen. */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const { t } = useTranslation()
  return (
    <main className="flex flex-1 flex-col gap-2 p-6">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description ?? t('state.comingSoon')}</p>
    </main>
  )
}
