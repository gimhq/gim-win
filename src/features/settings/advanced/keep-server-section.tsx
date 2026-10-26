import type { KeepServerInfo, KeepSource } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  disableKeepServer,
  isAllowedServerUrl,
  isGimError,
  keepServer,
  resetKeepServer,
  restartApp,
  setKeepServerUrl,
} from '@/lib/api'
import { SettingsGroup } from '../ui'

const KEEP_SERVER_KEY = ['keepServer']

const STATE_KEYS: Record<KeepSource, string> = {
  builtIn: 'advanced.keep.state.builtIn',
  config: 'advanced.keep.state.config',
  off: 'advanced.keep.state.off',
  env: 'advanced.keep.state.env',
}

/** The keep server: its URL and state, Change, Reset to default, Turn off, and the restart prompt. */
export function KeepServerSection() {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: KEEP_SERVER_KEY, queryFn: keepServer })
  const [editing, setEditing] = React.useState(false)
  const [url, setUrl] = React.useState('')
  const [invalid, setInvalid] = React.useState(false)
  const [confirmOff, setConfirmOff] = React.useState(false)
  const urlId = React.useId()

  const change = useMutation({
    mutationFn: (action: () => Promise<KeepServerInfo>) => action(),
    onSuccess: (info) => {
      queryClient.setQueryData(KEEP_SERVER_KEY, info)
      setEditing(false)
      setConfirmOff(false)
    },
    onError: () => setConfirmOff(false),
  })

  const info = query.data
  if (!info)
    return null

  function save(event: React.FormEvent) {
    event.preventDefault()
    const value = url.trim()
    if (!isAllowedServerUrl(value)) {
      setInvalid(true)
      return
    }
    change.mutate(() => setKeepServerUrl(value))
  }

  return (
    <SettingsGroup>
      <Card size="sm">
        <CardHeader>
          <CardTitle>{t('advanced.keep.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{info.url ?? t('advanced.keep.none')}</span>
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {t(STATE_KEYS[info.source])}
            </span>
          </div>
          {info.source === 'env' && (
            <p className="text-xs text-muted-foreground">{t('advanced.keep.envNote')}</p>
          )}

          {editing
            ? (
                <form className="flex flex-col gap-2" onSubmit={save} noValidate>
                  <Label htmlFor={urlId}>{t('advanced.keep.urlLabel')}</Label>
                  <Input
                    id={urlId}
                    value={url}
                    inputMode="url"
                    autoComplete="off"
                    placeholder={t('advanced.urlPlaceholder')}
                    aria-invalid={invalid || undefined}
                    onChange={(event) => {
                      setUrl(event.target.value)
                      setInvalid(false)
                      change.reset()
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{t('advanced.keep.urlHint')}</p>
                  {invalid && <p role="alert" className="text-xs text-destructive">{t('advanced.keep.invalid')}</p>}
                  <div className="flex items-center gap-2">
                    <Button type="submit" size="sm" disabled={change.isPending}>{t('advanced.keep.save')}</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
                      {t('common:actions.cancel')}
                    </Button>
                  </div>
                </form>
              )
            : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setUrl(info.source === 'config' && info.url
                        ? info.url
                        : '')
                      setInvalid(false)
                      change.reset()
                      setEditing(true)
                    }}
                  >
                    {t('advanced.keep.change')}
                  </Button>
                  {info.source !== 'builtIn' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={change.isPending}
                      onClick={() => change.mutate(resetKeepServer)}
                    >
                      {t('advanced.keep.reset')}
                    </Button>
                  )}
                  {info.source !== 'off' && (
                    <Button size="sm" variant="outline" onClick={() => setConfirmOff(true)}>
                      {t('advanced.keep.turnOff')}
                    </Button>
                  )}
                </div>
              )}

          {change.error && (
            <p role="alert" className="text-xs text-destructive">
              {t(isGimError(change.error) && change.error.kind === 'InvalidInput'
                ? 'advanced.keep.invalid'
                : 'advanced.keep.error')}
            </p>
          )}

          {info.restartRequired && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
              <span className="text-sm">{t('advanced.keep.restartNotice')}</span>
              <Button size="sm" onClick={() => void restartApp()}>{t('advanced.keep.restartNow')}</Button>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="px-1 pt-2 text-xs text-muted-foreground">{t('advanced.keep.footer')}</p>

      <AlertDialog open={confirmOff} onOpenChange={setConfirmOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('advanced.keep.turnOffTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('advanced.keep.turnOffBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={change.isPending}
              onClick={() => change.mutate(disableKeepServer)}
            >
              {t('advanced.keep.turnOff')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsGroup>
  )
}
