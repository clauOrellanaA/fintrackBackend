# Matriz de trazabilidad RF–implementación–test

Código/tests/OpenAPI validados: 4bea0d915c4197346cdba7b040016b23edb00752. Base de feature: 34d6b323be89932b7f27a288ef76fc454c8f3730. Fecha: 2026-10-30, America/La_Paz. [Specs](../README.md) · [Plan](plan.md) · [Tareas](tasks.md) · [Entrega](../be-specs-delivery.md).

**Q1 — QA histórica previa al commit:** lint, tipos, build y npm.cmd test aprobados; PostgreSQL 17 dedicado, 82 aprobadas, 0 fallidas/canceladas/omitidas/todo; 50.526 s. Su huella byte archivada no se presenta como identidad del commit. Se registró una corrección editorial de línea blanca EOF en core-specs-http.test.cjs, sin cambiar assertions ni comportamiento, sin atribuirle equivalencia de huellas.

**Q2 — Confirmación del commit exacto 4bea0d915c4197346cdba7b040016b23edb00752:** npm.cmd test (incluye build), código 0; 82 aprobadas, 0 fallidas/canceladas/omitidas/todo; 48545.8117 ms (48.546 s). QA verificó HEAD y ausencia de cambios en src, tests y docs/openapi antes y después. Las 46 filas remiten a pruebas incluidas en Q2; lint y tipos previos de Q1 siguen aprobados.

## Pruebas ejecutadas

Los códigos remiten a nombres literales del runner. Pruebas de ejemplos complementan HTTP/PostgreSQL, no las sustituyen.

| Código | Archivo | Nombre literal del test |
| --- | --- | --- |
| P01 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | credentials, strict login body, no-store and hashed session persistence |
| P02 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | registration, owned profile updates and password change revoke all sessions |
| P03 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | HTTP guard rejects missing/malformed/expired/revoked session before validating period |
| P04 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | authenticated dashboard validates query and serves balance, summary and expense distribution |
| P05 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | transaction and category HTTP APIs validate contracts, isolate owners, filter pages, and void instead of deleting |
| P06 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | schema rejects cross-user categories/refunds, bad decimals, invalid opening and inconsistent updates |
| P07 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | balance accumulates opening and previous months, filters void/future, includes cutoff and isolates owners |
| P08 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | balance preserves explicit openings, negative/fractional and maximum precision, rejects missing/future opening and overflow |
| P09 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | monthly summary uses half-open IANA month boundaries through year, leap and historical offsets |
| P10 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | monthly HTTP isolates users, returns successful empty zeros and includes future posted within selected period independently of balance |
| P11 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | monthly summary preserves gross refunds, exact maxima and rejects overflowing totals even when balance nets to zero |
| P12 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | dashboard shares one snapshot despite concurrent writes and aborts summary failures without partial balance or synthetic zeros |
| P13 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | expense distribution handles empty, income-only, single and equal categories including null and long names in stable order |
| P14 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | distribution percentages use exact HALF_UP independently, preserve amount order, extremes and aggregate overflow |
| P15 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | distribution shares monthly filters including IANA boundaries, future posted, void exclusion and ownership |
| P16 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | distribution and summary retain same snapshot across concurrent commit, and distribution failure aborts all sections |
| P17 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | budget management authenticates, validates input and isolates CRUD by owner and month |
| P18 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | budgets classify exact 0/80/100/exceeded thresholds before rounding and preserve negative remaining and progress over100 |
| P19 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | budget schema rejects invalid limits, periods, null/cross-owner categories, currency and duplicate owner-category-month |
| P20 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | budget HTTP uses monthly gross expense API including future/void/refunds, no rollover, no budgets and user isolation |
| P21 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | budget consumption retains common snapshot after concurrent expense and budget failures abort globally |
| P22 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | persisted savings reserve produces D03 balance2420.05 exactly once without affecting income or expense and isolates users |
| P23 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | goals classify empty, partial, completed, exceeded and overdue using local day, with completion precedence and real progress |
| P24 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | archival only hides goals while persisted reserve remains, withdrawal releases it, future entries and creation respect cutoff |
| P25 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | savings schema rejects invalid target/entries/dates/owner and enforces append-only, effective prefixes and opening integrity |
| P26 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | concurrent withdrawals cannot overdraw under READ COMMITTED or stale REPEATABLE READ snapshots |
| P27 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | maximum savings/progress stay exact and aggregate overflow errors instead of truncation or zero |
| P28 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | savings indicators and persisted balance reservations retain common snapshot across real concurrent contribution and failures stay global |
| P29 | [persistence-http.test.cjs](../../tests/persistence-http.test.cjs) | complete HTTP dashboard and errors satisfy OpenAPI for two sessions and truly empty finances |
| R01 | [reports-http.test.cjs](../../tests/reports-http.test.cjs) | reports requires a valid bearer session before inspecting the period and is private |
| R02 | [reports-http.test.cjs](../../tests/reports-http.test.cjs) | reports rejects invalid, ambiguous and unauthorized report periods |
| R03 | [reports-http.test.cjs](../../tests/reports-http.test.cjs) | reports aggregate exact owned posted BOB movements, category distribution, refund income and monthly historical balance |
| R04 | [reports-http.test.cjs](../../tests/reports-http.test.cjs) | reports isolate another user and future months stop at asOf instead of projecting balances |
| D01 | [period.test.cjs](../../tests/period.test.cjs) | period uses product time zone, month/year boundaries and half-open interval |
| D02 | [period.test.cjs](../../tests/period.test.cjs) | period rejects malformed, duplicate, out-of-range and user identity parameters |
| C01 | [contract.test.cjs](../../tests/contract.test.cjs) | all versioned dashboard examples satisfy the published OpenAPI JSON Schema |
| C02 | [contract.test.cjs](../../tests/contract.test.cjs) | all versioned reports examples satisfy the published OpenAPI JSON Schema |
| C03 | [contract.test.cjs](../../tests/contract.test.cjs) | user and security request/response examples satisfy the published OpenAPI JSON Schema |
| R05 | [reports-http.test.cjs](../../tests/reports-http.test.cjs) | reports omit months before opening including equal month-end and retain empty months after opening |
| R06 | [reports-http.test.cjs](../../tests/reports-http.test.cjs) | reports retain one PostgreSQL snapshot while a concurrent movement commits between sources |
| R07 | [reports-http.test.cjs](../../tests/reports-http.test.cjs) | reports fail globally with the error envelope when any financial source fails |
| C04 | [contract.test.cjs](../../tests/contract.test.cjs) | savings management request and response schemas are loaded independently from dashboard names |
| C05 | [contract.test.cjs](../../tests/contract.test.cjs) | all versioned notification examples satisfy their published OpenAPI JSON Schema |
| K01 | [core-specs-http.test.cjs](../../tests/core-specs-http.test.cjs) | 001 registration accepts exact field maxima, normalizes identity and opens empty finances on the local day |
| K02 | [core-specs-http.test.cjs](../../tests/core-specs-http.test.cjs) | 001 registration and login reject every out-of-range field without exposing credential differences |
| K03 | [core-specs-http.test.cjs](../../tests/core-specs-http.test.cjs) | 001 logout revokes only its own session while a second session remains usable |
| K04 | [core-specs-http.test.cjs](../../tests/core-specs-http.test.cjs) | 001 authentication rejects the exact expiry instant and accepts one millisecond before it |
| K05 | [core-specs-http.test.cjs](../../tests/core-specs-http.test.cjs) | 001 password length boundaries preserve invalid changes and revoke all sessions after accepted changes |
| K06 | [core-specs-http.test.cjs](../../tests/core-specs-http.test.cjs) | 002 profile handles historical null names and preserves every field during single-field updates |
| K07 | [core-specs-http.test.cjs](../../tests/core-specs-http.test.cjs) | 002 invalid partial profiles are atomic and retain their prior values |
| K08 | [core-specs-http.test.cjs](../../tests/core-specs-http.test.cjs) | 002 opening dates reject future, impossible days and historical goals while retaining email ownership |
| K09 | [core-specs-http.test.cjs](../../tests/core-specs-http.test.cjs) | 003 history pagination resolves timestamp ties by id and retains literal case-insensitive text filtering |
| K10 | [core-specs-http.test.cjs](../../tests/core-specs-http.test.cjs) | 003 transaction boundaries, partial edits and repeated void preserve the original owned record |
| K11 | [core-specs-http.test.cjs](../../tests/core-specs-http.test.cjs) | 003 categories compare exact names and enforce boundary lengths across owners |
| K12 | [core-specs-http.test.cjs](../../tests/core-specs-http.test.cjs) | 005 budgets preserve exact extrema, category order and deletion semantics |
| G01 | [savings-goals-http.test.cjs](../../tests/savings-goals-http.test.cjs) | savings management authenticates every route before validating bodies |
| G02 | [savings-goals-http.test.cjs](../../tests/savings-goals-http.test.cjs) | savings create validates strict boundaries and defaults with the management OpenAPI |
| G03 | [savings-goals-http.test.cjs](../../tests/savings-goals-http.test.cjs) | savings listing includes archived goals in stable creation order and isolates owners |
| G04 | [savings-goals-http.test.cjs](../../tests/savings-goals-http.test.cjs) | savings partial editing preserves fields, rejects invalid bodies and enforces ownership |
| G05 | [savings-goals-http.test.cjs](../../tests/savings-goals-http.test.cjs) | savings HTTP ledger changes reservations exactly once and archival preserves funds |
| G06 | [savings-goals-http.test.cjs](../../tests/savings-goals-http.test.cjs) | savings explicit future entry retains its timestamp and has no current financial effect |
| U01 | [notifications.test.cjs](../../tests/notifications.test.cjs) | notifications project exact source states rather than rounded percentages |
| U02 | [notifications.test.cjs](../../tests/notifications.test.cjs) | notifications project completed and overdue goals with exact values, stable identity and deduplication |
| U03 | [notifications.test.cjs](../../tests/notifications.test.cjs) | notifications composition shares RR manager and one injected instant across local midnight and month change |
| U04 | [notifications.test.cjs](../../tests/notifications.test.cjs) | notifications reject invalid period before reading sources and propagate each source failure |
| H01 | [notifications-http.test.cjs](../../tests/notifications-http.test.cjs) | notifications HTTP authenticates before query validation and enforces private period contract |
| H02 | [notifications-http.test.cjs](../../tests/notifications-http.test.cjs) | notifications PostgreSQL uses exact 80 and 100 thresholds despite rounded percentages and future posted spending |
| H03 | [notifications-http.test.cjs](../../tests/notifications-http.test.cjs) | notifications PostgreSQL prioritizes completed goals, excludes today, archived and future goals, and GET never writes |
| H04 | [notifications-http.test.cjs](../../tests/notifications-http.test.cjs) | notifications reevaluate a completed overdue goal after withdrawal without changing income or expense |
| H05 | [notifications-http.test.cjs](../../tests/notifications-http.test.cjs) | notifications keep one PostgreSQL snapshot during committed budget and savings changes between sources |
| H06 | [notifications-http.test.cjs](../../tests/notifications-http.test.cjs) | notifications abort globally on failure of either public financial source |
| T01 | [transactions-regression-http.test.cjs](../../tests/transactions-regression-http.test.cjs) | transactions reject an explicitly empty type instead of silently ignoring the filter |
| T02 | [transactions-regression-http.test.cjs](../../tests/transactions-regression-http.test.cjs) | transactions reject empty category UUID before writing while omitted and null categories remain valid |

## Matriz de los 46 RF

Q2: PASS en todas las filas, dentro del alcance descrito. No se afirma cobertura exhaustiva de todas las combinaciones ni de toda carrera posible.

### 001 — [Autenticación](../specs/001-auth-sessions/spec.md)

Fuentes: [controlador](../../src/modules/auth/auth.controller.ts), [servicio](../../src/modules/auth/auth.service.ts) y [guard](../../src/modules/auth/session.guard.ts).

| RF | Fuente concreta | Tests ejecutados | Alcance verificado | Resultado |
| --- | --- | --- | --- | --- |
| 001/RF-1 | register | P02, C03, K01, K02 | Normalización, formatos, límites exactos y apertura al día local | Q2: PASS |
| 001/RF-2 | login | P01, P02, K02 | Credenciales indistinguibles, cuerpo estricto y límites | Q2: PASS |
| 001/RF-3 | authenticate / SessionGuard | P01, P03, K04 | Sesión persistida, revocación y expiración exacta | Q2: PASS |
| 001/RF-4 | logout | P03, K03 | Revoca una sesión y conserva otra | Q2: PASS |
| 001/RF-5 | changePassword | P02, K05 | Límites, contraseña actual y revocación de todas las sesiones | Q2: PASS |

### 002 — [Perfil](../specs/002-user-profile/spec.md)

Fuentes: [controlador](../../src/modules/users/users.controller.ts), [servicio](../../src/modules/users/users.service.ts) y [entidad](../../src/modules/users/entities/user.entity.ts).

| RF | Fuente concreta | Tests ejecutados | Alcance verificado | Resultado |
| --- | --- | --- | --- | --- |
| 002/RF-1 | getProfile | P02, C03, K06 | Perfil propio y nombre histórico nulo | Q2: PASS |
| 002/RF-2 | updateProfile | P02, K06, K07 | Preservación parcial, cuerpo vacío/extra y límites | Q2: PASS |
| 002/RF-3 | openingBalance | P02, K06, K07 | Negativos, -0.00, máximos, escala y formatos | Q2: PASS |
| 002/RF-4 | fecha / conflictos | P02, K08 | Fecha futura/imposible, movimientos/metas y correo ajeno | Q2: PASS |

### 003 — [Transacciones y categorías](../specs/003-transactions-categories/spec.md)

Fuentes: [servicios](../../src/modules/transactions/transactions.service.ts), [movimientos](../../src/modules/transactions/transactions.controller.ts) y [categorías](../../src/modules/transactions/categories.controller.ts).

| RF | Fuente concreta | Tests ejecutados | Alcance verificado | Resultado |
| --- | --- | --- | --- | --- |
| 003/RF-1 | createForUser | P05, P06, K10, T02 | Límites, cuerpo estricto y UUID vacío rechazado antes de escribir | Q2: PASS |
| 003/RF-2 | listForUser | P05, K09, T01 | Empates, páginas, búsqueda literal, filtros repetidos y type vacío | Q2: PASS |
| 003/RF-3 | getForUser / updateForUser | P05, K10 | Detalle, edición parcial, ajenos y anulados | Q2: PASS |
| 003/RF-4 | voidForUser | P05, K10 | Anulación conservada, idempotencia y ajeno | Q2: PASS |
| 003/RF-5 | CategoriesService list/create/update | P05, K11 | Nombres exactos, límites, orden y propietario | Q2: PASS |
| 003/RF-6 | CategoriesService.removeForUser | P05, P17 | Desasociación y conflicto por presupuesto | Q2: PASS |

### 004 — [Dashboard](../specs/004-dashboard/spec.md)

Fuentes: [composición](../../src/modules/dashboard/dashboard.service.ts), [periodo](../../src/modules/dashboard/period.ts), [saldo](../../src/modules/transactions/balance.service.ts), [resumen](../../src/modules/transactions/monthly-summary.service.ts) y [distribución](../../src/modules/transactions/expense-distribution.service.ts).

| RF | Fuente concreta | Tests ejecutados | Alcance verificado | Resultado |
| --- | --- | --- | --- | --- |
| 004/RF-1 | resolvePeriod | D01, D02, P04 | Mes local, formatos, parámetros extra y límites | Q2: PASS |
| 004/RF-2 | BalanceService / reservas | P07, P08, P22, P24 | Acumulado, corte inclusivo, reservas, futuros y precisión | Q2: PASS |
| 004/RF-3 | MonthlySummaryService | P09, P10, P11 | IANA, vacío, futuro, devoluciones y overflow | Q2: PASS |
| 004/RF-4 | ExpenseDistributionService | P13, P14, P15 | Sin categoría, orden, porcentajes y overflow | Q2: PASS |
| 004/RF-5 | getForUser / RR | P12, P16, P21, P28, P29, C01 | Snapshot concurrente y fallo global | Q2: PASS |
| 004/RF-6 | composición budgets/savingsGoals | P17, P20, P23, P28, P29 | Cinco secciones y coherencia de indicadores | Q2: PASS |

### 005 — [Presupuestos](../specs/005-budgets/spec.md)

Fuentes: [controlador](../../src/modules/budgets/budgets.controller.ts), [servicio](../../src/modules/budgets/budgets.service.ts) y [migración](../../src/database/migrations/1792454400000-Budgets.ts).

| RF | Fuente concreta | Tests ejecutados | Alcance verificado | Resultado |
| --- | --- | --- | --- | --- |
| 005/RF-1 | create/list/readForUser | P17, P19, P20, K12 | Mes, límites exactos, orden y aislamiento | Q2: PASS |
| 005/RF-2 | normalización / restricciones | P17, P19, K12 | Entrada inválida, categoría propia y unicidad | Q2: PASS |
| 005/RF-3 | updateForUser / removeForUser | P17, K12 | Solo limit, ajeno/inexistente y eliminación repetida | Q2: PASS |
| 005/RF-4 | readForUser / gastos | P18, P20, P21 | Brutos, futuros, void, refunds, sin arrastre y snapshot | Q2: PASS |
| 005/RF-5 | comparación exacta | P18, P20 | Umbrales 0/80/100/exceso y progreso antes del redondeo | Q2: PASS |

### 006 — [Gestión y reservas de ahorro](../specs/006-savings/spec.md)

Fuentes: [controlador](../../src/modules/savings-goals/savings-goals.controller.ts), [servicio](../../src/modules/savings-goals/savings-goals.service.ts), [reservas](../../src/modules/savings-goals/persisted-savings-reservation.reader.ts) y [migración](../../src/database/migrations/1792540800000-SavingsGoals.ts).

| RF | Fuente concreta | Tests ejecutados | Alcance verificado | Resultado |
| --- | --- | --- | --- | --- |
| 006/RF-1 | selección / orden | P23, P24, G03 | Visibilidad, vacío, creación/archivo y orden de gestión | Q2: PASS |
| 006/RF-2 | saved / remaining / progress | P23, P27, G05 | Parcial, completada, excedida, precisión y overflow | Q2: PASS |
| 006/RF-3 | estado completed/overdue/active | P23, G02, H03 | Día local, hoy y prioridad de completada | Q2: PASS |
| 006/RF-4 | PersistedSavingsReservationReader | P22, P24, P28, G05, G06 | Reserva única, archivo, retiro, futuro y snapshot | Q2: PASS |
| 006/RF-5 | restricciones / ledger_version | P25, P26, G05 | Append-only, prefijos temporales y retiros concurrentes sin sobregiro | Q2: PASS |
| 006/RF-6 | createForUser / normalizeCreate | C04, G01, G02 | HTTP privado, defaults, límites, fecha opcional, cuerpo y contrato | Q2: PASS |
| 006/RF-7 | listForUser / readManageableForUser | G01, G03 | HTTP vacío/archivadas, orden y aislamiento | Q2: PASS |
| 006/RF-8 | updateForUser / normalizeUpdate | G01, G04, G05 | Edición parcial, archivo/desarchivo, ajeno y reserva conservada | Q2: PASS |
| 006/RF-9 | addEntryForUser / normalizeEntry | G01, G05, G06, P25, P26 | HTTP fechas/default/futuro, importes, archivada, ajeno e insuficiencia | Q2: PASS |

### 007 — [Reportes](../specs/007-reports/spec.md)

Fuentes: [periodo](../../src/modules/reports/report-period.ts), [servicio](../../src/modules/reports/reports.service.ts) y [controlador](../../src/modules/reports/reports.controller.ts).

| RF | Fuente concreta | Tests ejecutados | Alcance verificado | Resultado |
| --- | --- | --- | --- | --- |
| 007/RF-1 | resolveReportPeriod | R02, R03 | Formatos, 24/25 meses, duplicados y límites diarios | Q2: PASS |
| 007/RF-2 | summaries / comparison | R03, R04 | Totales exactos, devoluciones, anulados, ajeno y vacío | Q2: PASS |
| 007/RF-3 | distributions | R03, R04, P13, P14, P15 | Agrupación del rango; bordes comunes probados en servicio reutilizado | Q2: PASS |
| 007/RF-4 | balanceEvolution / cutoff | R03, R04, R05 | Preapertura, igualdad fin/apertura, rango cruzado, vacío y corte exacto | Q2: PASS |
| 007/RF-5 | SessionGuard / RR | R01, R06, R07, C02 | Privacidad, snapshot concurrente real y fallo global de tres fuentes | Q2: PASS |

### 008 — [Avisos internos](../specs/008-in-app-notifications/spec.md)

Fuentes: [controlador](../../src/modules/notifications/notifications.controller.ts), [composición](../../src/modules/notifications/notifications.service.ts), [proyección](../../src/modules/notifications/notification-projection.ts) y [OpenAPI](../openapi/notifications.v1.json).

| RF | Fuente concreta | Tests ejecutados | Alcance verificado | Resultado |
| --- | --- | --- | --- | --- |
| 008/RF-1 | SessionGuard / resolvePeriod | H01, U03, U04 | Consulta privada, mes actual coherente, inválidos y no-store | Q2: PASS |
| 008/RF-2 | proyección de BudgetsService | U01, H02 | Umbrales exactos 80/100/exceso frente a redondeo y posted futuro | Q2: PASS |
| 008/RF-3 | proyección de SavingsGoalsService | U02, H03, H04 | Completed/overdue, hoy, archivo, futuro y retiro que cambia estado | Q2: PASS |
| 008/RF-4 | projectNotifications | U02, H02, H03, C05 | Identidad, mensaje exacto español, deduplicación, orden y total | Q2: PASS |
| 008/RF-5 | RR / único asOf / propagación | U03, U04, H05, H06 | Medianoche, manager compartido, escritura concurrente y fallo de cada fuente | Q2: PASS |
| 008/RF-6 | lectura sin persistencia | U02, H03, H04 | GET repetido no modifica tablas y reevalúa condiciones actuales | Q2: PASS |

## Límites y veredicto

Los ocho specs tienen implementación y escenarios ejecutados por cada RF; A1 se cierra para este SHA y ejecución local. No se acreditan garantías concurrentes adicionales al cambiar apertura frente a entradas, pruebas de toda carrera login/password o eliminación concurrente de categoría, ni cada combinación posible de filtros. Esas garantías adicionales no se incorporan como requisitos de producto.

Aprovisionamiento y migraciones/upgrade/rollback se ejecutaron en la suite completa. Health y validación de configuración no tienen prueba dedicada en este inventario y no forman parte de los 46 RF. No se ejecutó benchmark nuevo ni CI remota; no hubo merge ni despliegue. La presentación/consumo de avisos se entrega a otra sesión mediante contrato, sin acceder a esa capa.

No se conserva evidencia de una secuencia roja previa para las tareas de pruebas de 008: los resultados acreditan aceptación funcional actual, no TDD histórico. Las ejecuciones parciales de autores y corrección del helper se distinguen de Q1 y de la confirmación Q2 en la entrega.
