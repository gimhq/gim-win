import type { Session } from '@/lib/api'
import { cn } from 'cn'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { copyText } from '@/lib/api'
import { useSession } from '../queries'
import { describeError } from './describe-error'
import { DisplayNameForm } from './display-name-form'
import { avatarColor, initials } from './initials'
import { MyQrCard } from './my-qr-card'

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
  const [editing, setEditing] = React.useState(false)

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
          {editing
            ? <DisplayNameForm initialName={session.displayName} onDone={() => setEditing(false)} />
            : (
                <div className="flex items-center gap-2">
                  <p className="truncate text-base font-medium">{session.displayName}</p>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                    {t('profile.displayName.edit')}
                  </Button>
                </div>
              )}
        </div>
      </CardContent>
    </Card>
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
