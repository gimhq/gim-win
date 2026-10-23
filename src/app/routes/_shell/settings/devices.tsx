import { createFileRoute } from '@tanstack/react-router'
import { DevicesPage } from '@/features/account/devices/devices-page'

export const Route = createFileRoute('/_shell/settings/devices')({
  component: DevicesPage,
})
