# Matriz de trazabilidad RF–implementación–test

Base vigente inspeccionada: 59acca46ad7a0c43d5ac00bc5c548b6acc227109. Captura original: bf57ebc. Fecha: 2026-10-28. [Specs](../README.md) · [Plan](plan.md) · [Tareas](tasks.md).

**Estado: inspección del código, SIN EJECUCIÓN de tests en esta entrega. Las filas 008 son PROPUESTAS sin implementación ni test.** No se informa ningún test aprobado ni cumplimiento funcional. «Escenario identificado» significa que se localizó una prueba relevante, no que cada cláusula del RF esté cubierta exhaustivamente. «Parcial» señala límites concretos detectados; no equivale a fallo demostrado. La matriz contiene 46 RF de ocho specs: 40 describen implementación existente y 6 corresponden al plan 008. Tener fuente identificada no acredita test ni resultado.

## Pruebas identificadas

Los códigos siguientes remiten al nombre literal del test y su archivo, para mantener pequeña la matriz. P corresponde a [persistence-http.test.cjs](../../tests/persistence-http.test.cjs), R a [reports-http.test.cjs](../../tests/reports-http.test.cjs), D a [period.test.cjs](../../tests/period.test.cjs) y C a [contract.test.cjs](../../tests/contract.test.cjs).

| Código | Archivo | Nombre literal del test |
| --- | --- | --- |
| P01 | P | credentials, strict login body, no-store and hashed session persistence |
| P02 | P | registration, owned profile updates and password change revoke all sessions |
| P03 | P | HTTP guard rejects missing/malformed/expired/revoked session before validating period |
| P04 | P | authenticated dashboard validates query and serves balance, summary and expense distribution |
| P05 | P | transaction and category HTTP APIs validate contracts, isolate owners, filter pages, and void instead of deleting |
| P06 | P | schema rejects cross-user categories/refunds, bad decimals, invalid opening and inconsistent updates |
| P07 | P | balance accumulates opening and previous months, filters void/future, includes cutoff and isolates owners |
| P08 | P | balance preserves explicit openings, negative/fractional and maximum precision, rejects missing/future opening and overflow |
| P09 | P | monthly summary uses half-open IANA month boundaries through year, leap and historical offsets |
| P10 | P | monthly HTTP isolates users, returns successful empty zeros and includes future posted within selected period independently of balance |
| P11 | P | monthly summary preserves gross refunds, exact maxima and rejects overflowing totals even when balance nets to zero |
| P12 | P | dashboard shares one snapshot despite concurrent writes and aborts summary failures without partial balance or synthetic zeros |
| P13 | P | expense distribution handles empty, income-only, single and equal categories including null and long names in stable order |
| P14 | P | distribution percentages use exact HALF_UP independently, preserve amount order, extremes and aggregate overflow |
| P15 | P | distribution shares monthly filters including IANA boundaries, future posted, void exclusion and ownership |
| P16 | P | distribution and summary retain same snapshot across concurrent commit, and distribution failure aborts all sections |
| P17 | P | budget management authenticates, validates input and isolates CRUD by owner and month |
| P18 | P | budgets classify exact 0/80/100/exceeded thresholds before rounding and preserve negative remaining and progress over100 |
| P19 | P | budget schema rejects invalid limits, periods, null/cross-owner categories, currency and duplicate owner-category-month |
| P20 | P | budget HTTP uses monthly gross expense API including future/void/refunds, no rollover, no budgets and user isolation |
| P21 | P | budget consumption retains common snapshot after concurrent expense and budget failures abort globally |
| P22 | P | persisted savings reserve produces D03 balance2420.05 exactly once without affecting income or expense and isolates users |
| P23 | P | goals classify empty, partial, completed, exceeded and overdue using local day, with completion precedence and real progress |
| P24 | P | archival only hides goals while persisted reserve remains, withdrawal releases it, future entries and creation respect cutoff |
| P25 | P | savings schema rejects invalid target/entries/dates/owner and enforces append-only, effective prefixes and opening integrity |
| P26 | P | concurrent withdrawals cannot overdraw under READ COMMITTED or stale REPEATABLE READ snapshots |
| P27 | P | maximum savings/progress stay exact and aggregate overflow errors instead of truncation or zero |
| P28 | P | savings indicators and persisted balance reservations retain common snapshot across real concurrent contribution and failures stay global |
| P29 | P | complete HTTP dashboard and errors satisfy OpenAPI for two sessions and truly empty finances |
| R01 | R | reports requires a valid bearer session before inspecting the period and is private |
| R02 | R | reports rejects invalid, ambiguous and unauthorized report periods |
| R03 | R | reports aggregate exact owned posted BOB movements, category distribution, refund income and monthly historical balance |
| R04 | R | reports isolate another user and future months stop at asOf instead of projecting balances |
| D01 | D | period uses product time zone, month/year boundaries and half-open interval |
| D02 | D | period rejects malformed, duplicate, out-of-range and user identity parameters |
| C01 | C | all versioned dashboard examples satisfy the published OpenAPI JSON Schema |
| C02 | C | all versioned reports examples satisfy the published OpenAPI JSON Schema |
| C03 | C | user and security request/response examples satisfy the published OpenAPI JSON Schema |

Las pruebas de ejemplo C01–C03 complementan contrato; no reemplazan ejecución HTTP ni persistencia.

## Matriz

Los enlaces de cada bloque son las fuentes de implementación. Los nombres exactos de los tests están en la tabla anterior. Los RF existentes comparten estado NO EJECUTADO; los propuestos se señalan explícitamente como SIN CÓDIGO/SIN TEST.

### 001 — [Autenticación](../specs/001-auth-sessions/spec.md)

Fuentes: [controlador](../../src/modules/auth/auth.controller.ts), [servicio](../../src/modules/auth/auth.service.ts), [guard](../../src/modules/auth/session.guard.ts).

| RF | Fuente concreta | Test identificado | Alcance estático |
| --- | --- | --- | --- |
| 001/RF-1 | register en controlador/servicio | P02, C03 | Parcial: registro, normalización, cuerpo inválido, duplicado y apertura cero; no se localizó prueba específica de cada límite máximo ni del instante exacto de apertura local |
| 001/RF-2 | login en controlador/servicio | P01, P02 | Escenarios de credenciales, contrato estricto y sesión; bordes completos de longitud no acreditados |
| 001/RF-3 | authenticate y SessionGuard | P01, P03 | Sesión persistida, vencimiento, revocación y precedencia de autenticación; comparación exacta en el instante de expiración sin test dedicado identificado |
| 001/RF-4 | logout y DELETE session | P03 | Revocación de sesión usada y respuesta; conservación de otra sesión por logout sin test dedicado identificado |
| 001/RF-5 | changePassword | P02 | Revocación de dos sesiones, rechazo contraseña actual y nueva corta, nuevo login; máximos y carrera login/password sin test dedicado identificado |

### 002 — [Perfil](../specs/002-user-profile/spec.md)

Fuentes: [controlador](../../src/modules/users/users.controller.ts), [servicio](../../src/modules/users/users.service.ts), [entidad](../../src/modules/users/entities/user.entity.ts).

| RF | Fuente concreta | Test identificado | Alcance estático |
| --- | --- | --- | --- |
| 002/RF-1 | getProfile | P02, C03 | Consulta autenticada y forma del perfil; perfil histórico con nombre nulo sin caso HTTP dedicado identificado |
| 002/RF-2 | updateProfile y validación de PATCH | P02 | Parcial: edición de campos y rechazo de moneda; preservación de cada combinación parcial, cuerpo vacío y límites de nombre/correo sin tests dedicados identificados |
| 002/RF-3 | validación openingBalance | P02 | Parcial: acepta 125.50; cero negativo, negativo y todos los bordes del formato en PATCH sin prueba dedicada identificada |
| 002/RF-4 | updateProfile y comprobaciones de fecha | P02 | Conflicto correo, fecha inválida/futura y fecha posterior a movimiento; conflicto específico con meta sin test HTTP dedicado identificado |

### 003 — [Transacciones y categorías](../specs/003-transactions-categories/spec.md)

Fuentes: [servicios](../../src/modules/transactions/transactions.service.ts), [movimientos](../../src/modules/transactions/transactions.controller.ts), [categorías](../../src/modules/transactions/categories.controller.ts).

| RF | Fuente concreta | Test identificado | Alcance estático |
| --- | --- | --- | --- |
| 003/RF-1 | createForUser de TransactionsService | P05, P06 | Creación, contrato e integridad; no acredita todos los valores frontera de cada campo |
| 003/RF-2 | listForUser de TransactionsService | P05 | Parcial: filtros/páginas/aislamiento presentes; no se identificó caso dedicado para toda combinación y todos los empates de orden |
| 003/RF-3 | getForUser/updateForUser | P05 | Detalle, edición, ajeno y anulado; combinaciones completas de edición parcial no acreditadas |
| 003/RF-4 | voidForUser | P05 | Conservación como void y respuesta sin contenido; revisar idempotencia y ajeno en ejecución antes de certificar todo el RF |
| 003/RF-5 | list/create/update de CategoriesService | P05 | CRUD/categorías y validación; empate y comparación exacta de nombres no acreditados exhaustivamente |
| 003/RF-6 | removeForUser de CategoriesService | P05, P17 | Desasociación de movimiento y conflicto por presupuesto identificados; carrera concurrente de eliminación fuera de estos escenarios |

### 004 — [Dashboard](../specs/004-dashboard/spec.md)

Fuentes: [composición](../../src/modules/dashboard/dashboard.service.ts), [periodo](../../src/modules/dashboard/period.ts), [saldo](../../src/modules/transactions/balance.service.ts), [resumen](../../src/modules/transactions/monthly-summary.service.ts), [distribución](../../src/modules/transactions/expense-distribution.service.ts).

| RF | Fuente concreta | Test identificado | Alcance estático |
| --- | --- | --- | --- |
| 004/RF-1 | resolvePeriod | D01, D02, P04 | Periodos, formatos, parámetros extra y límites |
| 004/RF-2 | BalanceService + lector de reservas | P07, P08, P22, P24 | Acumulado, cutoff inclusivo, futuros, precisión, reservas e identidad |
| 004/RF-3 | MonthlySummaryService | P09, P10, P11 | Límites locales, vacíos, futuro, devoluciones y overflow |
| 004/RF-4 | ExpenseDistributionService | P13, P14, P15 | Vacíos, sin categoría, orden, HALF_UP, filtros y overflow |
| 004/RF-5 | getForUser y transacción compartida | P12, P16, P21, P28, P29, C01 | Snapshot concurrente y fallos por varias secciones; no afirmar cobertura de toda excepción posible |
| 004/RF-6 | composición budgets/savingsGoals | P17, P20, P23, P28, P29 | Inclusión y coherencia; depende también de 005 y 006 |

### 005 — [Presupuestos](../specs/005-budgets/spec.md)

Fuentes: [controlador](../../src/modules/budgets/budgets.controller.ts), [servicio](../../src/modules/budgets/budgets.service.ts), [migración](../../src/database/migrations/1792454400000-Budgets.ts).

| RF | Fuente concreta | Test identificado | Alcance estático |
| --- | --- | --- | --- |
| 005/RF-1 | create/list/readForUser | P17, P19, P20 | Creación/lista/mes/aislamiento; orden exacto y todos los bordes del importe sin garantía exhaustiva |
| 005/RF-2 | normalizeCreate, mapWriteError y restricciones | P17, P19 | Entrada inválida, categoría ajena y unicidad |
| 005/RF-3 | updateForUser/removeForUser | P17 | Solo limit, eliminación, ajenos/inexistentes y conflictos relacionados |
| 005/RF-4 | readForUser y ExpenseDistributionService | P18, P20, P21 | Brutos, futuros, void, refunds, sin arrastre y snapshot |
| 005/RF-5 | comparación exacta de spent/limit | P18, P20 | Umbrales exactos, progreso redondeado, excedido, vacíos y sin gastos |

### 006 — [Gestión y reservas de ahorro](../specs/006-savings/spec.md)

Fuentes: [controlador de gestión](../../src/modules/savings-goals/savings-goals.controller.ts), [metas](../../src/modules/savings-goals/savings-goals.service.ts), [reservas](../../src/modules/savings-goals/persisted-savings-reservation.reader.ts), [integridad](../../src/database/migrations/1792540800000-SavingsGoals.ts).

| RF | Fuente concreta | Test identificado | Alcance estático |
| --- | --- | --- | --- |
| 006/RF-1 | selección y orden de metas | P23, P24 | Visibilidad, vacíos, creación y archivo; empates exactos de orden sin caso dedicado identificado |
| 006/RF-2 | saved, remaining y progress | P23, P27 | Parcial/completado/excedido, precisión y overflow |
| 006/RF-3 | clasificación completed/overdue/active | P23 | Día local, hoy, ausencia de fecha y precedencia de completado |
| 006/RF-4 | PersistedSavingsReservationReader | P22, P24, P28 | Reserva única, archivo, retiro, futuro, aislamiento y snapshot |
| 006/RF-5 | restricciones y ledger_version | P25, P26 | Append-only, prefijos temporales, propietario/fechas e impedimento de sobregiro concurrente; no extiende garantías a carreras de cambio de apertura no probadas |
| 006/RF-6 | createForUser y normalizeCreate | SIN TEST dedicado identificado | Código integrado; falta test HTTP de creación, límites, fecha opcional, cuerpo estricto y contrato de metas |
| 006/RF-7 | listForUser/readManageableForUser | SIN TEST dedicado identificado | Código integrado; falta HTTP de listado con archivadas, vacío, orden y aislamiento |
| 006/RF-8 | updateForUser y normalizeUpdate | SIN TEST dedicado identificado | Código integrado; falta HTTP de edición parcial, archivo/desarchivo, ajeno y restricciones reconocidas |
| 006/RF-9 | addEntryForUser/normalizeEntry y ledger | SIN TEST HTTP dedicado; P25/P26 solo integridad interna | Falta ruta de aportes/retiros con fecha/default, campo extra, archivada, aislamiento y error; los tests SQL no acreditan status HTTP |

### 007 — [Reportes](../specs/007-reports/spec.md)

Fuentes: [periodo](../../src/modules/reports/report-period.ts), [servicio](../../src/modules/reports/reports.service.ts), [controlador](../../src/modules/reports/reports.controller.ts).

| RF | Fuente concreta | Test identificado | Alcance estático |
| --- | --- | --- | --- |
| 007/RF-1 | resolveReportPeriod | R02, R03 | Formatos, 24/25 meses calendario, duplicados y límites diarios |
| 007/RF-2 | summaries + comparison | R03, R04 | Totales exactos, devoluciones, anulados, otro titular y vacío |
| 007/RF-3 | distributions | R03, R04 | Parcial: agrupación y vacío; bordes de redondeo/orden cubiertos en servicio reutilizado por P13–P15, no repetidos todos por HTTP de reportes |
| 007/RF-4 | bucle balanceEvolution y cutoff | R03, R04 | Acumulado, vacío y futuro cubiertos por escenarios identificados; SIN TEST dedicado de omisión preapertura de cuenta nueva ni de movimiento exactamente al corte mensual |
| 007/RF-5 | SessionGuard y REPEATABLE READ | R01, R03, R04, C02 | Parcial: autenticación, privacidad, aislamiento y contrato; sin test dedicado identificado de escritura concurrente o fallo de cálculo durante el reporte |

### 008 — [Avisos internos propuestos](../specs/008-in-app-notifications/spec.md)

No hay módulo/controlador de avisos implementado ni tests existentes para estos RF. Los servicios de presupuestos/metas son fuentes reutilizables, no evidencia de una API de avisos. Tests futuros se detallan en [N1–N12](../specs/008-in-app-notifications/tasks.md), sin nombres ficticios de tests ya existentes.

| RF | Fuente concreta | Test identificado | Alcance estático |
| --- | --- | --- | --- |
| 008/RF-1 | PROPUESTO: consulta privada y periodo | SIN TEST | SIN CÓDIGO de avisos; reutilizar guard/resolvePeriod no valida la futura ruta |
| 008/RF-2 | PROPUESTO: proyectar estado de BudgetsService | SIN TEST de avisos; P18 prueba estado financiero | Umbrales existentes; contenido de notificación pendiente |
| 008/RF-3 | PROPUESTO: proyectar estado de SavingsGoalsService | SIN TEST de avisos; P23 prueba estado financiero | Política de avisos completed/overdue propuesta, no implementada |
| 008/RF-4 | PROPUESTO: identidad, mensaje, orden y total | SIN TEST | SIN CÓDIGO; contador total, no no-leídos |
| 008/RF-5 | PROPUESTO: snapshot y fallo global | SIN TEST | SIN CÓDIGO; pruebas concurrentes de dashboard no acreditan futura consulta de avisos |
| 008/RF-6 | PROPUESTO: condiciones actuales sin escrituras | SIN TEST | SIN CÓDIGO; no historial, estado leído ni entrega automática |

## Transversales y veredicto

Aprovisionamiento tiene tests en [create-user.test.cjs](../../tests/create-user.test.cjs) y pruebas production provisioning/seed en la suite P. Migraciones/upgrade/rollback están identificadas en la suite P; no están ejecutadas aquí. Health y validación de configuración no tienen test dedicado identificado en este inventario.

**Veredicto funcional: NO VERIFICADO.** Hay 40 RF de comportamiento existente con cobertura desigual, incluidos cuatro RF nuevos de gestión de metas sin test HTTP dedicado identificado, y seis RF propuestos sin código ni tests. Falta ejecutar las comprobaciones, cubrir lagunas y desarrollar 008 antes de declarar cumplimiento; el consumo de interfaz se verifica en su propia sesión. El resultado de una futura ejecución deberá registrar SHA, comando, número de tests aprobados/fallidos y requisitos afectados, sin reemplazar ausencia de prueba por inspección.
