import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PlaceholderPage } from '@/components/placeholder-page'

export const Route = createFileRoute('/onboarding/restore')({
  component: OnboardingRestorePage,
})

function OnboardingRestorePage() {
  const { t } = useTranslation('onboarding')
  return <PlaceholderPage title={t('titles.restore')} />
}
