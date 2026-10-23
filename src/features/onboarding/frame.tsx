import type { ReactNode } from 'react'
import { ArrowLeftIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface OnboardingFrameProps {
  title: string
  description?: string
  onBack?: () => void
  children?: ReactNode
  /** Footer actions, rendered in a row under the content. */
  actions?: ReactNode
}

/** The centred column every onboarding page is laid out in. */
export function OnboardingFrame({ title, description, onBack, children, actions }: OnboardingFrameProps) {
  const { t } = useTranslation()
  return (
    <main className="flex h-full flex-1 items-center justify-center overflow-y-auto bg-background p-6 text-foreground">
      <div className="flex w-full max-w-md flex-col gap-6">
        {onBack && (
          <div>
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeftIcon data-icon="inline-start" />
              {t('actions.back')}
            </Button>
          </div>
        )}
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </header>
        {children}
        {actions && <footer className="flex flex-wrap items-center gap-2">{actions}</footer>}
      </div>
    </main>
  )
}
