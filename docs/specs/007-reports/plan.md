# Plan — 007 Reportes financieros

**Implementación y validación local completadas.** Código 4bea0d915c4197346cdba7b040016b23edb00752; 2026-10-30. [Spec](spec.md) · [Tareas](tasks.md). No se propone reimplementar reportes ni alterar el fix integrado de cuentas nuevas.

## Módulos, datos y contrato actual

[ReportsController](../../../src/modules/reports/reports.controller.ts) autentica la consulta; [resolveReportPeriod](../../../src/modules/reports/report-period.ts) valida fechas; [ReportsService](../../../src/modules/reports/reports.service.ts) compone resumen, distribución y saldo desde servicios públicos. RF-1 a RF-5.

Usa las tablas financieras ya existentes y consulta openingAt del usuario. No añade entidad, almacenamiento ni migración. GET /api/v1/reports?from=2026-01-01&to=2026-03-31 devuelve period/currency/asOf/comparison/expenseDistribution/balanceEvolution, con bearer de sesión y no-store. [OpenAPI actual](../../openapi/reports.v1.json).

from/to son días locales inclusivos de America/La_Paz; se convierten a intervalo de instantes [inicio,fin). Máximo 24 meses calendario abarcados, contando extremos. Cada fila de evolución usa month/amount/cutoff. Errores: 401 UNAUTHENTICATED antes de validar rango; 400 INVALID_REPORT_PERIOD; errores financieros y envelope del filtro actual, sin respuestas parciales. RF-1, RF-5.

## Algoritmo actual

Fijar asOf → resolver rango → abrir REPEATABLE READ → obtener usuario y sus datos. Sumar ingresos/gastos brutos, calcular neto y distribución del intervalo. Iterar meses: omitir si endExclusive<=openingAt; para los demás, cutoff=min(endExclusive,asOf) y cálculo de saldo con corte inclusivo. Compartir EntityManager entre fuentes y propagar fallos. RF-2 a RF-5.

La omisión preapertura ya está implementada: evita inventar saldo histórico de una cuenta inexistente. Reutilizar servicios y snapshot mantiene coherencia; consultas independientes o saldos cero fabricados no son equivalentes. No cambiar cortes, devoluciones ni redondeo como parte de las tareas de validación.

## Validación ejecutada

Validación local independiente BE-SPECS, 2026-10-30: código/tests/OpenAPI 4bea0d915c4197346cdba7b040016b23edb00752; 82 pruebas aprobadas, 0 fallidas, 0 omitidas. Lint, tipos y build aprobados. [Entrega](../../be-specs-delivery.md) · [Matriz de 46 RF](../../sdd/coverage.md). CI remota, merge y despliegue no acreditados.

La suite de reportes ejecutó siete escenarios: acceso privado, periodos, cifras, aislamiento/futuro, apertura reciente/corte exacto/meses vacíos, escritura concurrente real y fallo global de tres fuentes. La omisión preapertura ya estaba integrada y no se reimplementó.

Prerrequisito reproducible: dependencias del lockfile, build y PostgreSQL 17 dedicado. TEST_DATABASE_URL debe apuntar a fintrack_be01_test con rol CREATEDB. Las suites nuevas conservan sus bases en la instancia descartable hasta retirarla; no usan la base del usuario.
