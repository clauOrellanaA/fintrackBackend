# FinanTrack - backend

Sistema web para la gestion y el control de finanzas personales.

Equipo **Cosa1ycosa2**: Luciana Salinas y Claudia Orellana.

## Estado

API NestJS inicializada con endpoints de salud y comprobacion real de PostgreSQL mediante `pg`. Todavia no hay autenticacion, ORM, esquema financiero ni migraciones. `pg` se utiliza para comprobar la conexion; no elige el futuro ORM.

## Desarrollo local

Requiere Node.js 22.12 o superior (validado con Node 24), npm y Docker Desktop iniciado con contenedores Linux. En PowerShell se puede usar `npm.cmd` si se bloquea `npm.ps1`.

```powershell
cd C:\fintrack\fintrackBackend
npm ci
npm run setup
npm run db:config
npm run db:up
npm run start:dev
```

`setup` crea `.env` solo si no existe, con contrasena PostgreSQL y secreto aleatorios. No imprime sus valores. Si ya copiaste el ejemplo manualmente, sustituye sus valores de muestra y manten la contrasena de DATABASE_URL sincronizada con POSTGRES_PASSWORD. El secreto JWT es una reserva para configuracion futura, no una autenticacion implementada.

- API: http://localhost:3000/api/v1/health (vida del proceso, no verifica la base).
- Base: http://localhost:3000/api/v1/health/ready (`SELECT 1`; devuelve 503 si PostgreSQL no responde).
- `npm run db:status` y `npm run db:logs`: diagnostico de PostgreSQL.
- `npm run db:down`: detiene Compose sin eliminar el volumen.
- Ctrl+C detiene la API. PostgreSQL sigue activo hasta ejecutar `db:down`.

Verificacion: `npm run lint`, `npm run typecheck`, `npm run build`. Para ejecutar el compilado: `npm run build` y despues `npm start`. `npm run dev` y `npm run start:dev` recompilan y reinician al editar TypeScript.

Si Docker informa que no encuentra el motor, abrir Docker Desktop y esperar a que este listo. Si 5432 esta ocupado, resolver el conflicto o ajustar el puerto publicado y DATABASE_URL juntos. Cambiar POSTGRES_PASSWORD no cambia la contrasena de un volumen existente; conservar las credenciales originales o realizar una rotacion explicita, sin eliminar datos para resolverlo.

Los scripts, configuraciones y lockfile se versionan. `.env`, `node_modules` y `dist` ya estan excluidos por `.gitignore`. No hay endpoints financieros ni pruebas funcionales de esos dominios en esta etapa.

## Arquitectura

Frontend: React + TypeScript + Vite, organizado en src/features.
Backend: Node.js + NestJS + TypeScript, organizado en src/modules.
Persistencia: PostgreSQL. Infraestructura prevista: Docker Compose.

Repositorios hermanos: ../fintrackFrontend y ../fintrackBackend. Cada uno tiene historial Git independiente. Los remotos de GitHub deben configurarse cuando se disponga de sus URLs.

Consultar [arquitectura](docs/architecture.md), [integracion](docs/integration.md) y [flujo Git](CONTRIBUTING.md).
