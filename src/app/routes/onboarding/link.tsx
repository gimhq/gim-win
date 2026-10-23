import { createFileRoute } from '@tanstack/react-router'
import { LinkPage } from '@/features/onboarding/link/link-page'

export const Route = createFileRoute('/onboarding/link')({
  component: LinkPage,
})
