import type { ReactNode } from 'react'
import { cn } from 'cn'
import * as React from 'react'
import { Separator } from '@/components/ui/separator'

interface SettingsPageProps {
  title: string
  description?: string
  children?: ReactNode
}

/** A settings section: the h1 the route tests look for, an optional lead and the groups. */
export function SettingsPage({ title, description, children }: SettingsPageProps) {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </header>
      {children}
    </main>
  )
}

interface SettingsGroupProps {
  title?: string
  children?: ReactNode
  className?: string
}

/** A titled group of rows, closed by a divider. */
export function SettingsGroup({ title, children, className }: SettingsGroupProps) {
  return (
    <section className={cn('flex flex-col gap-1', className)}>
      {title && <h2 className="px-1 pb-1 text-xs font-medium text-muted-foreground">{title}</h2>}
      {children}
      <Separator className="mt-3" />
    </section>
  )
}

interface SettingsRowProps {
  label: ReactNode
  hint?: ReactNode
  /** The control on the trailing side: a switch, a select, a button. */
  children?: ReactNode
  className?: string
  /** Links the label to the control, like `<label for>`. */
  htmlFor?: string
}

/** Label and optional hint on the left, the control slot on the right. */
export function SettingsRow({ label, hint, children, className, htmlFor }: SettingsRowProps) {
  const id = React.useId()
  const labelId = htmlFor
    ? undefined
    : id
  return (
    <div
      data-slot="settings-row"
      className={cn('flex items-center justify-between gap-4 rounded-md px-1 py-2', className)}
      aria-labelledby={labelId}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        {htmlFor
          ? <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
          : <span id={labelId} className="text-sm font-medium">{label}</span>}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children && <div className="flex shrink-0 items-center">{children}</div>}
    </div>
  )
}
