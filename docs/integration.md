# Integracion prevista

## Estado de arranque local

Las aplicaciones tienen scripts y dependencias. Consultar el [README](../README.md) para `npm ci`, `npm run setup`, migraciones, seed y comandos de inicio. El frontend comprueba `/api/v1/health`; `/api/v1/health/ready` verifica PostgreSQL mediante `pg`. Estas rutas no sustituyen autenticacion ni persistencia TypeORM, implementadas en BE-01.

Navegador React (localhost:5173) -> HTTP/JSON -> API NestJS (localhost:3000/api/v1) -> PostgreSQL (localhost:5432).

El frontend nunca se conecta directamente a PostgreSQL y no recibe credenciales de base de datos ni secretos JWT. Las variables VITE_* son publicas.

Copiar .env.example a .env en cada repositorio y sustituir los valores de ejemplo. No subir .env a Git. CORS_ORIGIN del backend debe coincidir con el origen del frontend. DATABASE_URL debe coincidir con las credenciales POSTGRES_*; si la contrasena tiene caracteres especiales, codificarla para una URL.

La composicion Docker reside en fintrackBackend/compose.yaml. Incluye solo PostgreSQL en esta etapa: ejecutar docker compose --env-file .env config para validar y docker compose up -d database para iniciar. Requiere Docker Compose instalado. El volumen conserva datos entre reinicios.

Las aplicaciones se ejecutan localmente con npm. Para contenerizarlas en una etapa posterior, agregar Dockerfiles y servicios frontend/backend al mismo Compose. Dentro de Docker, el backend usara database:5432; el navegador seguira usando una URL accesible desde el host para la API.

Contrato aprobado en [dashboard-contract](dashboard-contract.md) y [OpenAPI v1](openapi/dashboard.v1.json). BE-01 incluye login/logout, sesiones bearer opacas sin cookies, guard, esquema/migracion y seed. Dashboard valida mes en America/La_Paz; BE-02 devuelve balance ready con amount cadena decimal y cutoff igual a asOf, independiente del mes seleccionado. BE-03 devuelve monthlySummary ready con data.income/data.expense cadenas exactas de dos decimales. Seed octubre2026: alice income0.00/expense500.05, bob income0.00/expense40.50; sus saldos acumulados2500.05/859.50 incluyen ingresos previos. Las otras tres secciones siguen notAvailable. Frontend debe manejar ese estado sin mostrar ceros. Errores usan envelope error.code/message sin SQL ni secretos; respuestas privadas no-store. Hay pruebas HTTP/PostgreSQL reales de acceso, saldo, resumen e integridad. Siguen pendientes BE-04 a BE-06, CRUD completos y paginacion de futuras listas publicas.

Overflow de saldo devuelve 422 DATA_OUT_OF_RANGE; apertura aun no efectiva o datos monetarios invalidos devuelven 500 DATA_INTEGRITY_ERROR. Usuario inexistente no obtiene apertura cero. Fallos abortan toda respuesta y nunca se convierten en saldo cero. Metas todavia sin persistencia: antes de habilitarlas BE-06 conectara SavingsReservationReader al dominio persistido dentro del snapshot del saldo.

Resumen mensual usa inicio inclusivo y fin exclusivo del mes elegido, tambien si es futuro; un posted posterior a asOf puede aparecer en el resumen sin afectar todavia al saldo. No se suman monedas distintas, no se incluyen anulados y no se compensan devoluciones contra gastos: son ingresos brutos. Mes vacio devuelve income0.00/expense0.00 solo tras consulta exitosa. Overflow de cualquiera de los totales devuelve422 DATA_OUT_OF_RANGE aunque el neto se compense. Fallos de resumen abortan la respuesta completa sin conservar un balance parcial. Saldo y resumen comparten snapshot REPEATABLE READ y un unico asOf en dashboard.
