import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { ItemCard } from '@/components/ItemCard'
import { mockUser } from '@/lib/mockData'
import type { Category, Item } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CATEGORIES: Category[] = ['tools', 'photography', 'camping', 'sports', 'electronics', 'home', 'other']

export function PublishItemPage() {
  const t = useTranslation()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>(CATEGORIES[0])
  const [priceDollars, setPriceDollars] = useState('')
  const [description, setDescription] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')

  const previewItem: Item = {
    id: 'preview',
    name: name || t.publish.previewEmptyName,
    description: description || t.publish.previewEmptyDescription,
    category,
    price_per_day: Math.round(Number(priceDollars || '0') * 100),
    photo_url: photoUrl,
    is_active: true,
    owner_id: mockUser.id,
    owner_name: mockUser.name,
    created_at: new Date().toISOString(),
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Phase 1: no real POST /items call yet — mirrors the rest of the app's
    // mock-data-only behavior, just navigates back.
    navigate('/items')
  }

  function handleCancel() {
    navigate('/items')
  }

  return (
    <div>
      <PageHeader title={t.publish.title} subtitle={t.publish.subtitle} />
      <div className="grid grid-cols-2 gap-four p-four">
        <form onSubmit={handleSubmit} className="space-y-three rounded-lg border border-border bg-card p-four">
          <div className="space-y-half">
            <Label htmlFor="publish-name">{t.publish.name}</Label>
            <Input id="publish-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-half">
            <Label>{t.publish.category}</Label>
            <div className="flex flex-wrap gap-half">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-two py-half text-sm font-medium ${
                    category === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {t.categories[c]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-half">
            <Label htmlFor="publish-price">{t.publish.price}</Label>
            <Input
              id="publish-price"
              type="number"
              min={0.01}
              step={0.01}
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              required
            />
          </div>
          <div className="space-y-half">
            <Label htmlFor="publish-description">{t.publish.description}</Label>
            <textarea
              id="publish-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-card px-two py-half text-foreground"
            />
          </div>
          <div className="space-y-half">
            <Label htmlFor="publish-photo">{t.publish.photo}</Label>
            <Input id="publish-photo" type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} required />
          </div>
          <div className="flex gap-two">
            <Button type="submit" className="flex-1">
              {t.publish.submit}
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={handleCancel}>
              {t.publish.cancel}
            </Button>
          </div>
        </form>

        <div>
          <p className="mb-two text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.publish.previewTitle}</p>
          <ItemCard item={previewItem} readOnly />
        </div>
      </div>
    </div>
  )
}
