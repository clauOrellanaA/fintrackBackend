const { test } = require('node:test');
const assert = require('node:assert/strict');
const { projectNotifications } = require('../dist/modules/notifications/notification-projection');
const { NotificationsService } = require('../dist/modules/notifications/notifications.service');
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const budget = (n, state, progress = '80.00') => ({ id: id(n), categoryName: 'Alimentación', limit: '10000.00', spent: '8000.00', progress, state });
const goal = (n, state) => ({ id: id(n), name: 'Estudios', target: '100.00', saved: '100.00', progress: '100.00', state });

test('notifications project exact source states rather than rounded percentages', () => {
  const normal = { ...budget(1, 'normal'), spent: '7999.99' };
  const warning = budget(2, 'warning');
  const atLimit = { ...budget(3, 'warning', '100.00'), spent: '10000.00' };
  const exceeded = { ...budget(4, 'exceeded', '100.00'), spent: '10000.01' };
  const items = projectNotifications([normal, warning, atLimit, exceeded], []);
  assert.deepEqual(items.map(x => x.type + ':' + x.subjectId), ['budget_exceeded:' + id(4), 'budget_warning:' + id(2), 'budget_warning:' + id(3)]);
  assert.equal(items[0].message, 'El presupuesto de Alimentación superó el límite: 100.00 % (10000.01 de 10000.00 BOB).');
  assert.equal(items[1].message, 'El presupuesto de Alimentación está en advertencia: 80.00 % (8000.00 de 10000.00 BOB).');
});

test('notifications project completed and overdue goals with exact values, stable identity and deduplication', () => {
  const completed = { ...goal(4, 'completed'), saved: '999999999999.99', target: '1.00', progress: '99999999999999.00' };
  const overdue = { ...goal(3, 'overdue'), saved: '0.01', progress: '0.01' };
  const inputs = [completed, goal(1, 'active'), overdue, completed];
  const frozen = JSON.stringify(inputs);
  const items = projectNotifications([budget(2, 'warning'), budget(2, 'warning')], inputs);
  assert.deepEqual(items.map(x => x.id), ['budget_warning:' + id(2), 'goal_completed:' + id(4), 'goal_overdue:' + id(3)]);
  assert.equal(items[1].subjectType, 'savingsGoal');
  assert.equal(items[1].message, 'La meta Estudios está completada: 999999999999.99 de 1.00 BOB (99999999999999.00 %).');
  assert.equal(items[2].message, 'La meta Estudios está vencida: 0.01 de 100.00 BOB (0.01 %).');
  assert.equal(JSON.stringify(inputs), frozen);
  assert.deepEqual(projectNotifications([], []), []);
});

test('notifications composition shares RR manager and one injected instant across local midnight and month change', async () => {
  for (const [instant, month] of [['2026-02-01T03:59:59.999Z', '2026-01'], ['2026-02-01T04:00:00.000Z', '2026-02']]) {
    const asOf = new Date(instant), manager = Object.freeze({ readOnly: true });
    const calls = [];
    const service = new NotificationsService(
      { getForUser: async (user, period, snapshot) => { calls.push('budgets'); assert.equal(user, id(1)); assert.equal(period.month, month); assert.equal(snapshot, manager); return [budget(2, 'warning')]; } },
      { getForUser: async (user, cutoff, snapshot) => { calls.push('goals'); assert.equal(user, id(1)); assert.equal(cutoff, asOf); assert.equal(snapshot, manager); return [goal(3, 'completed')]; } },
      { source: { transaction: async (isolation, run) => { assert.equal(isolation, 'REPEATABLE READ'); return run(manager); } } },
    );
    const result = await service.getForUser(id(1), {}, asOf);
    assert.deepEqual(calls, ['budgets', 'goals']);
    assert.equal(result.asOf, instant);
    assert.equal(result.period.month, month);
    assert.equal(result.currency, 'BOB');
    assert.equal(result.total, result.items.length);
    assert.deepEqual(await service.getForUser(id(1), {}, asOf), result);
  }
});

test('notifications reject invalid period before reading sources and propagate each source failure', async () => {
  let reads = 0;
  const fail = new Error('source failed');
  for (const failing of ['budgets', 'goals']) {
    const service = new NotificationsService(
      { getForUser: async () => { reads++; if (failing === 'budgets') throw fail; return [budget(1, 'warning')]; } },
      { getForUser: async () => { reads++; if (failing === 'goals') throw fail; return []; } },
      { source: { transaction: async (_, run) => run({}) } },
    );
    await assert.rejects(service.getForUser(id(1), {}, new Date('2026-01-01T12:00:00Z')), error => error === fail);
  }
  const before = reads;
  const service = new NotificationsService({ getForUser: async () => { reads++; } }, {}, { source: { transaction: async () => { reads++; } } });
  await assert.rejects(service.getForUser(id(1), { month: 'bad' }), error => error.getStatus() === 400);
  assert.equal(reads, before);
});
