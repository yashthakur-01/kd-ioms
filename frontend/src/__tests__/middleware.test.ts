import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

function createMockRequest(url: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(new URL(url, 'http://localhost:3000'));
  for (const [key, val] of Object.entries(cookies)) {
    req.cookies.set(key, val);
  }
  return req;
}

describe('Next.js Route Protection Middleware', () => {
  it('redirects unauthorized users from /dashboard to /login', () => {
    const req = createMockRequest('/dashboard');
    const res = middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login?callbackUrl=%2Fdashboard');
  });

  it('redirects unauthorized users from /catalog to /login', () => {
    const req = createMockRequest('/catalog');
    const res = middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login?callbackUrl=%2Fcatalog');
  });

  it('redirects unauthorized users from /orders to /login', () => {
    const req = createMockRequest('/orders');
    const res = middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login?callbackUrl=%2Forders');
  });

  it('allows public access to home / without authentication', () => {
    const req = createMockRequest('/');
    const res = middleware(req);

    // NextResponse.next() returns a 200 without redirect location header
    expect(res.headers.get('location')).toBeNull();
  });

  it('allows unauthenticated users to access /login', () => {
    const req = createMockRequest('/login');
    const res = middleware(req);

    expect(res.headers.get('location')).toBeNull();
  });

  it('allows authenticated admin users with token to access /dashboard', () => {
    const req = createMockRequest('/dashboard', {
      accessToken: 'valid-admin-jwt',
      userRole: 'ADMIN',
    });
    const res = middleware(req);

    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects authenticated retailers attempting to access /dashboard to /catalog', () => {
    const req = createMockRequest('/dashboard', {
      accessToken: 'valid-retailer-jwt',
      userRole: 'RETAILER',
    });
    const res = middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/catalog');
  });

  it('redirects authenticated admins attempting to access /cart to /dashboard', () => {
    const req = createMockRequest('/cart', {
      accessToken: 'valid-admin-jwt',
      userRole: 'ADMIN',
    });
    const res = middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard');
  });

  it('redirects authenticated admin on /login directly to /dashboard', () => {
    const req = createMockRequest('/login', {
      accessToken: 'valid-admin-jwt',
      userRole: 'ADMIN',
    });
    const res = middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/dashboard');
  });

  it('redirects authenticated retailer on /login directly to /catalog', () => {
    const req = createMockRequest('/login', {
      accessToken: 'valid-retailer-jwt',
      userRole: 'RETAILER',
    });
    const res = middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/catalog');
  });
});
