import { createFileRoute, Outlet } from '@tanstack/react-router'
import * as React from 'react'
import { SettingsSectionList } from '@/features/settings/section-list'
import { useSettingsStore } from '@/features/settings/store'

export const Route = createFileRoute('/_shell/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  // Every section reads the store; load it once here.
  React.useEffect(() => {
    void useSettingsStore.getState().load()
  }, [])
  return (
    <div className="flex flex-1 overflow-hidden">
      <SettingsSectionList />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
