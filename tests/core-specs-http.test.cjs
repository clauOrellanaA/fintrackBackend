const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DateTime } = require('luxon');
const { tokenHash } = require('../dist/modules/auth/auth.service');
const { isolatedHttp, json } = require('./isolated-http.cjs');

const h = isolatedHttp('core');
before(h.start);
after(h.stop);
const longEmail = 'a'.repeat(64) + '@' + 'd'.repeat(63) + '.' + 'e'.repeat(63) + '.' + 'f'.repeat(56) + '.test';
const post = (path, token, body) => h.api(path, token, { method: 'POST', body });
const patch = (path, token, body) => h.api(path, token, { method: 'PATCH', body });
async function noContent(response) {
  assert.equal(response.status, 204, await response.text());
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
}
async function error(response, status, code) {
  const body = await json(response, status, 'Error');
  if (code) assert.equal(body.error.code, code);
  return body;
}

test('001 registration accepts exact field maxima, normalizes identity and opens empty finances on the local day', async () => {
  assert.equal(longEmail.length, 254);
  const beforeDay = DateTime.now().setZone('America/La_Paz').startOf('day').toISO();
  const session = await json(await post('/auth/register', undefined, {
    email: ' ' + longEmail.toUpperCase() + ' ', displayName: ' ' + 'N'.repeat(80) + ' ', password: 'p'.repeat(1024),
  }), 201, 'Session');
  const afterDay = DateTime.now().setZone('America/La_Paz').startOf('day').toISO();
  const profile = await json(await h.api('/users/me', session.accessToken), 200, 'Profile');
  assert.deepEqual(profile, {
    email: longEmail, displayName: 'N'.repeat(80), openingBalance: '0.00',
    openingDate: profile.openingDate, currency: 'BOB',
  });
  assert.ok([beforeDay, afterDay].some(day => DateTime.fromISO(day).toISODate() === profile.openingDate));
  const [row] = await h.source.query('SELECT opening_at FROM users WHERE email=$1', [longEmail]);
  assert.ok([beforeDay, afterDay].some(day => new Date(day).getTime() === row.opening_at.getTime()));
  const dashboard = await json(await h.api('/dashboard', session.accessToken), 200, 'Dashboard');
  assert.equal(dashboard.sections.balance.data.amount, '0.00');
  assert.deepEqual(dashboard.sections.budgets.data, []);
  assert.deepEqual(dashboard.sections.savingsGoals.data, []);
  await json(await post('/auth/login', undefined, { email: longEmail.toUpperCase(), password: 'p'.repeat(1024) }), 200, 'Session');
  await error(await post('/auth/register', undefined, { email: longEmail, displayName: 'Other', password: h.password }), 409, 'EMAIL_ALREADY_REGISTERED');
});

test('001 registration and login reject every out-of-range field without exposing credential differences', async () => {
  const valid = { email: 'register-' + randomUUID() + '@fintrack.test', displayName: 'Valid', password: 'p'.repeat(12) };
  for (const body of [
    { ...valid, displayName: '' }, { ...valid, displayName: '   ' }, { ...valid, displayName: 'n'.repeat(81) },
    { ...valid, email: 'bad' }, { ...valid, email: 'x' + longEmail },
    { ...valid, password: 'p'.repeat(11) }, { ...valid, password: 'p'.repeat(1025) }, { ...valid, userId: randomUUID() },
  ]) await error(await post('/auth/register', undefined, body), 400, 'INVALID_REQUEST');
  await json(await post('/auth/register', undefined, valid), 201, 'Session');
  for (const password of ['', 'p'.repeat(1025)]) {
    await error(await post('/auth/login', undefined, { email: valid.email, password }), 400, 'INVALID_REQUEST');
  }
  await error(await post('/auth/login', undefined, { email: ' ' + valid.email, password: valid.password }), 400, 'INVALID_REQUEST');
  const wrong = await error(await post('/auth/login', undefined, { email: valid.email, password: 'x' }), 401, 'INVALID_CREDENTIALS');
  const absent = await error(await post('/auth/login', undefined, { email: 'absent-' + randomUUID() + '@fintrack.test', password: 'x' }), 401, 'INVALID_CREDENTIALS');
  assert.deepEqual(absent, wrong);
  const [{ count }] = await h.source.query('SELECT COUNT(*)::int AS count FROM users WHERE email=$1', [valid.email]);
  assert.equal(count, 1);
});

test('001 logout revokes only its own session while a second session remains usable', async () => {
  const owner = await h.user();
  const second = await json(await post('/auth/login', undefined, { email: owner.email, password: h.password }), 200, 'Session');
  await noContent(await h.api('/auth/session', owner.token, { method: 'DELETE' }));
  await error(await h.api('/users/me', owner.token), 401, 'UNAUTHENTICATED');
  const profile = await json(await h.api('/users/me', second.accessToken), 200, 'Profile');
  assert.equal(profile.email, owner.email);
  const rows = await h.source.query('SELECT token_hash,revoked_at FROM sessions WHERE user_id=$1', [owner.id]);
  assert.equal(rows.filter(row => row.revoked_at !== null).length, 1);
  assert.equal(rows.find(row => row.token_hash === tokenHash(second.accessToken)).revoked_at, null);
});

test('001 authentication rejects the exact expiry instant and accepts one millisecond before it', async t => {
  const owner = await h.user();
  const expiresAt = new Date('2026-10-30T12:00:00.000Z');
  await h.source.query('UPDATE sessions SET expires_at=$1 WHERE token_hash=$2', [expiresAt, tokenHash(owner.token)]);
  t.mock.timers.enable({ apis: ['Date'], now: expiresAt.getTime() - 1 });
  try {
    await json(await h.api('/users/me', owner.token), 200, 'Profile');
    t.mock.timers.tick(1);
    await error(await h.api('/dashboard?month=invalid', owner.token), 401, 'UNAUTHENTICATED');
  } finally { t.mock.timers.reset(); }
});

test('001 password length boundaries preserve invalid changes and revoke all sessions after accepted changes', async () => {
  const owner = await h.user();
  const second = await json(await post('/auth/login', undefined, { email: owner.email, password: h.password }), 200, 'Session');
  for (const body of [
    { currentPassword: h.password, newPassword: 'n'.repeat(11) },
    { currentPassword: h.password, newPassword: 'n'.repeat(1025) },
    { currentPassword: 'c'.repeat(1025), newPassword: 'n'.repeat(12) },
    { currentPassword: h.password, newPassword: 'n'.repeat(12), extra: true },
  ]) await error(await post('/auth/password', owner.token, body), 400, 'INVALID_REQUEST');
  await error(await post('/auth/password', owner.token, { currentPassword: 'wrong', newPassword: 'n'.repeat(12) }), 401, 'INVALID_CURRENT_PASSWORD');
  await json(await h.api('/users/me', owner.token), 200, 'Profile');
  await noContent(await post('/auth/password', owner.token, { currentPassword: h.password, newPassword: 'n'.repeat(1024) }));
  for (const token of [owner.token, second.accessToken]) await error(await h.api('/users/me', token), 401, 'UNAUTHENTICATED');
  await error(await post('/auth/login', undefined, { email: owner.email, password: h.password }), 401, 'INVALID_CREDENTIALS');
  const changed = await json(await post('/auth/login', undefined, { email: owner.email, password: 'n'.repeat(1024) }), 200, 'Session');
  await noContent(await post('/auth/password', changed.accessToken, { currentPassword: 'n'.repeat(1024), newPassword: 'm'.repeat(12) }));
  await json(await post('/auth/login', undefined, { email: owner.email, password: 'm'.repeat(12) }), 200, 'Session');
});

test('002 profile handles historical null names and preserves every field during single-field updates', async () => {
  const owner = await h.user();
  let expected = await json(await h.api('/users/me', owner.token), 200, 'Profile');
  assert.equal(expected.displayName, null);
  const email = 'b' + longEmail.slice(1);
  for (const [body, changes] of [
    [{ displayName: ' ' + 'P'.repeat(80) + ' ' }, { displayName: 'P'.repeat(80) }],
    [{ email: ' ' + email.toUpperCase() + ' ' }, { email }],
    [{ openingDate: '2001-01-01' }, { openingDate: '2001-01-01' }],
    [{ openingBalance: '999999999999.99' }, { openingBalance: '999999999999.99' }],
    [{ openingBalance: '-999999999999.99' }, { openingBalance: '-999999999999.99' }],
    [{ openingBalance: '-0.00' }, { openingBalance: '0.00' }],
    [{ openingBalance: '-0.01' }, { openingBalance: '-0.01' }],
  ]) {
    expected = { ...expected, ...changes };
    assert.deepEqual(await json(await patch('/users/me', owner.token, body), 200, 'Profile'), expected);
  }
});

test('002 invalid partial profiles are atomic and retain their prior values', async () => {
  const owner = await h.user({ displayName: 'Original' });
  const original = await json(await h.api('/users/me', owner.token), 200, 'Profile');
  const invalidBodies = [
    {}, { currency: 'USD' }, { displayName: '' }, { displayName: '  ' }, { displayName: null },
    { displayName: 'x'.repeat(81) }, { email: 'x' + longEmail }, { email: 'invalid' },
    ...['1', '1.0', '1.000', '+1.00', '01.00', '1000000000000.00', '-1000000000000.00', ' 1.00', '1e2', 'NaN'].map(openingBalance => ({ openingBalance })),
    { openingBalance: 1 }, { displayName: 'Should not persist', openingBalance: 'bad' },
  ];
  for (const body of invalidBodies) {
    await error(await patch('/users/me', owner.token, body), 400);
    assert.deepEqual(await json(await h.api('/users/me', owner.token), 200, 'Profile'), original);
  }
});

test('002 opening dates reject future, impossible days and historical goals while retaining email ownership', async () => {
  const owner = await h.user();
  const other = await h.user();
  await h.source.query("INSERT INTO savings_goals(id,user_id,name,target_amount,currency,created_at) VALUES($1,$2,'Historic goal','1.00','BOB',$3)", [randomUUID(), owner.id, '2020-06-15T12:00:00.000Z']);
  await error(await patch('/users/me', owner.token, { openingDate: '2020-06-16' }), 409, 'OPENING_DATE_CONFLICT');
  for (const openingDate of ['2026-02-30', '9999-01-01']) {
    await error(await patch('/users/me', owner.token, { openingDate }), 409, 'INVALID_OPENING_DATE');
  }
  await error(await patch('/users/me', owner.token, { email: other.email }), 409, 'EMAIL_ALREADY_REGISTERED');
  const profile = await json(await patch('/users/me', owner.token, { openingDate: '2020-06-15' }), 200, 'Profile');
  assert.equal(profile.openingDate, '2020-06-15');
  assert.equal(profile.email, owner.email);
});

test('003 history pagination resolves timestamp ties by id and retains literal case-insensitive text filtering', async () => {
  const owner = await h.user();
  const other = await h.user();
  const category = await json(await post('/categories', owner.token, { name: 'Literal%_Category' }), 201, 'Category');
  const ids = [];
  for (let index = 0; index < 3; index++) {
    const item = await json(await post('/transactions', owner.token, {
      type: 'expense', amount: '1.00', categoryId: category.id, occurredAt: '2026-01-15T12:00:00.000Z', description: 'Tie' + index,
    }), 201, 'Transaction');
    ids.push(item.id);
  }
  await json(await post('/transactions', other.token, { type: 'expense', amount: '1.00', occurredAt: '2026-01-15T12:00:00.000Z', description: 'Literal%_Category' }), 201, 'Transaction');
  ids.sort().reverse();
  for (let page = 1; page <= 3; page++) {
    const result = await json(await h.api('/transactions?q=literal%25_&page=' + page + '&pageSize=1', owner.token), 200, 'TransactionPage');
    assert.equal(result.totalItems, 3);
    assert.equal(result.totalPages, 3);
    assert.deepEqual(result.items.map(item => item.id), [ids[page - 1]]);
  }
  assert.deepEqual((await json(await h.api('/transactions?page=4&pageSize=1', owner.token), 200, 'TransactionPage')).items, []);
  const interval = await json(await h.api('/transactions?from=2026-01-15T12:00:00.000Z&to=2026-01-15T12:00:00.001Z&pageSize=100', owner.token), 200, 'TransactionPage');
  assert.deepEqual(interval.items.map(item => item.id), ids);
  assert.equal((await json(await h.api('/transactions?to=2026-01-15T12:00:00.000Z', owner.token), 200, 'TransactionPage')).totalItems, 0);
  for (const query of ['page=1&page=2', 'pageSize=1&pageSize=2', 'status=posted&status=void', 'q=a&q=b', 'from=bad', 'page=0', 'pageSize=101', 'from=2026-01-15T12:00:00Z&to=2026-01-15T12:00:00Z']) {
    await error(await h.api('/transactions?' + query, owner.token), 400, 'INVALID_REQUEST');
  }
});

test('003 transaction boundaries, partial edits and repeated void preserve the original owned record', async () => {
  const owner = await h.user();
  const other = await h.user();
  const input = { type: 'income', amount: '999999999999.99', occurredAt: '2026-01-15T12:00:00+00:00', description: ' ' + 'D'.repeat(500) + ' ' };
  const item = await json(await post('/transactions', owner.token, input), 201, 'Transaction');
  assert.equal(item.description, 'D'.repeat(500));
  for (const body of [
    { ...input, description: 'd'.repeat(501) }, { ...input, categoryId: 'bad' }, { ...input, categoryId: 1 },
    { ...input, occurredAt: '2026-02-30T12:00:00Z' }, { ...input, occurredAt: '2026-01-15T12:00:00' },
    { ...input, amount: '-1.00' },
  ]) await error(await post('/transactions', owner.token, body), 400, 'INVALID_REQUEST');
  await error(await post('/transactions', owner.token, { ...input, amount: '1000000000000.00' }), 422, 'DATA_OUT_OF_RANGE');
  const updated = await json(await patch('/transactions/' + item.id, owner.token, { description: '' }), 200, 'Transaction');
  assert.deepEqual(updated, { ...item, description: '' });
  await error(await patch('/transactions/' + item.id, owner.token, {}), 400, 'INVALID_REQUEST');
  await error(await h.api('/transactions/' + item.id, other.token, { method: 'DELETE' }), 404, 'NOT_FOUND');
  await noContent(await h.api('/transactions/' + item.id, owner.token, { method: 'DELETE' }));
  await noContent(await h.api('/transactions/' + item.id, owner.token, { method: 'DELETE' }));
  const stored = await json(await h.api('/transactions/' + item.id, owner.token), 200, 'Transaction');
  assert.deepEqual(stored, { ...updated, status: 'void' });
  await error(await patch('/transactions/' + item.id, owner.token, { amount: '1.00' }), 409, 'CONFLICT');
});

test('003 categories compare exact names and enforce boundary lengths across owners', async () => {
  const owner = await h.user();
  const other = await h.user();
  const category = await json(await post('/categories', owner.token, { name: ' ' + 'C'.repeat(100) + ' ' }), 201, 'Category');
  assert.equal(category.name, 'C'.repeat(100));
  await error(await post('/categories', owner.token, { name: category.name }), 409, 'CONFLICT');
  await json(await post('/categories', owner.token, { name: category.name.toLowerCase() }), 201, 'Category');
  await json(await post('/categories', other.token, { name: category.name }), 201, 'Category');
  for (const name of ['', '   ', 'c'.repeat(101)]) {
    await error(await post('/categories', owner.token, { name }), 400, 'INVALID_REQUEST');
    await error(await patch('/categories/' + category.id, owner.token, { name }), 400, 'INVALID_REQUEST');
  }
  await error(await patch('/categories/' + category.id, other.token, { name: 'Foreign' }), 404, 'NOT_FOUND');
});

test('005 budgets preserve exact extrema, category order and deletion semantics', async () => {
  const owner = await h.user();
  const categories = [];
  for (const name of ['First', 'Second', 'Third']) categories.push(await json(await post('/categories', owner.token, { name }), 201, 'Category'));
  const budgets = [];
  for (const [index, category] of categories.entries()) {
    budgets.push(await json(await post('/budgets', owner.token, { categoryId: category.id, month: '2026-01', limit: index === 0 ? '999999999999.99' : '0.01' }), 201, 'Budget'));
  }
  const listed = await json(await h.api('/budgets?month=2026-01', owner.token), 200);
  assert.deepEqual(listed.map(budget => budget.categoryId), categories.map(category => category.id).sort());
  assert.equal(listed.find(budget => budget.id === budgets[0].id).limit, '999999999999.99');
  for (const limit of ['0.00', '-1.00', '1.0', '01.00', '1000000000000.00', null]) {
    await error(await post('/budgets', owner.token, { categoryId: categories[0].id, month: '2026-02', limit }), 400, 'INVALID_REQUEST');
  }
  const updated = await json(await patch('/budgets/' + budgets[0].id, owner.token, { limit: '0.01' }), 200, 'Budget');
  assert.equal(updated.limit, '0.01');
  assert.equal(updated.categoryId, budgets[0].categoryId);
  await noContent(await h.api('/budgets/' + budgets[0].id, owner.token, { method: 'DELETE' }));
  await error(await h.api('/budgets/' + budgets[0].id, owner.token, { method: 'DELETE' }), 404, 'NOT_FOUND');
  assert.equal((await json(await h.api('/categories', owner.token), 200)).length, 3);
  assert.equal((await json(await h.api('/transactions', owner.token), 200, 'TransactionPage')).totalItems, 0);
});
