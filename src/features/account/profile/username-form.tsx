import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { claimHandle, isGimError } from '@/lib/api'
import { useInvalidateSession } from '../queries'
import { describeError } from './describe-error'

const HANDLE_PATTERN = /^[a-z0-9_]{3,32}$/

interface UsernameFormProps {
  initialHandle: string
  onDone: () => void
}

/** Inline editor that claims a new username. */
export function UsernameForm({ initialHandle, onDone }: UsernameFormProps) {
  const { t } = useTranslation('account')
  const invalidateSession = useInvalidateSession()
  const [handle, setHandle] = React.useState(initialHandle)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const value = handle.trim()
    if (!HANDLE_PATTERN.test(value)) {
      setError(t('profile.username.invalid'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await claimHandle(value)
      await invalidateSession()
      onDone()
    }
    catch (error) {
      setError(isGimError(error) && error.kind === 'Server' && error.status === 409
        ? t('profile.username.taken')
        : describeError(t, error))
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={submit} noValidate>
      <Label htmlFor="username">{t('profile.username.label')}</Label>
      <Input
        id="username"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus
        value={handle}
        onChange={event => setHandle(event.target.value)}
        aria-invalid={error !== null || undefined}
        aria-describedby="username-help"
      />
      <p id="username-help" className="text-sm text-muted-foreground">{t('profile.username.helper')}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{t('profile.save')}</Button>
        <Button type="button" variant="outline" onClick={onDone}>{t('profile.cancel')}</Button>
      </div>
    </form>
  )
}
