import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '@/features/account/profile/profile-page'

export const Route = createFileRoute('/_shell/settings/profile')({
  component: ProfilePage,
})
