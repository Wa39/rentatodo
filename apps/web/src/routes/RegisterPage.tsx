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

function getPasswordError(password: string, t: ReturnType<typeof useTranslation>): string | null {
  if (password.length < 8) return t.register.passwordTooShort
  if (/\d{5,}/.test(password)) return t.register.passwordConsecutiveDigits
  return null
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const t = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const passwordError = password.length > 0 ? getPasswordError(password, t) : null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (passwordError) {
      // Don't also set `error` here — `passwordError` above already renders
      // this exact message inline under the field; setting both would show
      // the same text twice on screen.
      return
    }
    setSubmitting(true)
    try {
      await register(name, email, password)
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
        <h1 className="font-display text-lg font-semibold text-foreground">{t.register.title}</h1>
        <AuthErrorBanner message={error} />
        <div className="space-y-half">
          <Label htmlFor="name">{t.register.name}</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-half">
          <Label htmlFor="email">{t.register.email}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-half">
          <Label htmlFor="password">{t.register.password}</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t.register.submitting : t.register.submit}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t.register.hasAccountPrompt}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t.register.loginLink}
          </Link>
        </p>
      </form>
    </div>
  )
}
