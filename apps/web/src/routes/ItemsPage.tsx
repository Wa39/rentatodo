import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { ItemCard } from '@/components/ItemCard'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'
import { useItems } from '@/lib/ItemsContext'
import { getErrorMessage } from '@/lib/api'
import type { Category, Item } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CATEGORIES: Category[] = ['tools', 'photography', 'camping', 'sports', 'electronics', 'home', 'other']

const BLANK_FORM = { name: '', description: '', category: CATEGORIES[0], priceDollars: '', photoUrl: '' }

export function ItemsPage() {
  const t = useTranslation()
  const { items, loading, error, updateItem, deleteItem } = useItems()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [query, setQuery] = useState('')
  const [dialogSubmitting, setDialogSubmitting] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const activeCount = items.filter((i) => i.is_active).length
  const inactiveCount = items.length - activeCount

  const filteredItems = items.filter((item) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return item.name.toLowerCase().includes(q) || t.categories[item.category].toLowerCase().includes(q)
  })

  function openEditDialog(item: Item) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      description: item.description,
      category: item.category,
      priceDollars: String(item.price_per_day / 100),
      photoUrl: item.photo_url,
    })
    setDialogError(null)
    setOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editingId) return
    setDialogSubmitting(true)
    setDialogError(null)
    try {
      const priceCentavos = Math.round(Number(form.priceDollars) * 100)
      await updateItem(editingId, {
        name: form.name,
        description: form.description,
        category: form.category,
        price_per_day: priceCentavos,
        photo_url: form.photoUrl,
      })
      setOpen(false)
      setEditingId(null)
      setForm(BLANK_FORM)
    } catch (err) {
      setDialogError(getErrorMessage(err, t.errors.network))
    } finally {
      setDialogSubmitting(false)
    }
  }

  async function handleDelete(item: Item) {
    const confirmed = window.confirm(`Delete "${item.name}"? It will stop appearing in public search.`)
    if (!confirmed) return
    try {
      await deleteItem(item.id)
    } catch (err) {
      window.alert(getErrorMessage(err, t.errors.network))
    }
  }

  return (
    <div>
      <PageHeader
        title={t.items.title}
        subtitle={t.items.subtitle(activeCount, inactiveCount)}
        action={
          <Button asChild>
            <Link to="/items/publish">{t.dashboard.publishItem}</Link>
          </Button>
        }
      />
      <div className="space-y-three p-four">
        <AuthErrorBanner message={error} />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.items.searchPlaceholder}
          aria-label={t.items.searchPlaceholder}
        />

        <Dialog open={open} onOpenChange={(next) => { if (!dialogSubmitting) setOpen(next) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit item</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-two">
              <AuthErrorBanner message={dialogError} />
              <div className="space-y-half">
                <Label htmlFor="item-name">Name</Label>
                <Input id="item-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-half">
                <Label htmlFor="item-description">Description</Label>
                <Input
                  id="item-description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-half">
                <Label htmlFor="item-category">Category</Label>
                <select
                  id="item-category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
                  className="w-full rounded-md border border-input bg-card px-two py-half text-foreground"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t.categories[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-half">
                <Label htmlFor="item-price">Price per day (USD)</Label>
                <Input
                  id="item-price"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={form.priceDollars}
                  onChange={(e) => setForm((f) => ({ ...f, priceDollars: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-half">
                <Label htmlFor="item-photo">Photo URL</Label>
                <Input
                  id="item-photo"
                  type="url"
                  value={form.photoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={dialogSubmitting}>
                {dialogSubmitting ? 'Saving…' : 'Save item'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t.items.loading}</p>
        ) : (
          <div className="grid grid-cols-4 gap-three">
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} onEdit={openEditDialog} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
