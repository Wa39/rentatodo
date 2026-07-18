import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { getErrorMessage } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { AuthBrandHeader } from '@/components/AuthBrandHeader'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const t = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(getErrorMessage(err, t.errors.network))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-four bg-background">
      <AuthBrandHeader />
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-three rounded-lg border border-border bg-card p-four">
        <h1 className="font-display text-lg font-semibold text-foreground">{t.login.title}</h1>
        <AuthErrorBanner message={error} />
        <div className="space-y-half">
          <Label htmlFor="email">{t.login.email}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-half">
          <Label htmlFor="password">{t.login.password}</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t.login.submitting : t.login.submit}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t.login.noAccountPrompt}{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            {t.login.registerLink}
          </Link>
        </p>
      </form>
    </div>
  )
}
