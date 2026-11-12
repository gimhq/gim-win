import type { RecoveryRotation } from '@/lib/api'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { rotateRecoveryCode } from '@/lib/api'
import { describeError } from './describe-error'

/** "Create a new recovery key" behind a confirmation. */
export function RotateKeyButton({ onRotated }: { onRotated: (rotation: RecoveryRotation) => void }) {
  const { t } = useTranslation('account')
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function rotate() {
    setBusy(true)
    setError(null)
    try {
      const rotation = await rotateRecoveryCode()
      setOpen(false)
      onRotated(rotation)
    }
    catch (error) {
      setError(describeError(t, error))
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setError(null)
      }}
    >
      <Button variant="outline" onClick={() => setOpen(true)}>{t('devices.recoveryKey.create')}</Button>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('devices.recoveryKey.confirmTitle')}</DialogTitle>
          <DialogDescription>{t('devices.recoveryKey.confirmBody')}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t('devices.cancel')}</DialogClose>
          <Button disabled={busy} onClick={rotate}>{t('devices.recoveryKey.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface RotateKeyCardProps {
  onRotated: (rotation: RecoveryRotation) => void
  /** Opens the recovery key screen (device authentication first). */
  onView: () => void
}

/** The recovery key explainer with "View recovery key" and "Create a new recovery key". */
export function RotateKeyCard({ onRotated, onView }: RotateKeyCardProps) {
  const { t } = useTranslation('account')
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('devices.recoveryKey.title')}</CardTitle>
        <CardDescription>{t('devices.recoveryKey.body')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">{t('devices.recoveryKey.note')}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onView}>{t('devices.recoveryKey.view')}</Button>
          <RotateKeyButton onRotated={onRotated} />
        </div>
      </CardContent>
    </Card>
  )
}
