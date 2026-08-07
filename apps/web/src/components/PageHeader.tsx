import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-four py-three">
      <div>
        <h1 className="font-display text-lg font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
