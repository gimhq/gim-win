import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { copyText, errorKind, formatRecoveryKit, saveTextFile } from '@/lib/api'
import { OnboardingFrame } from '../frame'
import { KitCheckStep } from './kit-check-step'
import { groupCode, KIT_FILE_NAME, kitLabels } from './kit-labels'

interface KitScreenProps {
  userId: string
  recoveryCode: string
  /** Called once the user saved the kit and typed the key's ending. */
  onDone: () => void
  /** Rendered under the kit card, e.g. after a key rotation. */
  extraNote?: string
}

/** Shows the Account ID and recovery key once, lets the user save them, then checks the key's ending. */
export function KitScreen({ userId, recoveryCode, onDone, extraNote }: KitScreenProps) {
  const [checking, setChecking] = React.useState(false)

  if (checking)
    return <KitCheckStep recoveryCode={recoveryCode} onDone={onDone} onShowKit={() => setChecking(false)} />

  return <KitView userId={userId} recoveryCode={recoveryCode} extraNote={extraNote} onSaved={() => setChecking(true)} />
}

type SaveStatus = 'idle' | 'saved' | 'failed'

function KitView({ userId, recoveryCode, extraNote, onSaved }: Omit<KitScreenProps, 'onDone'> & { onSaved: () => void }) {
  const { t, i18n } = useTranslation('onboarding')
  const kit = useQuery({
    queryKey: [
      'recoveryKit',
      userId,
      recoveryCode,
      i18n.language,
    ],
    queryFn: () => formatRecoveryKit(userId, recoveryCode, kitLabels(t)),
    staleTime: Infinity,
    // The code must not outlive this screen in the cache.
    gcTime: 0,
  })
  const [copied, setCopied] = React.useState(false)
  const [save, setSave] = React.useState<{ status: SaveStatus, error?: string }>({ status: 'idle' })

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
    try {
      const path = await saveTextFile(KIT_FILE_NAME, kit.data)
      if (path !== null)
        setSave({ status: 'saved' })
    }
    catch (error) {
      setSave({
        status: 'failed',
        error: errorKind(error) === 'Storage'
          ? t('kit.saveFailed')
          : t('common:errors.generic'),
      })
    }
  }

  return (
    <OnboardingFrame
      title={t('kit.title')}
      description={t('kit.explanation')}
      actions={<Button onClick={onSaved}>{t('kit.done')}</Button>}
    >
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{t('kit.accountId')}</span>
            <span className="font-mono text-sm break-all">{userId}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{t('kit.recoveryKey')}</span>
            <span className="font-mono text-base break-all">{groupCode(recoveryCode)}</span>
          </div>
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
        {save.status === 'saved' && <span role="status" className="text-sm text-muted-foreground">{t('kit.saved')}</span>}
      </div>
      {kit.isError && <p role="alert" className="text-sm text-destructive">{t('common:errors.generic')}</p>}
      {save.status === 'failed' && <p role="alert" className="text-sm text-destructive">{save.error}</p>}
      {extraNote && <p className="text-sm text-muted-foreground">{extraNote}</p>}
    </OnboardingFrame>
  )
}
