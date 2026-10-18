# Integracion prevista

Navegador React (localhost:5173) -> HTTP/JSON -> API NestJS (localhost:3000/api/v1) -> PostgreSQL (localhost:5432).

El frontend nunca se conecta directamente a PostgreSQL y no recibe credenciales de base de datos ni secretos JWT. Las variables VITE_* son publicas.

Copiar .env.example a .env en cada repositorio y sustituir los valores de ejemplo. No subir .env a Git. CORS_ORIGIN del backend debe coincidir con el origen del frontend. DATABASE_URL debe coincidir con las credenciales POSTGRES_*; si la contrasena tiene caracteres especiales, codificarla para una URL.

La composicion Docker reside en fintrackBackend/compose.yaml. Incluye solo PostgreSQL en esta etapa: ejecutar docker compose --env-file .env config para validar y docker compose up -d database para iniciar. Requiere Docker Compose instalado. El volumen conserva datos entre reinicios.

Cuando existan aplicaciones ejecutables, agregar Dockerfiles y servicios frontend/backend al mismo Compose. Dentro de Docker, el backend usara database:5432; el navegador seguira usando una URL accesible desde el host para la API.

Pendiente de implementacion: contrato OpenAPI versionado, endpoints, esquema y migraciones, ORM, mecanismo de sesion, manejo de errores, paginacion y pruebas de integracion. Las carpetas creadas no implican conexiones activas.
