import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface UsernameStepProps {
  onSubmit: (handle: string) => void
  onSkip: () => void
  busy: boolean
  error?: string
}

export function UsernameStep({ onSubmit, onSkip, busy, error }: UsernameStepProps) {
  const { t } = useTranslation('onboarding')
  const [handle, setHandle] = React.useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    onSubmit(handle.trim())
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="handle">{t('handle.label')}</Label>
        <Input
          id="handle"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={32}
          value={handle}
          onChange={event => setHandle(event.target.value)}
          disabled={busy}
          aria-invalid={error !== undefined || undefined}
          aria-describedby="handle-help"
        />
        <p id="handle-help" className="text-sm text-muted-foreground">{t('handle.helper')}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy}>{t('handle.save')}</Button>
        <Button type="button" variant="link" disabled={busy} onClick={onSkip}>{t('handle.skip')}</Button>
      </div>
    </form>
  )
}
