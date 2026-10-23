import { createFileRoute } from '@tanstack/react-router'
import { LanguageSection } from '@/features/settings/language/language-section'

export const Route = createFileRoute('/_shell/settings/language')({
  component: LanguageSection,
})
