const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { isolatedHttp, json } = require('./isolated-http.cjs');
const h = isolatedHttp('transactions');
before(h.start);
after(h.stop);

test('transactions reject an explicitly empty type instead of silently ignoring the filter', async () => {
  const user = await h.user();
  const error = await json(await h.api('/transactions?type=', user.token), 400, 'Error');
  assert.equal(error.error.code, 'INVALID_REQUEST');
  for (const type of ['income','expense']) {
    const list = await json(await h.api('/transactions?type=' + type, user.token));
    assert.deepEqual(list.items, []);
  }
});

test('transactions reject empty category UUID before writing while omitted and null categories remain valid', async () => {
  const user = await h.user();
  const body = { type: 'income', amount: '1.00', occurredAt: '2026-01-01T12:00:00.000Z' };
  const before = (await h.source.query('SELECT COUNT(*)::int AS count FROM transactions WHERE user_id=$1', [user.id]))[0].count;
  const error = await json(await h.api('/transactions', user.token, { method: 'POST', body: { ...body, categoryId: '' } }), 400, 'Error');
  assert.equal(error.error.code, 'INVALID_REQUEST');
  assert.equal((await h.source.query('SELECT COUNT(*)::int AS count FROM transactions WHERE user_id=$1', [user.id]))[0].count, before);
  for (const valid of [body, { ...body, categoryId: null }]) {
    const transaction = await json(await h.api('/transactions', user.token, { method: 'POST', body: valid }), 201);
    assert.equal(transaction.categoryId, null);
  }
});
