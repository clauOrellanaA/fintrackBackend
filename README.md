# FinanTrack - backend

Sistema web para la gestion y el control de finanzas personales.

Equipo **Cosa1ycosa2**: Luciana Salinas y Claudia Orellana.

## Estado

BE-01 implementa TypeORM/PostgreSQL, migracion de usuarios, sesiones, categorias y movimientos, login/logout y dashboard protegido con validacion de mes. BE-02 agrega saldo acumulado; BE-03 ingresos y gastos mensuales; BE-04 distribucion por categoria; BE-05 indicadores de presupuestos por categoria/mes con limite, consumo, restante, progreso y estado exactos. BE-06 agrega metas y reservas persistidas; las cinco secciones estan disponibles. El health check `pg` sigue independiente de la persistencia ORM.

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

BE-05 agrega una segunda migracion para budgets; ejecuta `npm run db:migrate` antes de repetir el seed sobre una base BE-01. El seed amplia tambien usuarios existentes: tres presupuestos en febrero2026 (80%,100%,excedido), limite100.00 para alice y200.00 para bob. Agrega seis movimientos demo por persona, tres gastos y tres ingresos compensatorios al mismo instante: saldo acumulado y datos de octubre no cambian. IDs deterministas evitan duplicados incluso al revertir/reaplicar la migracion de budgets. Presupuestos, passwords, aperturas y movimientos preexistentes no se sobreescriben. Una apertura posterior a los datos demo causa rollback completo, sin omitir su validacion.

`POST /api/v1/auth/login` con JSON `{"email":"alice@fintrack.test","password":"<tu password local>"}` obtiene token aleatorio valido 8 horas. Usar `Authorization: Bearer <token>` en `GET /api/v1/dashboard?month=2026-10`; `DELETE /api/v1/auth/session` lo revoca. No enviar userId. Proteger HTTP con HTTPS fuera de localhost; el frontend conserva token solo en memoria. No existe registro publico ni CRUD financiero completo en esta entrega.

## Pruebas reales

`npm test` compila y ejecuta node:test; requiere `TEST_DATABASE_URL` a una instancia dedicada cuya base se llame exactamente `fintrack_be01_test` y un rol con CREATEDB. La suite crea su propia base aleatoria, migra desde vacio, prueba HTTP y propiedad de datos, y elimina unicamente esa base al terminar. Nunca usa DATABASE_URL de desarrollo como destino de pruebas; si falta TEST_DATABASE_URL, falla explicitamente. No apuntar a la instancia del usuario.

Ejemplo de instancia aislada (credenciales exclusivamente de prueba, puerto separado):

```powershell
docker run --detach --name fintrack-be01-postgres-test --publish 127.0.0.1:16432:5432 --env POSTGRES_DB=fintrack_be01_test --env POSTGRES_USER=fintrack_test --env POSTGRES_PASSWORD=isolated-test-only postgres:17-alpine
$env:TEST_DATABASE_URL = 'postgresql://fintrack_test:isolated-test-only@127.0.0.1:16432/fintrack_be01_test'
npm test
```

Esperar a que PostgreSQL acepte conexiones antes de ejecutar la suite. CI usa un servicio PostgreSQL 17 dedicado y ejecuta los mismos tests junto a npm ci, lint, tipos y build. La suite incluye BE-02 a BE-06, migraciones desde vacio y actualizaciones desde BE-01/BE-05, retiros concurrentes y seed completo. Ver evidencias [BE-02](docs/be-02-delivery.md), [BE-03](docs/be-03-delivery.md), [BE-04](docs/be-04-delivery.md) y [BE-05](docs/be-05-delivery.md) y [BE-06](docs/be-06-delivery.md) para casos y reservas persistidas.

## Arquitectura

Frontend: React + TypeScript + Vite, organizado en src/features.
Backend: Node.js + NestJS + TypeScript, organizado en src/modules.
Persistencia: PostgreSQL. Infraestructura prevista: Docker Compose.

Repositorios hermanos: ../fintrackFrontend y ../fintrackBackend. Cada uno tiene historial Git independiente. Los remotos de GitHub deben configurarse cuando se disponga de sus URLs.

Consultar [arquitectura](docs/architecture.md), [integracion](docs/integration.md) y [flujo Git](CONTRIBUTING.md).

## Metas y reservas BE-06

Ejecutar `npm run db:migrate` aplica la tercera migracion antes de usar BE-06. El seed agrega seis metas por usuario (cinco visibles y una archivada), aportes y retiros reales, sin movimientos income/expense compensatorios. Reserva neta: alice 300.00, bob 600.00; saldo disponible demo al 2026-10-19: 2200.05 y 259.50 respectivamente. Aperturas, contrasenas, ocho movimientos previos por usuario y resumen mensual no se modifican. Repetir seed no duplica metas ni aportes.

Archivar solo oculta: no libera la reserva. Un retiro explicito la libera, incluso en una meta archivada. El registro de ahorro conserva el historial: se agregan aportes/retiros, no se editan ni eliminan entradas. La base rechaza retiros que dejen negativo un saldo efectivo y serializa escritores; una transaccion REPEATABLE READ obsoleta falla con 40001 y el llamador debe reintentar toda su transaccion. No hay CRUD publico de metas en esta entrega.

## Validacion integrada BE-07

`npm test` valida los ejemplos OpenAPI y respuestas HTTP reales mediante JSON Schema 2020, junto con aislamiento, vacios, errores y consistencia de las cinco secciones. CI ejecuta la misma suite sobre PostgreSQL aislado. Ver [cierre backend](docs/be-07-delivery.md).

Para repetir la medicion manual, configurar TEST_DATABASE_URL a la instancia de pruebas dedicada (igual que npm test) y ejecutar `npm run benchmark:dashboard`. Opcional: BENCHMARK_OUTPUT indica el archivo JSON de resultados. El comando crea una base aleatoria propia, carga datos sinteticos, mide 20 peticiones tras calentamiento y elimina solo esa base al terminar. No usar una instancia de desarrollo del usuario. La conexion de carga permite120s para insertar el fixture; la API conserva su timeout normal5s. El benchmark no forma parte de los checks de CI y no establece un SLA productivo. Evidencia exportada en [be-07-benchmark.json](docs/be-07-benchmark.json).
