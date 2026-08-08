import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { ItemCard } from '@/components/ItemCard'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'
import { useItems } from '@/lib/ItemsContext'
import { getErrorMessage } from '@/lib/api'
import { dollarsToCentavos } from '@/lib/format'
import type { Category, Item } from '@/lib/types'
import { useTranslation } from '@/lib/i18n'
import { useAuth } from '@/lib/AuthContext'
import { PhotoUploadField } from '@/components/PhotoUploadField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CATEGORIES: Category[] = ['tools', 'photography', 'camping', 'sports', 'electronics', 'home', 'other']

const BLANK_FORM = { name: '', description: '', category: CATEGORIES[0], priceDollars: '', photoUrl: '' }

export function ItemsPage() {
  const t = useTranslation()
  const { items, loading, error, updateItem, deleteItem, reactivateItem } = useItems()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [query, setQuery] = useState('')
  const [dialogSubmitting, setDialogSubmitting] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const { token } = useAuth()
  const [photoUploading, setPhotoUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [reactivateTarget, setReactivateTarget] = useState<Item | null>(null)
  const [reactivating, setReactivating] = useState(false)
  const [reactivateError, setReactivateError] = useState<string | null>(null)

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
    setPhotoUploading(false)
    setOpen(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editingId || photoUploading) return
    setDialogSubmitting(true)
    setDialogError(null)
    try {
      // Match PublishItemPage's fallback: an empty field should mean "$0",
      // not NaN — dollarsToCentavos('') is NaN, which JSON.stringify would
      // otherwise silently turn into `price_per_day: null` in the request.
      const priceCentavos = dollarsToCentavos(form.priceDollars || '0')
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

  function handleDelete(item: Item) {
    setDeleteError(null)
    setDeleteTarget(item)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteItem(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(getErrorMessage(err, t.errors.network))
    } finally {
      setDeleting(false)
    }
  }

  function handleReactivate(item: Item) {
    setReactivateError(null)
    setReactivateTarget(item)
  }

  async function confirmReactivate() {
    if (!reactivateTarget) return
    setReactivating(true)
    setReactivateError(null)
    try {
      await reactivateItem(reactivateTarget.id)
      setReactivateTarget(null)
    } catch (err) {
      setReactivateError(getErrorMessage(err, t.errors.network))
    } finally {
      setReactivating(false)
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
              <PhotoUploadField
                key={editingId ?? 'new'}
                id="item-photo"
                label="Photo"
                value={form.photoUrl}
                onChange={(url) => setForm((f) => ({ ...f, photoUrl: url }))}
                onUploadingChange={setPhotoUploading}
                token={token ?? ''}
              />
              <Button type="submit" className="w-full" disabled={dialogSubmitting || !form.photoUrl || photoUploading}>
                {dialogSubmitting ? 'Saving…' : 'Save item'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteTarget !== null} onOpenChange={(next) => { if (!deleting && !next) setDeleteTarget(null) }}>
          <DialogContent className="max-w-md gap-5 p-7">
            <DialogHeader>
              <DialogTitle className="text-xl">{t.items.deleteDialog.title}</DialogTitle>
              <DialogDescription className="text-base leading-relaxed text-foreground/90">
                {deleteTarget && (
                  <>
                    {t.items.deleteDialog.descriptionPrefix(deleteTarget.name)}
                    <strong className="font-bold text-foreground">{t.items.deleteDialog.descriptionEmphasis1}</strong>
                    {t.items.deleteDialog.descriptionMiddle}
                    <strong className="font-bold text-foreground">{t.items.deleteDialog.descriptionEmphasis2}</strong>
                    {t.items.deleteDialog.descriptionSuffix}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <AuthErrorBanner message={deleteError} />
            <DialogFooter className="sm:justify-center sm:space-x-3">
              <Button type="button" variant="destructive" disabled={deleting} onClick={confirmDelete}>
                {deleting ? t.items.deleteDialog.deleting : t.items.deleteDialog.confirm}
              </Button>
              <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                {t.items.deleteDialog.cancel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={reactivateTarget !== null} onOpenChange={(next) => { if (!reactivating && !next) setReactivateTarget(null) }}>
          <DialogContent className="max-w-md gap-5 p-7">
            <DialogHeader>
              <DialogTitle className="text-xl">{t.items.reactivateDialog.title}</DialogTitle>
              <DialogDescription className="text-base leading-relaxed text-foreground/90">
                {reactivateTarget && t.items.reactivateDialog.description(reactivateTarget.name)}
              </DialogDescription>
            </DialogHeader>
            <AuthErrorBanner message={reactivateError} />
            <DialogFooter className="sm:justify-center sm:space-x-3">
              <Button type="button" disabled={reactivating} onClick={confirmReactivate}>
                {reactivating ? t.items.reactivateDialog.reactivating : t.items.reactivateDialog.confirm}
              </Button>
              <Button type="button" variant="outline" disabled={reactivating} onClick={() => setReactivateTarget(null)}>
                {t.items.reactivateDialog.cancel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t.items.loading}</p>
        ) : (
          <div className="grid grid-cols-4 gap-three">
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} onEdit={openEditDialog} onDelete={handleDelete} onReactivate={handleReactivate} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
