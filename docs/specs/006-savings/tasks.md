# Tareas — 006 Metas de ahorro

**Validación local completada de código ya integrado.** [Spec](spec.md) · [Plan](plan.md). Estimaciones de 20–30 minutos, no tiempos medidos. Prerrequisito: entorno aislado y compilación descritos en el plan. No reimplementar la API.

- [x] **T1 — Cubrir contrato de gestión** (20 min; depende del entorno listo; RF-6 a RF-9).
  Hecho cuando: el helper carga savings-goals.v1.json y se ejecutan verificaciones de formas actuales de creación, actualización, entrada y respuesta, con resultado registrado.
- [x] **T2 — Probar creación y listado por HTTP** (25 min; depende de T1; RF-6, RF-7).
  Hecho cuando: los tests comprueban autenticación, defaults, límites/formatos, cuerpo estricto, lista vacía/archivadas, orden y aislamiento entre dos propietarios.
- [x] **T3 — Probar edición y archivo por HTTP** (25 min; depende de T2; RF-4, RF-8).
  Hecho cuando: los tests comprueban cambios parciales, archivo/desarchivo, cuerpo inválido, recurso ajeno y reserva conservada, con ejecución real.
- [x] **T4 — Probar aportes y retiros por HTTP** (30 min; depende de T3; RF-5, RF-9).
  Hecho cuando: los tests cubren instante omitido/expreso, importes/campos extra, meta archivada, insuficiencia/ajeno y efecto en reserva; registran el status real sin asumir 409 para 40001 ni reintento.
- [x] **T5 — Verificar cobertura de esta spec** (20 min; depende de T4; RF-1 a RF-9).
  Hecho cuando: cada RF enlaza un test ejecutado o una falta explícita y se distinguen resultados de indicadores/ledger de los de gestión HTTP, sin atribuir aprobación por inspección.

Las tareas se cierran por pruebas ejecutadas y trazabilidad por RF; se conservaron las reglas y APIs existentes.

## Evidencia de cierre

Validación local independiente BE-SPECS, 2026-10-30: código/tests/OpenAPI 4bea0d915c4197346cdba7b040016b23edb00752; 82 pruebas aprobadas, 0 fallidas, 0 omitidas. Lint, tipos y build aprobados. [Entrega](../../be-specs-delivery.md) · [Matriz de 46 RF](../../sdd/coverage.md). CI remota, merge y despliegue no acreditados.

T1: contratos de gestión en contract.test.cjs; T2–T4: savings-goals-http.test.cjs; T5: matriz 006/RF-1 a RF-9 y pruebas internas de ledger/reservas/concurrencia.
