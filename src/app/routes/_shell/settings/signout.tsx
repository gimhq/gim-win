import { createFileRoute } from '@tanstack/react-router'
import { SignOutSection } from '@/features/settings/signout/signout-section'

export const Route = createFileRoute('/_shell/settings/signout')({
  component: SignOutSection,
})
