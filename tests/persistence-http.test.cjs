const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { createDataSource } = require('../dist/database/data-source');
const { seedDevelopment, SEED_EMAILS } = require('../dist/database/seeds/development');
const { User } = require('../dist/modules/users/entities/user.entity');
const { Session } = require('../dist/modules/auth/entities/session.entity');
const { TransactionsService } = require('../dist/modules/transactions/transactions.service');
const { Category } = require('../dist/modules/transactions/entities/category.entity');
const { tokenHash, AuthService } = require('../dist/modules/auth/auth.service');
const { BalanceService } = require('../dist/modules/transactions/balance.service');
const { SavingsReservationReader } = require('../dist/modules/transactions/savings-reservation.reader');
const { MonthlySummaryService } = require('../dist/modules/transactions/monthly-summary.service');
const { resolvePeriod } = require('../dist/modules/dashboard/period');
const { ExpenseDistributionService } = require('../dist/modules/transactions/expense-distribution.service');
const { decimalToMinorUnits } = require('../dist/shared/money');
const { percentageOf } = require('../dist/shared/percentage');
const { progressPercentage } = require('../dist/shared/percentage');
const { Budget } = require('../dist/modules/budgets/entities/budget.entity');
const { BudgetsService } = require('../dist/modules/budgets/budgets.service');
const { InitialPersistence1792368000000 } = require('../dist/database/migrations/1792368000000-InitialPersistence');
const { Budgets1792454400000 } = require('../dist/database/migrations/1792454400000-Budgets');
const { SavingsGoal } = require('../dist/modules/savings-goals/entities/savings-goal.entity');
const { SavingsEntry } = require('../dist/modules/savings-goals/entities/savings-entry.entity');
const { SavingsGoalsService } = require('../dist/modules/savings-goals/savings-goals.service');
const { assertContract } = require('./contract.cjs');

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
  assert.equal((await source.runMigrations()).length, 5);
  assert.equal((await source.runMigrations()).length, 0);
  await seedDevelopment(source, password, 'test');
  await seedDevelopment(source, password, 'test');
  users = await source.getRepository(User).find({ order: { email: 'ASC' } });
  assert.equal(users.length, 2);
  assert.equal(await source.getRepository(Budget).count(), 6);
  assert.equal(await source.getRepository(SavingsGoal).count(), 12);
  assert.equal(await source.getRepository(SavingsEntry).count(), 12);
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

async function api(path, token, { method = 'GET', body } = {}) {
  const headers = { ...auth(token) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${base}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

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

test('registration, owned profile updates and password change revoke all sessions', async () => {
  const register = (body) => fetch(`${base}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  for (const body of [
    { email: 'invalid', password: 'long-enough-password', displayName: 'New user' },
    { email: 'new.user@fintrack.test', password: 'short', displayName: 'New user' },
    { email: 'new.user@fintrack.test', password: 'long-enough-password', displayName: ' ' },
    { email: 'new.user@fintrack.test', password: 'long-enough-password', displayName: 'New user', currency: 'USD' },
  ]) assert.equal((await register(body)).status, 400);

  const created = await register({ email: ' New.User@Fintrack.test ', password: 'long-enough-password', displayName: 'New user' });
  assert.equal(created.status, 201);
  assert.equal(created.headers.get('Cache-Control'), 'no-store');
  const createdSession = await created.json();
  assertContract('Session', createdSession);
  const user = await source.getRepository(User).findOneByOrFail({ email: 'new.user@fintrack.test' });
  assert.equal(user.displayName, 'New user');
  assert.equal(user.openingBalance, '0.00');
  const token = createdSession.accessToken;
  const secondLogin = await login('new.user@fintrack.test', { password: 'long-enough-password' });
  assert.equal(secondLogin.status, 200);
  const secondToken = (await secondLogin.json()).accessToken;
  assert.equal((await fetch(`${base}/users/me`)).status, 401);
  const profileResponse = await api('/users/me', token);
  assert.equal(profileResponse.status, 200);
  assert.equal(profileResponse.headers.get('Cache-Control'), 'no-store');
  const profile = await profileResponse.json();
  assertContract('Profile', profile);
  assert.equal(profile.email, 'new.user@fintrack.test');
  assert.equal(profile.displayName, 'New user');
  assert.equal(profile.currency, 'BOB');

  const changed = await api('/users/me', token, {
    method: 'PATCH',
    body: { email: 'new.address@fintrack.test', displayName: 'Updated name', openingBalance: '125.50', openingDate: '2020-01-01' },
  });
  assert.equal(changed.status, 200);
  assert.deepEqual(await changed.json(), {
    email: 'new.address@fintrack.test', displayName: 'Updated name', openingBalance: '125.50', openingDate: '2020-01-01', currency: 'BOB',
  });
  assert.equal((await api('/users/me', token, { method: 'PATCH', body: { email: SEED_EMAILS[0] } })).status, 409);
  const invalidDate = await api('/users/me', token, { method: 'PATCH', body: { openingDate: '9999-01-01' } });
  assert.equal(invalidDate.status, 409);
  assert.equal((await invalidDate.json()).error.code, 'INVALID_OPENING_DATE');
  assert.equal((await api('/users/me', token, { method: 'PATCH', body: { currency: 'USD' } })).status, 400);

  await source.query(
    "INSERT INTO transactions(id,user_id,type,status,amount,currency,occurred_at) VALUES($1,$2,'income','posted','10.00','BOB','2021-01-01T12:00:00Z')",
    [randomUUID(), user.id],
  );
  const historicalConflict = await api('/users/me', token, { method: 'PATCH', body: { openingDate: '2022-01-01' } });
  assert.equal(historicalConflict.status, 409);
  assert.equal((await historicalConflict.json()).error.code, 'OPENING_DATE_CONFLICT');
  assert.equal((await register({ email: SEED_EMAILS[0], password: 'long-enough-password', displayName: 'Duplicate' })).status, 409);

  assert.equal((await api('/auth/password', token, { method: 'POST', body: { currentPassword: 'incorrect', newPassword: 'new-long-password' } })).status, 401);
  assert.equal((await api('/auth/password', token, { method: 'POST', body: { currentPassword: 'long-enough-password', newPassword: 'short' } })).status, 400);
  const changedPassword = await api('/auth/password', token, {
    method: 'POST', body: { currentPassword: 'long-enough-password', newPassword: 'new-long-password' },
  });
  assert.equal(changedPassword.status, 204);
  assert.equal(await changedPassword.text(), '');
  assert.equal((await api('/users/me', token)).status, 401);
  assert.equal((await api('/users/me', secondToken)).status, 401);
  assert.equal((await login('new.address@fintrack.test', { password: 'long-enough-password' })).status, 401);
  assert.equal((await login('new.address@fintrack.test', { password: 'new-long-password' })).status, 200);
  const sessions = await source.getRepository(Session).findBy({ userId: user.id });
  assert.equal(sessions.filter(session => session.revokedAt === null).length, 1);
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
    assert.equal(body.sections.balance.data.amount, email === SEED_EMAILS[0] ? '2200.05' : '259.50');
    assert.equal(body.sections.balance.data.cutoff, body.asOf);
    assert.deepEqual(body.sections.monthlySummary, { status: 'ready', data: { income: '0.00', expense: email === SEED_EMAILS[0] ? '500.05' : '40.50' } });
    const distribution = body.sections.expenseDistribution;
    assert.equal(distribution.status, 'ready');
    assert.equal(distribution.data.length, 1);
    assert.equal(distribution.data[0].amount, body.sections.monthlySummary.data.expense);
    assert.equal(distribution.data[0].percentage, '100.00');
    assert.equal(distribution.data[0].categoryName, email === SEED_EMAILS[0] ? 'Alimentacion' : 'Transporte');
    assert.deepEqual(body.sections.budgets, { status: 'ready', data: [] });
    assert.equal(body.sections.savingsGoals.status, 'ready');
    assert.equal(body.sections.savingsGoals.data.length, 5);
    assert.ok(!JSON.stringify(body).includes(users[0].id));
  }
});

test('domain query isolates persisted movements by authenticated session identity', async () => {
  const service = app.get(TransactionsService);
  for (let i=0; i<users.length; i++) {
    const identity = await app.get(AuthService).authenticate(`Bearer ${await accessToken(users[i].email)}`);
    const result = await service.listForUser(identity.userId, {});
    const transactions = result.items;
    assert.equal(transactions.length, 8);
    assert.ok(transactions.every(item => !('userId' in item)));
    assert.equal(result.totalItems, 8);
    const baseline = transactions.filter(item => new Date(item.occurredAt) >= new Date('2026-09-01T00:00:00Z'));
    assert.deepEqual(baseline.map(item => item.amount), i === 0 ? ['500.05','2000.10'] : ['40.50','700.00']);
    const demonstration = transactions.filter(item => new Date(item.occurredAt) < new Date('2026-09-01T00:00:00Z'));
    assert.equal(demonstration.length, 6);
    assert.equal(demonstration.reduce((total, item) => total + (item.type === 'income' ? 1n : -1n) * decimalToMinorUnits(item.amount), 0n), 0n);
  }
  await assert.rejects(service.listForUser(undefined));
});

test('transaction and category HTTP APIs validate contracts, isolate owners, filter pages, and void instead of deleting', async () => {
  const ownerToken = await accessToken(SEED_EMAILS[0]);
  const otherToken = await accessToken(SEED_EMAILS[1]);
  const createdCategory = await api('/categories', ownerToken, { method: 'POST', body: { name: 'Module 2 category' } });
  assert.equal(createdCategory.status, 201);
  assert.equal(createdCategory.headers.get('Cache-Control'), 'no-store');
  const category = await createdCategory.json();
  assertContract('Category', category);
  const otherCategories = await (await api('/categories', otherToken)).json();
  assert.ok(!otherCategories.some(item => item.id === category.id));
  assert.equal((await api('/categories', ownerToken, { method: 'POST', body: { name: category.name } })).status, 409);
  assert.equal((await api('/categories', ownerToken, { method: 'POST', body: { name: 'forbidden', userId: users[1].id } })).status, 400);

  const unassignedResponse = await api('/transactions', ownerToken, {
    method: 'POST',
    body: { type: 'income', amount: '0.25', occurredAt: '2026-10-19T12:00:00.000Z' },
  });
  assert.equal(unassignedResponse.status, 201);
  const unassigned = await unassignedResponse.json();
  assertContract('Transaction', unassigned);
  assert.equal(unassigned.categoryId, null);
  assert.equal(unassigned.categoryName, null);

  const createdResponse = await api('/transactions', ownerToken, {
    method: 'POST',
    body: { type: 'expense', amount: '15.25', categoryId: category.id, occurredAt: '2026-10-18T12:00:00.000Z', description: 'module2-filter-marker' },
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assertContract('Transaction', created);
  assert.equal(created.categoryName, category.name);
  assert.ok(!('userId' in created));
  assert.ok(!('refundOfId' in created));
  assert.equal((await api('/transactions', otherToken, {
    method: 'POST',
    body: { type: 'expense', amount: '1.00', categoryId: category.id, occurredAt: '2026-10-18T12:00:00.000Z' },
  })).status, 404);
  assert.equal((await api('/transactions', ownerToken, {
    method: 'POST',
    body: { type: 'expense', amount: '1.00', occurredAt: '2026-10-18T12:00:00.000Z', userId: users[1].id },
  })).status, 400);
  for (const amount of ['0.00', '1.2', '1000000000000.00']) {
    const response = await api('/transactions', ownerToken, {
      method: 'POST',
      body: { type: 'expense', amount, occurredAt: '2026-10-18T12:00:00.000Z' },
    });
    assert.equal(response.status, amount === '1000000000000.00' ? 422 : 400);
  }
  const filtered = await api('/transactions?type=expense&q=module2-filter-marker&page=1&pageSize=1', ownerToken);
  assert.equal(filtered.status, 200);
  const page = await filtered.json();
  assertContract('TransactionPage', page);
  assert.equal(page.totalItems, 1);
  assert.equal(page.items[0].id, created.id);
  assert.equal((await api('/transactions?userId=other', ownerToken)).status, 400);
  assert.equal((await api('/transactions?type=expense&type=income', ownerToken)).status, 400);
  assert.equal((await api(`/transactions/${created.id}`, otherToken)).status, 404);

  const updatedResponse = await api(`/transactions/${created.id}`, ownerToken, {
    method: 'PATCH',
    body: { amount: '16.75', description: 'updated module 2' },
  });
  assert.equal(updatedResponse.status, 200);
  const updated = await updatedResponse.json();
  assertContract('Transaction', updated);
  assert.equal(updated.amount, '16.75');
  assert.equal(updated.description, 'updated module 2');
  assert.equal((await api(`/transactions/${created.id}`, ownerToken, { method: 'PATCH', body: { amount: '1.00', userId: users[1].id } })).status, 400);
  assert.equal((await api(`/transactions/${created.id}`, ownerToken, { method: 'DELETE' })).status, 204);
  assert.equal((await api(`/transactions/${created.id}`, ownerToken, { method: 'DELETE' })).status, 204);
  assert.equal((await api(`/transactions/${created.id}`, ownerToken, { method: 'PATCH', body: { description: 'cannot edit void' } })).status, 409);
  const voidItem = await (await api(`/transactions/${created.id}`, ownerToken)).json();
  assert.equal(voidItem.status, 'void');
  const postedList = await (await api('/transactions', ownerToken)).json();
  assert.ok(!postedList.items.some(item => item.id === created.id));
  const voidList = await (await api('/transactions?status=void&q=updated', ownerToken)).json();
  assert.ok(voidList.items.some(item => item.id === created.id));

  const renamedResponse = await api(`/categories/${category.id}`, ownerToken, { method: 'PATCH', body: { name: 'Renamed module 2 category' } });
  assert.equal(renamedResponse.status, 200);
  assertContract('Category', await renamedResponse.json());
  assert.equal((await api(`/categories/${category.id}`, ownerToken, { method: 'DELETE' })).status, 204);
  assert.equal((await (await api(`/transactions/${created.id}`, ownerToken)).json()).categoryId, null);

  const budgetCategoryResponse = await api('/categories', ownerToken, { method: 'POST', body: { name: 'Budget-linked category' } });
  const budgetCategory = await budgetCategoryResponse.json();
  const budgetId = randomUUID();
  await source.getRepository(Budget).insert({
    id: budgetId,
    userId: users[0].id,
    categoryId: budgetCategory.id,
    month: '2100-01',
    limit: '100.00',
    currency: 'BOB',
  });
  assert.equal((await api(`/categories/${budgetCategory.id}`, ownerToken, { method: 'DELETE' })).status, 409);
  assert.equal(await source.getRepository(Category).countBy({ id: budgetCategory.id, userId: users[0].id }), 1);
  await source.getRepository(Budget).delete({ id: budgetId });
  assert.equal((await api(`/categories/${budgetCategory.id}`, ownerToken, { method: 'DELETE' })).status, 204);
  await source.query('DELETE FROM transactions WHERE id = ANY($1)', [[unassigned.id, created.id]]);
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

async function budgetFixture(spent = '0.00', limit = '100.00', month = '2026-10') {
  const fixture = await balanceFixture('0.00');
  const categoryId = randomUUID();
  const budgetId = randomUUID();
  await source.query('INSERT INTO categories(id,user_id,name) VALUES($1,$2,\'Budget fixture\')', [categoryId, fixture.userId]);
  await source.getRepository(Budget).insert({ id: budgetId, userId: fixture.userId, categoryId, month, currency: 'BOB', limit });
  if (decimalToMinorUnits(spent) > 0n) await source.query('INSERT INTO transactions(id,user_id,category_id,type,status,amount,currency,occurred_at) VALUES($1,$2,$3,\'expense\',\'posted\',$4,\'BOB\',$5)', [randomUUID(), fixture.userId, categoryId, spent, `${month}-05T12:00:00Z`]);
  return { ...fixture, categoryId, budgetId };
}

test('budget management authenticates, validates input and isolates CRUD by owner and month', async () => {
  const fixture = await balanceFixture('0.00');
  const token = await accessToken(fixture.email);
  const categoryId = randomUUID();
  await source.query('INSERT INTO categories(id,user_id,name) VALUES($1,$2,$3)', [categoryId, fixture.userId, 'Presupuesto API']);

  const unauthorized = await fetch(`${base}/budgets?month=2026-10`);
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers.get('Cache-Control'), 'no-store');

  const invalidPeriod = await fetch(`${base}/budgets?month=2026-13`, { headers: auth(token) });
  assert.equal(invalidPeriod.status, 400);
  assert.equal((await invalidPeriod.json()).error.code, 'INVALID_PERIOD');

  const empty = await fetch(`${base}/budgets?month=2026-10`, { headers: auth(token) });
  assert.equal(empty.status, 200);
  assert.equal(empty.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await empty.json(), []);

  for (const body of [
    { categoryId, month: '2026-10', limit: '0.00' },
    { categoryId, month: '2026-10', limit: '1.001' },
    { categoryId, month: '2026-10', limit: 1 },
    { categoryId, month: '2026-10', limit: '100.00', userId: fixture.userId },
    { categoryId: randomUUID(), month: '2026-10', limit: '100.00' },
    { categoryId, month: '2026-10', limit: '1000000000000.00' },
  ]) {
    const response = await fetch(`${base}/budgets`, {
      method: 'POST', headers: { ...auth(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.ok([400, 404, 422].includes(response.status), `Unexpected status ${response.status} for ${JSON.stringify(body)}`);
  }

  const createdResponse = await fetch(`${base}/budgets`, {
    method: 'POST', headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId, month: '2026-10', limit: '100.00' }),
  });
  assert.equal(createdResponse.status, 201);
  assert.equal(createdResponse.headers.get('Cache-Control'), 'no-store');
  const created = await createdResponse.json();
  assert.equal(created.categoryId, categoryId);
  assert.equal(created.categoryName, 'Presupuesto API');
  assert.equal(created.limit, '100.00');
  assert.equal(created.spent, '0.00');
  assert.equal(created.remaining, '100.00');
  assert.equal(created.progress, '0.00');
  assert.equal(created.state, 'normal');
  assertContract('Budget', created);

  const duplicate = await fetch(`${base}/budgets`, {
    method: 'POST', headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId, month: '2026-10', limit: '20.00' }),
  });
  assert.equal(duplicate.status, 409);

  const otherToken = await accessToken(users.find(user => user.email !== fixture.email).email);
  const otherList = await fetch(`${base}/budgets?month=2026-10`, { headers: auth(otherToken) });
  assert.deepEqual(await otherList.json(), []);
  const foreignUpdate = await fetch(`${base}/budgets/${created.id}`, {
    method: 'PATCH', headers: { ...auth(otherToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: '200.00' }),
  });
  assert.equal(foreignUpdate.status, 404);

  const updatedResponse = await fetch(`${base}/budgets/${created.id}`, {
    method: 'PATCH', headers: { ...auth(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: '80.00' }),
  });
  assert.equal(updatedResponse.status, 200);
  assert.equal(updatedResponse.headers.get('Cache-Control'), 'no-store');
  const updated = await updatedResponse.json();
  assert.equal(updated.limit, '80.00');
  assertContract('Budget', updated);

  const list = await fetch(`${base}/budgets?month=2026-10`, { headers: auth(token) });
  assert.deepEqual(await list.json(), [updated]);
  const nextMonth = await fetch(`${base}/budgets?month=2026-11`, { headers: auth(token) });
  assert.deepEqual(await nextMonth.json(), []);

  const deleted = await fetch(`${base}/budgets/${created.id}`, { method: 'DELETE', headers: auth(token) });
  assert.equal(deleted.status, 204);
  const missing = await fetch(`${base}/budgets/${created.id}`, {
    method: 'PATCH', headers: { ...auth(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: '80.00' }),
  });
  assert.equal(missing.status, 404);
});

test('budgets classify exact 0/80/100/exceeded thresholds before rounding and preserve negative remaining and progress over100', async () => {
  const service = app.get(BudgetsService);
  const period = resolvePeriod({ month: '2026-10' }, new Date());
  for (const [spent, limit, state, progress, remaining] of [
    ['0.00', '100.00', 'normal', '0.00', '100.00'],
    ['79.99', '100.00', 'normal', '79.99', '20.01'],
    ['80.00', '100.00', 'warning', '80.00', '20.00'],
    ['100.00', '100.00', 'warning', '100.00', '0.00'],
    ['100.01', '100.00', 'exceeded', '100.01', '-0.01'],
    ['799.99', '1000.00', 'normal', '80.00', '200.01'],
    ['1000.01', '1000.00', 'exceeded', '100.00', '-0.01'],
  ]) {
    const fixture = await budgetFixture(spent, limit);
    assert.deepEqual(await service.getForUser(fixture.userId, period), [{ id: fixture.budgetId, categoryId: fixture.categoryId, categoryName: 'Budget fixture', limit, spent, remaining, progress, state }]);
  }
  const maximum = await budgetFixture('999999999999.99', '0.01');
  const [budget] = await service.getForUser(maximum.userId, period);
  assert.equal(budget.progress, '9999999999999900.00');
  assert.equal(budget.remaining, '-999999999999.98');
  assert.equal(progressPercentage(3n, 2n), '150.00');
  assert.throws(() => percentageOf(3n, 2n)); // Distribution keeps its stricter validation.
});

test('budget schema rejects invalid limits, periods, null/cross-owner categories, currency and duplicate owner-category-month', async () => {
  const fixture = await budgetFixture();
  const [other] = await source.query('SELECT id FROM categories WHERE user_id=$1 LIMIT 1', [users[1].id]);
  async function insert(overrides = {}) {
    const value = { userId: fixture.userId, categoryId: fixture.categoryId, month: '2026-11', limit: '100.00', currency: 'BOB', ...overrides };
    return source.getRepository(Budget).insert({ id: randomUUID(), ...value });
  }
  for (const limit of ['0.00', '-1.00', '1.001', '1.230', '1000000000000.00', 'NaN', 'Infinity']) await assert.rejects(insert({ limit }));
  for (const month of ['2026-00', '2026-13', '2026-1', '0000-01', '1899-12', '9999-01']) await assert.rejects(insert({ month }));
  await assert.rejects(insert({ categoryId: null }));
  await assert.rejects(insert({ categoryId: other.id }));
  await assert.rejects(insert({ currency: 'USD' }));
  await assert.rejects(insert({ month: '2026-10' }));
  await insert({ month: '1900-01', limit: '0.01' });
  await insert({ month: '9998-12', limit: '999999999999.99' });
});

test('budget HTTP uses monthly gross expense API including future/void/refunds, no rollover, no budgets and user isolation', async () => {
  const fixture = await budgetFixture('0.00', '10.00', '2100-03');
  const expenseId = randomUUID();
  const add = async (type, amount, at, status = 'posted', categoryId = fixture.categoryId, refund = null, id = randomUUID()) => source.query('INSERT INTO transactions(id,user_id,category_id,type,status,amount,currency,occurred_at,refund_of_id) VALUES($1,$2,$3,$4,$5,$6,\'BOB\',$7,$8)', [id,fixture.userId,categoryId,type,status,amount,at,refund]);
  await add('expense', '8.00', '2100-03-01T04:00:00Z', 'posted', fixture.categoryId, null, expenseId);
  await add('expense', '2.00', '2100-04-01T03:59:59.999Z');
  await add('income', '1.00', '2100-03-02T12:00:00Z', 'posted', null, expenseId);
  await add('expense', '99.00', '2100-03-01T03:59:59.999Z');
  await add('expense', '88.00', '2100-04-01T04:00:00Z');
  await add('expense', '77.00', '2100-03-10T12:00:00Z', 'void');
  await budgetFixture('99.00', '100.00', '2100-03');
  const token = await accessToken(fixture.email);
  const response = await fetch(`${base}/dashboard?month=2100-03`, { headers: auth(token) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.sections.balance.data.amount, '0.00');
  assert.equal(body.sections.monthlySummary.data.expense, '10.00');
  assert.equal(body.sections.expenseDistribution.data[0].amount, '10.00');
  const [budget] = body.sections.budgets.data;
  assert.equal(budget.spent, '10.00');
  assert.equal(budget.remaining, '0.00');
  assert.equal(budget.state, 'warning');
  assert.equal(budget.progress, '100.00');
  assert.deepEqual(body.sections.savingsGoals, { status: 'ready', data: [] });
  const next = await (await fetch(`${base}/dashboard?month=2100-04`, { headers: auth(token) })).json();
  assert.deepEqual(next.sections.budgets, { status: 'ready', data: [] });
});

test('seed budgets expose 80/100/exceeded independently for both users without changing original October or accumulated balance', async () => {
  for (let i = 0; i < users.length; i++) {
    const token = await accessToken(users[i].email);
    const response = await fetch(`${base}/dashboard?month=2026-02`, { headers: auth(token) });
    assert.equal(response.status, 200);
    const body = await response.json();
    const budgets = body.sections.budgets.data;
    assert.equal(budgets.length, 3);
    const byName = new Map(budgets.map(item => [item.categoryName,item]));
    assert.equal(byName.get('Demo presupuesto 80%').progress, '80.00');
    assert.equal(byName.get('Demo presupuesto 80%').state, 'warning');
    assert.equal(byName.get('Demo presupuesto 100%').state, 'warning');
    assert.equal(byName.get('Demo presupuesto excedido').state, 'exceeded');
    assert.ok(budgets.every(item => item.limit === (i === 0 ? '100.00' : '200.00')));
    assert.equal(body.sections.monthlySummary.data.income, body.sections.monthlySummary.data.expense);
    assert.equal(body.sections.balance.data.amount, i === 0 ? '2200.05' : '259.50');
  }
});

test('budget consumption retains common snapshot after concurrent expense and budget failures abort globally', async () => {
  const fixture = await budgetFixture('10.00', '100.00');
  const distributions = app.get(ExpenseDistributionService);
  const budgets = app.get(BudgetsService);
  const originalDistribution = distributions.getForUser;
  const originalBudgets = budgets.getForUser;
  let calls = 0;
  let sharedManager;
  try {
    distributions.getForUser = async function(userId, period, manager) {
      calls++;
      sharedManager ??= manager;
      assert.equal(manager, sharedManager);
      assert.equal(manager.queryRunner.transactionDepth, 1);
      const result = await originalDistribution.call(this, userId, period, manager);
      if (calls === 1) await source.query('INSERT INTO transactions(id,user_id,category_id,type,status,amount,currency,occurred_at) VALUES($1,$2,$3,\'expense\',\'posted\',\'2.00\',\'BOB\',\'2026-10-06T12:00:00Z\')', [randomUUID(), fixture.userId, fixture.categoryId]);
      return result;
    };
    const token = await accessToken(fixture.email);
    const response = await fetch(`${base}/dashboard?month=2026-10`, { headers: auth(token) });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sections.budgets.data[0].spent, '10.00');
    assert.equal(body.sections.expenseDistribution.data[0].amount, '10.00');
    distributions.getForUser = originalDistribution;
    const next = await (await fetch(`${base}/dashboard?month=2026-10`, { headers: auth(token) })).json();
    assert.equal(next.sections.budgets.data[0].spent, '12.00');
    budgets.getForUser = async () => { throw Object.assign(new Error('private SQL details'), { code: 'ECONNRESET' }); };
    const failed = await fetch(`${base}/dashboard?month=2026-10`, { headers: auth(token) });
    assert.equal(failed.status, 503);
    const error = await failed.json();
    assert.equal(error.error.code, 'DATA_UNAVAILABLE');
    assert.ok(!('sections' in error));
    assert.ok(!JSON.stringify(error).includes('private SQL details'));
  } finally { distributions.getForUser = originalDistribution; budgets.getForUser = originalBudgets; }
});

test('budget and savings migrations upgrade existing BE01 users and seed preserves credentials/data across rollback/reapply', async () => {
  const upgradeDatabase = `${database}_upgrade`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${upgradeDatabase}`;
  await admin.query(`CREATE DATABASE "${upgradeDatabase}"`);
  let upgrade = createDataSource(url.toString());
  upgrade.setOptions({ migrations: [InitialPersistence1792368000000] });
  try {
    await upgrade.initialize();
    assert.equal((await upgrade.runMigrations()).length, 1);
    const originals = await source.query('SELECT * FROM users WHERE email=ANY($1) ORDER BY email', [[...SEED_EMAILS]]);
    for (let i = 0; i < originals.length; i++) {
      const user = originals[i];
      await upgrade.query('INSERT INTO users(id,email,password_hash,opening_balance,opening_at,currency) VALUES($1,$2,$3,$4,$5,$6)', [user.id,user.email,user.password_hash,user.opening_balance,i === 0 ? '2100-01-01T00:00:00Z' : user.opening_at,user.currency]);
      await upgrade.query('INSERT INTO transactions(id,user_id,type,status,amount,currency,occurred_at) VALUES($1,$2,\'income\',\'posted\',\'12.34\',\'BOB\',$3)', [randomUUID(),user.id,i === 0 ? '2101-01-01T00:00:00Z' : '2026-03-01T00:00:00Z']);
    }
    await upgrade.destroy();
    upgrade = createDataSource(url.toString());
    await upgrade.initialize();
    assert.equal((await upgrade.runMigrations()).length, 4); // Later migrations preserve existing BE01 data.
    await assert.rejects(seedDevelopment(upgrade, password, 'test')); // Existing future opening is not bypassed.
    assert.equal(await upgrade.getRepository(Budget).count(), 0);
    assert.equal((await upgrade.query('SELECT COUNT(*)::int AS count FROM categories'))[0].count, 0);
    assert.equal((await upgrade.query('SELECT COUNT(*)::int AS count FROM transactions'))[0].count, 2);
    await upgrade.query('UPDATE users SET opening_at=$1 WHERE id=$2', [originals[0].opening_at, originals[0].id]);
    const before = await upgrade.query('SELECT * FROM users ORDER BY email');
    await seedDevelopment(upgrade, password, 'test');
    await seedDevelopment(upgrade, password, 'test');
    assert.deepEqual(await upgrade.query('SELECT * FROM users ORDER BY email'), before);
    assert.equal(await upgrade.getRepository(Budget).count(), 6);
    const movements = await upgrade.query('SELECT * FROM transactions ORDER BY id');
    assert.equal(movements.length, 14); // One existing + six demo movements per user.
    const [sample] = await upgrade.getRepository(Budget).find({ take: 1 });
    await upgrade.getRepository(Budget).update({ id: sample.id }, { limit: '123.45' });
    await seedDevelopment(upgrade, password, 'test');
    assert.equal((await upgrade.getRepository(Budget).findOneByOrFail({ id: sample.id })).limit, '123.45');
    assert.deepEqual(await upgrade.query('SELECT * FROM transactions ORDER BY id'), movements);
    await upgrade.undoLastMigration();
    await upgrade.undoLastMigration();
    assert.equal((await upgrade.runMigrations()).length, 2);
    await seedDevelopment(upgrade, password, 'test');
    assert.deepEqual(await upgrade.query('SELECT * FROM transactions ORDER BY id'), movements);
    assert.deepEqual(await upgrade.query('SELECT * FROM users ORDER BY email'), before);
    assert.equal(await upgrade.getRepository(Budget).count(), 6);
  } finally { if (upgrade.isInitialized) await upgrade.destroy(); await admin.query(`DROP DATABASE "${upgradeDatabase}"`); }
});

test('savings migration upgrades BE05 without changing existing users, movements or budgets', async () => {
  const upgradeDatabase = `${database}_be05`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${upgradeDatabase}`;
  await admin.query(`CREATE DATABASE "${upgradeDatabase}"`);
  let upgrade = createDataSource(url.toString());
  upgrade.setOptions({ migrations: [InitialPersistence1792368000000, Budgets1792454400000] });
  try {
    await upgrade.initialize();
    assert.equal((await upgrade.runMigrations()).length, 2);
    const [original] = await source.query('SELECT * FROM users WHERE email=$1', [SEED_EMAILS[0]]);
    const categoryId = randomUUID();
    await upgrade.query('INSERT INTO users(id,email,password_hash,opening_balance,opening_at,currency) VALUES($1,$2,$3,$4,$5,$6)', [original.id,original.email,original.password_hash,original.opening_balance,original.opening_at,original.currency]);
    await upgrade.query('INSERT INTO categories(id,user_id,name) VALUES($1,$2,\'Existing category\')', [categoryId,original.id]);
    await upgrade.query('INSERT INTO budgets(id,user_id,category_id,month,limit_amount) VALUES($1,$2,$3,\'2026-10\',\'123.45\')', [randomUUID(),original.id,categoryId]);
    await upgrade.query('INSERT INTO transactions(id,user_id,category_id,type,status,amount,occurred_at) VALUES($1,$2,$3,\'expense\',\'posted\',\'12.34\',\'2026-10-01T12:00:00Z\')', [randomUUID(),original.id,categoryId]);
    const snapshot = async () => ({
      users: await upgrade.query('SELECT id,email,password_hash,opening_balance,opening_at,currency FROM users ORDER BY id'),
      budgets: await upgrade.query('SELECT * FROM budgets ORDER BY id'),
      movements: await upgrade.query('SELECT id,user_id,category_id,type,status,amount,currency,occurred_at,refund_of_id FROM transactions ORDER BY id'),
    });
    const before = await snapshot();
    await upgrade.destroy();
    upgrade = createDataSource(url.toString());
    await upgrade.initialize();
    assert.equal((await upgrade.runMigrations()).length, 3);
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual(await upgrade.query('SELECT description FROM transactions'), [{ description: null }]);
    assert.equal(await upgrade.getRepository(SavingsGoal).count(), 0);
    await seedDevelopment(upgrade, password, 'test');
    const entries = await upgrade.query('SELECT * FROM savings_entries ORDER BY id');
    await seedDevelopment(upgrade, password, 'test');
    assert.deepEqual(await upgrade.query('SELECT * FROM savings_entries ORDER BY id'), entries);
    assert.deepEqual(await upgrade.query('SELECT id,email,password_hash,opening_balance,opening_at,currency FROM users WHERE id=$1', [original.id]), before.users);
    assert.deepEqual(await upgrade.query('SELECT * FROM budgets WHERE id=$1', [before.budgets[0].id]), before.budgets);
    assert.deepEqual(await upgrade.query('SELECT id,user_id,category_id,type,status,amount,currency,occurred_at,refund_of_id FROM transactions WHERE id=$1', [before.movements[0].id]), before.movements);
    assert.deepEqual(await upgrade.query('SELECT description FROM transactions WHERE id=$1', [before.movements[0].id]), [{ description: null }]);
  } finally { if (upgrade.isInitialized) await upgrade.destroy(); await admin.query(`DROP DATABASE "${upgradeDatabase}"`); }
});

async function appendSavings(fixture, values = {}) {
  const entry = { id: randomUUID(), userId: fixture.userId, goalId: fixture.goalId, type: 'contribution', amount: '10.00', currency: 'BOB', occurredAt: new Date('2026-10-01T12:00:00Z'), ...values };
  await source.getRepository(SavingsEntry).insert(entry);
  return entry.id;
}

async function goalForUser(userId, values = {}) {
  const goalId = randomUUID();
  await source.getRepository(SavingsGoal).insert({ id: goalId, userId, name: 'Goal fixture', target: '100.00', currency: 'BOB', createdAt: new Date('2026-01-01T00:00:00Z'), targetDate: null, archivedAt: null, ledgerVersion: '0', ...values });
  return { userId, goalId };
}

test('persisted savings reserve produces D03 balance2420.05 exactly once without affecting income or expense and isolates users', async () => {
  const fixture = await balanceFixture('1000.00', [{ amount: '2000.10' }, { type: 'expense', amount: '500.05', at: '2026-10-05T12:00:00Z' }]);
  const goal = await goalForUser(fixture.userId);
  await appendSavings(goal, { amount: '100.00', occurredAt: new Date('2026-10-06T12:00:00Z') });
  await appendSavings(goal, { type: 'withdrawal', amount: '20.00', occurredAt: new Date('2026-10-07T12:00:00Z') });
  const other = await balanceFixture('0.00');
  await appendSavings(await goalForUser(other.userId), { amount: '500.00' });
  const asOf = new Date('2026-10-19T12:00:00Z');
  assert.equal((await app.get(BalanceService).getForUser(fixture.userId, asOf)).amount, '2420.05');
  const reader = app.get(SavingsReservationReader);
  assert.equal(reader.constructor.name, 'PersistedSavingsReservationReader');
  assert.equal(await source.transaction(manager => reader.reservedMinorUnits(fixture.userId, asOf, manager)), 8000n);
  const token = await accessToken(fixture.email);
  for (const [month, income, expense] of [['2026-10','0.00','500.05'], ['2026-09','2000.10','0.00']]) {
    const response = await fetch(`${base}/dashboard?month=${month}`, { headers: auth(token) });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sections.balance.data.amount, '2420.05');
    assert.equal(body.sections.balance.data.cutoff, body.asOf);
    assert.deepEqual(body.sections.monthlySummary.data, { income, expense });
    assert.deepEqual(body.sections.savingsGoals.data, [{ id: goal.goalId, name: 'Goal fixture', target: '100.00', saved: '80.00', remaining: '20.00', progress: '80.00', state: 'active', targetDate: null }]);
  }
  assert.equal((await source.query('SELECT COUNT(*)::int AS count FROM transactions WHERE user_id=$1', [fixture.userId]))[0].count, 2);
});

test('goals classify empty, partial, completed, exceeded and overdue using local day, with completion precedence and real progress', async () => {
  const fixture = await balanceFixture('0.00');
  const service = app.get(SavingsGoalsService);
  assert.deepEqual(await service.getForUser(fixture.userId, new Date()), []);
  await assert.rejects(service.getForUser(randomUUID(), new Date()), error => error.getStatus() === 401);
  const cases = [
    { name: 'none', amount: null, date: null, saved: '0.00', remaining: '100.00', progress: '0.00', state: 'active' },
    { name: 'partial', amount: '20.05', date: '2099-12-31', saved: '20.05', remaining: '79.95', progress: '20.05', state: 'active' },
    { name: 'complete', amount: '100.00', date: '2026-01-31', saved: '100.00', remaining: '0.00', progress: '100.00', state: 'completed' },
    { name: 'exceeded', amount: '120.00', date: '2026-01-31', saved: '120.00', remaining: '0.00', progress: '120.00', state: 'completed' },
    { name: 'overdue', amount: '1.00', date: '2026-10-17', saved: '1.00', remaining: '99.00', progress: '1.00', state: 'overdue' },
  ];
  for (const item of cases) {
    const goal = await goalForUser(fixture.userId, { name: item.name, targetDate: item.date });
    if (item.amount) await appendSavings(goal, { amount: item.amount });
  }
  const asOf = new Date('2026-10-19T02:00:00Z'); // Still October18 in La Paz.
  const goals = await service.getForUser(fixture.userId, asOf);
  for (const item of cases) {
    const actual = goals.find(goal => goal.name === item.name);
    assert.equal(actual.saved, item.saved); assert.equal(actual.remaining, item.remaining);
    assert.equal(actual.progress, item.progress); assert.equal(actual.state, item.state);
  }
  const today = await goalForUser(fixture.userId, { name: 'today', targetDate: '2026-10-18' });
  assert.equal((await service.getForUser(fixture.userId, asOf)).find(goal => goal.id === today.goalId).state, 'active');
  assert.equal((await service.getForUser(fixture.userId, new Date('2026-10-19T04:00:00Z'))).find(goal => goal.id === today.goalId).state, 'overdue');
});

test('archival only hides goals while persisted reserve remains, withdrawal releases it, future entries and creation respect cutoff', async () => {
  const fixture = await balanceFixture('200.00');
  const goal = await goalForUser(fixture.userId, { archivedAt: new Date('2026-10-15T12:00:00Z') });
  await appendSavings(goal, { amount: '100.00' });
  await appendSavings(goal, { type: 'withdrawal', amount: '20.00', occurredAt: new Date('2026-10-20T12:00:00Z') });
  await appendSavings(goal, { amount: '10.00', occurredAt: new Date('2026-10-22T12:00:00Z') }); // Archive does not block financial history.
  const future = await goalForUser(fixture.userId, { createdAt: new Date('2100-01-01T00:00:00Z') });
  await appendSavings(future, { amount: '10.00', occurredAt: new Date('2100-01-01T00:00:00Z') });
  for (const [at, visible, balance] of [
    ['2026-10-14T12:00:00Z',1,'100.00'], ['2026-10-15T12:00:00Z',0,'100.00'],
    ['2026-10-20T12:00:00Z',0,'120.00'], ['2026-10-22T12:00:00Z',0,'110.00'],
  ]) {
    assert.equal((await app.get(SavingsGoalsService).getForUser(fixture.userId, new Date(at))).length, visible);
    assert.equal((await app.get(BalanceService).getForUser(fixture.userId, new Date(at))).amount, balance);
  }
});

test('savings schema rejects invalid target/entries/dates/owner and enforces append-only, effective prefixes and opening integrity', async () => {
  const fixture = await balanceFixture('0.00');
  for (const target of ['0.00','-1.00','1.001','1.230','1000000000000.00','NaN','Infinity']) await assert.rejects(goalForUser(fixture.userId, { target }));
  for (const targetDate of ['2026-02-30','1899-12-31','9999-01-01','infinity']) await assert.rejects(goalForUser(fixture.userId, { targetDate }));
  await assert.rejects(goalForUser(fixture.userId, { createdAt: new Date('1999-01-01T00:00:00Z') }));
  await assert.rejects(goalForUser(fixture.userId, { archivedAt: new Date('2025-01-01T00:00:00Z') }));
  await assert.rejects(goalForUser(fixture.userId, { currency: 'USD' }));
  const goal = await goalForUser(fixture.userId);
  for (const amount of ['0.00','-1.00','1.001','1.230','1000000000000.00','NaN','Infinity']) await assert.rejects(appendSavings(goal, { amount }));
  await assert.rejects(appendSavings(goal, { currency: 'USD' }));
  await assert.rejects(appendSavings(goal, { userId: users[1].id }));
  await assert.rejects(appendSavings(goal, { occurredAt: new Date('2025-01-01T00:00:00Z') }));
  await assert.rejects(appendSavings(goal, { type: 'withdrawal', amount: '0.01' }));
  const entryId = await appendSavings(goal, { amount: '100.00', occurredAt: new Date('2026-03-01T00:00:00Z') });
  await appendSavings(goal, { type: 'withdrawal', amount: '100.00', occurredAt: new Date('2026-04-01T00:00:00Z') });
  await appendSavings(goal, { amount: '100.00', occurredAt: new Date('2026-05-01T00:00:00Z') });
  // Final balance would remain99, but the April prefix would become -1.
  await assert.rejects(appendSavings(goal, { type: 'withdrawal', amount: '1.00', occurredAt: new Date('2026-03-15T00:00:00Z') }));
  await assert.rejects(source.getRepository(SavingsEntry).update({ id: entryId }, { amount: '101.00' }));
  await assert.rejects(source.getRepository(SavingsEntry).delete({ id: entryId }));
  await assert.rejects(source.getRepository(SavingsGoal).update({ id: goal.goalId }, { userId: users[1].id }));
  await assert.rejects(source.getRepository(SavingsGoal).update({ id: goal.goalId }, { createdAt: new Date('2026-02-01T00:00:00Z') }));
  await assert.rejects(source.query('UPDATE users SET opening_at=\'2026-02-01T00:00:00Z\' WHERE id=$1', [fixture.userId]));
});

test('concurrent withdrawals cannot overdraw under READ COMMITTED or stale REPEATABLE READ snapshots', async () => {
  for (const isolation of ['READ COMMITTED','REPEATABLE READ']) {
    const fixture = await balanceFixture('0.00');
    const goal = await goalForUser(fixture.userId);
    await appendSavings(goal, { amount: '100.00' });
    const clients = [new Client({ connectionString: process.env.DATABASE_URL }), new Client({ connectionString: process.env.DATABASE_URL })];
    try {
      for (const client of clients) {
        await client.connect(); await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
        await client.query('SELECT COUNT(*) FROM savings_entries WHERE goal_id=$1', [goal.goalId]); // Fix both snapshots before writes.
      }
      const results = await Promise.all(clients.map(async client => {
        try {
          await client.query('INSERT INTO savings_entries(id,user_id,goal_id,type,amount,currency,occurred_at) VALUES($1,$2,$3,\'withdrawal\',\'80.00\',\'BOB\',\'2026-10-02T12:00:00Z\')', [randomUUID(),fixture.userId,goal.goalId]);
          await client.query('COMMIT'); return 'committed';
        } catch (error) { await client.query('ROLLBACK'); return error.code; }
      }));
      assert.equal(results.filter(item => item === 'committed').length, 1);
      assert.ok(results.includes(isolation === 'REPEATABLE READ' ? '40001' : '23514'));
      assert.equal((await app.get(SavingsGoalsService).getForUser(fixture.userId, new Date('2026-10-19T12:00:00Z')))[0].saved, '20.00');
    } finally { await Promise.all(clients.map(client => client.end())); }
  }
});

test('maximum savings/progress stay exact and aggregate overflow errors instead of truncation or zero', async () => {
  const fixture = await balanceFixture('0.00');
  const goal = await goalForUser(fixture.userId, { target: '0.01' });
  await appendSavings(goal, { amount: '999999999999.99' });
  const [value] = await app.get(SavingsGoalsService).getForUser(fixture.userId, new Date('2026-10-19T12:00:00Z'));
  assert.equal(value.saved, '999999999999.99');
  assert.equal(value.progress, '9999999999999900.00');
  assert.equal(value.remaining, '0.00');
  await appendSavings(goal, { amount: '0.01', occurredAt: new Date('2026-10-02T12:00:00Z') });
  await assert.rejects(app.get(SavingsGoalsService).getForUser(fixture.userId, new Date('2026-10-19T12:00:00Z')), error => error.getStatus() === 422);
  const response = await fetch(`${base}/dashboard`, { headers: auth(await accessToken(fixture.email)) });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'DATA_OUT_OF_RANGE');
});

test('savings indicators and persisted balance reservations retain common snapshot across real concurrent contribution and failures stay global', async () => {
  const fixture = await balanceFixture('100.00');
  const goal = await goalForUser(fixture.userId);
  await appendSavings(goal, { amount: '10.00' });
  const reader = app.get(SavingsReservationReader);
  const goals = app.get(SavingsGoalsService);
  const originalReader = reader.reservedMinorUnits;
  const originalGoals = goals.getForUser;
  let readerManager;
  try {
    reader.reservedMinorUnits = async function(userId, asOf, manager) {
      readerManager = manager;
      const result = await originalReader.call(this, userId, asOf, manager);
      await appendSavings(goal, { amount: '2.00', occurredAt: new Date('2026-10-02T12:00:00Z') });
      return result;
    };
    goals.getForUser = async function(userId, asOf, manager) {
      assert.equal(manager, readerManager);
      assert.equal(manager.queryRunner.transactionDepth, 1);
      return originalGoals.call(this, userId, asOf, manager);
    };
    const token = await accessToken(fixture.email);
    const response = await fetch(`${base}/dashboard`, { headers: auth(token) });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sections.balance.data.amount, '90.00');
    assert.equal(body.sections.savingsGoals.data[0].saved, '10.00');
    reader.reservedMinorUnits = originalReader;
    goals.getForUser = originalGoals;
    const next = await (await fetch(`${base}/dashboard`, { headers: auth(token) })).json();
    assert.equal(next.sections.balance.data.amount, '88.00');
    assert.equal(next.sections.savingsGoals.data[0].saved, '12.00');
    goals.getForUser = async () => { throw Object.assign(new Error('private savings query'), { code: 'ECONNRESET' }); };
    const failed = await fetch(`${base}/dashboard`, { headers: auth(token) });
    assert.equal(failed.status, 503);
    const error = await failed.json();
    assert.equal(error.error.code, 'DATA_UNAVAILABLE');
    assert.ok(!('sections' in error));
    assert.ok(!JSON.stringify(error).includes('private savings query'));
  } finally { reader.reservedMinorUnits = originalReader; goals.getForUser = originalGoals; }
});

test('complete HTTP dashboard and errors satisfy OpenAPI for two sessions and truly empty finances', async () => {
  for (const email of SEED_EMAILS) {
    const response = await fetch(`${base}/dashboard?month=2026-02`, { headers: auth(await accessToken(email)) });
    assert.equal(response.status, 200);
    const dashboard = await response.json();
    assertContract('Dashboard', dashboard);
    assert.ok(Object.values(dashboard.sections).every(section => section.status === 'ready'));
    const distributionTotal = dashboard.sections.expenseDistribution.data.reduce((total, row) => total + decimalToMinorUnits(row.amount), 0n);
    assert.equal(distributionTotal, decimalToMinorUnits(dashboard.sections.monthlySummary.data.expense));
    for (const budget of dashboard.sections.budgets.data) {
      const category = dashboard.sections.expenseDistribution.data.find(row => row.categoryId === budget.categoryId);
      assert.equal(budget.spent, category?.amount ?? '0.00');
    }
    assert.equal(dashboard.sections.balance.data.cutoff, dashboard.asOf);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  const empty = await balanceFixture('42.50');
  const token = await accessToken(empty.email);
  const response = await fetch(`${base}/dashboard?month=2026-02`, { headers: auth(token) });
  const dashboard = await response.json();
  assert.equal(response.status, 200);
  assertContract('Dashboard', dashboard);
  assert.equal(dashboard.sections.balance.data.amount, '42.50');
  assert.deepEqual(dashboard.sections.monthlySummary.data, { income: '0.00', expense: '0.00' });
  for (const name of ['expenseDistribution', 'budgets', 'savingsGoals']) assert.deepEqual(dashboard.sections[name].data, []);
  for (const [query, headers, status] of [['month=bad', {}, 401], ['month=2026-13', auth(token), 400], [`userId=${users[0].id}`, auth(token), 400]]) {
    const invalid = await fetch(`${base}/dashboard?${query}`, { headers });
    assert.equal(invalid.status, status);
    const error = await invalid.json();
    assertContract('Error', error);
    assert.ok(!('sections' in error));
    assert.equal(invalid.headers.get('Cache-Control'), 'no-store');
  }
});

test('production provisioning creates a login without demo data and never overwrites existing users', async () => {
  const { createUser } = require('../dist/database/create-user');
  const { verifyPassword } = require('../dist/modules/auth/password');
  const email = `provision-${randomUUID()}@example.test`;
  const env = { ADMIN_EMAIL: email.toUpperCase(), ADMIN_PASSWORD: password, NODE_ENV: 'production' };
  const id = await createUser(source, env);
  const user = await source.getRepository(User).createQueryBuilder('u').addSelect('u.passwordHash').where('u.id = :id', { id }).getOneOrFail();
  assert.equal(user.email, email);
  assert.equal(user.openingBalance, '0.00');
  assert.equal(user.currency, 'BOB');
  assert.notEqual(user.passwordHash, password);
  assert.equal(await verifyPassword(password, user.passwordHash), true);
  const categories = await source.query('SELECT count(*)::int AS count FROM categories WHERE user_id = $1', [id]);
  assert.equal(categories[0].count, 0);
  assert.equal((await login(email)).status, 200);
  await assert.rejects(createUser(source, { ...env, ADMIN_PASSWORD: 'different-password', ADMIN_OPENING_BALANCE: '42.00' }));
  const unchanged = await source.getRepository(User).findOneByOrFail({ id });
  assert.equal(unchanged.openingBalance, '0.00');
  assert.equal((await login(email)).status, 200);
});

test('seed denies production and migrations can roll back and reapply on their own empty database', async () => {
  await assert.rejects(seedDevelopment(source, password, 'production'));
  assert.ok(await source.getRepository(User).count() >= 2);
  await app.close(); app = undefined;
  await source.undoLastMigration();
  assert.equal((await source.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='display_name'"))[0], undefined);
  await source.undoLastMigration();
  assert.equal((await source.query("SELECT column_name FROM information_schema.columns WHERE table_name='transactions' AND column_name='description'"))[0], undefined);
  await source.undoLastMigration();
  assert.equal((await source.query("SELECT to_regclass('public.savings_goals') AS name"))[0].name, null);
  await source.undoLastMigration();
  assert.equal((await source.query("SELECT to_regclass('public.budgets') AS name"))[0].name, null);
  await source.undoLastMigration();
  assert.equal((await source.query("SELECT to_regclass('public.users') AS name"))[0].name, null);
  assert.equal((await source.runMigrations()).length, 5);
  await seedDevelopment(source, password, 'test');
  assert.equal(await source.getRepository(User).count(), 2);
});
