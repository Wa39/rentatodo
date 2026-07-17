import { Link, Outlet, useLocation } from 'react-router-dom'
import { Calendar, DollarSign, LayoutGrid, MessageSquare, Package, Plus } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { useTranslation } from '@/lib/i18n'
import { formatCentavos, getInitials } from '@/lib/format'
import { mockEarnings, mockRequests, mockUser } from '@/lib/mockData'
import { Button } from '@/components/ui/button'

export function DashboardLayout() {
  const { logout } = useAuth()
  const location = useLocation()
  const t = useTranslation()
  const pendingCount = mockRequests.filter((r) => r.status === 'requested').length
  const months = mockEarnings.by_month
  const currentMonth = months[months.length - 1]
  const previousMonth = months[months.length - 2]
  const deltaPct = Math.round(((currentMonth.total - previousMonth.total) / previousMonth.total) * 100)

  const navGroups = [
    { label: t.nav.groupPanel, items: [{ to: '/dashboard', label: t.nav.overview, icon: LayoutGrid }] },
    {
      label: t.nav.groupInventory,
      items: [
        { to: '/items', label: t.nav.myItems, icon: Package },
        { to: '/items/publish', label: t.nav.publishItem, icon: Plus },
      ],
    },
    {
      label: t.nav.groupActivity,
      items: [
        { to: '/requests', label: t.nav.requests, icon: MessageSquare },
        { to: '/requests/calendar', label: t.nav.calendar, icon: Calendar },
      ],
    },
    { label: t.nav.groupFinance, items: [{ to: '/earnings', label: t.nav.earnings, icon: DollarSign }] },
  ]

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-72 flex-shrink-0 flex-col bg-sidebar p-four text-sidebar-foreground">
        <div className="mb-five flex items-center gap-two px-one">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-secondary-foreground font-display text-base font-bold text-primary-foreground">
            R
          </div>
          <span className="font-display text-base font-semibold text-white">RentaTodo</span>
        </div>

        <nav className="flex-1 space-y-four">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-two pb-one text-[10.5px] font-semibold uppercase tracking-wide text-sidebar-foreground/50">
                {group.label}
              </div>
              <div className="space-y-half">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.to
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-two rounded-md px-two py-two text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      }`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {item.label}
                      {item.to === '/requests' && pendingCount > 0 && (
                        <span className="ml-auto flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-warning text-xs font-bold text-warning-ink">
                          {pendingCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-four rounded-lg bg-sidebar-card p-three">
          <p className="text-xs font-medium uppercase tracking-wide text-sidebar-foreground/60">{t.nav.earnedThisMonth}</p>
          <p className="mt-half font-display text-xl font-semibold text-white">{formatCentavos(currentMonth.total)}</p>
          <p className="mt-half text-xs text-on-dark-accent">
            ↑ {deltaPct}% {t.nav.vsLastMonth}
          </p>
        </div>

        <div className="mt-four flex items-center gap-two border-t border-sidebar-border pt-three">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-warning text-xs font-bold text-warning-ink">
            {getInitials(mockUser.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{mockUser.name}</div>
            <div className="text-xs text-sidebar-foreground/60">{t.nav.ownerRole}</div>
          </div>
        </div>
        <Button variant="outline" className="mt-three" onClick={logout}>
          {t.nav.logOut}
        </Button>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
