# Plan implementado — 008 Avisos internos

Estado: **IMPLEMENTADO Y VALIDADO LOCALMENTE**. Código 4bea0d915c4197346cdba7b040016b23edb00752; 2026-10-30. [Spec](spec.md) · [Tareas](tasks.md). El usuario autorizó implementar el MVP en esta entrega.

## Componentes y datos

[NotificationsController](../../../src/modules/notifications/notifications.controller.ts), [NotificationsService](../../../src/modules/notifications/notifications.service.ts), [NotificationsModule](../../../src/modules/notifications/notifications.module.ts) y [proyección pura](../../../src/modules/notifications/notification-projection.ts) implementan el dominio. Importan las interfaces públicas de budgets y savings-goals y el guard de auth, sin duplicar consultas, estados ni fórmulas monetarias. RF-1 a RF-6.

**Sin entidad, tabla, migración, cola, cron ni caché nueva.** Los datos financieros siguen persistidos en sus tablas actuales. Cada aviso es una proyección de un estado, no un evento almacenado. No hay readAt, createdAt ni contador de no leídos. Esta estrategia fue contrastada mediante inspección con el especialista de base de datos. RF-4 a RF-6.

## Contrato HTTP vigente

GET /api/v1/notifications?month=YYYY-MM; month opcional. Reutilizar resolvePeriod, con límites de [004](../004-dashboard/spec.md). SessionGuard primero; identidad exclusivamente de sesión. Respuesta 200 y Cache-Control: no-store. RF-1, RF-4, RF-5.

    {
      "asOf": "2026-10-28T16:00:00.000Z",
      "period": {"month":"2026-10","timeZone":"America/La_Paz","start":"2026-10-01T04:00:00.000Z","endExclusive":"2026-11-01T04:00:00.000Z"},
      "currency": "BOB",
      "items": [{"id":"budget_warning:00000000-0000-4000-8000-000000000001","type":"budget_warning","subjectType":"budget","subjectId":"00000000-0000-4000-8000-000000000001","message":"El presupuesto de Alimentación está en advertencia: 80.00 % (80.00 de 100.00 BOB)."}],
      "total": 1
    }

Item: id determinista = type + ':' + subjectId; type enum budget_warning/budget_exceeded/goal_completed/goal_overdue; subjectType budget/savingsGoal; subjectId UUID; message español. Orden técnico estable por type y subjectId ascendentes; total entero igual a items.length. Usar progress/limit/spent o target/saved serializados por servicios, sin convertir dinero a Number. asOf es observación, no fecha de evento. RF-2 a RF-4.

Errores mediante envelope error.code/message y no-store: 401 UNAUTHENTICATED; 400 INVALID_PERIOD para parámetros inválidos; 422 DATA_OUT_OF_RANGE, 500 DATA_INTEGRITY_ERROR o 503 DATA_UNAVAILABLE cuando correspondan a errores reconocidos de las fuentes; 500 INTERNAL_ERROR para excepciones no clasificadas. No transformar fallos en items=[] ni prometer reintentos. RF-1, RF-5.

## Algoritmo descriptivo

1. Autenticar → fijar asOf una sola vez → resolver periodo con resolvePeriod(query, asOf) → abrir REPEATABLE READ. RF-1, RF-5.
2. Pasar el MISMO EntityManager a BudgetsService.getForUser(userId, period, manager) y SavingsGoalsService.getForUser(userId, asOf, manager). No usar métodos de gestión listForUser que abren snapshots propios. RF-2, RF-3, RF-5.
3. Proyectar warning/exceeded de cada presupuesto; proyectar completed/overdue de cada meta visible. Budget usa mes completo, incluso posted futuro del mes; metas usan asOf. No unificar sus cortes diferentes. RF-2, RF-3.
4. Construir mensaje y clave type:subjectId → eliminar duplicado de esa clave dentro de la respuesta → ordenar → total=longitud → devolver. Leer no escribe; una segunda consulta vuelve a evaluar. RF-4, RF-6.
5. Ante cualquier excepción abortar la respuesta completa y conservar el envelope existente. RF-5.

## Decisiones y alternativas

| Elección técnica implementada | Razón y alternativa no adoptada | RF |
| --- | --- | --- |
| Proyección al consultar | Satisface avisos internos sin inventar historial; inbox persistente exige semántica de eventos/leído no solicitada | 4–6 |
| Servicios públicos y snapshot compartido | Reutiliza reglas probadas; SQL duplicado o snapshots independientes pueden divergir | 2, 3, 5 |
| Identidad por tipo/recurso y orden estable | Evita repetidos dentro de lista; no pretende deduplicar eventos históricos inexistentes | 4, 6 |
| Consulta explícita del cliente | No compromete cron, polling ni entrega instantánea; frecuencia de UI pertenece a su sesión | 1, 6 |

## Tests ejecutados

Se ejecutaron pruebas node:test con fixtures sintéticos: tablas de mapeo de estados, límites 80/100 antes de redondear y prioridad completed; contrato HTTP/guard/mes inválido; lista vacía exitosa; aislamiento con dos usuarios; mes por defecto y metas coherentes al cruzar medianoche/cambio de mes con instante inyectado; snapshot común con escritura concurrente y fallo de cada fuente; GET sin escrituras ni efectos financieros. La matriz enlaza RF-1 a RF-6 con pruebas puras y HTTP/PostgreSQL; estas últimas acreditan persistencia y concurrencia reales.

El [OpenAPI de notifications](../../openapi/notifications.v1.json) está versionado y cargado por el helper de contratos. La sesión de interfaz puede consumir lista, mensajes, total, vacío y error; esa capa no se inspeccionó ni modificó aquí. Ver [traspaso de integración](../../be-specs-delivery.md#contrato-para-la-interfaz).

Validación local independiente BE-SPECS, 2026-10-30: código/tests/OpenAPI 4bea0d915c4197346cdba7b040016b23edb00752; 82 pruebas aprobadas, 0 fallidas, 0 omitidas. Lint, tipos y build aprobados. [Entrega](../../be-specs-delivery.md) · [Matriz de 46 RF](../../sdd/coverage.md). CI remota, merge y despliegue no acreditados.
