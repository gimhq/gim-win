import { createFileRoute } from '@tanstack/react-router'
import { AppearanceSection } from '@/features/settings/appearance/appearance-section'

export const Route = createFileRoute('/_shell/settings/appearance')({
  component: AppearanceSection,
})
