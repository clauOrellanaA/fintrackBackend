# Plan técnico de la línea base

Fecha: 2026-10-28. Base: bf57ebcd582706ab467251baf2d875fddcbb5fa2. Rama documental: planing. Alcance: describir implementación existente; no se ordenan cambios de código ni de datos. [Specs](../README.md) · [Constitución](../constitution.md) · [Cobertura](coverage.md).

## Módulos y responsabilidades

| Parte existente | Responsabilidad y RF |
| --- | --- |
| [auth](../../src/modules/auth/auth.controller.ts) | Registro, login, logout, password y SessionGuard; 001/RF-1 a RF-5 |
| [users](../../src/modules/users/users.service.ts) | Perfil y apertura por propietario; 002/RF-1 a RF-4 |
| [transactions](../../src/modules/transactions/transactions.service.ts) | CRUD, categorías, filtros y páginas; 003/RF-1 a RF-6 |
| [dashboard](../../src/modules/dashboard/dashboard.service.ts) | Composición de cinco indicadores y único snapshot; 004/RF-1 a RF-6 |
| [balance](../../src/modules/transactions/balance.service.ts), [resumen](../../src/modules/transactions/monthly-summary.service.ts), [distribución](../../src/modules/transactions/expense-distribution.service.ts) | Consultas financieras compartidas; 004/RF-2 a RF-4, 005/RF-4, 007/RF-2 a RF-4 |
| [budgets](../../src/modules/budgets/budgets.service.ts) | Gestión y consumo mensual; 005/RF-1 a RF-5 |
| [savings-goals](../../src/modules/savings-goals/savings-goals.service.ts) y [reservas](../../src/modules/savings-goals/persisted-savings-reservation.reader.ts) | Lecturas internas, conexión con saldo; 006/RF-1 a RF-5 |
| [reports](../../src/modules/reports/reports.service.ts) | Orquesta periodo y reutiliza indicadores; 007/RF-1 a RF-5 |
| [shared](../../src/shared/money.ts), [porcentajes](../../src/shared/percentage.ts), [zona](../../src/shared/product-time.ts) | Conversión exacta, redondeo y fecha del producto; 002/RF-3 a RF-4, 004/RF-1 a RF-6, 005/RF-1 a RF-5, 006/RF-1 a RF-5, 007/RF-1 a RF-5 |

Los controladores reciben HTTP y validan o delegan; servicios aplican reglas; entidades/migraciones garantizan integridad. Dashboard/reportes componen servicios de dominio y comparten EntityManager; no duplican el cálculo de cada indicador.

## Modelo de datos existente

PostgreSQL es la persistencia real. JSON es el formato de intercambio HTTP, no un archivo de almacenamiento.

| Tabla | Datos y relaciones relevantes | RF |
| --- | --- | --- |
| users | UUID, email único, display_name nullable, password_hash no seleccionado por defecto, opening_balance exacto, opening_at y BOB | 001/RF-1 a RF-2; 002/RF-1 a RF-4 |
| sessions | token_hash SHA-256 como clave, user_id, expires_at, revoked_at nullable | 001/RF-2 a RF-5 |
| categories | UUID, propietario, nombre; unicidad propietario/nombre | 003/RF-1, RF-5 a RF-6 |
| transactions | Propietario, categoría opcional, income/expense, posted/void, importe, BOB, occurred_at, descripción opcional y refund_of_id interno | 003/RF-1 a RF-6; 004/RF-2 a RF-4; 005/RF-4; 007/RF-2 a RF-4 |
| budgets | UUID, propietario, categoría propia no nula, mes, límite, BOB; único propietario/categoría/mes | 005/RF-1 a RF-5 |
| savings_goals | UUID, propietario, nombre, objetivo, BOB, creación, fecha objetivo opcional, archivo y ledger_version | 006/RF-1 a RF-5 |
| savings_entries | UUID, meta/propietario, contribution/withdrawal, importe, BOB, instante; solo anexado | 006/RF-2 a RF-5 |

Fuentes: [entidades y migraciones registradas](../../src/database/data-source.ts), [persistencia inicial](../../src/database/migrations/1792368000000-InitialPersistence.ts), [presupuestos](../../src/database/migrations/1792454400000-Budgets.ts), [ahorros](../../src/database/migrations/1792540800000-SavingsGoals.ts), [descripción](../../src/database/migrations/1792627200000-TransactionDescription.ts) y [perfil](../../src/database/migrations/1792713600000-UserProfile.ts).

NUMERIC sin typmod más CHECK de escala/rango evita redondear entradas antes de validarlas. Las relaciones compuestas incluyen propietario para impedir asociaciones entre usuarios. Se usa synchronize=false, migraciones explícitas y transacción de migraciones. Las entradas de ahorro validan prefijos temporales por instante y actualizan versión de meta para serializar escritores.

Ejemplo de respuesta JSON ya existente de perfil (002/RF-1; no define un formato de persistencia):

    {
      "email": "persona@fintrack.test",
      "displayName": "Persona",
      "openingBalance": "125.50",
      "openingDate": "2020-01-01",
      "currency": "BOB"
    }

## Contrato HTTP observado

Prefijo por defecto /api/v1, configurable mediante API_PREFIX. Las rutas privadas usan Authorization: Bearer con token opaco; la identidad no se recibe desde cuerpos o filtros de negocio. Respuestas privadas y errores: Cache-Control: no-store. Consultar schemas para campos completos.

| Rutas bajo el prefijo | Entrada y salida principal | RF |
| --- | --- | --- |
| POST /auth/register → 201 | email, password, displayName → accessToken, tokenType=Bearer, expiresAt | 001/RF-1 |
| POST /auth/login → 200 | email, password → misma sesión de respuesta | 001/RF-2 a RF-3 |
| DELETE /auth/session → 204 | Sesión válida; sin cuerpo de respuesta | 001/RF-4 |
| POST /auth/password → 204 | currentPassword, newPassword; revoca todas las sesiones | 001/RF-5 |
| GET /users/me → 200; PATCH /users/me → 200 | Perfil; edición parcial de displayName/email/openingBalance/openingDate | 002/RF-1 a RF-4 |
| GET/POST /transactions → 200/201 | Filtros from/to/type/status/q/page/pageSize; crear type/amount/categoryId?/occurredAt/description? | 003/RF-1 a RF-2 |
| GET/PATCH/DELETE /transactions/{id} → 200/200/204 | Detalle, campos editables de creación, anulación | 003/RF-3 a RF-4 |
| GET/POST /categories → 200/201; PATCH/DELETE /categories/{id} → 200/204 | Listado; name en escritura; eliminación condicionada | 003/RF-5 a RF-6 |
| GET /dashboard → 200 | month? → period, currency, asOf, sections con cinco status=ready/data | 004/RF-1 a RF-6 |
| GET/POST /budgets → 200/201 | month? al listar; categoryId, month, limit al crear; respuesta con consumo | 005/RF-1 a RF-2, RF-4 a RF-5 |
| PATCH/DELETE /budgets/{id} → 200/204 | Solo limit al actualizar; sin contenido al eliminar | 005/RF-3 |
| Sin rutas propias de ahorro | Datos internos; salida sections.savingsGoals y descuento en saldo | 006/RF-1 a RF-5 |
| GET /reports → 200 | from/to YYYY-MM-DD → period, currency, asOf, comparison, expenseDistribution, balanceEvolution | 007/RF-1 a RF-5 |

Contratos existentes: [usuarios/auth](../openapi/users.v1.json), [transacciones/categorías](../openapi/transactions.v1.json), [dashboard](../openapi/dashboard.v1.json), [presupuestos](../openapi/budgets.v1.json) y [reportes](../openapi/reports.v1.json).

Errores: envelope error.code/message. Auth: 400 INVALID_REQUEST, 409 EMAIL_ALREADY_REGISTERED, 401 INVALID_CREDENTIALS/UNAUTHENTICATED/INVALID_CURRENT_PASSWORD. Perfil: 400 INVALID_REQUEST/INVALID_PROFILE y 409 INVALID_OPENING_DATE/OPENING_DATE_CONFLICT/EMAIL_ALREADY_REGISTERED. Movimientos/categorías/presupuestos: 400 INVALID_REQUEST, 404 NOT_FOUND y 409 CONFLICT; periodo de presupuesto inválido usa INVALID_PERIOD. Dashboard: 400 INVALID_PERIOD. Reportes: 400 INVALID_REPORT_PERIOD. Cálculos financieros: 422 DATA_OUT_OF_RANGE y 500 DATA_INTEGRITY_ERROR donde se comprueba integridad. El [filtro global](../../src/shared/filters/api-exception.filter.ts) traduce fallos de conectividad reconocidos a 503 DATA_UNAVAILABLE y oculta excepciones no clasificadas como 500 INTERNAL_ERROR; no prometer un código de dominio para toda violación SQL.

## Algoritmos en pseudocódigo descriptivo

- **Sesión (001/RF-1 a RF-5):** en registro, validar/normalizar entrada → calcular hash scrypt de contraseña → abrir transacción e insertar cuenta → generar 32 bytes aleatorios como token base64url → guardar sesión con SHA-256 del token y vencimiento a ocho horas. En login, validar entrada y normalizar correo → verificar contraseña contra el hash existente → abrir transacción, bloquear usuario y comprobar que el hash verificado sigue vigente → generar token → guardar su hash y sesión, sin crear cuenta ni sustituir el hash de contraseña. Al autenticar una solicitud: buscar hash de token no revocado con vencimiento estrictamente posterior al instante actual. Logout revoca una sesión; cambio de contraseña bloquea usuario, comprueba versión de hash, guarda la nueva contraseña hasheada y revoca todas sus sesiones.
- **Perfil (002/RF-1 a RF-4):** obtener titular de sesión → validar campos parciales → convertir fecha local al inicio de día → escribir → traducir conflictos de unicidad/integridad reconocidos → volver a leer perfil.
- **Historial (003/RF-1 a RF-6):** validar filtros → restringir por propietario → aplicar [from,to), tipo/estado y búsqueda literal normalizada → ordenar fecha/id descendentes → paginar. Anular cambia status a void; eliminar categoría sin presupuestos pone referencias de movimientos a null dentro de transacción.
- **Saldo (004/RF-2; 006/RF-4):** partir de apertura → sumar ingresos posted y restar gastos posted desde apertura hasta corte inclusivo → restar reservas efectivas una sola vez → validar y serializar dos decimales.
- **Actividad (004/RF-3 a RF-4; 005/RF-4; 007/RF-2 a RF-3):** resolver [inicio,fin) local → seleccionar solo movimientos propios/BOB/posted → sumar ingresos y gastos brutos por separado → agrupar gastos por categoría → calcular porcentajes con enteros/BigInt y HALF_UP independiente → aplicar orden estable.
- **Presupuesto (005/RF-4 a RF-5):** consumo = gasto bruto de categoría/mes → restante = límite − consumo → progreso = HALF_UP(consumo/límite × 100) → estado por comparación exacta: normal <80, warning desde 80 hasta 100, exceeded >100.
- **Ahorro (006/RF-1 a RF-5):** seleccionar metas creadas hasta corte no archivadas a ese corte → acumulado = aportes − retiros efectivos → restante = max(objetivo − acumulado,0) → estado completed si alcanza objetivo; si no, overdue solo ante fecha anterior al día local; resto active. La reserva recorre también metas archivadas.
- **Composición (004/RF-5 a RF-6; 007/RF-4 a RF-5):** fijar asOf una vez → abrir REPEATABLE READ → compartir EntityManager → calcular secciones → fallar todo ante excepción. En reportes, iterar meses abarcados y calcular saldo al mínimo entre próximo inicio mensual y asOf; el corte del saldo sigue siendo inclusivo aunque el intervalo de actividad sea semiabierto.

## Decisiones observables y alternativas comparadas

Estas son razones técnicas verificables hoy, no actas históricas de elección. Las alternativas no se atribuyen al equipo como decisiones pasadas.

| Estado existente y razón observable | Alternativa comparada, no adoptada en este plan | RF |
| --- | --- | --- |
| Mantener stack y runner node:test ya instalados evita introducir otro entorno | Python/CLI/pytest del ejemplo educativo | Todos |
| PostgreSQL y migraciones conservan datos y validan relaciones de propietario | JSON en disco carece de las restricciones transaccionales existentes | 001, 002, 003, 005, 006 |
| NUMERIC y BigInt mantienen centavos/porcentajes exactos | Punto flotante para dinero puede alterar bordes | 002/RF-3; 004/RF-2 a RF-4; 005/RF-4 a RF-5; 006/RF-2 a RF-4; 007/RF-2 a RF-4 |
| Sesiones opacas persistidas permiten revocación comprobada | JWT sin consulta de revocación no equivale al contrato actual | 001/RF-2 a RF-5 |
| Servicios de indicadores reutilizados y snapshot compartido evitan cifras de versiones diferentes | Consultas independientes por sección pierden coherencia | 004/RF-5 a RF-6; 007/RF-5 |
| Siete specs y un plan/tareas/matriz compartidos mantienen adopción pequeña | Duplicar plantillas completas por cada endpoint aumenta mantenimiento | Todos |

## Capacidades transversales observadas

[HealthController](../../src/health.controller.ts) expone GET /health (status ok y service fintrack-api) y GET /health/ready con comprobación SELECT 1 mediante [DatabaseService](../../src/database/database.service.ts). [environment](../../src/config/environment.ts) valida puerto, prefijo, origen CORS y URL PostgreSQL. [user:create](../../src/database/create-user.ts) aprovisiona usuarios por operación administrativa; convive con registro público. Las pruebas de aprovisionamiento sí están identificadas; no se identificaron tests dedicados de health/configuración en el inventario actual. No se crea una promesa de cobertura inexistente.

## Estrategia de tests y comprobación

Reutilizar node:test y los tests existentes. [coverage.md](coverage.md) vincula cada RF con código y prueba concreta, distingue cobertura parcial y registra ausencia. No añadir tests para documentos ni reconstruir funcionalidades.

Ante una futura auditoría funcional autorizada: instalar dependencias con lockfile en el worktree; npm run lint, npm run typecheck y npm run build; npm test ejecuta build y todos los tests. Revisar [package.json](../../package.json) y [CI](../../.github/workflows/ci.yml) antes de ejecutar. PostgreSQL 17 debe ser aislado; TEST_DATABASE_URL debe apuntar a la base dedicada fintrack_be01_test con rol CREATEDB. Las suites crean y eliminan bases temporales propias; no usar la base local del usuario ni la de producción. No mostrar credenciales en los resultados.

Pruebas de periodos y aprovisionamiento cargan dist, por lo que requieren compilación previa. Los tests de contrato validan schemas/ejemplos; no acreditan HTTP ni PostgreSQL por sí solos. La suite HTTP/persistencia cubre autenticación, CRUD, cálculos y escenarios concurrentes; reportes tiene su suite independiente. Registrar SHA, comando, resultado, alcance y omisiones. Las mediciones de benchmark requieren su propia ejecución y no sustituyen tests funcionales.

En esta entrega se inspeccionan fuentes y se revisa documentación; no se ejecutan suites funcionales, migraciones, seeds ni benchmark.
