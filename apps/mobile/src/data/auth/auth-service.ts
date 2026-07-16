import { apiFetch, getApiUrl } from '@/data/api/http';
import type { LoginResponse, User } from '@/data/types';

/**
 * Auth operations from the frozen contract:
 * POST /auth/register · POST /auth/login · GET /users/me
 *
 * ApiAuthService talks to the real backend; MockAuthService keeps the
 * app usable in demo mode (no API running): any credentials sign in.
 */
export interface AuthService {
  register(name: string, email: string, password: string): Promise<User>;
  login(email: string, password: string): Promise<LoginResponse>;
  getProfile(): Promise<User>;
}

class ApiAuthService implements AuthService {
  register(name: string, email: string, password: string): Promise<User> {
    return apiFetch<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  }

  login(email: string, password: string): Promise<LoginResponse> {
    return apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  getProfile(): Promise<User> {
    return apiFetch<User>('/users/me');
  }
}

class MockAuthService implements AuthService {
  // Remembers the last identity used so the demo profile looks coherent.
  private name = 'Zero (demo)';
  private email = 'zero@rentatodo.dev';

  async register(name: string, email: string): Promise<User> {
    this.name = name;
    this.email = email;
    return this.getProfile();
  }

  async login(email: string): Promise<LoginResponse> {
    this.email = email;
    return { access_token: 'mock-token', token_type: 'bearer', expires_in: 86400 };
  }

  async getProfile(): Promise<User> {
    return { id: 'u1', name: this.name, email: this.email, created_at: '2026-07-01T12:00:00Z' };
  }
}

export const authService: AuthService = getApiUrl() ? new ApiAuthService() : new MockAuthService();
