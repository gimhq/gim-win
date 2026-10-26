import type { HubInfo } from '@/lib/api'
import { useMutation } from '@tanstack/react-query'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addHub, isGimError, hubs as listHubs, removeHub, setPrimaryHub, subscribeHubList } from '@/lib/api'
import { SettingsGroup, SettingsPage } from '../ui'
import { addErrorKey, hubStateLabelKey, isValidHubUrl, removeErrorKey, sortHubs } from './hub-view'

/** The open remove confirmation: the first ask, or the second one when the server owns groups. */
type RemoveDialog
  = | { hubId: string, step: 'confirm' }
    | { hubId: string, step: 'ownsGroups', groupCount: number }

/** The live hub list: `subscribeHubList`, or a one-off `hubs()` if the subscription fails. */
function useHubList(): HubInfo[] {
  const [list, setList] = React.useState<HubInfo[]>([])
  React.useEffect(() => {
    let active = true
    let stop: (() => Promise<void>) | undefined
    subscribeHubList((next) => {
      if (active)
        setList(next)
    })
      .then((unsubscribe) => {
        if (active)
          stop = unsubscribe
        else
          void unsubscribe()
      })
      .catch((error: unknown) => {
        console.error('subscribe_hub_list failed, loading the list once', error)
        listHubs()
          .then((next) => {
            if (active)
              setList(next)
          })
          .catch((err: unknown) => console.error('hubs failed', err))
      })
    return () => {
      active = false
      void stop?.()
    }
  }, [])
  return list
}

/** The Advanced page: the server list and the add form, then `children`. */
export function ServersSection({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation('settings')
  const hubs = sortHubs(useHubList())
  const [dialog, setDialog] = React.useState<RemoveDialog | null>(null)
  const [rowErrors, setRowErrors] = React.useState<Record<string, string>>({})
  const [url, setUrl] = React.useState('')

  const setRowError = (hubId: string, key: string | null) => setRowErrors(({ [hubId]: _, ...rest }) => key
    ? { ...rest, [hubId]: key }
    : rest)

  const remove = useMutation({
    mutationFn: ({ hubId, confirmOwnedGroups }: { hubId: string, confirmOwnedGroups: boolean }) =>
      removeHub(hubId, confirmOwnedGroups),
    onSuccess: (_, { hubId }) => {
      setDialog(null)
      setRowError(hubId, null)
    },
    onError: (error, { hubId }) => {
      if (isGimError(error) && error.kind === 'HubOwnsGroups') {
        setDialog({ hubId, step: 'ownsGroups', groupCount: error.groupCount })
        return
      }
      setDialog(null)
      setRowError(hubId, isGimError(error)
        ? removeErrorKey(error)
        : 'advanced.errors.generic')
    },
  })

  const makeMain = useMutation({
    mutationFn: (hubId: string) => setPrimaryHub(hubId),
    onSuccess: (_, hubId) => setRowError(hubId, null),
    onError: (_, hubId) => setRowError(hubId, 'advanced.errors.generic'),
  })

  const add = useMutation({
    mutationFn: (value: string) => addHub(value),
    onSuccess: () => setUrl(''),
  })

  const urlId = React.useId()
  const canAdd = isValidHubUrl(url) && !add.isPending

  return (
    <SettingsPage title={t('titles.advanced')}>
      <SettingsGroup title={t('advanced.servers')}>
        <p className="px-1 pb-2 text-xs text-muted-foreground">{t('advanced.serversHint')}</p>
        <ul className="flex flex-col">
          {hubs.map(hub => (
            <li key={hub.hubId} className="flex flex-col gap-1 rounded-md px-1 py-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{hub.url ?? hub.hubId}</span>
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {t(hubStateLabelKey(hub.state))}
                  </span>
                  {hub.isPrimary && (
                    <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                      {t('advanced.mainServer')}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!hub.isPrimary && hub.state !== 'Removed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={makeMain.isPending}
                      onClick={() => makeMain.mutate(hub.hubId)}
                    >
                      {t('advanced.makeMain')}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialog({ hubId: hub.hubId, step: 'confirm' })}
                  >
                    {t('common:actions.remove')}
                  </Button>
                </div>
              </div>
              {rowErrors[hub.hubId] && (
                <p role="alert" className="text-xs text-destructive">{t(rowErrors[hub.hubId])}</p>
              )}
            </li>
          ))}
        </ul>
      </SettingsGroup>

      <SettingsGroup title={t('advanced.addServer')}>
        <form
          className="flex flex-col gap-2 px-1"
          onSubmit={(event) => {
            event.preventDefault()
            if (canAdd)
              add.mutate(url)
          }}
        >
          <Label htmlFor={urlId}>{t('advanced.serverUrl')}</Label>
          <div className="flex items-center gap-2">
            <Input
              id={urlId}
              value={url}
              placeholder={t('advanced.urlPlaceholder')}
              onChange={(event) => {
                setUrl(event.target.value)
                add.reset()
              }}
            />
            <Button type="submit" disabled={!canAdd}>{t('common:actions.add')}</Button>
          </div>
          {add.error && (
            <p role="alert" className="text-xs text-destructive">
              {t(isGimError(add.error)
                ? addErrorKey(add.error)
                : 'advanced.errors.generic')}
            </p>
          )}
        </form>
      </SettingsGroup>

      {children}

      <AlertDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open)
            setDialog(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog?.step === 'ownsGroups'
                ? t('advanced.ownsGroupsTitle')
                : t('advanced.removeTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog?.step === 'ownsGroups'
                ? t('advanced.ownsGroupsBody', { count: dialog.groupCount })
                : t('advanced.removeBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (dialog)
                  remove.mutate({ hubId: dialog.hubId, confirmOwnedGroups: dialog.step === 'ownsGroups' })
              }}
            >
              {dialog?.step === 'ownsGroups'
                ? t('advanced.removeAnyway')
                : t('common:actions.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPage>
  )
}
