import type { RecoveryRotation } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftIcon } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { groupCode, KIT_FILE_NAME, kitLabels } from '@/features/onboarding/recovery-kit/kit-labels'
import { authenticateDevice, setCaptureProtection } from '@/features/settings/system-api'
import { copyText, errorKind, formatRecoveryKit, recoveryCode, saveTextFile } from '@/lib/api'
import { RotateKeyButton } from './rotate-key'

type Step
  = | { step: 'unlocking' }
    | { step: 'locked', reason: 'Canceled' | 'Unavailable' | 'error' }
    | { step: 'shown', code: string }
    | { step: 'notHeld' }

interface RecoveryKeyRevealProps {
  userId: string
  /** Leaves the screen; the key is dropped with it. */
  onClose: () => void
  /** A new key was created on a device that did not hold one. */
  onRotated: (rotation: RecoveryRotation) => void
}

/**
 * Settings > Recovery key: device authentication first, then the key kept
 * on this device, or "This device doesn't have your recovery key".
 */
export function RecoveryKeyReveal({ userId, onClose, onRotated }: RecoveryKeyRevealProps) {
  const { t } = useTranslation('account')
  const [state, setState] = React.useState<Step>({ step: 'unlocking' })

  const unlock = React.useCallback(async () => {
    setState({ step: 'unlocking' })
    try {
      const outcome = await authenticateDevice(t('devices.reveal.reason'))
      if (outcome !== 'Verified') {
        setState({ step: 'locked', reason: outcome })
        return
      }
      const code = await recoveryCode()
      setState(code === null
        ? { step: 'notHeld' }
        : { step: 'shown', code })
    }
    catch {
      setState({ step: 'locked', reason: 'error' })
    }
  }, [t])

  // Once per screen, also under StrictMode's double mount: one system prompt.
  const startedRef = React.useRef(false)
  React.useEffect(() => {
    if (startedRef.current)
      return
    startedRef.current = true
    void unlock()
  }, [unlock])

  return (
    <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
      <div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeftIcon data-icon="inline-start" />
          {t('common:actions.back')}
        </Button>
      </div>
      <h1 className="text-xl font-semibold tracking-tight">{t('devices.reveal.title')}</h1>
      <div className="flex max-w-xl flex-col gap-4">
        {state.step === 'unlocking' && <p role="status" className="text-sm text-muted-foreground">{t('devices.reveal.unlocking')}</p>}
        {state.step === 'locked' && (
          <>
            <p role="alert" className="text-sm text-muted-foreground">
              {t(state.reason === 'Unavailable'
                ? 'devices.reveal.unavailable'
                : state.reason === 'Canceled'
                  ? 'devices.reveal.canceled'
                  : 'common:errors.generic')}
            </p>
            {state.reason !== 'Unavailable' && (
              <div>
                <Button onClick={() => void unlock()}>{t('devices.reveal.retry')}</Button>
              </div>
            )}
          </>
        )}
        {state.step === 'notHeld' && (
          <Card>
            <CardContent className="flex flex-col items-start gap-3">
              <h2 className="text-base font-medium">{t('devices.reveal.notHeldTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('devices.reveal.notHeldBody')}</p>
              <RotateKeyButton onRotated={onRotated} />
            </CardContent>
          </Card>
        )}
        {state.step === 'shown' && <ShownKey userId={userId} code={state.code} onHide={onClose} />}
      </div>
    </main>
  )
}

type SaveStatus = 'idle' | 'saved' | 'failed'

/**
 * The key with copy, save and the kit QR code. The window is kept out of
 * screen capture while it is mounted; leaving the app hides it.
 */
function ShownKey({ userId, code, onHide }: { userId: string, code: string, onHide: () => void }) {
  const { t, i18n } = useTranslation('onboarding')
  const kit = useQuery({
    queryKey: [
      'recoveryKit',
      userId,
      code,
      i18n.language,
    ],
    queryFn: () => formatRecoveryKit(userId, code, kitLabels(t)),
    staleTime: Infinity,
    // The code must not outlive this screen in the cache.
    gcTime: 0,
  })
  const [copied, setCopied] = React.useState(false)
  const [save, setSave] = React.useState<SaveStatus>('idle')
  // The save dialog takes the focus; that must not hide the key.
  const savingRef = React.useRef(false)

  React.useEffect(() => {
    void setCaptureProtection(true).catch((error: unknown) => console.error('set_capture_protection failed', error))
    return () => {
      void setCaptureProtection(false).catch((error: unknown) => console.error('set_capture_protection failed', error))
    }
  }, [])

  React.useEffect(() => {
    function hidden() {
      if (document.visibilityState === 'hidden')
        onHide()
    }
    function blurred() {
      if (!savingRef.current)
        onHide()
    }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('blur', blurred)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('blur', blurred)
    }
  }, [onHide])

  React.useEffect(() => {
    if (!copied)
      return
    const timer = setTimeout(setCopied, 2000, false)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    if (!kit.data)
      return
    await copyText(kit.data)
    setCopied(true)
  }

  async function saveFile() {
    if (!kit.data)
      return
    savingRef.current = true
    try {
      const path = await saveTextFile(KIT_FILE_NAME, kit.data)
      if (path !== null)
        setSave('saved')
    }
    catch (error) {
      setSave(errorKind(error) === 'Storage'
        ? 'failed'
        : 'idle')
    }
    finally {
      savingRef.current = false
    }
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">{t('account:devices.reveal.warning')}</p>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{t('kit.accountId')}</span>
            <span className="font-mono text-sm break-all">{userId}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{t('kit.recoveryKey')}</span>
            <span className="font-mono text-base break-all">{groupCode(code)}</span>
          </div>
          {kit.data && (
            <div className="flex flex-col items-start gap-2">
              <span className="text-sm text-muted-foreground">{t('account:devices.reveal.qr')}</span>
              <div className="rounded-md bg-white p-3">
                <QRCodeSVG value={kit.data} size={192} role="img" aria-label={t('account:devices.reveal.qr')} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={!kit.data} onClick={() => void copy()}>
          {copied
            ? t('kit.copied')
            : t('common:actions.copy')}
        </Button>
        <Button variant="outline" disabled={!kit.data} onClick={() => void saveFile()}>
          {t('kit.save')}
        </Button>
        <Button onClick={onHide}>{t('account:devices.reveal.hide')}</Button>
        {save === 'saved' && <span role="status" className="text-sm text-muted-foreground">{t('kit.saved')}</span>}
      </div>
      {kit.isError && <p role="alert" className="text-sm text-destructive">{t('common:errors.generic')}</p>}
      {save === 'failed' && <p role="alert" className="text-sm text-destructive">{t('kit.saveFailed')}</p>}
    </>
  )
}
