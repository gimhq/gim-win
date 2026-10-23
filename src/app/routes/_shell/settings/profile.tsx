import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_shell/settings/profile')({
  component: SettingsProfilePage,
})

function SettingsProfilePage() {
  const { t } = useTranslation('settings')
  return <PlaceholderPage title={t('titles.profile')} />
}
