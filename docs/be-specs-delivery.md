# BE-SPECS — Cierre de specs del backend

Fecha: 2026-10-30, America/La_Paz. Rama feature/be-specs-completion; worktree C:/fintrack/worktrees/backend/be-specs-completion. Base origin/dev: 34d6b323be89932b7f27a288ef76fc454c8f3730. Código/tests/OpenAPI: 4bea0d915c4197346cdba7b040016b23edb00752. El coordinador es el único responsable de Git.

## Comportamiento entregado

- 003 rechaza type vacío y categoryId vacío con 400 INVALID_REQUEST antes de consultar sin filtro o insertar un UUID inválido.
- 006 conserva su API y añade pruebas de contrato y gestión HTTP de metas, archivo, aportes y retiros.
- 007 conserva la omisión preapertura y añade regresiones de apertura/corte, snapshot concurrente y fallo global.
- 008 implementa consulta privada de avisos actuales desde estados financieros existentes; sin persistencia, nuevas migraciones ni jobs.
- A1 traza los 46 RF de ocho specs a pruebas ejecutadas; [la matriz](sdd/coverage.md) delimita cada escenario.

## Validación local independiente

QA ejecutó contra PostgreSQL 17.11 (postgres:17-alpine), en el contenedor exclusivo fintrack-be-specs-test-20261030 con puerto local 55439 y datos descartables:

| Comando | Resultado |
| --- | --- |
| npm.cmd run lint | Aprobado, código 0 |
| npm.cmd run typecheck | Aprobado, código 0 |
| npm.cmd run build | Aprobado, código 0 |
| npm.cmd test (Q1, histórico previo al commit) | 82 aprobadas; 0 fallidas/canceladas/omitidas/todo; 50.526 s |
| npm.cmd test (Q2, confirmación del commit exacto) | 82 aprobadas; 0 fallidas/canceladas/omitidas/todo; 48.546 s; código 0 |
| Estructura CI, ausencia de .env rastreado y comprobaciones de diff | Aprobadas |
| docker --context desktop-linux compose --env-file .env.example config --quiet | Aprobado por el coordinador |

Para reproducir, instalar dependencias con npm ci y configurar exclusivamente una instancia de pruebas dedicada:

    $env:TEST_DATABASE_URL = 'postgresql://USUARIO_PRUEBAS:CONTRASENA_PRUEBAS@127.0.0.1:PUERTO_PRUEBAS/fintrack_be01_test'
    npm.cmd run lint
    npm.cmd run typecheck
    npm.cmd run build
    npm.cmd test

El rol necesita CREATEDB. Las suites crean bases propias; las nuevas conservan datos en la instancia descartable hasta retirarla. El contenedor puede tener un volumen anónimo propio: el coordinador detiene y retira exclusivamente ese contenedor y su volumen al terminar. No se usa ni modifica la base local del usuario.

Q1 es evidencia histórica verdadera del árbol de trabajo previo al commit; su huella byte archivada no se utiliza como identidad del commit. Se registró una corrección editorial de línea blanca EOF en core-specs-http.test.cjs, sin cambiar assertions ni comportamiento; no se atribuye a ella equivalencia de huellas.

**Q2 confirmó directamente el commit 4bea0d915c4197346cdba7b040016b23edb00752:** npm.cmd test (incluye build), código 0; 82/82 aprobadas, 0 fallidas/canceladas/omitidas/todo; 48545.8117 ms (48.546 s). QA comprobó HEAD y git diff de src, tests y docs/openapi sin cambios antes y después. Lint y tipos aprobados en Q1 siguen como comprobaciones previas; Q2 elimina la dependencia de su huella para acreditar el código final.

La revisión independiente inspeccionó producción, OpenAPI y todas las pruebas nuevas sin hallazgos de código bloqueantes. Ejecuciones de autores: la primera corrida de 30 casos dio 28 aprobados y 2 fallos del helper; tras corregir la selección de documento de contrato se repitieron los 11 casos afectados con éxito. Core ejecutó 12/12. Q1 volvió a ejecutar todo junto y obtuvo 82/82.

Las casillas acreditan aceptación funcional actual. No se conservó evidencia de secuencia roja previa en N1/N2/N4/N6; no se acredita TDD histórico. No se afirman cobertura exhaustiva de toda combinación/carrera, garantías adicionales del cambio concurrente de apertura, un benchmark nuevo, CI remota, merge ni despliegue. La publicación y sus SHA remoto/local los informa el coordinador tras verificar Git.

## Contrato para la interfaz

Contrato versionado: [notifications.v1.json](openapi/notifications.v1.json). GET /api/v1/notifications?month=YYYY-MM; month opcional entre 1900-01 y 9998-12. Bearer de sesión y Cache-Control: no-store. La sesión se valida antes de parámetros; no se recibe userId.

    {
      "asOf": "2026-10-30T16:00:00.000Z",
      "period": {"month":"2026-10","timeZone":"America/La_Paz","start":"2026-10-01T04:00:00.000Z","endExclusive":"2026-11-01T04:00:00.000Z"},
      "currency": "BOB",
      "items": [{"id":"budget_warning:00000000-0000-4000-8000-000000000001","type":"budget_warning","subjectType":"budget","subjectId":"00000000-0000-4000-8000-000000000001","message":"El presupuesto de Alimentación está en advertencia: 80.00 % (80.00 de 100.00 BOB)."}],
      "total": 1
    }

Tipos: budget_warning (80–100 % exacto inclusive), budget_exceeded (>100 %), goal_completed y goal_overdue. Decide el estado de origen antes de redondear: 79.999 % puede mostrarse 80.00 sin aviso; 100.001 % como 100.00 con exceso. Completadas tienen prioridad; metas activas, archivadas y futuras no generan aviso. Presupuestos usan mes completo; metas, asOf. Cada consulta reevalúa condiciones actuales bajo el mismo snapshot.

Identidad determinista type:subjectId; subjectType budget/savingsGoal; orden type y subjectId ascendentes; total=items.length, sin semántica de no leído. La interfaz puede renderizar message como texto, mostrar lista/total y representar vacío exitoso como items=[] y total=0. Los fallos no incluyen listas parciales ni ceros ficticios.

Errores: envelope error.code/message. 401 UNAUTHENTICATED; 400 INVALID_PERIOD; errores financieros reconocidos 422 DATA_OUT_OF_RANGE, 500 DATA_INTEGRITY_ERROR o 503 DATA_UNAVAILABLE; excepciones no clasificadas 500 INTERNAL_ERROR. No hay reintento automático, escritura de estado de notificación, historial, polling/tiempo real garantizado ni entrega por correo/SMS/push.

La implementación y validación visual de la interfaz corresponden a una sesión separada en su repositorio. Este trabajo entrega el contrato y aceptación del backend; no inspeccionó ni modificó esa capa.
