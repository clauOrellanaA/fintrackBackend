# FinanTrack — Backend

API REST para la gestión de finanzas personales, desarrollada con NestJS, TypeScript, TypeORM y PostgreSQL.

FinanTrack permite administrar ingresos, gastos, categorías y presupuestos desde una plataforma centralizada. Incluye un dashboard financiero con indicadores sobre el saldo disponible, los movimientos mensuales, la distribución de gastos, el consumo de presupuestos y las metas de ahorro.

Cada usuario accede exclusivamente a su información mediante una sesión autenticada.

**Equipo Cosa1ycosa2:** Luciana Salinas y Claudia Orellana.

---

## 1. Tecnologías utilizadas

| Tecnología | Versión | Propósito |
|---|---|---|
| Node.js | 22.12 o superior | Entorno de ejecución |
| NestJS | 11 | Framework backend |
| TypeScript | Según configuración del proyecto | Lenguaje de programación |
| TypeORM | 0.3 | ORM y gestión de migraciones |
| PostgreSQL | 17 | Base de datos relacional |
| Docker | Compatible con Docker Compose | Contenedorización de PostgreSQL |
| npm | Compatible con Node.js | Gestión de dependencias |
| OpenAPI | Contratos versionados | Documentación de endpoints |

La integración entre NestJS y TypeORM permite organizar la lógica de negocio en módulos y gestionar la persistencia de datos mediante entidades, repositorios y migraciones.

Los importes monetarios se manejan como valores decimales exactos expresados en bolivianos (BOB). La API devuelve estos importes como cadenas con dos decimales para evitar pérdidas de precisión.

Los periodos mensuales utilizan la zona horaria `America/La_Paz`.

---

## 2. Funcionalidades principales

### 2.1. Autenticación y sesiones

- Registro público con correo, nombre y contraseña.
- Inicio de sesión mediante correo electrónico y contraseña.
- Cambio de contraseña con revocación de todas las sesiones.
- Protección de endpoints privados.
- Identificación del usuario mediante el token de sesión.
- Cierre de sesión con revocación del token.
- Expiración de sesiones después de ocho horas.
- Almacenamiento de contraseñas mediante hash `scrypt`.

Las sesiones utilizan tokens bearer opacos, en lugar de depender de identificadores enviados directamente por el cliente.

El registro público se expone mediante POST /api/v1/auth/register; crea finanzas vacías y devuelve una sesión. El perfil propio se consulta y edita en /api/v1/users/me.

### 2.2. Gestión de transacciones

Permite registrar y consultar movimientos financieros.

Las operaciones disponibles incluyen:

- Registrar ingresos y gastos.
- Consultar el historial de movimientos.
- Obtener el detalle de una transacción.
- Modificar transacciones existentes.
- Anular movimientos.

Los movimientos pertenecen al usuario autenticado.

### 2.3. Gestión de categorías

Permite organizar los movimientos financieros mediante categorías.

Incluye:

- Listado de categorías.
- Creación de categorías.
- Modificación de categorías.
- Eliminación de categorías.

### 2.4. Gestión de presupuestos

Permite definir límites de gasto y consultar su utilización.

Incluye:

- Registro de presupuestos.
- Listado de presupuestos.
- Actualización de presupuestos.
- Eliminación de presupuestos.
- Consulta de su consumo desde el dashboard.

### 2.5. Dashboard financiero

El dashboard reúne cinco grupos de indicadores:

1. Saldo disponible.
2. Ingresos y gastos mensuales.
3. Distribución de gastos por categoría.
4. Estado y consumo de presupuestos.
5. Estado de las metas de ahorro.

Las metas y reservas se consultan desde el dashboard y se gestionan mediante /api/v1/savings-goals y /api/v1/savings-goals/{id}/entries autenticadas.

**Importante:** El saldo disponible puede reflejar movimientos acumulados. No todos los indicadores están restringidos al mes seleccionado.

### 2.6. Metas, reportes y avisos

- Crear, listar, editar y archivar metas; registrar aportes/retiros sin borrar historial.
- Consultar reportes por intervalo de días, con comparación, distribución y evolución del saldo.
- Consultar avisos actuales de presupuestos y metas; sin historial ni contador de no leídos.

### 2.7. Funcionalidades fuera del alcance actual

- Integración automática con bancos.
- Correo/SMS/push y entrega automática de avisos.
- Historial de notificaciones y estados leído/no leído.

---

## 3. Estructura general del proyecto

La aplicación utiliza una organización modular.

```text
fintrack-backend/
├── src/
│   ├── config/
│   │   └── Configuración de la aplicación
│   ├── database/
│   │   └── Configuración y migraciones
│   └── modules/
│       └── Módulos funcionales
├── docs/
│   ├── openapi/
│   │   ├── dashboard.v1.json
│   │   ├── transactions.v1.json
│   │   └── budgets.v1.json
│   ├── architecture.md
│   ├── integration.md
│   ├── dashboard-contract.md
│   └── render-deployment.md
├── CONTRIBUTING.md
├── package.json
├── package-lock.json
└── README.md
```

Este árbol representa las rutas principales documentadas y no necesariamente todos los archivos del repositorio.

La separación por módulos facilita el mantenimiento, las pruebas y la evolución de las funcionalidades.

---

## 4. Requisitos previos

Antes de instalar FinanTrack, verifica que tu equipo tenga:

- Node.js 22.12 o superior.
- npm.
- Docker Desktop.
- Docker Compose.
- Git.
- PowerShell o una terminal compatible.

La integración continua utiliza Node.js 24.

### Verificar instalaciones

Abre PowerShell y ejecuta:

```powershell
node --version
npm --version
docker --version
docker compose version
git --version
```

Si alguno de los comandos no se reconoce, verifica que la herramienta esté instalada y disponible en el `PATH`.

### Puertos necesarios

| Puerto | Servicio |
|---|---|
| 3000 | API NestJS |
| 5432 | PostgreSQL |

Ambos puertos deben estar disponibles si se mantienen los valores predeterminados.

En el entorno local, Docker ejecuta PostgreSQL y Node.js ejecuta la API directamente en la computadora.

---

## 5. Instalación y configuración local

Los siguientes comandos están preparados para PowerShell.

### Paso 1. Obtener el repositorio

Si todavía no tienes el proyecto:

```powershell
git clone <URL_DEL_REPOSITORIO>
cd <CARPETA_DEL_REPOSITORIO>
```

Reemplaza los marcadores con la URL y el nombre de carpeta correspondientes.

Si el repositorio ya está clonado, abre una terminal en su directorio raíz.

### Paso 2. Instalar dependencias

Ejecuta:

```powershell
npm ci
```

El comando instala las dependencias conforme a las versiones registradas en `package-lock.json`.

Si PowerShell bloquea la ejecución de `npm.ps1`, utiliza:

```powershell
npm.cmd ci
```

### Paso 3. Preparar el entorno

Ejecuta:

```powershell
npm run setup
```

Este comando prepara automáticamente la configuración local del proyecto.

Según la configuración documentada:

- Genera credenciales aleatorias para PostgreSQL.
- Prepara el entorno de desarrollo.
- Conserva configuraciones locales existentes.

Antes de iniciar las migraciones, verifica que la conexión configurada corresponda a tu base de datos local.

No reutilices credenciales de producción.

---

## 6. Levantar PostgreSQL con Docker

### Paso 1. Iniciar Docker Desktop

Abre Docker Desktop y verifica que el motor de contenedores Linux esté funcionando.

### Paso 2. Validar la configuración

Desde la raíz del backend:

```powershell
npm run db:config
```

Este comando valida la configuración de Docker Compose.

### Paso 3. Iniciar PostgreSQL

```powershell
npm run db:up
```

Este comando inicia PostgreSQL y espera a que la base de datos esté disponible.

### Paso 4. Ejecutar migraciones

```powershell
npm run db:migrate
```

El comando compila el proyecto y aplica las migraciones pendientes.

La configuración utiliza:

```text
synchronize=false
```

Esto significa que TypeORM no modifica automáticamente el esquema de la base de datos durante el inicio de la aplicación.

Los cambios estructurales se realizan mediante migraciones explícitas.

### Verificar PostgreSQL

```powershell
npm run db:status
```

Para consultar los registros del contenedor:

```powershell
npm run db:logs
```

### Detener PostgreSQL

```powershell
npm run db:down
```

Este comando detiene PostgreSQL conservando su volumen de datos.

**Nota:** Las migraciones gestionan el esquema, pero no garantizan la creación de usuarios o transacciones de ejemplo. La carga inicial de datos debe verificarse por separado.

---

## 7. Usuarios y datos de demostración

Se dispone de dos usuarios de demostración con información financiera ficticia e independiente.

### Credenciales del entorno de demostración en Render

| Usuario | Correo | Contraseña |
|---|---|---|
| Alice | `alice@fintrack.test` | `clavesegura123` |
| Bob | `bob@fintrack.test` | `clavesegura123` |

Estas credenciales deben utilizarse exclusivamente con fines de demostración.

**Importante:** La existencia de estos usuarios en Render no implica que estén disponibles automáticamente al crear una base de datos local.

### Crear los usuarios de prueba en local

Después de aplicar las migraciones a una base local vacía, ejecuta lo siguiente en la misma terminal PowerShell con el entorno de desarrollo configurado por `npm run setup`:

```powershell
$env:SEED_PASSWORD = Read-Host 'Contraseña local para Alice y Bob (mínimo 12 caracteres)'
try {
    npm run db:seed
} finally {
    Remove-Item Env:SEED_PASSWORD -ErrorAction SilentlyContinue
}
```

El comando crea las cuentas `alice@fintrack.test` y `bob@fintrack.test` con la contraseña local elegida y sus datos ficticios. Las contraseñas de Render son independientes. El seed solo se permite en desarrollo o pruebas, no se ejecuta automáticamente al iniciar la API y no cambia las contraseñas de usuarios que ya existen. La contraseña debe tener entre 12 y 1024 caracteres.

### Datos disponibles para demostración

| Periodo | Datos de ejemplo |
|---|---|
| Febrero de 2026 | Tres presupuestos por usuario con consumos del 80 %, 100 % y superiores al límite |
| Marzo de 2026 | Metas de ahorro con aportes y retiros |
| Septiembre de 2026 | Ingresos registrados |
| Octubre de 2026 | Gastos y movimientos por categoría |

Para verificar los gastos de ejemplo, selecciona octubre de 2026.

Para comprobar los diferentes niveles de consumo de presupuestos, selecciona febrero de 2026.

Los saldos y algunos indicadores de metas pueden variar según la fecha y los movimientos acumulados.

---

## 8. Ejecutar el backend

Una vez que PostgreSQL esté disponible y las migraciones se hayan aplicado, ejecuta:

```powershell
npm run start:dev
```

El servidor iniciará en modo desarrollo.

Este modo permite trabajar con reinicio automático ante cambios en archivos TypeScript.

Con la configuración predeterminada, la API estará disponible en:

```text
http://localhost:3000/api/v1
```

### Verificar que la API funciona

**Estado del proceso:**

GET `http://localhost:3000/api/v1/health`

Este endpoint permite verificar que la API está respondiendo.

**Estado de la conexión a PostgreSQL:**

GET `http://localhost:3000/api/v1/health/ready`

Cuando PostgreSQL está disponible, la respuesta esperada es:

```json
{
  "status": "ok",
  "database": "connected"
}
```

Si la base no está disponible, el endpoint devuelve HTTP `503`.

### Ejecutar el compilado

Para generar una versión compilada:

```powershell
npm run build
```

Después:

```powershell
npm start
```

Para detener la API iniciada desde la terminal, utiliza `Ctrl+C`.

PostgreSQL seguirá ejecutándose hasta que se detenga explícitamente.

---

## 9. Autenticación y acceso a la API

Los endpoints privados requieren autenticación.

### 9.1. Iniciar sesión

**Endpoint:**

```http
POST /api/v1/auth/login
```

**Headers:**

```http
Content-Type: application/json
```

**Cuerpo de ejemplo:**

```json
{
  "email": "alice@fintrack.test",
  "password": "<CONTRASENA_DEL_USUARIO>"
}
```

La contraseña debe corresponder al usuario existente en el entorno al que se realiza la petición.

La respuesta incluye:

- `accessToken`: token de acceso.
- `tokenType`: tipo de token.
- `expiresAt`: fecha y hora de expiración.

### 9.2. Acceder a un recurso protegido

En las solicitudes privadas se debe incluir:

```http
Authorization: Bearer <ACCESS_TOKEN>
```

Por ejemplo:

```http
GET /api/v1/dashboard?month=2026-10
Authorization: Bearer <ACCESS_TOKEN>
```

No se debe enviar `userId` para identificar al propietario de los datos.

El servidor obtiene la identidad del usuario a partir de la sesión.

### 9.3. Cerrar sesión

**Endpoint:**

```http
DELETE /api/v1/auth/session
```

La operación revoca el token de la sesión autenticada.

Las sesiones tienen una duración máxima documentada de ocho horas.

### 9.4. Errores de autenticación

| Código HTTP | Código de error | Descripción |
|---|---|---|
| 401 | `INVALID_CREDENTIALS` | Correo o contraseña incorrectos |
| 401 | `UNAUTHENTICATED` | Token ausente, vencido o revocado |

---

## 10. Endpoints disponibles

La API utiliza el prefijo:

```text
/api/v1
```

### Autenticación

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/auth/register` | Crear cuenta y sesión |
| POST | `/auth/login` | Iniciar sesión |
| POST | `/auth/password` | Cambiar contraseña y revocar sesiones |
| DELETE | `/auth/session` | Cerrar sesión y revocar token |

### Perfil propio

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/users/me` | Consultar perfil |
| PATCH | `/users/me` | Editar perfil y apertura |

### Dashboard

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/dashboard` | Consultar indicadores financieros |

El parámetro `month` permite solicitar información del periodo seleccionado.

Ejemplo:

```http
GET /api/v1/dashboard?month=2026-10
```

### Transacciones

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/transactions` | Listar movimientos |
| POST | `/transactions` | Crear movimiento |
| GET | `/transactions/{id}` | Consultar movimiento |
| PATCH | `/transactions/{id}` | Editar movimiento |
| DELETE | `/transactions/{id}` | Anular movimiento |

### Categorías

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/categories` | Listar categorías |
| POST | `/categories` | Crear categoría |
| PATCH | `/categories/{id}` | Editar categoría |
| DELETE | `/categories/{id}` | Eliminar categoría |

### Presupuestos

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/budgets` | Listar presupuestos |
| POST | `/budgets` | Crear presupuesto |
| PATCH | `/budgets/{id}` | Editar presupuesto |
| DELETE | `/budgets/{id}` | Eliminar presupuesto |

### Metas de ahorro

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/savings-goals` | Listar propias, incluidas archivadas |
| POST | `/savings-goals` | Crear meta |
| PATCH | `/savings-goals/{id}` | Editar, archivar o desarchivar |
| POST | `/savings-goals/{id}/entries` | Registrar aporte o retiro |

### Reportes y avisos

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/reports?from=YYYY-MM-DD&to=YYYY-MM-DD` | Reporte por días locales inclusivos |
| GET | `/notifications?month=YYYY-MM` | Avisos actuales; mes opcional |

[Contratos e índice de specs](docs/README.md) · [Entrega BE-SPECS](docs/be-specs-delivery.md).

---

## 11. Pruebas y calidad del código

El proyecto dispone de comandos para revisar la calidad y el funcionamiento de la aplicación.

| Comando | Descripción |
|---|---|
| `npm run lint` | Análisis estático con ESLint |
| `npm run typecheck` | Verificación de tipos TypeScript |
| `npm run build` | Compilación del proyecto |
| `npm test` | Ejecución de pruebas automatizadas |

### Ejecutar verificaciones

```powershell
npm run lint
npm run typecheck
npm run build
```

### Ejecutar pruebas automatizadas

```powershell
npm test
```

La suite documentada incluye pruebas de:

- Contratos de la API.
- Migraciones.
- Comunicación HTTP.
- Integración con PostgreSQL.

### Base de datos aislada para pruebas

Las pruebas requieren una instancia de PostgreSQL dedicada, independiente del entorno de desarrollo.

Se debe configurar:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://USUARIO:CONTRASENA@HOST:5432/fintrack_be01_test'
```

La base indicada debe llamarse exactamente:

```text
fintrack_be01_test
```

El rol utilizado debe disponer del privilegio PostgreSQL `CREATEDB`.

Cada suite crea su base temporal. Las suites históricas la eliminan; el helper nuevo cierra conexiones y conserva las bases exclusivamente dentro de la instancia descartable hasta retirarla.

**Advertencia:** No utilices una base de producción, una base de Render con datos importantes ni una instancia compartida que contenga información que necesites conservar.

La integración continua utiliza PostgreSQL 17 dedicado y ejecuta las pruebas junto con las comprobaciones de lint, tipos y compilación.

---

## 12. Despliegue en Render

FinanTrack contempla un entorno de despliegue en Render.

El entorno de Render debe mantener su configuración y credenciales separadas de la instalación local.

### Consideraciones principales

- Configurar las variables de entorno requeridas.
- Utilizar una conexión PostgreSQL correspondiente al entorno desplegado.
- Proteger las credenciales de base de datos.
- Ejecutar las migraciones antes de iniciar la aplicación.
- Verificar que el servicio pueda conectarse a PostgreSQL.
- Comprobar el funcionamiento de los endpoints de salud.

El script documentado:

```powershell
npm run start:render
```

Aplica las migraciones antes de iniciar la API, a diferencia del procedimiento local que ejecuta las migraciones como paso independiente.

Para instrucciones completas de despliegue, migraciones y creación del primer usuario, consultar [la guía de Render](docs/render-deployment.md).

La configuración de producción no debe sobrescribirse con las credenciales generadas durante `npm run setup`.

---

## 13. Comandos de operación

| Comando | Función |
|---|---|
| `npm ci` | Instalar dependencias fijadas |
| `npm run setup` | Preparar configuración local |
| `npm run db:config` | Validar Docker Compose |
| `npm run db:up` | Iniciar PostgreSQL |
| `npm run db:migrate` | Compilar y aplicar migraciones |
| `npm run db:status` | Consultar estado de PostgreSQL |
| `npm run db:logs` | Consultar registros |
| `npm run db:down` | Detener PostgreSQL conservando datos |
| `npm run start:dev` | Iniciar la API en desarrollo |
| `npm run build` | Generar compilado |
| `npm start` | Ejecutar compilado |
| `npm run lint` | Ejecutar ESLint |
| `npm run typecheck` | Verificar tipos |
| `npm test` | Ejecutar pruebas |
| `npm run start:render` | Ejecutar arranque configurado para Render |

---

Proyecto: **FinanTrack — Sistema de Gestión de Finanzas Personales**.

Backend desarrollado con NestJS, TypeScript y PostgreSQL.
