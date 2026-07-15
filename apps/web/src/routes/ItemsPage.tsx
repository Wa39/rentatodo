import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { mockItems, mockUser } from '@/lib/mockData'
import type { Category, Item } from '@/lib/types'
import { formatCentavos } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CATEGORIES: Category[] = ['tools', 'photography', 'camping', 'sports', 'electronics', 'home']

const BLANK_FORM = { name: '', description: '', category: CATEGORIES[0], priceDollars: '', photoUrl: '' }

export function ItemsPage() {
  const [items, setItems] = useState<Item[]>(mockItems)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK_FORM)

  function openCreateDialog() {
    setEditingId(null)
    setForm(BLANK_FORM)
    setOpen(true)
  }

  function openEditDialog(item: Item) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      description: item.description,
      category: item.category,
      priceDollars: String(item.price_per_day / 100),
      photoUrl: item.photo_url,
    })
    setOpen(true)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const priceCentavos = Math.round(Number(form.priceDollars) * 100)

    if (editingId) {
      setItems((current) =>
        current.map((item) =>
          item.id === editingId
            ? { ...item, name: form.name, description: form.description, category: form.category, price_per_day: priceCentavos, photo_url: form.photoUrl }
            : item,
        ),
      )
    } else {
      const newItem: Item = {
        id: crypto.randomUUID(),
        name: form.name,
        description: form.description,
        category: form.category,
        price_per_day: priceCentavos,
        photo_url: form.photoUrl,
        is_active: true,
        owner_id: mockUser.id,
        owner_name: 'You',
        created_at: new Date().toISOString(),
      }
      setItems((current) => [...current, newItem])
    }

    setOpen(false)
    setEditingId(null)
    setForm(BLANK_FORM)
  }

  function handleDelete(item: Item) {
    // Phase 1: no real DELETE /items/{id} call yet — mirrors the API's soft
    // delete (is_active: false), never removes the row.
    const confirmed = window.confirm(`Delete "${item.name}"? It will stop appearing in public search.`)
    if (!confirmed) return
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, is_active: false } : i)))
  }

  return (
    <div className="space-y-three">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">My items</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>Publish item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit item' : 'Publish item'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-two">
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
                      {c}
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
              <Button type="submit" className="w-full">
                Save item
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ul className="space-y-two">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-three">
            <div>
              <Link to={`/items/${item.id}`} className="font-medium text-foreground hover:text-primary">
                {item.name}
              </Link>
              <p className="text-sm text-muted-foreground">
                {item.category} · {formatCentavos(item.price_per_day)}/day
              </p>
            </div>
            <div className="flex items-center gap-two">
              {!item.is_active && (
                <span className="rounded-full bg-destructive px-two py-half text-xs text-destructive-foreground">Inactive</span>
              )}
              <Button size="sm" variant="outline" onClick={() => openEditDialog(item)}>
                Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(item)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
