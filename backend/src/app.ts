import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { accessLogMiddleware } from './middleware/access-log.js';
import { generalLimiter } from './middleware/rate-limit.js';
import { notFoundMiddleware } from './middleware/not-found.js';
import { errorHandlerMiddleware } from './middleware/error-handler.js';
import v1Router from './routes/index.js';

export const app = express();

// 1. Request context & tracing
app.use(requestIdMiddleware);

// 2. Structured access logging
app.use(accessLogMiddleware);

// 3. Security headers & CORS
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: env.APP_ORIGIN,
    credentials: true,
  })
);

// 4. Rate limiting
app.use(generalLimiter);

// 5. Body & cookie parsers
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser(env.COOKIE_SECRET));

// 6. Static files (uploads fallback)
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// 7. Mount API v1 routes
app.use('/api/v1', v1Router);

// 7. 404 Not Found handler
app.use(notFoundMiddleware);

// 8. Global Centralized Error handler
app.use(errorHandlerMiddleware);
