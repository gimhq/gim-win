import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setDisplayName } from '@/lib/api'
import { useInvalidateSession } from '../queries'
import { describeError } from './describe-error'

const MAX_LENGTH = 64

interface DisplayNameFormProps {
  initialName: string
  onDone: () => void
}

/** Inline editor for the display name. */
export function DisplayNameForm({ initialName, onDone }: DisplayNameFormProps) {
  const { t } = useTranslation('account')
  const invalidateSession = useInvalidateSession()
  const [name, setName] = React.useState(initialName)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const value = name.trim()
    const length = Array.from(value).length
    if (length < 1 || length > MAX_LENGTH) {
      setError(t('profile.displayName.invalid'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await setDisplayName(value)
      await invalidateSession()
      onDone()
    }
    catch (error) {
      setError(describeError(t, error))
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={submit} noValidate>
      <Label htmlFor="display-name">{t('profile.displayName.label')}</Label>
      <Input
        id="display-name"
        autoComplete="off"
        autoFocus
        value={name}
        onChange={event => setName(event.target.value)}
        aria-invalid={error !== null || undefined}
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{t('profile.save')}</Button>
        <Button type="button" variant="outline" onClick={onDone}>{t('profile.cancel')}</Button>
      </div>
    </form>
  )
}
