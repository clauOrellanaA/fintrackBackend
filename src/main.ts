import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readEnvironment } from './config/environment';

async function bootstrap() {
  const config = readEnvironment();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(config.apiPrefix);
  app.enableCors({ origin: config.corsOrigin });
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  console.log(`API: http://localhost:${config.port}/${config.apiPrefix}/health`);
}

bootstrap().catch(() => {
  console.error('No se pudo iniciar la API. Revisa la configuración local y que el puerto esté libre.');
  process.exitCode = 1;
});
