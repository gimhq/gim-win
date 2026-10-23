import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface DisplayNameStepProps {
  name: string
  onNameChange: (name: string) => void
  onSubmit: () => void
  busy: boolean
  error?: string
  /** Shown as "Use another server" when a server is already configured. */
  onUseAnotherServer?: () => void
}

export function DisplayNameStep({ name, onNameChange, onSubmit, busy, error, onUseAnotherServer }: DisplayNameStepProps) {
  const { t } = useTranslation('onboarding')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="display-name">{t('create.nameLabel')}</Label>
        <Input
          id="display-name"
          autoComplete="nickname"
          value={name}
          onChange={event => onNameChange(event.target.value)}
          disabled={busy}
          aria-invalid={error !== undefined || undefined}
        />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy}>
          {busy
            ? t('create.submitting')
            : t('create.submit')}
        </Button>
        {onUseAnotherServer && (
          <Button type="button" variant="link" size="sm" disabled={busy} onClick={onUseAnotherServer}>
            {t('create.otherServer')}
          </Button>
        )}
      </div>
    </form>
  )
}
