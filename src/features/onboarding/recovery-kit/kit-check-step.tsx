import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { matchesRecoveryKeyEnding } from '@/lib/api'
import { OnboardingFrame } from '../frame'

interface KitCheckStepProps {
  recoveryCode: string
  onDone: () => void
  onShowKit: () => void
}

/** Asks for the recovery key's last four characters to make sure it was saved. */
export function KitCheckStep({ recoveryCode, onDone, onShowKit }: KitCheckStepProps) {
  const { t } = useTranslation('onboarding')
  const [typed, setTyped] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (await matchesRecoveryKeyEnding(recoveryCode, typed))
        onDone()
      else
        setError(t('kit.checkMismatch'))
    }
    catch {
      setError(t('common:errors.generic'))
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <OnboardingFrame title={t('kit.checkTitle')} description={t('kit.checkExplanation')}>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="kit-check">{t('kit.checkLabel')}</Label>
          <Input
            id="kit-check"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            // Four characters plus a separator or spaces the user may type.
            maxLength={7}
            className="font-mono"
            value={typed}
            onChange={event => setTyped(event.target.value)}
            aria-invalid={error !== null || undefined}
          />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy}>{t('kit.checkConfirm')}</Button>
          {error && <Button type="button" variant="link" onClick={onShowKit}>{t('kit.showAgain')}</Button>}
        </div>
      </form>
    </OnboardingFrame>
  )
}
