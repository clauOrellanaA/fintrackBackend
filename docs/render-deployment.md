# Desplegar backend en Render

Este procedimiento prepara QA o produccion. No crea recursos ni ejecuta migraciones por guardar estos archivos. El responsable debe autorizar el deploy y revisar costes antes de crear servicios.

## Antes de publicar

1. Integrar el PR en dev y comprobar `application` y `structure` en GitHub Actions. `application` ejecuta todos los tests con PostgreSQL 17 aislado; no configurar TEST_DATABASE_URL con una base real.
2. Promover mediante PR de dev a qa. Para produccion, promover de qa a main tras validar ambos servicios.
3. Crear Render Postgres 17 y el servicio Node en la misma region y cuenta. Usar la Internal Database URL completa en DATABASE_URL. No utilizar las credenciales de .env.example.

## Configuracion

Importar `render.yaml` como Blueprint desde main despues de promover e integrar estos archivos en main. La plantilla despliega produccion desde main, usa una sola instancia gratuita y no crea una base de datos. Solicita DATABASE_URL y CORS_ORIGIN; comprobar ambos antes de aprobar la creacion. Si el servicio ya existe, configurar tambien Branch: main en Render o sincronizar su Blueprint. No compartir la base entre QA y produccion.

Configuracion manual equivalente:

| Campo | Valor |
| --- | --- |
| Tipo | Web Service / Node |
| Root Directory | Vacio |
| Build | `npm ci --include=dev && npm run build` |
| Start (una instancia) | `npm run start:render` |
| Health Check | `/api/v1/health/ready` |
| Auto-Deploy | After CI Checks Pass |

Variables: NODE_VERSION=24.21.0, NODE_ENV=production, API_PREFIX=api/v1, DATABASE_URL con la URL interna, CORS_ORIGIN con el origen HTTPS exacto del frontend (sin ruta ni barra final). Render suministra PORT. La API escucha en 0.0.0.0; synchronize permanece desactivado.

`start:render` aplica las migraciones compiladas y solo inicia la API si terminan correctamente. En un servicio de pago, configurar Pre-Deploy Command `npm run db:migrate:prod` y Start Command `npm run start:prod`. Usar esta separacion antes de aumentar replicas para evitar migraciones concurrentes. No ejecutar migraciones desde el build.

## Crear el primer usuario

No hay registro publico. `user:create` crea un usuario normal BOB (no un rol administrador), sin categorias, movimientos ni datos demo. Usa el mismo cifrado scrypt que el login. Rechaza correos duplicados sin actualizar contrasenas o saldos. No ejecutar el seed de desarrollo en produccion ni cambiar NODE_ENV para eludir su restriccion.

En una shell Bash del servicio ya compilado y migrado, capturar las credenciales de forma interactiva:

```bash
read -r -p 'Correo: ' ADMIN_EMAIL
read -r -s -p 'Contrasena (minimo 12 caracteres): ' ADMIN_PASSWORD
printf '\n'
export ADMIN_EMAIL ADMIN_PASSWORD
npm run user:create
unset ADMIN_EMAIL ADMIN_PASSWORD
```

El comando no imprime correo, contrasena, hash ni URL de conexion. No agregar estas variables a la configuracion permanente de Render ni pasar la contrasena como argumento del comando.

Por defecto la apertura es 0.00 y el instante actual. Para migrar un saldo inicial, definir explicitamente ADMIN_OPENING_BALANCE (dos decimales, hasta doce enteros, puede ser negativo) y ADMIN_OPENING_AT (UTC ISO, por ejemplo 2026-01-01T00:00:00.000Z, no futura) antes del comando y eliminarlas despues. Esto determina desde cuando se aceptan movimientos.

Si el plan no ofrece shell, ejecutar el comando desde una maquina administrativa con Node 24, `npm ci --include=dev && npm run build`, y DATABASE_URL externa con TLS (`sslmode=require`). Habilitar acceso de esa IP segun las reglas de la base. El destino debe ser confirmado por el responsable antes de ejecutar; el comando escribe en la base indicada. Eliminar DATABASE_URL del entorno al terminar.

## Validacion y recuperacion

- `/api/v1/health` devuelve vida del proceso; `/api/v1/health/ready` comprueba conexion SQL, pero no valida todas las tablas.
- Probar login real, panel vacio del nuevo usuario, cambio de mes y logout desde frontend. Los E2E con API simulada no sustituyen esta comprobacion.
- Proteger dev, qa y main con `application` y `structure` obligatorios. La configuracion de proteccion de GitHub debe realizarse por separado; el YAML no la activa.
- Obtener un respaldo antes de migrar datos reales. Revertir una version de la API no revierte el esquema; no ejecutar migraciones inversas automaticamente.
- El plan gratuito suspende servicios inactivos y su PostgreSQL caduca; para datos reales elegir un plan con respaldos y retencion adecuados.

Referencias: [Web Services](https://render.com/docs/web-services), [Blueprints](https://render.com/docs/blueprint-spec), [deploys y CI](https://render.com/docs/deploys), [PostgreSQL](https://render.com/docs/postgresql-creating-connecting), [limites gratuitos](https://render.com/docs/free).
