import { createFileRoute } from '@tanstack/react-router'
import { KeepServerSection } from '@/features/settings/advanced/keep-server-section'
import { ServersSection } from '@/features/settings/advanced/servers-section'

function AdvancedSettings() {
  return (
    <ServersSection>
      <KeepServerSection />
    </ServersSection>
  )
}

export const Route = createFileRoute('/_shell/settings/advanced')({
  component: AdvancedSettings,
})
