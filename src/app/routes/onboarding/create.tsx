import { createFileRoute } from '@tanstack/react-router'
import { CreatePage } from '@/features/onboarding/create/create-page'

export const Route = createFileRoute('/onboarding/create')({
  component: CreatePage,
})
