# FinanTrack — backend

API para gestionar finanzas personales: ingresos, gastos, categorías y presupuestos. El dashboard reúne saldo disponible, ingresos y gastos mensuales, distribución de gastos por categoría, presupuestos y metas de ahorro. Cada usuario accede únicamente a sus datos mediante una sesión autenticada.

Equipo **Cosa1ycosa2**: Luciana Salinas y Claudia Orellana.

## Tecnologías y alcance

Backend construido con **Node.js, NestJS 11, TypeScript, TypeORM 0.3 y PostgreSQL 17**. Los dominios están en `src/modules`; configuración y migraciones, en `src/config` y `src/database`.

Incluye inicio y cierre de sesión, gestión de movimientos, categorías y presupuestos, y consulta del dashboard. Las metas y reservas persistidas se consultan en el dashboard; no tienen endpoints públicos de gestión. No hay registro público ni integración bancaria.

Los importes usan decimales exactos en BOB y se devuelven como cadenas con dos decimales. Los periodos mensuales usan `America/La_Paz`. Las contraseñas se guardan con hash scrypt; las sesiones utilizan tokens bearer opacos, revocables y válidos durante ocho horas.

## Requisitos técnicos

- Node.js **22.12 o superior**; la CI usa Node 24.
- npm y dependencias fijadas en `package-lock.json`.
- Docker Desktop iniciado con contenedores Linux y Docker Compose.
- Puertos `3000` (API) y `5432` (PostgreSQL) libres.

Los comandos siguientes usan PowerShell. Si se bloquea `npm.ps1`, usa `npm.cmd`. Docker ejecuta PostgreSQL; la API se ejecuta con Node en tu computadora.

## Levantar el proyecto en local

### 1. Instalar y configurar

Desde la carpeta del repositorio o del worktree:

```powershell
npm ci
npm run setup
```

`setup` prepara automáticamente la configuración local con credenciales PostgreSQL aleatorias y entorno de desarrollo. Si ya existe configuración, la conserva. Comprueba que la conexión apunte a tu PostgreSQL local antes de migrar o cargar datos. Mantén separadas la configuración local y la de Render.

### 2. Iniciar PostgreSQL y migrar

Con Docker Desktop iniciado:

```powershell
npm run db:config
npm run db:up
npm run db:migrate
```

`db:config` valida Compose; `db:up` espera a que PostgreSQL esté disponible; `db:migrate` compila y aplica las migraciones pendientes. TypeORM usa `synchronize=false`: el esquema cambia mediante migraciones explícitas.

### 3. Cargar los usuarios de prueba

En la misma terminal, elige una contraseña local de 12 a 1024 caracteres y carga los datos de prueba:

```powershell
$env:SEED_PASSWORD = Read-Host 'Contraseña local de prueba (mínimo 12 caracteres)'
npm run db:seed
Remove-Item Env:SEED_PASSWORD
```

Al terminar debe aparecer `Seed local completado.`. Se crean dos usuarios con datos ficticios independientes:

| Correo | Contraseña |
| --- | --- |
| `alice@fintrack.test` | Contraseña elegida al cargar los datos de prueba |
| `bob@fintrack.test` | Contraseña elegida al cargar los datos de prueba |

No hay contraseña pública predeterminada. Cambiar `SEED_PASSWORD` o repetir el seed **no cambia contraseñas existentes**. El seed conserva los datos y evita duplicar sus registros; solo se permite en `development` o `test`.

Consulta **octubre de 2026** para ver gastos de ejemplo y **febrero de 2026** para tres presupuestos por usuario con consumos del 80 %, 100 % y superiores al límite. Hay ingresos en septiembre de 2026 y metas con aportes y retiros en marzo de 2026. El saldo es acumulado y las metas dependen de la fecha de consulta; no todos los indicadores se limitan al mes seleccionado.

### 4. Iniciar y comprobar la API

```powershell
npm run start:dev
```

Compila, inicia la API y la reinicia al editar TypeScript. Comprueba:

- [Estado de la API](http://localhost:3000/api/v1/health): verifica el proceso.
- [Conexión PostgreSQL](http://localhost:3000/api/v1/health/ready): devuelve `{"status":"ok","database":"connected"}` si la base responde; `503` si no está disponible.

Para ejecutar el compilado sin modo de desarrollo, usa `npm run build` y después `npm start`.

## Usuarios de prueba en Render

Estas cuentas pertenecen a la base de datos desplegada en Render. Completa la tabla con la contraseña asignada a cada usuario en ese entorno.

| Usuario | Correo | Contraseña en Render |
| --- | --- | --- |
| Alice | `alice@fintrack.test` | **[Escribir contraseña]** |
| Bob | `bob@fintrack.test` | **[Escribir contraseña]** |

Editar esta tabla solo documenta las credenciales; no cambia las contraseñas guardadas en la base de datos.

## Acceso a la API

Envía `POST http://localhost:3000/api/v1/auth/login` con `Content-Type: application/json` y este cuerpo, sustituyendo el marcador por tu contraseña local:

```json
{
  "email": "alice@fintrack.test",
  "password": "<tu contraseña local>"
}
```

La respuesta contiene `accessToken`, `tokenType` y `expiresAt`. Envía `Authorization: Bearer <accessToken>` en peticiones privadas, por ejemplo `GET /api/v1/dashboard?month=2026-10`. No envíes `userId`: la identidad se obtiene de la sesión. `DELETE /api/v1/auth/session` revoca el token.

| Recurso | Operaciones |
| --- | --- |
| `/api/v1/dashboard` | Consultar los cinco indicadores del panel |
| `/api/v1/transactions` | Listar y crear; consultar, editar o anular mediante `/{id}` |
| `/api/v1/categories` | Listar y crear; editar o eliminar mediante `/{id}` |
| `/api/v1/budgets` | Listar y crear; editar o eliminar mediante `/{id}` |

Los esquemas, filtros y errores están en OpenAPI: [dashboard y autenticación](docs/openapi/dashboard.v1.json), [movimientos y categorías](docs/openapi/transactions.v1.json) y [presupuestos](docs/openapi/budgets.v1.json). Credenciales rechazadas devuelven `401 INVALID_CREDENTIALS`; una sesión ausente, vencida o revocada devuelve `401 UNAUTHENTICATED`.

## Operación y verificaciones

| Comando | Uso |
| --- | --- |
| `npm run db:status` | Ver el estado de PostgreSQL |
| `npm run db:logs` | Consultar logs de la base |
| `npm run db:down` | Detener PostgreSQL conservando el volumen |
| `npm run lint` | Revisar código con ESLint |
| `npm run typecheck` | Comprobar tipos TypeScript |
| `npm run build` | Generar el compilado en `dist` |

Ctrl+C detiene la API; PostgreSQL sigue activo hasta `db:down`. Si Docker no encuentra el motor, inicia Docker Desktop. Si `5432` está ocupado, resuelve el conflicto o ajusta el puerto publicado de Compose y `DATABASE_URL` juntos. Cambiar `POSTGRES_PASSWORD` no cambia la contraseña de un volumen existente: conserva sus credenciales o realiza una rotación explícita.

`npm test` compila y ejecuta pruebas de contratos, migraciones y HTTP/PostgreSQL. Requiere una **instancia PostgreSQL aislada**: `TEST_DATABASE_URL` debe apuntar a una base llamada exactamente `fintrack_be01_test`, con un rol que pueda crear bases (`CREATEDB`). La suite crea bases temporales propias y las elimina al terminar. No uses tu instancia de desarrollo ni una base de Render con datos que quieras conservar. La CI configura PostgreSQL 17 dedicado y ejecuta estas pruebas junto con lint, tipos y build.

## Documentación adicional

- [Arquitectura](docs/architecture.md), [integración](docs/integration.md) y [contribución](CONTRIBUTING.md).
- [Contrato del dashboard](docs/dashboard-contract.md) y [validación integrada del dashboard](docs/be-07-delivery.md).
- [Render: despliegue, migraciones y primer usuario](docs/render-deployment.md). `start:render` aplica migraciones antes de iniciar la API, a diferencia del arranque local. Render se configura por separado del entorno local.

El código, configuraciones y lockfile se versionan; `node_modules` y `dist` están excluidos de Git.
