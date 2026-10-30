const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { isolatedHttp, json } = require('./isolated-http.cjs');
const { assertContract, savingsGoalsOpenapi } = require('./contract.cjs');
const h = isolatedHttp('savings');
before(h.start);
after(h.stop);
const goalJson = response => json(response, 200, 'SavingsGoal', savingsGoalsOpenapi);
async function create(user, body = { name: 'Estudios', target: '3000.00' }) {
  assertContract('CreateGoal', body, savingsGoalsOpenapi);
  return json(await h.api('/savings-goals', user.token, { method: 'POST', body }), 201, 'SavingsGoal', savingsGoalsOpenapi);
}
async function entry(user, goal, body) {
  assertContract('CreateEntry', body, savingsGoalsOpenapi);
  return json(await h.api(`/savings-goals/${goal.id}/entries`, user.token, { method: 'POST', body }), 201, 'EntryResult', savingsGoalsOpenapi);
}
async function dashboard(user) { return json(await h.api('/dashboard?month=2026-01', user.token), 200, 'Dashboard'); }

test('savings management authenticates every route before validating bodies', async () => {
  const id = randomUUID();
  for (const [path, method, body] of [
    ['/savings-goals', 'GET'], ['/savings-goals', 'POST', {}],
    [`/savings-goals/${id}`, 'PATCH', {}], [`/savings-goals/${id}/entries`, 'POST', {}],
  ]) {
    const error = await json(await h.api(path, undefined, { method, body }), 401, 'Error');
    assert.equal(error.error.code, 'UNAUTHENTICATED');
  }
});

test('savings create validates strict boundaries and defaults with the management OpenAPI', async () => {
  const user = await h.user();
  const goal = await create(user, { name: '  Estudios  ', target: '0.01' });
  assert.equal(goal.name, 'Estudios');
  assert.equal(goal.targetDate, null);
  assert.equal(goal.saved, '0.00');
  assert.equal(goal.remaining, '0.01');
  assert.equal(goal.progress, '0.00');
  assert.equal(goal.archived, false);
  assert.equal(goal.currency, 'BOB');
  const max = await create(user, { name: 'N'.repeat(100), target: '999999999999.99', targetDate: '9998-12-31' });
  assert.equal(max.target, '999999999999.99');
  assert.equal(max.name.length, 100);
  assert.equal((await create(user, { name: 'Antigua', target: '1.00', targetDate: '1900-01-01' })).state, 'overdue');
  assert.equal((await create(user, { name: 'Sin fecha', target: '1.00', targetDate: null })).targetDate, null);
  for (const body of [null, [], {}, { name: '', target: '1.00' }, { name: ' ', target: '1.00' },
    { name: 'N'.repeat(101), target: '1.00' }, { name: 'X', target: '0.00' },
    { name: 'X', target: '-1.00' }, { name: 'X', target: 1 }, { name: 'X', target: '1.001' },
    { name: 'X', target: '01.00' }, { name: 'X', target: '1000000000000.00' },
    { name: 'X', target: '1.00', currency: 'BOB' }, { name: 'X', target: '1.00', targetDate: '2026-02-30' },
    { name: 'X', target: '1.00', targetDate: '1899-12-31' }, { name: 'X', target: '1.00', targetDate: '9999-01-01' },
  ]) await json(await h.api('/savings-goals', user.token, { method: 'POST', body }), 400, 'Error');
  assert.throws(() => assertContract('SavingsGoal', { ...goal, archived: undefined }, savingsGoalsOpenapi));
});

test('savings listing includes archived goals in stable creation order and isolates owners', async () => {
  const user = await h.user(), other = await h.user();
  assert.deepEqual(await json(await h.api('/savings-goals', other.token)), []);
  const a = await create(user), b = await create(user, { name: 'Viaje', target: '100.00' });
  await goalJson(await h.api(`/savings-goals/${a.id}`, user.token, { method: 'PATCH', body: { archived: true } }));
  const goals = await json(await h.api('/savings-goals', user.token));
  for (const goal of goals) assertContract('SavingsGoal', goal, savingsGoalsOpenapi);
  assert.deepEqual(goals.map(x => x.id), [a.id, b.id]);
  assert.equal(goals[0].archived, true);
  assert.deepEqual(await json(await h.api('/savings-goals', other.token)), []);
  const visible = (await dashboard(user)).sections.savingsGoals.data;
  assert.deepEqual(visible.map(x => x.id), [b.id]);
});

test('savings partial editing preserves fields, rejects invalid bodies and enforces ownership', async () => {
  const user = await h.user(), other = await h.user();
  const goal = await create(user, { name: 'Original', target: '100.00', targetDate: '2027-01-01' });
  const changed = await goalJson(await h.api(`/savings-goals/${goal.id}`, user.token, { method: 'PATCH', body: { name: '  Nuevo  ' } }));
  assert.deepEqual(changed, { ...goal, name: 'Nuevo' });
  assertContract('UpdateGoal', { target: '50.00', targetDate: null, archived: true }, savingsGoalsOpenapi);
  const archived = await goalJson(await h.api(`/savings-goals/${goal.id}`, user.token, { method: 'PATCH', body: { target: '50.00', targetDate: null, archived: true } }));
  assert.equal(archived.targetDate, null);
  assert.equal(archived.archived, true);
  assert.equal((await goalJson(await h.api(`/savings-goals/${goal.id}`, user.token, { method: 'PATCH', body: { archived: false } }))).archived, false);
  for (const body of [{}, { extra: true }, { name: ' ' }, { target: '0.00' }, { targetDate: '2026-02-30' }, { archived: 'true' }]) {
    await json(await h.api(`/savings-goals/${goal.id}`, user.token, { method: 'PATCH', body }), 400, 'Error');
  }
  for (const id of [goal.id, randomUUID()]) await json(await h.api(`/savings-goals/${id}`, other.token, { method: 'PATCH', body: { name: 'Ajena' } }), 404, 'Error');
});

test('savings HTTP ledger changes reservations exactly once and archival preserves funds', async () => {
  const user = await h.user(), goal = await create(user, { name: 'Reserva', target: '100.00' });
  const baseline = await dashboard(user);
  const before = Date.now();
  const contribution = await entry(user, goal, { type: 'contribution', amount: '125.50' });
  assert.ok(new Date(contribution.entry.occurredAt).getTime() >= before);
  assert.ok(new Date(contribution.entry.occurredAt).getTime() <= Date.now());
  assert.equal(contribution.goal.saved, '125.50');
  assert.equal(contribution.goal.remaining, '0.00');
  assert.equal(contribution.goal.progress, '125.50');
  assert.equal(contribution.goal.state, 'completed');
  const funded = await dashboard(user);
  assert.equal(funded.sections.balance.data.amount, '874.50');
  assert.deepEqual(funded.sections.monthlySummary, baseline.sections.monthlySummary);
  await goalJson(await h.api(`/savings-goals/${goal.id}`, user.token, { method: 'PATCH', body: { archived: true } }));
  const archived = await dashboard(user);
  assert.equal(archived.sections.balance.data.amount, '874.50');
  assert.deepEqual(archived.sections.savingsGoals.data, []);
  const withdrawal = await entry(user, goal, { type: 'withdrawal', amount: '25.50' });
  assert.equal(withdrawal.goal.archived, true);
  assert.equal(withdrawal.goal.saved, '100.00');
  assert.equal((await dashboard(user)).sections.balance.data.amount, '900.00');
  await json(await h.api(`/savings-goals/${goal.id}/entries`, user.token, { method: 'POST', body: { type: 'withdrawal', amount: '100.01' } }), 409, 'Error');
  assert.equal((await dashboard(user)).sections.balance.data.amount, '900.00');
});

test('savings explicit future entry retains its timestamp and has no current financial effect', async () => {
  const user = await h.user(), other = await h.user(), goal = await create(user);
  const instant = new Date(Date.now() + 86400000).toISOString();
  const result = await entry(user, goal, { type: 'contribution', amount: '12.34', occurredAt: instant });
  assert.equal(result.entry.occurredAt, instant);
  assert.equal(result.goal.saved, '0.00');
  assert.equal((await dashboard(user)).sections.balance.data.amount, '1000.00');
  for (const body of [{}, { type: 'income', amount: '1.00' }, { type: 'contribution', amount: '0.00' },
    { type: 'contribution', amount: '-1.00' }, { type: 'contribution', amount: '1.001' },
    { type: 'contribution', amount: 1 }, { type: 'contribution', amount: '1000000000000.00' },
    { type: 'contribution', amount: '1.00', occurredAt: '2026-01-01' },
    { type: 'contribution', amount: '1.00', occurredAt: '2026-02-30T12:00:00Z' },
    { type: 'contribution', amount: '1.00', userId: user.id },
  ]) await json(await h.api(`/savings-goals/${goal.id}/entries`, user.token, { method: 'POST', body }), 400, 'Error');
  for (const id of [goal.id, randomUUID()]) await json(await h.api(`/savings-goals/${id}/entries`, other.token, { method: 'POST', body: { type: 'contribution', amount: '1.00' } }), 404, 'Error');
  assert.equal((await h.source.query('SELECT COUNT(*)::int AS count FROM savings_entries WHERE goal_id=$1', [goal.id]))[0].count, 1);
});
