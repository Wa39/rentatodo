import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { useTranslation } from '@/lib/i18n'
import { mockRequests, mockUser } from '@/lib/mockData'
import { Button } from '@/components/ui/button'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function DashboardLayout() {
  const { logout } = useAuth()
  const location = useLocation()
  const t = useTranslation()
  const pendingCount = mockRequests.filter((r) => r.status === 'requested').length

  const navGroups = [
    { label: t.nav.groupPanel, items: [{ to: '/dashboard', label: t.nav.overview }] },
    {
      label: t.nav.groupInventory,
      items: [
        { to: '/items', label: t.nav.myItems },
        { to: '/items/publish', label: t.nav.publishItem },
      ],
    },
    { label: t.nav.groupActivity, items: [{ to: '/requests', label: t.nav.requests }] },
    { label: t.nav.groupFinance, items: [{ to: '/earnings', label: t.nav.earnings }] },
  ]

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-60 flex-shrink-0 flex-col bg-sidebar p-four text-sidebar-foreground">
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
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-two rounded-md px-two py-one text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      }`}
                    >
                      {item.label}
                      {item.to === '/requests' && pendingCount > 0 && (
                        <span className="ml-auto rounded-full bg-warning px-half text-xs font-bold text-warning-ink">
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
      <main className="flex-1 overflow-y-auto p-four">
        <Outlet />
      </main>
    </div>
  )
}
