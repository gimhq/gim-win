import type { TFunction } from 'i18next'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { approveLink, confirmApproval, isGimError } from '@/lib/api'
import { useInvalidateDevices } from '../device-queries'
import { describeError } from './describe-error'
import { initialLinkState, linkReducer, pendingApprovalId } from './link-device-flow'
import { shortDeviceId } from './short-id'

function describeLinkError(t: TFunction, error: unknown): string {
  return isGimError(error) && error.kind === 'InvalidInput'
    ? t('devices.link.invalidCode')
    : describeError(t, error)
}

/** "Link a new device": the old-device side, approving the code the new device shows. */
export function LinkDeviceCard() {
  const { t } = useTranslation('account')
  const [open, setOpen] = React.useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('devices.link.title')}</CardTitle>
        <CardDescription>{t('devices.link.body')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => setOpen(true)}>{t('devices.link.title')}</Button>
        {open && <LinkDeviceDialog onClose={() => setOpen(false)} />}
      </CardContent>
    </Card>
  )
}

function LinkDeviceDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('account')
  const invalidateDevices = useInvalidateDevices()
  const [state, dispatch] = React.useReducer(linkReducer, initialLinkState)
  const [code, setCode] = React.useState('')

  async function approve(event: React.FormEvent) {
    event.preventDefault()
    const qrString = code.trim()
    if (qrString === '')
      return
    dispatch({ type: 'submit' })
    try {
      dispatch({ type: 'approved', approval: await approveLink(qrString) })
    }
    catch (error) {
      dispatch({ type: 'failed', error })
    }
  }

  async function choose(approvalId: string, accepted: boolean) {
    dispatch({ type: 'choose', accepted })
    try {
      await confirmApproval(approvalId, accepted)
      dispatch({ type: 'confirmed' })
    }
    catch (error) {
      dispatch({ type: 'failed', error })
    }
  }

  function close() {
    // An approval left without a choice must be rejected (API.md, linking).
    const abandoned = pendingApprovalId(state)
    if (abandoned)
      void confirmApproval(abandoned, false).catch(() => {})
    void invalidateDevices()
    onClose()
  }

  const approval = 'approval' in state
    ? state.approval
    : undefined
  const error = state.step === 'failed'
    ? describeLinkError(t, state.error)
    : null

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next)
          close()
      }}
    >
      <DialogContent showCloseButton={false}>
        {(state.step === 'linked' || state.step === 'rejected') && (
          <>
            <DialogHeader>
              <DialogTitle>{t('devices.link.title')}</DialogTitle>
              <DialogDescription role="status">
                {state.step === 'linked'
                  ? t('devices.link.linked')
                  : t('devices.link.rejected')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={close}>{t('devices.link.done')}</Button>
            </DialogFooter>
          </>
        )}
        {approval && (
          <>
            <DialogHeader>
              <DialogTitle>{t('devices.link.compareTitle')}</DialogTitle>
              <DialogDescription>{t('devices.link.compareBody')}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-1 py-2">
              <span className="font-mono text-3xl font-semibold tracking-widest">{approval.sas}</span>
              <span className="text-sm text-muted-foreground">
                {t('devices.link.newDevice', {
                  shortId: shortDeviceId(approval.deviceId),
                })}
              </span>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <DialogClose render={<Button variant="ghost" />}>{t('devices.cancel')}</DialogClose>
              <Button
                variant="outline"
                disabled={state.step === 'confirming'}
                onClick={() => void choose(approval.approvalId, false)}
              >
                {t('devices.link.noMatch')}
              </Button>
              <Button disabled={state.step === 'confirming'} onClick={() => void choose(approval.approvalId, true)}>
                {t('devices.link.match')}
              </Button>
            </DialogFooter>
          </>
        )}
        {(state.step === 'idle' || state.step === 'approving' || (state.step === 'failed' && !approval)) && (
          <form className="flex flex-col gap-4" onSubmit={approve} noValidate>
            <DialogHeader>
              <DialogTitle>{t('devices.link.pasteTitle')}</DialogTitle>
              <DialogDescription>{t('devices.link.body')}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="link-code">{t('devices.link.codeLabel')}</Label>
              <Input
                id="link-code"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                autoFocus
                value={code}
                onChange={event => setCode(event.target.value)}
                aria-invalid={error !== null || undefined}
              />
              {/* A "Scan from image" option for the new device's QR code goes here. */}
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>{t('devices.cancel')}</DialogClose>
              <Button type="submit" disabled={state.step === 'approving' || code.trim() === ''}>
                {t('devices.link.continue')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
