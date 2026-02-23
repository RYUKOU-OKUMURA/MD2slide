import type { FastifyInstance } from 'fastify';

/**
 * Health check response type
 */
interface HealthCheckResponse {
  status: 'ok';
  timestamp: string;
}

/**
 * Health check routes
 */
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Reply: HealthCheckResponse }>(
    '/health',
    async (_request, reply) => {
      return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    }
  );
}
