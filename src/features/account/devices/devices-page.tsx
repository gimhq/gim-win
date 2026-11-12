import type { RecoveryRotation } from '@/lib/api'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { KitScreen } from '@/features/onboarding/recovery-kit/kit-screen'
import { useSession } from '../queries'
import { DeviceList } from './device-list'
import { LinkDeviceCard } from './link-device-dialog'
import { RecoveryKeyReveal } from './recovery-key-reveal'
import { RotateKeyCard } from './rotate-key'

/** Settings > Account and devices: recovery key, linked devices and linking a new one. */
export function DevicesPage() {
  const { t } = useTranslation()
  const session = useSession()
  const [rotation, setRotation] = React.useState<RecoveryRotation | null>(null)
  const [revealing, setRevealing] = React.useState(false)
  const closeReveal = React.useCallback(() => setRevealing(false), [])

  if (rotation && session.data) {
    const unsynced = rotation.unsyncedHubIds.length
    return (
      <KitScreen
        userId={session.data.userId}
        recoveryCode={rotation.recoveryCode}
        extraNote={unsynced > 0
          ? t('account:devices.recoveryKey.unsynced', { count: unsynced })
          : undefined}
        onDone={() => setRotation(null)}
      />
    )
  }

  if (revealing && session.data) {
    return (
      <RecoveryKeyReveal
        userId={session.data.userId}
        onClose={closeReveal}
        onRotated={(next) => {
          setRevealing(false)
          setRotation(next)
        }}
      />
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold tracking-tight">{t('settings:titles.devices')}</h1>
      <div className="flex max-w-xl flex-col gap-4">
        <RotateKeyCard onRotated={setRotation} onView={() => setRevealing(true)} />
        <DeviceList />
        <LinkDeviceCard />
      </div>
    </main>
  )
}
