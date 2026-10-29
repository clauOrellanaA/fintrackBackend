# Tareas — 006 Metas de ahorro

**Solo validación pendiente de código ya integrado.** [Spec](spec.md) · [Plan](plan.md). Estimaciones de 20–30 minutos, no tiempos medidos. Prerrequisito: entorno aislado y compilación descritos en el plan. No reimplementar la API.

- [ ] **T1 — Cubrir contrato de gestión** (20 min; depende del entorno listo; RF-6 a RF-9).
  Hecho cuando: el helper carga savings-goals.v1.json y se ejecutan verificaciones de formas actuales de creación, actualización, entrada y respuesta, con resultado registrado.
- [ ] **T2 — Probar creación y listado por HTTP** (25 min; depende de T1; RF-6, RF-7).
  Hecho cuando: los tests comprueban autenticación, defaults, límites/formatos, cuerpo estricto, lista vacía/archivadas, orden y aislamiento entre dos propietarios.
- [ ] **T3 — Probar edición y archivo por HTTP** (25 min; depende de T2; RF-4, RF-8).
  Hecho cuando: los tests comprueban cambios parciales, archivo/desarchivo, cuerpo inválido, recurso ajeno y reserva conservada, con ejecución real.
- [ ] **T4 — Probar aportes y retiros por HTTP** (30 min; depende de T3; RF-5, RF-9).
  Hecho cuando: los tests cubren instante omitido/expreso, importes/campos extra, meta archivada, insuficiencia/ajeno y efecto en reserva; registran el status real sin asumir 409 para 40001 ni reintento.
- [ ] **T5 — Verificar cobertura de esta spec** (20 min; depende de T4; RF-1 a RF-9).
  Hecho cuando: cada RF enlaza un test ejecutado o una falta explícita y se distinguen resultados de indicadores/ledger de los de gestión HTTP, sin atribuir aprobación por inspección.

Todas las tareas siguen pendientes. Un fallo o borde descubierto debe documentarse y corregirse mediante una tarea autorizada propia; no se finge resuelto ni se modifican reglas para hacer pasar pruebas. No se ejecutaron suites al redactar estos documentos.
