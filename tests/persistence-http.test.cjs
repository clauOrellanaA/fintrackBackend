const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { createDataSource } = require('../dist/database/data-source');
const { seedDevelopment, SEED_EMAILS } = require('../dist/database/seeds/development');
const { User } = require('../dist/modules/users/entities/user.entity');
const { Session } = require('../dist/modules/auth/entities/session.entity');
const { TransactionsService } = require('../dist/modules/transactions/transactions.service');
const { tokenHash, AuthService } = require('../dist/modules/auth/auth.service');

// This is an explicit integration suite: missing dedicated DB configuration fails, never skips.
const password = 'local-test-password-only';
let admin, source, app, base, users;
const database = `fintrack_be01_test_${process.pid}_${Date.now()}`;

before(async () => {
  if (!process.env.TEST_DATABASE_URL) throw Error('Configure TEST_DATABASE_URL for isolated PostgreSQL integration tests.');
  const adminUrl = new URL(process.env.TEST_DATABASE_URL);
  if (adminUrl.pathname !== '/fintrack_be01_test') throw Error('TEST_DATABASE_URL must target dedicated fintrack_be01_test database.');
  admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  adminUrl.pathname = `/${database}`;
  process.env.DATABASE_URL = adminUrl.toString();
  process.env.NODE_ENV = 'test';
  source = createDataSource(process.env.DATABASE_URL);
  await source.initialize();
  assert.equal((await source.runMigrations()).length, 1);
  assert.equal((await source.runMigrations()).length, 0);
  await seedDevelopment(source, password, 'test');
  await seedDevelopment(source, password, 'test');
  users = await source.getRepository(User).find({ order: { email: 'ASC' } });
  assert.equal(users.length, 2);
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api/v1`;
});

after(async () => {
  if (app) await app.close();
  if (source?.isInitialized) await source.destroy();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
});

async function login(email = SEED_EMAILS[0], override = {}) {
  return fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, ...override }) });
}
async function accessToken(email) { const response = await login(email); assert.equal(response.status, 200); return (await response.json()).accessToken; }
function auth(token) { return { Authorization: `Bearer ${token}` }; }

test('credentials, strict login body, no-store and hashed session persistence', async () => {
  for (const body of [{ password: 'incorrect' }, { email: 'missing@fintrack.test' }]) {
    const response = await login(SEED_EMAILS[0], body);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal((await response.json()).error.code, 'INVALID_CREDENTIALS');
  }
  assert.equal((await login(SEED_EMAILS[0], { userId: users[1].id })).status, 400);
  const response = await login();
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const session = await response.json();
  assert.match(session.accessToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(session.tokenType, 'Bearer');
  const stored = await source.getRepository(Session).findOneByOrFail({ tokenHash: tokenHash(session.accessToken) });
  assert.notEqual(stored.tokenHash, session.accessToken);
  assert.equal(stored.userId, users[0].id);
  assert.ok(Math.abs(new Date(session.expiresAt).getTime() - Date.now() - 8*3600000) < 5000);
  const hashes = await source.query('SELECT password_hash FROM users');
  assert.notEqual(hashes[0].password_hash, hashes[1].password_hash);
  assert.ok(hashes.every(row => !row.password_hash.includes(password)));
});

test('HTTP guard rejects missing/malformed/expired/revoked session before validating period', async () => {
  for (const token of [undefined, 'invalid']) {
    const response = await fetch(`${base}/dashboard?month=bad`, { headers: token ? auth(token) : {} });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  const expired = await accessToken();
  await source.getRepository(Session).update({ tokenHash: tokenHash(expired) }, { expiresAt: new Date(Date.now()-1000) });
  assert.equal((await fetch(`${base}/dashboard`, { headers: auth(expired) })).status, 401);
  const revoked = await accessToken();
  assert.equal((await fetch(`${base}/auth/session`, { method: 'DELETE', headers: auth(revoked) })).status, 204);
  assert.equal((await fetch(`${base}/dashboard`, { headers: auth(revoked) })).status, 401);
});

test('authenticated dashboard validates query and advertises unavailable sections without fake finances', async () => {
  const token = await accessToken();
  for (const query of ['month=2026-13', 'month=2026-01&month=2026-02', `userId=${users[1].id}`, 'month=9999-01']) {
    const response = await fetch(`${base}/dashboard?${query}`, { headers: auth(token) });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_PERIOD');
  }
  for (const email of SEED_EMAILS) {
    const response = await fetch(`${base}/dashboard?month=2026-10`, { headers: auth(await accessToken(email)) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const body = await response.json();
    assert.equal(body.period.start, '2026-10-01T04:00:00.000Z');
    assert.equal(body.currency, 'BOB');
    assert.ok(Object.values(body.sections).every(section => section.status === 'notAvailable' && !('data' in section)));
    assert.ok(!JSON.stringify(body).includes(users[0].id));
  }
});

test('domain query isolates persisted movements by authenticated session identity', async () => {
  const service = app.get(TransactionsService);
  for (let i=0; i<users.length; i++) {
    const identity = await app.get(AuthService).authenticate(`Bearer ${await accessToken(users[i].email)}`);
    const transactions = await service.listForUser(identity.userId);
    assert.equal(transactions.length, 2);
    assert.ok(transactions.every(item => item.userId === users[i].id));
    assert.deepEqual(transactions.map(item => item.amount), i === 0 ? ['2000.10','500.05'] : ['700.00','40.50']);
  }
  await assert.rejects(service.listForUser(undefined));
});

test('schema rejects cross-user categories/refunds, bad decimals, invalid opening and inconsistent updates', async () => {
  const movements = await source.query('SELECT * FROM transactions ORDER BY amount');
  const ownExpense = movements.find(row => row.user_id === users[0].id && row.type === 'expense');
  const otherExpense = movements.find(row => row.user_id === users[1].id && row.type === 'expense');
  const insert = async (overrides = {}) => {
    const row = { id: randomUUID(), user: users[0].id, category: null, type: 'expense', status: 'posted', amount: '1.00', date: '2026-10-10T12:00:00Z', refund: null, ...overrides };
    return source.query('INSERT INTO transactions(id,user_id,category_id,type,status,amount,currency,occurred_at,refund_of_id) VALUES($1,$2,$3,$4,$5,$6,\'BOB\',$7,$8)', [row.id,row.user,row.category,row.type,row.status,row.amount,row.date,row.refund]);
  };
  for (const overrides of [{ category: otherExpense.category_id }, { type: 'income', refund: otherExpense.id }, { amount: '1.001' }, { amount: '0.00' }, { amount: '-1.00' }, { amount: '1000000000000.00' }, { date: '2025-01-01T00:00:00Z' }]) await assert.rejects(insert(overrides));
  await assert.rejects(source.query('INSERT INTO users(id,email,password_hash,currency) VALUES($1,$2,$3,\'BOB\')', [randomUUID(),'no-opening@fintrack.test','not-a-password']));
  const refundId = randomUUID();
  await insert({ id: refundId, type: 'income', refund: ownExpense.id });
  await assert.rejects(source.query('UPDATE transactions SET type=\'income\' WHERE id=$1', [ownExpense.id]));
  await assert.rejects(source.query('UPDATE transactions SET occurred_at=\'2026-12-01T00:00:00Z\' WHERE id=$1', [ownExpense.id]));
  await assert.rejects(source.query('UPDATE users SET opening_at=\'2026-11-01T00:00:00Z\' WHERE id=$1', [users[0].id]));
  await source.query('DELETE FROM transactions WHERE id=$1', [refundId]);
});

test('seed denies production and migration can roll back and reapply on its own empty database', async () => {
  await assert.rejects(seedDevelopment(source, password, 'production'));
  assert.equal(await source.getRepository(User).count(), 2);
  await app.close(); app = undefined;
  await source.undoLastMigration();
  assert.equal((await source.query("SELECT to_regclass('public.users') AS name"))[0].name, null);
  assert.equal((await source.runMigrations()).length, 1);
  await seedDevelopment(source, password, 'test');
  assert.equal(await source.getRepository(User).count(), 2);
});
