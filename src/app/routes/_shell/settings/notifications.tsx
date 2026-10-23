import { createFileRoute } from '@tanstack/react-router'
import { NotificationsSection } from '@/features/settings/notifications/notifications-section'

export const Route = createFileRoute('/_shell/settings/notifications')({
  component: NotificationsSection,
})
