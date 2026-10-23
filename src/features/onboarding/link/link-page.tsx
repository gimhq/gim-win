import type { LinkState } from './link-flow'
import type { StartupInfo } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ServerStep } from '@/features/onboarding/server-step'
import { confirmLink, copyText, isGimError, startLink, startup, waitLink } from '@/lib/api'
import { OnboardingFrame } from '../frame'
import { createLinkFlow } from './link-flow'
import { QrCode } from './qr-code'

const api = { startLink, waitLink, confirmLink }

/** Route /onboarding/link: links this device to one the user already uses. */
export function LinkPage() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: ['startup'],
    queryFn: startup,
  })
  const [configured, setConfigured] = React.useState<StartupInfo | null>(null)
  const info = configured ?? query.data

  function back() {
    void navigate({ to: '/onboarding' })
  }

  if (!info) {
    return (
      <OnboardingFrame title={t('titles.link')} onBack={back}>
        <p className="text-sm text-muted-foreground">
          {query.isError
            ? t('common:errors.generic')
            : t('common:state.loading')}
        </p>
      </OnboardingFrame>
    )
  }

  if (!info.serverUrl || !info.clientReady) {
    return (
      <OnboardingFrame title={t('titles.link')} description={t('server.title')} onBack={back}>
        <ServerStep initialUrl={info.serverUrl ?? ''} onDone={setConfigured} />
      </OnboardingFrame>
    )
  }

  return <LinkFlowView serverUrl={info.serverUrl} onBack={back} />
}

function useLinkFlow(serverUrl: string) {
  const [state, setState] = React.useState<LinkState>({ status: 'idle' })
  const flow = React.useMemo(() => createLinkFlow(api, [serverUrl], setState), [serverUrl])
  React.useEffect(() => {
    void flow.start()
    return () => flow.cancel()
  }, [flow])
  return { state, flow }
}

function LinkFlowView({ serverUrl, onBack }: { serverUrl: string, onBack: () => void }) {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const { state, flow } = useLinkFlow(serverUrl)

  React.useEffect(() => {
    if (state.status === 'linked')
      void navigate({ to: '/chats' })
  }, [state.status, navigate])

  function cancel() {
    flow.cancel()
    onBack()
  }

  switch (state.status) {
    case 'idle':
    case 'starting':
      return (
        <OnboardingFrame title={t('titles.link')} onBack={onBack}>
          <p className="text-sm text-muted-foreground">{t('common:state.loading')}</p>
        </OnboardingFrame>
      )
    case 'showingQr':
    case 'waiting':
      return (
        <OnboardingFrame
          title={t('titles.link')}
          description={t('link.qrExplanation')}
          actions={<Button variant="outline" onClick={cancel}>{t('common:actions.cancel')}</Button>}
        >
          <QrCode value={state.qrString} label={t('link.qrLabel')} />
          <CopyableCode value={state.qrString} />
          <p className="text-sm text-muted-foreground" role="status">{t('link.waiting')}</p>
        </OnboardingFrame>
      )
    case 'comparing':
      return (
        <OnboardingFrame
          title={t('link.sasTitle')}
          description={t('link.sasExplanation')}
          actions={(
            <>
              <Button onClick={() => void flow.confirm()}>{t('link.confirm')}</Button>
              <Button variant="outline" onClick={() => void flow.reject()}>{t('link.reject')}</Button>
            </>
          )}
        >
          <p className="py-6 text-center font-mono text-5xl font-semibold tracking-widest">{state.sas}</p>
        </OnboardingFrame>
      )
    case 'confirming':
      return (
        <OnboardingFrame title={t('link.sasTitle')}>
          <p className="text-sm text-muted-foreground" role="status">{t('link.confirming')}</p>
        </OnboardingFrame>
      )
    case 'linked':
      return (
        <OnboardingFrame title={t('titles.link')}>
          <p className="text-sm" role="status">{t('link.linked')}</p>
        </OnboardingFrame>
      )
    case 'rejected':
    case 'failed':
      return (
        <OnboardingFrame
          title={t('titles.link')}
          onBack={onBack}
          actions={<Button onClick={() => void flow.start()}>{t('link.newCode')}</Button>}
        >
          <p className="text-sm" role="alert">{describeOutcome(state, t)}</p>
        </OnboardingFrame>
      )
  }
}

function describeOutcome(state: Extract<LinkState, { status: 'rejected' | 'failed' }>, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (state.status === 'rejected')
    return t('link.rejected')
  switch (state.reason) {
    case 'timeout':
      return t('link.timedOut')
    case 'usedUp':
      return t('link.failed')
    case 'network':
      return t('errors.network')
    case 'other':
      return isGimError(state.error) && state.error.kind === 'RetryLater'
        ? t('errors.retryLater', { seconds: state.error.retryAfterSecs })
        : t('common:errors.generic')
  }
}

function CopyableCode({ value }: { value: string }) {
  const { t } = useTranslation('onboarding')
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied)
      return
    const timer = setTimeout(setCopied, 2000, false)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    await copyText(value)
    setCopied(true)
  }

  return (
    <div className="flex items-center gap-2">
      <Input readOnly value={value} aria-label={t('link.codeLabel')} className="font-mono text-xs" />
      <Button variant="outline" onClick={() => void copy()}>
        {copied
          ? t('link.copied')
          : t('common:actions.copy')}
      </Button>
    </div>
  )
}
