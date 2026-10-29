# Tareas — 007 Reportes financieros

**Solo validación pendiente de código ya integrado.** [Spec](spec.md) · [Plan](plan.md). Estimaciones de 20–30 minutos, no tiempos medidos. Prerrequisito: entorno aislado y compilación descritos en el plan.

- [ ] **T1 — Probar regresión de apertura reciente** (25 min; depende del entorno listo; RF-4).
  Hecho cuando: tests ejecutados cubren rango previo a apertura, fin de mes igual a apertura, rango que la cruza y meses vacíos posteriores, sin inventar saldo previo ni alterar el fix existente.
- [ ] **T2 — Probar snapshot con escritura concurrente** (25 min; depende de T1; RF-5).
  Hecho cuando: un test dedicado ejecutado demuestra que comparación, distribución y evolución conservan una versión consistente durante una escritura concurrente.
- [ ] **T3 — Probar fallo global de una fuente** (20 min; depende de T2; RF-5).
  Hecho cuando: un test dedicado ejecutado comprueba que una excepción de cálculo impide responder con datos parciales o ceros fabricados y conserva el envelope de error.
- [ ] **T4 — Verificar cobertura de esta spec** (20 min; depende de T3; RF-1 a RF-5).
  Hecho cuando: período, cifras, distribución, evolución, autenticación y coherencia tienen test/resultado actual por RF o una falta explícita, sin confundir código existente con prueba pasada.

Todas las tareas siguen pendientes. Las brechas descubiertas se documentan como tareas propias antes de corregirlas; este plan no autoriza reimplementar la funcionalidad ni cambiar reglas. No se ejecutaron suites al redactar estos documentos.
