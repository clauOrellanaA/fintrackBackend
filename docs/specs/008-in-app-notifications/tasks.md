# Tareas completadas — 008 Avisos internos

**Implementación y aceptación funcional local completadas.** Código 4bea0d915c4197346cdba7b040016b23edb00752; 2026-10-30. Las estimaciones de planificación no son tiempos medidos. [Spec](spec.md) · [Plan](plan.md). Reutilizar infraestructura y no reimplementar servicios financieros.

- [x] **N1 — Tests de proyección de presupuestos** (20 min; dependencia: plan; RF-2, RF-4).
  Hecho cuando: hay tests que fallan para normal, 80 %, 100 %, excedido y bordes redondeados, con una clave por tipo/recurso.
- [x] **N2 — Tests de proyección de metas** (20 min; depende de N1; RF-3, RF-4).
  Hecho cuando: hay tests que fallan para active/completed/overdue, prioridad de completada y ausencia de archivadas en la fuente pública.
- [x] **N3 — Implementar mapeo puro de avisos** (25 min; depende de N1–N2; RF-2, RF-3, RF-4).
  Hecho cuando: los tests de mapeo pasan y mensajes, identidad, orden y total usan datos exactos sin cálculos financieros duplicados.
- [x] **N4 — Tests de composición y fallos** (25 min; depende de N3; RF-1, RF-5, RF-6).
  Hecho cuando: tests fallan si cambia el asOf/manager entre fuentes, si el mes por defecto diverge del corte al cruzar medianoche/cambio de mes con instante inyectado, si se fabrica vacío ante error o si se escribe al consultar.
- [x] **N5 — Componer lectura bajo snapshot** (25 min; depende de N4; RF-1, RF-5, RF-6).
  Hecho cuando: ambas interfaces públicas reciben el mismo manager RR y asOf coherente, y pasan los tests de composición sin nueva persistencia.
- [x] **N6 — Tests HTTP y contrato propuesto** (25 min; depende de N5; RF-1, RF-4, RF-5).
  Hecho cuando: tests HTTP inicialmente fallan para ruta privada, envelope, mes duplicado/extra, no-store y forma items/total/asOf/period.
- [x] **N7 — Exponer ruta y contrato versionado** (25 min; depende de N6; RF-1, RF-4, RF-5).
  Hecho cuando: módulo/controlador y OpenAPI futuro respetan el contrato del plan, sus validadores se cargan y los tests de N6 pasan.
- [x] **N8 — Integración PostgreSQL de presupuestos** (25 min; depende de N7; RF-2, RF-4).
  Hecho cuando: base aislada demuestra límites exactos, categoría propia, mes solicitado, posted futuros y total correcto por HTTP.
- [x] **N9 — Integración PostgreSQL de metas** (25 min; depende de N8; RF-3, RF-4).
  Hecho cuando: base aislada demuestra completed/overdue, hoy, archivo y cambio por retiro sin alterar ingresos/gastos.
- [x] **N10 — Aislamiento, vacío y lectura repetida** (25 min; depende de N9; RF-1, RF-4, RF-6).
  Hecho cuando: dos usuarios no comparten avisos, vacío exitoso es total 0 y GET repetido no modifica tablas ni crea eventos.
- [x] **N11 — Coherencia y error global reales** (30 min; depende de N10; RF-5).
  Hecho cuando: una escritura concurrente no mezcla versiones y fallos de cada fuente abortan sin lista parcial ni cero artificial.
- [x] **N12 — Revisar, ejecutar checks y entregar evidencia** (30 min; depende de N11; RF-1 a RF-6).
  Hecho cuando: revisión independiente no deja defectos, checks pertinentes pasan en entorno aislado, cobertura contiene comandos/resultados actuales y el contrato queda listo para consumo externo.

El usuario autorizó implementar el MVP de estados notificables y consulta actual en esta entrega; no se atribuye esa autorización a la historia anterior. Si el alcance cambia, actualizar spec/plan/tareas antes de la tarea afectada. No hay tarea de cron, migración ni inbox leído/no leído porque no pertenecen a este MVP.

Nota de proceso: las casillas acreditan aceptación funcional actual con pruebas ejecutadas. No se conservó ejecución roja previa para N1/N2/N4/N6 ni se afirma TDD histórico. Las frases sobre tests inicialmente fallidos se conservan como intención del proceso; los escenarios de mapeo, composición y HTTP están implementados y aprobados.

## Evidencia de cierre

Validación local independiente BE-SPECS, 2026-10-30: código/tests/OpenAPI 4bea0d915c4197346cdba7b040016b23edb00752; 82 pruebas aprobadas, 0 fallidas, 0 omitidas. Lint, tipos y build aprobados. [Entrega](../../be-specs-delivery.md) · [Matriz de 46 RF](../../sdd/coverage.md). CI remota, merge y despliegue no acreditados.

N1–N5: notifications.test.cjs y composición real; N6–N11: notifications-http.test.cjs, contract.test.cjs y OpenAPI; N12: revisión independiente sin defectos de código bloqueantes, checks y matriz 008/RF-1 a RF-6.
