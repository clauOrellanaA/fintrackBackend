---
name: fintrack-collaboration
description: Orquesta funcionalidades de backend de FinanTrack en fintrackBackend, con roles de planificación, código, revisión, tests, documentación y pruebas y un especialista PostgreSQL.
---

# Orquestación de funcionalidades FinanTrack

La sesión principal es el coordinador y único punto de entrada del usuario. Convierte la descripción de la funcionalidad en entregas concretas; el usuario no necesita elegir agentes ni redactar tareas técnicas. No inicia funcionalidades por cargar esta skill. Si pide solo planificar o revisar, limita el trabajo a eso.

## Límite de repositorio

Tu único repositorio de trabajo es fintrackBackend, dentro del worktree absoluto asignado. No leas, busques, edites ni ejecutes comandos en el repositorio hermano ni en sus worktrees. No delegues trabajo de la otra capa. Puedes leer las instrucciones aplicables de C:/fintrack/AGENTS.md y C:/fintrack/docs/git-por-feature.md, y los documentos compartidos de C:/fintrack/docs que el coordinador asigne; no los edites. Si necesitas un contrato o cambio de la otra capa, entrega al coordinador una solicitud con los datos necesarios, sin acceder al otro repositorio. Los contratos deben estar disponibles en el repositorio propio o ser proporcionados por el coordinador. Esta regla es de alcance; no modifica los permisos técnicos de la sesión.

El coordinador usa solo las definiciones locales de este repositorio. Para una funcionalidad que abarque ambas capas, completa la parte local y entrega un traspaso con API, ejemplos, aceptación y dependencias para una sesión separada del otro repositorio. No declares completada la funcionalidad global si esa dependencia sigue pendiente.

## Contexto y alcance

Lee AGENTS.md y C:/fintrack/docs/git-por-feature.md; consulta los backlogs backend/frontend pertinentes en C:/fintrack/docs y arquitectura, integración y CONTRIBUTING del repositorio afectado. Comprueba implementación, rama y cambios reales; los backlogs no sustituyen la evidencia del código. No ejecutes el backlog completo por defecto.

Identifica aceptación observable, capas afectadas, dependencias y contrato existente. Resuelve decisiones técnicas rutinarias con las convenciones del proyecto. Pregunta solo por decisiones de negocio o información imprescindible que no pueda inferirse y continúa las tareas independientes.

## Equipos específicos

| Etapa | Rol local | Entrega |
| --- | --- | --- |
| Planificación | backend-planner | Alcance, contrato y aceptación |
| Código | backend-coder | Implementación local |
| Revisión | backend-reviewer | Hallazgos independientes |
| Escritura de tests | backend-test-writer | Tests y fixtures |
| Documentación | backend-documenter | Documentación comprobada |
| Pruebas | backend-qa | Ejecución y evidencia |

Usa database-specialist para persistencia PostgreSQL, migraciones, seeds, entidades, restricciones, índices y transacciones de este backend.

Las definiciones están en .codex/agents/<nombre>.toml de cada repositorio. No existen roles generales backend/frontend/database. Usa los agentes personalizados si el cliente los expone. Si la herramienta de delegación solo acepta una tarea textual, lee el TOML del rol y transmite sus developer_instructions y el encargo al subagente; el nombre de la tarea por sí solo no carga esas instrucciones. Si no hay delegación disponible, declara la limitación y aplica las responsabilidades secuencialmente sin fingir una revisión independiente.

## Asignación y turnos

El coordinador lanza directamente los roles del equipo local; los especialistas no generan descendientes. Respeta el menor límite entre configuración y sesión: con cuatro plazas totales, como máximo tres subagentes simultáneos. Ejecuta por turnos, reutiliza agentes mediante nuevas tareas cuando corresponda y libera hilos completados si el cliente lo permite antes de abrir otros. Si la capacidad permanece ocupada, no intentes sobrepasarla; continúa secuencialmente o informa el bloqueo real. No mantengas coordinadores intermedios ocupando plazas.

Antes de cualquier edición asigna ID/objetivo, repo, base y SHA, rama, worktree absoluto, propietario único de Git, archivos de escritura, contrato, dependencias y aceptación. Pasa la ruta absoluta de esta skill a cada rol, especialmente si el worktree aún no la contiene. Un archivo tiene un único escritor a la vez, incluyendo entidades, configuración, OpenAPI y tests. Revisores y QA no editan código ni corrigen sus propios hallazgos.

## Flujo de entrega

1. **Planificar:** activa backend-planner y database-specialist si corresponde. Consolida un acuerdo único de API (ruta/método, request/response/errores), autenticación, propiedad por usuario, dinero/moneda/redondeo, fechas/zona horaria y persistencia. Conserva contratos existentes; comunica cambios antes de consumirlos. No implementes decisiones de negocio aún pendientes.
2. **Preparar:** para implementación aplica el protocolo Git: inspecciona status/remotos/worktrees, fetch de origin/dev y base integrada, un worktree por feature en C:/fintrack/worktrees, un responsable de Git por rama. Esta sesión prepara únicamente ramas y commits del repositorio local; el trabajo del repositorio hermano se entrega como dependencia externa. No cambies ramas en carpetas compartidas ni incluyas cambios previos del usuario.
3. **Construir:** asigna código a backend-coder y persistencia a database-specialist. Paraleliza solo tareas locales con archivos separados y contrato estable. Los fixtures identificados no acreditan integración real. Los test-writers pueden preparar tests de aceptación en paralelo si no comparten archivos; entregan su cobertura y ejecuciones.
4. **Revisar:** los reviewers inspeccionan el diff y aceptación sin editar. Devuelve defectos a su propietario; tras cambios revisa nuevamente lo afectado. No presentes autoevaluación del coder como revisión independiente.
5. **Comprobar:** QA ejecuta checks reales y aceptación sobre la versión corregida. Consulta package.json y CI actuales: usa lint/typecheck/build/test, verificando su existencia antes de ejecutarlos. La API del otro repositorio solo se consume como servicio mediante el contrato disponible, sin leer sus archivos ni administrarlo. Usa una base aislada con datos sintéticos; no migres ni limpies la base local del usuario. Pruebas unitarias con mocks no acreditan API real ni PostgreSQL. Ante fallos, devuelve evidencia al escritor correspondiente y repite las comprobaciones afectadas. Si falta infraestructura, registra pendiente y no cierres como aprobado.
6. **Documentar y entregar:** los documenters actualizan documentos dentro de cada worktree y contrastan contratos con comportamiento final. Pueden preparar borradores antes, pero la entrega debe reflejar la versión validada. Solo el coordinador edita C:/fintrack/docs y consolida estados/evidencias. Pausa escritores antes de revisar/publicar. El responsable de Git valida diff y checks, prepara rutas explícitas y realiza commit/push únicamente de la feature autorizada según el protocolo. Sin git add global, secretos, force push, merge ni despliegue. Planificación/revisión/no publicar prevalecen.

Para cambios pequeños usa solo roles pertinentes y registra por qué una etapa no aplica; no crees todos los agentes por rutina. Para una funcionalidad completa local cubre las etapas del equipo de este repositorio, por turnos.

## Cierre verificable

Informa funcionalidad y comportamiento entregado, ramas/worktrees y SHA local/remoto si hubo publicación, pruebas ejecutadas y resultados, documentación y bloqueos concretos. Distingue implementación, revisión, validación local, CI remota y merge. Un fallo o una aceptación pendiente impide declarar completada la funcionalidad. Conserva worktrees para revisión.
