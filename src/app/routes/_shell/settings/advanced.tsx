import { createFileRoute } from '@tanstack/react-router'
import { ServersSection } from '@/features/settings/advanced/servers-section'

export const Route = createFileRoute('/_shell/settings/advanced')({
  component: ServersSection,
})
