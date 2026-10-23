import type { Session } from '@/lib/api'
import { cn } from 'cn'
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
import { copyText, releaseHandle } from '@/lib/api'
import { useInvalidateSession, useSession } from '../queries'
import { describeError } from './describe-error'
import { DisplayNameForm } from './display-name-form'
import { avatarColor, initials } from './initials'
import { MyQrCard } from './my-qr-card'
import { UsernameForm } from './username-form'

/** Settings > Profile: identity, Account ID and the user's QR code. */
export function ProfilePage() {
  const { t } = useTranslation()
  const query = useSession()

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold tracking-tight">{t('settings:titles.profile')}</h1>
      {query.isPending && <p className="text-sm text-muted-foreground">{t('state.loading')}</p>}
      {query.isError && <p role="alert" className="text-sm text-destructive">{describeError(t, query.error)}</p>}
      {query.data && (
        <div className="flex max-w-xl flex-col gap-4">
          <IdentityCard session={query.data} />
          <AccountIdCard userId={query.data.userId} />
          <MyQrCard userId={query.data.userId} />
        </div>
      )}
    </main>
  )
}

function IdentityCard({ session }: { session: Session }) {
  const { t } = useTranslation('account')
  const [editing, setEditing] = React.useState<'name' | 'username' | null>(null)

  return (
    <Card>
      <CardContent className="flex gap-4">
        <div
          aria-hidden
          className={cn(
            'flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-medium text-white',
            avatarColor(session.userId),
          )}
        >
          {initials(session.displayName)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {editing === 'name'
            ? <DisplayNameForm initialName={session.displayName} onDone={() => setEditing(null)} />
            : (
                <div className="flex items-center gap-2">
                  <p className="truncate text-base font-medium">{session.displayName}</p>
                  <Button variant="ghost" size="sm" onClick={() => setEditing('name')}>
                    {t('profile.displayName.edit')}
                  </Button>
                </div>
              )}
          {editing === 'username'
            ? <UsernameForm initialHandle={session.handle} onDone={() => setEditing(null)} />
            : <UsernameLine handle={session.handle} onEdit={() => setEditing('username')} />}
        </div>
      </CardContent>
    </Card>
  )
}

function UsernameLine({ handle, onEdit }: { handle: string, onEdit: () => void }) {
  const { t } = useTranslation('account')

  if (handle === '') {
    return (
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">{t('profile.username.empty')}</p>
        <Button variant="outline" size="sm" onClick={onEdit}>{t('profile.username.add')}</Button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <p className="truncate text-sm">
        @
        {handle}
      </p>
      <Button variant="ghost" size="sm" onClick={onEdit}>{t('profile.username.change')}</Button>
      <RemoveUsernameButton />
    </div>
  )
}

function RemoveUsernameButton() {
  const { t } = useTranslation('account')
  const invalidateSession = useInvalidateSession()
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await releaseHandle()
      await invalidateSession()
      setOpen(false)
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
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>{t('profile.username.remove')}</Button>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('profile.username.removeTitle')}</DialogTitle>
          <DialogDescription>{t('profile.username.removeBody')}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t('profile.cancel')}</DialogClose>
          <Button variant="destructive" disabled={busy} onClick={remove}>{t('profile.username.remove')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const COPIED_MS = 2000

function AccountIdCard({ userId }: { userId: string }) {
  const { t } = useTranslation('account')
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied)
      return
    const timer = setTimeout(setCopied, COPIED_MS, false)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    await copyText(userId)
    setCopied(true)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.accountId.label')}</CardTitle>
        <CardDescription>{t('profile.accountId.helper')}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <code className="min-w-0 flex-1 font-mono text-sm break-all">{userId}</code>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied
            ? t('profile.accountId.copied')
            : t('profile.accountId.copy')}
        </Button>
      </CardContent>
    </Card>
  )
}
