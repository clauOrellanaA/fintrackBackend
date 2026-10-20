# Equipo de backend de FinanTrack

Esta configuración coordina exclusivamente fintrackBackend mediante `$fintrack-collaboration`. Describe la funcionalidad y el resultado esperado.

| Etapa | Rol local | Entrega |
| --- | --- | --- |
| Planificación | backend-planner | Alcance, contrato y aceptación |
| Código | backend-coder | Implementación local |
| Revisión | backend-reviewer | Hallazgos independientes |
| Escritura de tests | backend-test-writer | Tests y fixtures |
| Documentación | backend-documenter | Documentación comprobada |
| Pruebas | backend-qa | Ejecución y evidencia |

Usa database-specialist para persistencia PostgreSQL, migraciones, seeds, entidades, restricciones, índices y transacciones de este backend.


## Uso

Abre una nueva sesión de Codex en este repositorio para cargar sus roles locales.

> Usa $fintrack-collaboration. Implementa [descripción de la funcionalidad].

Los subagentes no leen ni modifican el repositorio hermano ni ejecutan comandos en él. Los contratos necesarios se mantienen en el repositorio propio o se proporcionan mediante el coordinador. Si hace falta trabajo en la otra capa, se entrega una dependencia para una sesión separada de ese repositorio. La separación se establece mediante roles e instrucciones; no configura un aislamiento técnico del sistema de archivos.

Hay hasta tres subagentes simultáneos, trabajando por turnos y sin descendientes. Test-writer escribe tests; QA verifica de forma independiente. Revisión y QA no editan código. Los agentes heredan modelo y permisos de la sesión.

Skill: ../.agents/skills/fintrack-collaboration/SKILL.md. Las copias de backend y frontend tienen alcance distinto y no deben sobrescribirse una con otra.

Aplica C:/fintrack/docs/git-por-feature.md: worktree por feature, responsable único de Git y publicación limitada a la rama autorizada. Solo planificación/revisión no publica; merge y despliegue requieren autorización aparte. Solo el coordinador actualiza C:/fintrack/docs. No versionar secretos ni .env. Cargar esta configuración no inicia features ni publica cambios.

## Hooks de Codex

Los hooks locales de este repositorio están definidos en [hooks.json](./hooks.json). Protegen secretos y pruebas, ejecutan build y las pruebas aplicables del backend antes de push de ramas feature, y registran actividad sin comandos ni contenido de parches. La documentación específica está en [codex-hooks.md](../docs/codex-hooks.md).
