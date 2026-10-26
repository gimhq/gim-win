import type { Copy } from '../create/create-flow'
import type { KitStatus, RestoreFields } from './restore-flow'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ServerStep } from '@/features/onboarding/server-step'
import { parseRecoveryKit, restoreFromRecovery, startup } from '@/lib/api'
import { needsServer } from '../create/create-flow'
import { OnboardingFrame } from '../frame'
import { fillFields, kitStatus, normalizeText, restoreCopy, restorePayload } from './restore-flow'

const PARSE_DELAY_MS = 150

/** Route /onboarding/restore: restores an account from its recovery kit. */
export function RestorePage() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: ['startup'],
    queryFn: startup,
  })
  // Decided once from the startup info seen on mount.
  const [serverDone, setServerDone] = React.useState<boolean | null>(null)

  function back() {
    void navigate({ to: '/onboarding' })
  }

  if (!query.data) {
    return (
      <OnboardingFrame title={t('restore.title')} onBack={back}>
        <p className="text-sm text-muted-foreground">
          {query.isError
            ? t('common:errors.generic')
            : t('common:state.loading')}
        </p>
      </OnboardingFrame>
    )
  }

  if (!(serverDone ?? !needsServer(query.data))) {
    return (
      <OnboardingFrame title={t('restore.title')} description={t('server.title')} onBack={back}>
        <ServerStep initialUrl={query.data.serverUrl} onDone={() => setServerDone(true)} />
      </OnboardingFrame>
    )
  }

  return <RestoreForm onBack={back} />
}

function RestoreForm({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const [kit, setKit] = React.useState('')
  const [status, setStatus] = React.useState<KitStatus | null>(null)
  const [fields, setFields] = React.useState<RestoreFields>({ userId: '', recoveryCode: '' })
  const [revokeOthers, setRevokeOthers] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<Copy | null>(null)

  React.useEffect(() => {
    if (kit.trim() === '')
      return
    let current = true
    const timer = setTimeout(() => {
      parseRecoveryKit(kit).then((parsed) => {
        if (!current)
          return
        setFields(fields => fillFields(fields, parsed))
        setStatus(kitStatus(kit, parsed))
      }, () => {})
    }, PARSE_DELAY_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [kit])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const parsed = await parseRecoveryKit(normalizeText(fields))
      const payload = restorePayload(fields, parsed)
      await restoreFromRecovery(payload.userId, payload.recoveryCode, revokeOthers)
      void navigate({ to: '/chats' })
    }
    catch (error) {
      setError(restoreCopy(error))
      setBusy(false)
    }
  }

  function setField(name: keyof RestoreFields, value: string) {
    setFields(fields => ({ ...fields, [name]: value }))
  }

  return (
    <OnboardingFrame title={t('restore.title')} description={t('restore.explanation')} onBack={busy ? undefined : onBack}>
      <form className="flex flex-col gap-6" onSubmit={submit} noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="restore-kit">{t('restore.kitLabel')}</Label>
          <Textarea
            id="restore-kit"
            rows={5}
            autoComplete="off"
            spellCheck={false}
            value={kit}
            onChange={(event) => {
              setKit(event.target.value)
              setStatus(null)
            }}
            disabled={busy}
            aria-describedby="restore-kit-help restore-kit-status"
          />
          <p id="restore-kit-help" className="text-sm text-muted-foreground">{t('restore.kitHelper')}</p>
          <p id="restore-kit-status" role="status" className="text-sm">
            {status && t(status)}
          </p>
        </div>
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-4 text-sm font-medium">{t('restore.manualTitle')}</legend>
          <div className="flex flex-col gap-2">
            <Label htmlFor="restore-user-id">{t('restore.userIdLabel')}</Label>
            <Input
              id="restore-user-id"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={fields.userId}
              onChange={event => setField('userId', event.target.value)}
              disabled={busy}
              aria-describedby="restore-user-id-help"
            />
            <p id="restore-user-id-help" className="text-sm text-muted-foreground">{t('restore.userIdHelper')}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="restore-code">{t('restore.recoveryCodeLabel')}</Label>
            <Input
              id="restore-code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={fields.recoveryCode}
              onChange={event => setField('recoveryCode', event.target.value)}
              disabled={busy}
              aria-describedby="restore-code-help"
            />
            <p id="restore-code-help" className="text-sm text-muted-foreground">{t('restore.recoveryCodeHelper')}</p>
          </div>
        </fieldset>
        <div className="flex items-start gap-3">
          <Checkbox
            id="restore-revoke-others"
            checked={revokeOthers}
            onCheckedChange={setRevokeOthers}
            disabled={busy}
            aria-labelledby="restore-revoke-others-label"
            aria-describedby="restore-revoke-others-help"
          />
          <div className="flex flex-col gap-1">
            <Label id="restore-revoke-others-label" htmlFor="restore-revoke-others">{t('restore.revokeOthers')}</Label>
            <p id="restore-revoke-others-help" className="text-sm text-muted-foreground">{t('restore.revokeOthersHelper')}</p>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{t(error.key, error.values)}</p>}
        <div>
          <Button type="submit" disabled={busy}>
            {busy
              ? t('restore.submitting')
              : t('restore.submit')}
          </Button>
        </div>
      </form>
    </OnboardingFrame>
  )
}
