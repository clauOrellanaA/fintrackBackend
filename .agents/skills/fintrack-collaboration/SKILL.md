---
name: fintrack-collaboration
description: Coordina los especialistas frontend, backend y database de FinanTrack cuando una tarea requiere integrar interfaz, API o persistencia, o cuando se solicita trabajar con estos subagentes.
---

# Colaboracion FinanTrack

Aplica esta skill al coordinar trabajo entre dominios. Una tarea de un solo dominio puede resolverse con un unico especialista; no lances los tres por rutina.
El coordinador es la sesion principal. Los especialistas no crean mas subagentes.

## Contexto y propiedad

Lee docs/architecture.md, docs/integration.md y CONTRIBUTING.md del repositorio afectado. Distingue lo implementado de lo planificado.

| Rol | Propiedad habitual | Entrega a otros roles |
| --- | --- | --- |
| frontend | fintrackFrontend/src/app, src/features y src/shared | Necesidades de interfaz, tipos y consumo HTTP |
| backend | fintrackBackend/src/modules, src/config y src/shared | Endpoints, DTO, errores y reglas de autorizacion |
| database | fintrackBackend/src/database | Esquema, migraciones, integridad y contrato de persistencia |

Las entidades ORM, Compose, configuracion compartida y documentos tienen un unico escritor que asigna el coordinador. Las rutas son limites de responsabilidad, no permisos adicionales del entorno.

## Contrato antes de trabajo paralelo

El coordinador identifica el alcance y comparte un acuerdo breve con los roles afectados:

- Operacion, ruta HTTP, metodo, request, response y errores esperados.
- Autenticacion y aislamiento de los datos por usuario.
- Formato monetario exacto, moneda, fechas, zona horaria y redondeo cuando corresponda.
- Modelo afectado, restricciones y compatibilidad de migraciones.
- Archivos de cada escritor y criterios de aceptacion.

Usa el contrato existente si lo hay. No inventes endpoints como si ya estuvieran implementados. Si la tarea solo pide diseno, entrega acuerdos sin generar codigo.

## Delegacion y entrega

Asigna a cada agente objetivo, repositorio absoluto, archivos propios, contrato y validacion esperada. El principal puede tener hasta tres especialistas simultaneos.

Database y backend acuerdan persistencia y propiedad de entidades; backend y frontend acuerdan DTO y errores. Paraleliza solo tareas cuyas interfaces y archivos ya esten separados. Si una tarea depende de una decision pendiente, resuelve esa decision antes de avanzar en ella.

Cada especialista comunica al coordinador cambios de contrato, dependencias o conflictos antes de modificar archivos ajenos. El coordinador informa al rol afectado y confirma la nueva version del acuerdo. No sobrescribas cambios de otro agente ni abras una segunda implementacion para el mismo archivo.

Al terminar, cada agente devuelve:

- Resultado y archivos modificados.
- Contratos consumidos o cambiados y dependencias pendientes.
- Comandos de verificacion realmente ejecutados y sus resultados.
- Riesgos o bloqueos concretos que impiden integrar.

## Integracion

El coordinador revisa que request/response y formatos coincidan entre UI, API y persistencia; comprueba autorizacion por usuario y coherencia de migraciones cuando sean parte de la tarea. Ejecuta los chequeos disponibles que correspondan al cambio. Si aun no existe codigo ejecutable, informa esa limitacion sin inventar pruebas.

Un fallo de integracion vuelve al propietario de la capa afectada con evidencia concreta. Evita cambios simultaneos sobre el mismo archivo. Finaliza cuando los criterios de la tarea esten satisfechos o explica exactamente la dependencia externa pendiente.

## Trabajo local

La configuracion compartida .codex y esta skill pueden versionarse por instruccion del usuario. Excluir secretos y ajustes personales; los archivos .env siguen ignorados.
Respeta el flujo feature -> dev -> qa -> main y los permisos de la sesion. El usuario autoriza crear ramas y hacer commit/push de la feature de implementacion asignada, segun el protocolo C:/fintrack/docs/git-por-feature.md; leelo antes de delegar o publicar. Las instrucciones de solo planificar/revisar/no publicar prevalecen. Merge, despliegue y operaciones destructivas no estan incluidos.

## Git por feature

El coordinador asigna ID, contrato, base/SHA, rama, worktree absoluto, archivos autorizados y responsable unico de Git. Usar worktrees independientes en C:/fintrack/worktrees; no cambiar ramas en las carpetas principales compartidas mientras haya agentes trabajando.

Cada responsable valida el alcance y ejecuta los checks pertinentes antes de preparar rutas explicitas y publicar solo su rama en origin. No incluir cambios ajenos, secretos ni configuracion personal ajena a la entrega. Backend y database comparten un responsable de Git cuando colaboran en la misma feature. Sin permisos o ante un rechazo, devolver bloqueo y comando al coordinador, sin force push.

Los worktrees incluyen esta skill cuando esta versionada en su base; si aun no lo esta, pasar su ruta original al especialista. Los limites de dominio se aplican a las rutas equivalentes dentro del worktree asignado. El coordinador conserva la escritura exclusiva de C:/fintrack/docs y consolida estados/evidencia despues de revisar cada entrega.
