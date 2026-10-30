const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DateTime } = require('luxon');
const { isolatedHttp, json } = require('./isolated-http.cjs');
const { BudgetsService } = require('../dist/modules/budgets/budgets.service');
const { SavingsGoalsService } = require('../dist/modules/savings-goals/savings-goals.service');
const { tokenHash } = require('../dist/modules/auth/auth.service');
const h = isolatedHttp('notifications');
before(h.start);
after(h.stop);
const notices = async (user, month = '2030-01') => json(await h.api('/notifications?month=' + month, user.token), 200, 'Notifications');
async function budget(user, spent, limit = '10000.00') {
  const category = randomUUID(), id = randomUUID();
  await h.source.query('INSERT INTO categories(id,user_id,name) VALUES($1,$2,$3)', [category, user.id, 'Categoría ' + id]);
  await h.source.query("INSERT INTO budgets(id,user_id,category_id,month,limit_amount,currency) VALUES($1,$2,$3,'2030-01',$4,'BOB')", [id,user.id,category,limit]);
  await h.source.query("INSERT INTO transactions(id,user_id,category_id,type,status,amount,currency,occurred_at) VALUES($1,$2,$3,'expense','posted',$4,'BOB','2030-01-15T12:00:00Z')", [randomUUID(),user.id,category,spent]);
  return { id, category };
}
async function goal(user, { saved = '0.00', targetDate = null, archived = false, future = false } = {}) {
  const id = randomUUID();
  const created = future ? new Date(Date.now() + 86400000).toISOString() : '2020-01-01T12:00:00.000Z';
  await h.source.query("INSERT INTO savings_goals(id,user_id,name,target_amount,target_date,currency,created_at,archived_at) VALUES($1,$2,$3,'100.00',$4,'BOB',$5,$6)", [id,user.id,'Meta ' + id,targetDate,created,archived ? '2022-01-01T12:00:00.000Z' : null]);
  if (saved !== '0.00') await h.source.query("INSERT INTO savings_entries(id,user_id,goal_id,type,amount,currency,occurred_at) VALUES($1,$2,$3,'contribution',$4,'BOB',$5)", [randomUUID(),user.id,id,saved,future ? new Date(Date.now() + 172800000).toISOString() : '2021-01-01T12:00:00.000Z']);
  return { id };
}
async function snapshot(user) {
  const state = {};
  for (const table of ['users','sessions','transactions','categories','budgets','savings_goals','savings_entries']) {
    const column = table === 'users' ? 'id' : 'user_id';
    state[table] = (await h.source.query(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM ${table} t WHERE ${column}=$1`, [user.id]))[0].rows;
  }
  return state;
}

test('notifications HTTP authenticates before query validation and enforces private period contract', async () => {
  const user = await h.user();
  for (const token of [undefined, 'malformed']) {
    const body = await json(await h.api('/notifications?month=bad', token), 401, 'Error');
    assert.equal(body.error.code, 'UNAUTHENTICATED');
  }
  for (const query of ['month=', 'month=2026-13', 'month=1899-12', 'month=9999-01', 'month=2026-01&month=2026-02', 'month=2026-01&unknown=true', 'userId=' + user.id]) {
    const body = await json(await h.api('/notifications?' + query, user.token), 400, 'Error');
    assert.equal(body.error.code, 'INVALID_PERIOD');
  }
  const current = await json(await h.api('/notifications', user.token), 200, 'Notifications');
  assert.equal(current.period.month, DateTime.fromISO(current.asOf, { zone: 'America/La_Paz' }).toFormat('yyyy-MM'));
  assert.deepEqual(current.items, []);
  assert.equal(current.total, 0);
  for (const change of ["expires_at=NOW()-INTERVAL '1 second'", 'revoked_at=NOW()']) {
    const fresh = await h.user();
    await h.source.query('UPDATE sessions SET ' + change + ' WHERE token_hash=$1', [tokenHash(fresh.token)]);
    await json(await h.api('/notifications?month=bad', fresh.token), 401, 'Error');
  }
});

test('notifications PostgreSQL uses exact 80 and 100 thresholds despite rounded percentages and future posted spending', async () => {
  const user = await h.user(), other = await h.user();
  const below = await budget(user, '7999.99');
  const eighty = await budget(user, '8000.00');
  const hundred = await budget(user, '10000.00');
  const above = await budget(user, '10000.01');
  const foreign = await budget(other, '10001.00');
  const result = await notices(user);
  assert.deepEqual(new Set(result.items.map(x => x.subjectId)), new Set([eighty.id,hundred.id,above.id]));
  assert.equal(result.total, 3);
  assert.ok(!result.items.some(x => [below.id,foreign.id].includes(x.subjectId)));
  assert.equal(result.items.find(x => x.subjectId === above.id).type, 'budget_exceeded');
  assert.match(result.items.find(x => x.subjectId === above.id).message, /100\.00 % \(10000\.01 de 10000\.00 BOB\)/);
  assert.match(result.items.find(x => x.subjectId === eighty.id).message, /80\.00 %/);
  assert.equal(result.items.find(x => x.subjectId === hundred.id).type, 'budget_warning');
  assert.deepEqual(result.items.map(x => x.id), [...result.items].sort((a,b) => a.type < b.type ? -1 : a.type > b.type ? 1 : a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : 0).map(x => x.id));
  assert.deepEqual((await notices(user, '2029-12')).items, []);
  assert.deepEqual((await notices(other)).items.map(x => x.subjectId), [foreign.id]);
});

test('notifications PostgreSQL prioritizes completed goals, excludes today, archived and future goals, and GET never writes', async () => {
  const user = await h.user(), other = await h.user();
  const today = DateTime.now().setZone('America/La_Paz').toISODate();
  const yesterday = DateTime.now().setZone('America/La_Paz').minus({ days: 1 }).toISODate();
  const completed = await goal(user, { saved: '125.00', targetDate: yesterday });
  const overdue = await goal(user, { targetDate: yesterday });
  await goal(user, { targetDate: today });
  await goal(user);
  await goal(user, { saved: '100.00', targetDate: yesterday, archived: true });
  await goal(user, { saved: '100.00', targetDate: yesterday, future: true });
  await goal(other, { saved: '100.00' });
  const before = await snapshot(user);
  const first = await notices(user), repeated = await notices(user);
  assert.deepEqual(first.items, repeated.items);
  assert.equal(first.total, 2);
  assert.deepEqual(new Set(first.items.map(x => x.id)), new Set(['goal_completed:' + completed.id,'goal_overdue:' + overdue.id]));
  assert.match(first.items.find(x => x.subjectId === completed.id).message, /125\.00 de 100\.00 BOB \(125\.00 %\)/);
  assert.deepEqual(await snapshot(user), before);
  assert.ok(!(await notices(other)).items.some(x => [completed.id,overdue.id].includes(x.subjectId)));
});

test('notifications reevaluate a completed overdue goal after withdrawal without changing income or expense', async () => {
  const user = await h.user();
  const item = await goal(user, { saved: '100.00', targetDate: '2020-01-02' });
  assert.deepEqual((await notices(user)).items.map(x => x.type), ['goal_completed']);
  const before = await json(await h.api('/dashboard?month=2026-01', user.token));
  await json(await h.api(`/savings-goals/${item.id}/entries`, user.token, { method: 'POST', body: { type: 'withdrawal', amount: '1.00' } }), 201);
  assert.deepEqual((await notices(user)).items.map(x => x.type), ['goal_overdue']);
  const after = await json(await h.api('/dashboard?month=2026-01', user.token));
  assert.deepEqual(before.sections.monthlySummary, after.sections.monthlySummary);
  assert.equal(before.sections.balance.data.amount, '900.00');
  assert.equal(after.sections.balance.data.amount, '901.00');
});

test('notifications keep one PostgreSQL snapshot during committed budget and savings changes between sources', async () => {
  const user = await h.user();
  const item = await budget(user, '8000.00');
  const saving = await goal(user);
  const service = h.app.get(BudgetsService), original = service.getForUser;
  let committed = false;
  service.getForUser = async function (...args) {
    const result = await original.apply(this, args);
    if (args[0] === user.id && !committed) {
      await h.source.transaction(async manager => {
        await manager.query('UPDATE budgets SET limit_amount=$1 WHERE id=$2', ['5000.00', item.id]);
        await manager.query("INSERT INTO savings_entries(id,user_id,goal_id,type,amount,currency,occurred_at) VALUES($1,$2,$3,'contribution','100.00','BOB','2021-01-01T12:00:00Z')", [randomUUID(),user.id,saving.id]);
      });
      committed = true;
    }
    return result;
  };
  try {
    const consistent = await notices(user);
    assert.equal(committed, true);
    assert.deepEqual(consistent.items.map(x => x.type), ['budget_warning']);
  } finally { service.getForUser = original; }
  assert.deepEqual((await notices(user)).items.map(x => x.type), ['budget_exceeded','goal_completed']);
});

test('notifications abort globally on failure of either public financial source', async () => {
  const user = await h.user();
  await budget(user, '8000.00');
  for (const Constructor of [BudgetsService,SavingsGoalsService]) {
    const service = h.app.get(Constructor), original = service.getForUser;
    service.getForUser = async () => { throw Object.assign(new Error('private adapter detail'), { code: 'ECONNRESET' }); };
    try {
      const body = await json(await h.api('/notifications?month=2030-01', user.token), 503, 'Error');
      assert.deepEqual(Object.keys(body), ['error']);
      assert.equal(body.error.code, 'DATA_UNAVAILABLE');
      assert.ok(!JSON.stringify(body).includes('private adapter detail'));
    } finally { service.getForUser = original; }
  }
});
