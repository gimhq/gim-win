import type { Copy, CreateState } from './create-flow'
import type { StartupInfo } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ServerStep } from '@/features/onboarding/server-step'
import { createIdentity, session, startup } from '@/lib/api'
import { OnboardingFrame } from '../frame'
import { KitScreen } from '../recovery-kit/kit-screen'
import { createCreateFlow } from './create-flow'
import { DisplayNameStep } from './display-name-step'

const api = { createIdentity, session }

/** Route /onboarding/create: creates a new account on this device. */
export function CreatePage() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: ['startup'],
    queryFn: startup,
  })

  function back() {
    void navigate({ to: '/onboarding' })
  }

  if (!query.data) {
    return (
      <OnboardingFrame title={t('titles.create')} onBack={back}>
        <p className="text-sm text-muted-foreground">
          {query.isError
            ? t('common:errors.generic')
            : t('common:state.loading')}
        </p>
      </OnboardingFrame>
    )
  }

  return <CreateFlowView info={query.data} onBack={back} />
}

function CreateFlowView({ info, onBack }: { info: StartupInfo, onBack: () => void }) {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  // The flow starts from the startup info seen on mount; later refetches don't restart it.
  const [state, setState] = React.useState<CreateState | null>(null)
  const [flow] = React.useState(() => createCreateFlow(api, info, setState))
  const [name, setName] = React.useState('')
  const current = state ?? flow.getState()

  React.useEffect(() => {
    if (current.step === 'done')
      void navigate({ to: '/chats' })
  }, [current.step, navigate])

  function copy(error?: Copy): string | undefined {
    return error && t(error.key, error.values)
  }

  switch (current.step) {
    case 'server':
      return (
        <OnboardingFrame
          title={t('titles.create')}
          description={t('server.title')}
          onBack={current.serverRequired
            ? onBack
            : flow.cancelServer}
        >
          <ServerStep initialUrl={info.serverUrl} onDone={flow.serverDone} />
        </OnboardingFrame>
      )
    case 'name':
    case 'creating':
      return (
        <OnboardingFrame
          title={t('create.nameTitle')}
          description={t('create.nameExplanation')}
          onBack={current.step === 'name'
            ? onBack
            : undefined}
        >
          <DisplayNameStep
            name={name}
            onNameChange={setName}
            onSubmit={() => void flow.create(name)}
            busy={current.step === 'creating'}
            error={current.step === 'name'
              ? copy(current.error)
              : undefined}
            onUseAnotherServer={flow.openServer}
          />
        </OnboardingFrame>
      )
    case 'kit':
      return <KitScreen userId={current.userId} recoveryCode={current.recoveryCode} onDone={flow.kitDone} />
    case 'done':
      return null
  }
}
