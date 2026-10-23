import type { StartupInfo } from '@/lib/api'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorKind, setServerUrl } from '@/lib/api'

interface ServerStepProps {
  initialUrl?: string
  onDone: (info: StartupInfo) => void
}

/** `true` for an http(s) URL with a host. */
function isServerUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== ''
  }
  catch {
    return false
  }
}

/** Asks for the server address and persists it through `setServerUrl`. */
export function ServerStep({ initialUrl = '', onDone }: ServerStepProps) {
  const { t } = useTranslation('onboarding')
  const [url, setUrl] = React.useState(initialUrl)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  function describe(error: unknown): string {
    switch (errorKind(error)) {
      case 'InvalidInput':
        return t('server.invalid')
      case 'Network':
        return t('server.unreachable')
      default:
        return t('common:errors.generic')
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const value = url.trim()
    if (!isServerUrl(value)) {
      setError(t('server.invalid'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const info = await setServerUrl(value)
      if (info.error && !info.clientReady)
        setError(describe(info.error))
      else
        onDone(info)
    }
    catch (error) {
      setError(describe(error))
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="server-url">{t('server.label')}</Label>
        <Input
          id="server-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder={t('server.placeholder')}
          value={url}
          onChange={event => setUrl(event.target.value)}
          aria-invalid={error !== null || undefined}
          aria-describedby="server-url-help"
        />
        <p id="server-url-help" className="text-sm text-muted-foreground">{t('server.helper')}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <div>
        <Button type="submit" disabled={busy}>{t('server.continue')}</Button>
      </div>
    </form>
  )
}
