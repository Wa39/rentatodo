import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiGetMe, apiLogin, apiRegister } from './api'

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
})
