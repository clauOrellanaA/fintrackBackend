# Tareas documentales SDD

## Histórico SDD-01 — no acredita el estado actual

Base histórica: bf57ebcd582706ab467251baf2d875fddcbb5fa2; 2026-10-28. Solo documentación. Duraciones estimadas por tarea: 20–30 minutos. Los checks representan redacción e inspección documental, nunca pruebas funcionales aprobadas. [Plan](plan.md) · [Cobertura](coverage.md).

- [x] **T1 — Inventariar capacidades integradas** (20 min; sin dependencia; RF: 001–007/todos).
  Hecho cuando: existe una lista de las siete capacidades, rutas públicas e internas diferenciadas y SHA base, con discrepancias históricas registradas en el índice/flujo.
- [x] **T2 — Fijar constitución e índice sin mover legacy** (20 min; depende de T1; RF: todos, transversal).
  Hecho cuando: docs/constitution.md contiene seis principios en máximo quince líneas y docs/README.md enlaza specs, flujo, contratos y operación existentes.
- [x] **T3 — Especificar acceso y perfil** (25 min; depende de T2; RF: 001/RF-1 a RF-5; 002/RF-1 a RF-4).
  Hecho cuando: ambas specs separan QUÉ/POR QUÉ de evidencia y recogen registro público, sesiones, revocación y conflictos del perfil.
- [x] **T4 — Especificar movimientos y categorías** (25 min; depende de T2; RF: 003/RF-1 a RF-6).
  Hecho cuando: la spec describe creación, consulta, filtros/páginas, edición, anulación y eliminación condicionada de categoría con casos límite.
- [x] **T5 — Especificar dashboard** (25 min; depende de T3 y T4; RF: 004/RF-1 a RF-6).
  Hecho cuando: la spec diferencia mes/corte acumulado, explica porcentajes, coherencia de cinco secciones y fallo global, y enlaza 005/006.
- [x] **T6 — Especificar presupuestos** (25 min; depende de T4; RF: 005/RF-1 a RF-5).
  Hecho cuando: la spec incluye CRUD integrado, unicidad, consumo y bordes 80/100 antes del redondeo.
- [x] **T7 — Especificar ahorros internos** (25 min; depende de T5; RF: 006/RF-1 a RF-5).
  Hecho cuando: la spec diferencia lectura por dashboard de gestión pública ausente y cubre reservas, archivo, estados e integridad.
- [x] **T8 — Especificar reportes** (25 min; depende de T4 y T5; RF: 007/RF-1 a RF-5).
  Hecho cuando: la spec fija 24 meses calendario inclusive, días locales, actividad frente a saldo histórico y cortes futuros.
- [x] **T9 — Documentar el CÓMO actual** (30 min; depende de T3–T8; RF: todos).
  Hecho cuando: plan.md relaciona módulos, datos, contrato, algoritmos y estrategia de tests con los RF sin introducir tecnología o comportamiento nuevo.
- [x] **T10 — Trazar RF y registrar incertidumbre** (30 min; depende de T9; RF: todos).
  Hecho cuando: cada RF aparece en coverage.md con fuente, test real o ausencia, alcance parcial cuando aplica y estado de ejecución honesto.
- [x] **T11 — Revisar independientemente y corregir documentos** (25 min; depende de T10; RF: todos).
  Hecho cuando: una revisión independiente contraste specs/plan/cobertura con fuentes, se resuelvan hallazgos documentales y quede evidencia del resultado.
- [x] **T12 — Comprobar entrega documental** (20 min; depende de T11; RF: todos, transversal).
  Hecho cuando: se comprueben enlaces locales, numeración/trazabilidad, seis principios y límite de líneas, ausencia de cambios fuera de docs y formato del diff, y se registren comandos/resultados reales.

## Auditoría funcional posterior, fuera de esta entrega

- [ ] **A1 — Auditar RF contra ejecución actual** (requiere sesión y entorno propios; no forma parte de tareas documentales ni se promete duración de 30 min).
  Hecho cuando: cada RF tenga resultado de test ejecutado sobre un SHA registrado, las lagunas y fallos sean explícitos y se emita un veredicto de cumplimiento.
  RF: todos. Dependencias: infraestructura PostgreSQL aislada y configuración válida según plan; identificar cobertura no satisface este criterio.

No hay tareas de reimplementación ni autorización para iniciar cambios funcionales. El ejemplo «implementar solo T2» se usa como modelo de control de alcance en los prompts; no autoriza código en esta adopción.

## Evidencia de cierre documental — 2026-10-28

La revisión independiente y su reinspección dirigida no dejaron hallazgos documentales pendientes. Se corrigieron tres precisiones: exigir nombre de categoría solo al crear/renombrar; describir la lectura de ahorros como autenticada mediante el dashboard; separar registro y login en el pseudocódigo de sesión, generando el token antes de guardar su hash.

La comprobación principal de solo lectura mediante PowerShell here-string canalizado a Node (fs/path) terminó con código 0: 13 documentos, 157 enlaces locales resueltos, 36 RF con una fila de matriz cada uno, 38 nombres literales de tests encontrados y seis principios en ocho líneas de constitución. El escaneo explícito de todos los documentos nuevos encontró cero problemas de espacios en blanco.

Git diff --check terminó con código 0; como no incluye archivos nuevos sin seguimiento, estos se comprobaron además con el escaneo explícito anterior. Git status mostró únicamente los 13 documentos nuevos, sin archivos rastreados modificados. Rama planing; worktree C:/fintrack/worktrees/backend/planing-sdd; base bf57ebcd582706ab467251baf2d875fddcbb5fa2.

No se ejecutaron suites funcionales, migraciones, seeds ni benchmark. A1 continúa pendiente y el cumplimiento funcional de las specs sigue **NO VERIFICADO**.
## Planificación pendiente por spec

- [006 — Tareas de validación de metas de ahorro](../specs/006-savings/tasks.md).
- [007 — Tareas de validación de reportes](../specs/007-reports/tasks.md).
- [008 — Tareas de implementación de avisos internos](../specs/008-in-app-notifications/tasks.md).
