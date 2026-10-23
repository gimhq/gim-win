import { createFileRoute } from '@tanstack/react-router'
import { AboutSection } from '@/features/settings/about/about-section'

export const Route = createFileRoute('/_shell/settings/about')({
  component: AboutSection,
})
