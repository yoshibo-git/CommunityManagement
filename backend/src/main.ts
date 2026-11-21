import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app/configure-app';
import { readEnvironment } from './common/config/environment';

async function bootstrap() {
  const config = readEnvironment();
  const app = await NestFactory.create(AppModule);
  try {
    configureApp(app, config);
    app.enableShutdownHooks();
    if (process.env.FACE_ENROLLMENT_DEMO === 'true') await app.listen(config.port, '127.0.0.1');
    else await app.listen(config.port);
    console.log(`Backend is running at: http://localhost:${config.port}/api/v1`);
  } catch (error) {
    await app.close();
    throw error;
  }
}

bootstrap().catch(() => {
  console.error('Backend startup failed. Check environment configuration and database availability.');
  process.exitCode = 1;
});
