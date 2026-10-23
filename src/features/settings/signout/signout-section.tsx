import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { searchReset, signOut } from '@/lib/api'
import { SettingsPage } from '../ui'

/** Sign out: confirm with the recovery-kit wording, then back to onboarding. */
export function SignOutSection() {
  const { t } = useTranslation(['settings', 'common'])
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  async function confirm() {
    setPending(true)
    setFailed(false)
    try {
      await signOut()
      await searchReset().catch((error: unknown) => {
        console.error('search_reset failed', error)
      })
      queryClient.clear()
      await navigate({ to: '/onboarding' })
    }
    catch (error) {
      console.error('sign_out failed', error)
      setFailed(true)
      setOpen(false)
    }
    finally {
      setPending(false)
    }
  }

  return (
    <SettingsPage title={t('titles.signOut')}>
      <p className="text-sm text-muted-foreground">{t('signOut.body')}</p>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <div>
          <AlertDialogTrigger render={<Button variant="destructive" />}>
            {t('signOut.confirm')}
          </AlertDialogTrigger>
        </div>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('signOut.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('signOut.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={confirm}>
              {t('signOut.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {failed && <p role="alert" className="text-sm text-destructive">{t('common:errors.generic')}</p>}
    </SettingsPage>
  )
}
