# Integracion prevista

## Estado de arranque local

Las aplicaciones tienen scripts y dependencias. Consultar el [README](../README.md) para `npm ci`, `npm run setup`, migraciones, seed y comandos de inicio. El frontend comprueba `/api/v1/health`; `/api/v1/health/ready` verifica PostgreSQL mediante `pg`. Estas rutas no sustituyen autenticacion ni persistencia TypeORM, implementadas en BE-01.

Navegador React (localhost:5173) -> HTTP/JSON -> API NestJS (localhost:3000/api/v1) -> PostgreSQL (localhost:5432).

El frontend nunca se conecta directamente a PostgreSQL y no recibe credenciales de base de datos ni secretos JWT. Las variables VITE_* son publicas.

Copiar .env.example a .env en cada repositorio y sustituir los valores de ejemplo. No subir .env a Git. CORS_ORIGIN del backend debe coincidir con el origen del frontend. DATABASE_URL debe coincidir con las credenciales POSTGRES_*; si la contrasena tiene caracteres especiales, codificarla para una URL.

La composicion Docker reside en fintrackBackend/compose.yaml. Incluye solo PostgreSQL en esta etapa: ejecutar docker compose --env-file .env config para validar y docker compose up -d database para iniciar. Requiere Docker Compose instalado. El volumen conserva datos entre reinicios.

Las aplicaciones se ejecutan localmente con npm. Para contenerizarlas en una etapa posterior, agregar Dockerfiles y servicios frontend/backend al mismo Compose. Dentro de Docker, el backend usara database:5432; el navegador seguira usando una URL accesible desde el host para la API.

Contrato aprobado en [dashboard-contract](dashboard-contract.md) y [OpenAPI v1](openapi/dashboard.v1.json). BE-01 incluye login/logout, sesiones bearer opacas sin cookies, guard, esquema/migracion y seed. Dashboard valida mes en America/La_Paz y devuelve secciones notAvailable hasta sus features. Frontend debe manejar ese estado sin mostrar ceros. Errores usan envelope error.code/message sin SQL ni secretos; respuestas privadas no-store. Hay pruebas HTTP/PostgreSQL reales de acceso e integridad. Siguen pendientes consultas/calculos BE-02 a BE-06, CRUD completos y paginacion de futuras listas publicas.
