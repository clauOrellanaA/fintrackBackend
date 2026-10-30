# Documentación del backend

Este índice organiza la documentación sin mover documentos existentes ni cambiar contratos. Alcance: únicamente fintrackBackend. Código validado: 4bea0d915c4197346cdba7b040016b23edb00752, 2026-10-30. La primera captura SDD fue bf57ebc; su cierre documental se conserva como histórico.

## Empezar aquí

1. [Constitución: seis principios](constitution.md).
2. [Flujo SDD simple y prompts](sdd/README.md).
3. [Plan técnico de la línea base](sdd/plan.md), [tareas documentales](sdd/tasks.md) y [matriz RF–test](sdd/coverage.md).

## Especificaciones y resultados

| ID | Capacidad existente | Especificación |
| --- | --- | --- |
| 001 | Registro, login, sesiones y cambio de contraseña | [Autenticación](specs/001-auth-sessions/spec.md) |
| 002 | Consulta y edición del perfil propio | [Perfil](specs/002-user-profile/spec.md) |
| 003 | Movimientos y categorías propios | [Transacciones y categorías](specs/003-transactions-categories/spec.md) |
| 004 | Cinco secciones de indicadores financieros | [Dashboard](specs/004-dashboard/spec.md) |
| 005 | Gestión y consumo de presupuestos | [Presupuestos](specs/005-budgets/spec.md) |
| 006 | Gestión de metas, aportes/retiros, indicadores y reservas | [Spec](specs/006-savings/spec.md), [plan](specs/006-savings/plan.md) y [tareas](specs/006-savings/tasks.md) |
| 007 | Comparación, distribución y evolución del saldo | [Spec](specs/007-reports/spec.md), [plan](specs/007-reports/plan.md) y [tareas](specs/007-reports/tasks.md) |
| 008 | Avisos internos de condiciones actuales implementados | [Spec](specs/008-in-app-notifications/spec.md), [plan](specs/008-in-app-notifications/plan.md) y [tareas](specs/008-in-app-notifications/tasks.md) |

001–008 describen comportamiento implementado. Los resultados de 006/007/008 están en sus specs, planes y tasks. La [cobertura](sdd/coverage.md) traza los 46 RF a QA local: 82 aprobadas, 0 fallidas/omitidas. [BE-SPECS](be-specs-delivery.md) distingue validación local, CI remota y dependencia de presentación externa. Salud, configuración y aprovisionamiento se describen como capacidades transversales en el plan.

Los ocho specs incluyen 28 historias de usuario y 28 issues propuestas, relacionadas con sus 46 RF. Son propuestas documentales de seguimiento retrospectivo; el [flujo de trazabilidad](sdd/README.md#historias-e-issues-propuestas) distingue ese estado de la implementación y la validación existentes.

## Contratos y operación existentes

- OpenAPI: [dashboard](openapi/dashboard.v1.json), [usuarios y seguridad](openapi/users.v1.json), [transacciones y categorías](openapi/transactions.v1.json), [presupuestos](openapi/budgets.v1.json), [reportes](openapi/reports.v1.json) y [metas](openapi/savings-goals.v1.json) y [avisos](openapi/notifications.v1.json).
- [Contrato financiero del dashboard](dashboard-contract.md).
- [Arquitectura](architecture.md) e [integración](integration.md): inventario y contratos actuales; el [flujo SDD](sdd/README.md) conserva el contexto histórico.
- [Guía del proyecto](../README.md), [contribución y CI](../CONTRIBUTING.md), [despliegue](render-deployment.md) y [hooks de Codex](codex-hooks.md).
- [Gestión de presupuestos BE-M03](be-m03-budget-management.md).
- Evidencias históricas de entrega: [BE-01](be-01-delivery.md), [BE-02](be-02-delivery.md), [BE-03](be-03-delivery.md), [BE-04](be-04-delivery.md), [BE-05](be-05-delivery.md), [BE-06](be-06-delivery.md), [BE-07](be-07-delivery.md) y [BE-08](be-08-delivery.md).
- [Medición histórica BE-07](be-07-benchmark.json): no representa una medición ejecutada en esta entrega.

## Estructura adoptada

- docs/constitution.md: reglas de trabajo.
- docs/sdd/: proceso, plan técnico compartido, tareas y cobertura de esta línea base.
- docs/specs/NNN-capacidad/spec.md: qué hace y por qué, con evidencia separada.
- docs/openapi/: contratos HTTP existentes.
- Documentación operativa e histórica: se conservan sus rutas actuales para no romper enlaces.

Para cambios futuros, añadir plan.md y tasks.md dentro de la carpeta de la spec solo si el cambio necesita ese detalle; no duplicar automáticamente el plan compartido.
