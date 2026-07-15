import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/items', label: 'My items' },
  { to: '/requests', label: 'Requests' },
  { to: '/earnings', label: 'Earnings' },
]

export function DashboardLayout() {
  const { logout } = useAuth()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-four py-three">
        <nav className="flex gap-four">
          {NAV_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="text-foreground hover:text-primary">
              {link.label}
            </Link>
          ))}
        </nav>
        <Button variant="outline" onClick={logout}>
          Log out
        </Button>
      </header>
      <main className="p-four">
        <Outlet />
      </main>
    </div>
  )
}
