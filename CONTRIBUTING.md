# Flujo de trabajo Git

Los dos repositorios usan tres ramas permanentes:

- dev: integra el desarrollo diario.
- qa: recibe los cambios de dev para validacion del equipo.
- main: contiene las versiones aprobadas.

Crear ramas feature/<nombre>, fix/<nombre> o chore/<nombre> desde dev y abrir pull requests hacia dev. Promover cambios mediante pull requests de dev hacia qa y de qa hacia main. Mantener commits pequenos con prefijos feat:, fix:, docs: o chore:.

Cada repositorio ejecuta su propia GitHub Action en pushes a main, dev y qa, y en pull requests cuyo destino sea cualquiera de esas tres ramas. Tambien admite ejecucion manual mediante workflow_dispatch. Los mismos controles se aplican a las tres ramas; no hay despliegues automaticos ni promociones automaticas.

La CI verifica estructura, archivos obligatorios, ausencia de archivos .env rastreados y formato del diff. El backend tambien valida Docker Compose. Ambos repositorios ejecutan npm ci, lint, chequeo de tipos y build con Node 24. El backend ejecuta npm test con PostgreSQL 17 aislado: migraciones, seed, autenticacion HTTP, periodos, saldo, resumen mensual, distribucion por categoria, snapshot concurrente y aislamiento por usuario. Consultar README para TEST_DATABASE_URL; las pruebas financieras de BE-05/BE-06 quedan pendientes.

React/Vite y NestJS ya tienen package.json y lockfile. Al implementar comportamiento de negocio, agregar pruebas pertinentes y su ejecucion en CI. No agregar verificaciones ficticias.

En GitHub, crear main, dev y qa y configurar proteccion para las tres ramas, revision de pull requests y el check structure como obligatorio. Estas configuraciones requieren un remoto y permisos de administracion; los workflows no crean ramas ni activan protecciones.

Para cambios coordinados en la API, enlazar los pull requests de ambos repositorios y mantener compatibilidad o versionar el contrato.
