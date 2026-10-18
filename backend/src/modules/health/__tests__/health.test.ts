import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';

describe('Health & Global Error Middleware Integration', () => {
  it('GET /api/v1/health returns 200 with standard envelope and X-Request-Id', async () => {
    vi.spyOn(db, 'query').mockResolvedValueOnce({
      rows: [{ check: 1 }],
      rowCount: 1,
    });

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body).toMatchObject({
      success: true,
      code: 'HEALTH_OK',
      message: 'System healthy',
      data: {
        status: 'ok',
        db: 'up',
      },
      meta: {
        requestId: expect.any(String),
        timestamp: expect.any(String),
      },
    });
  });

  it('GET /api/v1/health returns 503 when database check fails', async () => {
    vi.spyOn(db, 'query').mockRejectedValueOnce(new Error('Connection terminated'));

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      success: false,
      code: 'DB_DOWN',
      message: 'Database service is currently unreachable',
      meta: {
        requestId: expect.any(String),
        timestamp: expect.any(String),
      },
    });
  });

  it('GET /api/v1/non-existent-endpoint returns 404 standard envelope', async () => {
    const res = await request(app).get('/api/v1/non-existent-endpoint');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      code: 'NOT_FOUND',
      meta: {
        requestId: expect.any(String),
        timestamp: expect.any(String),
      },
    });
  });

  it('POST with malformed JSON body returns 400 VALIDATION_ERROR envelope', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"invalid_json:');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
      meta: {
        requestId: expect.any(String),
      },
    });
  });
});
