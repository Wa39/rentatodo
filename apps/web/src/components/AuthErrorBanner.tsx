export function AuthErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="rounded-md bg-destructive/10 p-two text-sm text-destructive">{message}</p>
}
