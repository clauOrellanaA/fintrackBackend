import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const password = randomBytes(24).toString('hex');
const content = readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
  .replaceAll('replace-with-local-password', password)
  .replaceAll('replace-with-a-long-random-secret', randomBytes(48).toString('hex'));
try {
  writeFileSync(new URL('../.env', import.meta.url), content, { flag: 'wx', mode: 0o600 });
  console.log('.env creado con credenciales locales aleatorias. Ejecuta npm run db:up.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('.env ya existe; se conserva sin cambios.');
}
