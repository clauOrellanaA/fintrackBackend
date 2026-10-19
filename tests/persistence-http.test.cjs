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
const { BalanceService } = require('../dist/modules/transactions/balance.service');
const { SavingsReservationReader } = require('../dist/modules/transactions/savings-reservation.reader');
const { MonthlySummaryService } = require('../dist/modules/transactions/monthly-summary.service');
const { resolvePeriod } = require('../dist/modules/dashboard/period');
const { ExpenseDistributionService } = require('../dist/modules/transactions/expense-distribution.service');
const { decimalToMinorUnits } = require('../dist/shared/money');
const { percentageOf } = require('../dist/shared/percentage');

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

test('authenticated dashboard validates query and serves balance, summary and expense distribution', async () => {
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
    assert.equal(body.sections.balance.status, 'ready');
    assert.equal(body.sections.balance.data.amount, email === SEED_EMAILS[0] ? '2500.05' : '859.50');
    assert.equal(body.sections.balance.data.cutoff, body.asOf);
    assert.deepEqual(body.sections.monthlySummary, { status: 'ready', data: { income: '0.00', expense: email === SEED_EMAILS[0] ? '500.05' : '40.50' } });
    const distribution = body.sections.expenseDistribution;
    assert.equal(distribution.status, 'ready');
    assert.equal(distribution.data.length, 1);
    assert.equal(distribution.data[0].amount, body.sections.monthlySummary.data.expense);
    assert.equal(distribution.data[0].percentage, '100.00');
    assert.equal(distribution.data[0].categoryName, email === SEED_EMAILS[0] ? 'Alimentacion' : 'Transporte');
    assert.ok(Object.entries(body.sections).filter(([name]) => !['balance', 'monthlySummary', 'expenseDistribution'].includes(name)).every(([, section]) => section.status === 'notAvailable' && !('data' in section)));
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

async function balanceFixture(opening, movements = [], openingAt = '2000-01-01T00:00:00Z') {
  const userId = randomUUID();
  const email = `${userId}@fintrack.test`;
  const [{ password_hash }] = await source.query('SELECT password_hash FROM users WHERE id=$1', [users[0].id]);
  await source.getRepository(User).insert({ id: userId, email, passwordHash: password_hash, openingBalance: opening, openingAt: new Date(openingAt), currency: 'BOB' });
  for (const item of movements) {
    await source.query('INSERT INTO transactions(id,user_id,type,status,amount,currency,occurred_at) VALUES($1,$2,$3,$4,$5,\'BOB\',$6)',
      [randomUUID(), userId, item.type ?? 'income', item.status ?? 'posted', item.amount, item.at ?? '2026-09-01T12:00:00Z']);
  }
  return { userId, email };
}

test('balance accumulates opening and previous months, filters void/future, includes cutoff and isolates owners', async () => {
  const asOf = new Date('2026-10-19T12:00:00Z');
  const fixture = await balanceFixture('1000.00', [
    { amount: '2000.10' }, { type: 'expense', amount: '500.05', at: '2026-10-05T12:00:00Z' },
    { amount: '0.03', at: asOf.toISOString() }, { amount: '999.00', status: 'void' },
    { type: 'expense', amount: '999.00', at: '2026-10-19T12:00:00.001Z' },
    { amount: '12345.00', at: '2100-01-01T00:00:00Z' },
  ]);
  const service = app.get(BalanceService);
  const result = await service.getForUser(fixture.userId, asOf);
  assert.deepEqual(result, { amount: '2500.08', currency: 'BOB', cutoff: asOf.toISOString() });
  await balanceFixture('999999999999.99', [{ amount: '888888888888.88' }]);
  assert.deepEqual(await service.getForUser(fixture.userId, asOf), result);
  // HTTP current cutoff differs intentionally from deterministic service cutoff.
  const token = await accessToken(fixture.email);
  const results = [];
  for (const month of ['2000-01', '2026-10']) {
    const response = await fetch(`${base}/dashboard?month=${month}`, { headers: auth(token) });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sections.balance.data.cutoff, body.asOf);
    results.push(body.sections.balance.data.amount);
  }
  assert.equal(results[0], results[1]);
});

test('balance preserves explicit openings, negative/fractional and maximum precision, rejects missing/future opening and overflow', async () => {
  const asOf = new Date('2026-10-19T12:00:00Z');
  const service = app.get(BalanceService);
  for (const [opening, movements, expected] of [
    ['42.5', [], '42.50'], ['0.00', [], '0.00'], ['-0.10', [{ type: 'expense', amount: '0.20' }], '-0.30'],
    ['999999999999.98', [{ amount: '0.01' }], '999999999999.99'],
    ['-999999999999.98', [{ type: 'expense', amount: '0.01' }], '-999999999999.99'],
  ]) {
    const fixture = await balanceFixture(opening, movements);
    assert.equal((await service.getForUser(fixture.userId, asOf)).amount, expected);
  }
  await assert.rejects(service.getForUser(randomUUID(), asOf), error => error.getStatus() === 401);
  const futureOpening = await balanceFixture('0.00', [], '2100-01-01T00:00:00Z');
  await assert.rejects(service.getForUser(futureOpening.userId, asOf), error => error.getResponse().error.code === 'DATA_INTEGRITY_ERROR');
  const overflow = await balanceFixture('999999999999.99', [{ amount: '0.01' }]);
  const response = await fetch(`${base}/dashboard`, { headers: auth(await accessToken(overflow.email)) });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.error.code, 'DATA_OUT_OF_RANGE');
  assert.ok(!('sections' in body));
});

test('reservation extension subtracts once in the same snapshot and propagates failures without zeros', async () => {
  const fixture = await balanceFixture('100.00');
  const reader = app.get(SavingsReservationReader);
  const original = reader.reservedMinorUnits;
  const asOf = new Date('2026-10-19T12:00:00Z');
  try {
    reader.reservedMinorUnits = async (userId, cutoff, manager) => {
      assert.equal(userId, fixture.userId);
      assert.equal(cutoff, asOf);
      assert.equal(manager.queryRunner.isTransactionActive, true);
      assert.equal((await manager.query('SHOW transaction_isolation'))[0].transaction_isolation, 'repeatable read');
      return 8000n;
    };
    assert.equal((await app.get(BalanceService).getForUser(fixture.userId, asOf)).amount, '20.00');
    reader.reservedMinorUnits = async () => { throw Object.assign(new Error('adapter failure: private details'), { code: 'ECONNRESET' }); };
    const response = await fetch(`${base}/dashboard`, { headers: auth(await accessToken(fixture.email)) });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error.code, 'DATA_UNAVAILABLE');
    assert.ok(!JSON.stringify(body).includes('private details'));
    assert.ok(!('sections' in body));
  } finally { reader.reservedMinorUnits = original; }
});

test('monthly summary uses half-open IANA month boundaries through year, leap and historical offsets', async () => {
  const service = app.get(MonthlySummaryService);
  for (const month of ['2026-12', '2024-02', '1900-01']) {
    const period = resolvePeriod({ month }, new Date());
    const start = new Date(period.start).getTime();
    const end = new Date(period.endExclusive).getTime();
    const fixture = await balanceFixture('0.00', [
      { amount: '900.00', at: new Date(start - 1).toISOString() },
      { amount: '0.10', at: period.start },
      { type: 'expense', amount: '0.20', at: new Date(end - 1).toISOString() },
      { amount: '800.00', at: period.endExclusive },
      { amount: '700.00', status: 'void', at: period.start },
    ], '1800-01-01T00:00:00Z');
    assert.deepEqual(await service.getForUser(fixture.userId, period), { income: '0.10', expense: '0.20' });
  }
});

test('monthly HTTP isolates users, returns successful empty zeros and includes future posted within selected period independently of balance', async () => {
  const fixture = await balanceFixture('25.00', [
    { amount: '20.10', at: '2100-03-15T12:00:00Z' },
    { type: 'expense', amount: '30.20', at: '2100-03-16T12:00:00Z' },
    { amount: '999.00', status: 'void', at: '2100-03-17T12:00:00Z' },
  ]);
  await balanceFixture('0.00', [{ amount: '999.99', at: '2100-03-15T12:00:00Z' }]);
  const token = await accessToken(fixture.email);
  for (const [month, expected] of [['2100-03', { income: '20.10', expense: '30.20' }], ['2100-04', { income: '0.00', expense: '0.00' }]]) {
    const response = await fetch(`${base}/dashboard?month=${month}`, { headers: auth(token) });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.sections.monthlySummary, { status: 'ready', data: expected });
    assert.equal(body.sections.balance.data.amount, '25.00');
    assert.equal(body.sections.balance.data.cutoff, body.asOf);
  }
});

test('monthly summary preserves gross refunds, exact maxima and rejects overflowing totals even when balance nets to zero', async () => {
  const fixture = await balanceFixture('0.00');
  const expenseId = randomUUID();
  await source.query('INSERT INTO transactions(id,user_id,type,status,amount,currency,occurred_at) VALUES($1,$2,\'expense\',\'posted\',\'10.25\',\'BOB\',\'2026-10-01T12:00:00Z\')', [expenseId, fixture.userId]);
  await source.query('INSERT INTO transactions(id,user_id,type,status,amount,currency,occurred_at,refund_of_id) VALUES($1,$2,\'income\',\'posted\',\'2.05\',\'BOB\',\'2026-10-02T12:00:00Z\',$3)', [randomUUID(), fixture.userId, expenseId]);
  const service = app.get(MonthlySummaryService);
  const period = resolvePeriod({ month: '2026-10' }, new Date());
  assert.deepEqual(await service.getForUser(fixture.userId, period), { income: '2.05', expense: '10.25' });
  const large = await balanceFixture('0.00', [{ amount: '999999999999.99', at: '2026-10-01T12:00:00Z' }, { type: 'expense', amount: '999999999999.99', at: '2026-10-01T12:00:00Z' }]);
  assert.deepEqual(await service.getForUser(large.userId, period), { income: '999999999999.99', expense: '999999999999.99' });
  await source.query('INSERT INTO transactions(id,user_id,type,status,amount,currency,occurred_at) VALUES($1,$2,\'income\',\'posted\',\'0.01\',\'BOB\',\'2026-10-01T12:00:00Z\'),($3,$2,\'expense\',\'posted\',\'0.01\',\'BOB\',\'2026-10-01T12:00:00Z\')', [randomUUID(), large.userId, randomUUID()]);
  const response = await fetch(`${base}/dashboard?month=2026-10`, { headers: auth(await accessToken(large.email)) });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'DATA_OUT_OF_RANGE');
});

test('dashboard shares one snapshot despite concurrent writes and aborts summary failures without partial balance or synthetic zeros', async () => {
  const fixture = await balanceFixture('0.00', [{ amount: '10.00', at: '2026-10-01T12:00:00Z' }]);
  const reader = app.get(SavingsReservationReader);
  const summaries = app.get(MonthlySummaryService);
  const originalReader = reader.reservedMinorUnits;
  const originalSummary = summaries.getForUser;
  let reservationManager;
  try {
    reader.reservedMinorUnits = async (_userId, _asOf, manager) => {
      reservationManager = manager;
      await source.query('INSERT INTO transactions(id,user_id,type,status,amount,currency,occurred_at) VALUES($1,$2,\'expense\',\'posted\',\'2.00\',\'BOB\',\'2026-10-02T12:00:00Z\')', [randomUUID(), fixture.userId]);
      return 0n;
    };
    summaries.getForUser = async function(userId, period, manager) {
      assert.equal(manager, reservationManager);
      assert.equal(manager.queryRunner.transactionDepth, 1);
      return originalSummary.call(this, userId, period, manager);
    };
    const token = await accessToken(fixture.email);
    const response = await fetch(`${base}/dashboard?month=2026-10`, { headers: auth(token) });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sections.balance.data.amount, '10.00');
    assert.deepEqual(body.sections.monthlySummary.data, { income: '10.00', expense: '0.00' });
    reader.reservedMinorUnits = originalReader;
    summaries.getForUser = originalSummary;
    const next = await (await fetch(`${base}/dashboard?month=2026-10`, { headers: auth(token) })).json();
    assert.equal(next.sections.balance.data.amount, '8.00');
    assert.equal(next.sections.monthlySummary.data.expense, '2.00');
    summaries.getForUser = async () => { throw Object.assign(new Error('private SQL details'), { code: 'ECONNRESET' }); };
    const failed = await fetch(`${base}/dashboard?month=2026-10`, { headers: auth(token) });
    assert.equal(failed.status, 503);
    const error = await failed.json();
    assert.equal(error.error.code, 'DATA_UNAVAILABLE');
    assert.ok(!('sections' in error));
    assert.ok(!JSON.stringify(error).includes('private SQL details'));
  } finally { reader.reservedMinorUnits = originalReader; summaries.getForUser = originalSummary; }
});

async function distributionFixture(groups) {
  const fixture = await balanceFixture('0.00');
  for (const group of groups) {
    const categoryId = group.id === null ? null : (group.id ?? randomUUID());
    if (categoryId) await source.query('INSERT INTO categories(id,user_id,name) VALUES($1,$2,$3)', [categoryId, fixture.userId, group.name ?? categoryId]);
    for (const amount of group.amounts ?? [group.amount]) {
      await source.query('INSERT INTO transactions(id,user_id,category_id,type,status,amount,currency,occurred_at) VALUES($1,$2,$3,\'expense\',\'posted\',$4,\'BOB\',\'2026-10-05T12:00:00Z\')', [randomUUID(), fixture.userId, categoryId, amount]);
    }
  }
  return fixture;
}

test('expense distribution handles empty, income-only, single and equal categories including null and long names in stable order', async () => {
  const service = app.get(ExpenseDistributionService);
  const period = resolvePeriod({ month: '2026-10' }, new Date());
  const empty = await balanceFixture('0.00', [{ amount: '5.00', at: '2026-10-01T12:00:00Z' }]);
  assert.deepEqual(await service.getForUser(empty.userId, period), []);
  await assert.rejects(service.getForUser(randomUUID(), period), error => error.getStatus() === 401);
  const single = await distributionFixture([{ id: null, amount: '20.10' }]);
  assert.deepEqual(await service.getForUser(single.userId, period), [{ categoryId: null, categoryName: 'Sin categoria', amount: '20.10', percentage: '100.00' }]);
  const first = '00000000-0000-4000-8000-000000000001';
  const second = '00000000-0000-4000-8000-000000000002';
  const fixture = await distributionFixture([{ id: second, name: 'Z'.repeat(100), amount: '1.00' }, { id: null, amount: '1.00' }, { id: first, name: 'A', amounts: ['0.40', '0.60'] }]);
  const response = await fetch(`${base}/dashboard?month=2026-10`, { headers: auth(await accessToken(fixture.email)) });
  assert.equal(response.status, 200);
  const body = await response.json();
  const distribution = body.sections.expenseDistribution.data;
  assert.deepEqual(distribution.map(row => row.categoryId), [first, second, null]);
  assert.equal(distribution[1].categoryName.length, 100);
  assert.deepEqual(distribution.map(row => row.percentage), ['33.33', '33.33', '33.33']);
  const sum = distribution.reduce((total, row) => total + decimalToMinorUnits(row.amount), 0n);
  assert.equal(sum, decimalToMinorUnits(body.sections.monthlySummary.data.expense));
  const roundedSum = distribution.reduce((total, row) => total + decimalToMinorUnits(row.percentage), 0n);
  assert.equal(roundedSum, 9999n); // No artificial adjustment to force 100%.
  assert.ok((10000n - roundedSum) * 2n <= BigInt(distribution.length));
});

test('distribution percentages use exact HALF_UP independently, preserve amount order, extremes and aggregate overflow', async () => {
  const service = app.get(ExpenseDistributionService);
  const period = resolvePeriod({ month: '2026-10' }, new Date());
  const half = await distributionFixture([{ name: 'small', amount: '1.00' }, { name: 'large', amount: '31.00' }]);
  const rounded = await service.getForUser(half.userId, period);
  assert.deepEqual(rounded.map(row => row.amount), ['31.00', '1.00']);
  assert.deepEqual(rounded.map(row => row.percentage), ['96.88', '3.13']);
  assert.equal(percentageOf(1n, 3n), '33.33'); // Odd denominator.
  assert.equal(percentageOf(1n, 32n), '3.13'); // Exact half.
  assert.equal(percentageOf(0n, 1n), '0.00');
  assert.throws(() => percentageOf(0n, 0n));
  const maximum = await distributionFixture([{ name: 'large', amount: '999999999999.98' }, { name: 'small', amount: '0.01' }]);
  const extremes = await service.getForUser(maximum.userId, period);
  assert.deepEqual(extremes.map(row => row.amount), ['999999999999.98', '0.01']);
  assert.deepEqual(extremes.map(row => row.percentage), ['100.00', '0.00']);
  const overflow = await distributionFixture([{ amount: '999999999999.99' }, { amount: '0.01' }]);
  await assert.rejects(service.getForUser(overflow.userId, period), error => error.getStatus() === 422 && error.getResponse().error.code === 'DATA_OUT_OF_RANGE');
});

test('distribution shares monthly filters including IANA boundaries, future posted, void exclusion and ownership', async () => {
  const fixture = await balanceFixture('0.00', [
    { type: 'expense', amount: '1.10', at: '2100-03-01T04:00:00Z' },
    { type: 'expense', amount: '2.20', at: '2100-04-01T03:59:59.999Z' },
    { type: 'expense', amount: '999.00', at: '2100-03-01T03:59:59.999Z' },
    { type: 'expense', amount: '888.00', at: '2100-04-01T04:00:00Z' },
    { type: 'expense', amount: '777.00', status: 'void', at: '2100-03-10T12:00:00Z' },
    { amount: '666.00', at: '2100-03-10T12:00:00Z' },
  ]);
  await balanceFixture('0.00', [{ type: 'expense', amount: '555.00', at: '2100-03-10T12:00:00Z' }]);
  const token = await accessToken(fixture.email);
  const response = await fetch(`${base}/dashboard?month=2100-03`, { headers: auth(token) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.sections.balance.data.amount, '0.00');
  assert.equal(body.sections.monthlySummary.data.expense, '3.30');
  assert.deepEqual(body.sections.expenseDistribution.data, [{ categoryId: null, categoryName: 'Sin categoria', amount: '3.30', percentage: '100.00' }]);
  const empty = await (await fetch(`${base}/dashboard?month=2100-05`, { headers: auth(token) })).json();
  assert.deepEqual(empty.sections.expenseDistribution.data, []);
});

test('distribution and summary retain same snapshot across concurrent commit, and distribution failure aborts all sections', async () => {
  const fixture = await distributionFixture([{ id: null, amount: '10.00' }]);
  const summaries = app.get(MonthlySummaryService);
  const distributions = app.get(ExpenseDistributionService);
  const originalSummary = summaries.getForUser;
  const originalDistribution = distributions.getForUser;
  let summaryManager;
  try {
    summaries.getForUser = async function(userId, period, manager) {
      summaryManager = manager;
      const result = await originalSummary.call(this, userId, period, manager);
      await source.query('INSERT INTO transactions(id,user_id,type,status,amount,currency,occurred_at) VALUES($1,$2,\'expense\',\'posted\',\'2.00\',\'BOB\',\'2026-10-06T12:00:00Z\')', [randomUUID(), fixture.userId]);
      return result;
    };
    distributions.getForUser = async function(userId, period, manager) {
      assert.equal(manager, summaryManager);
      assert.equal(manager.queryRunner.transactionDepth, 1);
      return originalDistribution.call(this, userId, period, manager);
    };
    const token = await accessToken(fixture.email);
    const response = await fetch(`${base}/dashboard?month=2026-10`, { headers: auth(token) });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sections.monthlySummary.data.expense, '10.00');
    assert.equal(body.sections.expenseDistribution.data[0].amount, '10.00');
    summaries.getForUser = originalSummary;
    distributions.getForUser = originalDistribution;
    const next = await (await fetch(`${base}/dashboard?month=2026-10`, { headers: auth(token) })).json();
    assert.equal(next.sections.monthlySummary.data.expense, '12.00');
    assert.equal(next.sections.expenseDistribution.data[0].amount, '12.00');
    distributions.getForUser = async () => { throw Object.assign(new Error('private SQL details'), { code: 'ECONNRESET' }); };
    const failed = await fetch(`${base}/dashboard?month=2026-10`, { headers: auth(token) });
    assert.equal(failed.status, 503);
    const error = await failed.json();
    assert.equal(error.error.code, 'DATA_UNAVAILABLE');
    assert.ok(!('sections' in error));
    assert.ok(!JSON.stringify(error).includes('private SQL details'));
  } finally { summaries.getForUser = originalSummary; distributions.getForUser = originalDistribution; }
});

test('seed denies production and migration can roll back and reapply on its own empty database', async () => {
  await assert.rejects(seedDevelopment(source, password, 'production'));
  assert.ok(await source.getRepository(User).count() >= 2);
  await app.close(); app = undefined;
  await source.undoLastMigration();
  assert.equal((await source.query("SELECT to_regclass('public.users') AS name"))[0].name, null);
  assert.equal((await source.runMigrations()).length, 1);
  await seedDevelopment(source, password, 'test');
  assert.equal(await source.getRepository(User).count(), 2);
});
