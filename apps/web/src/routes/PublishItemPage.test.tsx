import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/AuthContext'
import { ItemsProvider } from '@/lib/ItemsContext'
import { RequestsProvider } from '@/lib/RequestsContext'
import { PublishItemPage } from './PublishItemPage'
import { ItemsPage } from './ItemsPage'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function mockFetchRoutes(routes: Record<string, Array<() => Response>>) {
  const sortedPaths = Object.keys(routes).sort((a, b) => b.length - a.length)
  vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    const path = sortedPaths.find((candidate) => url.endsWith(candidate))
    const next = path ? routes[path].shift() : undefined
    if (!next) throw new Error(`Unhandled fetch call: ${url}`)
    return Promise.resolve(next())
  })
}

function makeFile(bytes: number[], name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]

const PROFILE = { id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }

function renderPage() {
  localStorage.setItem('rentatodo_token', 'tok123')
  render(
    <AuthProvider>
      <RequestsProvider>
        <ItemsProvider>
          <MemoryRouter initialEntries={['/items/publish']}>
            <Routes>
              <Route path="/items/publish" element={<PublishItemPage />} />
              <Route path="/items" element={<ItemsPage />} />
            </Routes>
          </MemoryRouter>
        </ItemsProvider>
      </RequestsProvider>
    </AuthProvider>,
  )
}

describe('PublishItemPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(global, 'fetch')
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({} as ImageBitmap))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('reflects the typed name in the live preview', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200)],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Taladro Bosch Professional')
    expect(screen.getAllByText('Taladro Bosch Professional')).toHaveLength(1)
  })

  it('adds the new item to the Items list on submit', async () => {
    const newItem = {
      id: 'i2',
      name: 'Bicicleta de montaña',
      description: 'A description',
      category: 'tools',
      price_per_day: 1000,
      photo_url: 'https://example.com/photo.jpg',
      is_active: true,
      owner_id: 'u1',
      owner_name: 'María Vargas',
      created_at: '2026-01-01T00:00:00Z',
    }
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200), () => jsonResponse([newItem], 200)],
      '/items': [() => jsonResponse(newItem, 201)],
      '/uploads/presign': [
        () =>
          jsonResponse(
            { upload_url: 'https://s3.example.com/upload-photo', public_url: 'https://example.com/photo.jpg', expires_in: 300 },
            200,
          ),
      ],
      '/upload-photo': [() => ({ ok: true, status: 200 }) as Response],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Bicicleta de montaña')
    await user.type(screen.getByLabelText('Price per day (USD)'), '10')
    await user.type(screen.getByLabelText('Description'), 'A description')
    await user.upload(screen.getByLabelText('Photo'), makeFile(JPEG_HEADER, 'photo.jpg', 'image/jpeg'))
    await waitFor(() => expect(screen.getByRole('img', { name: 'Photo' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Publish item' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'My items' })).toBeInTheDocument())
    expect(screen.getByText('Bicicleta de montaña')).toBeInTheDocument()
  })

  it('shows an error banner and stays on the page when the API rejects the submission', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200)],
      '/items': [
        () => jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'price_per_day: must be greater than 0' } }, 422),
      ],
      '/uploads/presign': [
        () =>
          jsonResponse(
            { upload_url: 'https://s3.example.com/upload-photo', public_url: 'https://example.com/photo.jpg', expires_in: 300 },
            200,
          ),
      ],
      '/upload-photo': [() => ({ ok: true, status: 200 }) as Response],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.type(screen.getByLabelText('Name'), 'Bicicleta de montaña')
    await user.type(screen.getByLabelText('Price per day (USD)'), '10')
    await user.type(screen.getByLabelText('Description'), 'A description')
    await user.upload(screen.getByLabelText('Photo'), makeFile(JPEG_HEADER, 'photo.jpg', 'image/jpeg'))
    await waitFor(() => expect(screen.getByRole('img', { name: 'Photo' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Publish item' }))
    await waitFor(() => expect(screen.getByText('price_per_day: must be greater than 0')).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'My items' })).not.toBeInTheDocument()
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Bicicleta de montaña')
  })

  it('navigates to /items on cancel without submitting', async () => {
    mockFetchRoutes({
      '/users/me': [() => jsonResponse(PROFILE, 200)],
      '/users/me/items': [() => jsonResponse([], 200)],
    })
    const user = userEvent.setup({ delay: null })
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: 'My items' })).toBeInTheDocument()
  })
})
