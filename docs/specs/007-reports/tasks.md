# Tareas — 007 Reportes financieros

**Validación local completada de código ya integrado.** [Spec](spec.md) · [Plan](plan.md). Estimaciones de 20–30 minutos, no tiempos medidos. Prerrequisito: entorno aislado y compilación descritos en el plan.

- [x] **T1 — Probar regresión de apertura reciente** (25 min; depende del entorno listo; RF-4).
  Hecho cuando: tests ejecutados cubren rango previo a apertura, fin de mes igual a apertura, rango que la cruza y meses vacíos posteriores, sin inventar saldo previo ni alterar el fix existente.
- [x] **T2 — Probar snapshot con escritura concurrente** (25 min; depende de T1; RF-5).
  Hecho cuando: un test dedicado ejecutado demuestra que comparación, distribución y evolución conservan una versión consistente durante una escritura concurrente.
- [x] **T3 — Probar fallo global de una fuente** (20 min; depende de T2; RF-5).
  Hecho cuando: un test dedicado ejecutado comprueba que una excepción de cálculo impide responder con datos parciales o ceros fabricados y conserva el envelope de error.
- [x] **T4 — Verificar cobertura de esta spec** (20 min; depende de T3; RF-1 a RF-5).
  Hecho cuando: período, cifras, distribución, evolución, autenticación y coherencia tienen test/resultado actual por RF o una falta explícita, sin confundir código existente con prueba pasada.

Las tareas se cierran por pruebas ejecutadas y trazabilidad por RF; se conservaron las reglas y APIs existentes.

## Evidencia de cierre

Validación local independiente BE-SPECS, 2026-10-30: código/tests/OpenAPI 4bea0d915c4197346cdba7b040016b23edb00752; 82 pruebas aprobadas, 0 fallidas, 0 omitidas. Lint, tipos y build aprobados. [Entrega](../../be-specs-delivery.md) · [Matriz de 46 RF](../../sdd/coverage.md). CI remota, merge y despliegue no acreditados.

T1–T3: regresiones en reports-http.test.cjs; T4: matriz 007/RF-1 a RF-5. Se ejecutaron los siete tests del archivo.
