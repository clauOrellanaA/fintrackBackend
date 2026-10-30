# Colecciones Postman de FinTrack

Siete colecciones con 27 solicitudes: las 26 operaciones de los [contratos OpenAPI](../docs/openapi) y `GET /health`.

| Colección | Solicitudes |
| --- | --- |
| [01 Acceso y perfil](collections/01-auth-profile.postman_collection.json) | 7 |
| [02 Movimientos y categorías](collections/02-transactions-categories.postman_collection.json) | 9 |
| [03 Dashboard](collections/03-dashboard.postman_collection.json) | 1 |
| [04 Presupuestos](collections/04-budgets.postman_collection.json) | 4 |
| [05 Metas de ahorro](collections/05-savings-goals.postman_collection.json) | 4 |
| [06 Reportes](collections/06-reports.postman_collection.json) | 1 |
| [07 Avisos](collections/07-notifications.postman_collection.json) | 1 |

## Importar y seleccionar un entorno

1. Abre el workspace que utilizarás en Postman y pulsa **Import**.
2. Importa los siete JSON de `collections/` y los dos de `environments/`.
3. Selecciona **FinTrack - Local** o **FinTrack - Render** en el selector de entorno.

| Plantilla | `baseUrl` |
| --- | --- |
| [Local](environments/local.postman_environment.json) | `http://localhost:3000/api/v1` |
| [Render](environments/render.postman_environment.json) | `https://fintrack-api-dnp0.onrender.com/api/v1` |

`baseUrl` ya incluye `/api/v1`; las solicitudes utilizan `{{baseUrl}}` sin repetir el prefijo. Local requiere la API y PostgreSQL en ejecución. Para acceder a `localhost`, utiliza Postman Desktop o la aplicación web con Desktop Agent.

## Iniciar sesión y usar las solicitudes

1. Completa `email` y `password` como valores locales del entorno con una cuenta de pruebas existente. Conserva sus valores reales fuera de estas plantillas. Si utilizas Postman Vault directamente, adapta las referencias y las validaciones de la solicitud; el flujo predeterminado de estas colecciones lee variables del entorno.
2. Abre **01 Acceso y perfil → 01 Acceso → Iniciar sesión** y pulsa **Send**.
3. Tras un login correcto, el script guarda `accessToken` y `tokenExpiresAt` en el entorno seleccionado. Las demás colecciones heredan Bearer `{{accessToken}}`.
4. Selecciona la solicitud que necesites. Los scripts omiten solicitudes cuando faltan variables requeridas y muestran sus nombres en la consola de Postman.

Registro es para una cuenta nueva. `displayName` tiene un valor de ejemplo editable; `newPassword` se completa al cambiar la contraseña. Cerrar sesión y cambiar contraseña limpian el token local; el cambio de contraseña revoca todas las sesiones del usuario.

Las creaciones exitosas guardan `transactionId`, `categoryId`, `budgetId` o `goalId` en el entorno seleccionado. Puedes completar esos IDs manualmente para recursos propios existentes. Crea una categoría antes de crear su presupuesto y una meta antes de registrar aportes o retiros.

POST, PATCH y DELETE operan sobre el entorno seleccionado: utiliza datos de pruebas. DELETE de un movimiento lo anula. Las metas se archivan mediante PATCH con `{"archived":true}` y se desarchivan con `{"archived":false}`; archivar conserva la reserva.

## Fechas, filtros y respuestas

Los filtros opcionales están deshabilitados inicialmente. Activa únicamente los que necesites; `GET /transactions` conserva por defecto el historial vigente sin filtros adicionales.

`month` usa `YYYY-MM`. Si está vacío, el script toma el mes actual de `America/La_Paz`. Reportes envía `reportFrom` y `reportTo` como días inclusivos `YYYY-MM-DD`; por defecto usa el primer día del mes y el día local actual. Los filtros opcionales `transactionFrom` y `transactionTo` son instantes ISO con zona, con inicio inclusivo y fin exclusivo.

Las solicitudes incluyen comprobaciones de estado HTTP, JSON y caché privada cuando corresponde. Hay 15 ejemplos de respuesta seleccionados de los OpenAPI, no todos los ejemplos disponibles en los contratos. La disponibilidad de avisos y demás funcionalidades en Render depende de la versión desplegada.

## Versionado y comprobación

Estos archivos son plantillas portables: las credenciales y los tokens permanecen vacíos en Git. Al actualizar una exportación, conserva esa condición y excluye datos reales o metadatos de cuenta.

La preparación de las colecciones comprobó 13 cuerpos contra sus esquemas, 61 scripts sintácticamente y los 15 ejemplos seleccionados contra los contratos. Esas verificaciones estáticas no acreditan una ejecución autenticada en Postman Sandbox ni operaciones de negocio contra Render; esas pruebas requieren una cuenta y datos de pruebas.

Git y Postman no se sincronizan automáticamente. Para actualizar, contrasta la colección con `docs/openapi/`, exporta únicamente su configuración y revisa el diff antes de publicarla.
