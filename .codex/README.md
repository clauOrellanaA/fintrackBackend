# Equipo de agentes FinanTrack

Esta carpeta y la skill de colaboracion estan habilitadas para versionarse en ambos repositorios por instruccion del usuario. No incluir credenciales ni ajustes personales.
La misma configuracion esta instalada en frontend y backend para iniciar una sesion desde cualquiera.
Las copias son independientes: al cambiar roles, actualizar ambas.

## Archivos

- config.toml: coordinacion del agente principal y hasta tres especialistas simultaneos.
- agents/frontend.toml: React, TypeScript, Vite y consumo de API.
- agents/backend.toml: NestJS, autenticacion y reglas financieras.
- agents/database.toml: PostgreSQL, integridad y migraciones.

## Uso

Abre una nueva sesion de Codex en el repositorio para cargar la configuracion local.
Si Codex solicita confiar en el proyecto, revisa y acepta solo si corresponde; una configuracion local puede no cargarse en proyectos no confiables.
Ejemplo de pedido:

"Usa frontend, backend y database para planificar el registro de movimientos. Acuerden el contrato y las responsabilidades. No implementen todavia."

Para implementar una tarea autorizada, indica la feature y el resultado esperado. El coordinador elegira solo los especialistas necesarios.
El principal coordina: no es necesario un cuarto agente personalizado.
Los agentes heredan el modelo y permisos de la sesion; estos archivos no conceden acceso al repo hermano.
Si solo esta abierto el frontend, puede ser necesario habilitar el backend como carpeta de trabajo o aprobar su escritura.

## Acuerdo de colaboracion

1. Leer arquitectura e integracion; revisar la rama y cambios actuales.
2. Definir contrato API, modelo y formato monetario/fechas.
3. Asignar un escritor por archivo; database y backend deben acordar quien edita entidades ORM.
4. Paralelizar tareas independientes; comunicar cambios de contrato antes de consumirlos.
5. Integrar y verificar con los comandos realmente disponibles.

Los archivos no ejecutan codigo ni despliegan por si solos. La carga y seleccion de agentes depende de la version y cliente de Codex.
No se han fijado modelos ni modificado ajustes globales. No hay credenciales en esta carpeta.
Para features de implementacion asignadas, el usuario autoriza crear ramas y realizar commit/push limitado a su feature. Usar worktree independiente y responsable unico de Git; leer C:/fintrack/docs/git-por-feature.md. Las tareas de solo planificacion/revision no publican automaticamente. No realizar merge ni despliegue. Flujo del equipo: feature -> dev -> qa -> main.

## Git

/.codex/ y /.agents/skills/fintrack-collaboration/ no estan excluidas de Git; pueden agregarse con rutas explicitas, sin git add -f.
Los archivos .env y .env.* siguen ignorados; solo .env.example puede versionarse.
Publicar mediante rama propia y PR hacia dev, siguiendo CONTRIBUTING.md. Este cambio no autoriza merge ni despliegue.

Referencia oficial: https://developers.openai.com/codex/subagents

## Skill de colaboracion

El protocolo compartido esta en ../.agents/skills/fintrack-collaboration/SKILL.md (ruta relativa a esta carpeta .codex). El coordinador y los tres roles lo referencian explicitamente.

En una nueva sesion puedes pedir: "Usa $fintrack-collaboration para planificar una feature con los agentes necesarios, sin implementar todavia".

La skill tambien puede versionarse y las copias de ambos repositorios deben mantenerse sincronizadas.
