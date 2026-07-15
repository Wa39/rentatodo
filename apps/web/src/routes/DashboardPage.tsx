import { mockUser } from '@/lib/mockData'

export function DashboardPage() {
  return (
    <div className="space-y-two">
      <h1 className="text-lg font-semibold text-foreground">Welcome back</h1>
      <p className="text-foreground">{mockUser.name}</p>
      <p className="text-muted-foreground">{mockUser.email}</p>
    </div>
  )
}
