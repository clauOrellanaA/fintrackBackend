# FinanTrack - backend

Sistema web para la gestion y el control de finanzas personales.

Equipo **Cosa1ycosa2**: Luciana Salinas y Claudia Orellana.

## Estado

BE-01 implementa TypeORM/PostgreSQL, migracion de usuarios, sesiones, categorias y movimientos, login/logout y dashboard protegido con validacion de mes. Las cinco secciones financieras siguen `notAvailable` hasta BE-02 a BE-06; no se devuelven cifras ficticias. El health check `pg` sigue independiente de la persistencia ORM.

## Desarrollo local

Requiere Node.js 22.12 o superior (validado con Node 24), npm y Docker Desktop iniciado con contenedores Linux. En PowerShell se puede usar `npm.cmd` si se bloquea `npm.ps1`.

```powershell
cd C:\fintrack\fintrackBackend
npm ci
npm run setup
npm run db:config
npm run db:up
npm run db:migrate
npm run start:dev
```

`setup` crea `.env` solo si no existe, con contrasena PostgreSQL aleatoria. No imprime su valor. Si ya copiaste el ejemplo manualmente, sustituye sus valores de muestra y manten la contrasena de DATABASE_URL sincronizada con POSTGRES_PASSWORD. Las sesiones son opacas: no necesitan JWT_SECRET; esa variable de configuraciones antiguas ya no se utiliza. Las migraciones solo se aplican explicitamente, nunca al iniciar la API, y `synchronize` permanece desactivado.

- API: http://localhost:3000/api/v1/health (vida del proceso, no verifica la base).
- Base: http://localhost:3000/api/v1/health/ready (`SELECT 1`; devuelve 503 si PostgreSQL no responde).
- `npm run db:status` y `npm run db:logs`: diagnostico de PostgreSQL.
- `npm run db:down`: detiene Compose sin eliminar el volumen.
- Ctrl+C detiene la API. PostgreSQL sigue activo hasta ejecutar `db:down`.

Verificacion: `npm run lint`, `npm run typecheck`, `npm run build`. Para ejecutar el compilado: `npm run build` y despues `npm start`. `npm run dev` y `npm run start:dev` recompilan y reinician al editar TypeScript.

Si Docker informa que no encuentra el motor, abrir Docker Desktop y esperar a que este listo. Si 5432 esta ocupado, resolver el conflicto o ajustar el puerto publicado y DATABASE_URL juntos. Cambiar POSTGRES_PASSWORD no cambia la contrasena de un volumen existente; conservar las credenciales originales o realizar una rotacion explicita, sin eliminar datos para resolverlo.

Los scripts, configuraciones y lockfile se versionan. `.env`, `node_modules` y `dist` estan excluidos por `.gitignore`. Consultar [contrato aprobado](docs/dashboard-contract.md) y [OpenAPI](docs/openapi/dashboard.v1.json).

## Seed y acceso local

Tras migrar una base de desarrollo, configurar `NODE_ENV=development` y un `SEED_PASSWORD` local de entre 12 y 1024 caracteres (en `.env` o variable del proceso), despues ejecutar `npm run db:seed`. Crea `alice@fintrack.test` y `bob@fintrack.test` con aperturas explicitas, categorias y movimientos distintos. Repetirlo no duplica ni borra datos y no cambia passwords existentes. No registra password ni token. Se rechaza fuera de development/test y no se ejecuta automaticamente.

`POST /api/v1/auth/login` con JSON `{"email":"alice@fintrack.test","password":"<tu password local>"}` obtiene token aleatorio valido 8 horas. Usar `Authorization: Bearer <token>` en `GET /api/v1/dashboard?month=2026-10`; `DELETE /api/v1/auth/session` lo revoca. No enviar userId. Proteger HTTP con HTTPS fuera de localhost; el frontend conserva token solo en memoria. No existe registro publico ni CRUD financiero completo en esta entrega.

## Pruebas reales

`npm test` compila y ejecuta node:test; requiere `TEST_DATABASE_URL` a una instancia dedicada cuya base se llame exactamente `fintrack_be01_test` y un rol con CREATEDB. La suite crea su propia base aleatoria, migra desde vacio, prueba HTTP y propiedad de datos, y elimina unicamente esa base al terminar. Nunca usa DATABASE_URL de desarrollo como destino de pruebas; si falta TEST_DATABASE_URL, falla explicitamente. No apuntar a la instancia del usuario.

Ejemplo de instancia aislada (credenciales exclusivamente de prueba, puerto separado):

```powershell
docker run --detach --name fintrack-be01-postgres-test --publish 127.0.0.1:16432:5432 --env POSTGRES_DB=fintrack_be01_test --env POSTGRES_USER=fintrack_test --env POSTGRES_PASSWORD=isolated-test-only postgres:17-alpine
$env:TEST_DATABASE_URL = 'postgresql://fintrack_test:isolated-test-only@127.0.0.1:16432/fintrack_be01_test'
npm test
```

Esperar a que PostgreSQL acepte conexiones antes de ejecutar la suite. CI usa un servicio PostgreSQL 17 dedicado y ejecuta los mismos tests junto a npm ci, lint, tipos y build. No hay pruebas de calculos financieros BE-02 a BE-06 todavia.

## Arquitectura

Frontend: React + TypeScript + Vite, organizado en src/features.
Backend: Node.js + NestJS + TypeScript, organizado en src/modules.
Persistencia: PostgreSQL. Infraestructura prevista: Docker Compose.

Repositorios hermanos: ../fintrackFrontend y ../fintrackBackend. Cada uno tiene historial Git independiente. Los remotos de GitHub deben configurarse cuando se disponga de sus URLs.

Consultar [arquitectura](docs/architecture.md), [integracion](docs/integration.md) y [flujo Git](CONTRIBUTING.md).
