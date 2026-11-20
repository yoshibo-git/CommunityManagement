import { BadRequestException, INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { readEnvironment } from '../common/config/environment';
import { ApiExceptionFilter } from '../common/errors/api-exception.filter';

export function configureApp(app: INestApplication, config: ReturnType<typeof readEnvironment>) {
  const logger = new Logger('HTTP');
  app.setGlobalPrefix('api/v1');
  app.use((request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const requestId = randomUUID();
    const startedAt = performance.now();
    request.headers['x-request-id'] = requestId;
    response.setHeader('X-Request-ID', requestId);
    response.once('finish', () => logger.log(JSON.stringify({
      requestId, method: request.method, status: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
    })));
    next();
  });
  app.enableCors({ origin: config.allowedOrigins, credentials: true, exposedHeaders: ['X-Request-ID'] });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true, transform: true,
    validationError: { target: false, value: false },
    exceptionFactory: () => new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Dữ liệu không hợp lệ.' }),
  }));
  app.useGlobalFilters(new ApiExceptionFilter(app.getHttpAdapter()));
}
