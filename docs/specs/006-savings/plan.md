# Plan — 006 Metas de ahorro

**Implementación y validación local completadas.** Código 4bea0d915c4197346cdba7b040016b23edb00752; 2026-10-30. [Spec](spec.md) · [Tareas](tasks.md). Este plan conserva las reglas actuales: no ordena reimplementar la gestión ni añadir endpoints.

## Módulos y modelo actual

[SavingsGoalsController](../../../src/modules/savings-goals/savings-goals.controller.ts) resuelve HTTP y sesión; [SavingsGoalsService](../../../src/modules/savings-goals/savings-goals.service.ts) valida y aplica gestión/indicadores. SavingsGoalsModule registra el controlador e integra el proveedor de reservas consumido por el saldo. RF-1 a RF-9.

Tablas existentes savings_goals (titular, nombre, objetivo, moneda, creación, fecha objetivo opcional, archivo y versión) y savings_entries (meta/titular, tipo, importe e instante). El [esquema](../../../src/database/migrations/1792540800000-SavingsGoals.ts) exige integridad por propietario, importes exactos y ledger de solo anexado. No se necesita otra migración para estas tareas. RF-4, RF-5, RF-6 a RF-9.

## Contrato actual

Rutas bajo /api/v1 con bearer de sesión y Cache-Control: no-store; [OpenAPI de metas](../../openapi/savings-goals.v1.json).

| Operación | Entrada/salida observada | RF |
| --- | --- | --- |
| GET /savings-goals | Lista propia con archivadas e indicadores, orden creación/id | 1–3, 7 |
| POST /savings-goals | name/target/targetDate opcional → meta creada, 201 | 6 |
| PATCH /savings-goals/{id} | Cambios parciales name/target/targetDate/archived → meta, 200 | 4, 8 |
| POST /savings-goals/{id}/entries | type/amount/occurredAt opcional → entrada y meta, 201 | 5, 9 |

Ejemplo: crear con {"name":"Estudios","target":"3000.00","targetDate":"2027-06-30"}; aportar con {"type":"contribution","amount":"250.00"}. Los montos son cadenas de dos decimales. La gestión incluye archivadas; el panel las omite. Archivar no elimina reservas ni impide entradas, y no existe DELETE destructivo.

Errores actuales: cuerpo inválido 400 INVALID_REQUEST; ajena/inexistente 404 NOT_FOUND; restricciones reconocidas 23514 → 409 CONFLICT. El error concurrente 40001 no tiene traducción de dominio: cae en 500 INTERNAL_ERROR del filtro, sin reintento automático. No prometer un 409 universal. RF-5 a RF-9.

## Algoritmo y decisión existente

Validar cuerpo estricto → obtener propietario de sesión → crear/editar meta o anexar entrada en transacción → releer indicadores. Calcular acumulado=aportes−retiros al corte, restante=max(objetivo−acumulado,0), progreso exacto HALF_UP; completed precede overdue. El lector de reservas conserva metas archivadas y descuenta una sola vez. RF-1 a RF-9.

Reutilizar esquema, ledger y servicios actuales preserva sus garantías; duplicar cálculos o reconstruir la API no cubre una brecha de tests. No se propone cambiar reglas de fechas, archivo o dinero.

## Validación ejecutada

Validación local independiente BE-SPECS, 2026-10-30: código/tests/OpenAPI 4bea0d915c4197346cdba7b040016b23edb00752; 82 pruebas aprobadas, 0 fallidas, 0 omitidas. Lint, tipos y build aprobados. [Entrega](../../be-specs-delivery.md) · [Matriz de 46 RF](../../sdd/coverage.md). CI remota, merge y despliegue no acreditados.

El helper carga savings-goals.v1.json y permite elegir ese documento frente al esquema homónimo del dashboard. Se ejecutaron seis escenarios de gestión HTTP: autenticación; creación/defaults/límites/formato/cuerpo; listado vacío/archivado/propietario/orden; edición parcial y archivo/desarchivo; aportes/retiros con reserva e insuficiencia; instante expreso futuro e input inválido. Los escenarios internos de ledger, reservas y retiros concurrentes también formaron parte de npm test.

Prerrequisito reproducible: dependencias del lockfile, build y PostgreSQL 17 dedicado. TEST_DATABASE_URL debe apuntar a fintrack_be01_test con rol CREATEDB. Las suites nuevas conservan sus bases en la instancia descartable hasta retirarla; no usan la base del usuario.
