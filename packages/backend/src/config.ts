import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().optional(),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  // Rate limiting configuration
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  // Job configuration
  JOB_TIMEOUT_MS: z.string().transform(Number).default('300000'), // 5 minutes
  MAX_FILE_SIZE_BYTES: z.string().transform(Number).default('10485760'), // 10MB
});

export type Config = z.infer<typeof configSchema>;

export const config = configSchema.parse(process.env);
