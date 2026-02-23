import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { config } from './config.js';
import { registerRoutes } from './routes/index.js';
import { createQueue } from './queue/index.js';

export async function createServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'development' ? 'debug' : 'info',
    },
  });

  // Register security headers with Helmet
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    originAgentCluster: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    xContentTypeOptions: true,
    xDnsPrefetchControl: { allow: false },
    xDownloadOptions: true,
    xFrameOptions: { action: 'deny' },
    xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
    xXssProtection: true,
  });

  // Register CORS with credentials support
  await app.register(cors, {
    origin: config.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours
  });

  // Register rate limiting
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    cache: 10000,
    allowList: ['127.0.0.1'],
    redis: config.NODE_ENV === 'production' ? undefined : undefined, // Redis can be added later for production
    nameSpace: 'md2slide-rate-limit:',
    continueExceeding: true,
    skipOnError: true,
  });

  // Create job queue and register routes
  const queue = createQueue();
  await registerRoutes(app, queue);

  return app;
}

export async function startServer(app: FastifyInstance): Promise<void> {
  try {
    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });
    app.log.info(`Server listening on ${config.HOST}:${config.PORT}`);
    app.log.info(`Environment: ${config.NODE_ENV}`);
    app.log.info(`Frontend URL: ${config.FRONTEND_URL}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Export a default app instance for testing
export const app = await createServer();
