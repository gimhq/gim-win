import type { DeviceInfo } from '@/lib/api'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { revokeDevice } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { useDevices, useInvalidateDevices } from '../device-queries'
import { describeError } from './describe-error'
import { shortDeviceId } from './short-id'

/** The user's devices with "Remove device" on the other, still active ones. */
export function DeviceList() {
  const { t } = useTranslation('account')
  const query = useDevices()
  const [removing, setRemoving] = React.useState<DeviceInfo | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('devices.list.title')}</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>
            {t('devices.list.refresh')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {query.isPending && <p className="text-sm text-muted-foreground">{t('common:state.loading')}</p>}
        {query.isError && <p role="alert" className="text-sm text-destructive">{describeError(t, query.error)}</p>}
        {query.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('devices.list.empty')}</p>}
        {query.data && query.data.length > 0 && (
          <ul className="flex flex-col divide-y">
            {query.data.map(device => (
              <DeviceRow key={device.deviceId} device={device} onRemove={() => setRemoving(device)} />
            ))}
          </ul>
        )}
      </CardContent>
      <RemoveDeviceDialog device={removing} onClose={() => setRemoving(null)} />
    </Card>
  )
}

function DeviceRow({ device, onRemove }: { device: DeviceInfo, onRemove: () => void }) {
  const { t } = useTranslation('account')
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {device.isCurrent
              ? t('devices.list.thisDevice')
              : t('devices.list.otherDevice', {
                  shortId: shortDeviceId(device.deviceId),
                })}
          </span>
          {device.revoked && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {t('devices.list.removed')}
            </span>
          )}
        </div>
        {device.createdAtMs > 0 && (
          <span className="text-xs text-muted-foreground">
            {t('devices.list.added', {
              date: formatDate(device.createdAtMs),
            })}
          </span>
        )}
      </div>
      {!device.isCurrent && !device.revoked && (
        <Button variant="outline" size="sm" onClick={onRemove}>{t('devices.list.remove')}</Button>
      )}
    </li>
  )
}

function RemoveDeviceDialog({ device, onClose }: { device: DeviceInfo | null, onClose: () => void }) {
  const { t } = useTranslation('account')
  const invalidateDevices = useInvalidateDevices()
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function remove() {
    if (!device)
      return
    setBusy(true)
    setError(null)
    try {
      await revokeDevice(device.deviceId)
      await invalidateDevices()
      onClose()
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
      open={device !== null}
      onOpenChange={(next) => {
        if (!next) {
          setError(null)
          onClose()
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('devices.list.removeTitle')}</DialogTitle>
          <DialogDescription>{t('devices.list.removeBody')}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t('devices.cancel')}</DialogClose>
          <Button variant="destructive" disabled={busy} onClick={remove}>{t('devices.list.removeConfirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
