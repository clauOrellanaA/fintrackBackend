const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const { performance } = require('node:perf_hooks');
const { Client } = require('pg');
const { createDataSource } = require('../dist/database/data-source');
const { seedDevelopment, SEED_EMAILS } = require('../dist/database/seeds/development');

const database = `fintrack_be07_bench_${process.pid}_${Date.now()}`;
const samples = 20;

async function timings(run) {
  for (let i = 0; i < 3; i++) await run();
  const values = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    await run();
    values.push(performance.now() - start);
  }
  values.sort((a, b) => a - b);
  return { samples, p50Ms: +values[Math.ceil(samples * 0.5) - 1].toFixed(3), p95Ms: +values[Math.ceil(samples * 0.95) - 1].toFixed(3) };
}

function summarizePlan(explain) {
  const indexes = new Set();
  const nodes = new Set();
  let filteredRows = 0;
  function walk(node) {
    nodes.add(node['Node Type']);
    if (node['Index Name']) indexes.add(node['Index Name']);
    filteredRows += (node['Rows Removed by Filter'] ?? 0) * (node['Actual Loops'] ?? 1);
    for (const child of node.Plans ?? []) walk(child);
  }
  walk(explain.Plan);
  return { executionMs: explain['Execution Time'], sharedHitBlocks: explain.Plan['Shared Hit Blocks'] ?? 0,
    sharedReadBlocks: explain.Plan['Shared Read Blocks'] ?? 0, filteredRows, indexes: [...indexes], nodes: [...nodes] };
}

function queryLabel(sql) {
  if (sql.includes('u.opening_balance')) return 'balance';
  if (sql.includes(' AS reserved')) return 'reservations';
  if (sql.includes(' AS income')) return 'monthlySummary';
  if (sql.includes('movement_count')) return 'expenseDistribution';
  if (sql.includes('b.limit_amount')) return 'budgets';
  if (sql.includes('g.target_amount')) return 'savingsGoals';
  return 'unclassified';
}

async function main() {
  if (!process.env.TEST_DATABASE_URL) throw Error('TEST_DATABASE_URL is required for a dedicated PostgreSQL instance.');
  const url = new URL(process.env.TEST_DATABASE_URL);
  if (url.pathname !== '/fintrack_be01_test') throw Error('Use the dedicated fintrack_be01_test database, never a development database.');
  const admin = new Client({ connectionString: url.toString() });
  let created = false, source, app;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    url.pathname = `/${database}`;
    process.env.DATABASE_URL = url.toString();
    process.env.NODE_ENV = 'test';
    source = createDataSource(url.toString());
    // Fixture construction is not request latency. Keep the application pool's
    // normal 5s timeout; allow bulk loading on this separate connection only.
    source.setOptions({ extra: { max: 1, connectionTimeoutMillis: 3000, statement_timeout: 120000 } });
    await source.initialize();
    await source.runMigrations();
    const password = 'benchmark-local-test-only';
    await seedDevelopment(source, password, 'test');
    await source.query(`INSERT INTO users(id,email,password_hash,opening_balance,opening_at,currency)
      SELECT md5('be07-user-' || n)::uuid, 'bench-' || n || '@fintrack.test',
        (SELECT password_hash FROM users WHERE email=$1), 10000.00, '2026-01-01T04:00:00Z', 'BOB'
      FROM generate_series(1,40) AS n`, [SEED_EMAILS[0]]);
    await source.query(`INSERT INTO categories(id,user_id,name)
      SELECT md5(u.id::text || ':bench-cat:' || n)::uuid, u.id, 'Benchmark category ' || n
      FROM users u CROSS JOIN generate_series(1,10) AS n`);
    await source.query(`INSERT INTO transactions(id,user_id,category_id,type,status,amount,currency,occurred_at)
      SELECT md5(u.id::text || ':bench-tx:' || n)::uuid, u.id,
        md5(u.id::text || ':bench-cat:' || (1+n%10))::uuid,
        CASE WHEN n%4=0 THEN 'income' ELSE 'expense' END,
        CASE WHEN n%20=0 THEN 'void' ELSE 'posted' END,
        CASE WHEN n%4=0 THEN 25.00 ELSE 10.00 END, 'BOB',
        TIMESTAMPTZ '2026-01-01T04:00:00Z' + (n%365) * INTERVAL '1 day'
      FROM users u CROSS JOIN generate_series(1,5000) AS n`);
    await source.query(`INSERT INTO budgets(id,user_id,category_id,month,currency,limit_amount)
      SELECT md5(u.id::text || ':bench-budget:' || c || ':' || m)::uuid, u.id,
        md5(u.id::text || ':bench-cat:' || c)::uuid,
        to_char(DATE '2017-01-01' + (m-1)*INTERVAL '1 month','YYYY-MM'), 'BOB', 1000.00
      FROM users u CROSS JOIN generate_series(1,10) AS c CROSS JOIN generate_series(1,120) AS m`);
    await source.query(`INSERT INTO savings_goals(id,user_id,name,target_amount,currency,created_at)
      SELECT md5(u.id::text || ':bench-goal:' || n)::uuid, u.id, 'Benchmark goal ' || n,
        100.00, 'BOB', '2026-01-01T04:00:00Z'
      FROM users u CROSS JOIN generate_series(1,50) AS n`);
    await source.query(`INSERT INTO savings_entries(id,user_id,goal_id,type,amount,currency,occurred_at)
      SELECT md5(g.id::text || ':bench-entry:' || n)::uuid, g.user_id, g.id,
        CASE WHEN n%2=1 THEN 'contribution' ELSE 'withdrawal' END,
        CASE WHEN n%2=1 THEN 1.00 ELSE 0.50 END, 'BOB',
        TIMESTAMPTZ '2026-01-02T04:00:00Z' + n*INTERVAL '1 day'
      FROM savings_goals g CROSS JOIN generate_series(1,10) AS n WHERE g.name LIKE 'Benchmark goal %'
      ORDER BY g.id,n`);
    for (const table of ['users','categories','transactions','budgets','savings_goals','savings_entries']) await source.query(`ANALYZE ${table}`);
    const { NestFactory } = require('@nestjs/core');
    const { AppModule } = require('../dist/app.module');
    const { DashboardService } = require('../dist/modules/dashboard/dashboard.service');
    const { PersistenceService } = require('../dist/database/persistence.module');
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/v1`;
    const [{ id: userId }] = await source.query('SELECT id FROM users WHERE email=$1', [SEED_EMAILS[0]]);
    const dashboard = app.get(DashboardService);
    const appSource = app.get(PersistenceService).source;
    const originalLogger = appSource.logger;
    const captured = [];
    appSource.logger = { ...originalLogger, logQuery(sql, parameters) {
      if (sql.trim().startsWith('SELECT')) captured.push({ sql, parameters });
    }, logQueryError() {}, logQuerySlow() {}, logSchemaBuild() {}, logMigration() {}, log() {} };
    await dashboard.getForUser(userId, { month: '2026-10' });
    appSource.logger = originalLogger;
    const unique = [...new Map(captured.map(query => [query.sql, query])).values()];
    const plans = [];
    for (const query of unique) {
      const [result] = await source.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.sql}`, query.parameters);
      plans.push({ query: queryLabel(query.sql), ...summarizePlan(result['QUERY PLAN'][0]) });
    }
    const service = await timings(() => dashboard.getForUser(userId, { month: '2026-10' }));
    const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: SEED_EMAILS[0], password }) });
    assert.equal(login.status, 200);
    const { accessToken } = await login.json();
    const http = await timings(async () => {
      const response = await fetch(`${base}/dashboard?month=2026-10`, { headers: { Authorization: `Bearer ${accessToken}` } });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.ok(Object.values(body.sections).every(section => section.status === 'ready'));
    });
    const counts = {};
    for (const table of ['users','categories','transactions','budgets','savings_goals','savings_entries']) {
      counts[table] = Number((await source.query(`SELECT COUNT(*)::text AS count FROM ${table}`))[0].count);
    }
    const report = { node: process.version, postgres: (await source.query('SHOW server_version'))[0].server_version,
      data: counts, selectedMonth: '2026-10', selectedUserMovements: 5008, selectQueries: captured.length,
      service, http, engineeringHttpP95BudgetMs: 500, meetsLocalBudget: http.p95Ms < 500,
      scope: 'Local warm-cache engineering budget, not a product SLA. Login/KDF excluded. Synthetic isolated data; no production conclusions.', plans };
    const json = JSON.stringify(report, null, 2);
    if (process.env.BENCHMARK_OUTPUT) writeFileSync(process.env.BENCHMARK_OUTPUT, json + '\n');
    console.log(json);
  } finally {
    if (app) await app.close();
    if (source?.isInitialized) await source.destroy();
    if (created) await admin.query(`DROP DATABASE "${database}"`);
    await admin.end();
  }
}

main().catch(error => { console.error(`Benchmark failed: ${error.message}`); process.exitCode = 1; });
