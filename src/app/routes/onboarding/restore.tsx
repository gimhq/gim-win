import { createFileRoute } from '@tanstack/react-router'
import { RestorePage } from '@/features/onboarding/restore/restore-page'

export const Route = createFileRoute('/onboarding/restore')({
  component: RestorePage,
})
