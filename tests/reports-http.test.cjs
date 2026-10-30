const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { createDataSource } = require('../dist/database/data-source');
const { hashPassword } = require('../dist/modules/auth/password');
const { tokenHash } = require('../dist/modules/auth/auth.service');
const { assertContract } = require('./contract.cjs');

// This suite always creates and drops its own database.  It must never use the
// developer database configured in .env.
const password = 'reports-test-password-only';
const database = `fintrack_be08_reports_${process.pid}_${Date.now()}`;
let admin, source, app, base, owner, other;

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
  await source.runMigrations();

  const passwordHash = await hashPassword(password);
  owner = await createReportFixture('owner', passwordHash);
  other = await createEmptyFixture('other', passwordHash);

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

async function createUser(label, passwordHash, openingBalance) {
  const id = randomUUID();
  const email = `${label}-${id}@fintrack.test`;
  await source.query(
    'INSERT INTO users(id,email,password_hash,opening_balance,opening_at,currency) VALUES($1,$2,$3,$4,$5,\'BOB\')',
    [id, email, passwordHash, openingBalance, '2025-12-01T04:00:00.000Z'],
  );
  return { id, email };
}

async function createReportFixture(label, passwordHash) {
  const user = await createUser(label, passwordHash, '1000.00');
  const food = randomUUID();
  const home = randomUUID();
  await source.query('INSERT INTO categories(id,user_id,name) VALUES($1,$2,$3),($4,$2,$5)', [food, user.id, 'Comida', home, 'Hogar']);
  const expenseForRefund = randomUUID();
  const movements = [
    [randomUUID(), null, 'income', 'posted', '100.00', '2025-12-15T12:00:00.000Z', null],
    [randomUUID(), null, 'income', 'posted', '10.01', '2026-01-10T12:00:00.000Z', null],
    [expenseForRefund, food, 'expense', 'posted', '3.33', '2026-01-10T12:01:00.000Z', null],
    [randomUUID(), null, 'expense', 'posted', '6.67', '2026-01-11T12:00:00.000Z', null],
    // 03:59:59.999Z is still January 31 in America/La_Paz.
    [randomUUID(), food, 'expense', 'posted', '1.00', '2026-02-01T03:59:59.999Z', null],
    [randomUUID(), home, 'expense', 'posted', '5.00', '2026-02-12T12:00:00.000Z', null],
    [randomUUID(), null, 'income', 'posted', '20.00', '2026-02-15T12:00:00.000Z', null],
    [randomUUID(), food, 'expense', 'void', '99.00', '2026-02-16T12:00:00.000Z', null],
  ];
  for (const [id, categoryId, type, status, amount, occurredAt, refundOfId] of movements) {
    await source.query('INSERT INTO transactions(id,user_id,category_id,type,status,amount,currency,occurred_at,refund_of_id) VALUES($1,$2,$3,$4,$5,$6,\'BOB\',$7,$8)', [id, user.id, categoryId, type, status, amount, occurredAt, refundOfId]);
  }
  await source.query('INSERT INTO transactions(id,user_id,type,status,amount,currency,occurred_at,refund_of_id) VALUES($1,$2,\'income\',\'posted\',$3,\'BOB\',$4,$5)', [randomUUID(), user.id, '1.20', '2026-01-12T12:00:00.000Z', expenseForRefund]);

  const goal = randomUUID();
  await source.query('INSERT INTO savings_goals(id,user_id,name,target_amount,currency,created_at) VALUES($1,$2,\'Reserva informe\',\'50.00\',\'BOB\',$3)', [goal, user.id, '2026-01-05T12:00:00.000Z']);
  await source.query('INSERT INTO savings_entries(id,user_id,goal_id,type,amount,currency,occurred_at) VALUES($1,$2,$3,\'contribution\',\'5.00\',\'BOB\',$4),($5,$2,$3,\'contribution\',\'2.00\',\'BOB\',$6)', [randomUUID(), user.id, goal, '2026-01-06T12:00:00.000Z', randomUUID(), '2026-02-06T12:00:00.000Z']);
  return user;
}

async function createEmptyFixture(label, passwordHash) { return createUser(label, passwordHash, '50.00'); }

async function token(email) {
  const response = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal(response.status, 200);
  return (await response.json()).accessToken;
}
function auth(accessToken) { return { Authorization: `Bearer ${accessToken}` }; }
async function reports(query, accessToken) { return fetch(`${base}/reports?${query}`, { headers: auth(accessToken) }); }

test('reports requires a valid bearer session before inspecting the period and is private', async () => {
  const accessToken = await token(owner.email);
  for (const value of [undefined, 'malformed']) {
    const response = await fetch(`${base}/reports?from=invalid`, { headers: value ? auth(value) : {} });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  const expired = await token(owner.email);
  await source.query('UPDATE sessions SET expires_at=$1 WHERE token_hash=$2', [new Date(Date.now() - 1_000), tokenHash(expired)]);
  assert.equal((await reports('from=2026-01-01&to=2026-03-31', expired)).status, 401);
  const revoked = await token(owner.email);
  await source.query('UPDATE sessions SET revoked_at=NOW() WHERE token_hash=$1', [tokenHash(revoked)]);
  assert.equal((await reports('from=2026-01-01&to=2026-03-31', revoked)).status, 401);
  assert.equal((await reports('from=2026-01-01&to=2026-03-31', accessToken)).headers.get('Cache-Control'), 'no-store');
});

test('reports rejects invalid, ambiguous and unauthorized report periods', async () => {
  const accessToken = await token(owner.email);
  const invalid = [
    '', 'from=2026-01-01', 'to=2026-03-31',
    'from=2026-1-01&to=2026-03-31', 'from=2026-02-30&to=2026-03-31',
    'from=1899-12-31&to=2026-03-31', 'from=2026-01-01&to=9999-01-01',
    'from=2026-03-31&to=2026-01-01',
    'from=2026-01-01&to=2028-01-01',
    'from=2026-01-31&to=2028-01-30',
    'from=2026-01-01&from=2026-01-02&to=2026-03-31',
    `from=2026-01-01&to=2026-03-31&userId=${other.id}`,
    'from=2026-01-01&to=2026-03-31&unknown=value',
  ];
  for (const query of invalid) {
    const response = await reports(query, accessToken);
    assert.equal(response.status, 400, query);
    const body = await response.json();
    assertContract('Error', body);
    assert.equal(body.error.code, 'INVALID_REPORT_PERIOD', query);
  }
  assert.equal((await reports('from=2026-01-01&to=2027-12-31', accessToken)).status, 200);
});

test('reports aggregate exact owned posted BOB movements, category distribution, refund income and monthly historical balance', async () => {
  const response = await reports('from=2026-01-01&to=2026-03-31', await token(owner.email));
  assert.equal(response.status, 200);
  const body = await response.json();
  assertContract('Reports', body);
  assert.deepEqual(body.period, {
    from: '2026-01-01', to: '2026-03-31', timeZone: 'America/La_Paz',
    start: '2026-01-01T04:00:00.000Z', endExclusive: '2026-04-01T04:00:00.000Z',
  });
  assert.equal(body.currency, 'BOB');
  assert.match(body.asOf, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.deepEqual(body.comparison, { income: '31.21', expense: '16.00', net: '15.21' });
  assert.deepEqual(body.expenseDistribution.map(item => ({ categoryId: item.categoryId, categoryName: item.categoryName, amount: item.amount, percentage: item.percentage })), [
    { categoryId: null, categoryName: 'Sin categoria', amount: '6.67', percentage: '41.69' },
    { categoryId: body.expenseDistribution[1].categoryId, categoryName: 'Hogar', amount: '5.00', percentage: '31.25' },
    { categoryId: body.expenseDistribution[2].categoryId, categoryName: 'Comida', amount: '4.33', percentage: '27.06' },
  ]);
  assert.equal(body.balanceEvolution.length, 3);
  assert.deepEqual(body.balanceEvolution, [
    { month: '2026-01', amount: '1095.21', cutoff: '2026-02-01T04:00:00.000Z' },
    { month: '2026-02', amount: '1108.21', cutoff: '2026-03-01T04:00:00.000Z' },
    { month: '2026-03', amount: '1108.21', cutoff: '2026-04-01T04:00:00.000Z' },
  ]);
  assert.ok(!JSON.stringify(body).includes(other.id));
});

test('reports isolate another user and future months stop at asOf instead of projecting balances', async () => {
  const empty = await (await reports('from=2026-01-01&to=2026-03-31', await token(other.email))).json();
  assert.deepEqual(empty.comparison, { income: '0.00', expense: '0.00', net: '0.00' });
  assert.deepEqual(empty.expenseDistribution, []);
  assert.deepEqual(empty.balanceEvolution.map(item => item.amount), ['50.00', '50.00', '50.00']);

  const response = await reports('from=2030-01-01&to=2030-02-28', await token(owner.email));
  assert.equal(response.status, 200);
  const future = await response.json();
  assertContract('Reports', future);
  assert.deepEqual(future.comparison, { income: '0.00', expense: '0.00', net: '0.00' });
  assert.deepEqual(future.expenseDistribution, []);
  assert.deepEqual(future.balanceEvolution, [
    { month: '2030-01', amount: '1108.21', cutoff: future.asOf },
    { month: '2030-02', amount: '1108.21', cutoff: future.asOf },
  ]);
});

test('reports omit months before opening including equal month-end and retain empty months after opening', async () => {
  const user = await createUser('recent-opening', await hashPassword(password), '50.00');
  await source.query('UPDATE users SET opening_at=$1 WHERE id=$2', ['2026-02-01T04:00:00.000Z', user.id]);
  const accessToken = await token(user.email);
  const before = await (await reports('from=2025-12-01&to=2026-01-31', accessToken)).json();
  assertContract('Reports', before);
  assert.deepEqual(before.balanceEvolution, []);
  assert.deepEqual(before.comparison, { income: '0.00', expense: '0.00', net: '0.00' });
  assert.deepEqual(before.expenseDistribution, []);
  const crossing = await (await reports('from=2026-01-01&to=2026-03-31', accessToken)).json();
  assertContract('Reports', crossing);
  assert.deepEqual(crossing.balanceEvolution, [
    { month: '2026-02', amount: '50.00', cutoff: '2026-03-01T04:00:00.000Z' },
    { month: '2026-03', amount: '50.00', cutoff: '2026-04-01T04:00:00.000Z' },
  ]);
  await source.query("INSERT INTO transactions(id,user_id,type,status,amount,currency,occurred_at) VALUES($1,$2,'income','posted','7.00','BOB',$3)", [randomUUID(), user.id, '2026-03-01T04:00:00.000Z']);
  const boundary = await (await reports('from=2026-02-01&to=2026-02-28', accessToken)).json();
  // Activity is half-open, but historical balance explicitly includes its cutoff.
  assert.deepEqual(boundary.comparison, { income: '0.00', expense: '0.00', net: '0.00' });
  assert.deepEqual(boundary.balanceEvolution, [{ month: '2026-02', amount: '57.00', cutoff: '2026-03-01T04:00:00.000Z' }]);
});

test('reports retain one PostgreSQL snapshot while a concurrent movement commits between sources', async () => {
  const { MonthlySummaryService } = require('../dist/modules/transactions/monthly-summary.service');
  const user = await createUser('snapshot', await hashPassword(password), '50.00');
  await source.query("INSERT INTO transactions(id,user_id,type,status,amount,currency,occurred_at) VALUES($1,$2,'income','posted','10.00','BOB',$3)", [randomUUID(), user.id, '2026-01-10T12:00:00.000Z']);
  const accessToken = await token(user.email);
  const summaries = app.get(MonthlySummaryService);
  const original = summaries.getForUser;
  let writes = 0;
  summaries.getForUser = async function (...args) {
    const result = await original.apply(this, args);
    if (args[0] === user.id && writes++ === 0) {
      await source.query("INSERT INTO transactions(id,user_id,type,status,amount,currency,occurred_at) VALUES($1,$2,'expense','posted','5.00','BOB',$3)", [randomUUID(), user.id, '2026-01-11T12:00:00.000Z']);
    }
    return result;
  };
  try {
    const response = await reports('from=2026-01-01&to=2026-01-31', accessToken);
    assert.equal(response.status, 200);
    const body = await response.json();
    assertContract('Reports', body);
    assert.equal(writes, 1);
    assert.deepEqual(body.comparison, { income: '10.00', expense: '0.00', net: '10.00' });
    assert.deepEqual(body.expenseDistribution, []);
    assert.equal(body.balanceEvolution[0].amount, '60.00');
  } finally { summaries.getForUser = original; }
  const fresh = await (await reports('from=2026-01-01&to=2026-01-31', accessToken)).json();
  assert.deepEqual(fresh.comparison, { income: '10.00', expense: '5.00', net: '5.00' });
  assert.equal(fresh.expenseDistribution[0].amount, '5.00');
  assert.equal(fresh.balanceEvolution[0].amount, '55.00');
});

test('reports fail globally with the error envelope when any financial source fails', async () => {
  const constructors = [
    require('../dist/modules/transactions/monthly-summary.service').MonthlySummaryService,
    require('../dist/modules/transactions/expense-distribution.service').ExpenseDistributionService,
    require('../dist/modules/transactions/balance.service').BalanceService,
  ];
  const accessToken = await token(owner.email);
  for (const Constructor of constructors) {
    const service = app.get(Constructor), original = service.getForUser;
    service.getForUser = async () => { throw Object.assign(new Error('private source diagnostic'), { code: 'ECONNRESET' }); };
    try {
      const response = await reports('from=2026-01-01&to=2026-03-31', accessToken);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      const body = await response.json();
      assertContract('Error', body);
      assert.deepEqual(Object.keys(body), ['error']);
      assert.equal(body.error.code, 'DATA_UNAVAILABLE');
      assert.ok(!JSON.stringify(body).includes('private source diagnostic'));
    } finally { service.getForUser = original; }
  }
});
