import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/_shell/settings/signout')({
  component: SettingsSignOutPage,
})

function SettingsSignOutPage() {
  const { t } = useTranslation('settings')
  return <PlaceholderPage title={t('titles.signOut')} />
}
