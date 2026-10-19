import 'dotenv/config';

export function readEnvironment() {
  const port = Number(process.env.PORT ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe ser un puerto válido.');
  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  if (!/^[a-zA-Z0-9-]+(?:\/[a-zA-Z0-9-]+)*$/.test(apiPrefix)) throw new Error('API_PREFIX no es válido.');
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  const origin = new URL(corsOrigin);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== corsOrigin) {
    throw new Error('CORS_ORIGIN debe contener un único origen HTTP válido, sin ruta.');
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Falta DATABASE_URL. Ejecuta npm run setup.');
  if (!['postgres:', 'postgresql:'].includes(new URL(databaseUrl).protocol)) throw new Error('DATABASE_URL debe ser de PostgreSQL.');
  return { port, apiPrefix, corsOrigin, databaseUrl };
}
