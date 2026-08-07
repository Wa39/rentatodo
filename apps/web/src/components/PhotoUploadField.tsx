import { useRef, useState, type ChangeEvent } from 'react'
import { ApiError, getErrorMessage } from '@/lib/api'
import { uploadPhoto } from '@/lib/uploadPhoto'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface PhotoUploadFieldProps {
  id: string
  label: string
  value: string
  onChange: (url: string) => void
  onUploadingChange?: (uploading: boolean) => void
  token: string
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function PhotoUploadField({ id, label, value, onChange, onUploadingChange, token }: PhotoUploadFieldProps) {
  const t = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(value)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    setUploading(true)
    onUploadingChange?.(true)
    try {
      setPreview(await readAsDataUrl(file))
      const publicUrl = await uploadPhoto(token, file)
      onChange(publicUrl)
    } catch (err) {
      setPreview(value)
      const knownMessages: Record<string, string> = {
        INVALID_FILE_TYPE: t.publish.photoInvalidType,
        FILE_TOO_LARGE: t.publish.photoTooLarge,
        UPLOAD_FAILED: t.publish.photoUploadFailed,
      }
      const code = err instanceof ApiError ? err.code : undefined
      setError(code && knownMessages[code] ? knownMessages[code] : getErrorMessage(err, t.errors.network))
    } finally {
      setUploading(false)
      onUploadingChange?.(false)
    }
  }

  return (
    <div className="space-y-half">
      <Label htmlFor={id}>{label}</Label>
      {preview && (
        <img src={preview} alt={label} className="h-32 w-32 rounded-md border border-border object-cover" />
      )}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden"
      />
      <div>
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? t.publish.photoUploading : value ? t.publish.photoReplace : t.publish.photoChoose}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
