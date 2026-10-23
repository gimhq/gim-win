import { createFileRoute } from '@tanstack/react-router'
import { WelcomePage } from '@/features/onboarding/welcome'

export const Route = createFileRoute('/onboarding/')({
  component: WelcomePage,
})
