import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { createDataSource } from './data-source';
import { User } from '../modules/users/entities/user.entity';
import { hashPassword } from '../modules/auth/password';

export function readNewUser(env: NodeJS.ProcessEnv) {
  const email = (env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = env.ADMIN_PASSWORD ?? '';
  const openingBalance = env.ADMIN_OPENING_BALANCE ?? '0.00';
  const openingAt = env.ADMIN_OPENING_AT ?? new Date().toISOString();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAIL invalido.');
  if (password.length < 12 || password.length > 1024) throw new Error('ADMIN_PASSWORD debe tener entre 12 y 1024 caracteres.');
  if (!/^-?(?:0|[1-9]\d{0,11})\.\d{2}$/.test(openingBalance)) throw new Error('ADMIN_OPENING_BALANCE debe tener dos decimales y hasta doce enteros.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(openingAt)
    || !Number.isFinite(Date.parse(openingAt)) || new Date(openingAt).toISOString() !== openingAt
    || Date.parse(openingAt) > Date.now()) throw new Error('ADMIN_OPENING_AT debe ser una fecha UTC ISO valida, no futura.');
  return { email, password, openingBalance, openingAt: new Date(openingAt) };
}

export async function createUser(source: DataSource, env: NodeJS.ProcessEnv) {
  const input = readNewUser(env);
  const id = randomUUID();
  // INSERT preserves existing credentials and balances, including concurrent attempts.
  await source.getRepository(User).insert({
    id, email: input.email, passwordHash: await hashPassword(input.password),
    openingBalance: input.openingBalance, openingAt: input.openingAt, currency: 'BOB',
  });
  return id;
}

async function main() {
  readNewUser(process.env);
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');
  const source = createDataSource(process.env.DATABASE_URL);
  try {
    await source.initialize();
    await createUser(source, process.env);
    console.log('Usuario creado sin datos demo.');
  } finally {
    if (source.isInitialized) await source.destroy();
    delete process.env.ADMIN_PASSWORD;
  }
}

if (require.main === module) main().catch(() => {
  console.error('No se pudo crear el usuario. Revisa variables, migraciones y que el correo no exista.');
  process.exitCode = 1;
});
