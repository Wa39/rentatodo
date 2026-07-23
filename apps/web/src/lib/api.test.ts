import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  apiApproveReservation,
  apiCreateItem,
  apiDeleteItem,
  apiGetMe,
  apiListMyItems,
  apiListMyRequests,
  apiLogin,
  apiRegister,
  apiRejectReservation,
  apiUpdateItem,
} from './api'

function jsonResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

describe('api', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('apiLogin', () => {
    it('POSTs to /auth/login and resolves with the token payload on success', async () => {
      const payload = { access_token: 'tok123', token_type: 'bearer', expires_in: 86400 }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiLogin('maria@example.com', 'securepass123')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'maria@example.com', password: 'securepass123' }),
        }),
      )
    })

    it('throws ApiError with the code/message from a 401 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401),
      )

      await expect(apiLogin('maria@example.com', 'wrong')).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      })
    })

    it('throws a generic ApiError instead of a raw TypeError when the error body has no error envelope', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: 'Internal Server Error' }, 500))

      await expect(apiLogin('maria@example.com', 'securepass123')).rejects.toBeInstanceOf(ApiError)
    })
  })

  describe('apiRegister', () => {
    it('POSTs to /auth/register and resolves with the created user on success', async () => {
      const payload = { id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 201))

      const result = await apiRegister('María Vargas', 'maria@example.com', 'securepass123')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/auth/register',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'María Vargas', email: 'maria@example.com', password: 'securepass123' }),
        }),
      )
    })

    it('throws ApiError with the code/message from a 422 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'email: already registered' } }, 422),
      )

      await expect(apiRegister('María Vargas', 'maria@example.com', 'securepass123')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'email: already registered',
      })
    })
  })

  describe('apiGetMe', () => {
    it('GETs /users/me with a Bearer token and resolves with the profile', async () => {
      const payload = { id: 'u1', name: 'María Vargas', email: 'maria@example.com', created_at: '2026-01-01T00:00:00Z' }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiGetMe('tok123')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/users/me',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
        }),
      )
    })

    it('throws ApiError on a 401 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401),
      )

      await expect(apiGetMe('expired-token')).rejects.toBeInstanceOf(ApiError)
    })
  })

  describe('apiCreateItem', () => {
    it('POSTs to /items with a Bearer token and resolves with the created item', async () => {
      const payload = {
        id: 'i1',
        name: 'Taladro Bosch Professional',
        description: 'Taladro inalámbrico 18V con maletín y 3 brocas',
        category: 'tools',
        price_per_day: 5000,
        photo_url: 'https://storage.example.com/photos/taladro.jpg',
        is_active: true,
        owner_id: 'u1',
        owner_name: 'María Vargas',
        created_at: '2026-01-01T00:00:00Z',
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 201))

      const result = await apiCreateItem('tok123', {
        name: 'Taladro Bosch Professional',
        description: 'Taladro inalámbrico 18V con maletín y 3 brocas',
        category: 'tools',
        price_per_day: 5000,
        photo_url: 'https://storage.example.com/photos/taladro.jpg',
      })

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Taladro Bosch Professional',
            description: 'Taladro inalámbrico 18V con maletín y 3 brocas',
            category: 'tools',
            price_per_day: 5000,
            photo_url: 'https://storage.example.com/photos/taladro.jpg',
          }),
          headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
        }),
      )
    })

    it('throws ApiError with the code/message from a 422 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'price_per_day: must be greater than 0' } }, 422),
      )

      await expect(
        apiCreateItem('tok123', {
          name: 'x',
          description: 'x',
          category: 'tools',
          price_per_day: 0,
          photo_url: 'https://example.com/p.jpg',
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: 'price_per_day: must be greater than 0' })
    })
  })

  describe('apiListMyItems', () => {
    it('GETs /users/me/items with a Bearer token and resolves with the array of items', async () => {
      const payload = [
        {
          id: 'i1',
          name: 'Taladro Bosch Professional',
          description: 'desc',
          category: 'tools',
          price_per_day: 5000,
          photo_url: 'https://example.com/p.jpg',
          is_active: true,
          owner_id: 'u1',
          owner_name: 'María Vargas',
          created_at: '2026-01-01T00:00:00Z',
        },
      ]
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiListMyItems('tok123')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/users/me/items',
        expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) }),
      )
    })

    it('throws ApiError on a 401 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401))

      await expect(apiListMyItems('bad-token')).rejects.toBeInstanceOf(ApiError)
    })
  })

  describe('apiUpdateItem', () => {
    it('PATCHes /items/{id} with a Bearer token and resolves with the updated item', async () => {
      const payload = {
        id: 'i1',
        name: 'Renamed',
        description: 'desc',
        category: 'tools',
        price_per_day: 5000,
        photo_url: 'https://example.com/p.jpg',
        is_active: true,
        owner_id: 'u1',
        owner_name: 'María Vargas',
        created_at: '2026-01-01T00:00:00Z',
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiUpdateItem('tok123', 'i1', { name: 'Renamed' })

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/items/i1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Renamed' }),
          headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
        }),
      )
    })

    it('throws ApiError with the code/message from a 403 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'FORBIDDEN', message: 'Not the owner' } }, 403))

      await expect(apiUpdateItem('tok123', 'i1', { name: 'Renamed' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Not the owner',
      })
    })
  })

  describe('apiDeleteItem', () => {
    it('DELETEs /items/{id} with a Bearer token and resolves with the deactivated item', async () => {
      const payload = {
        id: 'i1',
        name: 'Taladro Bosch Professional',
        description: 'desc',
        category: 'tools',
        price_per_day: 5000,
        photo_url: 'https://example.com/p.jpg',
        is_active: false,
        owner_id: 'u1',
        owner_name: 'María Vargas',
        created_at: '2026-01-01T00:00:00Z',
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiDeleteItem('tok123', 'i1')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/items/i1',
        expect.objectContaining({ method: 'DELETE', headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) }),
      )
    })

    it('throws ApiError with the code/message from a 404 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, 404))

      await expect(apiDeleteItem('tok123', 'missing')).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Item not found' })
    })
  })

  describe('apiListMyRequests', () => {
    it('GETs /users/me/requests?page=1&limit=50 with a Bearer token and resolves with the paginated envelope', async () => {
      const payload = {
        reservations: [
          {
            id: 'r1',
            item_id: 'i1',
            item_name: 'Taladro Bosch Professional',
            item_photo_url: 'https://example.com/p.jpg',
            renter_id: 'u2',
            renter_name: 'Jorge Salas',
            start_date: '2026-07-18',
            end_date: '2026-07-20',
            status: 'requested',
            deposit_amount: 2000,
            deposit_status: 'none',
            created_at: '2026-07-14T12:00:00Z',
            updated_at: '2026-07-14T12:00:00Z',
          },
        ],
        page: 1,
        limit: 50,
        total: 1,
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiListMyRequests('tok123')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/users/me/requests?page=1&limit=50',
        expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) }),
      )
    })

    it('throws ApiError on a 401 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401))

      await expect(apiListMyRequests('bad-token')).rejects.toBeInstanceOf(ApiError)
    })
  })

  describe('apiApproveReservation', () => {
    it('PATCHes /reservations/{id}/approve with a Bearer token and resolves with the updated reservation', async () => {
      const payload = {
        id: 'r1',
        item_id: 'i1',
        item_name: 'Taladro Bosch Professional',
        item_photo_url: 'https://example.com/p.jpg',
        renter_id: 'u2',
        renter_name: 'Jorge Salas',
        start_date: '2026-07-18',
        end_date: '2026-07-20',
        status: 'approved',
        deposit_amount: 2000,
        deposit_status: 'held',
        created_at: '2026-07-14T12:00:00Z',
        updated_at: '2026-07-15T09:00:00Z',
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiApproveReservation('tok123', 'r1')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/reservations/r1/approve',
        expect.objectContaining({ method: 'PATCH', headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) }),
      )
    })

    it('throws ApiError with the code/message from a 409 response (invalid transition)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: { code: 'INVALID_TRANSITION', message: 'Reservation is not in requested status' } }, 409),
      )

      await expect(apiApproveReservation('tok123', 'r1')).rejects.toMatchObject({
        code: 'INVALID_TRANSITION',
        message: 'Reservation is not in requested status',
      })
    })
  })

  describe('apiRejectReservation', () => {
    it('PATCHes /reservations/{id}/reject with a Bearer token and resolves with the updated reservation', async () => {
      const payload = {
        id: 'r1',
        item_id: 'i1',
        item_name: 'Taladro Bosch Professional',
        item_photo_url: 'https://example.com/p.jpg',
        renter_id: 'u2',
        renter_name: 'Jorge Salas',
        start_date: '2026-07-18',
        end_date: '2026-07-20',
        status: 'rejected',
        deposit_amount: 2000,
        deposit_status: 'none',
        created_at: '2026-07-14T12:00:00Z',
        updated_at: '2026-07-15T09:00:00Z',
      }
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload, 200))

      const result = await apiRejectReservation('tok123', 'r1')

      expect(result).toEqual(payload)
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/reservations/r1/reject',
        expect.objectContaining({ method: 'PATCH', headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) }),
      )
    })

    it('throws ApiError with the code/message from a 403 response (not the item owner)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'FORBIDDEN', message: 'Not the item owner' } }, 403))

      await expect(apiRejectReservation('tok123', 'r1')).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'Not the item owner' })
    })
  })
})
