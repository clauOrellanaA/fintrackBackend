# Integracion prevista

## Estado de arranque local

Las aplicaciones ya tienen scripts y dependencias. Consultar el [README](../README.md) para `npm ci`, `npm run setup` y los comandos de inicio. El frontend comprueba `/api/v1/health`; `/api/v1/health/ready` verifica PostgreSQL. Estas rutas no implementan autenticacion ni datos financieros. El backend utiliza `pg` para la comprobacion; el ORM de negocio sigue pendiente.

Navegador React (localhost:5173) -> HTTP/JSON -> API NestJS (localhost:3000/api/v1) -> PostgreSQL (localhost:5432).

El frontend nunca se conecta directamente a PostgreSQL y no recibe credenciales de base de datos ni secretos JWT. Las variables VITE_* son publicas.

Copiar .env.example a .env en cada repositorio y sustituir los valores de ejemplo. No subir .env a Git. CORS_ORIGIN del backend debe coincidir con el origen del frontend. DATABASE_URL debe coincidir con las credenciales POSTGRES_*; si la contrasena tiene caracteres especiales, codificarla para una URL.

La composicion Docker reside en fintrackBackend/compose.yaml. Incluye solo PostgreSQL en esta etapa: ejecutar docker compose --env-file .env config para validar y docker compose up -d database para iniciar. Requiere Docker Compose instalado. El volumen conserva datos entre reinicios.

Las aplicaciones se ejecutan localmente con npm. Para contenerizarlas en una etapa posterior, agregar Dockerfiles y servicios frontend/backend al mismo Compose. Dentro de Docker, el backend usara database:5432; el navegador seguira usando una URL accesible desde el host para la API.

Pendiente de implementacion: contrato OpenAPI versionado, endpoints de negocio, esquema y migraciones, ORM, mecanismo de sesion, manejo de errores de dominio, paginacion y pruebas de integracion. Las carpetas de features no implican reglas financieras implementadas.
